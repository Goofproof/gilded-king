// ============================================================================
// main.js - game loop, input, room logic, loot, shop, progression, states.
// ============================================================================
(() => {
  const W = 960, H = 540;
  const PF = Dungeon.PF;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // --- LEVEL-UP UPGRADE POOL (in-run, resets each run) --------------------------
  const UPGRADE_POOL = [
    { key: 'hp',     icon: '♥', color: '#e05555', name: 'Tough',   desc: '+15 max health, heal 15' },
    { key: 'dmg',    icon: '⚔', color: '#ffd24c', name: 'Brutal',  desc: '+10% damage' },
    { key: 'spd',    icon: '»', color: '#7fd4ff', name: 'Fleet',   desc: '+7% move speed' },
    { key: 'roll',   icon: '↻', color: '#7fd4ff', name: 'Acrobat', desc: '-12% roll cooldown' },
    { key: 'crit',   icon: '✦', color: '#ffd24c', name: 'Deadly',  desc: '+6% crit chance' },
    { key: 'coin',   icon: '●', color: '#ffd24c', name: 'Greedy',  desc: '+20% coins from kills' },
    { key: 'regen',  icon: '✚', color: '#6ee7a0', name: 'Mending', desc: 'Regenerate 0.6 HP/s' },
    { key: 'atkspd', icon: '≫', color: '#ff9a3d', name: 'Frenzy',  desc: '+10% attack speed' },
  ];

  // --- SHOP TUNING ---------------------------------------------------------------
  const POTION_PRICE = 25, POTION_HEAL = 40;
  const REROLL_BASE = 10;

  // --- persistent meta (survives death via localStorage) ---------------------------
  // --- arcade leaderboard (per-device, localStorage) -----------------------------
  // score = essence collected in a single run (banked total, incl. victory bonus)
  function loadScores() {
    try {
      const s = JSON.parse(localStorage.getItem('drl_scores'));
      if (Array.isArray(s)) return s.filter(e => e && typeof e.score === 'number').slice(0, 10);
    } catch { }
    return [];
  }
  function saveScores(scores) {
    try { localStorage.setItem('drl_scores', JSON.stringify(scores.slice(0, 10))); } catch { }
  }
  function scoreQualifies(score) {
    if (score <= 0) return false;
    const s = loadScores();
    return s.length < 10 || score > s[s.length - 1].score;
  }

  function loadMeta() {
    // normalize shape too - a hand-edited/corrupt drl_meta must never brick the title screen
    let m = null;
    try { m = JSON.parse(localStorage.getItem('drl_meta')); } catch { /* corrupt json */ }
    if (typeof m !== 'object' || m === null) m = {};
    if (typeof m.essence !== 'number' || !isFinite(m.essence)) m.essence = 0;
    if (typeof m.ranks !== 'object' || m.ranks === null) m.ranks = {};
    return m;
  }
  function saveMeta() {
    try { localStorage.setItem('drl_meta', JSON.stringify(g.meta)); }
    catch { /* private browsing / quota - meta just won't persist */ }
  }

  // --- input ------------------------------------------------------------------------
  const input = {
    keys: new Set(), just: new Set(),
    mouse: { x: W / 2, y: H / 2, down: false, clicked: false },
    key(code) { return this.keys.has(code); },
    pressed(code) { return this.just.has(code); },
  };
  window.addEventListener('keydown', e => {
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) { input.keys.add(e.code); input.just.add(e.code); }
    Sfx.ensure();
  });
  window.addEventListener('keyup', e => input.keys.delete(e.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.mouse.down = false; });
  function mousePos(e) {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = (e.clientX - r.left) * (W / r.width);
    input.mouse.y = (e.clientY - r.top) * (H / r.height);
  }
  // listen on window, not canvas: clicks that land on the letterbox bars
  // still count as attacks (nobody should whiff for clicking 5px off-screen)
  window.addEventListener('mousemove', mousePos);
  window.addEventListener('mousedown', e => {
    mousePos(e); Sfx.ensure();
    if (e.button === 0) { input.mouse.down = true; input.mouse.clicked = true; }
    if (e.button === 2) g.player && g.state === 'play' && g.player.swapWeapon();
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) input.mouse.down = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  // wheel swap is cooldown-gated: trackpad inertia fires dozens of wheel events
  // per flick, which would machine-gun the two-slot toggle
  let lastWheelSwap = -Infinity;
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (g.state === 'play' && e.timeStamp - lastWheelSwap >= 150) {
      g.player.swapWeapon();
      lastWheelSwap = e.timeStamp;
    }
  }, { passive: false });

  // --- game state ----------------------------------------------------------------------
  const g = {
    state: 'intro',       // intro | title | play | levelup | pause | dead | win | transition | bossintro
    introT: 0,
    meta: loadMeta(),
    floorNum: 1,
    dungeon: null, room: null,
    player: null,
    monsters: [], projectiles: [], pickups: [],
    boss: null, bossIntroT: 0, winTimer: -1, portal: null,
    autoAttack: (() => { try { return localStorage.getItem('drl_auto') === '1'; } catch { return false; } })(),
    evoQueue: [], evoChoices: null,
    levelChoices: [], levelUpQueue: 0, hoverChoice: -1,
    initials: null, afterInitials: 'dead', newScoreRank: 0, showScores: false, scores: loadScores(),
    transition: null,     // {dir, next, t}
    uiRects: [],
    essenceEarned: 0,
    gateMsg: 0,           // "sealed" toast timer
    shopMsg: null,        // {text, t}
    time: 0,
    queueLevelUp() { this.levelUpQueue++; },
    onKill(m) { onKill(m); },
    onPlayerDeath() { onPlayerDeath(); },
    dropWeaponPickup(w, x, y) { this.pickups.push({ kind: 'weapon', weapon: w, x, y, t: 0 }); },
    dropArmorPickup(a, x, y) { this.pickups.push({ kind: 'armorItem', armor: a, x, y, t: 0 }); },
  };

  // ============================ RUN LIFECYCLE ============================
  function newRun() {
    g.floorNum = 1;
    g.player = new PlayerDef.Player(g.meta);
    g.player.coinsTotal = 0;
    // reset ALL per-run state (a stale level-up queue once leaked into a fresh run)
    g.essenceEarned = 0;
    g.levelUpQueue = 0;
    g.levelChoices = [];
    g.evoQueue = [];
    g.evoChoices = null;
    g.winTimer = -1;
    g.deathTimer = -1;
    g.runEnded = false;
    g.boss = null;
    g.transition = null;
    g.gateMsg = 0;
    g.shopMsg = null;
    startFloor();
    g.state = 'play';
    Sfx.play('door');
  }

  function startFloor() {
    g.dungeon = Dungeon.generateFloor(g.floorNum);
    g.portal = null; // portals never carry across floors
    const theme = Dungeon.themeFor(g.floorNum);
    g.floorBanner = { text: `NOW ENTERING · ${theme.name}`, t: 3.5 };
    Sfx.setAmbient(theme.ambient);
    // Bulwark armor: a shield charm greets you on every floor
    if (g.player.armorMods.bulwark) {
      g.player.buffs.shield = 1;
      Fx.text(g.player.x, g.player.y - 30, 'BULWARK', '#7fd4ff', 13);
    }
    enterRoom(g.dungeon.start, null);
  }

  function enterRoom(room, fromDir) {
    // drops are persistent: whatever was left on this room's floor is still there
    if (g.room) g.room.savedPickups = g.pickups;
    g.room = room;
    room.visited = true;
    g.monsters = [];
    g.projectiles = [];
    g.pickups = room.savedPickups || [];
    Fx.clear();
    g.boss = room.type === 'boss' ? g.boss : null;

    // position player at the door they came in through
    const p = g.player;
    if (fromDir) {
      const enterFrom = Dungeon.OPP[fromDir];
      if (enterFrom === 'N') { p.x = PF.x + PF.w / 2; p.y = PF.y + p.r + 12; }
      if (enterFrom === 'S') { p.x = PF.x + PF.w / 2; p.y = PF.y + PF.h - p.r - 12; }
      if (enterFrom === 'W') { p.x = PF.x + p.r + 12; p.y = PF.y + PF.h / 2; }
      if (enterFrom === 'E') { p.x = PF.x + PF.w - p.r - 12; p.y = PF.y + PF.h / 2; }
    } else {
      p.x = PF.x + PF.w / 2; p.y = PF.y + PF.h / 2;
    }

    if (room.type === 'boss' && !room.cleared) {
      g.state = 'bossintro';
      g.bossIntroT = 0;
      p.drawT = -1; // don't let a held draw fire mid-intro
      Sfx.play('roar');
      return;
    }
    if ((room.type === 'combat') && !room.spawned) {
      room.spawned = true;
      g.monsters = Monsters.spawnForRoom(room, g.floorNum, g);
      Sfx.play('door'); // doors slam
    }
    if (room.type === 'shop' && !room.shopStock) rollShopStock(room);
    if (room.type === 'treasure' && !room.spawned) {
      room.spawned = true;
      g.player.addXp(10, g); // treasure rooms grant bonus XP on discovery
    }
  }

  function rollShopStock(room) {
    const tier = Monsters.tierFor(g.floorNum, room.dist);
    room.shopStock = {
      items: [
        { kind: 'weapon', weapon: Weapons.rollWeapon(tier, { minRarity: 1 }), x: PF.x + 200, y: PF.y + 160 },
        { kind: 'weapon', weapon: Weapons.rollWeapon(tier, { minRarity: 1 }), x: PF.x + 430, y: PF.y + 160 },
        { kind: 'weapon', weapon: Weapons.rollWeapon(tier, { minRarity: 1, luck: 0.5 }), x: PF.x + 660, y: PF.y + 160 },
        { kind: 'armor', armor: Weapons.rollArmor(tier, { minRarity: 1 }), x: PF.x + 120, y: PF.y + 320 },
        { kind: 'potion', x: PF.x + 320, y: PF.y + 320 },
        { kind: 'reroll', x: PF.x + 540, y: PF.y + 320 },
      ],
      rerolls: 0,
    };
    for (const it of room.shopStock.items) {
      if (it.kind === 'weapon') it.price = it.weapon.price;
      if (it.kind === 'armor') it.price = it.armor.price;
      if (it.kind === 'potion') it.price = POTION_PRICE;
      if (it.kind === 'reroll') it.price = REROLL_BASE;
    }
  }

  // ============================ KILLS / LOOT ============================
  function onKill(m) {
    const p = g.player;
    p.kills++;
    p.addXp(m.xp, g);
    Fx.burst(m.x, m.y, ['#fff', '#ffd24c', '#ff6655'], 14, { speed: 180, life: 0.5 });
    Sfx.play('kill');

    const w = p.weapon;
    const looting = Weapons.has(w, 'looting');
    // ORIGINAL enchants: Momentum speed burst, Vampiric heal on kill
    if (Weapons.has(w, 'momentum')) p.momentumT = 1.2;
    if (Weapons.has(w, 'vampiric')) p.heal(2);
    // evolution kill-hooks: proximity lifesteal + roll cooldown refunds
    if (p.mod('soulFeast') && Math.hypot(m.x - p.x, m.y - p.y) < 140) {
      p.heal(Math.max(1, Math.round(p.maxHp * p.mod('soulFeast') / 100)), true);
    }
    if (p.mod('rollReset') && p.rollCd > 0) p.rollCd -= p.mod('rollReset');

    // coins
    const [c0, c1] = m.coins;
    let n = c0 + ((Math.random() * (c1 - c0 + 1)) | 0);
    if (looting) n = Math.round(n * (1 + 0.3 * looting));
    for (let i = 0; i < n; i++) spawnPickup('coin', m.x, m.y);

    // hearts: small mercy drop
    if (Math.random() < 0.07) spawnPickup('heart', m.x, m.y);

    // essence from elites (meta currency)
    if (['tank', 'summoner', 'shielded', 'mimic'].includes(m.type)) {
      const ne = 1 + ((Math.random() * 2) | 0);
      for (let i = 0; i < ne; i++) spawnPickup('essence', m.x, m.y);
      // Greedy evolutions: bounty coins from elites
      for (let i = 0; i < (p.mod('eliteCoins') || 0); i++) spawnPickup('coin', m.x, m.y);
    }

    // elite buff drops: temporary powers, rare enough to feel like an event
    if (['tank', 'summoner', 'shielded', 'glass', 'mimic'].includes(m.type) && Math.random() < 0.12) {
      spawnPickup(['buffShield', 'buffRage', 'buffHaste'][(Math.random() * 3) | 0], m.x, m.y);
    }

    // weapon drops
    const tier = Monsters.tierFor(g.floorNum, g.room.dist);
    if (m.type === 'mimic') {
      // mimics reward the risk: guaranteed good weapon + bonus XP
      const wp = Weapons.rollWeapon(tier, { minRarity: 1, luck: 0.6 });
      g.pickups.push({ kind: 'weapon', weapon: wp, x: m.x, y: m.y, t: 0 });
      p.addXp(15, g);
    } else if (m.isBoss) {
      // THE MIMIC KING: guaranteed legendary + royal armor + coin fountain + essence
      const wp = Weapons.rollWeapon(tier, { minRarity: 4 });
      g.pickups.push({ kind: 'weapon', weapon: wp, x: m.x, y: m.y - 20, t: 0 });
      g.pickups.push({ kind: 'armorItem', armor: Weapons.rollArmor(tier, { minRarity: 3 }), x: m.x + 40, y: m.y, t: 0 });
      for (let i = 0; i < 36; i++) spawnPickup('coin', m.x, m.y);
      for (let i = 0; i < 12; i++) spawnPickup('essence', m.x, m.y);
      g.winTimer = 2.6; // savor it, then victory screen
    } else if (Math.random() < 0.045 * (1 + 0.5 * looting)) {
      g.pickups.push({ kind: 'weapon', weapon: Weapons.rollWeapon(tier), x: m.x, y: m.y, t: 0 });
    } else if (Math.random() < 0.035 * (1 + 0.5 * looting)) {
      g.pickups.push({ kind: 'armorItem', armor: Weapons.rollArmor(tier), x: m.x, y: m.y, t: 0 });
    }

    checkRoomCleared();
  }

  function spawnPickup(kind, x, y) {
    const a = Math.random() * Math.PI * 2, d = Math.random() * 40;
    g.pickups.push({
      kind, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
      vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 40,
      t: 0, value: kind === 'coin' ? 1 : 1,
    });
  }

  function checkRoomCleared() {
    if (g.room.cleared) return;
    if ((g.room.type === 'combat' || g.room.type === 'boss') && g.room.spawned &&
        g.monsters.every(m => m.dead)) {
      g.room.cleared = true;
      g.player.roomsCleared++;
      vacuumPickups(); // room-clear reward: every dropped coin flies to you
      Sfx.play('unlock');
      Fx.text(W / 2, H / 2 - 60, Skin.SHOW.clearText, Skin.NEON.lime, 18);
      Sfx.play('cheer');
      if (g.room.type !== 'boss' && Dungeon.uncleared(g.dungeon) === 0) {
        if (g.floorNum >= 3) {
          Fx.text(W / 2, H / 2 - 30, 'THE FINAL ROUND AWAITS...', '#ffd24c', 15);
        } else {
          openPortal(); // floor done: a portal to the stairs room opens right here
          Fx.text(W / 2, H / 2 - 30, 'A WARP TO THE NEXT STUDIO OPENS', '#00e5ff', 15);
        }
        Sfx.play('stairs');
      }
    }
    // treasure-room mimic fights unlock the room again when the mimic dies
    if (g.room.type === 'treasure' && g.monsters.every(m => m.dead)) {
      g.room.cleared = true;
      vacuumPickups();
    }
  }

  // send every loose (non-gear) pickup racing to the player
  function vacuumPickups() {
    for (const pk of g.pickups) if (pk.kind !== 'weapon' && pk.kind !== 'armorItem') pk.vacuum = true;
  }

  function openPortal() {
    if (g.portal) return;
    // room centers are kept clear of obstacles by the generator, so it's safe
    g.portal = { room: g.room, x: PF.x + PF.w / 2, y: PF.y + PF.h / 2, t: 0 };
    Fx.burst(g.portal.x, g.portal.y, ['#4cc9a8', '#b88aff', '#fff'], 26, { speed: 160, life: 0.8, glow: true });
    Sfx.play('levelup');
  }

  function onPlayerDeath() {
    if (g.runEnded) return; // never bank twice (death/victory race)
    g.runEnded = true;
    // bank essence: what you carried + 10% of unspent coins
    const fromCoins = Math.floor(g.player.coins * 0.10);
    g.essenceEarned = g.player.essenceRun + fromCoins;
    g.meta.essence += g.essenceEarned;
    saveMeta();
    g.levelUpQueue = 0; // no level-up cards over a corpse
    Fx.shake(10, 0.5);
    Sfx.play('explode');
    g.deathTimer = 0.9; // brief beat before the screen (game time, so pause behaves)
  }

  function onVictory() {
    if (g.runEnded) return; // never bank twice (death/victory race)
    g.runEnded = true;
    g.essenceEarned = g.player.essenceRun + Math.floor(g.player.coins * 0.10) + 20; // victory bonus
    g.meta.essence += g.essenceEarned;
    saveMeta();
    endToScreen('win');
  }

  // route a finished run to the end screen, via arcade initials entry if it placed
  function endToScreen(which) {
    Sfx.setAmbient(null);
    g.newScoreRank = 0;
    if (scoreQualifies(g.essenceEarned)) {
      g.afterInitials = which;
      g.initials = { letters: [65, 65, 65], slot: 0 }; // 'AAA'
      g.state = 'initials';
      g.overlayT = 0;
      Sfx.play('levelup');
    } else {
      g.state = which;
      g.overlayT = 0;
    }
  }

  function commitInitials(skip) {
    if (!skip) {
      const name = g.initials.letters.map(c => String.fromCharCode(c)).join('');
      const scores = loadScores();
      scores.push({ initials: name, score: g.essenceEarned, floor: g.floorNum, won: g.afterInitials === 'win' });
      scores.sort((a, b) => b.score - a.score);
      g.scores = scores.slice(0, 10);
      saveScores(g.scores);
      g.newScoreRank = g.scores.findIndex(s => s.score === g.essenceEarned && s.initials === name) + 1;
      Sfx.play('upgrade');
    }
    g.state = g.afterInitials;
    g.overlayT = 0;
    g.initials = null;
  }

  function updateInitials() {
    const ini = g.initials;
    // direct typing: letter keys fill the current slot and advance
    for (const code of input.just) {
      if (/^Key[A-Z]$/.test(code)) {
        ini.letters[ini.slot] = code.charCodeAt(3);
        ini.slot = Math.min(2, ini.slot + 1);
      }
    }
    if (input.pressed('ArrowUp')) { ini.letters[ini.slot] = ini.letters[ini.slot] >= 90 ? 65 : ini.letters[ini.slot] + 1; Sfx.play('ui'); }
    if (input.pressed('ArrowDown')) { ini.letters[ini.slot] = ini.letters[ini.slot] <= 65 ? 90 : ini.letters[ini.slot] - 1; Sfx.play('ui'); }
    if (input.pressed('ArrowRight')) ini.slot = Math.min(2, ini.slot + 1);
    if (input.pressed('ArrowLeft') || input.pressed('Backspace')) ini.slot = Math.max(0, ini.slot - 1);
    if (input.pressed('Enter')) { commitInitials(false); return; }
    if (input.pressed('Escape')) { commitInitials(true); return; }
    // mouse: arrows above/below each slot
    if (input.mouse.clicked) {
      for (const r of g.uiRects) {
        if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
          if (r.action === 'up') { ini.slot = r.idx; ini.letters[r.idx] = ini.letters[r.idx] >= 90 ? 65 : ini.letters[r.idx] + 1; Sfx.play('ui'); }
          if (r.action === 'down') { ini.slot = r.idx; ini.letters[r.idx] = ini.letters[r.idx] <= 65 ? 90 : ini.letters[r.idx] - 1; Sfx.play('ui'); }
          if (r.action === 'ok') { commitInitials(false); return; }
        }
      }
    }
  }

  // ============================ DOORS / MOVEMENT GATING ============================
  function doorRects(room) {
    // returns {dir, rect} for each door opening
    const DW = Dungeon.DOOR_W;
    const out = [];
    for (const dir of Object.keys(room.doors)) {
      if (dir === 'N') out.push({ dir, x: PF.x + PF.w / 2 - DW / 2, y: 0, w: DW, h: PF.y });
      if (dir === 'S') out.push({ dir, x: PF.x + PF.w / 2 - DW / 2, y: PF.y + PF.h, w: DW, h: H - PF.y - PF.h });
      if (dir === 'W') out.push({ dir, x: 0, y: PF.y + PF.h / 2 - DW / 2, w: PF.x, h: DW });
      if (dir === 'E') out.push({ dir, x: PF.x + PF.w, y: PF.y + PF.h / 2 - DW / 2, w: W - PF.x - PF.w, h: DW });
    }
    return out;
  }

  function doorsLocked() {
    // combat lock: any live monster (includes woken mimics and the boss).
    // the 2.6s victory celebration also locks the doors so the player can't
    // wander out and lose the boss loot (enterRoom clears pickups)
    return g.winTimer > 0 || g.monsters.some(m => !m.dead);
  }

  function doorSealed(room, dir) {
    // boss/stairs gate: sealed until every combat room on the floor is cleared
    const n = room.doors[dir];
    return (n.type === 'boss' || n.type === 'stairs') && Dungeon.uncleared(g.dungeon) > 0;
  }

  function tryRoomExit() {
    const p = g.player;
    if (doorsLocked()) { clampPlayer(); return; }
    for (const d of doorRects(g.room)) {
      const inLane =
        (d.dir === 'N' && p.y < PF.y + p.r && p.x > d.x && p.x < d.x + d.w) ||
        (d.dir === 'S' && p.y > PF.y + PF.h - p.r && p.x > d.x && p.x < d.x + d.w) ||
        (d.dir === 'W' && p.x < PF.x + p.r && p.y > d.y && p.y < d.y + d.h) ||
        (d.dir === 'E' && p.x > PF.x + PF.w - p.r && p.y > d.y && p.y < d.y + d.h);
      if (!inLane) continue;
      if (doorSealed(g.room, d.dir)) {
        g.gateMsg = 2;
        clampPlayer();
        return;
      }
      // walk fully through the doorway to trigger the transition
      const past =
        (d.dir === 'N' && p.y < PF.y - 14) || (d.dir === 'S' && p.y > PF.y + PF.h + 14) ||
        (d.dir === 'W' && p.x < PF.x - 14) || (d.dir === 'E' && p.x > PF.x + PF.w + 14);
      if (past) {
        g.transition = { dir: d.dir, next: g.room.doors[d.dir], t: 0 };
        g.state = 'transition';
        return;
      }
      return; // in the lane, not past yet: allow walking into the doorway
    }
    clampPlayer();
  }

  function clampPlayer() {
    const p = g.player;
    // allow standing inside an unlocked doorway lane, otherwise clamp to the field
    let inLaneX = false, inLaneY = false;
    if (!doorsLocked()) {
      for (const d of doorRects(g.room)) {
        if (doorSealed(g.room, d.dir)) continue;
        if ((d.dir === 'N' || d.dir === 'S') && p.x > d.x && p.x < d.x + d.w) inLaneY = true;
        if ((d.dir === 'W' || d.dir === 'E') && p.y > d.y && p.y < d.y + d.h) inLaneX = true;
      }
    }
    if (!inLaneX) p.x = Math.max(PF.x + p.r, Math.min(PF.x + PF.w - p.r, p.x));
    if (!inLaneY) p.y = Math.max(PF.y + p.r, Math.min(PF.y + PF.h - p.r, p.y));
  }

  // ============================ INTERACTION (E) ============================
  function nearestInteractable() {
    const p = g.player;
    let best = null, bestD = 55;
    const consider = (x, y, obj) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = obj; }
    };
    for (const ch of g.room.chests) if (!ch.opened) consider(ch.x, ch.y, { kind: 'chest', ch });
    for (const pk of g.pickups) {
      if (pk.kind === 'weapon') consider(pk.x, pk.y, { kind: 'weaponPickup', pk });
      if (pk.kind === 'armorItem') consider(pk.x, pk.y, { kind: 'armorPickup', pk });
    }
    if (g.room.type === 'shop' && g.room.shopStock) {
      for (const it of g.room.shopStock.items) if (!it.sold) consider(it.x, it.y, { kind: 'shopItem', it });
    }
    if (g.room.stairs && g.room.stairs.open !== undefined) {
      if (Dungeon.uncleared(g.dungeon) === 0) consider(g.room.stairs.x, g.room.stairs.y, { kind: 'stairs' });
    }
    if (g.portal && g.portal.room === g.room) consider(g.portal.x, g.portal.y, { kind: 'portal' });
    return best;
  }

  function interact() {
    const t = nearestInteractable();
    if (!t) return;
    const p = g.player;

    if (t.kind === 'chest') {
      const ch = t.ch;
      if (ch.mimic) { wakeMimic(ch); return; }
      ch.opened = true;
      Sfx.play('pickup');
      Fx.burst(ch.x, ch.y, ['#ffd24c', '#d4af37', '#fff'], 22, { speed: 200, life: 0.7, glow: true, grav: 150 });
      const nCoins = 8 + ((Math.random() * 7) | 0);
      for (let i = 0; i < nCoins; i++) spawnPickup('coin', ch.x, ch.y - 10);
      const tier = Monsters.tierFor(g.floorNum, g.room.dist);
      g.pickups.push({ kind: 'weapon', weapon: Weapons.rollWeapon(tier, { luck: 0.35 }), x: ch.x, y: ch.y + 34, t: 0 });
      if (Math.random() < 0.45) g.pickups.push({ kind: 'armorItem', armor: Weapons.rollArmor(tier, { luck: 0.3 }), x: ch.x - 50, y: ch.y + 20, t: 0 });
      if (Math.random() < 0.4) spawnPickup('heart', ch.x, ch.y);
      p.addXp(10, g);
    }

    if (t.kind === 'weaponPickup') {
      p.pickupWeapon(t.pk.weapon, g);
      g.pickups.splice(g.pickups.indexOf(t.pk), 1);
    }

    if (t.kind === 'armorPickup') {
      p.equipArmor(t.pk.armor, g);
      g.pickups.splice(g.pickups.indexOf(t.pk), 1);
    }

    if (t.kind === 'shopItem') {
      const it = t.it, stock = g.room.shopStock;
      if (p.coins < it.price) {
        Sfx.play('error');
        g.shopMsg = { text: 'Not enough coins!', t: 1.2 };
        return;
      }
      if (it.kind === 'weapon') {
        p.coins -= it.price; it.sold = true;
        p.pickupWeapon(it.weapon, g);
        Sfx.play('buy');
      } else if (it.kind === 'armor') {
        p.coins -= it.price; it.sold = true;
        p.equipArmor(it.armor, g);
        Sfx.play('buy');
      } else if (it.kind === 'potion') {
        if (p.hp >= p.maxHp) { g.shopMsg = { text: 'Already at full health', t: 1.2 }; Sfx.play('error'); return; }
        p.coins -= it.price;
        p.heal(POTION_HEAL);
        Sfx.play('buy');
        it.price += 10; // each potion bought costs more (compounds, so heals can't be spammed)
      } else if (it.kind === 'reroll') {
        p.coins -= it.price;
        Sfx.play('buy');
        const tier = Monsters.tierFor(g.floorNum, g.room.dist);
        stock.rerolls++;
        for (const s of stock.items) {
          if (s.kind === 'weapon' && !s.sold) {
            s.weapon = Weapons.rollWeapon(tier, { minRarity: 1, luck: 0.2 * stock.rerolls });
            s.price = s.weapon.price;
          }
          if (s.kind === 'armor' && !s.sold) {
            s.armor = Weapons.rollArmor(tier, { minRarity: 1, luck: 0.2 * stock.rerolls });
            s.price = s.armor.price;
          }
        }
        it.price = REROLL_BASE + 5 * stock.rerolls;
        Fx.burst(it.x, it.y, '#7fd4ff', 15, { speed: 120, life: 0.5 });
      }
    }

    if (t.kind === 'stairs') {
      Sfx.play('stairs');
      g.floorNum++;
      g.player.heal(20); // breather between floors
      startFloor();
    }

    if (t.kind === 'portal') {
      // one-way ride to the stairs room
      const stairsRoom = g.dungeon.rooms.find(r => r.type === 'stairs');
      if (stairsRoom) {
        Sfx.play('stairs');
        Fx.burst(p.x, p.y, ['#4cc9a8', '#b88aff'], 20, { speed: 180, life: 0.5, glow: true });
        g.portal = null;
        enterRoom(stairsRoom, null);
        p.y += 90; // land beside the stairwell, not inside it
      }
    }
  }

  // --- SHARD SALVAGE (Sam's idea: floor loot shouldn't be waste) ------------------
  // X breaks a nearby dropped weapon/armor into shards; U spends shards to hone
  // your equipped weapon (+8% damage per hone, 5 hones max per weapon).
  const SHARD_VALUE = [1, 2, 4, 7, 12]; // by rarity index
  const HONE_MAX = 5;
  const honeCost = w => 5 + (w.upLvl || 0) * 4;

  function salvageNearest() {
    const t = nearestInteractable();
    if (!t || (t.kind !== 'weaponPickup' && t.kind !== 'armorPickup')) return;
    const item = t.pk.weapon || t.pk.armor;
    const val = SHARD_VALUE[item.rarIdx] || 1;
    g.player.shards += val;
    g.pickups.splice(g.pickups.indexOf(t.pk), 1);
    Sfx.play('kill');
    Fx.burst(t.pk.x, t.pk.y, ['#7fe8e0', item.color], 14, { speed: 150, life: 0.5, glow: true });
    Fx.text(t.pk.x, t.pk.y - 20, `+${val} SHARDS`, '#7fe8e0', 13);
  }

  function honeWeapon() {
    const p = g.player, w = p.weapon;
    if (!w) return;
    w.upLvl = w.upLvl || 0;
    if (w.upLvl >= HONE_MAX) {
      g.shopMsg = { text: 'This weapon is fully honed', t: 1.4 };
      Sfx.play('error');
      return;
    }
    const cost = honeCost(w);
    if (p.shards < cost) {
      g.shopMsg = { text: `Need ${cost} shards to hone (have ${p.shards})`, t: 1.6 };
      Sfx.play('error');
      return;
    }
    p.shards -= cost;
    w.upLvl++;
    w.dmg = Math.round(w.dmg * 1.08);
    Sfx.play('upgrade');
    Fx.burst(p.x, p.y, ['#7fe8e0', w.color, '#fff'], 20, { speed: 170, life: 0.6, glow: true });
    Fx.text(p.x, p.y - 30, `${w.name} +${w.upLvl} · ${w.dmg} DMG`, w.color, 13);
  }

  function wakeMimic(ch) {
    ch.opened = true; // remove the chest prop
    Sfx.play('mimic');
    Fx.shake(6, 0.3);
    Fx.burst(ch.x, ch.y, ['#7a5230', '#d4af37', '#c0392b'], 20, { speed: 190, life: 0.5 });
    const tier = Monsters.tierFor(g.floorNum, g.room.dist);
    const m = Monsters.make('mimic', ch.x, ch.y, tier);
    g.monsters.push(m);
    g.room.cleared = false; // doors slam shut until it's dead
    Fx.text(ch.x, ch.y - 30, 'MIMIC!', '#ff5555', 18);
  }

  // proximity wake: sneaking close is enough to spring the trap
  function checkMimicProximity() {
    for (const ch of g.room.chests) {
      if (!ch.opened && ch.mimic && Math.hypot(g.player.x - ch.x, g.player.y - ch.y) < 52) wakeMimic(ch);
    }
  }

  // ============================ UPDATE ============================
  let last = 0;
  function tick(dt) {
    g.time += dt;
    update(dt);
    draw();
    if (g.preserveInput) g.preserveInput = false; // hit-stop frame: keep buffered input
    else { input.just.clear(); input.mouse.clicked = false; }
  }
  function frame(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
    last = ts;
    // one bad frame must never kill the whole game loop
    try { tick(dt); } catch (err) {
      console.error('[dungeon] frame error:', err);
      // a mid-draw throw can leak save()s/transforms/alpha onto the persistent
      // context - drain the stack (restore past bottom is a no-op) and reset
      if (typeof ctx.reset === 'function') ctx.reset();
      else {
        for (let i = 0; i < 64; i++) ctx.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
      // the end-of-tick input clear was skipped: drop stale buffered presses
      input.just.clear();
      input.mouse.clicked = false;
    }
    requestAnimationFrame(frame);
  }

  function update(dt) {
    // global keys
    if (input.pressed('KeyM')) Sfx.toggleMute();

    switch (g.state) {
      case 'intro': updateIntro(dt); break;
      case 'title': updateTitle(); break;
      case 'play': updatePlay(dt); break;
      case 'levelup': g.overlayT += dt; updateLevelUp(); break;
      case 'evolution': g.overlayT += dt; updateEvolution(); break;
      case 'pause':
        g.overlayT += dt;
        if (input.pressed('KeyP') || input.pressed('Escape')) g.state = 'play';
        break;
      case 'transition': updateTransition(dt); break;
      case 'bossintro': updateBossIntro(dt); break;
      case 'dead': case 'win': g.overlayT += dt; updateEnd(); break;
      case 'initials': g.overlayT += dt; updateInitials(); break;
    }
    Fx.update(dt);
  }

  // --- intro cutscene: the Host welcomes you to the show --------------------
  function updateIntro(dt) {
    // audio needs a user gesture; gate the timeline behind one click so the
    // announcer actually SHOUTS instead of miming silently
    if (!g.introStarted) {
      if (input.just.size > 0 || input.mouse.clicked) { g.introStarted = true; Sfx.ensure(); }
      return;
    }
    const prev = g.introT;
    g.introT += dt;
    const cue = (tm, name) => { if (prev < tm && g.introT >= tm) Sfx.play(name); };
    cue(0.5, 'cheer');
    cue(1.7, 'barkBig');   // "BIG MONEY!"
    cue(2.7, 'bark');      // "BIG PRIZES!"
    cue(3.9, 'barkBuy');   // "I'D BUY THAT FOR A DOLLAR!"
    cue(3.9, 'kaching');
    cue(4.1, 'cheer');
    // any input after it's rolling skips to the title
    if ((input.just.size > 0 || input.mouse.clicked) && g.introT > 0.4) { g.state = 'title'; return; }
    if (g.introT > 7.2) g.state = 'title';
  }

  function updateTitle() {
    if (g.shareMsg && g.shareMsg.t > 0) g.shareMsg.t -= 1 / 60;
    if (g.showScores) {
      // scoreboard overlay: any click or Esc closes it
      if (input.mouse.clicked || input.pressed('Escape')) g.showScores = false;
      return;
    }
    if (input.pressed('Enter')) { newRun(); return; }
    if (input.mouse.clicked) {
      for (const r of g.uiRects) {
        if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
          if (r.action === 'start') { newRun(); return; }
          if (r.action === 'upgrade') buyMetaUpgrade(r.key);
          if (r.action === 'share') shareGame();
          if (r.action === 'scores') { g.showScores = true; Sfx.play('ui'); }
        }
      }
    }
  }

  function shareGame() {
    const url = UI.GAME_URL;
    Sfx.play('ui');
    // native share sheet on phones/tablets, clipboard on desktop,
    // and a visible URL as the everything-failed fallback
    if (navigator.share) {
      navigator.share({ title: 'Dungeon of the Gilded King', url }).catch(() => { });
      g.shareMsg = { text: 'Sharing...', t: 2 };
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => { g.shareMsg = { text: 'Link copied! ' + url, t: 3.5 }; })
        .catch(() => { g.shareMsg = { text: url, t: 6 }; });
      g.shareMsg = { text: 'Link copied! ' + url, t: 3.5 };
    } else {
      g.shareMsg = { text: url, t: 6 };
    }
  }

  function buyMetaUpgrade(key) {
    const u = UI.META_UPGRADES.find(u => u.key === key);
    const rank = g.meta.ranks[key] || 0;
    if (rank >= u.maxRank) { Sfx.play('error'); return; }
    const cost = u.costs[rank];
    if (g.meta.essence < cost) { Sfx.play('error'); return; }
    g.meta.essence -= cost;
    g.meta.ranks[key] = rank + 1;
    saveMeta();
    Sfx.play('upgrade');
  }

  function updatePlay(dt) {
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      g.state = 'pause'; g.overlayT = 0;
      g.player.drawT = -1; // a held bow draw must not survive pause and fire on resume
      return;
    }
    if (Fx.tickHitstop(dt)) { g.preserveInput = true; return; } // hit-stop: world freezes, but buffered presses survive it

    const p = g.player;
    if (!p.dead && input.pressed('Tab')) p.swapWeapon();
    if (!p.dead && input.pressed('KeyF')) {
      g.autoAttack = !g.autoAttack;
      try { localStorage.setItem('drl_auto', g.autoAttack ? '1' : '0'); } catch { }
      Sfx.play('ui');
      Fx.text(p.x, p.y - 30, g.autoAttack ? 'AUTO-ATTACK ON' : 'AUTO-ATTACK OFF', '#ffd24c', 13);
    }
    p.update(dt, g, input);
    tryRoomExit();
    if (g.state !== 'play') return; // transition may have started

    if (!p.dead) { // a corpse can't loot chests or wake mimics during the death beat
      checkMimicProximity();
      if (input.pressed('KeyE')) interact();
      if (input.pressed('KeyX')) salvageNearest();
      if (input.pressed('KeyU')) honeWeapon();
    }

    for (const m of g.monsters) if (!m.dead) m.update(dt, g);
    updateProjectiles(dt);
    updatePickups(dt);

    if (g.winTimer > 0) {
      g.winTimer -= dt;
      if (g.winTimer <= 0) { onVictory(); return; }
    }
    if (g.deathTimer > 0) {
      g.deathTimer -= dt;
      if (g.deathTimer <= 0) { endToScreen('dead'); return; }
    }
    if (g.gateMsg > 0) g.gateMsg -= dt;
    if (g.shopMsg) { g.shopMsg.t -= dt; if (g.shopMsg.t <= 0) g.shopMsg = null; }
    if (g.floorBanner && g.floorBanner.t > 0) g.floorBanner.t -= dt;

    // evolution menus take priority over further level-ups (the pick that
    // triggered the evolution should resolve before the next level-up card)
    if (g.evoQueue.length > 0 && p.rollT < 0 && g.winTimer <= 0 && !p.dead) {
      const evo = g.evoQueue.shift();
      const options = Evolutions.optionsFor(evo.key, evo.stacks);
      if (options) { // guard: an invalid queue entry (dbg typo) must never soft-lock
        g.evoChoices = { key: evo.key, stacks: evo.stacks, options };
        g.hoverChoice = -1;
        g.state = 'evolution';
        g.overlayT = 0;
        p.drawT = -1;
        Sfx.play('mimic'); // something stirs in you
        return;
      }
    }
    // open a queued level-up once combat calms for a beat (don't interrupt a dodge).
    // skipped once the boss is down (victory is seconds away) or the player is dead.
    if (g.levelUpQueue > 0 && p.rollT < 0 && g.winTimer <= 0 && !p.dead) {
      g.levelUpQueue--;
      g.levelChoices = pickUpgrades();
      g.levelRerolled = false; // one reroll per level-up
      g.hoverChoice = -1;
      g.state = 'levelup';
      g.overlayT = 0;
      p.drawT = -1; // a held bow draw must not survive the overlay and fire on resume
    }
  }

  function pickUpgrades() {
    const pool = [...UPGRADE_POOL];
    const out = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      out.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    }
    return out;
  }

  function applyUpgrade(ch) {
    const p = g.player, s = p.stats;
    switch (ch.key) {
      case 'hp': p.maxHp += 15; p.hp = Math.min(p.maxHp, p.hp + 15); break;
      case 'dmg': s.dmgMul += 0.10; break;
      case 'spd': s.speedMul += 0.07; break;
      case 'roll': s.rollCdMul *= 0.88; break;
      case 'crit': s.crit += 0.06; break;
      case 'coin': s.coinMul += 0.20; break;
      case 'regen': s.regen += 0.6; break;
      case 'atkspd': s.atkSpeedMul += 0.10; break;
    }
    // EVOLUTIONS (Sam's design): the 3rd/6th/9th/12th stack of a stat opens
    // an evolution menu for it, immediately
    p.upgradeStacks[ch.key] = (p.upgradeStacks[ch.key] || 0) + 1;
    const stacks = p.upgradeStacks[ch.key];
    if (Evolutions.optionsFor(ch.key, stacks)) g.evoQueue.push({ key: ch.key, stacks });
    Sfx.play('upgrade');
    g.state = 'play';
  }

  function applyEvolutionChoice(opt) {
    g.player.applyEvolution(opt.fx);
    Sfx.play('levelup');
    Fx.text(g.player.x, g.player.y - 34, opt.name.toUpperCase(), '#b88aff', 14);
    Fx.burst(g.player.x, g.player.y, ['#b88aff', '#ffd24c', '#fff'], 26, { speed: 200, life: 0.8, glow: true });
    g.evoChoices = null;
    g.state = 'play';
  }

  function updateEvolution() {
    g.hoverChoice = -1;
    for (const r of g.uiRects) {
      if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
        g.hoverChoice = r.idx;
        if (input.mouse.clicked) { applyEvolutionChoice(g.evoChoices.options[r.idx]); return; }
      }
    }
    if (input.pressed('Digit1') && g.evoChoices.options[0]) { applyEvolutionChoice(g.evoChoices.options[0]); return; }
    if (input.pressed('Digit2') && g.evoChoices.options[1]) { applyEvolutionChoice(g.evoChoices.options[1]); return; }
    if (input.pressed('Digit3') && g.evoChoices.options[2]) { applyEvolutionChoice(g.evoChoices.options[2]); return; }
  }

  function updateLevelUp() {
    // hover tracking
    g.hoverChoice = -1;
    for (const r of g.uiRects) {
      if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
        if (r.reroll) {
          if (input.mouse.clicked && !g.levelRerolled) { rerollLevelChoices(); return; }
          continue;
        }
        g.hoverChoice = r.idx;
        if (input.mouse.clicked) { applyUpgrade(g.levelChoices[r.idx]); return; }
      }
    }
    if (input.pressed('Digit1') && g.levelChoices[0]) { applyUpgrade(g.levelChoices[0]); return; }
    if (input.pressed('Digit2') && g.levelChoices[1]) { applyUpgrade(g.levelChoices[1]); return; }
    if (input.pressed('Digit3') && g.levelChoices[2]) { applyUpgrade(g.levelChoices[2]); return; }
    // once-per-level-up reroll (R or the button)
    if (input.pressed('KeyR') && !g.levelRerolled) rerollLevelChoices();
  }

  function rerollLevelChoices() {
    g.levelRerolled = true;
    g.levelChoices = pickUpgrades();
    g.hoverChoice = -1;
    Sfx.play('ui');
  }

  function updateTransition(dt) {
    const tr = g.transition;
    tr.t += dt;
    if (tr.t >= 0.18 && !tr.switched) {
      tr.switched = true;
      enterRoom(tr.next, tr.dir);
    }
    if (tr.t >= 0.36) {
      g.transition = null;
      if (g.state === 'transition') g.state = 'play';
    }
  }

  function updateBossIntro(dt) {
    g.bossIntroT += dt;
    if (g.bossIntroT >= 2.1) {
      g.room.spawned = true;
      g.boss = Boss.make();
      g.monsters = [g.boss];
      g.state = 'play';
      Fx.shake(8, 0.4);
    }
  }

  function updateEnd() {
    if (input.pressed('Enter')) { newRun(); return; }        // Enter matches the NEW RUN button it captions
    if (input.pressed('Escape')) { g.state = 'title'; return; } // Esc visits the hub to spend essence
    if (input.mouse.clicked) {
      for (const r of g.uiRects) {
        if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
          if (r.action === 'again') { newRun(); return; }
        }
      }
    }
  }

  function updateProjectiles(dt) {
    const p = g.player;
    for (let i = g.projectiles.length - 1; i >= 0; i--) {
      const pr = g.projectiles[i];
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.life -= dt;
      // enchant trail on player arrows (fire streaks behind a Flame arrow, etc.)
      if (pr.trail && Math.random() < 0.85) {
        Fx.burst(pr.x, pr.y, pr.trail, 1, { speed: 18, life: 0.22, glow: pr.glowTrail, size: 2.2 });
      }
      let dead = pr.life <= 0 ||
        pr.x < PF.x - 10 || pr.x > PF.x + PF.w + 10 || pr.y < PF.y - 10 || pr.y > PF.y + PF.h + 10;

      // obstacle hits
      if (!dead) for (const o of g.room.obstacles) {
        if (Math.hypot(pr.x - o.x, pr.y - o.y) < o.r + pr.r) { dead = true; break; }
      }

      if (!dead && pr.from === 'enemy') {
        if (Math.hypot(pr.x - p.x, pr.y - p.y) < p.r + pr.r) {
          p.damage(pr.dmg, pr.x - pr.vx * 0.01, pr.y - pr.vy * 0.01, g);
          dead = true;
        }
      } else if (!dead && pr.from === 'player') {
        for (const m of g.monsters) {
          if (m.dead || m.airborne || (pr.hitSet && pr.hitSet.has(m))) continue; // airborne boss can't eat arrows
          if (Math.hypot(pr.x - m.x, pr.y - m.y) < m.r + pr.r) {
            // target-conditional evolution bonuses resolve at impact for arrows
            const P = g.player;
            let dmg = pr.dmg;
            if (P.mod('dmgVsWounded') && m.hp <= m.maxHp * 0.3) dmg *= 1 + P.mod('dmgVsWounded');
            if (P.mod('firstStrike') && m.hp >= m.maxHp) dmg *= 1 + P.mod('firstStrike');
            if (P.mod('bossSlayer') && m.isBoss) dmg *= 1 + P.mod('bossSlayer');
            const landed = m.takeHit(dmg, {
              sx: pr.x - pr.vx * 0.02, sy: pr.y - pr.vy * 0.02,
              knock: pr.knock, flame: pr.flame, crit: pr.crit, fromPlayer: true,
              hitSfx: pr.hitSfx,
            }, g);
            if (landed) P.onHitLanded(pr.crit, g);
            if (pr.pierce && pr.hitSet.size < pr.pierce) { pr.hitSet.add(m); pr.dmg *= 0.8; }
            else { dead = true; break; }
          }
        }
      }
      if (dead) {
        Fx.burst(pr.x, pr.y, pr.color, 4, { speed: 70, life: 0.25 });
        g.projectiles.splice(i, 1);
      }
    }
  }

  function updatePickups(dt) {
    const p = g.player;
    for (let i = g.pickups.length - 1; i >= 0; i--) {
      const pk = g.pickups[i];
      pk.t += dt;
      if (pk.kind === 'weapon' || pk.kind === 'armorItem') continue; // gear sits still; E to pick up
      // scatter physics then magnet toward the player
      pk.x += (pk.vx || 0) * dt; pk.y += (pk.vy || 0) * dt;
      pk.vx = (pk.vx || 0) * 0.9; pk.vy = (pk.vy || 0) * 0.9;
      const d = Math.hypot(p.x - pk.x, p.y - pk.y) || 1;
      if (pk.vacuum && pk.t > 0.2) {
        // room-clear vacuum: full-room pull, accelerating as it closes in
        const sp = 380 + Math.max(0, 300 - d);
        pk.x += (p.x - pk.x) / d * sp * dt;
        pk.y += (p.y - pk.y) / d * sp * dt;
      } else if (d < 85 + p.mod('magnetR') && pk.t > 0.25) {
        pk.x += (p.x - pk.x) / d * 320 * dt;
        pk.y += (p.y - pk.y) / d * 320 * dt;
      }
      if (d < p.r + 8 && pk.t > 0.2 && !g.runEnded) { // no post-bank collection into the void
        if (pk.kind === 'coin') {
          // fractional carry so +10/20% coin upgrades actually pay out over time
          // (Math.round per 1-value coin was a dead zone below +50%)
          p.coinFrac = (p.coinFrac || 0) + pk.value * (p.stats.coinMul + p.mod('coin'));
          const v = Math.floor(p.coinFrac);
          if (v > 0) { p.coinFrac -= v; p.coins += v; p.coinsTotal += v; }
          Sfx.play('coin');
        }
        if (pk.kind === 'heart') p.heal(15);
        if (pk.kind === 'essence') { p.essenceRun++; Sfx.play('pickup'); }
        if (pk.kind === 'buffShield') { p.buffs.shield = 1; Sfx.play('upgrade'); Fx.text(p.x, p.y - 28, 'SHIELD CHARM', '#7fd4ff', 14); }
        if (pk.kind === 'buffRage') { p.buffs.rageT = 10; Sfx.play('upgrade'); Fx.text(p.x, p.y - 28, 'RAGE +35% DMG', '#e05555', 14); }
        if (pk.kind === 'buffHaste') { p.buffs.hasteT = 10; Sfx.play('upgrade'); Fx.text(p.x, p.y - 28, 'HASTE +30% SPEED', '#ffe08a', 14); }
        g.pickups.splice(i, 1);
      }
    }
  }

  // ============================ DRAW ============================
  function draw() {
    const c = ctx;
    c.clearRect(0, 0, W, H);

    if (g.state === 'intro') { UI.drawIntro(c, g); return; }
    if (g.state === 'title') {
      g.uiRects = UI.drawTitle(c, g);
      return;
    }

    const shake = Fx.getShake();
    c.save();
    c.translate(shake.x, shake.y);

    drawRoom(c, g.room);
    Fx.drawGhosts(c);

    // pickups under actors
    for (const pk of g.pickups) drawPickup(c, pk);

    // actors
    for (const m of g.monsters) if (!m.dead) m.draw(c, g);
    g.player.draw(c, g);

    // projectiles on top
    for (const pr of g.projectiles) {
      c.save();
      if (pr.glow) { c.shadowColor = pr.color; c.shadowBlur = 10; }
      c.fillStyle = pr.color;
      if (pr.arrow) {
        c.translate(pr.x, pr.y);
        c.rotate(Math.atan2(pr.vy, pr.vx));
        c.fillRect(-8, -1.5, 14, 3);
        c.beginPath(); c.moveTo(6, -4); c.lineTo(11, 0); c.lineTo(6, 4); c.fill();
      } else if (pr.spin) {
        c.translate(pr.x, pr.y);
        c.rotate(g.time * 10);
        c.beginPath(); c.ellipse(0, 0, pr.r, pr.r * 0.6, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#b8912f';
        c.beginPath(); c.ellipse(0, 0, pr.r * 0.55, pr.r * 0.3, 0, 0, Math.PI * 2); c.fill();
      } else {
        c.beginPath(); c.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }

    Fx.draw(c);
    c.restore(); // end shake

    // interaction prompt + info card
    if (g.state === 'play') drawInteractPrompt(c);

    // vignette when hurt
    if (g.player && g.player.hp / g.player.maxHp < 0.3) {
      const grad = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
      grad.addColorStop(0, 'rgba(120,0,0,0)');
      grad.addColorStop(1, `rgba(120,0,0,${0.25 + Math.sin(Date.now() / 200) * 0.1})`);
      c.fillStyle = grad;
      c.fillRect(0, 0, W, H);
    }

    UI.drawHUD(c, g);
    UI.drawMinimap(c, g);
    if (g.room.type === 'boss') UI.drawBossBar(c, g);

    // floor-entry banner: FLOOR 2 · THE SUNKEN SWAMP
    if (g.floorBanner && g.floorBanner.t > 0 && g.state === 'play') {
      const a = Math.min(1, g.floorBanner.t) * Math.min(1, (3.5 - g.floorBanner.t) * 2);
      c.save();
      c.globalAlpha = a;
      c.font = 'bold 24px monospace'; c.textAlign = 'center';
      c.fillStyle = '#0a0a0a';
      c.fillText(g.floorBanner.text, W / 2 + 2, 92);
      c.fillStyle = '#e8d5a0';
      c.fillText(g.floorBanner.text, W / 2, 90);
      c.restore();
    }

    // gate toast
    if (g.gateMsg > 0) {
      c.save();
      c.globalAlpha = Math.min(1, g.gateMsg);
      c.font = 'bold 15px monospace'; c.textAlign = 'center';
      c.fillStyle = '#ffd24c';
      const n = Dungeon.uncleared(g.dungeon);
      c.fillText(`SEALED - clear ${n} more room${n > 1 ? 's' : ''}`, W / 2, H - 40);
      c.restore();
    }
    if (g.shopMsg) {
      c.font = 'bold 14px monospace'; c.textAlign = 'center';
      c.fillStyle = '#ff9a3d';
      c.fillText(g.shopMsg.text, W / 2, H - 40);
    }

    // state overlays
    if (g.state === 'transition') {
      const k = g.transition.t / 0.36;
      const a = k < 0.5 ? k * 2 : (1 - k) * 2;
      c.fillStyle = `rgba(5,5,10,${a})`;
      c.fillRect(0, 0, W, H);
    }
    if (g.state === 'bossintro') UI.drawBossIntro(c, g);
    if (g.state === 'levelup') g.uiRects = UI.drawLevelUp(c, g);
    if (g.state === 'evolution') g.uiRects = UI.drawEvolution(c, g);
    if (g.state === 'pause') UI.drawPause(c, g);
    if (g.state === 'dead') g.uiRects = UI.drawEnd(c, g, false);
    if (g.state === 'win') g.uiRects = UI.drawEnd(c, g, true);
    if (g.state === 'initials') g.uiRects = UI.drawInitials(c, g);
  }

  // deterministic per-room decoration random
  function roomRand(room, i) {
    const s = Math.sin(room.gx * 127.1 + room.gy * 311.7 + i * 74.7 + g.floorNum * 53.3) * 43758.5453;
    return s - Math.floor(s);
  }

  function drawRoom(c, room) {
    const pal = Dungeon.paletteFor(room, g.floorNum);
    const theme = Dungeon.themeFor(g.floorNum);
    // outer wall fill
    c.fillStyle = pal.wall;
    c.fillRect(0, 0, W, H);
    // floor
    c.fillStyle = pal.floor;
    c.fillRect(PF.x, PF.y, PF.w, PF.h);
    // subtle tile grid
    c.strokeStyle = 'rgba(0,0,0,0.15)';
    c.lineWidth = 1;
    for (let x = PF.x; x <= PF.x + PF.w; x += 54) {
      c.beginPath(); c.moveTo(x, PF.y); c.lineTo(x, PF.y + PF.h); c.stroke();
    }
    for (let y = PF.y; y <= PF.y + PF.h; y += 54) {
      c.beginPath(); c.moveTo(PF.x, y); c.lineTo(PF.x + PF.w, y); c.stroke();
    }
    // scattered floor detail (cracks/pebbles), deterministic per room
    c.fillStyle = pal.detail;
    for (let i = 0; i < 14; i++) {
      const x = PF.x + roomRand(room, i) * PF.w;
      const y = PF.y + roomRand(room, i + 50) * PF.h;
      c.fillRect(x, y, 3 + roomRand(room, i + 100) * 4, 2 + roomRand(room, i + 150) * 3);
    }
    // studio ambience: drifting confetti / neon sparks that sell the show
    if (theme.ambient === 'studioA' && Math.random() < 0.06) {
      Fx.burst(PF.x + Math.random() * PF.w, PF.y - 4,
        ['#00e5ff', '#ffd23f', '#ff2d95'], 1, { speed: 8, life: 2.4, grav: 20, vx: 14, size: 2.5, drag: 0.999 }); // falling confetti
    }
    if (theme.ambient === 'dome') {
      if (Math.random() < 0.05) Fx.burst(PF.x + Math.random() * PF.w, PF.y + PF.h - Math.random() * 60,
        'rgba(255,45,149,0.6)', 1, { speed: 6, life: 1.8, grav: -24, size: 2.2, drag: 0.999, glow: true }); // rising neon embers
      if (Math.random() < 0.03) Fx.burst(PF.x + Math.random() * PF.w, PF.y + Math.random() * PF.h,
        '#b14bff', 1, { speed: 12, life: 1.4, glow: true, size: 1.8, drag: 0.995 }); // purple sparks
    }
    if (theme.ambient === 'stage' && Math.random() < 0.06) {
      Fx.burst(PF.x + Math.random() * PF.w, PF.y - 4,
        ['#ffd23f', '#fff2b0'], 1, { speed: 6, life: 2.6, grav: 16, size: 1.8, drag: 0.999, glow: true }); // gold glitter rain
    }

    // wall inner edge highlight
    c.strokeStyle = pal.accent + '44';
    c.lineWidth = 2;
    c.strokeRect(PF.x + 1, PF.y + 1, PF.w - 2, PF.h - 2);

    // doors - open doorways must READ as exits from across the room:
    // lit passage + accent frame posts + a pulsing chevron pointing out
    const locked = doorsLocked();
    for (const d of doorRects(room)) {
      const sealed = doorSealed(room, d.dir);
      const isShut = locked || sealed;
      const horiz = d.dir === 'N' || d.dir === 'S';

      // opening
      c.fillStyle = pal.floor;
      c.fillRect(d.x, d.y, d.w, d.h);
      if (isShut) {
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(d.x, d.y, d.w, d.h);
      } else {
        // warm light spilling from the passage
        const tx = horiz ? d.x + d.w / 2 : (d.dir === 'W' ? PF.x : PF.x + PF.w);
        const ty = horiz ? (d.dir === 'N' ? PF.y : PF.y + PF.h) : d.y + d.h / 2;
        c.fillStyle = 'rgba(255,232,170,0.13)';
        c.fillRect(d.x, d.y, d.w, d.h);
        const grad = c.createRadialGradient(tx, ty, 4, tx, ty, 70);
        grad.addColorStop(0, 'rgba(255,232,170,0.22)');
        grad.addColorStop(1, 'rgba(255,232,170,0)');
        c.fillStyle = grad;
        c.beginPath(); c.arc(tx, ty, 70, 0, Math.PI * 2); c.fill();
        // chevron pointing out through the door, gently pulsing
        const pulse = 0.45 + Math.sin(g.time * 3.2) * 0.25;
        const [ox, oy] = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[d.dir];
        const ax = tx + ox * 12, ay = ty + oy * 12;
        c.fillStyle = `rgba(255,232,170,${pulse})`;
        c.beginPath();
        c.moveTo(ax + ox * 8 - oy * 0, ay + oy * 8 - ox * 0);          // tip
        c.lineTo(ax - ox * 4 + (horiz ? -9 : 0), ay - oy * 4 + (horiz ? 0 : -9)); // base 1
        c.lineTo(ax - ox * 4 + (horiz ? 9 : 0), ay - oy * 4 + (horiz ? 0 : 9));   // base 2
        c.closePath(); c.fill();
      }

      // frame posts so every doorway reads as architecture, open or shut
      c.fillStyle = sealed ? '#c9a227' : pal.accent;
      if (horiz) {
        c.fillRect(d.x - 6, d.y, 6, d.h);
        c.fillRect(d.x + d.w, d.y, 6, d.h);
      } else {
        c.fillRect(d.x, d.y - 6, d.w, 6);
        c.fillRect(d.x, d.y + d.h, d.w, 6);
      }

      if (isShut) {
        // bars: iron for combat lock, gold for the boss/stairs seal
        c.strokeStyle = sealed ? '#c9a227' : '#6a7484';
        c.lineWidth = 4;
        const bars = 4;
        for (let i = 0; i < bars; i++) {
          if (horiz) {
            const bx = d.x + (i + 0.5) * d.w / bars;
            c.beginPath(); c.moveTo(bx, d.y); c.lineTo(bx, d.y + d.h); c.stroke();
          } else {
            const by = d.y + (i + 0.5) * d.h / bars;
            c.beginPath(); c.moveTo(d.x, by); c.lineTo(d.x + d.w, by); c.stroke();
          }
        }
      }
    }

    // obstacles, dressed for the floor's theme
    for (const o of room.obstacles) {
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(o.x + 3, o.y + 4, o.r, o.r * 0.7, 0, 0, Math.PI * 2); c.fill();
      if (theme.obstacle === 'tree') {
        // top-down tree: trunk + layered canopy
        c.fillStyle = '#4a3520';
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.4, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#2e4420';
        c.beginPath(); c.arc(o.x, o.y, o.r * 1.05, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#3d5a2a';
        c.beginPath(); c.arc(o.x - o.r * 0.2, o.y - o.r * 0.25, o.r * 0.75, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#4e7034';
        c.beginPath(); c.arc(o.x - o.r * 0.3, o.y - o.r * 0.35, o.r * 0.4, 0, Math.PI * 2); c.fill();
      } else if (theme.obstacle === 'stump') {
        // gnarled swamp stump in a murky puddle
        c.fillStyle = 'rgba(40,70,60,0.5)';
        c.beginPath(); c.ellipse(o.x, o.y + 2, o.r * 1.35, o.r * 0.8, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#3a2c1c';
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.85, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#241a10'; c.lineWidth = 2;
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.55, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.28, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#3a2c1c'; // root knuckles
        c.beginPath(); c.arc(o.x + o.r * 0.8, o.y + o.r * 0.3, o.r * 0.25, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(o.x - o.r * 0.75, o.y - o.r * 0.4, o.r * 0.22, 0, Math.PI * 2); c.fill();
      } else if (theme.obstacle === 'pillar') {
        // marble column with a gold ring, seen from above
        c.fillStyle = '#8d8698';
        c.beginPath(); c.arc(o.x, o.y, o.r, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#d4af37'; c.lineWidth = 3;
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.8, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#a9a2b5';
        c.beginPath(); c.arc(o.x - o.r * 0.2, o.y - o.r * 0.25, o.r * 0.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#c5bfd2';
        c.beginPath(); c.arc(o.x - o.r * 0.28, o.y - o.r * 0.33, o.r * 0.22, 0, Math.PI * 2); c.fill();
      } else {
        // plain rock (special rooms keep the classic look)
        c.fillStyle = pal.detail;
        c.beginPath(); c.arc(o.x, o.y, o.r, 0, Math.PI * 2); c.fill();
        c.fillStyle = pal.accent + '33';
        c.beginPath(); c.arc(o.x - o.r * 0.25, o.y - o.r * 0.3, o.r * 0.5, 0, Math.PI * 2); c.fill();
      }
    }

    // chests
    for (const ch of room.chests) if (!ch.opened) drawChest(c, ch);
    if (room.chests.some(ch => ch.opened && !ch.mimic)) {
      // opened chest husks stay as scenery
      for (const ch of room.chests) if (ch.opened && !ch.mimic) drawOpenChest(c, ch);
    }

    // stairs
    if (room.stairs) drawStairs(c, room);

    // shop furnishing
    if (room.type === 'shop' && room.shopStock) drawShop(c, room);

    // floor-clear portal: a swirling ring of the stairs' teal + essence purple
    if (g.portal && g.portal.room === room) {
      const pt = g.portal;
      c.save();
      c.translate(pt.x, pt.y);
      const spin = g.time * 2.2;
      for (let i = 0; i < 3; i++) {
        c.strokeStyle = i === 1 ? 'rgba(184,138,255,0.8)' : 'rgba(76,201,168,0.8)';
        c.lineWidth = 4 - i;
        c.beginPath();
        c.ellipse(0, 0, 26 + i * 7 + Math.sin(spin * 2 + i) * 3, 14 + i * 4, spin * (i % 2 ? -0.6 : 0.6), 0.4, Math.PI * 2 - 0.4);
        c.stroke();
      }
      const grad = c.createRadialGradient(0, 0, 2, 0, 0, 30);
      grad.addColorStop(0, 'rgba(76,201,168,0.55)');
      grad.addColorStop(1, 'rgba(76,201,168,0)');
      c.fillStyle = grad;
      c.beginPath(); c.arc(0, 0, 30, 0, Math.PI * 2); c.fill();
      if (Math.random() < 0.25) Fx.burst(pt.x + (Math.random() * 40 - 20), pt.y + (Math.random() * 24 - 12), Math.random() < 0.5 ? '#4cc9a8' : '#b88aff', 1, { speed: 30, life: 0.6, glow: true });
      c.restore();
      c.font = 'bold 12px monospace'; c.textAlign = 'center';
      c.fillStyle = '#4cc9a8';
      c.fillText('E - TO THE STAIRS', pt.x, pt.y + 48);
    }

    // start-room hint
    if (room.type === 'start' && g.floorNum === 1) {
      c.font = '13px monospace'; c.textAlign = 'center';
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillText('WASD move · aim with mouse · click to attack · SPACE to dodge roll', W / 2, PF.y + PF.h / 2 + 70);
    }

    // treasure room sparkle ambience
    if (room.type === 'treasure' && Math.random() < 0.1) {
      Fx.burst(PF.x + Math.random() * PF.w, PF.y + Math.random() * PF.h, '#d4af37', 1, { speed: 15, life: 0.8, glow: true });
    }
  }

  function drawChest(c, ch) {
    c.save();
    c.translate(ch.x, ch.y);
    // THE MIMIC TELL (subtle, learnable - per the design doc):
    //  1. a tiny idle "breathing" bob normal chests don't have
    //  2. a faint warm shimmer that pulses every ~3s
    // Attentive players can spot both; new players get surprised once.
    let bob = 0;
    if (ch.mimic) {
      bob = Math.sin(g.time * 2.2 + ch.wobble) * 1.2;
      const shimmer = Math.max(0, Math.sin(g.time * 1.9 + ch.wobble));
      if (shimmer > 0.93) {
        c.strokeStyle = `rgba(255,180,90,${(shimmer - 0.93) * 6})`;
        c.lineWidth = 2;
        c.strokeRect(-19, -17 + bob, 38, 30);
      }
    }
    c.translate(0, bob);
    // shadow
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.ellipse(0, 13, 20, 6, 0, 0, Math.PI * 2); c.fill();
    // body
    c.fillStyle = '#7a5230';
    c.fillRect(-17, -4, 34, 16);
    // lid
    c.fillStyle = ch.mimic ? '#83592f' : '#8d6238'; // mimic lid is a hair warmer-toned
    c.fillRect(-17, -16, 34, 12);
    // gold trim + lock
    c.fillStyle = '#d4af37';
    c.fillRect(-17, -5, 34, 3);
    c.fillRect(-3, -8, 6, 8);
    c.fillStyle = '#8a6b1f';
    c.beginPath(); c.arc(0, -3, 2, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function drawOpenChest(c, ch) {
    c.save();
    c.translate(ch.x, ch.y);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.ellipse(0, 13, 20, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5e3f24';
    c.fillRect(-17, -4, 34, 16);
    c.fillStyle = '#4a3018';
    c.fillRect(-15, -2, 30, 10);
    // lid flung open behind
    c.fillStyle = '#6b4726';
    c.fillRect(-17, -26, 34, 10);
    c.restore();
  }

  function drawStairs(c, room) {
    const s = room.stairs;
    const open = Dungeon.uncleared(g.dungeon) === 0;
    c.save();
    c.translate(s.x, s.y);
    // dark descending well
    c.fillStyle = open ? '#06090c' : '#101418';
    c.fillRect(-34, -26, 68, 52);
    for (let i = 0; i < 4; i++) {
      c.fillStyle = `rgba(${open ? '61,191,157' : '90,100,110'},${0.5 - i * 0.11})`;
      c.fillRect(-34 + i * 9, -26 + i * 7, 68 - i * 18, 52 - i * 14);
    }
    if (open) {
      const pulse = Math.sin(g.time * 3) * 0.3 + 0.7;
      c.strokeStyle = `rgba(61,191,157,${pulse})`;
      c.lineWidth = 2;
      c.strokeRect(-36, -28, 72, 56);
      c.font = 'bold 12px monospace'; c.textAlign = 'center';
      c.fillStyle = '#3dbf9d';
      c.fillText('E - DESCEND', 0, 44);
    } else {
      c.font = '11px monospace'; c.textAlign = 'center';
      c.fillStyle = '#5a6478';
      c.fillText('sealed', 0, 44);
    }
    c.restore();
  }

  function drawShop(c, room) {
    // shopkeeper: a chill hooded merchant behind the counter
    const kx = PF.x + PF.w / 2, ky = PF.y + 62;
    c.save();
    c.translate(kx, ky);
    c.fillStyle = '#3d2f4a';
    c.beginPath(); c.moveTo(0, -22); c.lineTo(18, 12); c.lineTo(-18, 12); c.closePath(); c.fill();
    c.fillStyle = '#241c2e';
    c.beginPath(); c.arc(0, -12, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd24c';
    c.beginPath(); c.arc(-3, -13, 1.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(3, -13, 1.8, 0, Math.PI * 2); c.fill();
    c.font = '11px monospace'; c.textAlign = 'center';
    c.fillStyle = 'rgba(255,210,76,0.7)';
    c.fillText('"browse, friend - no refunds"', 0, 34);
    c.restore();

    for (const it of room.shopStock.items) {
      if (it.sold) continue;
      // pedestal
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.ellipse(it.x, it.y + 18, 26, 8, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#46392c';
      c.fillRect(it.x - 22, it.y + 4, 44, 12);
      c.fillStyle = '#5a4a38';
      c.fillRect(it.x - 18, it.y - 2, 36, 8);

      if (it.kind === 'weapon') drawWeaponGlyph(c, it.weapon, it.x, it.y - 18, 1.1);
      if (it.kind === 'armor') drawArmorGlyph(c, it.armor, it.x, it.y - 18, 1.1);
      if (it.kind === 'potion') {
        c.fillStyle = '#e05555';
        c.beginPath(); c.arc(it.x, it.y - 14, 9, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#f4d0d0';
        c.fillRect(it.x - 3, it.y - 30, 6, 9);
      }
      if (it.kind === 'reroll') {
        c.save();
        c.translate(it.x, it.y - 16);
        c.rotate(g.time * 1.5);
        c.strokeStyle = '#7fd4ff'; c.lineWidth = 3;
        c.beginPath(); c.arc(0, 0, 10, 0.5, Math.PI * 2 - 0.5); c.stroke();
        c.beginPath(); c.moveTo(10, -4); c.lineTo(10, 2); c.lineTo(4, -1); c.fill();
        c.restore();
      }
      // price tag
      c.font = 'bold 12px monospace'; c.textAlign = 'center';
      c.fillStyle = g.player.coins >= it.price ? '#ffd24c' : '#775533';
      c.fillText(`${it.price}c`, it.x, it.y + 32);
      if (it.kind === 'reroll') {
        c.font = '10px monospace'; c.fillStyle = '#7fd4ff';
        c.fillText('reroll stock', it.x, it.y + 44);
      }
    }
  }

  function drawWeaponGlyph(c, w, x, y, scale = 1) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    c.shadowColor = w.color; c.shadowBlur = w.rarIdx >= 3 ? 12 : w.rarIdx >= 2 ? 6 : 0;
    c.strokeStyle = w.color; c.fillStyle = w.color;
    if (w.archetype === 'bow') {
      c.lineWidth = 2.5;
      c.beginPath(); c.arc(-2, 0, 11, -Math.PI / 2.3, Math.PI / 2.3); c.stroke();
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-2 + Math.cos(-Math.PI / 2.3) * 11, Math.sin(-Math.PI / 2.3) * 11);
      c.lineTo(-2 + Math.cos(Math.PI / 2.3) * 11, Math.sin(Math.PI / 2.3) * 11);
      c.stroke();
    } else {
      c.rotate(-Math.PI / 4);
      const fat = w.archetype === 'heavy';
      c.fillRect(fat ? -3 : -1.5, -15, fat ? 6 : 3, 20);
      c.fillRect(-6, 4, 12, 3);
    }
    c.restore();
  }

  function drawArmorGlyph(c, a, x, y, scale = 1) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    c.shadowColor = a.color; c.shadowBlur = a.rarIdx >= 3 ? 12 : a.rarIdx >= 2 ? 6 : 0;
    c.fillStyle = a.color;
    c.beginPath();
    c.moveTo(0, -12); c.lineTo(10, -7); c.lineTo(10, 3); c.lineTo(0, 13); c.lineTo(-10, 3); c.lineTo(-10, -7);
    c.closePath(); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(-1.5, -8, 3, 16);
    c.restore();
  }

  function drawPickup(c, pk) {
    const bobY = Math.sin(g.time * 4 + pk.x) * 3;
    if (pk.kind === 'coin') {
      c.save();
      c.translate(pk.x, pk.y);
      const squish = Math.abs(Math.sin(g.time * 5 + pk.x * 0.1));
      c.fillStyle = '#ffd24c';
      c.beginPath(); c.ellipse(0, 0, 5 * (0.4 + squish * 0.6), 5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#b8912f';
      c.beginPath(); c.ellipse(0, 0, 3 * (0.4 + squish * 0.6), 3, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    } else if (pk.kind === 'heart') {
      c.save();
      c.translate(pk.x, pk.y + bobY);
      c.fillStyle = '#e05555';
      c.beginPath();
      c.arc(-3, -2, 4, 0, Math.PI * 2); c.arc(3, -2, 4, 0, Math.PI * 2);
      c.moveTo(-6.5, 0); c.lineTo(0, 8); c.lineTo(6.5, 0);
      c.fill();
      c.restore();
    } else if (pk.kind === 'essence') {
      c.save();
      c.translate(pk.x, pk.y + bobY);
      c.rotate(g.time * 2);
      c.shadowColor = '#b88aff'; c.shadowBlur = 8;
      c.fillStyle = '#b88aff';
      c.beginPath(); c.moveTo(0, -6); c.lineTo(5, 0); c.lineTo(0, 6); c.lineTo(-5, 0); c.closePath(); c.fill();
      c.restore();
    } else if (pk.kind === 'buffShield') {
      c.save(); c.translate(pk.x, pk.y + bobY);
      c.shadowColor = '#7fd4ff'; c.shadowBlur = 8;
      c.fillStyle = '#7fd4ff';
      c.beginPath(); c.moveTo(0, -8); c.lineTo(7, -4); c.lineTo(7, 3); c.lineTo(0, 9); c.lineTo(-7, 3); c.lineTo(-7, -4);
      c.closePath(); c.fill();
      c.fillStyle = '#0e2a3a'; c.fillRect(-1.2, -5, 2.4, 10);
      c.restore();
    } else if (pk.kind === 'buffRage') {
      c.save(); c.translate(pk.x, pk.y + bobY);
      c.shadowColor = '#e05555'; c.shadowBlur = 8;
      c.fillStyle = '#e05555';
      c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 0); c.lineTo(2.5, 0); c.lineTo(2.5, 8); c.lineTo(-2.5, 8); c.lineTo(-2.5, 0); c.lineTo(-6, 0);
      c.closePath(); c.fill(); // up-arrow: damage up
      c.restore();
    } else if (pk.kind === 'buffHaste') {
      c.save(); c.translate(pk.x, pk.y + bobY);
      c.shadowColor = '#ffe08a'; c.shadowBlur = 8;
      c.fillStyle = '#ffe08a';
      c.beginPath(); c.moveTo(2, -9); c.lineTo(-5, 1); c.lineTo(-1, 1); c.lineTo(-2, 9); c.lineTo(5, -1); c.lineTo(1, -1);
      c.closePath(); c.fill(); // lightning bolt
      c.restore();
    } else if (pk.kind === 'weapon') {
      drawWeaponGlyph(c, pk.weapon, pk.x, pk.y + bobY, 1);
    } else if (pk.kind === 'armorItem') {
      drawArmorGlyph(c, pk.armor, pk.x, pk.y + bobY, 1);
    }
  }

  function drawInteractPrompt(c) {
    const t = nearestInteractable();
    if (!t) return;
    let x, y, label = 'E';
    if (t.kind === 'chest') { x = t.ch.x; y = t.ch.y - 34; label = 'E - open'; }
    if (t.kind === 'weaponPickup') { x = t.pk.x; y = t.pk.y - 30; label = `E take · X salvage +${[1,2,4,7,12][t.pk.weapon.rarIdx]}◈`; }
    if (t.kind === 'armorPickup') { x = t.pk.x; y = t.pk.y - 30; label = `E equip · X salvage +${[1,2,4,7,12][t.pk.armor.rarIdx]}◈`; }
    if (t.kind === 'shopItem') { x = t.it.x; y = t.it.y - 52; label = 'E - buy'; }
    if (t.kind === 'stairs' || t.kind === 'portal') return; // these draw their own prompt
    c.save();
    c.font = 'bold 12px monospace'; c.textAlign = 'center';
    c.fillStyle = 'rgba(0,0,0,0.6)';
    const wpx = c.measureText(label).width + 12;
    c.fillRect(x - wpx / 2, y - 12, wpx, 17);
    c.fillStyle = '#fff';
    c.fillText(label, x, y);

    // gear info card (weapons and armor share the layout)
    let w = null;
    if (t.kind === 'weaponPickup') w = t.pk.weapon;
    if (t.kind === 'armorPickup') w = t.pk.armor;
    if (t.kind === 'shopItem' && t.it.kind === 'weapon') w = t.it.weapon;
    if (t.kind === 'shopItem' && t.it.kind === 'armor') w = t.it.armor;
    if (w) {
      const subtitle = w.isArmor
        ? `Armor · ${Math.round(w.defense * 100)}% protection`
        : `${w.archetype === 'bow' ? 'Bow' : w.archetype === 'heavy' ? 'Heavy melee' : 'Light melee'} · ${w.dmg} dmg`;
      const lines = [
        { text: `${w.rarityName} ${w.name}`, color: w.color, bold: true },
        { text: subtitle, color: '#c8d2e0' },
        ...w.enchants.map(e => ({
          text: `${e.name}${e.level ? ' ' + ['', 'I', 'II', 'III'][e.level] : ''} - ${e.desc}`,
          color: e.tier === 3 ? '#ffd24c' : e.tier === 2 ? '#b88aff' : '#7fc79a',
        })),
      ];
      const cw = 250, lh = 16, chh = lines.length * lh + 14;
      let cx = Math.min(W - cw - 8, Math.max(8, x - cw / 2));
      let cy = y - chh - 22;
      if (cy < 8) cy = y + 30;
      c.fillStyle = 'rgba(8,8,16,0.9)';
      c.fillRect(cx, cy, cw, chh);
      c.strokeStyle = w.color; c.lineWidth = 1.5;
      c.strokeRect(cx, cy, cw, chh);
      c.textAlign = 'left';
      lines.forEach((l, i) => {
        c.font = (l.bold ? 'bold 12px' : '11px') + ' monospace';
        c.fillStyle = l.color;
        c.fillText(l.text, cx + 10, cy + 18 + i * lh);
      });
    }
    c.restore();
  }

  // ============================ DEBUG API (for automated testing) ============================
  window.dbg = {
    g,
    warp(type) {
      if (!g.dungeon) return 'no run';
      const room = g.dungeon.rooms.find(r => r.type === type);
      if (room) { g.monsters = []; g.projectiles = []; enterRoom(room, null); }
      return room ? room.type : 'not found';
    },
    clearRoom() { for (const m of g.monsters) if (!m.dead) { m.hp = 0; m.dead = true; g.onKill(m); } },
    clearFloor() { if (!g.dungeon) return 'no run'; for (const r of g.dungeon.rooms) if (r.type === 'combat') { r.cleared = true; r.spawned = true; } },
    give(rarity, arch) {
      if (!g.player) return 'no run';
      const w = Weapons.rollWeapon(3, { minRarity: rarity ?? 2, archetype: arch });
      g.player.pickupWeapon(w, g);
      return Weapons.displayName(w);
    },
    coins(n) { if (g.player) g.player.coins += n || 100; },
    armor(rarity) {
      if (!g.player) return 'no run';
      const a = Weapons.rollArmor(3, { minRarity: rarity ?? 2 });
      g.player.equipArmor(a, g);
      return Weapons.displayName(a);
    },
    evo(key, stacks) { g.evoQueue.push({ key: key || 'regen', stacks: stacks || 3 }); },
    god() { if (g.player) { g.player.maxHp = 9999; g.player.hp = 9999; } },
    lvl() { if (g.player) g.player.addXp(g.player.xpToNext(), g); },
    start() { if (g.state === 'title' || g.state === 'intro') newRun(); },
    state() {
      return {
        state: g.state, floor: g.floorNum, room: g.room && g.room.type,
        hp: g.player && g.player.hp, monsters: g.monsters.filter(m => !m.dead).length,
        rooms: g.dungeon && g.dungeon.rooms.map(r => r.type),
        uncleared: g.dungeon && Dungeon.uncleared(g.dungeon),
      };
    },
    // deterministic frame pump for automated testing (rAF throttles in occluded windows)
    step(seconds = 1, fps = 60) {
      const n = Math.round(seconds * fps);
      for (let i = 0; i < n; i++) tick(1 / fps);
    },
    press(code) { input.keys.add(code); input.just.add(code); },
    release(code) { input.keys.delete(code); },
    mouse(x, y, down) { input.mouse.x = x; input.mouse.y = y; if (down !== undefined) { input.mouse.down = down; if (down) input.mouse.clicked = true; } },
  };

  // boot
  console.log('[smashtv] loaded - Smash Arena TV');
  requestAnimationFrame(frame);
})();
