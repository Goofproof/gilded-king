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
    { key: 'magic',  icon: '✷', color: '#b06bff', name: 'Attunement', desc: '+1 Magic (wield stronger wands/staffs)' },
  ];

  // --- SHOP TUNING ---------------------------------------------------------------
  const POTION_PRICE = 25, POTION_HEAL = 40;
  const REROLL_BASE = 10;

  // --- persistent meta (survives death via localStorage) ---------------------------
  // --- arcade leaderboard (per-device, localStorage) -----------------------------
  // score = essence collected in a single run (banked total, incl. victory bonus)
  // seed leaderboard: 50 "past raiders" so the board is never empty. Merged in
  // ONCE (guarded by drl_scores_seeded), then it updates like any real score.
  const SEED_SCORES = [
    { initials: 'DUC', score: 412, floor: 11, won: true }, { initials: 'SAM', score: 388, floor: 9, won: true },
    { initials: 'REX', score: 356, floor: 8, won: true },  { initials: 'AVA', score: 331, floor: 7, won: true },
    { initials: 'KAI', score: 318, floor: 8, won: true },  { initials: 'ZOE', score: 297, floor: 6, won: true },
    { initials: 'MAX', score: 284, floor: 6, won: true },  { initials: 'JAX', score: 271, floor: 5, won: true },
    { initials: 'LEO', score: 259, floor: 5, won: true },  { initials: 'MIA', score: 246, floor: 4, won: true },
    { initials: 'FOX', score: 233, floor: 3, won: true },  { initials: 'ACE', score: 221, floor: 3, won: true },
    { initials: 'IVY', score: 208, floor: 3, won: true },  { initials: 'NYX', score: 196, floor: 3, won: false },
    { initials: 'BEN', score: 187, floor: 3, won: true },  { initials: 'RAY', score: 178, floor: 3, won: false },
    { initials: 'PIP', score: 169, floor: 3, won: false }, { initials: 'GUS', score: 161, floor: 3, won: false },
    { initials: 'TAS', score: 153, floor: 2, won: false }, { initials: 'ELF', score: 146, floor: 3, won: false },
    { initials: 'ORB', score: 138, floor: 2, won: false }, { initials: 'VEX', score: 131, floor: 2, won: false },
    { initials: 'DOT', score: 124, floor: 2, won: false }, { initials: 'HAL', score: 118, floor: 2, won: false },
    { initials: 'CJR', score: 111, floor: 2, won: false }, { initials: 'MOE', score: 105, floor: 2, won: false },
    { initials: 'SLY', score: 99, floor: 2, won: false },  { initials: 'BOB', score: 93, floor: 2, won: false },
    { initials: 'ZED', score: 88, floor: 2, won: false },  { initials: 'ANA', score: 82, floor: 2, won: false },
    { initials: 'TIM', score: 77, floor: 1, won: false },  { initials: 'JOY', score: 72, floor: 2, won: false },
    { initials: 'RON', score: 68, floor: 1, won: false },  { initials: 'KIT', score: 63, floor: 1, won: false },
    { initials: 'DAN', score: 59, floor: 1, won: false },  { initials: 'EVE', score: 55, floor: 1, won: false },
    { initials: 'LOU', score: 51, floor: 1, won: false },  { initials: 'PAM', score: 47, floor: 1, won: false },
    { initials: 'WIN', score: 43, floor: 1, won: false },  { initials: 'GIL', score: 40, floor: 1, won: false },
    { initials: 'JET', score: 36, floor: 1, won: false },  { initials: 'AMY', score: 33, floor: 1, won: false },
    { initials: 'NED', score: 30, floor: 1, won: false },  { initials: 'SUE', score: 27, floor: 1, won: false },
    { initials: 'TED', score: 24, floor: 1, won: false },  { initials: 'BEA', score: 21, floor: 1, won: false },
    { initials: 'OWL', score: 18, floor: 1, won: false },  { initials: 'DEE', score: 15, floor: 1, won: false },
    { initials: 'ROB', score: 12, floor: 1, won: false },  { initials: 'ABE', score: 9, floor: 1, won: false },
  ];
  const SCORE_CAP = 50;
  const validScore = e => e && typeof e.score === 'number' && isFinite(e.score);
  function loadScores() {
    let stored = [];
    try { const s = JSON.parse(localStorage.getItem('drl_scores')); if (Array.isArray(s)) stored = s.filter(validScore); } catch { }
    let seeded = false;
    try { seeded = localStorage.getItem('drl_scores_seeded') === '1'; } catch { }
    if (!seeded) {
      stored = [...stored, ...SEED_SCORES].sort((a, b) => b.score - a.score).slice(0, SCORE_CAP);
      try { localStorage.setItem('drl_scores', JSON.stringify(stored)); localStorage.setItem('drl_scores_seeded', '1'); } catch { }
    } else {
      stored = stored.slice(0, SCORE_CAP);
    }
    return stored;
  }
  function saveScores(scores) {
    try { localStorage.setItem('drl_scores', JSON.stringify(scores.slice(0, SCORE_CAP))); } catch { }
  }
  function scoreQualifies(score) {
    if (score <= 0) return false;
    const s = loadScores();
    // must crack the TOP 10 to earn an initials entry
    return s.length < 10 || score > s[9].score;
  }

  function loadMeta() {
    // normalize shape too - a hand-edited/corrupt drl_meta must never brick the title screen
    let m = null;
    try { m = JSON.parse(localStorage.getItem('drl_meta')); } catch { /* corrupt json */ }
    if (typeof m !== 'object' || m === null) m = {};
    if (typeof m.essence !== 'number' || !isFinite(m.essence)) m.essence = 0;
    if (typeof m.ranks !== 'object' || m.ranks === null) m.ranks = {};
    if (!Array.isArray(m.mythics)) m.mythics = []; // ids of mythic items ever claimed (laurels)
    if (!Array.isArray(m.petsUnlocked)) m.petsUnlocked = []; // pet types banked to the stable
    if (typeof m.selectedPet !== 'string') m.selectedPet = ''; // stable pet chosen for the next run
    return m;
  }
  function saveMeta() {
    try { localStorage.setItem('drl_meta', JSON.stringify(g.meta)); }
    catch { /* private browsing / quota - meta just won't persist */ }
  }

  // --- input ------------------------------------------------------------------------
  const input = {
    keys: new Set(), just: new Set(),
    mouse: { x: W / 2, y: H / 2, down: false, clicked: false, moved: false },
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
    input.mouse.moved = true; // so a parked mouse doesn't override keyboard menu nav
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
    state: 'title',       // title | play | levelup | pause | dead | win | transition | bossintro
    meta: loadMeta(),
    floorNum: 1,
    dungeon: null, room: null,
    player: null,
    monsters: [], projectiles: [], pickups: [], mercs: [], mines: [],
    boss: null, bossIntroT: 0, winTimer: -1, portal: null,
    // --- Descent (endless mode) ---
    kingSlain: false,        // slew the floor-3 Gilded King (scoreboard crown)
    circleBossSeen: 0,       // recurring-boss counter (drives recolor + anger)
    descentPortal: null,     // {room,x,y,t,toad} - one-way plunge to the next floor
    pendingDescent: null,    // set on boss death; opens the portal after the celebration
    toadMsg: null,           // {text,t} - "THE PRINCESS IS IN ANOTHER CASTLE!"
    essenceCheckpoint: 0,    // essence already banked to meta this run (quit-safe descent)
    bossIntroName: 'THE MIMIC KING', bossIntroSub: 'the dungeon was bait all along',
    autoAttack: (() => { try { return localStorage.getItem('drl_auto') === '1'; } catch { return false; } })(),
    playerName: (() => { try { return (localStorage.getItem('drl_name') || '').slice(0, 12); } catch { return ''; } })(),
    evoQueue: [], evoChoices: null, ultChoices: null,
    levelChoices: [], levelUpQueue: 0, hoverChoice: -1,
    initials: null, afterInitials: 'dead', newScoreRank: 0, showScores: false, showPatch: false, showMythics: false, scores: loadScores(),
    // --- co-op (multiplayer) ---
    coop: false,                 // true during a networked run
    coopSeed: 0,                 // shared floor seed for the co-op party
    netMobId: 0,                 // host-assigned monster ids (for co-op sync)
    mobSendT: 0,                 // monster-snapshot broadcast throttle
    lobby: null,                 // {mode,entry,status} while on the lobby screen
    remotePlayers: new Map(),    // id -> {x,y,facing,room,hp,wc,tx,ty,last} (other players)
    netReady: false,             // Net handlers wired once
    posSendT: 0,                 // position-broadcast throttle
    // #32 co-op synchronized level-up gate. MONOTONIC busy/done COUNTERS (not
    // level-tags or playerCount, both of which soft-lock; not a reset Set, which
    // wipes an already-arrived signal): each peer sends {lvlbusy} when a pick cycle
    // opens and {lvldone} when it closes. peerBusy[id]/peerDone[id] only ever grow;
    // a peer is "still picking" while its busy count exceeds its done count. You
    // resume once no peer is still picking. Order-independent, so it can't wipe a
    // co-leveler's signal. leveling = local cycle active; levelWaitT = failsafe timer.
    leveling: false, peerBusy: {}, peerDone: {}, levelWaitT: 0,
    pendingCoopRoom: null, // deferred room-follow while gated
    transition: null,     // {dir, next, t}
    uiRects: [],
    backtrackRooms: 0,    // #34: hop-distance to nearest unexplored room (speed boost)
    essenceEarned: 0,
    gateMsg: 0,           // "sealed" toast timer
    shopMsg: null,        // {text, t}
    time: 0,
    queueLevelUp() { this.levelUpQueue++; },
    onKill(m) { onKill(m); },
    spawnPickup(kind, x, y) { spawnPickup(kind, x, y); }, // loot-goblin coin spill (monsters.js)
    dropMine(x, y, dmg) { g.mines.push({ x, y, r: 8, blastR: 74, dmg, t: 0, armT: 0.6, armed: false, fuse: -1 }); }, // minelayer
    onPlayerDeath() { onPlayerDeath(); },
    dropWeaponPickup(w, x, y) { this.pickups.push({ kind: 'weapon', weapon: w, x, y, t: 0 }); },
    dropArmorPickup(a, x, y) { this.pickups.push({ kind: 'armorItem', armor: a, x, y, t: 0 }); },
    recordMythic(item) { recordMythic(item); },
  };

  // claiming a mythic (Descent boss drop or the mythic shop) earns a permanent
  // laurel on the title screen and a loud in-run accolade.
  function recordMythic(item) {
    if (!item || !item.mythic) return;
    if (!Array.isArray(g.meta.mythics)) g.meta.mythics = [];
    const first = !g.meta.mythics.includes(item.mythicId);
    if (first) { g.meta.mythics.push(item.mythicId); saveMeta(); }
    Sfx.play('levelup');
    Fx.text(g.player.x, g.player.y - 46, (first ? 'MYTHIC CLAIMED: ' : 'MYTHIC: ') + item.name, item.color, 15);
    Fx.burst(g.player.x, g.player.y, [item.color, '#fff', '#ffd24c'], 30, { speed: 220, life: 0.9, glow: true });
  }

  // bank a pet type to the home-screen stable (permanent across runs)
  function recordPetUnlock(type) {
    if (!type) return false;
    if (!Array.isArray(g.meta.petsUnlocked)) g.meta.petsUnlocked = [];
    const first = !g.meta.petsUnlocked.includes(type);
    if (first) { g.meta.petsUnlocked.push(type); saveMeta(); }
    return first;
  }
  // the full pet definition for a stable type (from the Descent pet roster)
  function petDefByType(type) {
    const pets = (typeof Descent !== 'undefined' && Descent.PETS) || [];
    const def = pets.find(p => p.type === type);
    return def ? { ...def } : null;
  }

  // ============================ RUN LIFECYCLE ============================
  function newRun(coop = false) {
    g.coop = coop;
    if (!coop) g.remotePlayers.clear();
    g.floorNum = 1;
    g.player = new PlayerDef.Player(g.meta);
    g.player.coinsTotal = 0;
    // reset ALL per-run state (a stale level-up queue once leaked into a fresh run)
    g.essenceEarned = 0;
    g.levelUpQueue = 0;
    g.levelChoices = [];
    g.evoQueue = [];
    g.evoChoices = null;
    g.leveling = false; g.peerBusy = {}; g.peerDone = {}; // #32 gate reset
    g.levelWaitT = 0; g.pendingCoopRoom = null;
    g.winTimer = -1;
    g.deathTimer = -1;
    g.runEnded = false;
    g.boss = null;
    g.transition = null;
    g.gateMsg = 0;
    g.shopMsg = null;
    // reset Descent state
    g.mercs = [];
    g.kingSlain = false;
    g.circleBossSeen = 0;
    g.descentPortal = null;
    g.pendingDescent = null;
    g.toadMsg = null;
    g.essenceCheckpoint = 0;
    // a pet chosen from the home-screen stable starts the run at your side
    if (g.meta.selectedPet && (g.meta.petsUnlocked || []).includes(g.meta.selectedPet)) {
      const def = petDefByType(g.meta.selectedPet);
      if (def) g.player.adoptPet(def);
    }
    startFloor();
    g.state = 'play';
    Sfx.play('door');
  }

  function startFloor() {
    // co-op: everyone builds the SAME floor from the shared run seed
    g.dungeon = Dungeon.generateFloor(g.floorNum, g.coop ? g.coopSeed : undefined);
    g.portal = null; // portals never carry across floors
    const theme = Dungeon.themeFor(g.floorNum);
    g.floorBanner = { text: `FLOOR ${g.floorNum} · ${theme.name}`, t: 3.5 };
    Sfx.setAmbient(theme.ambient);
    // Bulwark armor: a shield charm greets you on every floor
    if (g.player.armorMods.bulwark) {
      g.player.buffs.shield = 1;
      Fx.text(g.player.x, g.player.y - 30, 'BULWARK', '#7fd4ff', 13);
    }
    enterRoom(g.dungeon.start, null);
  }

  // #34: BFS over the door graph for the hop-distance from the current room to the
  // nearest UNEXPLORED (unvisited) room. Backtracking far across cleared/explored
  // rooms toward the next objective earns an extra traversal speed boost (player.js).
  function computeBacktrackDist() {
    g.backtrackRooms = 0;
    if (!g.dungeon || !g.room || !g.room.visited) return; // in an unexplored room = 0
    const seen = new Set([g.room]);
    let frontier = [g.room], d = 0;
    while (frontier.length) {
      d++;
      const next = [];
      for (const r of frontier) {
        for (const dir in r.doors) {
          const n = r.doors[dir];
          if (seen.has(n)) continue;
          seen.add(n);
          if (!n.visited) { g.backtrackRooms = d; return; } // nearest unexplored room
          next.push(n);
        }
      }
      frontier = next;
    }
    // everything reachable is explored -> leave backtrackRooms at 0 (no extra boost)
  }

  function enterRoom(room, fromDir) {
    // drops are persistent: whatever was left on this room's floor is still there
    if (g.room) g.room.savedPickups = g.pickups;
    g.room = room;
    room.visited = true;
    computeBacktrackDist(); // #34: how far are we from the nearest unexplored room?
    g.monsters = [];
    g.projectiles = [];
    g.mines = [];
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

    // hired mercenaries travel with you: drop them in beside the player
    for (const merc of g.mercs) { merc.x = p.x - 30 + Math.random() * 60; merc.y = p.y + 34; }
    // pet travels with you too - snap it beside the player (was left across the room)
    if (p.pet) { p.pet.x = p.x - 24; p.pet.y = p.y - 18; }

    if (room.type === 'boss' && !room.cleared) {
      g.state = 'bossintro';
      g.bossIntroT = 0;
      p.drawT = -1; // don't let a held draw fire mid-intro
      // pick which King you face: the gold Gilded King on floor 3, or a recolored,
      // angrier Circle Warden in the Descent. Config is rolled ONCE here (it
      // advances the anger counter) and consumed when the boss actually spawns.
      g.pendingBossCfg = (typeof Descent !== 'undefined' && Descent.isDescent(g.floorNum))
        ? Descent.bossConfig(g) : null;
      g.bossIntroName = g.pendingBossCfg ? g.pendingBossCfg.name : 'THE MIMIC KING';
      g.bossIntroSub = g.pendingBossCfg ? g.pendingBossCfg.subtitle : 'the dungeon was bait all along';
      Sfx.play('roar');
      return;
    }
    if ((room.type === 'combat') && !room.spawned) {
      room.spawned = true;
      if (isCoopGuest()) {
        g.monsters = []; // guest: the host owns the monsters; they arrive via snapshots
      } else {
        g.monsters = Monsters.spawnForRoom(room, g.floorNum, g);
        coopScaleMonsters(g.monsters);                        // co-op: tougher for the party
        for (const m of g.monsters) m.netId = ++g.netMobId;   // stamp for co-op sync
      }
      Sfx.play('door'); // doors slam
      // #27 themed-room banner (an all-one-type gauntlet)
      if (room.enemyTheme) {
        const NAME = { archer: 'AMBUSH', bomber: 'MINEFIELD', swarmer: 'SWARM', glass: 'ARTILLERY', shielded: 'PHALANX', seeker: 'THE HUNT', miner: 'MINEFIELD', pulser: 'BULLET HELL', worm: 'THE NEST', chaser: 'THE HORDE' };
        g.floorBanner = { text: `${NAME[room.enemyTheme] || 'GAUNTLET'}`, t: 2.2, sub: `nothing here but ${room.enemyTheme}s` };
      }
    }
    if ((room.type === 'shop' || room.type === 'mythicshop') && !room.shopStock) {
      if (room.type === 'mythicshop') rollMythicShopStock(room); else rollShopStock(room);
    }
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

  // the secret mythic shop: three hand-built uniques, no potions, no rerolls
  function rollMythicShopStock(room) {
    const tier = Monsters.tierFor(g.floorNum, room.dist);
    const owned = g.meta.mythics || [];
    const w1 = Weapons.rollMythic('weapon', { exclude: owned, tier });
    const w2 = Weapons.rollMythic('weapon', { exclude: [...owned, w1.mythicId], tier });
    const a1 = Weapons.rollMythic('armor', { exclude: owned, tier });
    const items = [
      { kind: 'weapon', weapon: w1, x: PF.x + 230, y: PF.y + 210 },
      { kind: 'weapon', weapon: w2, x: PF.x + 460, y: PF.y + 210 },
      { kind: 'armor',  armor: a1,  x: PF.x + 660, y: PF.y + 210 },
    ];
    for (const it of items) it.price = (it.weapon || it.armor).price;
    room.shopStock = { items, rerolls: 0, mythic: true };
  }

  // ============================ KILLS / LOOT ============================
  function onKill(m) {
    const p = g.player;
    p.kills++;
    p.addXp(m.xp, g);
    // co-op: the whole party levels off shared kills (kills only ever happen on
    // the host, so it grants everyone the same XP)
    if (g.coop && typeof Net !== 'undefined' && Net.isHost) Net.send({ t: 'xp', a: m.xp });
    Fx.burst(m.x, m.y, ['#fff', '#ffd24c', '#ff6655'], 14, { speed: 180, life: 0.5 });
    Sfx.play('kill');
    // #26: catching the loot goblin pays out a jackpot (its coins are set high in BASE)
    if (m.type === 'goblin') {
      Fx.text(m.x, m.y - 32, 'JACKPOT!', '#ffd24c', 18);
      Fx.burst(m.x, m.y, ['#ffd24c', '#ffe08a', '#fff'], 30, { speed: 240, life: 0.8, glow: true });
      Sfx.play('buy');
    }

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

    // Descent elites pay out: extra essence, and often a temporary power
    if (m.elite) {
      for (let i = 0; i < 2; i++) spawnPickup('essence', m.x, m.y);
      if (Math.random() < 0.5) spawnPickup(['buffShield', 'buffRage', 'buffHaste'][(Math.random() * 3) | 0], m.x, m.y);
    }

    // weapon drops
    const tier = Monsters.tierFor(g.floorNum, g.room.dist);
    if (m.type === 'mimic') {
      // mimics reward the risk: guaranteed good weapon + bonus XP
      const wp = Weapons.rollWeapon(tier, { minRarity: 1, luck: 0.6 });
      dropGear('weapon', wp, m.x, m.y);
      p.addXp(15, g);
    } else if (m.isBoss) {
      // THE KING (and every Circle Warden): guaranteed legendary + royal armor +
      // coin fountain + essence. In the Descent he pays out more the deeper you are.
      const wp = Weapons.rollWeapon(tier, { minRarity: 4 });
      dropGear('weapon', wp, m.x, m.y - 20);
      dropGear('armorItem', Weapons.rollArmor(tier, { minRarity: 3 }), m.x + 40, m.y);
      for (let i = 0; i < 36; i++) spawnPickup('coin', m.x, m.y);
      const ne = m.isDescentBoss ? Descent.bossEssence(g.floorNum) : 12;
      for (let i = 0; i < ne; i++) spawnPickup('essence', m.x, m.y);
      // Circle Wardens are the only creatures that guard mythics
      if (m.isDescentBoss && Math.random() < Descent.MYTHIC_DROP_CHANCE) {
        const item = Weapons.rollMythic(undefined, { exclude: g.meta.mythics, tier });
        if (item.isArmor) dropGear('armorItem', item, m.x - 40, m.y);
        else dropGear('weapon', item, m.x, m.y + 24);
        Fx.text(m.x, m.y - 50, 'A MYTHIC STIRS IN THE ASH...', item.color, 15);
      }
      if (!m.isDescentBoss) { g.kingSlain = true; p.essenceRun += 20; } // King's victory bonus
      g.winTimer = 2.6;                             // savor the kill; doors stay locked
      // every boss opens the plunge with a Toad line: the King's is verbatim, each
      // deeper Warden's is one notch more twisted (index = how many you've felled)
      const toadIdx = m.isDescentBoss ? g.circleBossSeen : 0;
      g.pendingDescent = { toadIdx };
      // P1-E: tell guests the boss fell so they clear it + share the victory
      if (g.coop && typeof Net !== 'undefined' && Net.isHost) Net.send({ t: 'bossDead', x: Math.round(m.x), y: Math.round(m.y), toad: toadIdx, king: g.kingSlain ? 1 : 0 });
    } else if (m.elite && Math.random() < 0.3) {
      // elites drop gear far more often than trash mobs
      dropGear('weapon', Weapons.rollWeapon(tier, { minRarity: 1, luck: 0.4 }), m.x, m.y);
    } else if (Math.random() < 0.045 * (1 + 0.5 * looting)) {
      dropGear('weapon', Weapons.rollWeapon(tier), m.x, m.y);
    } else if (Math.random() < 0.035 * (1 + 0.5 * looting)) {
      dropGear('armorItem', Weapons.rollArmor(tier), m.x, m.y);
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
    // P1-D: currency/buff drops are INSTANCED - the host mirrors each to the guest,
    // who spawns its OWN copy into its OWN wallet (both players progress economically).
    // Guard on Net.isHost so the guest's own spawns don't echo back.
    if (g.coop && typeof Net !== 'undefined' && Net.isHost) Net.send({ t: 'pk', k: kind, x: Math.round(x), y: Math.round(y) });
  }

  // drop a GEAR pickup (weapon/armor) and, in co-op, mirror it to guests as their
  // OWN instanced copy so player 2/3 get stronger loot too (kills only run on the
  // host, so guests never generate these locally). Weapon/armor objects are plain
  // data - safe to send over the wire and reconstruct as-is on the guest.
  function dropGear(kind, item, x, y) {
    const pk = { kind, x, y, t: 0 };
    if (kind === 'weapon') pk.weapon = item; else pk.armor = item;
    g.pickups.push(pk);
    if (g.coop && typeof Net !== 'undefined' && Net.isHost) {
      Net.send({ t: 'gear', kind, item, x: Math.round(x), y: Math.round(y) });
    }
    return pk;
  }

  function checkRoomCleared() {
    if (g.room.cleared) return;
    if ((g.room.type === 'combat' || g.room.type === 'boss') && g.room.spawned &&
        g.monsters.every(m => m.dead)) {
      g.room.cleared = true;
      g.player.roomsCleared++;
      vacuumPickups(); // room-clear reward: every dropped coin flies to you
      Sfx.play('unlock');
      Fx.text(W / 2, H / 2 - 60, 'ROOM CLEARED', '#6ee7a0', 18);
      // P1-D: guests never run onKill/checkRoomCleared - tell them the room cleared so
      // their coins vacuum and their doors unseal
      if (g.coop && typeof Net !== 'undefined' && Net.isHost) Net.send({ t: 'roomclear', gx: g.room.gx, gy: g.room.gy });
      if (g.room.type !== 'boss' && Dungeon.uncleared(g.dungeon) === 0) {
        // this floor has a boss only on floor 3 (the King) and on Circle Warden
        // floors in the Descent; every other floor ends in a stairs portal.
        const hasBoss = g.floorNum === 3 ||
          (typeof Descent !== 'undefined' && Descent.isBossFloor(g.floorNum));
        if (hasBoss) {
          openPortal(); // #21: skip the long trek - a portal to the boss's doorstep opens
          Fx.text(W / 2, H / 2 - 30, 'THE BOSS DOOR OPENS...', '#ffd24c', 15);
          Fx.text(W / 2, H / 2 - 8, 'a portal to its threshold shimmers open', '#b88aff', 13);
        } else {
          openPortal(); // floor done: a portal to the stairs room opens right here
          Fx.text(W / 2, H / 2 - 30, 'A PORTAL TO THE STAIRS OPENS', '#4cc9a8', 15);
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

  // #21: the room adjacent to the boss room (boss rooms are dead-ends with one door),
  // i.e. the boss's "threshold" the floor-3 portal drops you at
  function roomOutsideBoss() {
    if (!g.dungeon) return null;
    const boss = g.dungeon.rooms.find(r => r.type === 'boss');
    if (!boss) return null;
    for (const dir in boss.doors) return boss.doors[dir]; // first (only) neighbor
    return null;
  }

  function openPortal() {
    if (g.portal) return;
    // room centers are kept clear of obstacles by the generator, so it's safe
    g.portal = { room: g.room, x: PF.x + PF.w / 2, y: PF.y + PF.h / 2, t: 0 };
    Fx.burst(g.portal.x, g.portal.y, ['#4cc9a8', '#b88aff', '#fff'], 26, { speed: 160, life: 0.8, glow: true });
    Sfx.play('levelup');
  }

  // the one-way plunge that opens where a boss just fell. Entering it (E) drops
  // you to the next floor of the Descent - there is no going back up.
  function openDescentPortal(opts) {
    if (g.descentPortal) return;
    g.descentPortal = { room: g.room, x: PF.x + PF.w / 2, y: PF.y + PF.h / 2, t: 0 };
    g.toadMsg = { text: Descent.toadLine(opts.toadIdx || 0), t: 5 };
    Fx.burst(g.descentPortal.x, g.descentPortal.y, ['#ff5a2c', '#ffcc44', '#ff2200', '#1a0a06'], 36, { speed: 210, life: 1.0, glow: true });
    Fx.shake(6, 0.4);
    Sfx.play('roar');
  }

  // essence is never spent, so it only rises - bank the delta as you descend so
  // quitting mid-run can't wipe the winnings (death banks the remainder).
  function bankEssenceCheckpoint() {
    const delta = g.player.essenceRun - g.essenceCheckpoint;
    if (delta > 0) { g.meta.essence += delta; g.essenceCheckpoint = g.player.essenceRun; saveMeta(); }
  }

  function onPlayerDeath() {
    // P1-C co-op: you don't END on death - you go DOWNED and can be revived. The
    // run only ends when the WHOLE party is down (host broadcasts {t:'gameover'}).
    // Crucially the host keeps simulating (state stays 'play') so the guest never
    // freezes on a host death.
    if (g.coop) { goDowned(); return; }
    if (g.runEnded) return; // never bank twice (death/victory race)
    g.runEnded = true;
    // bank essence: what you carried + 10% of unspent coins
    const fromCoins = Math.floor(g.player.coins * 0.10);
    g.essenceEarned = g.player.essenceRun + fromCoins;               // total, for the end screen
    g.meta.essence += (g.player.essenceRun - g.essenceCheckpoint) + fromCoins; // only the un-banked part
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
      scores.push({ initials: name, score: g.essenceEarned, floor: g.floorNum, won: g.afterInitials === 'win' || g.kingSlain });
      scores.sort((a, b) => b.score - a.score);
      g.scores = scores.slice(0, SCORE_CAP);
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
        const next = g.room.doors[d.dir];
        // tethered party: dragging everyone else to this room
        if (g.coop && typeof Net !== 'undefined') Net.send({ t: 'room', gx: next.gx, gy: next.gy, dir: d.dir });
        g.transition = { dir: d.dir, next, t: 0 };
        g.state = 'transition';
        return;
      }
      return; // in the lane, not past yet: allow walking into the doorway
    }
    clampPlayer();
  }

  function clampPlayer() {
    const p = g.player;
    // Each wall is clamped INDEPENDENTLY: a wall only opens if there's a real door
    // on THAT side and the player is lined up with its lane. (Bug fix: N and S doors
    // share the same centre-X lane, so the old "inLaneY" let a north door leak you
    // out through the south wall - and W/E likewise.)
    let openTop = false, openBot = false, openLeft = false, openRight = false;
    if (!doorsLocked()) {
      for (const d of doorRects(g.room)) {
        if (doorSealed(g.room, d.dir)) continue;
        if (d.dir === 'N' && p.x > d.x && p.x < d.x + d.w) openTop = true;
        if (d.dir === 'S' && p.x > d.x && p.x < d.x + d.w) openBot = true;
        if (d.dir === 'W' && p.y > d.y && p.y < d.y + d.h) openLeft = true;
        if (d.dir === 'E' && p.y > d.y && p.y < d.y + d.h) openRight = true;
      }
    }
    if (!openTop) p.y = Math.max(PF.y + p.r, p.y);
    if (!openBot) p.y = Math.min(PF.y + PF.h - p.r, p.y);
    if (!openLeft) p.x = Math.max(PF.x + p.r, p.x);
    if (!openRight) p.x = Math.min(PF.x + PF.w - p.r, p.x);
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
    if ((g.room.type === 'shop' || g.room.type === 'mythicshop') && g.room.shopStock) {
      for (const it of g.room.shopStock.items) if (!it.sold) consider(it.x, it.y, { kind: 'shopItem', it });
    }
    if (g.room.stairs && g.room.stairs.open !== undefined) {
      if (Dungeon.uncleared(g.dungeon) === 0) consider(g.room.stairs.x, g.room.stairs.y, { kind: 'stairs' });
    }
    if (g.portal && g.portal.room === g.room) consider(g.portal.x, g.portal.y, { kind: 'portal' });
    if (g.descentPortal && g.descentPortal.room === g.room) consider(g.descentPortal.x, g.descentPortal.y, { kind: 'descentPortal' });
    if (g.room.merc && !g.room.merc.hired && g.mercs.length < 2) consider(g.room.merc.x, g.room.merc.y, { kind: 'merc' });
    if (g.room.pet && !g.room.pet.activated) consider(g.room.pet.x, g.room.pet.y, { kind: 'pet' });
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
      // tethered party: bring everyone down to the same next floor
      if (g.coop && typeof Net !== 'undefined') Net.send({ t: 'floor', floor: g.floorNum, seed: g.coopSeed });
      startFloor();
    }

    if (t.kind === 'portal') {
      // one-way ride to the floor's exit: the stairs room, or on a boss floor the
      // room right OUTSIDE the boss door (#21 - no long backtrack to the boss)
      const stairsRoom = g.dungeon.rooms.find(r => r.type === 'stairs');
      const dest = stairsRoom || roomOutsideBoss();
      if (dest) {
        Sfx.play('stairs');
        Fx.burst(p.x, p.y, ['#4cc9a8', '#b88aff'], 20, { speed: 180, life: 0.5, glow: true });
        g.portal = null;
        // co-op: pull the party along so nobody is left behind by the shortcut
        if (g.coop && typeof Net !== 'undefined') Net.send({ t: 'room', gx: dest.gx, gy: dest.gy, dir: null });
        enterRoom(dest, null);
        if (stairsRoom) p.y += 90; // land beside the stairwell, not inside it
      }
    }

    if (t.kind === 'pet') {
      const pet = g.room.pet;
      pet.activated = true;
      recordPetUnlock(pet.type); // banked to the stable forever, either way
      if (!p.pet) {
        p.adoptPet(petDefByType(pet.type) || { ...pet });
        Sfx.play('levelup');
        Fx.text(p.x, p.y - 30, `${pet.name} joins you · ${pet.desc}`, pet.color, 14);
        Fx.burst(p.x, p.y, [pet.color, '#fff'], 22, { speed: 180, life: 0.7, glow: true });
      } else {
        // already have a companion - the new one goes home to the stable
        Sfx.play('pickup');
        Fx.text(p.x, p.y - 30, `${pet.name} sent to your stable`, pet.color, 13);
        Fx.burst(p.x, p.y, [pet.color, '#fff'], 16, { speed: 120, life: 0.6, glow: true });
      }
    }

    if (t.kind === 'merc') {
      const npc = g.room.merc;
      if (g.mercs.length >= 2) { g.shopMsg = { text: 'You already lead two mercenaries', t: 1.4 }; Sfx.play('error'); return; }
      if (p.coins < npc.cost) { g.shopMsg = { text: `Need ${npc.cost} coins to hire`, t: 1.4 }; Sfx.play('error'); return; }
      p.coins -= npc.cost;
      npc.hired = true;
      g.mercs.push(makeMercFollower(npc, g.floorNum));
      Sfx.play('buy');
      Fx.text(p.x, p.y - 30, (npc.cls === 'blade' ? 'Blade' : 'Archer') + ' hired!', '#7ee0a0', 14);
    }

    if (t.kind === 'descentPortal') {
      // plunge straight to the next circle - no stairs room, the fall IS the descent
      Sfx.play('stairs');
      Fx.burst(p.x, p.y, ['#ff5a2c', '#ffcc44', '#ff2200'], 24, { speed: 200, life: 0.5, glow: true });
      g.descentPortal = null;
      g.toadMsg = null;
      bankEssenceCheckpoint();
      g.floorNum++;
      if (g.coop && typeof Net !== 'undefined') Net.send({ t: 'floor', floor: g.floorNum, seed: g.coopSeed });
      p.heal(25); // a breath before the next circle
      startFloor();
    }
  }

  // ============================ ABILITIES (Q / R / ULTIMATE) ============================
  // Q = first two evolutions, R = next two, Ultimate (left-click) = a chosen fusion of Q+R.
  function useAbility() { castAbility(g.player.ability); }
  function useAbilityR() { castAbility(g.player.abilityR); }
  function useUltimate() { castAbility(g.player.abilityUlt); }

  // run ANY ability (Q/R/ultimate). Ults just carry bigger numbers + the ult flag.
  function castAbility(a) {
    const p = g.player;
    if (!a || a.cd > 0 || p.dead || p.rollT >= 0) return;
    const dmgMul = a.dmgMul || 1;
    Sfx.play(a.ult ? 'roar' : 'heavy');

    if (a.kind === 'nova' || a.kind === 'strike') {
      let dmg = (a.dmg || 60) * dmgMul;
      if (a.coinScale) dmg += Math.min(140, p.coins * 0.5); // Coin Storm scales with your purse
      const R = a.radius || 150;
      Fx.burst(p.x, p.y, [a.color, '#fff'], 34, { speed: 340, life: 0.5, glow: true });
      Fx.shake(6, 0.22);
      for (const m of g.monsters) {
        if (m.dead || m.airborne || m.spawnT > 0) continue;
        if (Math.hypot(m.x - p.x, m.y - p.y) > R + m.r) continue;
        m.takeHit(dmg, { sx: p.x, sy: p.y, knock: a.knock || 120, crit: !!a.critAll, fromPlayer: true, hitSfx: 'hitHeavy' }, g);
      }
    } else if (a.kind === 'dash') {
      const ang = p.facing, dist = a.dist || 260;
      const tx = Math.max(PF.x + p.r, Math.min(PF.x + PF.w - p.r, p.x + Math.cos(ang) * dist));
      const ty = Math.max(PF.y + p.r, Math.min(PF.y + PF.h - p.r, p.y + Math.sin(ang) * dist));
      const steps = 12, hit = new Set();
      for (let i = 0; i <= steps; i++) {
        const px = p.x + (tx - p.x) * i / steps, py = p.y + (ty - p.y) * i / steps;
        Fx.burst(px, py, [a.color, '#fff'], 2, { speed: 40, life: 0.3, glow: true });
        for (const m of g.monsters) {
          if (m.dead || m.airborne || m.spawnT > 0 || hit.has(m)) continue;
          if (Math.hypot(m.x - px, m.y - py) < m.r + p.r + 8) {
            m.takeHit((a.dmg || 55) * dmgMul, { sx: px, sy: py, knock: 150, crit: !!a.critAll, fromPlayer: true, hitSfx: 'hitLight' }, g);
            hit.add(m);
          }
        }
      }
      p.x = tx; p.y = ty;
      p.iframes = Math.max(p.iframes, (a.iframe || 0.4) + (a.iframeAfter || 0));
      if (a.refundRoll) p.rollCd = 0;
      Fx.shake(4, 0.15);
    } else if (a.kind === 'buff') {
      if (a.heal) p.heal(p.maxHp * a.heal);
      Fx.burst(p.x, p.y, [a.color, '#fff'], 26, { speed: 170, life: 0.7, glow: true });
    }

    // universal post-cast modifiers (folded on by the 2nd evolution)
    if (a.castShield) p.buffs.shield = 1;
    if (a.healOnCast) p.heal(p.maxHp * a.healOnCast);
    if (a.rageAfter) p.buffs.rageT = Math.max(p.buffs.rageT, a.rageAfter);
    if (a.hasteAfter) p.buffs.hasteT = Math.max(p.buffs.hasteT, a.hasteAfter);
    Fx.text(p.x, p.y - 40, a.name.toUpperCase(), a.color, a.ult ? 17 : 14);
    if (a.ult) Fx.shake(9, 0.35);
    a.cd = a.cdMax;
  }

  // --- SHARD SALVAGE (Sam's idea: floor loot shouldn't be waste) ------------------
  // X breaks a nearby dropped weapon/armor into shards; U spends shards to hone
  // your equipped weapon (+8% damage per hone, 5 hones max per weapon).
  const SHARD_VALUE = [1, 2, 4, 7, 12, 20]; // by rarity index (last = mythic)
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

  // --- MERCENARIES (hire up to 2; they fight alongside you) -----------------------
  // MORTAL (Sam, 2026-07-11 - model A): mercs now carry HP and take INCIDENTAL
  // damage - enemy arrows that fly through them, and enemy bodies they stand in.
  // Enemies still chase the player, so difficulty barely moves; a merc just dies
  // if you let a fight crowd around it. They travel with you until death.
  const MERC_STATS = {
    blade: { hp: 90, dmg: 16, speed: 175, atkRate: 0.6, range: 46,  color: '#5fa8e0' },
    bow:   { hp: 65, dmg: 12, speed: 160, atkRate: 0.9, range: 300, color: '#7ee0a0' },
  };
  function makeMercFollower(npc, floor) {
    const s = MERC_STATS[npc.cls];
    const maxHp = Math.round(s.hp * (1 + 0.15 * Math.max(0, floor - 1))); // tankier deeper
    return {
      cls: npc.cls, x: g.player.x - 30, y: g.player.y + 30,
      hp: maxHp, maxHp,
      dmg: Math.round(s.dmg * (1 + 0.12 * Math.max(0, floor - 1))), // scales with depth
      speed: s.speed, atkRate: s.atkRate, range: s.range, color: s.color,
      facing: 0, atkCd: 0, swingT: 0, hurtCd: 0, flash: 0,
      side: g.mercs.length === 0 ? -1 : 1, dead: false,
    };
  }
  // a merc soaks a hit; returns true if it just died
  function damageMerc(merc, dmg) {
    if (merc.dead || merc.hurtCd > 0) return false;
    merc.hp -= dmg; merc.hurtCd = 0.4; merc.flash = 0.12;
    Fx.burst(merc.x, merc.y, [merc.color, '#fff'], 5, { speed: 90, life: 0.3 });
    if (merc.hp <= 0) {
      merc.dead = true;
      Sfx.play('hitHeavy');
      Fx.text(merc.x, merc.y - 20, (merc.cls === 'blade' ? 'Blade' : 'Archer') + ' has fallen', '#e07070', 13);
      Fx.burst(merc.x, merc.y, [merc.color, '#e07070', '#fff'], 20, { speed: 160, life: 0.6, glow: true });
      return true;
    }
    Sfx.play('hitLight');
    return false;
  }
  function mercMove(merc, tx, ty, dt, sp) {
    const dx = tx - merc.x, dy = ty - merc.y, d = Math.hypot(dx, dy) || 1;
    merc.x += (dx / d) * sp * dt; merc.y += (dy / d) * sp * dt;
  }
  function updateMercs(dt) {
    const p = g.player;
    for (const merc of g.mercs) {
      if (merc.dead) continue;
      if (merc.swingT > 0) merc.swingT -= dt;
      if (merc.atkCd > 0) merc.atkCd -= dt;
      if (merc.hurtCd > 0) merc.hurtCd -= dt;
      if (merc.flash > 0) merc.flash -= dt;
      // INCIDENTAL contact damage: an enemy body standing on the merc bloodies it
      if (merc.hurtCd <= 0) {
        for (const m of g.monsters) {
          if (m.dead || m.spawnT > 0 || m.airborne) continue;
          if (Math.hypot(m.x - merc.x, m.y - merc.y) < m.r + 12) { damageMerc(merc, m.dmg); break; }
        }
      }
      let target = null, td = 1e9;
      for (const m of g.monsters) {
        if (m.dead || m.spawnT > 0 || m.airborne) continue;
        const d = Math.hypot(m.x - merc.x, m.y - merc.y);
        if (d < td) { td = d; target = m; }
      }
      if (target && td < 320) {
        merc.facing = Math.atan2(target.y - merc.y, target.x - merc.x);
        if (merc.cls === 'blade') {
          if (td > merc.range - 8) mercMove(merc, target.x, target.y, dt, merc.speed);
          if (td <= merc.range && merc.atkCd <= 0) {
            target.takeHit(merc.dmg, { sx: merc.x, sy: merc.y, knock: 90, fromPlayer: true, hitSfx: 'hitLight' }, g);
            merc.atkCd = merc.atkRate; merc.swingT = 0.16; Sfx.play('swing');
          }
        } else {
          if (td < 140) mercMove(merc, merc.x * 2 - target.x, merc.y * 2 - target.y, dt, merc.speed * 0.85);
          else if (td > 240) mercMove(merc, target.x, target.y, dt, merc.speed);
          if (merc.atkCd <= 0) {
            const a = merc.facing;
            g.projectiles.push({
              x: merc.x + Math.cos(a) * 14, y: merc.y + Math.sin(a) * 14,
              vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
              r: 4, dmg: merc.dmg, from: 'player', color: '#cfe8b0', life: 1.4,
              arrow: true, hitSet: new Set(), crit: false,
            });
            merc.atkCd = merc.atkRate; merc.swingT = 0.12; Sfx.play('bowfire');
          }
        }
      } else {
        const fx = p.x + merc.side * 42, fy = p.y + 34;
        if (Math.hypot(fx - merc.x, fy - merc.y) > 30) mercMove(merc, fx, fy, dt, merc.speed);
      }
      merc.x = Math.max(PF.x + 10, Math.min(PF.x + PF.w - 10, merc.x));
      merc.y = Math.max(PF.y + 10, Math.min(PF.y + PF.h - 10, merc.y));
    }
    // clear the fallen so they stop rendering and free their slot
    for (let i = g.mercs.length - 1; i >= 0; i--) if (g.mercs[i].dead) g.mercs.splice(i, 1);
  }
  function drawMerc(c, merc) {
    c.save();
    c.translate(merc.x, merc.y);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(0, 11, 10, 3.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = merc.flash > 0 ? '#ffb0b0' : merc.color;
    c.beginPath(); c.arc(0, 0, 11, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8f0ff';
    c.beginPath(); c.arc(0, -3, 7, 0, Math.PI * 2); c.fill();
    c.save(); c.rotate(merc.facing);
    if (merc.cls === 'blade') {
      c.strokeStyle = '#dfe8f0'; c.lineWidth = 3;
      const reach = merc.swingT > 0 ? 22 : 14;
      c.beginPath(); c.moveTo(8, 0); c.lineTo(8 + reach, 0); c.stroke();
    } else {
      c.strokeStyle = '#8a6b3a'; c.lineWidth = 2.5;
      c.beginPath(); c.arc(12, 0, 8, -Math.PI / 2.2, Math.PI / 2.2); c.stroke();
    }
    c.restore();
    c.fillStyle = merc.color; // friendly chevron
    c.beginPath(); c.moveTo(0, -18); c.lineTo(-4, -14); c.lineTo(4, -14); c.closePath(); c.fill();
    // HP bar over the head (mercs are mortal now)
    if (merc.maxHp) {
      const bw = 24, k = Math.max(0, merc.hp / merc.maxHp);
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(-bw / 2 - 1, -27, bw + 2, 4);
      c.fillStyle = k > 0.35 ? '#7ee0a0' : '#e07070'; c.fillRect(-bw / 2, -26, bw * k, 2);
    }
    c.restore();
  }
  function drawMercNPC(c, npc) {
    const s = MERC_STATS[npc.cls];
    const bob = Math.sin(g.time * 2) * 2;
    c.save();
    c.translate(npc.x, npc.y + bob);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(0, 12 - bob, 11, 3.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = s.color;
    c.beginPath(); c.arc(0, 0, 12, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8f0ff';
    c.beginPath(); c.arc(0, -3, 7.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#223';
    c.beginPath(); c.arc(-2.5, -3, 1.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(2.5, -3, 1.4, 0, Math.PI * 2); c.fill();
    c.restore();
    c.font = 'bold 11px monospace'; c.textAlign = 'center';
    c.fillStyle = s.color;
    c.fillText((npc.cls === 'blade' ? 'BLADE' : 'ARCHER') + ' FOR HIRE', npc.x, npc.y - 26);
  }

  // a dormant pet standing in a room: a soft glowing critter with a little Zzz
  // idle sway, waiting for E to wake it.
  function drawPetNPC(c, pet) {
    const bob = Math.sin(g.time * 2 + (pet.bob || 0)) * 2.5;
    c.save();
    c.translate(pet.x, pet.y + bob);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(0, 11 - bob, 9, 3, 0, 0, Math.PI * 2); c.fill();
    c.shadowColor = pet.color; c.shadowBlur = 12;
    c.fillStyle = pet.color;
    c.beginPath(); c.arc(0, 0, 8, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(-2.6, -1, 2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(2.6, -1, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#111';
    c.beginPath(); c.arc(-2.6, -1, 1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(2.6, -1, 1, 0, Math.PI * 2); c.fill();
    c.restore();
    c.font = 'bold 11px monospace'; c.textAlign = 'center';
    c.fillStyle = pet.color;
    c.fillText(pet.name.toUpperCase(), pet.x, pet.y - 22);
  }

  // ============================ UPDATE ============================
  let last = 0;
  function tick(dt) {
    g.time += dt;
    update(dt);
    draw();
    if (g.preserveInput) g.preserveInput = false; // hit-stop frame: keep buffered input
    else { input.just.clear(); input.mouse.clicked = false; input.mouse.moved = false; }
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
      input.mouse.moved = false;
    }
    requestAnimationFrame(frame);
  }

  function update(dt) {
    // global keys
    if (input.pressed('KeyM')) Sfx.toggleMute();

    switch (g.state) {
      case 'title': updateTitle(); break;
      case 'lobby': updateLobby(); break;
      case 'play': updatePlay(dt); break;
      case 'levelup': g.overlayT += dt; updateLevelUp(); break;
      case 'evolution': g.overlayT += dt; updateEvolution(); break;
      case 'ultpick': g.overlayT += dt; updateUltPick(); break;
      case 'levelwait': g.overlayT += dt; updateLevelWait(dt); break;
      case 'pause':
        g.overlayT += dt;
        if (input.pressed('KeyP') || input.pressed('Escape')) g.state = 'play';
        else if (input.mouse.clicked) {
          for (const r of g.uiRects) {
            if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h && r.action === 'menu') quitToTitle();
          }
        }
        break;
      case 'charsheet':
        g.overlayT += dt;
        if (input.pressed('KeyC') || input.pressed('Escape') || input.pressed('KeyP')) g.state = 'play';
        break;
      case 'transition': updateTransition(dt); break;
      case 'bossintro': updateBossIntro(dt); break;
      case 'dead': case 'win': g.overlayT += dt; updateEnd(); break;
      case 'initials': g.overlayT += dt; updateInitials(); break;
    }
    Fx.update(dt);
  }

  function updateTitle() {
    if (g.shareMsg && g.shareMsg.t > 0) g.shareMsg.t -= 1 / 60;
    if (g.showPatch) {
      // patch-notes overlay: any click or Esc closes it (and marks this version seen)
      if (input.mouse.clicked || input.pressed('Escape')) { g.showPatch = false; markVersionSeen(); }
      return;
    }
    if (g.showScores) {
      // scoreboard overlay: any click or Esc closes it
      if (input.mouse.clicked || input.pressed('Escape')) g.showScores = false;
      return;
    }
    if (g.showMythics) {
      // #38 mythic gallery: any click or Esc closes it
      if (input.mouse.clicked || input.pressed('Escape')) g.showMythics = false;
      return;
    }
    if (input.pressed('Enter')) { newRun(); return; }
    if (input.mouse.clicked) {
      for (const r of g.uiRects) {
        if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
          if (r.action === 'start') { newRun(); return; }
          if (r.action === 'coop') { openLobby(); return; }
          if (r.action === 'upgrade') buyMetaUpgrade(r.key);
          if (r.action === 'share') shareGame();
          if (r.action === 'scores') { g.showScores = true; Sfx.play('ui'); }
          if (r.action === 'patchnotes') { g.showPatch = true; Sfx.play('ui'); }
          if (r.action === 'mythics') { g.showMythics = true; Sfx.play('ui'); }
          if (r.action === 'selectPet') { // toggle the stable pet chosen for the next run
            g.meta.selectedPet = g.meta.selectedPet === r.key ? '' : r.key;
            saveMeta(); Sfx.play('ui');
          }
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
    const cost = UI.metaCost(u, rank);              // null once a capped upgrade is maxed
    if (cost === null) { Sfx.play('error'); return; }
    if (g.meta.essence < cost) { Sfx.play('error'); return; }
    g.meta.essence -= cost;
    g.meta.ranks[key] = rank + 1;
    saveMeta();
    Sfx.play('upgrade');
  }

  // ============================ CO-OP (multiplayer) ============================
  // Milestone 2: lobby + real-time player presence. Each client runs its own
  // game; positions are broadcast through the relay and remote players are drawn
  // when they share your room (everyone spawns in the start room, so you meet
  // there immediately). Shared dungeon + enemies land in M3/M4.
  function setupNet() {
    if (g.netReady || typeof Net === 'undefined') return;
    g.netReady = true;
    Net.on('p', m => {
      let rp = g.remotePlayers.get(m.from);
      if (!rp) { rp = { x: m.x, y: m.y }; g.remotePlayers.set(m.from, rp); }
      rp.tx = m.x; rp.ty = m.y;
      if (rp.x === undefined) { rp.x = m.x; rp.y = m.y; }
      rp.facing = m.f; rp.room = m.r; rp.hp = m.hp; rp.maxHp = m.mh; rp.wc = m.wc; rp.name = (m.nm && m.nm.trim()) || m.from;
      rp.downed = !!m.dd; // P1-C: render peers as downed + gate revive/wipe
      rp.last = g.time;
    });
    Net.on('start', m => { if (!Net.isHost) startCoop(m.seed); });
    // P1-C: downed / revive / party-wipe game-over
    Net.on('downed', m => { const rp = g.remotePlayers.get(m.id); if (rp) rp.downed = true; dropFromLevelGate(m.id); });
    Net.on('revive', m => { if (m.id === Net.id && g.player && g.player.dead) reviveLocal(); });
    Net.on('gameover', m => { if (g.coop) coopGameOver(m); });
    // host -> guests: authoritative monster snapshot (guests render proxies)
    Net.on('mobs', m => { if (isCoopGuest()) applyMobSnapshot(m.list); });
    // co-op: the guest levels off the host's shared kills
    Net.on('xp', m => { if (isCoopGuest() && g.player) g.player.addXp(m.a, g); });
    // PR-2: the host tells a peer it got hit by a monster/boss (peer self-filters on its id).
    // A player mid-pick (level-up / evolution / ultimate / gate) is frozen and can't
    // dodge, so it's shielded from damage until it resumes - no dying on the menu.
    Net.on('phit', m => {
      if (m.to !== Net.id || !g.player || g.player.dead) return;
      if (g.state === 'levelup' || g.state === 'evolution' || g.state === 'ultpick' || g.state === 'levelwait') return;
      g.player.damage(m.dmg, m.sx, m.sy, g);
    });
    // P1-B: enemy projectile from the host - guest spawns a real from:'enemy' bolt it can be
    // hit by / dodge (updateProjectiles resolves the damage vs the local player)
    Net.on('proj', m => { if (isCoopGuest()) g.projectiles.push({ x: m.x, y: m.y, vx: m.vx, vy: m.vy, r: m.r, dmg: m.dmg, from: 'enemy', color: m.c, life: 3, glow: !!m.gl, hitSet: null }); });
    // P1-B: AoE blast visual (damage already arrived via phit); guest plays the boom
    Net.on('boom', m => { if (isCoopGuest()) { Fx.shake(9, 0.3); Sfx.play('explode'); Fx.burst(m.x, m.y, ['#ff8833', '#ffcc44', '#ff4422', '#888'], 28, { speed: 260, life: 0.6, glow: true }); } });
    // P1-D: currency drop mirrored from the host -> guest's own instance (own wallet)
    Net.on('pk', m => { if (isCoopGuest()) spawnPickup(m.k, m.x, m.y); });
    // #32: GEAR drop mirrored from the host -> guest's OWN instanced copy on the
    // ground, so player 2/3 can walk over + grab stronger weapons/armor of their own
    Net.on('gear', m => {
      if (!isCoopGuest()) return;
      const pk = { kind: m.kind, x: m.x, y: m.y, t: 0 };
      if (m.kind === 'weapon') pk.weapon = m.item; else pk.armor = m.item;
      g.pickups.push(pk);
      Fx.text(m.x, m.y - 24, 'LOOT', m.item && m.item.color || '#ffd24c', 12);
    });
    // P1-D: room cleared on the host -> guest vacuums its coins + unseals its doors
    Net.on('roomclear', m => {
      if (!isCoopGuest() || !g.dungeon) return;
      const room = g.dungeon.rooms.find(r => r.gx === m.gx && r.gy === m.gy);
      if (room) room.cleared = true;
      if (g.room && g.room.gx === m.gx && g.room.gy === m.gy) {
        vacuumPickups(); Sfx.play('unlock'); Fx.text(W / 2, H / 2 - 60, 'ROOM CLEARED', '#6ee7a0', 18);
      }
    });
    // co-op: play a peer's attack visual so you can SEE them fighting
    Net.on('atk', m => { if (g.coop) playPeerAttack(m); });
    // #32 gate: a teammate opened a pick cycle (busy) / closed one (done). Monotonic
    // counters, so ordering and duplicate-free delivery keep busy/done exactly paired.
    Net.on('lvlbusy', m => { if (g.coop) g.peerBusy[m.from] = (g.peerBusy[m.from] || 0) + 1; });
    Net.on('lvldone', m => {
      if (!g.coop) return;
      g.peerDone[m.from] = (g.peerDone[m.from] || 0) + 1;
      if (g.state === 'levelwait' && g.levelWaitT > 0.35 && partyLevelReady()) releaseLevelGate();
    });
    // P1-E: the guest builds the REAL King via Boss.make (crown/jaw art), sets g.boss
    // for the health bar, and copies the per-tick fields each snapshot
    Net.on('boss', m => {
      if (!isCoopGuest()) return;
      let b = g.boss;
      if (!b || !b.proxy || b.netId !== m.i) {
        if (b && b.proxy) { const i = g.monsters.indexOf(b); if (i >= 0) g.monsters.splice(i, 1); }
        const opts = m.db ? { descent: { name: m.name, pal: m.pal, anger: m.an, hpMul: 1, dmgMul: 1 } } : undefined;
        b = Boss.make(opts);
        b.proxy = true; b.netId = m.i; b.dm = m.dm;
        b.update = function () { this.t += 1 / 60; if (this.flash > 0) this.flash -= 1 / 60; };
        b.takeHit = function (dmg, o) { return forwardHit(this, dmg, o); };
        g.boss = b;
        if (!g.monsters.includes(b)) g.monsters.push(b);
      }
      b.x = m.x; b.y = m.y; b.facing = m.f; b.hp = m.hp; b.maxHp = m.mh; b.dm = m.dm;
      b.state = m.st; b.telegraph = m.tg || 0; b.jaw = m.jaw; b.hop = m.hop; b.shadowX = m.sx; b.shadowY = m.sy; b.dead = false;
    });
    // P1-E: boss victory - clear it, play the death + Toad line; floor advance follows {t:'floor'}
    Net.on('bossDead', m => {
      if (!isCoopGuest()) return;
      if (g.boss) { const i = g.monsters.indexOf(g.boss); if (i >= 0) g.monsters.splice(i, 1); g.boss = null; }
      Fx.shake(10, 0.5); Sfx.play('roar');
      Fx.burst(m.x, m.y, ['#ffd24c', '#fff', '#ff6655'], 40, { speed: 260, life: 0.9, glow: true });
      if (m.king) g.kingSlain = true;
      g.winTimer = 2.6;
      if (typeof Descent !== 'undefined' && m.toad !== undefined) g.toadMsg = { text: Descent.toadLine(m.toad), t: 4 };
    });
    // guest -> host: "I hit monster <i> for <dmg>" (host is the source of truth)
    Net.on('hit', m => {
      if (g.coop && Net.isHost) {
        const mon = g.monsters.find(x => x.netId === m.i && !x.dead);
        if (mon) mon.takeHit(m.dmg, { sx: m.sx, sy: m.sy, knock: m.k || 0, flame: m.fl, chill: m.ch, venom: m.vn, crit: m.cr, fromPlayer: true, hitSfx: m.hs }, g);
      }
    });
    // tethered party: a peer moved through a door - everyone follows to that room
    Net.on('room', m => { if (g.coop && g.dungeon) coopEnterRoom(m.gx, m.gy, m.dir, false); });
    // host advanced the floor - regenerate the shared floor and follow (a floor change
    // trumps any pending level-up gate: clear it so nothing is left stranded)
    Net.on('floor', m => { if (g.coop) { releaseLevelGate(); g.leveling = false; g.floorNum = m.floor; g.coopSeed = m.seed; startFloor(); g.state = 'play'; } });
    Net.on('peer-leave', m => { g.remotePlayers.delete(m.id); dropFromLevelGate(m.id); });
    Net.onLifecycle('close', () => { if (g.lobby && g.lobby.mode === 'join') g.lobby.status = 'disconnected'; });
    Net.onLifecycle('error', () => { if (g.lobby) g.lobby.status = 'connection failed'; });
  }

  function openLobby() {
    setupNet();
    g.lobby = { mode: 'menu', entry: '', status: '' };
    g.state = 'lobby';
    Sfx.play('ui');
  }
  function saveName() { try { localStorage.setItem('drl_name', g.playerName || ''); } catch { } }

  function closeLobby() {
    if (typeof Net !== 'undefined') Net.disconnect();
    g.remotePlayers.clear();
    g.lobby = null;
    g.state = 'title';
    Sfx.play('ui');
  }

  function startCoop(seed) {
    g.coopSeed = (seed !== undefined && seed !== null) ? seed : (Math.random() * 1e9) | 0;
    g.remotePlayers.clear();
    g.lobby = null;
    newRun(true);
  }

  // co-op room change: move to room (gx,gy). If `initiator`, tell everyone else.
  function coopEnterRoom(gx, gy, dir, initiator) {
    const room = g.dungeon.rooms.find(r => r.gx === gx && r.gy === gy);
    if (!room || room === g.room) return;
    // #32: don't yank a player out of a level-up/evolution/ultimate/gate overlay
    // (that would discard their in-progress pick). Defer the follow until they resume.
    if (!initiator && (g.state === 'levelup' || g.state === 'evolution' || g.state === 'ultpick' || g.state === 'levelwait')) {
      g.pendingCoopRoom = { gx, gy, dir };
      return;
    }
    enterRoom(room, dir);
    if (initiator) Net.send({ t: 'room', gx, gy, dir });
  }

  function updateLobby() {
    const lb = g.lobby;
    if (input.pressed('Escape')) { closeLobby(); return; }
    // #29: type your character name on the menu screen (persists in localStorage)
    if (lb.mode === 'menu' || !lb.mode) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      for (const ch of chars) {
        const code = (ch >= '0' && ch <= '9') ? 'Digit' + ch : 'Key' + ch;
        if (input.pressed(code) && (g.playerName || '').length < 12) { g.playerName = (g.playerName || '') + ch; saveName(); Sfx.play('ui'); }
      }
      if (input.pressed('Space') && (g.playerName || '').length < 12) { g.playerName += ' '; saveName(); }
      if (input.pressed('Backspace') && (g.playerName || '').length) { g.playerName = g.playerName.slice(0, -1); saveName(); }
    }
    // code entry while joining
    if (lb.mode === 'join' && !Net.connected) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      for (const ch of chars) {
        const code = (ch >= '0' && ch <= '9') ? 'Digit' + ch : 'Key' + ch;
        if (input.pressed(code) && lb.entry.length < 4) { lb.entry += ch; Sfx.play('ui'); }
      }
      if (input.pressed('Backspace') && lb.entry.length) lb.entry = lb.entry.slice(0, -1);
      if (input.pressed('Enter') && lb.entry.length === 4) { Net.join(lb.entry); lb.status = 'connecting...'; }
    }
    if (input.mouse.clicked) {
      for (const r of g.uiRects) {
        if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
          if (r.action === 'lobby-host') { Net.host(); lb.mode = 'host'; Sfx.play('ui'); }
          if (r.action === 'lobby-join') { lb.mode = 'join'; lb.entry = ''; lb.status = ''; Sfx.play('ui'); }
          if (r.action === 'lobby-start') { // host picks the shared run seed
            const seed = (Math.random() * 1e9) | 0;
            Net.send({ t: 'start', seed }); startCoop(seed); return;
          }
          if (r.action === 'lobby-back') { closeLobby(); return; }
        }
      }
    }
  }

  // broadcast our player state to the room (throttled ~15 Hz)
  function broadcastSelf(dt) {
    if (!g.coop || typeof Net === 'undefined' || !Net.connected) return;
    g.posSendT -= dt;
    if (g.posSendT > 0) return;
    g.posSendT = 0.066;
    const p = g.player;
    Net.send({
      t: 'p', x: Math.round(p.x), y: Math.round(p.y), f: +p.facing.toFixed(2),
      r: [g.room.gx, g.room.gy], hp: Math.round(p.hp), mh: Math.round(p.maxHp),
      wc: p.weapon ? p.weapon.color : '#9ee7ff', dd: p.downed ? 1 : 0,
      nm: g.playerName || '',
    });
  }

  // smooth remote players toward their last reported position
  function interpRemotes(dt) {
    const k = Math.min(1, dt * 12);
    for (const rp of g.remotePlayers.values()) {
      if (rp.tx !== undefined) { rp.x += (rp.tx - rp.x) * k; rp.y += (rp.ty - rp.y) * k; }
      if (rp.swing) { rp.swing.t += dt; if (rp.swing.t >= rp.swing.dur) rp.swing = null; }
    }
  }

  // draw the other players who share your current room
  function drawRemotePlayers(c) {
    for (const [id, rp] of g.remotePlayers) {
      if (g.time - (rp.last || 0) > 3) continue;                       // gone quiet
      if (!rp.room || rp.room[0] !== g.room.gx || rp.room[1] !== g.room.gy) continue; // elsewhere
      if (rp.downed) { // P1-C: a revivable teammate - stand on them to bring them back
        c.save(); c.translate(rp.x, rp.y);
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(0, 6, 15, 5, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#3a3f4d'; c.beginPath(); c.ellipse(0, 2, 15, 9, 0, 0, Math.PI * 2); c.fill();
        c.restore();
        const t = Date.now() / 300;
        c.strokeStyle = `rgba(127,212,255,${0.4 + Math.sin(t) * 0.2})`; c.lineWidth = 2;
        c.beginPath(); c.arc(rp.x, rp.y, 20 + Math.sin(t) * 3, 0, Math.PI * 2); c.stroke();
        c.textAlign = 'center'; c.font = 'bold 10px monospace'; c.fillStyle = '#7fd4ff';
        c.fillText('DOWNED', rp.x, rp.y - 24);
        continue;
      }
      if (rp.swing) drawPeerSwing(c, rp);
      c.save();
      c.translate(rp.x, rp.y);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.ellipse(0, 11, 11, 3.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2c3e60'; c.beginPath(); c.arc(0, 2, 13, 0, Math.PI * 2); c.fill();
      c.fillStyle = rp.wc || '#4a6fa5'; c.beginPath(); c.arc(0, -2, 11, 0, Math.PI * 2); c.fill();
      c.save(); c.rotate(rp.facing || 0);
      c.fillStyle = '#0e1420'; c.fillRect(2, -4, 10, 8);
      c.fillStyle = '#9ee7ff'; c.fillRect(4, -2.5, 7, 5);
      c.restore();
      c.restore();
      c.textAlign = 'center';
      c.fillStyle = '#7fd4ff'; c.font = 'bold 10px monospace';
      c.fillText(rp.name || id, rp.x, rp.y - 22);
      if (rp.maxHp) {
        const bw = 26, kk = Math.max(0, (rp.hp || 0) / rp.maxHp);
        c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(rp.x - bw / 2 - 1, rp.y - 19, bw + 2, 4);
        c.fillStyle = '#7ee0a0'; c.fillRect(rp.x - bw / 2, rp.y - 18, bw * kk, 2);
      }
    }
  }

  // #32: the "waiting for your party" banner while the gate holds you
  function drawLevelWait(c) {
    c.save();
    c.fillStyle = 'rgba(5,8,16,0.55)';
    c.fillRect(0, H / 2 - 54, W, 108);
    c.textAlign = 'center';
    c.font = 'bold 22px monospace'; c.fillStyle = '#ffd24c';
    c.fillText('LEVEL UP COMPLETE', W / 2, H / 2 - 14);
    let picking = 0;
    for (const id in g.peerBusy) if ((g.peerBusy[id] || 0) > (g.peerDone[id] || 0)) picking++;
    c.font = '14px monospace'; c.fillStyle = '#cdd4e2';
    c.fillText(picking > 0 ? `waiting for ${picking} teammate${picking > 1 ? 's' : ''} to choose` : 'syncing with your party', W / 2, H / 2 + 14);
    // three dots pulsing so it never looks frozen
    const dots = 1 + (Math.floor(Date.now() / 400) % 3);
    c.fillStyle = '#7fd4ff';
    c.fillText('.'.repeat(dots), W / 2, H / 2 + 38);
    c.restore();
  }

  // a networked teammate's melee swing: the arc-sweep sweep (no windup phase, we
  // receive it at release), mirrors the local player's drawWeapon release visual
  function drawPeerSwing(c, rp) {
    const s = rp.swing;
    const k = Math.min(1, s.t / s.dur);
    const a0 = s.dir - s.arc / 2, a1 = s.dir - s.arc / 2 + s.arc * Math.min(1, k * 1.5);
    c.save();
    c.translate(rp.x, rp.y);
    const grad = c.createRadialGradient(0, 0, 6, 0, 0, s.range);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.7, `rgba(255,255,255,${0.35 * (1 - k)})`);
    grad.addColorStop(1, s.color + '00');
    c.fillStyle = grad;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, s.range, a0, a1); c.closePath(); c.fill();
    c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; c.lineWidth = s.heavy ? 5 : 3;
    c.beginPath(); c.arc(0, 0, s.range * 0.9, a0, a1); c.stroke();
    c.globalAlpha = 0.85 * (1 - k); c.strokeStyle = s.color; c.lineWidth = (s.heavy ? 3 : 2) + (s.rarIdx || 0);
    c.beginPath(); c.arc(0, 0, s.range * 0.99, a0, a1); c.stroke();
    c.globalAlpha = 1;
    c.restore();
  }

  // --- M4: host-authoritative monsters, guest renders + damages proxies -----
  function isCoopGuest() { return g.coop && typeof Net !== 'undefined' && !Net.isHost; }
  function coopPlayers() { return (g.coop && typeof Net !== 'undefined') ? Math.max(2, Net.playerCount) : 1; }

  // PR-1: everyone the monsters may target. Always the local player; on the host,
  // also every remote peer sharing this room (so enemies chase BOTH players).
  function partyTargets() {
    const P = g.player;
    const list = [{ x: P.x, y: P.y, r: P.r, ref: P, isRemote: false, id: 'me' }];
    if (g.coop && typeof Net !== 'undefined' && Net.isHost && g.room) {
      for (const [id, rp] of g.remotePlayers) {
        if (g.time - (rp.last || 0) > 3 || rp.dead) continue;
        if (!rp.room || rp.room[0] !== g.room.gx || rp.room[1] !== g.room.gy) continue;
        list.push({ x: rp.x, y: rp.y, r: 13, ref: rp, isRemote: true, id });
      }
    }
    return list;
  }
  // PR-2: deal damage to a party target - the local player directly, a remote peer
  // over the wire ({t:'phit'} that the peer self-filters on Net.id).
  function hurtTarget(target, dmg, sx, sy, src) {
    if (!target || !target.isRemote) { if (g.player && !g.player.dead) g.player.damage(dmg, sx, sy, g, src); return; }
    if (typeof Net !== 'undefined') Net.send({ t: 'phit', to: target.id, dmg: Math.round(dmg), sx: Math.round(sx || 0), sy: Math.round(sy || 0) });
  }
  g.partyTargets = partyTargets;
  g.hurtTarget = hurtTarget;

  // P1-C: DOWNED / REVIVE / party-wipe -----------------------------------------
  function goDowned() {
    const p = g.player; // p.dead already true
    p.downed = true;
    Fx.text(p.x, p.y - 40, 'DOWNED - hold on!', '#7fd4ff', 15);
    Sfx.play('hurt');
    if (typeof Net !== 'undefined') Net.send({ t: 'downed', id: Net.id });
    // #32: if we're downed with a level cycle still open, forfeit it so a waiting
    // teammate isn't stranded on the gate (our picks resume when we're revived)
    if (g.leveling) { g.leveling = false; if (typeof Net !== 'undefined' && Net.connected) Net.send({ t: 'lvldone' }); }
  }
  function reviveLocal() {
    const p = g.player;
    p.dead = false; p.downed = false;
    p.hp = Math.max(1, Math.round(p.maxHp * 0.3));
    p.iframes = 1.6;
    Sfx.play('levelup');
    Fx.text(p.x, p.y - 34, 'REVIVED', '#6ee7a0', 16);
    Fx.burst(p.x, p.y, ['#6ee7a0', '#fff'], 30, { speed: 240, life: 0.8, glow: true });
  }
  // a LIVING player standing on a downed peer for ~3s revives them
  function reviveNearbyDowned(dt) {
    const p = g.player;
    if (p.dead) return; // the downed can't revive
    for (const [id, rp] of g.remotePlayers) {
      if (!rp.downed || !rp.room || rp.room[0] !== g.room.gx || rp.room[1] !== g.room.gy) { rp.reviveT = 0; continue; }
      if (Math.hypot(rp.x - p.x, rp.y - p.y) < 46) {
        rp.reviveT = (rp.reviveT || 0) + dt;
        Fx.burst(rp.x, rp.y, ['#7fd4ff'], 1, { speed: 20, life: 0.3 });
        if (rp.reviveT >= 3) { rp.reviveT = 0; rp.downed = false; Net.send({ t: 'revive', id }); Fx.text(rp.x, rp.y - 30, 'REVIVED!', '#6ee7a0', 14); }
      } else rp.reviveT = 0;
    }
  }
  // host: end the run only when EVERYONE is down
  function checkPartyWipe() {
    if (!Net.isHost || g.runEnded) return;
    // a peer is only "down" if we've been TOLD so ({t:'downed'} / dd flag). A present
    // but lagging peer counts as ALIVE - never false-wipe on a network hiccup. Peers
    // that truly leave are removed from remotePlayers by {t:'peer-leave'}.
    let anyAlive = !g.player.dead;
    for (const rp of g.remotePlayers.values()) if (!rp.downed) anyAlive = true;
    if (anyAlive) return;
    g.runEnded = true;
    const fromCoins = Math.floor(g.player.coins * 0.10);
    g.essenceEarned = g.player.essenceRun + fromCoins;
    g.meta.essence += (g.player.essenceRun - g.essenceCheckpoint) + fromCoins;
    saveMeta();
    Net.send({ t: 'gameover', floor: g.floorNum, king: g.kingSlain ? 1 : 0 });
    endToScreen('dead');
  }
  function coopGameOver(m) {
    if (g.runEnded) return;
    g.runEnded = true;
    const fromCoins = Math.floor(g.player.coins * 0.10);
    g.essenceEarned = g.player.essenceRun + fromCoins;
    g.meta.essence += (g.player.essenceRun - g.essenceCheckpoint) + fromCoins;
    saveMeta();
    if (m && m.king) g.kingSlain = true;
    endToScreen('dead');
  }

  // M5: scale a freshly-spawned monster set up for the party (Sam: at least 2x).
  // HP scales with head-count; damage a little; and extra bodies join the fight.
  function coopScaleMonsters(mons) {
    if (!g.coop) return;
    const n = coopPlayers();
    // #28: a full party was near-unkillable. Enemies now HIT much harder per extra
    // player (+55% each, was +25%) and hit a touch faster, on top of the hp bump, so
    // co-op is a real threat instead of a health-sponge cakewalk.
    const hpMul = 1 + 0.9 * (n - 1);        // 2p ~1.9x, 3p ~2.8x
    const dmgMul = 1 + 0.55 * (n - 1);      // 2p 1.55x, 3p 2.1x
    const spdMul = 1 + 0.06 * (n - 1);
    for (const m of mons) {
      m.hp = Math.round(m.hp * hpMul); m.maxHp = Math.round(m.maxHp * hpMul);
      if (m.dmg) m.dmg = Math.round(m.dmg * dmgMul);
      if (m.speed) m.speed = m.speed * spdMul;
    }
  }

  // host: broadcast a compact snapshot of every monster (~15 Hz)
  function broadcastMobs(dt) {
    if (!g.coop || typeof Net === 'undefined' || !Net.isHost || !Net.connected) return;
    g.mobSendT -= dt;
    if (g.mobSendT > 0) return;
    g.mobSendT = 0.066;
    const list = [];
    for (const m of g.monsters) {
      if (m.dead || m.isBoss) continue; // the boss syncs via its own {t:'boss'} (extra draw fields)
      if (!m.netId && !m.proxy) m.netId = ++g.netMobId; // PR-3: stamp runtime spawns (summoner adds, woken mimics, boss babies)
      if (!m.netId) continue;
      list.push({ i: m.netId, ty: m.type, x: Math.round(m.x), y: Math.round(m.y), f: +(m.facing || 0).toFixed(2),
                  hp: Math.round(m.hp), mh: Math.round(m.maxHp), r: Math.round(m.r),
                  dm: m.dmg || 8, s: m.spawnT > 0 ? 1 : 0, el: m.elite ? 1 : 0,
                  // PR-4: state fields so the real per-type draw animates telegraphs/windups/fuse on the guest
                  st: m.state, tg: +(m.telegraph || 0).toFixed(2), lg: m.lungeAngle !== undefined ? +m.lungeAngle.toFixed(2) : undefined, fu: m.fuse });
    }
    Net.send({ t: 'mobs', list });
    // P1-E: the boss rides its own message (crown/jaw/hop/shadow draw fields)
    const b = g.boss;
    if (b && !b.dead && b.netId) {
      Net.send({ t: 'boss', i: b.netId, name: b.name, pal: b.pal, an: b.anger || 0, db: b.isDescentBoss ? 1 : 0, dm: b.dmg || 16,
        x: Math.round(b.x), y: Math.round(b.y), f: +(b.facing || 0).toFixed(2), hp: Math.round(b.hp), mh: Math.round(b.maxHp),
        st: b.state, tg: +(b.telegraph || 0).toFixed(2), jaw: Math.round(b.jaw || 0), hop: Math.round(b.hop || 0),
        sx: Math.round(b.shadowX || 0), sy: Math.round(b.shadowY || 0) });
    }
  }

  // guest: reconcile local proxies against the host's snapshot
  function applyMobSnapshot(list) {
    const seen = new Set();
    for (const s of list) {
      seen.add(s.i);
      let m = g.monsters.find(x => x.netId === s.i);
      if (!m) { m = makeMobProxy(s); g.monsters.push(m); }
      m.tx = s.x; m.ty = s.y; if (m.x === undefined) { m.x = s.x; m.y = s.y; }
      m.facing = s.f; m.hp = s.hp; m.maxHp = s.mh; m.r = s.r; m.dm = s.dm;
      m.spawnT = s.s ? 0.1 : 0;
      // PR-4: mirror the AI-state fields the per-type draw reads for telegraphs/windups/fuse
      if (s.st !== undefined) m.state = s.st;
      m.telegraph = s.tg || 0;
      if (s.lg !== undefined) m.lungeAngle = s.lg;
      if (s.fu !== undefined) m.fuse = s.fu;
    }
    for (let i = g.monsters.length - 1; i >= 0; i--) {
      const m = g.monsters[i];
      // the boss lives in {t:'boss'}, not {t:'mobs'} - don't cull it here
      if (m.proxy && !m.isBoss && !seen.has(m.netId)) { m.dead = true; g.monsters.splice(i, 1); }
    }
  }

  // the guest's stand-in for a host monster. We build a REAL Monsters object so it
  // draws with the correct per-type art (chaser/archer/tank/... look like themselves),
  // then override AI (positioned by snapshots) and takeHit (forward to the host).
  function forwardHit(mon, dmg, opts) {
    if (mon.dead) return false;
    Net.send({ t: 'hit', i: mon.netId, dmg: Math.round(dmg),
      sx: Math.round((opts && opts.sx) || mon.x), sy: Math.round((opts && opts.sy) || mon.y),
      k: opts && opts.knock, fl: opts && opts.flame, ch: opts && opts.chill, vn: opts && opts.venom,
      cr: opts && opts.crit ? 1 : 0, hs: opts && opts.hitSfx });
    mon.flash = 0.12;
    Fx.text(mon.x + (Math.random() * 16 - 8), mon.y - mon.r - 6, Math.round(dmg), opts && opts.crit ? '#ffd24c' : '#fff', opts && opts.crit ? 16 : 12);
    Fx.burst(mon.x, mon.y, opts && opts.crit ? '#ffd24c' : '#ff6655', 5, { speed: 110, life: 0.35 });
    return true; // let the attacker earn frenzy/lifesteal locally
  }
  function makeMobProxy(s) {
    let m;
    const known = typeof Monsters !== 'undefined' && Monsters.BASE && Monsters.BASE[s.ty];
    if (known) {
      m = Monsters.make(s.ty, s.x, s.y, 1);   // real monster -> real art
      m.spawnT = 0;
    } else {
      // boss / unknown type: fall back to a simple menacing circle
      m = { type: s.ty || 'mob', x: s.x, y: s.y, r: s.r, facing: s.f || 0, kvx: 0, kvy: 0, contactCd: 0, isBoss: true,
        draw(c) {
          c.save(); c.translate(this.x, this.y);
          c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(0, this.r * 0.7, this.r, this.r * 0.32, 0, 0, Math.PI * 2); c.fill();
          c.fillStyle = this.flash > 0 ? '#fff' : '#a03050'; c.beginPath(); c.arc(0, 0, this.r, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#2a0f18'; c.beginPath(); c.arc(this.r * 0.35, -this.r * 0.2, this.r * 0.14, 0, Math.PI * 2); c.arc(this.r * 0.35, this.r * 0.2, this.r * 0.14, 0, Math.PI * 2); c.fill();
          c.restore();
          if (this.hp < this.maxHp) { const bw = this.r * 2, k = Math.max(0, this.hp / this.maxHp);
            c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(this.x - bw / 2 - 1, this.y - this.r - 10, bw + 2, 5);
            c.fillStyle = '#e05555'; c.fillRect(this.x - bw / 2, this.y - this.r - 9, bw * k, 3); }
        },
      };
    }
    m.proxy = true; m.netId = s.i; m.dead = false; m.airborne = false;
    m.hp = s.hp; m.maxHp = s.mh; m.r = s.r; m.facing = s.f || 0; m.dm = s.dm || 8;
    m.tx = s.x; m.ty = s.y; m.flash = m.flash || 0; m.t = m.t || 0;
    m.update = function () { this.t += 1 / 60; if (this.flash > 0) this.flash -= 1 / 60; }; // no AI
    m.takeHit = function (dmg, opts) { return forwardHit(this, dmg, opts); };
    return m;
  }

  // play a PEER's attack as a visual (damage stays host-authoritative via mob sync)
  function playPeerAttack(m) {
    if (m.k === 'm') {
      // attach a swing to the sender so drawRemotePlayers renders the actual arc
      // sweep (not just a spark trail) - you can now SEE a teammate's blade land
      const rp = g.remotePlayers.get(m.from);
      if (rp) rp.swing = { t: 0, dur: 0.22, dir: m.d, arc: m.a, range: m.r, color: m.c || '#dfe8f0', rarIdx: m.ri || 0, heavy: !!m.hv };
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const a = m.d - m.a / 2 + m.a * (i / n);
        Fx.burst(m.x + Math.cos(a) * m.r * 0.85, m.y + Math.sin(a) * m.r * 0.85, [m.c || '#dfe8f0', '#fff'], 1, { speed: 55, life: 0.3, glow: true, size: 2.5 });
      }
      Sfx.play('swing');
    } else if (m.k === 'b') {
      // visual-only arrow: from:'remote' so updateProjectiles never applies damage
      g.projectiles.push({ from: 'remote', x: m.x, y: m.y, vx: m.vx, vy: m.vy, r: 4, color: m.c || '#e8e3d0', life: 1.4, arrow: true, hitSet: new Set() });
      Sfx.play('bowfire');
    }
  }

  // guest: smooth proxies toward their reported position + take contact damage
  function updateGuestMobs(dt) {
    const p = g.player, k = Math.min(1, dt * 14);
    for (const m of g.monsters) {
      if (!m.proxy) continue;
      if (m.tx !== undefined) { m.x += (m.tx - m.x) * k; m.y += (m.ty - m.y) * k; }
      // P1-A: guest no longer self-damages from contact - the HOST's AI now targets
      // the guest and deals damage authoritatively via {t:'phit'} (no double-count).
    }
  }

  function updatePlay(dt) {
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      g.state = 'pause'; g.overlayT = 0;
      g.player.drawT = -1; // a held bow draw must not survive pause and fire on resume
      return;
    }
    if (input.pressed('KeyC')) { // character sheet: stats + evolutions (pauses the action)
      g.state = 'charsheet'; g.overlayT = 0;
      g.player.drawT = -1;
      Sfx.play('ui');
      return;
    }
    if (Fx.tickHitstop(dt)) { g.preserveInput = true; return; } // hit-stop: world freezes, but buffered presses survive it

    // #32: a room-follow that arrived while we were gated/picking now applies (party
    // stays together - we catch up to wherever the mover led once we're back in play)
    if (g.pendingCoopRoom && g.dungeon) {
      const pr = g.pendingCoopRoom; g.pendingCoopRoom = null;
      coopEnterRoom(pr.gx, pr.gy, pr.dir, false);
      if (g.state !== 'play') return;
    }

    const p = g.player;
    if (!p.dead && input.pressed('Tab')) p.swapWeapon();
    p.update(dt, g, input);
    tryRoomExit();
    if (g.state !== 'play') return; // transition may have started

    if (!p.dead) { // a corpse can't loot chests or wake mimics during the death beat
      checkMimicProximity();
      if (input.pressed('KeyE')) interact();
      if (input.pressed('KeyQ')) useAbility();
      if (input.pressed('KeyR')) useAbilityR();
      if (input.mouse.clicked && g.player.abilityUlt) useUltimate(); // left-click = ultimate
      if (input.pressed('KeyX')) salvageNearest();
      if (input.pressed('KeyU')) honeWeapon();
    }

    for (const m of g.monsters) if (!m.dead) m.update(dt, g);
    updateMercs(dt);
    updateProjectiles(dt);
    updatePickups(dt);
    updateMines(dt);

    // co-op: broadcast our position + smooth the other players; sync monsters;
    // revive downed teammates; end only on a full party wipe
    if (g.coop) {
      broadcastSelf(dt); interpRemotes(dt); reviveNearbyDowned(dt);
      if (isCoopGuest()) updateGuestMobs(dt); else { broadcastMobs(dt); checkPartyWipe(); }
    }

    if (g.winTimer > 0) {
      g.winTimer -= dt;
      if (g.winTimer <= 0) {
        // a boss just died: instead of ending the run, open the plunge to the
        // next circle of the Descent. The run now ends only when you die.
        if (g.pendingDescent) { openDescentPortal(g.pendingDescent); g.pendingDescent = null; }
        else { onVictory(); return; } // legacy safety net (shouldn't trigger)
      }
    }
    if (g.deathTimer > 0) {
      g.deathTimer -= dt;
      if (g.deathTimer <= 0) { endToScreen('dead'); return; }
    }
    if (g.gateMsg > 0) g.gateMsg -= dt;
    if (g.shopMsg) { g.shopMsg.t -= dt; if (g.shopMsg.t <= 0) g.shopMsg = null; }
    if (g.floorBanner && g.floorBanner.t > 0) g.floorBanner.t -= dt;
    if (g.toadMsg && g.toadMsg.t > 0) g.toadMsg.t -= dt;

    // evolution menus take priority over further level-ups (the pick that
    // triggered the evolution should resolve before the next level-up card)
    if (g.evoQueue.length > 0 && p.rollT < 0 && g.winTimer <= 0 && !p.dead) {
      const evo = g.evoQueue.shift();
      const options = Evolutions.optionsFor(evo.key, evo.stacks);
      if (options) { // guard: an invalid queue entry (dbg typo) must never soft-lock
        beginLevelCycle();
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
      beginLevelCycle();
      g.levelUpQueue--;
      g.levelChoices = pickUpgrades();
      g.levelRerolled = false; // one reroll per level-up
      g.hoverChoice = -1;
      g.state = 'levelup';
      g.overlayT = 0;
      p.drawT = -1; // a held bow draw must not survive the overlay and fire on resume
      return;
    }
    // #32 co-op: once the whole pick sequence is drained, don't slip back into play
    // alone - hold at the gate until every teammate has also finished choosing
    if (g.coop && g.leveling && g.evoQueue.length === 0 && g.levelUpQueue === 0 &&
        !p.dead && g.winTimer <= 0) {
      finishLevelCycle();
    }
  }

  // --- #32 co-op synchronized level-up gate ---------------------------------
  // A "cycle" spans from the first level-up/evolution/ultimate overlay of a shared
  // level to the last pick. Because XP is shared, both players enter a cycle at the
  // same moment; one may just have an extra evolution/ultimate to resolve.
  function beginLevelCycle() {
    if (g.leveling) return;
    g.leveling = true;
    if (typeof Net !== 'undefined' && Net.connected) Net.send({ t: 'lvlbusy' });
  }
  // a peer is "still picking" while its busy count outruns its done count. You may
  // resume only when NO peer is still picking. Counters are monotonic, so this is
  // immune to message ordering and to divergent per-player levels.
  function anyPeerPicking() {
    for (const id in g.peerBusy) if ((g.peerBusy[id] || 0) > (g.peerDone[id] || 0)) return true;
    return false;
  }
  function partyLevelReady() {
    if (typeof Net === 'undefined' || !Net.connected) return true;
    return !anyPeerPicking();
  }
  function releaseLevelGate() {
    g.leveling = false;
    if (g.state === 'levelwait') g.state = 'play';
  }
  function finishLevelCycle() {
    g.leveling = false;
    if (typeof Net === 'undefined' || !Net.connected) { g.state = 'play'; return; }
    Net.send({ t: 'lvldone' }); // exactly one done per busy - WebSocket/TCP is reliable+ordered
    // always hold in levelwait: updateLevelWait's 0.35s grace lets a co-leveler's
    // lvlbusy arrive and be counted before we can resume (never resume-before-wait)
    g.state = 'levelwait'; g.overlayT = 0; g.levelWaitT = 0;
  }
  // a teammate is downed / has left: it can't finish its pick, so settle its counter
  // (done := busy) so it no longer reads as "picking" and can't strand the party
  function dropFromLevelGate(id) {
    g.peerDone[id] = (g.peerBusy[id] || 0);
    if (g.state === 'levelwait' && partyLevelReady() && g.levelWaitT > 0.35) releaseLevelGate();
  }
  // held at the gate: keep presence alive, release when nobody is still picking
  // (after a short grace so a co-leveler's busy can land) OR when a failsafe timeout
  // elapses so a disconnect/edge case can never permanently soft-lock a run
  function updateLevelWait(dt) {
    g.levelWaitT += dt;
    broadcastSelf(dt); interpRemotes(dt);
    if (isCoopGuest()) updateGuestMobs(dt);
    if ((g.levelWaitT > 0.35 && partyLevelReady()) || g.levelWaitT > 12) releaseLevelGate();
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
      case 'magic': s.magic = (s.magic || 0) + 1; break; // #16 raise Magic to wield stronger wands/staffs
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
    const p = g.player;
    p.applyEvolution(opt.fx);
    p.evoTaken.push({ key: g.evoChoices.key, name: opt.name, tier: Evolutions.TIER_LABEL[g.evoChoices.stacks] });
    p.recordEvoPick(g.evoChoices.key); // first two picks forge the Q ability
    Sfx.play('levelup');
    Fx.text(p.x, p.y - 34, opt.name.toUpperCase(), '#b88aff', 14);
    Fx.burst(p.x, p.y, ['#b88aff', '#ffd24c', '#fff'], 26, { speed: 200, life: 0.8, glow: true });
    // the moment the 2nd evolution lands, the Q ability is born
    if (p.evoHistory.length === 2 && p.ability) {
      Fx.text(p.x, p.y - 58, `Q: ${p.ability.name.toUpperCase()}`, p.ability.color, 15);
      Sfx.play('roar');
    }
    // the 4th evolution forges R + offers a CHOICE of 3 ultimates -> open the picker
    if (p.evoHistory.length === 4 && p.abilityR) Fx.text(p.x, p.y - 58, `R: ${p.abilityR.name.toUpperCase()}`, p.abilityR.color, 15);
    g.evoChoices = null;
    if (p.ultChoices && !p.abilityUlt) {
      g.ultChoices = p.ultChoices; g.hoverChoice = -1; g.state = 'ultpick'; g.overlayT = 0;
      Sfx.play('roar');
      return;
    }
    g.state = 'play';
  }

  function applyUltChoice(ult) {
    const p = g.player;
    p.abilityUlt = ult; p.abilityUlt.cd = 0;
    p.ultChoices = null; g.ultChoices = null;
    Sfx.play('levelup');
    Fx.text(p.x, p.y - 40, `ULTIMATE: ${ult.name}`, ult.color, 16);
    Fx.burst(p.x, p.y, [ult.color, '#fff', '#ffd24c'], 36, { speed: 240, life: 0.9, glow: true });
    g.state = 'play';
  }

  function updateUltPick() {
    const opts = g.ultChoices, n = opts.length;
    if (g.hoverChoice < 0) g.hoverChoice = 0;
    if (input.pressed('KeyA') || input.pressed('ArrowLeft')) { g.hoverChoice = (g.hoverChoice + n - 1) % n; Sfx.play('ui'); }
    if (input.pressed('KeyD') || input.pressed('ArrowRight')) { g.hoverChoice = (g.hoverChoice + 1) % n; Sfx.play('ui'); }
    for (const r of g.uiRects) {
      const over = input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h;
      if (!over) continue;
      if (input.mouse.moved) g.hoverChoice = r.idx;
      if (input.mouse.clicked) { applyUltChoice(opts[r.idx]); return; }
    }
    if ((input.pressed('Space') || input.pressed('Enter')) && opts[g.hoverChoice]) { applyUltChoice(opts[g.hoverChoice]); return; }
    if (input.pressed('Digit1') && opts[0]) { applyUltChoice(opts[0]); return; }
    if (input.pressed('Digit2') && opts[1]) { applyUltChoice(opts[1]); return; }
    if (input.pressed('Digit3') && opts[2]) { applyUltChoice(opts[2]); return; }
  }

  function updateEvolution() {
    const opts = g.evoChoices.options, n = opts.length;
    if (g.hoverChoice < 0) g.hoverChoice = 0;
    if (input.pressed('KeyA') || input.pressed('ArrowLeft'))  { g.hoverChoice = (g.hoverChoice + n - 1) % n; Sfx.play('ui'); }
    if (input.pressed('KeyD') || input.pressed('ArrowRight')) { g.hoverChoice = (g.hoverChoice + 1) % n; Sfx.play('ui'); }
    for (const r of g.uiRects) {
      const over = input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h;
      if (!over) continue;
      if (input.mouse.moved) g.hoverChoice = r.idx;
      if (input.mouse.clicked) { applyEvolutionChoice(opts[r.idx]); return; }
    }
    if ((input.pressed('Space') || input.pressed('Enter')) && opts[g.hoverChoice]) { applyEvolutionChoice(opts[g.hoverChoice]); return; }
    if (input.pressed('Digit1') && opts[0]) { applyEvolutionChoice(opts[0]); return; }
    if (input.pressed('Digit2') && opts[1]) { applyEvolutionChoice(opts[1]); return; }
    if (input.pressed('Digit3') && opts[2]) { applyEvolutionChoice(opts[2]); return; }
  }

  function updateLevelUp() {
    const n = g.levelChoices.length;
    // keyboard nav (Deep Rock Survivor style): A/D or arrows move, Space/Enter picks
    if (g.hoverChoice < 0) g.hoverChoice = 0;
    if (input.pressed('KeyA') || input.pressed('ArrowLeft'))  { g.hoverChoice = (g.hoverChoice + n - 1) % n; Sfx.play('ui'); }
    if (input.pressed('KeyD') || input.pressed('ArrowRight')) { g.hoverChoice = (g.hoverChoice + 1) % n; Sfx.play('ui'); }
    // mouse: only steals the selection when it actually moves (parked mouse won't fight the keys)
    for (const r of g.uiRects) {
      const over = input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h;
      if (!over) continue;
      if (r.reroll) {
        if (input.mouse.clicked && !g.levelRerolled) { rerollLevelChoices(); return; }
        continue;
      }
      if (input.mouse.moved) g.hoverChoice = r.idx;
      if (input.mouse.clicked) { applyUpgrade(g.levelChoices[r.idx]); return; }
    }
    if ((input.pressed('Space') || input.pressed('Enter')) && g.levelChoices[g.hoverChoice]) { applyUpgrade(g.levelChoices[g.hoverChoice]); return; }
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
      if (isCoopGuest()) { g.state = 'play'; return; } // guest receives the boss via snapshots
      // consume the config rolled at room entry (recolored/angrier in the Descent)
      g.boss = Boss.make(g.pendingBossCfg ? { descent: g.pendingBossCfg } : undefined);
      g.pendingBossCfg = null;
      g.monsters = [g.boss];
      coopScaleMonsters(g.monsters);                          // co-op: beefier boss
      g.boss.netId = ++g.netMobId; // co-op: sync the boss like any monster
      g.state = 'play';
      Fx.shake(8, 0.4);
    }
  }

  // abandon the current run and return to the title/hub; drops any co-op connection
  function quitToTitle() {
    if (g.coop) {
      g.coop = false;
      if (typeof Net !== 'undefined') Net.disconnect();
      g.remotePlayers.clear();
    }
    g.state = 'title';
    Sfx.play('ui');
  }

  function updateEnd() {
    // leaving a co-op run drops the connection cleanly
    if ((input.pressed('Enter') || input.pressed('Escape')) && g.coop) {
      g.coop = false;
      if (typeof Net !== 'undefined') Net.disconnect();
      g.remotePlayers.clear();
    }
    if (input.pressed('Enter')) { newRun(); return; }        // Enter matches the NEW RUN button it captions
    if (input.pressed('Escape')) { g.state = 'title'; return; } // Esc visits the hub to spend essence
    if (input.mouse.clicked) {
      for (const r of g.uiRects) {
        if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
          if (r.action === 'again') { newRun(); return; }
          if (r.action === 'menu') { quitToTitle(); return; }
        }
      }
    }
  }

  function updateProjectiles(dt) {
    const p = g.player;
    for (let i = g.projectiles.length - 1; i >= 0; i--) {
      const pr = g.projectiles[i];
      // #27 heat-seeker: curve toward the player at a capped turn rate for a short
      // window, then fly straight (so a good dodge still shakes it)
      if (pr.homing > 0 && pr.from === 'enemy' && !p.dead) {
        pr.homing -= dt;
        const cur = Math.atan2(pr.vy, pr.vx);
        const want = Math.atan2(p.y - pr.y, p.x - pr.x);
        let d = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const a = cur + Math.max(-pr.turnRate * dt, Math.min(pr.turnRate * dt, d));
        const sp = Math.hypot(pr.vx, pr.vy);
        pr.vx = Math.cos(a) * sp; pr.vy = Math.sin(a) * sp;
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.homing !== undefined) Fx.burst(pr.x, pr.y, [pr.color, '#fff'], 1, { speed: 12, life: 0.25, glow: true, size: 2 });
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
        } else { // INCIDENTAL: an enemy arrow can catch a mercenary in its flight path
          for (const merc of g.mercs) {
            if (merc.dead) continue;
            if (Math.hypot(pr.x - merc.x, pr.y - merc.y) < 12 + pr.r) { damageMerc(merc, pr.dmg); dead = true; break; }
          }
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
              chill: pr.chill, venom: pr.venom, chain: pr.chain,
              hitSfx: pr.hitSfx,
            }, g);
            if (landed) P.onHitLanded(pr.crit, g);
            if (pr.pierce && pr.hitSet.size < pr.pierce) { pr.hitSet.add(m); pr.dmg *= 0.8; }
            else { dead = true; break; }
          }
        }
      }
      if (dead) {
        // #16 staff fireball: bursts on impact for AOE + burn to nearby monsters
        if (pr.blast && pr.from === 'player') {
          Fx.shake(5, 0.2); Sfx.play('explode');
          Fx.burst(pr.x, pr.y, ['#ff8833', '#ffcc44', '#ff4422'], 22, { speed: 230, life: 0.5, glow: true });
          const P = g.player;
          for (const m of g.monsters) {
            if (m.dead || m.airborne) continue;
            if (Math.hypot(pr.x - m.x, pr.y - m.y) < pr.blast + m.r) m.takeHit(pr.dmg * 0.8, { sx: pr.x, sy: pr.y, knock: 110, flame: pr.flame, crit: pr.crit, fromPlayer: true, hitSfx: 'hitHeavy' }, g);
          }
        }
        Fx.burst(pr.x, pr.y, pr.color, 4, { speed: 70, life: 0.25 });
        g.projectiles.splice(i, 1);
      }
    }
  }

  // #27 minelayer: mines arm, then a nearby player trips a short fuse -> blast.
  // Auto-detonate after 7s so they never pile up forever.
  function updateMines(dt) {
    const p = g.player;
    const nearAnyPlayer = (x, y, rr) => {
      if (!p.dead && Math.hypot(p.x - x, p.y - y) < rr + p.r) return true;
      if (g.coop) for (const rp of g.remotePlayers.values()) if (rp.room && g.room && rp.room[0] === g.room.gx && rp.room[1] === g.room.gy && !rp.downed && Math.hypot(rp.x - x, rp.y - y) < rr) return true;
      return false;
    };
    for (let i = g.mines.length - 1; i >= 0; i--) {
      const mn = g.mines[i];
      mn.t += dt;
      if (!mn.armed) { if (mn.t >= mn.armT) mn.armed = true; continue; }
      if (mn.fuse < 0) {
        if (nearAnyPlayer(mn.x, mn.y, 42) || mn.t > 7) { mn.fuse = 0.4; Sfx.play('error'); }
      } else {
        mn.fuse -= dt;
        if (mn.fuse <= 0) { detonateMine(mn); g.mines.splice(i, 1); }
      }
    }
  }
  function detonateMine(mn) {
    Fx.shake(6, 0.25); Sfx.play('explode');
    Fx.burst(mn.x, mn.y, ['#ff8833', '#ffcc44', '#ff4422', '#888'], 24, { speed: 240, life: 0.55, glow: true });
    for (const t of g.partyTargets()) if (Math.hypot(t.x - mn.x, t.y - mn.y) < mn.blastR + t.r) g.hurtTarget(t, mn.dmg, mn.x, mn.y, null);
    if (g.coop && typeof Net !== 'undefined' && Net.isHost) Net.send({ t: 'boom', x: Math.round(mn.x), y: Math.round(mn.y), r: mn.blastR });
  }
  function drawMines(c) {
    for (const mn of g.mines) {
      c.save(); c.translate(mn.x, mn.y);
      const col = mn.fuse >= 0 ? '#ff5533' : (mn.armed ? '#9a3a24' : '#4a4f5d');
      c.fillStyle = col;
      c.beginPath(); c.arc(0, 0, mn.r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = col; c.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.beginPath(); c.moveTo(Math.cos(a) * mn.r, Math.sin(a) * mn.r); c.lineTo(Math.cos(a) * (mn.r + 4), Math.sin(a) * (mn.r + 4)); c.stroke(); }
      if (mn.armed) {
        const on = mn.fuse >= 0 ? (Math.sin(Date.now() / 40) > 0) : (Math.sin(Date.now() / 220) > 0);
        c.fillStyle = on ? '#ffec80' : '#3a2a10';
        c.beginPath(); c.arc(0, -mn.r * 0.2, 2.4, 0, Math.PI * 2); c.fill();
        if (mn.fuse < 0) { c.strokeStyle = 'rgba(255,90,60,0.22)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 42, 0, Math.PI * 2); c.stroke(); }
      }
      c.restore();
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

    if (g.state === 'title') {
      g.uiRects = UI.drawTitle(c, g);
      return;
    }
    if (g.state === 'lobby') {
      g.uiRects = UI.drawLobby(c, g);
      return;
    }

    const shake = Fx.getShake();
    c.save();
    c.translate(shake.x, shake.y);

    drawRoom(c, g.room);
    Fx.drawGhosts(c);

    // pickups under actors
    for (const pk of g.pickups) drawPickup(c, pk);
    drawMines(c);

    // actors
    for (const m of g.monsters) if (!m.dead) m.draw(c, g);
    for (const merc of g.mercs) if (!merc.dead) drawMerc(c, merc);
    if (g.coop) drawRemotePlayers(c);
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
    if (g.state === 'play') drawEquippedHover(c); // hover equipped slots -> stat card
    if (g.room.type === 'boss' && g.boss) UI.drawBossBar(c, g); // guest may not have the boss obj (proxy only)

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
      if (g.floorBanner.sub) {
        c.font = '12px monospace'; c.fillStyle = '#9a8f7a';
        c.fillText(g.floorBanner.sub, W / 2, 110);
      }
      c.restore();
    }

    // Toad's line when the King falls and the Descent opens
    if (g.toadMsg && g.toadMsg.t > 0 && g.state === 'play') {
      const a = Math.min(1, g.toadMsg.t) * Math.min(1, (5 - g.toadMsg.t) * 2);
      c.save();
      c.globalAlpha = a;
      c.textAlign = 'center';
      c.font = 'bold 26px monospace';
      c.fillStyle = '#1a0a04';
      c.fillText(g.toadMsg.text, W / 2 + 2, H / 2 - 58);
      c.fillStyle = '#ff8a3d';
      c.fillText(g.toadMsg.text, W / 2, H / 2 - 60);
      c.font = '14px monospace';
      c.fillStyle = '#ffcc88';
      c.fillText('the Descent yawns open below', W / 2, H / 2 - 34);
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
    if (g.state === 'ultpick') g.uiRects = UI.drawUltPick(c, g);
    if (g.state === 'levelwait') drawLevelWait(c);
    if (g.state === 'pause') g.uiRects = UI.drawPause(c, g);
    if (g.state === 'charsheet') UI.drawCharSheet(c, g);
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
    const descent = typeof Descent !== 'undefined' && Descent.isDescent(g.floorNum);
    // outer wall fill
    c.fillStyle = pal.wall;
    c.fillRect(0, 0, W, H);
    // Dante's Inferno backdrop: lava glow rising from the bottom of the frame
    if (descent) {
      const grad = c.createLinearGradient(0, H, 0, H * 0.35);
      grad.addColorStop(0, 'rgba(150,26,0,0.55)');
      grad.addColorStop(1, 'rgba(150,26,0,0)');
      c.fillStyle = grad;
      c.fillRect(0, 0, W, H);
    }
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
    // theme ambience: drifting particles that sell the place
    if (theme.ambient === 'forest' && Math.random() < 0.06) {
      Fx.burst(PF.x + Math.random() * PF.w, PF.y + Math.random() * PF.h * 0.4,
        ['#7a9a4e', '#c9a227', '#5d7a4a'], 1, { speed: 8, life: 2.2, grav: 14, vx: 12, size: 2.5, drag: 0.999 });
    }
    if (theme.ambient === 'swamp') {
      if (Math.random() < 0.05) Fx.burst(PF.x + Math.random() * PF.w, PF.y + PF.h - Math.random() * 60,
        'rgba(160,220,200,0.5)', 1, { speed: 5, life: 1.8, grav: -22, size: 2.2, drag: 0.999 });
      if (Math.random() < 0.03) Fx.burst(PF.x + Math.random() * PF.w, PF.y + Math.random() * PF.h,
        '#d8e86a', 1, { speed: 12, life: 1.4, glow: true, size: 1.8, drag: 0.995 }); // fireflies
    }
    if (theme.ambient === 'castle' && Math.random() < 0.05) {
      Fx.burst(PF.x + Math.random() * PF.w, PF.y + Math.random() * PF.h,
        'rgba(212,175,55,0.45)', 1, { speed: 6, life: 2.4, grav: 6, size: 1.6, drag: 0.999 }); // gold motes
    }
    if (theme.ambient === 'inferno') {
      // embers stream up from the coals; the odd lava pop spits out of the floor
      if (Math.random() < 0.5) Fx.burst(PF.x + Math.random() * PF.w, PF.y + PF.h - Math.random() * 40,
        ['#ff6a2c', '#ffcc44', '#ff2200'], 1, { speed: 8, life: 1.6, grav: -34, glow: true, size: 2, drag: 0.999 });
      if (Math.random() < 0.05) Fx.burst(PF.x + Math.random() * PF.w, PF.y + Math.random() * PF.h,
        '#ff3300', 1, { speed: 45, life: 0.5, glow: true, size: 2 });
    }

    // molten rounded corners: mask the square corners so the arena reads oblong
    // and cornerless (collision stays rectangular underneath - a deliberate call)
    if (descent) drawMoltenCorners(c, pal);

    // wall inner edge highlight - skip in the Descent, where the molten rounded
    // corners define the oblong edge (the rectangle outline was showing through)
    if (!descent) {
      c.strokeStyle = pal.accent + '44';
      c.lineWidth = 2;
      c.strokeRect(PF.x + 1, PF.y + 1, PF.w - 2, PF.h - 2);
    }

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
      } else if (theme.obstacle === 'brimstone') {
        // jagged coal boulder with molten cracks glowing through
        c.fillStyle = '#2a1008';
        c.beginPath(); c.arc(o.x, o.y, o.r, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#120704';
        c.beginPath(); c.arc(o.x - o.r * 0.2, o.y - o.r * 0.22, o.r * 0.72, 0, Math.PI * 2); c.fill();
        c.save();
        c.strokeStyle = '#ff5a2c'; c.shadowColor = '#ff3300'; c.shadowBlur = 8; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(o.x - o.r * 0.6, o.y - o.r * 0.2); c.lineTo(o.x - o.r * 0.1, o.y + o.r * 0.15);
        c.lineTo(o.x + o.r * 0.3, o.y - o.r * 0.25); c.lineTo(o.x + o.r * 0.6, o.y + o.r * 0.1);
        c.stroke();
        c.restore();
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
    if ((room.type === 'shop' || room.type === 'mythicshop') && room.shopStock) drawShop(c, room);

    // hireable mercenary standing in the room
    if (room.merc && !room.merc.hired) drawMercNPC(c, room.merc);
    // dormant pet waiting to be activated
    if (room.pet && !room.pet.activated) drawPetNPC(c, room.pet);

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

    // descent portal: a molten tear in the world where a boss just fell
    if (g.descentPortal && g.descentPortal.room === room) {
      const pt = g.descentPortal;
      c.save();
      c.translate(pt.x, pt.y);
      const spin = g.time * 2.6;
      for (let i = 0; i < 3; i++) {
        c.strokeStyle = i === 1 ? 'rgba(255,90,44,0.85)' : 'rgba(255,204,68,0.8)';
        c.lineWidth = 5 - i;
        c.beginPath();
        c.ellipse(0, 0, 28 + i * 8 + Math.sin(spin * 2 + i) * 3, 15 + i * 4, spin * (i % 2 ? -0.6 : 0.6), 0.3, Math.PI * 2 - 0.3);
        c.stroke();
      }
      const grad = c.createRadialGradient(0, 0, 2, 0, 0, 34);
      grad.addColorStop(0, 'rgba(255,90,44,0.7)');
      grad.addColorStop(1, 'rgba(120,20,0,0)');
      c.fillStyle = grad;
      c.beginPath(); c.arc(0, 0, 34, 0, Math.PI * 2); c.fill();
      if (Math.random() < 0.4) Fx.burst(pt.x + (Math.random() * 44 - 22), pt.y + (Math.random() * 26 - 13), Math.random() < 0.5 ? '#ff5a2c' : '#ffcc44', 1, { speed: 40, life: 0.6, glow: true });
      c.restore();
      c.font = 'bold 12px monospace'; c.textAlign = 'center';
      c.fillStyle = '#ff8a3d';
      c.fillText('E - DESCEND INTO THE INFERNO', pt.x, pt.y + 50);
    }

    // start-room hint
    if (room.type === 'start' && g.floorNum === 1) {
      c.font = '13px monospace'; c.textAlign = 'center';
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillText('WASD move · aim with mouse · auto-attack · SPACE dodge · Q / R / click abilities', W / 2, PF.y + PF.h / 2 + 70);
    }

    // treasure room sparkle ambience
    if (room.type === 'treasure' && Math.random() < 0.1) {
      Fx.burst(PF.x + Math.random() * PF.w, PF.y + Math.random() * PF.h, '#d4af37', 1, { speed: 15, life: 0.8, glow: true });
    }
  }

  // masks the four square corners of the playfield with wall-colored notches and
  // a glowing lava rim, so a descent room reads as an oblong pit of fire. Purely
  // cosmetic - the collision rectangle underneath is unchanged.
  function drawMoltenCorners(c, pal) {
    const R = 74;
    const L = PF.x, T = PF.y, Rt = PF.x + PF.w, B = PF.y + PF.h;
    const corners = [
      { corner: [L, T],  cx: L + R,  cy: T + R,  edge: [L + R, T],  a0: -Math.PI / 2, a1: Math.PI,        ccw: true  },
      { corner: [Rt, T], cx: Rt - R, cy: T + R,  edge: [Rt - R, T], a0: -Math.PI / 2, a1: 0,              ccw: false },
      { corner: [Rt, B], cx: Rt - R, cy: B - R,  edge: [Rt, B - R], a0: 0,           a1: Math.PI / 2,     ccw: false },
      { corner: [L, B],  cx: L + R,  cy: B - R,  edge: [L + R, B],  a0: Math.PI / 2, a1: Math.PI,         ccw: false },
    ];
    for (const cn of corners) {
      // fill the corner notch with wall colour
      c.fillStyle = pal.wall;
      c.beginPath();
      c.moveTo(cn.corner[0], cn.corner[1]);
      c.lineTo(cn.edge[0], cn.edge[1]);
      c.arc(cn.cx, cn.cy, R, cn.a0, cn.a1, cn.ccw);
      c.closePath();
      c.fill();
      // molten rim along the rounded edge
      c.save();
      c.strokeStyle = '#ff6a2c'; c.shadowColor = '#ff3300'; c.shadowBlur = 10; c.lineWidth = 3;
      c.beginPath(); c.arc(cn.cx, cn.cy, R, cn.a0, cn.a1, cn.ccw); c.stroke();
      c.restore();
    }
  }

  function drawChest(c, ch) {
    c.save();
    c.translate(ch.x, ch.y);
    // THE MIMIC TELL: mimics sit flush and look identical to a real chest (no float,
    // no color tint - Sam: the floating gave them away). The ONLY tell is a rare,
    // brief warm shimmer that flashes for a heartbeat every few seconds - an
    // attentive player can learn it, but it is not a reliable at-a-glance identifier.
    if (ch.mimic) {
      const shimmer = Math.max(0, Math.sin(g.time * 1.9 + ch.wobble));
      if (shimmer > 0.985) {
        c.strokeStyle = `rgba(255,180,90,${(shimmer - 0.985) * 26})`;
        c.lineWidth = 2;
        c.strokeRect(-19, -17, 38, 30);
      }
    }
    // shadow
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.ellipse(0, 13, 20, 6, 0, 0, Math.PI * 2); c.fill();
    // body
    c.fillStyle = '#7a5230';
    c.fillRect(-17, -4, 34, 16);
    // lid
    c.fillStyle = '#8d6238'; // identical to a real chest - no tint tell
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
    // shopkeeper: a chill hooded merchant behind the counter (mythic shop = a
    // stranger robed in magenta who deals only in legends)
    const myth = room.type === 'mythicshop';
    const kx = PF.x + PF.w / 2, ky = PF.y + 62;
    c.save();
    c.translate(kx, ky);
    c.fillStyle = myth ? '#5a1e52' : '#3d2f4a';
    c.beginPath(); c.moveTo(0, -22); c.lineTo(18, 12); c.lineTo(-18, 12); c.closePath(); c.fill();
    c.fillStyle = myth ? '#2a0e28' : '#241c2e';
    c.beginPath(); c.arc(0, -12, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = myth ? '#ff2fb0' : '#ffd24c';
    c.beginPath(); c.arc(-3, -13, 1.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(3, -13, 1.8, 0, Math.PI * 2); c.fill();
    c.font = '11px monospace'; c.textAlign = 'center';
    c.fillStyle = myth ? 'rgba(255,47,176,0.85)' : 'rgba(255,210,76,0.7)';
    c.fillText(myth ? '"only the worthy leave with these"' : '"browse, friend - no refunds"', 0, 34);
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
      if (it.kind === 'potion') {
        c.font = '10px monospace'; c.fillStyle = '#e0888a';
        c.fillText(`heal ${POTION_HEAL} HP`, it.x, it.y + 44);
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
    if (t.kind === 'weaponPickup') { x = t.pk.x; y = t.pk.y - 30; label = `E take · X salvage +${[1,2,4,7,12,20][t.pk.weapon.rarIdx]}◈`; }
    if (t.kind === 'armorPickup') { x = t.pk.x; y = t.pk.y - 30; label = `E equip · X salvage +${[1,2,4,7,12,20][t.pk.armor.rarIdx]}◈`; }
    if (t.kind === 'shopItem') { x = t.it.x; y = t.it.y - 52; label = 'E - buy'; }
    if (t.kind === 'merc') { x = g.room.merc.x; y = g.room.merc.y - 42; label = `E - hire ${g.room.merc.cost}c`; }
    if (t.kind === 'pet') { x = g.room.pet.x; y = g.room.pet.y - 34; label = g.player.pet ? `E - stable ${g.room.pet.name}` : `E - befriend ${g.room.pet.name}`; }
    if (t.kind === 'stairs' || t.kind === 'portal' || t.kind === 'descentPortal') return; // these draw their own prompt
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
    if (w) drawGearCard(c, w, x, y);
    c.restore();
  }

  // a hovering stat card for a weapon or armor item, anchored above (anchorX, anchorY)
  function drawGearCard(c, w, anchorX, anchorY) {
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
      ...(w.flavor ? [{ text: `"${w.flavor}"`, color: '#9a8f7a', italic: true }] : []),
    ];
    const cw = 262, pad = 10, maxTextW = cw - pad * 2, lh = 15;
    c.save();
    // wrap every raw line to the box width, using each line's own font, so long
    // mythic flavor/enchant text stays INSIDE the card (bug: it used to overflow)
    const render = [];
    for (const l of lines) {
      const font = (l.bold ? 'bold 12px' : l.italic ? 'italic 11px' : '11px') + ' monospace';
      c.font = font;
      let cur = '';
      for (const wd of l.text.split(' ')) {
        const test = cur ? cur + ' ' + wd : wd;
        if (c.measureText(test).width > maxTextW && cur) { render.push({ text: cur, font, color: l.color }); cur = wd; }
        else cur = test;
      }
      if (cur) render.push({ text: cur, font, color: l.color });
    }
    const chh = render.length * lh + 12;
    let cx = Math.min(W - cw - 8, Math.max(8, anchorX - cw / 2));
    let cy = anchorY - chh - 22;
    if (cy < 8) cy = anchorY + 30;
    cy = Math.max(8, Math.min(cy, H - chh - 8)); // never spill off the bottom either
    c.fillStyle = 'rgba(8,8,16,0.94)';
    c.fillRect(cx, cy, cw, chh);
    c.strokeStyle = w.color; c.lineWidth = 1.5;
    c.strokeRect(cx, cy, cw, chh);
    c.textAlign = 'left';
    render.forEach((l, i) => { c.font = l.font; c.fillStyle = l.color; c.fillText(l.text, cx + pad, cy + 16 + i * lh); });
    c.restore();
  }

  // hovering the equipped weapon/armor slots (bottom-left HUD) shows their stat card.
  // Slot geometry mirrors ui.js drawHUD: three 42x42 slots at y = H-106.
  function drawEquippedHover(c) {
    const p = g.player; if (!p) return;
    const sy = H - 106, sh = 42;
    const slots = [
      { x: 14,  item: p.weapons.a },
      { x: 62,  item: p.weapons.b },
      { x: 110, item: p.armor },
    ];
    const mx = input.mouse.x, my = input.mouse.y;
    for (const s of slots) {
      if (!s.item) continue;
      if (mx >= s.x && mx <= s.x + sh && my >= sy && my <= sy + sh) {
        drawGearCard(c, s.item, s.x + sh / 2, sy - 4);
        break;
      }
    }
    // ability badge tooltips (Q / R / Ultimate), bottom-centre: what does each do?
    const s = 46, gap = 10, badges = [];
    if (p.ability)    badges.push({ a: p.ability,    key: 'Q',         forged: 'forged from your first two evolutions' });
    if (p.abilityR)   badges.push({ a: p.abilityR,   key: 'R',         forged: 'forged from your 3rd + 4th evolutions' });
    if (p.abilityUlt) badges.push({ a: p.abilityUlt, key: 'Ultimate', forged: 'left-click · forged from Q + R' });
    const total = badges.length * s + (badges.length - 1) * gap;
    let bx = W / 2 - total / 2;
    for (const b of badges) {
      const by = H - s - 12;
      if (mx >= bx && mx <= bx + s && my >= by && my <= by + s) { drawAbilityCard(c, b.a, b.key, b.forged, bx + s / 2, by - 6); break; }
      bx += s + gap;
    }
  }

  // hovering an ability badge explains the power and where it came from
  function drawAbilityCard(c, a, key, forged, anchorX, anchorY) {
    const lines = [
      { text: a.name, color: a.color, bold: true },
      { text: `${key} · ${a.cdMax}s cooldown`, color: '#8fa3bf' },
      ...(a.desc ? wrapToLines(c, a.desc, 250) : []).map(t => ({ text: t, color: '#cdd4e2' })),
      { text: forged, color: '#9a8f7a', italic: true },
    ];
    const cw = 268, lh = 16, chh = lines.length * lh + 14;
    let cx = Math.min(W - cw - 8, Math.max(8, anchorX - cw / 2));
    let cy = anchorY - chh;
    if (cy < 8) cy = anchorY + 30;
    c.save();
    c.fillStyle = 'rgba(8,8,16,0.94)'; c.fillRect(cx, cy, cw, chh);
    c.strokeStyle = a.color; c.lineWidth = 1.5; c.strokeRect(cx, cy, cw, chh);
    c.textAlign = 'left';
    lines.forEach((l, i) => {
      c.font = (l.bold ? 'bold 12px' : l.italic ? 'italic 11px' : '11px') + ' monospace';
      c.fillStyle = l.color;
      c.fillText(l.text, cx + 10, cy + 18 + i * lh);
    });
    c.restore();
  }

  // wrap a string into <=width lines (monospace), for tooltip bodies
  function wrapToLines(c, text, maxW) {
    c.font = '11px monospace';
    const words = text.split(' '), out = []; let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
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
    start() { if (g.state === 'title') newRun(); },
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
    // co-op test hooks (drive the real lobby/net paths)
    mpHost() { openLobby(); const code = Net.host(); g.lobby.mode = 'host'; return code; },
    mpJoin(code) { openLobby(); Net.join(code); g.lobby.mode = 'join'; },
    mpStart() { const seed = (Math.random() * 1e9) | 0; Net.send({ t: 'start', seed }); startCoop(seed); },
    mpState() { return { coop: g.coop, connected: typeof Net !== 'undefined' && Net.connected, isHost: Net && Net.isHost, code: Net && Net.code, peers: Net ? [...Net.peers] : [], remotes: [...g.remotePlayers.keys()], room: g.room && [g.room.gx, g.room.gy] }; },
  };

  // mark the current version's patch notes as seen so they don't auto-pop again
  function markVersionSeen() {
    if (typeof PatchNotes === 'undefined') return;
    try { localStorage.setItem('drl_seen_ver', PatchNotes.VERSION); } catch { }
  }
  // AUTO patch notes: pop the changelog once when a new version is first loaded
  function maybeShowPatchNotes() {
    if (typeof PatchNotes === 'undefined') return;
    let seen = null;
    try { seen = localStorage.getItem('drl_seen_ver'); } catch { }
    if (seen !== PatchNotes.VERSION) g.showPatch = true; // seen-marker written on close
  }

  // boot
  console.log('[dungeon] loaded - Dungeon of the Gilded King');
  maybeShowPatchNotes();
  requestAnimationFrame(frame);
})();
