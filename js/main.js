// ============================================================================
// main.js - game loop, input, room logic, loot, shop, progression, states.
// ============================================================================
(() => {
  const W = 960, H = 540;
  const PF = Dungeon.PF;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // --- LEVEL-UP UPGRADE POOL (in-run, resets each run) --------------------------
  // #stat-redesign (Sam, 2026-07-12): every card is a SKILL tagged with the base
  // STAT it governs. Picking any of a stat's cards adds a point to that stat, and
  // at 3/6/9/12 stat points its evolution opens. Cards with an `fx` route through
  // applyEvolution (engine-consumed fields); the rest use the switch in applyUpgrade.
  const UPGRADE_POOL = [
    // MIGHT - kill fast
    { key: 'dmg',      icon: '⚔', color: '#ffd24c', name: 'Brutal',     desc: '+10% damage',            stat: 'MIGHT' },
    { key: 'crit',     icon: '✦', color: '#ffd24c', name: 'Deadly',     desc: '+6% crit chance',        stat: 'MIGHT' },
    { key: 'execution',icon: '✠', color: '#ffd24c', name: 'Executioner', desc: 'Critical hits strike 25% harder', stat: 'MIGHT', fx: { critDmg: 0.25 } },
    { key: 'jackal',   icon: '➹', color: '#ffd24c', name: 'Jackal',     desc: '+12% damage to enemies below 30% health', stat: 'MIGHT', fx: { dmgVsWounded: 0.12 } },
    { key: 'atkspd',   icon: '≫', color: '#7fd4ff', name: 'Frenzy',     desc: '+10% attack speed',      stat: 'AGILITY' },
    // VIGOR - stay alive
    { key: 'hp',       icon: '♥', color: '#e05555', name: 'Tough',      desc: '+15 max health, heal 15', stat: 'VIGOR' },
    { key: 'regen',    icon: '✚', color: '#6ee7a0', name: 'Mending',    desc: 'Regenerate 0.6 HP/s',    stat: 'VIGOR' },
    { key: 'bulwark',  icon: '⛊', color: '#8fd0ff', name: 'Bulwark',    desc: 'Take 5% less damage',    stat: 'VIGOR',   fx: { reduce: 0.05 } },
    { key: 'nettle',   icon: '✻', color: '#6ee7a0', name: 'Nettle',     desc: 'Enemies that hit you take 8 damage', stat: 'VIGOR', fx: { thorns: 8 } },
    // AGILITY - nimble / evasion
    { key: 'spd',      icon: '»', color: '#7fd4ff', name: 'Fleet',      desc: '+7% move speed',         stat: 'AGILITY' },
    { key: 'roll',     icon: '↻', color: '#7fd4ff', name: 'Acrobat',    desc: '-12% roll cooldown',     stat: 'AGILITY' },
    { key: 'reflexes', icon: '➶', color: '#7fe0ff', name: 'Reflexes',   desc: '+0.05s longer invincible roll',   stat: 'AGILITY', fx: { phantomStep: 0.05 } },
    // ARCANE - spellcasting
    { key: 'magic',    icon: '✷', color: '#b06bff', name: 'Attunement', desc: '+1 Magic (stronger wands/staffs)', stat: 'ARCANE' },
    { key: 'focus',    icon: '❋', color: '#b06bff', name: 'Focus',      desc: '+15% spell power',       stat: 'ARCANE',  fx: { spellPower: 0.15 } },
    { key: 'resonance',icon: '◎', color: '#c88bff', name: 'Resonance',  desc: '+25 spell blast radius', stat: 'ARCANE',  fx: { blastBonus: 25 } },
    { key: 'echo',     icon: '∿', color: '#c88bff', name: 'Echo',       desc: 'Spells have a 12% chance to cast twice', stat: 'ARCANE', fx: { echo: 0.12 } },
    // FORTUNE - luck / economy
    { key: 'coin',     icon: '●', color: '#ffce54', name: 'Greedy',     desc: '+20% coins from kills',  stat: 'FORTUNE' },
    { key: 'bounty',   icon: '⦿', color: '#ffce54', name: 'Bounty',     desc: 'Elites drop +3 coins',   stat: 'FORTUNE', fx: { eliteCoins: 3 } },
    { key: 'midas',    icon: '⟐', color: '#ffd24c', name: 'Midas',      desc: '+1 damage per 60 coins held', stat: 'FORTUNE', fx: { midasPer: 60, midasCap: 16 } },
    { key: 'clover',   icon: '☘', color: '#ffce54', name: 'Clover',     desc: '+10% experience from kills', stat: 'FORTUNE', fx: { xpMult: 0.10 } },
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
  // #99 a stable per-device id that survives reconnects. The relay hands out a new
  // peer id each time you rejoin, which is what spawns clone ghosts; this uid lets
  // the 'p' handler recognize "same player, new connection" and evict the stale copy.
  function coopClientId() {
    // sessionStorage (not localStorage): survives a reload/reconnect in THIS tab, but
    // stays distinct per tab - so two players sharing one browser profile never
    // false-merge, and a reconnecting player still evicts its own stale ghost.
    try {
      let id = sessionStorage.getItem('drl_cid');
      if (!id) { id = 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); sessionStorage.setItem('drl_cid', id); }
      return id;
    } catch { return 'c' + Math.random().toString(36).slice(2, 10); }
  }
  // #159 (Sam) ONE ENTRY PER NAME: a person cannot be both first and second. Keeps each
  // name's BEST score only. Assumes the input is already sorted highest-first.
  function dedupByName(scores) {
    const seen = new Set(), out = [];
    for (const e of scores) {
      const k = String(e.initials || '').trim().toUpperCase();
      if (k && seen.has(k)) continue;
      seen.add(k); out.push(e);
    }
    return out;
  }
  function loadScores() {
    let stored = [];
    try { const s = JSON.parse(localStorage.getItem('drl_scores')); if (Array.isArray(s)) stored = s.filter(validScore); } catch { }
    let seeded = false;
    try { seeded = localStorage.getItem('drl_scores_seeded') === '1'; } catch { }
    if (!seeded) {
      stored = [...stored, ...SEED_SCORES];
      try { localStorage.setItem('drl_scores_seeded', '1'); } catch { }
    }
    stored = dedupByName(stored.sort((a, b) => b.score - a.score)).slice(0, SCORE_CAP);
    if (!seeded) { try { localStorage.setItem('drl_scores', JSON.stringify(stored)); } catch { } }
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
    if (typeof m.selectedClass !== 'string') m.selectedClass = ''; // #30 class chosen for the next run
    if (typeof m.selectedRace !== 'string') m.selectedRace = 'human'; // #156 blood chosen for the next run
    if (typeof m.prestige !== 'number' || !isFinite(m.prestige)) m.prestige = 0; // #43 prestige level (cosmetic; reset essence+ranks to raise it)
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
    textCapture: false, textBuf: '', // #100 chat: harvest real typed chars while open
    key(code) { return this.keys.has(code); },
    pressed(code) { return this.just.has(code); },
  };
  // a frozen "nothing is pressed" input, fed to the player while the co-op menu overlay
  // is open so it holds still and holds fire while the world keeps running around it.
  const IDLE_INPUT = {
    keys: new Set(), just: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false, moved: false },
    stick: null,
    key() { return false; }, pressed() { return false; },
  };
  window.addEventListener('keydown', e => {
    // F11 = fullscreen toggle, everywhere (even mid-chat). Intercepted so the
    // GAME goes fullscreen consistently instead of whatever the browser does.
    if (e.code === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
    // #100 while the chat box is open, swallow game keys and collect real characters
    // (e.key, so punctuation + lowercase work) instead of driving movement/abilities.
    if (input.textCapture) {
      if (e.key && e.key.length === 1) { input.textBuf += e.key; e.preventDefault(); }
      // still record Enter/Escape/Backspace as just-pressed so the handler can act
      if (['Enter', 'Escape', 'Backspace'].includes(e.code)) { input.just.add(e.code); }
      return;
    }
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) { input.keys.add(e.code); input.just.add(e.code); }
    Sfx.ensure();
  });
  // FULLSCREEN: browser API with the webkit fallback (iPad Safari). try/catch'd -
  // an embed can refuse, in which case the UI button is hidden (ui.js fsAvailable)
  // and this quietly does nothing. Reached from F11 and the ⛶ button (title/pause).
  function toggleFullscreen() {
    try {
      const d = document;
      let p;
      if (d.fullscreenElement || d.webkitFullscreenElement) {
        p = (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      } else {
        const el = d.documentElement;
        p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      }
      if (p && p.catch) p.catch(() => {}); // an embed can refuse; that's fine, stay windowed
      Sfx.play('ui');
    } catch (err) { /* unsupported here - nothing to do */ }
  }
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
    // the ⛶ button is handled HERE, inside the real event, not the frame loop:
    // requestFullscreen only works during the click's transient user activation,
    // and a throttled tab can process the frame after that window has closed.
    // State-gated because g.uiRects is not cleared when an overlay closes.
    if (e.button === 0 && (g.state === 'title' || g.state === 'pause' || g.coopMenu)) {
      const fr = (g.uiRects || []).find(r => r.action === 'fullscreen');
      if (fr && input.mouse.x > fr.x && input.mouse.x < fr.x + fr.w && input.mouse.y > fr.y && input.mouse.y < fr.y + fr.h) {
        toggleFullscreen();
        input.mouse.clicked = false; // consumed - the frame loop must not double-toggle
      }
    }
    // right-click = ULTIMATE (was weapon-swap; Tab still swaps). LMB attack + RMB
    // special is the pattern the newcomers already know, and it frees left-click
    // to be a manual attack when auto-attack is off.
    if (e.button === 2 && g.player && g.state === 'play' && g.player.abilityUlt) useUltimate();
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) input.mouse.down = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  // wheel swap is cooldown-gated: trackpad inertia fires dozens of wheel events
  // per flick, which would machine-gun the two-slot toggle
  let lastWheelSwap = -Infinity;
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (g.showPatch) { g.patchScroll = Math.max(0, (g.patchScroll || 0) + e.deltaY); return; } // #76 scroll the changelog
    if (g.showAchievements) { g.achScroll = Math.max(0, (g.achScroll || 0) + e.deltaY); return; } // #86 scroll the accolades
    // #156 the class strip scrolls on the title screen (15 classes, 6 visible)
    if (g.state === 'title' && typeof UI !== 'undefined' && UI.scrollClasses) {
      UI.scrollClasses(e.deltaY > 0 ? 1 : -1);
      return;
    }
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
    monsters: [], projectiles: [], pickups: [], mercs: [], mines: [], turrets: [], summon: null,
    boss: null, bossIntroT: 0, winTimer: -1, portal: null,
    mythicFx: null, // #123 active mythic-drop fanfare {t,dur,name,color}
    // --- Descent (endless mode) ---
    kingSlain: false,        // slew the floor-3 Gilded King (scoreboard crown)
    circleBossSeen: 0,       // recurring-boss counter (drives recolor + anger)
    descentPortal: null,     // {room,x,y,t,toad} - one-way plunge to the next floor
    pendingDescent: null,    // set on boss death; opens the portal after the celebration
    nightmareNext: false,    // #13 the next floor was entered via the NIGHTMARE portal
    floorNightmare: false,   // #13 the CURRENT floor is a nightmare floor (harder + richer)
    toadMsg: null,           // {text,t} - "THE PRINCESS IS IN ANOTHER CASTLE!"
    essenceCheckpoint: 0,    // essence already banked to meta this run (quit-safe descent)
    bossIntroName: 'THE MIMIC KING', bossIntroSub: 'the dungeon was bait all along',
    autoAttack: (() => { try { return localStorage.getItem('drl_auto') === '1'; } catch { return false; } })(),
    playerName: (() => { try { return (localStorage.getItem('drl_name') || '').slice(0, 12); } catch { return ''; } })(),
    evoQueue: [], evoChoices: null, ultChoices: null,
    ultFx: [], midasT: 0,        // active ultimate room-effects + double-gold window
    playerTaunt: { src: null, t: 0 }, // #55 a shielder is forcing you to attack it
    levelChoices: [], levelUpQueue: 0, hoverChoice: -1,
    initials: null, afterInitials: 'dead', newScoreRank: 0, showScores: false, showPatch: false, showMythics: false, scores: loadScores(),
    // --- co-op (multiplayer) ---
    coop: false,                 // true during a networked run
    clientId: coopClientId(),    // #99 stable per-device id, survives reconnect (dedups clone ghosts)
    coopSeed: 0,                 // shared floor seed for the co-op party
    netMobId: 0,                 // host-assigned monster ids (for co-op sync)
    netGearId: 0,                // #96 shared ids for kill-drop gear so grabbing one despawns it for the whole party
    mobSendT: 0,                 // monster-snapshot broadcast throttle
    gearSendT: 0,                // ground-gear-snapshot broadcast throttle (#136)
    lobby: null,                 // {mode,entry,status} while on the lobby screen
    chat: { open: false, buffer: '', log: [] }, // #100 co-op text chat (log: {name,text,t,mine})
    remotePlayers: new Map(),    // id -> {x,y,facing,room,hp,wc,tx,ty,last} (other players)
    netReady: false,             // Net handlers wired once
    posSendT: 0,                 // position-broadcast throttle
    friendlyFire: false,         // #224 PVP Phase 0: swords and arrows hurt teammates (host lobby toggle)
    lobbyFF: false,              // the host's pending choice on the lobby screen
    duelMode: false,             // #240 PVP Phase 1: THE DUEL - sealed arena, rounds, first to 3
    lobbyDuel: false,            // the host's pending duel choice
    duelScore: {},               // uid -> rounds won this set
    duelCountdownT: 0,           // 3-2-1 at round start (fighters invulnerable)
    duelFightT: 0,               // the FIGHT! flash after the countdown
    huntMode: false,             // #241 PVP Phase 2: THE GILDED HUNT - battle royale on a full floor
    lobbyHunt: false,            // the host's pending hunt choice
    huntScore: {},               // uid -> hunts won
    huntSwarmN: 0,               // how many rooms the swarm has consumed (host-clocked, seed-ordered)
    huntSwarmT: 0,               // host: countdown to the next consumption
    huntGraceT: 0,               // spawn grace before anyone can be hurt
    huntCrownRoom: null,         // #243 the swarm-spared centre room where the King's Champion waits
    crownedU: null,              // #243 who holds THE CROWN this hunt (uid)
    huntCueT: 0,                 // #243 throttle for the you-hear-something cue
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
    rules: null,          // FLOOR RULES in force (rules.js). Set by startFloor; never null in play.
    floorRule: null,      // {name, desc, color, t} - the rule card on the floor banner
    runSeed: 0,           // solo run seed; co-op uses coopSeed. Rules derive from it.
    gateMsg: 0,           // "sealed" toast timer
    coopMenu: false,      // co-op pause menu overlay (world stays live behind it)
    plateArmed: null,     // #137 co-op door-plates that have been vacated this room (Set)
    roomSettleT: 0,       // #137 brief post-entry window where no plate can fire
    strandT: 0,           // #137 how long the whole party has been in an adjacent room without me
    shopMsg: null,        // {text, t}
    time: 0,
    queueLevelUp() { this.levelUpQueue++; },
    onKill(m) { onKill(m); },
    spawnPickup(kind, x, y, local) { spawnPickup(kind, x, y, local); }, // loot-goblin coin spill (monsters.js), quest payouts (encounters.js)
    mythicFanfare(x, y, item) { mythicFanfare(x, y, item); },           // THE PACT pays a mythic, and it deserves the full celebration
    dropMine(x, y, dmg) { g.mines.push({ x, y, r: 8, blastR: 105, dmg: Math.round(dmg * 3.2), t: 0, armT: 0.6, armed: false, fuse: -1 }); }, // minelayer - TERRIFYING blast (big dmg + radius)
    onPlayerDeath() { onPlayerDeath(); },
    dropWeaponPickup(w, x, y) { this.pickups.push({ kind: 'weapon', weapon: w, x, y, t: 0 }); },
    dropArmorPickup(a, x, y) { this.pickups.push({ kind: 'armorItem', armor: a, x, y, t: 0 }); },
    dropTrinketPickup(t, x, y) { this.pickups.push({ kind: 'trinketItem', trinket: t, x, y, t: 0 }); }, // #134
    recordMythic(item) { recordMythic(item); },
    saveMeta() { saveMeta(); }, // #86 lets the achievements module persist unlocks
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

  // #123 MYTHIC DROP FANFARE: when a Warden coughs up a mythic, the moment earns real
  // weight - a hit-stop punch, a gold eruption at the drop, and a screen flash + banner.
  function mythicFanfare(x, y, item) {
    Fx.hitstop(0.12);
    Fx.shake(9, 0.55);
    Fx.burst(x, y, ['#ffd24c', '#fff2a0', '#e8b52f'], 44, { speed: 250, life: 0.95, glow: true });
    Fx.burst(x, y, ['#ffffff', '#ffe9a8'], 26, { speed: 120, life: 1.4, glow: true });
    Sfx.play('mythic');
    const name = (Weapons.displayName ? Weapons.displayName(item) : (item.name || 'MYTHIC'));
    g.mythicFx = { t: 0, dur: 2.6, name, color: item.color || '#ffd24c' };
  }
  function drawMythicFanfare(c) {
    const f = g.mythicFx; if (!f) return;
    const k = f.t / f.dur;
    c.save();
    // a golden screen flash, brightest at the instant of the drop then gone fast
    const flash = Math.max(0, 0.42 * (1 - f.t / 0.5));
    if (flash > 0) { c.globalAlpha = flash; c.fillStyle = '#ffe9a8'; c.fillRect(0, 0, W, H); }
    // expanding gold rings from centre
    c.globalAlpha = Math.max(0, 1 - k) * 0.55; c.strokeStyle = '#ffd24c'; c.lineWidth = 3;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(W / 2, H / 2, f.t * 520 + i * 72, 0, Math.PI * 2); c.stroke(); }
    // banner: scales in, holds, fades out at the end
    const appear = Math.min(1, f.t / 0.25);
    const fade = f.t > f.dur - 0.5 ? Math.max(0, (f.dur - f.t) / 0.5) : 1;
    c.globalAlpha = fade; c.textAlign = 'center';
    c.save();
    c.translate(W / 2, H / 2 - 40);
    c.scale(0.6 + appear * 0.4, 0.6 + appear * 0.4);
    c.font = 'bold 34px monospace'; c.fillStyle = '#241a08'; c.fillText('✦ MYTHIC ✦', 3, 3);
    c.fillStyle = '#ffd24c'; c.fillText('✦ MYTHIC ✦', 0, 0);
    c.restore();
    c.font = 'bold 20px monospace'; c.fillStyle = f.color; c.fillText(f.name, W / 2, H / 2 + 6);
    c.globalAlpha = 1;
    c.restore();
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
    g.runSeed = (Math.random() * 1e9) | 0; // solo: seeds the per-floor RULE rolls
    g.rules = Rules.none();                // floors 1-3 have no circle rules
    g.player = new PlayerDef.Player(g.meta);
    g.player.coinsTotal = 0;
    // reset ALL per-run state (a stale level-up queue once leaked into a fresh run)
    g.essenceEarned = 0;
    g.levelUpQueue = 0;
    g.levelChoices = [];
    g.evoQueue = [];
    g.evoChoices = null;
    g.leveling = false; g.peerBusy = {}; g.peerDone = {}; g.pendingFloor = null; // #32 gate reset (+#236 deferred floor)
    g.levelWaitT = 0; g.pendingCoopRoom = null; g.pendingChoices = null; // #199
    g.rerollCount = 0; g.rerollDenyT = 0; // #20 paid-reroll counter
    g.winTimer = -1;
    g.deathTimer = -1;
    g.mythicFx = null; // #123 clear any lingering fanfare
    g.runEnded = false;
    g.retired = false;
    g.boss = null;
    g.transition = null;
    g.gateMsg = 0;
    g.shopMsg = null;
    // reset Descent state
    g.mercs = [];
    g.turrets = [];
    g.summon = null; g.summon2 = null; // #229
    g.kingSlain = false;
    g.circleBossSeen = 0;
    g.descentPortal = null;
    g.pendingDescent = null;
    g.nightmareNext = false;
    g.floorNightmare = false;
    g.toadMsg = null;
    g.essenceCheckpoint = 0;
    // a pet chosen from the home-screen stable starts the run at your side
    if (g.meta.selectedPet && (g.meta.petsUnlocked || []).includes(g.meta.selectedPet)) {
      const def = petDefByType(g.meta.selectedPet);
      if (def) g.player.adoptPet(def);
    }
    if (typeof Ach !== 'undefined') Ach.startRun(g); // #86 record the class + reset run stats
    startFloor();
    g.state = 'play';
    Sfx.play('door');
  }

  function startFloor() {
    g.coopMenu = false; // never carry a menu overlay across a floor
    // #13 (Sam) this floor is a NIGHTMARE floor if you took the nightmare portal to reach
    // it (host sets nightmareNext locally; a co-op guest gets it from the 'floor' message).
    g.floorNightmare = !!g.nightmareNext;
    g.nightmareNext = false;
    // co-op: everyone builds the SAME floor from the shared run seed
    g.dungeon = Dungeon.generateFloor(g.floorNum, g.coop ? g.coopSeed : undefined);
    g.portal = null; // portals never carry across floors
    g.oracleMark = null; g.goose = null; g.decoy = null; // #257 prophecies, geese and mirages don't either
    g.alarm = 0;     // #77 the dungeon's alertness resets each floor (rises per room cleared)
    if (typeof Ach !== 'undefined') Ach.floor(g.floorNum, g); // #86 depth + reset no-hit tracking
    const theme = Dungeon.themeFor(g.floorNum);
    // the RULES in force on this floor (the circle's signature rule, plus mutators).
    // Derived from floor + run seed only, so co-op peers agree without syncing it.
    g.rules = Rules.forFloor(g.floorNum, g.coop ? g.coopSeed : g.runSeed);
    // a quest lives and dies on ONE floor. Take the stairs with it unfinished and it
    // is simply gone - that is the cost of leaving early.
    g.quest = null; g.offer = null; g.pactRule = null;
    g.vowIntact = false; g.huntKills = 0; g.huntTarget = 12; g.titheAmount = 0;
    g.floorBanner = { text: `FLOOR ${g.floorNum} · ${theme.name}`, t: 3.5 };
    // the floor card names EVERY rule in force (the circle's, plus any mutators), so
    // it is never a mystery why you are suddenly sliding, on fire, or swarmed
    g.floorRule = g.rules.list.length
      ? { lines: g.rules.list.map(r => ({ name: r.name, desc: r.desc, color: r.color })), t: 5.5 }
      : null;
    // #13 a nightmare floor announces itself: harder, and far richer.
    if (g.floorNightmare) {
      g.floorBanner = { text: `NIGHTMARE · FLOOR ${g.floorNum}`, t: 4.0, sub: `${theme.name} · far deadlier, far richer` };
      Sfx.play('roar'); Fx.shake(6, 0.45);
    }

    // ===================== BREAKING THROUGH THE ICE =========================
    // The single biggest beat in the game: you reach the bottom of Hell, and the
    // bottom of Hell is not a wall. You go THROUGH it, gravity turns over, and you
    // come out under a sky. The run stops falling and starts climbing.
    //
    // Toad's joke has been curdling the whole way down ("the castle is inside you
    // now"). Here it finally breaks, and he says the only straight thing he has
    // ever said to you.
    if (typeof Ascent !== 'undefined' && Ascent.onShore(g.floorNum)) {
      g.floorBanner = { text: 'YOU BREAK THROUGH THE BOTTOM OF HELL', t: 5.0,
                        sub: 'gravity turns over. the falling stops.' };
      g.toadMsg = { text: Ascent.SHORE_LINE, t: 7 };
      Fx.shake(11, 0.9);
      Sfx.play('roar');
      // the ice giving way beneath you, and then the light
      Fx.burst(PF.x + PF.w / 2, PF.y + PF.h / 2, ['#7fd4ff', '#cfeeff', '#ffffff'], 48,
        { speed: 260, life: 1.3, glow: true, size: 2.6 });
    }

    // ===================== THE SUMMIT, AND THE FLIGHT =======================
    // The top of the mountain is the top of the WORLD. There is no more ground to
    // climb, so from here you leave it.
    if (typeof Ascent !== 'undefined' && Ascent.onSummit(g.floorNum)) {
      g.floorBanner = { text: 'THE TOP OF THE WORLD', t: 5.0,
                        sub: 'the mountain ends here. the sky does not.' };
      g.toadMsg = { text: Ascent.SUMMIT_LINE, t: 6.5 };
      Fx.burst(PF.x + PF.w / 2, PF.y + PF.h / 2, ['#b7f0c0', '#eaf7ea', '#ffd24c'], 40,
        { speed: 190, life: 1.6, glow: true, size: 2.2, grav: -40 });
    }
    if (typeof Paradiso !== 'undefined' && g.floorNum === Paradiso.FIRST_SPHERE) {
      g.floorBanner = { text: 'YOU RISE', t: 5.0, sub: 'the earth lets go of you.' };
      g.toadMsg = { text: Paradiso.RISE_LINE, t: 6.5 };
      Fx.burst(PF.x + PF.w / 2, PF.y + PF.h / 2, ['#ffffff', '#cfd8f0'], 50,
        { speed: 230, life: 1.8, glow: true, size: 2.4, grav: -60 });
    }

    // ===================== THE EMPYREAN: THE END OF THE BOOK ================
    // Thirty floors of Toad telling you the princess is in another castle. Here is
    // another castle. It is the last one, and she is in it, and he was never lying.
    if (typeof Paradiso !== 'undefined' && Paradiso.inEmpyrean(g.floorNum)) {
      g.floorBanner = { text: 'THE EMPYREAN', t: 6.0, sub: 'the light that moves the sun and the other stars' };
      g.toadMsg = { text: Paradiso.EMPYREAN_LINE, t: 9 };
      Sfx.play('levelup');
      Fx.shake(4, 0.5);
      for (let i = 0; i < 3; i++) {
        Fx.burst(PF.x + PF.w / 2, PF.y + PF.h / 2, ['#ffffff', '#ffe9a8', '#c9a227'], 40,
          { speed: 120 + i * 90, life: 2.2, glow: true, size: 2.6, grav: -30 });
      }
    }
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
    // #78 turrets don't follow: leaving a room with a live turret refunds 80% of its
    // charge recharge (a fast 2s instead of the full 10s), so abandoning them is cheap.
    if (g.turrets && g.turrets.length && g.player) {
      for (const tr of g.turrets) if (!tr.dead) g.player.turretRecharge.push(2);
      g.turrets = [];
    }
    // drops are persistent: whatever was left on this room's floor is still there
    if (g.room) g.room.savedPickups = g.pickups;
    g.room = room;
    room.visited = true;
    computeBacktrackDist(); // #34: how far are we from the nearest unexplored room?
    g.monsters = [];
    g.projectiles = [];
    g.mines = [];
    g.gluePuddles = []; // #179 glue does not follow you between rooms
    g.ultFx = [];
    g.playerTaunt = { src: null, t: 0 }; // taunts don't carry between rooms
    g.pickups = room.savedPickups || [];
    g.plateArmed = new Set(); // #137 all door-plates start disarmed (arm on first vacate)
    g.plateHold = {};         // #235 dwell timers reset with the room
    g.roomSettleT = 0.4;      // and no plate fires for the first 0.4s, so remote positions settle first
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
      g.enterFrom = enterFrom; // #68 which side the player entered on (formations stage opposite)
    } else {
      p.x = PF.x + PF.w / 2; p.y = PF.y + PF.h / 2;
      g.enterFrom = null;
    }

    // hired mercenaries travel with you: drop them in beside the player
    for (const merc of g.mercs) { merc.x = p.x - 30 + Math.random() * 60; merc.y = p.y + 34; }
    // pet travels with you too - snap it beside the player (was left across the room)
    if (p.pet) { p.pet.x = p.x - 24; p.pet.y = p.y - 18; }
    // #78/#90 the Summoner's elemental persists across rooms - snap it to the
    // summoner's NEW side (must run AFTER the player is placed at the door, or it
    // gets stranded at the previous room's exit)
    if (g.summon && !g.summon.dead) { g.summon.x = p.x - 26; g.summon.y = p.y + 18; }
    if (g.summon2 && !g.summon2.dead) { g.summon2.x = p.x + 26; g.summon2.y = p.y + 18; } // #229

    if (room.type === 'boss' && !room.cleared) {
      g.state = 'bossintro';
      g.bossIntroT = 0;
      p.drawT = -1; // don't let a held draw fire mid-intro
      // pick which King you face: the gold Gilded King on floor 3, or a recolored,
      // angrier Circle Warden in the Descent. Config is rolled ONCE here (it
      // advances the anger counter) and consumed when the boss actually spawns.
      // #251 (Sam) THE HARPY. Everyone kept asking what the shadow over the canopy
      // was - now the forest answers. She is the FIRST boss anyone ever meets, so the
      // numbers are gentle (matriarch kit at ~30% hp, half damage). forest:true keeps
      // her from counting as the King (victory bonus, accolades) or as a Warden
      // (descent essence, mythics) - she is her own thing.
      g.pendingBossCfg = (typeof Descent !== 'undefined' && Descent.isDescent(g.floorNum))
        ? Descent.bossConfig(g)
        : (g.floorNum === 1 ? {
            anger: 0, variant: 'matriarch', skin: 'harpy', forest: true,
            name: 'THE HARPY', subtitle: 'the shadow over the canopy comes down',
            hpMul: 0.30, dmgMul: 0.5,
            pal: { body: '#4a3a20', lidLo: '#31260f', lid: '#5c4a28', trim: '#e8b52f', crown: '#ffd24c', jewel: [232, 181, 47] },
          } : null);
      // THE EMPYREAN. Not another recoloured Warden - the ORIGINAL, the one from floor
      // 3, gold again, waiting at the top of Heaven in the last castle. That is the
      // whole joke and it only works if he looks like himself.
      if (typeof Paradiso !== 'undefined' && Paradiso.inEmpyrean(g.floorNum) && g.pendingBossCfg) {
        const t = Descent.threat(g.floorNum);
        g.pendingBossCfg = {
          anger: g.pendingBossCfg.anger,
          variant: 'king',
          pal: { body: '#8a6a1e', lidLo: '#6a5016', lid: '#a07d24', trim: '#ffd24c', crown: '#ffe08a', jewel: [255, 225, 120] },
          name: 'THE GILDED KING',
          subtitle: 'he has been waiting at the top the whole time',
          hpMul: t.hp * 2.2,     // the last fight in the book. It should be the hardest.
          dmgMul: t.dmg * 1.25,
        };
      }
      g.bossIntroName = g.pendingBossCfg ? g.pendingBossCfg.name : 'THE MIMIC KING';
      g.bossIntroSub = g.pendingBossCfg ? g.pendingBossCfg.subtitle : 'the dungeon was bait all along';
      Sfx.play('roar');
      return;
    }
    // #242 (Phase 3) THE THIRD FORCE: hunt monsters are INSTANCED PER PLAYER, like
    // the loot - you fight YOUR dungeon, your opponent fights theirs, zero sync
    // (their rooms are invisible to you anyway). ~2/3 density, solo-scaled, doors
    // never seal so fleeing is always an option. A fled room stays cleared out.
    if (g.huntMode) {
      room.cleared = true;
      if ((room.type === 'combat' || room.type === 'trap') && !room.spawned) {
        room.spawned = true;
        g.monsters = Monsters.spawnForRoom(room, g.floorNum, g).filter((_, i) => i % 3 !== 2);
        progressionScaleMonsters(g.monsters);
      } else {
        g.monsters = [];
      }
      // #243 THE KING'S CHAMPION: a gold-clad giant holding the crown, waiting in the
      // centre room. Yours, instanced - beating it before your opponent beats theirs
      // is the race that ends most hunts.
      if (room === g.huntCrownRoom && !room.kingDown && g.crownedU === null) {
        const K = Monsters.make('tank', 5);
        K.maxHp = K.hp = Math.round(K.maxHp * 6);
        K.dmg = Math.round(K.dmg * 1.4);
        K.r = Math.round(K.r * 1.5);
        K.elite = true; K.kingGuard = true; K.spawnT = 1.2;
        K.x = PF.x + PF.w / 2; K.y = PF.y + PF.h / 2;
        g.monsters.push(K);
        g.floorBanner = { text: "THE KING'S CHAMPION", t: 3, sub: 'fell him and the crown is yours' };
        Sfx.play('roar');
      }
    }
    if ((room.type === 'combat') && !room.spawned) {
      room.spawned = true;
      if (isCoopGuest()) {
        g.monsters = []; // guest: the host owns the monsters; they arrive via snapshots
      } else {
        g.monsters = Monsters.spawnForRoom(room, g.floorNum, g);
        coopScaleMonsters(g.monsters);                        // co-op: tougher for the party
        progressionScaleMonsters(g.monsters);                 // #12 descent gauntlet: the wall + rubber-band
        nightmareScaleMonsters(g.monsters);                   // #13 nightmare floor: tougher still
        // #185 (Sam) AN ALERT DUNGEON REACTS. Once the alarm is up (4+ rooms cleared
        // this floor), mobs no longer wake up slowly when you walk in - they are
        // already facing your door, weapons up, and attack almost immediately.
        if ((g.alarm || 0) >= 4) {
          const enterA = g.enterFrom === 'N' ? -Math.PI / 2 : g.enterFrom === 'S' ? Math.PI / 2 : g.enterFrom === 'W' ? Math.PI : 0;
          for (const m of g.monsters) {
            m.spawnT = Math.min(m.spawnT, 0.08);  // barely any wake-up grace
            m.facing = enterA + Math.PI;          // eyes on YOUR door
            m.t = 1.2;                             // most AIs gate the first attack on m.t - primed
          }
        }
        for (const m of g.monsters) m.netId = ++g.netMobId;   // stamp for co-op sync
      }
      // #185 at alarm 5+, the dungeon SETS TRAPS for you: glue laid by your door before
      // you arrive. Deterministic from the room + floor so co-op clients see identical
      // puddles (each client computes its own copy on entry - no sync needed).
      if ((g.alarm || 0) >= 5 && g.enterFrom) {
        const p0 = g.player;
        const h0 = ((room.gx * 2654435761) ^ (room.gy * 40503) ^ (g.floorNum * 69069)) >>> 0;
        const rr = n => ((h0 >> (n * 4)) % 1000) / 1000;
        const n = 2 + (h0 % 2);
        for (let i = 0; i < n; i++) {
          const a = rr(i) * Math.PI * 2, d = 70 + rr(i + 2) * 70;
          const gx2 = Math.max(PF.x + 30, Math.min(PF.x + PF.w - 30, p0.x + Math.cos(a) * d));
          const gy2 = Math.max(PF.y + 30, Math.min(PF.y + PF.h - 30, p0.y + Math.sin(a) * d));
          g.gluePuddles.push({ x: gx2, y: gy2, r: 30, t: 12, max: 12 });
        }
        Fx.text(p0.x, p0.y - 44, 'THEY KNEW YOU WERE COMING', '#ff8a3d', 12);
      }
      Sfx.play('door'); // doors slam
      // #148 (Sam) doppelganger mini-boss entrance
      if (room.doppelRoom) {
        g.floorBanner = { text: 'YOUR SHADOW STIRS', t: 2.6, sub: 'it wears your face, and your weapons' };
        Sfx.play('roar');
      }
      // #27 themed-room banner (an all-one-type gauntlet)
      if (room.enemyTheme) {
        const NAME = { archer: 'AMBUSH', bomber: 'MINEFIELD', swarmer: 'SWARM', glass: 'ARTILLERY', shielded: 'PHALANX', seeker: 'THE HUNT', miner: 'MINEFIELD', pulser: 'BULLET HELL', worm: 'THE NEST', chaser: 'THE HORDE' };
        g.floorBanner = { text: `${NAME[room.enemyTheme] || 'GAUNTLET'}`, t: 2.2, sub: `nothing here but ${room.enemyTheme}s` };
      }
    }
    if ((room.type === 'shop' || room.type === 'mythicshop') && !room.shopStock) {
      if (room.type === 'mythicshop') rollMythicShopStock(room); else rollShopStock(room);
    }
    if (room.type === 'barracks' && !room.barracks) rollBarracksStock(room); // #75
    // #184 (Sam) WRATH'S SMOKE. Envy is a clean black circle; Wrath was just "mobs
    // pop in closer" - the two terraces read identical. Now Wrath has its OWN look:
    // banks of bitter black smoke drifting visibly across the room. Deterministic
    // from the room's coordinates, so co-op clients see the same smoke.
    if (g.rules && g.rules.fade !== Infinity) {
      const h0 = ((room.gx * 73856093) ^ (room.gy * 19349663) ^ (g.floorNum * 83492791)) >>> 0;
      const rr = (n) => ((h0 >> (n * 3)) % 1000) / 1000;
      g.smokeBanks = [];
      const n = 4 + (h0 % 3);
      for (let i = 0; i < n; i++) {
        g.smokeBanks.push({
          x: PF.x + 60 + rr(i) * (PF.w - 120), y: PF.y + 50 + rr(i + 3) * (PF.h - 100),
          r: 70 + rr(i + 6) * 60, vx: (rr(i + 9) - 0.5) * 26, vy: (rr(i + 12) - 0.5) * 14,
          ph: rr(i + 15) * 6.28,
        });
      }
    } else g.smokeBanks = null;
    // #214/#215 deferred host-side spawns: a mimic sprung (or a trap chest opened) by
    // a teammate while the host was elsewhere spawns the moment the host walks in.
    if (!isCoopGuest()) {
      for (const ch of room.chests || []) {
        if (ch.pendingMimic && ch.opened) {
          ch.pendingMimic = false;
          const tier = Monsters.tierFor(g.floorNum, room.dist);
          const mm = Monsters.make('mimic', ch.x, ch.y, tier);
          mm.netId = ++g.netMobId;
          g.monsters.push(mm);
          room.cleared = false;
        }
      }
      if (room.type === 'trap' && room.trapChest && room.trapChest.opened && room.trapPending && !room.spawned) {
        room.trapPending = false;
        room.spawned = true;
        room.cleared = false;
        g.monsters = Monsters.spawnForRoom(room, g.floorNum + 1, g);
        coopScaleMonsters(g.monsters);
        progressionScaleMonsters(g.monsters);
        nightmareScaleMonsters(g.monsters);
        for (const mm of g.monsters) mm.netId = ++g.netMobId;
      }
    }
    // #183 (Sam) THE BIRD. On forest floors, every third room you enter, something
    // enormous glides over the canopy. #251: it is THE HARPY, the floor-1 boss -
    // the shadow is her, telegraphed. Still pure atmosphere until the boss room.
    try {
      const th = Dungeon.themeFor(g.floorNum);
      if (th && /FOREST/i.test(th.name || '')) {
        g.forestRooms = (g.forestRooms || 0) + 1;
        if (g.forestRooms % 3 === 0) {
          const fromLeft = (g.forestRooms / 3) % 2 === 0;
          g.birdShadow = { t: 0, dur: 3.4, fromLeft, y: PF.y + 90 + (g.forestRooms * 53) % (PF.h - 180) };
        }
      }
    } catch (e) { /* atmosphere must never break a room load */ }
    // #181 (Sam) TRAP ROOM: a locked chest waits dead-center. Nothing spawns on entry -
    // the ambush is armed by OPENING the chest.
    if (room.type === 'trap' && !room.trapChest) {
      room.trapChest = { x: PF.x + PF.w / 2, y: PF.y + PF.h / 2, opened: false, looted: false };
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
        // #134 the sixth shop slot is usually a reroll, but ~40% of the time it is a
        // TRINKET instead - a rare, real decision for the fourth slot, excluding one
        // you already carry. This is the main way you find trinkets.
        (Math.random() < 0.4
          ? { kind: 'trinket', trinket: Trinkets.rollTrinket({ exclude: g.player && g.player.trinket ? [g.player.trinket.key] : [] }), x: PF.x + 540, y: PF.y + 320 }
          : { kind: 'reroll', x: PF.x + 540, y: PF.y + 320 }),
      ],
      rerolls: 0,
      // #50 the shopkeeper you can haggle with (once per shop). Position matches
      // the hooded merchant already drawn in drawShop so you press the visible NPC.
      keeper: { x: PF.x + PF.w / 2, y: PF.y + 62 },
      haggled: false,
      // #60 enchant table: spend gold + shards to re-roll your weapon's enchants.
      // Moved (Sam) off the bottom-centre - it used to sit in the SOUTH door lane and
      // right against the bottom wall - to the right end of the services row, clear of
      // every door lane and every other stall.
      enchTable: { x: PF.x + 720, y: PF.y + 320 },
      // #187 (Sam) the CRAFTING CORNER, right beside the enchant table: an anvil that
      // forges a weapon of the archetype you are holding, and a mannequin that tailors
      // armor. Costs gold + salvage shards; price climbs per use so it cannot be spammed.
      craft: { anvil: { x: PF.x + 795, y: PF.y + 320, uses: 0 }, dummy: { x: PF.x + 848, y: PF.y + 320, uses: 0 } },
      enchUses: 0,
    };
    for (const it of room.shopStock.items) {
      if (it.kind === 'weapon') it.price = it.weapon.price;
      if (it.kind === 'armor') it.price = it.armor.price;
      if (it.kind === 'trinket') it.price = it.trinket.price; // #134
      if (it.kind === 'potion') it.price = POTION_PRICE;
      if (it.kind === 'reroll') it.price = REROLL_BASE;
    }
  }

  // #75 training barracks: five stations, one per base stat. Spend GOLD for a
  // run-only boost to that stat's power (no evolution progress). Cost climbs per use.
  const BARRACKS_STATS = [
    { stat: 'MIGHT',   color: '#ffd24c', label: '+8% damage',       apply: p => { p.stats.dmgMul += 0.08; } },
    { stat: 'VIGOR',   color: '#6ee7a0', label: '+20 max health',   apply: p => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); } },
    { stat: 'AGILITY', color: '#7fd4ff', label: '+6% move speed',   apply: p => { p.stats.speedMul += 0.06; } },
    { stat: 'ARCANE',  color: '#b06bff', label: '+12% spell power', apply: p => { p.applyEvolution({ spellPower: 0.12 }); } },
    { stat: 'FORTUNE', color: '#ffce54', label: '+15% coins',       apply: p => { p.stats.coinMul += 0.15; } },
  ];
  // #167 (Sam) ANTI-ABUSE: the cost climbs off a per-RUN counter on the player, NOT a
  // per-station one that reset to 30 on every new barracks floor. Before this, a rich
  // player (hold-E to auto-buy) stacked dozens of cheap +8% MIGHT boosts on each of the
  // many barracks floors and steamrolled the Descent, defeating descent scaling. Now every
  // boost anywhere costs more than the last, and a hard per-run cap ends it outright.
  const BARRACKS_CAP = 12; // total trainings a single run can ever buy
  const barracksTrained = () => (g.player && g.player.barracksTrained) || 0;
  const barracksCost = () => 30 + 30 * barracksTrained();
  const barracksMaxed = () => barracksTrained() >= BARRACKS_CAP;
  function rollBarracksStock(room) {
    room.barracks = {
      trainer: { x: PF.x + PF.w / 2, y: PF.y + 100 }, // #125 was +66: head overlapped the subtitle text
      stations: BARRACKS_STATS.map((s, i) => ({ stat: s.stat, color: s.color, label: s.label, apply: s.apply, x: PF.x + 132 + i * 150, y: PF.y + PF.h - 128, uses: 0 })),
    };
  }

  // the secret mythic shop: three hand-built uniques, no potions, no rerolls
  function rollMythicShopStock(room) {
    const tier = Monsters.tierFor(g.floorNum, room.dist);
    const owned = g.meta.mythics || [];
    const w1 = Weapons.rollMythic('weapon', { exclude: owned, tier });
    const w2 = Weapons.rollMythic('weapon', { exclude: [...owned, w1.mythicId], tier });
    const a1 = Weapons.rollMythic('armor', { exclude: owned, tier });
    // #154 (Sam) the secret shop now also carries one MYTHIC TRINKET - the only place to
    // find the legendary tier of the fourth slot.
    const trk = Trinkets.rollMythicTrinket({ exclude: g.player && g.player.trinket ? [g.player.trinket.key] : [] });
    const items = [
      { kind: 'weapon',  weapon: w1,  x: PF.x + 150, y: PF.y + 210 },
      { kind: 'weapon',  weapon: w2,  x: PF.x + 350, y: PF.y + 210 },
      { kind: 'armor',   armor: a1,   x: PF.x + 550, y: PF.y + 210 },
      { kind: 'trinket', trinket: trk, x: PF.x + 730, y: PF.y + 210 },
    ];
    for (const it of items) it.price = (it.weapon || it.armor || it.trinket).price;
    room.shopStock = { items, rerolls: 0, mythic: true };
  }

  // ============================ KILLS / LOOT ============================
  // #207 raise one skeleton at (x, y) for the LOCAL player, honouring their cap/scaling
  function riseSkeleton(x, y) {
    const p = g.player; if (!p) return;
    const cap = 3 + 2 * (p.undeadTier || 1);            // 5 / 7 / 9 as Raise Dead tiers up
    const alive = g.mercs.filter(s => s.bone && !s.dead).length;
    if (alive >= cap) return;
    const arc = (p.statPoints && p.statPoints.ARCANE) || 0;
    const scale = 1 + 0.10 * arc + 0.05 * ((p.level | 0) - 1);
    const s = makeMercFollower({ cls: 'blade' }, g.floorNum);
    s.bone = true; s.color = '#cfe6cf';
    s.dmg = Math.round(s.dmg * scale); s.maxHp = s.hp = Math.round(s.maxHp * scale);
    s.x = x; s.y = y;                                    // rises where it fell
    g.mercs.push(s);
    Fx.text(x, y - 18, 'RISE', '#9ae6a0', 11);
    Fx.burst(x, y, ['#9ae6a0', '#e6efe6', '#3a5a40'], 12, { speed: 120, life: 0.5, glow: true });
  }

  // #213 (co-op review P1-8) the parts of a kill that belong to the KILLER - kill
  // count, weapon procs, race/evolution hooks, achievements, quest counters - run on
  // the killer's own client with the killer's own gear and mods.
  function killerPerks(x, y, ty, elite) {
    const p = g.player; if (!p) return;
    p.kills++;
    if (p.race && p.race.id === 'undead') {
      const h = p.mod('healOnKill') || 0;
      if (h > 0) p.heal(h);
    }
    if (g.quest && g.quest.key === 'hunt') g.huntKills = (g.huntKills || 0) + 1; // THE HUNT
    if (typeof Ach !== 'undefined') Ach.kill({ type: ty, elite: !!elite }, g);
    const w = p.weapon;
    if (Weapons.has(w, 'momentum')) p.momentumT = 1.2;
    if (Weapons.has(w, 'vampiric')) p.heal(2);
    if (p.mod('soulFeast') && Math.hypot(x - p.x, y - p.y) < 140) {
      p.heal(Math.max(1, Math.round(p.maxHp * p.mod('soulFeast') / 100)), true);
    }
    if (p.mod('rollReset') && p.rollCd > 0) p.rollCd -= p.mod('rollReset');
  }

  function onKill(m) {
    const p = g.player;
    // #213 credit the killer: a remote player's kill sends their perks TO them; a
    // local kill runs them here. (m._lastHitBy is stamped by the 'hit' handler.)
    const killerRp = m._lastHitBy ? g.remotePlayers.get(m._lastHitBy) : null;
    if (killerRp && typeof Net !== 'undefined') {
      Net.sendR({ t: 'kill', to: m._lastHitBy, tu: killerRp.u || 0, x: Math.round(m.x), y: Math.round(m.y), ty: m.type, el: m.elite ? 1 : 0 }); // #222 tu: stable uid, in case their socket id changed
    } else {
      killerPerks(m.x, m.y, m.type, m.elite);
    }
    // #254 fusion kill-hooks (LOCAL kills only - remote killers run their own)
    if (!killerRp && p.fstance) {
      const fs = p.fstance;
      if (fs.id === 'eldorado') { // the gilded city: gold fountains, fever builds
        for (let i = 0; i < 3; i++) spawnPickup('coin', m.x, m.y);
        fs.dmgStack = Math.min(0.3, (fs.dmgStack || 0) + 0.03);
      }
      if (fs.id === 'goldrush') { // the rush: kills pay and hasten your Q
        for (let i = 0; i < 2; i++) spawnPickup('coin', m.x, m.y);
        if (p.ability && p.ability.cd > 0) p.ability.cd = Math.max(0, p.ability.cd - 0.5);
      }
    }
    if (m.ransom && !killerRp) { // #254 KING'S RANSOM: the marked head pays double
      for (let i = 0; i < 14; i++) spawnPickup('coin', m.x, m.y);
      dropGearInstanced('weapon', m.x, m.y - 16, { tier: 2, minRarity: 3 });
    }
    // #158 (Sam) NECROMANCER: what sets it apart from the summoner - the dead you make RISE
    // to serve. A share of your kills reanimate as skeletons ON THE SPOT, up to a growing
    // cap, so the army is built from the battlefield, not conjured from nothing.
    // #207 (Sam, playtest) the rise belongs to whoever LANDED the kill. Before, this
    // only ever checked the host's class: a GUEST necromancer never raised a single
    // skeleton in co-op, and a host necro reanimated from the guest's kills too.
    if (!m.isBoss && m.type !== 'goblin') {
      if (killerRp) {
        // a REMOTE player's kill: if they are the necromancer, send the rise to THEM
        // (their client owns their mercs, their cap, their scaling). One 40% roll here.
        if (killerRp.cl === 'necromancer' && Math.random() < 0.4 && typeof Net !== 'undefined') {
          Net.sendR({ t: 'rise', to: m._lastHitBy, tu: killerRp.u || 0, x: Math.round(m.x), y: Math.round(m.y) }); // #222
        }
      } else if (p.class && p.class.id === 'necromancer' && Math.random() < 0.4) {
        riseSkeleton(m.x, m.y);
      }
    }
    // #156 PYROMANCER: the fire spreads from the dying to the living. A monster that
    // dies while burning lights everything near it - a room can chain itself down.
    if (g.pyroSpread && g.pyroSpread.t > 0 && m.burn) {
      const R = 120 * (g.pyroSpread.rm || 1); // #229 R4: the fire leaps farther from the dying
      for (const o of g.monsters) {
        if (o.dead || o === m || o.burn) continue;
        if (Math.hypot(o.x - m.x, o.y - m.y) < R) {
          o.burn = { t: g.pyroSpread.dur, tick: 0, dps: g.pyroSpread.dps };
          Fx.burst(o.x, o.y, ['#ff8a3d', '#ffd24c'], 10, { speed: 120, life: 0.4, glow: true });
        }
      }
      // #229 R12: a burning death is an EXPLOSION - self-scaling (15% of the dead
      // monster's max HP) so the chain reaction works at every depth
      if (g.pyroSpread.boom) {
        Fx.burst(m.x, m.y, ['#ff5a2c', '#ffcc44', '#fff'], 26, { speed: 260, life: 0.5, glow: true });
        Fx.shake(3, 0.12); Sfx.play('explode');
        for (const o of g.monsters) {
          if (o.dead || o === m || o.airborne || o.spawnT > 0) continue;
          if (Math.hypot(o.x - m.x, o.y - m.y) < 90 + o.r) o.takeHit(Math.max(6, Math.round(m.maxHp * 0.15)), { sx: m.x, sy: m.y, knock: 130, fromPlayer: true, hitSfx: 'hitHeavy' }, g);
        }
      }
    }
    // #243 the crown is claimed: full heal, a visible power surge, and the whole
    // floor hears about it - the endgame starts NOW
    if (m.kingGuard && g.huntMode && !g.crownedU) {
      g.crownedU = g.clientId;
      if (g.room) g.room.kingDown = true;
      p.hp = p.maxHp;
      const payload = { t: 'crown', w: g.clientId };
      if (typeof Net !== 'undefined') Net.sendR(payload);
      applyCrown(payload);
    }
    // #230 DK R12: anything the MIASMA's poison kills rises as the death knight's
    // skeleton for 30 seconds - a rolling wave of the recently dead (cap 6)
    if (m._dkRise && p.class && p.class.id === 'deathknight' && !m.isBoss) {
      const dkCount = g.mercs.filter(x => x.dkTemp && !x.dead).length;
      if (dkCount < 6) {
        const sk = makeMercFollower({ cls: 'blade' }, g.floorNum);
        sk.bone = true; sk.dkTemp = true; sk.life = 30; sk.color = '#9fb8a0';
        sk.x = m.x; sk.y = m.y;
        g.mercs.push(sk);
        Fx.text(m.x, m.y - 20, 'RISE', '#7aa06a', 12);
        Fx.burst(m.x, m.y, ['#7aa06a', '#9fb8a0'], 12, { speed: 120, life: 0.5, glow: true });
      }
    }
    // (#213 undead heal, hunt counter and Ach.kill moved into killerPerks above)
    // #77 the reward for staying: XP scales with the floor's ALARM level (+12%/step)
    let alarmXp = Math.round(m.xp * (1 + 0.12 * (g.alarm || 0)));
    if (g.floorNightmare) alarmXp = Math.round(alarmXp * NIGHTMARE.xpMul); // #13 nightmare pays more XP
    p.addXp(alarmXp, g);
    // co-op: the whole party levels off shared kills (kills only ever happen on
    // the host, so it grants everyone the same XP)
    if (g.coop && !g.huntMode && typeof Net !== 'undefined' && isRunHost()) Net.sendR({ t: 'xp', a: alarmXp }); // #242 hunt xp is personal
    Fx.burst(m.x, m.y, ['#fff', '#ffd24c', '#ff6655'], 14, { speed: 180, life: 0.5 });
    Sfx.play('kill');
    // #26: catching the loot goblin pays out a jackpot (its coins are set high in BASE)
    if (m.type === 'goblin') {
      Fx.text(m.x, m.y - 32, 'JACKPOT!', '#ffd24c', 18);
      Fx.burst(m.x, m.y, ['#ffd24c', '#ffe08a', '#fff'], 30, { speed: 240, life: 0.8, glow: true });
      Sfx.play('buy');
    }
    // #56 a worm's head dying looses its body - each segment scatters off as a wormling
    if (m.type === 'worm' && m.bodySegs && m.bodySegs.length) {
      for (const s of m.bodySegs) {
        const wl = Monsters.make('wormling', s.x, s.y, m.tier);
        const a = Math.random() * Math.PI * 2;
        wl.kvx = Math.cos(a) * 280; wl.kvy = Math.sin(a) * 280; // burst outward, then it hunts
        wl.spawnT = 0.25;
        g.monsters.push(wl);
        Fx.burst(s.x, s.y, ['#8fd0a0', '#6ee7a0'], 8, { speed: 150, life: 0.4 });
      }
      Fx.text(m.x, m.y - 30, 'IT SPLITS!', '#8fd0a0', 15);
      Sfx.play('mimic');
    }

    // #213 looting multiplies the WORLD's coin drop, so it reads the KILLER's level
    // (a remote killer's level rides their presence as rp.loot)
    const looting = killerRp ? (killerRp.loot || 0) : Weapons.has(p.weapon, 'looting');

    // coins
    const [c0, c1] = m.coins;
    let n = c0 + ((Math.random() * (c1 - c0 + 1)) | 0);
    if (looting) n = Math.round(n * (1 + 0.3 * looting));
    if (g.midasT > 0) n *= 2; // MIDAS WAVE ultimate: double gold while active
    if (g.rules) n = Math.round(n * g.rules.coinMul); // the Hoard (Greed) doubles it
    if (g.floorNightmare) n = Math.round(n * NIGHTMARE.coinMul); // #13 nightmare pays more gold
    for (let i = 0; i < n; i++) spawnPickup('coin', m.x, m.y);

    // hearts: small mercy drop. BLOOD MOON pays double gold and withholds them.
    if (Math.random() < 0.07 && !(g.rules && g.rules.noHearts)) spawnPickup('heart', m.x, m.y);

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
      // mimics reward the risk: guaranteed good weapon + bonus XP (#239 instanced)
      dropGearInstanced('weapon', m.x, m.y, { tier, minRarity: 1, luck: 0.6 });
      p.addXp(15, g);
    } else if (m.isBoss) {
      // THE KING (and every Circle Warden): guaranteed legendary + royal armor +
      // coin fountain + essence. In the Descent he pays out more the deeper you are.
      dropGearInstanced('weapon', m.x, m.y - 20, { tier, minRarity: 4 });      // #239 every player gets a boss legendary
      dropGearInstanced('armorItem', m.x + 40, m.y, { tier, minRarity: 3 });
      for (let i = 0; i < 36; i++) spawnPickup('coin', m.x, m.y);
      const ne = m.isDescentBoss ? Descent.bossEssence(g.floorNum) : (m.forestBoss ? 8 : 12); // #251
      for (let i = 0; i < ne; i++) spawnPickup('essence', m.x, m.y);
      // Circle Wardens are the only creatures that guard mythics
      if (m.isDescentBoss && Math.random() < Descent.MYTHIC_DROP_CHANCE) {
        // #239 instanced: each player rolls a mythic against their OWN collection
        dropGearInstanced('weapon', m.x, m.y + 24, { tier, mythic: true });
      }
      if (!m.isDescentBoss && !m.forestBoss) { g.kingSlain = true; p.essenceRun += 20; } // King's victory bonus (#251 not the Harpy's)
      g.winTimer = 2.6;                             // savor the kill; doors stay locked
      // every boss opens the plunge with a Toad line: the King's is verbatim, each
      // deeper Warden's is one notch more twisted (index = how many you've felled)
      const toadIdx = m.isDescentBoss ? g.circleBossSeen : 0;
      g.pendingDescent = { toadIdx, forest: !!m.forestBoss }; // #251 the Harpy opens plain stairs, no Toad
      // P1-E: tell guests the boss fell so they clear it + share the victory
      if (g.coop && typeof Net !== 'undefined' && isRunHost()) Net.send({ t: 'bossDead', x: Math.round(m.x), y: Math.round(m.y), toad: toadIdx, king: g.kingSlain ? 1 : 0, fb: m.forestBoss ? 1 : 0 });
    } else if (m.elite && Math.random() < 0.3) {
      // elites drop gear far more often than trash mobs
      dropGearInstanced('weapon', m.x, m.y, { tier, minRarity: 1, luck: 0.4 + 0.1 * (g.alarm || 0) }); // #239
    } else if (Math.random() < 0.045 * (1 + 0.5 * looting) * (1 + 0.09 * (g.alarm || 0))) {
      // #77 higher ALARM => richer loot: better drop odds AND higher rarity
      dropGearInstanced('weapon', m.x, m.y, { tier, luck: 0.1 * (g.alarm || 0) }); // #239
    } else if (Math.random() < 0.035 * (1 + 0.5 * looting) * (1 + 0.09 * (g.alarm || 0))) {
      dropGearInstanced('armorItem', m.x, m.y, { tier, luck: 0.1 * (g.alarm || 0) }); // #239
    } else if (Math.random() < 0.02) {
      spawnPickup('potionItem', m.x, m.y); // #186 a rare flask off a corpse ('pk' mirrors it in co-op)
    }

    checkRoomCleared();
  }

  function spawnPickup(kind, x, y, local) {
    const a = Math.random() * Math.PI * 2, d = Math.random() * 40;
    g.pickups.push({
      kind, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
      vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 40,
      t: 0, value: kind === 'coin' ? 1 : 1,
    });
    // P1-D: currency/buff drops are INSTANCED - the host mirrors each to the guest,
    // who spawns its OWN copy into its OWN wallet (both players progress economically).
    // Guard on isRunHost() so the guest's own spawns don't echo back.
    // #97 `local` spawns (chest loot) do NOT mirror - the chest is opened per-player, so
    // mirroring leaked the host's chest coins/heart onto the guest (who never opened it).
    if (!local && g.coop && typeof Net !== 'undefined' && isRunHost()) Net.send({ t: 'pk', k: kind, x: Math.round(x), y: Math.round(y) });
  }

  // drop a GEAR pickup (weapon/armor) and, in co-op, mirror it to guests as their
  // OWN instanced copy so player 2/3 get stronger loot too (kills only run on the
  // host, so guests never generate these locally). Weapon/armor objects are plain
  // data - safe to send over the wire and reconstruct as-is on the guest.
  // #239 (Sam) PER-PLAYER LOOT INSTANCING: your drops are YOURS. The host still
  // decides THAT a drop happens (it owns kills), but instead of one shared item it
  // broadcasts the ROLL - kind, tier, rarity floor, luck - and every player's client
  // rolls its OWN item locally. Your teammate cannot see or take your drop, and you
  // cannot take theirs. (Chest loot was already per-player, #97 - this brings kill,
  // boss, mythic and trap loot in line.) Instanced gear carries NO gid, so the
  // shared-gear sync (gear/gearget/gearsnap) ignores it by construction.
  function spawnInstancedGear(kind, x, y, roll) {
    let item;
    if (roll.mythic) {
      item = Weapons.rollMythic(undefined, { exclude: g.meta.mythics, tier: roll.tier });
      kind = item.isArmor ? 'armorItem' : 'weapon'; // each player's own mythic decides
      mythicFanfare(x, y, item);
    } else {
      item = kind === 'weapon'
        ? Weapons.rollWeapon(roll.tier, { minRarity: roll.minRarity || 0, luck: roll.luck || 0 })
        : Weapons.rollArmor(roll.tier, { minRarity: roll.minRarity || 0, luck: roll.luck || 0 });
    }
    const pk = { kind, x, y, t: 0 };
    if (kind === 'weapon') pk.weapon = item; else pk.armor = item;
    g.pickups.push(pk);
    return pk;
  }
  function dropGearInstanced(kind, x, y, roll) {
    spawnInstancedGear(kind, x, y, roll);
    // #242 hunt kills are personal - your monster, your drop, nobody else's roll
    if (g.coop && !g.huntMode && typeof Net !== 'undefined' && isRunHost()) {
      Net.sendR({ t: 'lootroll', knd: kind, x: Math.round(x), y: Math.round(y),
        tier: roll.tier, mr: roll.minRarity || 0, lk: +(roll.luck || 0).toFixed(2), my: roll.mythic ? 1 : 0 });
    }
  }

  function dropGear(kind, item, x, y) {
    const pk = { kind, x, y, t: 0 };
    if (kind === 'weapon') pk.weapon = item; else pk.armor = item;
    // #96 shared gear id: each client spawns its own copy of the SAME drop under this
    // id, so when anyone grabs it a 'gearget' broadcast despawns the copy everywhere.
    if (g.coop) pk.gid = ++g.netGearId;
    g.pickups.push(pk);
    if (g.coop && typeof Net !== 'undefined' && isRunHost()) {
      Net.send({ t: 'gear', kind, item, x: Math.round(x), y: Math.round(y), gid: pk.gid });
    }
    return pk;
  }

  // #96 remove a gear pickup locally and, in co-op, tell the party to despawn their
  // linked copy (same gid) so a grabbed item can't be picked up twice.
  function consumeGear(pk) {
    const i = g.pickups.indexOf(pk);
    if (i >= 0) g.pickups.splice(i, 1);
    if (g.coop && pk && pk.gid && typeof Net !== 'undefined') Net.sendR({ t: 'gearget', gid: pk.gid });
  }

  // #181 (Sam) spring the trap-room ambush. Host-authoritative like every spawn:
  // the opener broadcasts, the pinned host spawns, guests get the wave via snapshots.
  function springTrap(initiator) {
    const room = g.room;
    if (!room || room.type !== 'trap' || !room.trapChest || room.trapChest.opened) return;
    room.trapChest.opened = true;
    room.cleared = false;
    Sfx.play('door'); Sfx.play('roar');
    Fx.shake(10, 0.4);
    g.floorBanner = { text: 'IT WAS A TRAP', t: 2.4, sub: 'kill them all to unseal the doors' };
    if (isRunHost()) {
      room.spawned = true;
      // a trap wave hits harder than a normal room: one tier up, and one extra body
      g.monsters = Monsters.spawnForRoom(room, g.floorNum + 1, g);
      coopScaleMonsters(g.monsters);
      progressionScaleMonsters(g.monsters);
      nightmareScaleMonsters(g.monsters);
      for (const m of g.monsters) m.netId = ++g.netMobId;
    }
    if (initiator && g.coop && typeof Net !== 'undefined') Net.sendR({ t: 'trapopen', gx: room.gx, gy: room.gy });
  }

  function checkRoomCleared() {
    if (g.room.cleared) return;
    if ((g.room.type === 'combat' || g.room.type === 'boss' || g.room.type === 'trap') && g.room.spawned &&
        g.monsters.every(m => m.dead)) {
      g.room.cleared = true;
      g.player.roomsCleared++;
      if (typeof Ach !== 'undefined') Ach.roomCleared(g); // #86 lifetime room count
      // #86 a full floor cleared (all combat rooms down) - the no-hit accolade checks here
      if (typeof Ach !== 'undefined' && g.room.type !== 'boss' && Dungeon.uncleared(g.dungeon) === 0) Ach.floorCleared(g);
      // #77 the dungeon grows more ALERT with every room you clear (resets each floor).
      // Higher alarm = tougher rooms (more bodies/elites/formations) but richer rewards
      // (loot rarity + XP). Capped so deep-floor + max-alarm stays beatable.
      g.alarm = Math.min(8, (g.alarm || 0) + 1);
      // #181 the trap survived: the chest finally gives up its loot (host drops; the
      // 'gear'/'pk' broadcasts mirror it to the party)
      if (g.room.type === 'trap' && g.room.trapChest && g.room.trapChest.opened && !g.room.trapChest.looted) {
        g.room.trapChest.looted = true;
        if (isRunHost()) {
          const ch = g.room.trapChest, tier = Monsters.tierFor(g.floorNum, g.room.dist);
          dropGearInstanced('weapon', ch.x - 26, ch.y + 8, { tier, minRarity: 2, luck: 0.5 });   // #239
          dropGearInstanced('armorItem', ch.x + 26, ch.y + 8, { tier, minRarity: 2 });
          for (let i = 0; i < 14; i++) spawnPickup('coin', ch.x, ch.y);
        }
        Fx.burst(g.room.trapChest.x, g.room.trapChest.y, ['#ffd24c', '#fff', '#c9a227'], 30, { speed: 220, life: 0.8, glow: true });
        Fx.text(g.room.trapChest.x, g.room.trapChest.y - 34, 'THE CHEST YIELDS', '#ffd24c', 14);
      }
      vacuumPickups(); // room-clear reward: every dropped coin flies to you
      Sfx.play('unlock');
      Fx.text(W / 2, H / 2 - 60, 'ROOM CLEARED', '#6ee7a0', 18);
      const ALARM_FLAVOR = { 2: 'The dungeon stirs...', 4: 'The dungeon is on alert', 6: 'The dungeon hunts you' };
      if (ALARM_FLAVOR[g.alarm]) Fx.text(W / 2, H / 2 - 36, ALARM_FLAVOR[g.alarm], '#ff8a3d', 14);
      // P1-D: guests never run onKill/checkRoomCleared - tell them the room cleared so
      // their coins vacuum and their doors unseal. #232 (Sam, live playtest): the
      // message also says whether this clear FINISHED the floor, so the guest opens
      // the same portal - before this, only the host could see the way down.
      const floorDone = g.room.type !== 'boss' && Dungeon.uncleared(g.dungeon) === 0;
      const bossNext = floorDone && (g.floorNum === 1 || g.floorNum === 3 ||
        (typeof Descent !== 'undefined' && Descent.isBossFloor(g.floorNum)));
      if (g.coop && typeof Net !== 'undefined' && isRunHost()) Net.sendR({ t: 'roomclear', gx: g.room.gx, gy: g.room.gy, fl: g.floorNum, al: g.alarm, pt: floorDone ? 1 : 0, pb: bossNext ? 1 : 0 }); // #216/#232
      if (floorDone) {
        // this floor has a boss only on floor 3 (the King) and on Circle Warden
        // floors in the Descent; every other floor ends in a stairs portal.
        const hasBoss = bossNext;
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
    g.toadMsg = { text: opts.forest ? 'the forest is quiet now. the way down stands open.' : Descent.toadLine(opts.toadIdx || 0), t: 5 }; // #251
    Fx.burst(g.descentPortal.x, g.descentPortal.y, ['#ff5a2c', '#ffcc44', '#ff2200', '#1a0a06'], 36, { speed: 210, life: 1.0, glow: true });
    Fx.shake(6, 0.4);
    Sfx.play('roar');
  }

  // #13 (Sam) TWIN PORTALS. At the exit of every DESCENT floor a second, NIGHTMARE
  // portal opens beside the normal one: a much harder version of the next floor for a
  // much richer haul. All the knobs live here. Numbers are first-pass and tunable.
  const NIGHTMARE = {
    hpMul: 1.45, dmgMul: 1.25, eliteAdd: 0.18,   // tougher: tankier, hits harder, more elites
    coinMul: 1.7, xpMul: 1.4,                     // richer: more gold + faster levelling
  };
  // the active NORMAL descent exit in the current room (the stairs, or the boss-floor
  // plunge), or null if this floor/room has no descent exit to twin.
  function descentExitPoint() {
    if (typeof Descent === 'undefined' || !Descent.isDescent(g.floorNum)) return null;
    if (g.descentPortal && g.descentPortal.room === g.room) return { x: g.descentPortal.x, y: g.descentPortal.y };
    if (g.room && g.room.stairs && g.room.stairs.open !== undefined && Dungeon.uncleared(g.dungeon) === 0)
      return { x: g.room.stairs.x, y: g.room.stairs.y };
    return null;
  }
  // the nightmare portal sits beside the normal exit (flips to the other side near a wall).
  function nightmarePos(ex) {
    const off = 118;
    let nx = ex.x + off;
    if (nx > PF.x + PF.w - 46) nx = ex.x - off;
    return { x: nx, y: ex.y };
  }
  // #12 (Sam) DESCENT SCALING. The goal: the Inferno (floors 4-12) is a gauntlet only the
  // very best builds clear - only the top raiders should ever reach the frozen lake at the
  // bottom of Hell. Two levers, BOTH first-pass and meant to be tuned by watching where the
  // leaderboard actually stalls:
  //   (1) THE WALL - monster HP/damage ramp steeply toward the bottom of the Inferno, so
  //       even an on-level player is in a real fight by floor 12 (and it stays maxed on the
  //       climb beyond).
  //   (2) THE RUBBER-BAND - grinding levels must NOT trivialise the descent. Monsters scale
  //       with how far you are ABOVE the expected level for the floor, so raw levels stop
  //       paying off; only a genuinely strong BUILD breaks the wall. Under-level gets a
  //       little mercy. This is the "scales with the player's stats" half of the ask.
  // TUNING: raise wallHpBottom / perLevelHp to make the filter harsher; lower expBase to
  // treat more players as over-levelled (also harsher). Applied host-side after spawn; the
  // doppelganger mini-boss is skipped (it already mirrors you).
  const DESCENT_SCALE = {
    wallHpBottom: 0.7, wallDmgBottom: 0.3,       // extra HP/dmg at the very bottom (floor 12)
    expBase: 22, expPerFloor: 2,                  // expected player level: 22 at floor 4, +2/floor
    perLevelHp: 0.045, perLevelDmg: 0.02,         // scaling per level ABOVE expected
    capUp: 0.9, capDown: -0.15,                   // rubber-band clamps (grind fully neutralised / mild mercy)
  };
  function progressionScaleMonsters(mons) {
    if (typeof Descent === 'undefined' || !Descent.isDescent(g.floorNum)) return;
    const D = DESCENT_SCALE;
    // (1) the wall: quadratic ramp across the nine circles, maxed from floor 12 on.
    const t = Math.max(0, Math.min(9, g.floorNum - 3)) / 9;
    const wallHp = D.wallHpBottom * t * t, wallDmg = D.wallDmgBottom * t * t;
    // (2) the rubber-band vs the expected level for this floor.
    const lvl = (g.player && g.player.level) || 1;
    const delta = lvl - (D.expBase + D.expPerFloor * (g.floorNum - 4));
    const clamp = v => Math.max(D.capDown, Math.min(D.capUp, v));
    const hpMul = (1 + wallHp) * (1 + clamp(delta * D.perLevelHp));
    const dmgMul = (1 + wallDmg) * (1 + clamp(delta * D.perLevelDmg));
    if (hpMul === 1 && dmgMul === 1) return;
    for (const m of mons) {
      if (m.miniBoss) continue;
      m.hp = Math.max(1, Math.round(m.hp * hpMul)); m.maxHp = m.hp;
      if (m.dmg) m.dmg = Math.round(m.dmg * dmgMul);
    }
  }

  // host: make a freshly-spawned set harder on a nightmare floor (guests get these via
  // the mob snapshot, so this only runs host-side, after spawnForRoom).
  function nightmareScaleMonsters(mons) {
    if (!g.floorNightmare) return;
    for (const m of mons) {
      m.hp = Math.round(m.hp * NIGHTMARE.hpMul); m.maxHp = m.hp;
      if (m.dmg) m.dmg = Math.round(m.dmg * NIGHTMARE.dmgMul);
      // sprinkle extra elites onto the plain bodies (skip the doppelganger mini-boss)
      if (!m.elite && !m.miniBoss && typeof Descent !== 'undefined' && Math.random() < NIGHTMARE.eliteAdd) {
        const af = Descent.rollAffix();
        m.elite = af; m.r = Math.round(m.r * (af.rMul || 1));
        m.hp = Math.max(1, Math.round(m.hp * af.hpMul)); m.maxHp = m.hp;
        m.dmg = Math.round(m.dmg * af.dmgMul); m.speed = m.speed * af.speedMul;
        m.xp = Math.round(m.xp * 2.2);
      }
    }
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
    if (typeof Ach !== 'undefined') Ach.endRun(g, false); // #86 death: runs/deaths
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

  // #87 retire the run gracefully from the pause menu: bank ALL essence (carried +
  // 10% of coins) and post the score, same as a death, but on your terms. Achievements
  // earned during the run persist (they save as they unlock, independent of this).
  function retireRun() {
    if (g.runEnded) return;
    g.runEnded = true;
    g.retired = true;
    const fromCoins = Math.floor(g.player.coins * 0.10);
    g.essenceEarned = g.player.essenceRun + fromCoins;
    g.meta.essence += (g.player.essenceRun - g.essenceCheckpoint) + fromCoins;
    saveMeta();
    g.levelUpQueue = 0; g.evoQueue = []; g.ultChoices = null;
    Sfx.setAmbient(null);
    endToScreen('dead'); // routes through arcade initials if it placed, then results
  }

  function onVictory() {
    if (g.runEnded) return; // never bank twice (death/victory race)
    g.runEnded = true;
    if (typeof Ach !== 'undefined') Ach.endRun(g, true); // #86 victory: wins + class-win
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
      // #203 (Sam) the high score belongs to YOUR NAME. If the player has one set, the
      // score commits under it directly - no entry screen. First-timers (no name yet)
      // still get the entry once, and what they type BECOMES their name.
      const nm = (g.playerName || '').trim();
      if (nm) {
        g.initials = { name: nm.toUpperCase().slice(0, 12), max: 12 }; // #225 unified with the 12-char rename cap
        commitInitials(false);
        return;
      }
      g.initials = { name: '', max: 12 }; // #160 (Sam) a real name, up to 12 chars, not 3 initials
      g.state = 'initials';
      g.overlayT = 0;
      Sfx.play('levelup');
    } else {
      g.state = which;
      g.overlayT = 0;
    }
  }

  // #102 capture a compact "who died here" snapshot for the leaderboard: the rendered
  // visage (a small PNG) plus the character-sheet facts, frozen at the moment of death.
  function buildDeathSnap() {
    const p = g.player; if (!p) return null;
    let avatar = '';
    try {
      const S = 76, oc = document.createElement('canvas'); oc.width = S; oc.height = S;
      const octx = oc.getContext('2d');
      octx.translate(S / 2, S / 2 + 4);
      const sx = p.x, sy = p.y, srt = p.rollT, sfl = p.flash; // draw() translates by (x,y); center it, static, unflashed
      p.x = 0; p.y = 0; p.rollT = -1; p.flash = 0;
      p.draw(octx, g);
      p.x = sx; p.y = sy; p.rollT = srt; p.flash = sfl;
      avatar = oc.toDataURL('image/png');
    } catch (e) { avatar = ''; }
    const st = p.stats || {};
    const nm = it => it ? Weapons.displayName(it) : null;
    return {
      avatar,
      cls: (p.class && p.class.id) || '', className: (p.class && p.class.name) || 'Adventurer',
      level: p.level, floor: g.floorNum, kills: p.kills || 0, coins: p.coins || 0, essence: g.essenceEarned,
      maxHp: Math.round(p.maxHp), prestige: (g.meta && g.meta.prestige) || 0,
      dmgMul: +(st.dmgMul || 1).toFixed(2), spdMul: +(st.speedMul || 1).toFixed(2),
      crit: Math.round((st.crit || 0) * 100), coinMul: +(st.coinMul || 1).toFixed(2), magic: st.magic || 1,
      statPoints: Object.assign({}, p.statPoints),
      evos: (p.evoTaken || []).map(e => e.name).slice(0, 8),
      weapons: [nm(p.weapons && p.weapons.a), nm(p.weapons && p.weapons.b)].filter(Boolean),
      armor: nm(p.armor),
      trinket: p.trinket ? p.trinket.name : null,   // #134 the fourth slot, on the leaderboard too
      q: p.ability && p.ability.name, r: p.abilityR && p.abilityR.name, ult: p.abilityUlt && p.abilityUlt.name,
    };
  }

  function commitInitials(skip) {
    // #203 a rename from the title screen: save the name, post no score
    if (g.renameOnly) {
      if (!skip) { g.playerName = (g.initials.name || '').trim().slice(0, 12); saveName(); }
      g.renameOnly = false;
      g.state = 'title'; g.overlayT = 0; g.initials = null;
      Sfx.play('ui');
      return;
    }
    if (!skip) {
      const name = ((g.initials.name || '').trim().toUpperCase().slice(0, g.initials.max)) || 'AAA';
      if (!(g.playerName || '').trim()) { g.playerName = name; saveName(); } // #203 first entry becomes your name
      const entry = { initials: name, score: g.essenceEarned, floor: g.floorNum, won: g.afterInitials === 'win' || g.kingSlain, snap: buildDeathSnap() };
      const scores = loadScores();
      scores.push(entry);
      scores.sort((a, b) => b.score - a.score);
      g.scores = dedupByName(scores).slice(0, SCORE_CAP); // #159 one entry per name
      saveScores(g.scores);
      g.newScoreRank = g.scores.findIndex(s => s.score === g.essenceEarned && s.initials === name) + 1;
      Sfx.play('upgrade');
      submitGlobalScore(entry); // #62 post to the global leaderboard (best-effort)
    }
    g.state = g.afterInitials;
    g.overlayT = 0;
    g.initials = null;
  }

  // #62 GLOBAL LEADERBOARD (best-effort; the local board is always the fallback).
  // POST a finished score, then refresh the board from what the server returns.
  function leaderboardUrl() {
    try { return (Net.relayBase ? Net.relayBase() : '') + '/scores'; } catch { return ''; }
  }
  // #265 (Sam) TITLE PLAYER COUNT: ping presence with a stable anonymous uid; the
  // server answers with how many uids it saw in the last 30 minutes. The display
  // adds the founding 87. Best-effort: no response, no counter - never an error.
  function pingPresence() {
    let uid = null;
    try { uid = localStorage.getItem('drl_uid'); } catch { }
    if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 12); try { localStorage.setItem('drl_uid', uid); } catch { } }
    let base = '';
    try { base = Net.relayBase ? Net.relayBase() : ''; } catch { }
    if (!base) return;
    fetch(base + '/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ u: uid }) })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.n === 'number') g.playersOnline = 87 + d.n; })
      .catch(() => { });
  }
  // #118 the global board can hold only a handful of real scores early on (it launched
  // with almost nothing in it), which made the title show a lonely single raider. Blend
  // the returned global scores with the built-in seed "past raiders" - same trick the
  // LOCAL board already uses so it's never empty - so a full top-5 always displays. Real
  // scores still sort to the top; seeds just fill the empty rows below them.
  function displayBoard(globalTop) {
    const all = [...(Array.isArray(globalTop) ? globalTop : []), ...SEED_SCORES].filter(validScore);
    all.sort((a, b) => b.score - a.score);
    return dedupByName(all).slice(0, SCORE_CAP); // #159 one entry per name, best kept
  }
  function submitGlobalScore(entry) {
    const url = leaderboardUrl(); if (!url) return;
    // #133 the global board keeps the LOADOUT but not the portrait: the avatar is a
    // multi-KB PNG and the leaderboard's storage is capped, so the server drops it
    // anyway. Strip it here too rather than upload several KB for nothing. The full
    // snapshot (avatar and all) still goes to the LOCAL board.
    const slim = entry.snap ? Object.assign({}, entry.snap, { avatar: undefined }) : null;
    entry = Object.assign({}, entry, { snap: slim });
    fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) })
      .then(r => r.json())
      .then(d => { if (d && Array.isArray(d.top) && d.top.length) { g.scores = displayBoard(d.top); g.globalScores = true; if (d.rank) g.newScoreRank = d.rank; } })
      .catch(() => { /* offline -> keep the local board */ });
  }
  function fetchGlobalScores() {
    // #116 the title board holds off rendering until this resolves (scoresReady), so a
    // page refresh no longer flashes the stale local seed before the global board lands.
    const url = leaderboardUrl();
    if (!url) { g.scoresReady = true; return; } // no relay -> show the local fallback now
    fetch(url).then(r => r.json())
      .then(d => { if (d && Array.isArray(d.top) && d.top.length) { g.scores = displayBoard(d.top); g.globalScores = true; } }) // #118 pad to a full board
      .catch(() => { /* offline -> keep the local board */ })
      .finally(() => { g.scoresReady = true; });
  }

  function updateInitials() {
    const ini = g.initials;
    // #160 (Sam) a typed name field, up to `max` characters (letters + digits).
    for (const code of input.just) {
      const kl = /^Key([A-Z])$/.exec(code), dg = /^Digit([0-9])$/.exec(code);
      if ((kl || dg) && ini.name.length < ini.max) { ini.name += (kl ? kl[1] : dg[1]); Sfx.play('ui'); }
    }
    if (input.pressed('Backspace')) { ini.name = ini.name.slice(0, -1); Sfx.play('ui'); }
    if (input.pressed('Enter')) { commitInitials(false); return; }
    if (input.pressed('Escape')) { commitInitials(true); return; }
    if (input.mouse.clicked) {
      for (const r of g.uiRects) {
        if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
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
    if (g.huntMode) return false; // #242 fleeing must always be an option
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

  // #101 co-op door-plates: the standing square just inside each doorway. A door
  // opens only when a MAJORITY of the party stands on its plate together, so nobody
  // gets dragged off alone / left behind. Solo play keeps the walk-through door.
  function platePos(dir) {
    const cx = PF.x + PF.w / 2, cy = PF.y + PF.h / 2;
    if (dir === 'N') return { x: cx, y: PF.y + 42 };
    if (dir === 'S') return { x: cx, y: PF.y + PF.h - 42 };
    if (dir === 'W') return { x: PF.x + 42, y: cy };
    return { x: PF.x + PF.w - 42, y: cy }; // E
  }
  const PLATE_R = 36;
  function plateOccupancy(dir) {
    const pp = platePos(dir); let n = 0;
    const p = g.player;
    if (!p.dead && !p.downed && Math.hypot(p.x - pp.x, p.y - pp.y) < PLATE_R) n++;
    for (const rp of g.remotePlayers.values()) {
      if (g.time - (rp.last || 0) > 3 || rp.downed) continue;
      if (!rp.room || rp.room[0] !== g.room.gx || rp.room[1] !== g.room.gy) continue;
      if (Math.hypot(rp.x - pp.x, rp.y - pp.y) < PLATE_R) n++;
    }
    return n;
  }
  // #196 (Sam, live playtest) the plate must count the LIVE party: coopPlayers() floors
  // at 2 (correct for monster scaling), so when a teammate LEFT the run, the survivor
  // could never satisfy a 2-person plate and the whole run was stuck.
  // #218 (co-op review) presence-based: a RETIREE (or a player parked on the death
  // screen) stops broadcasting 'p' and drops out of the count within seconds, even
  // though their socket is still open - Net.playerCount could not see that. Downed
  // players are excluded too: they cannot walk to a plate.
  function livePartyCount() {
    if (!g.coop) return 1;
    let n = 1;
    for (const rp of g.remotePlayers.values()) if (g.time - (rp.last || 0) < 3 && !rp.downed) n++;
    return n;
  }
  function plateNeeded() { return Math.floor(livePartyCount() / 2) + 1; } // majority of who is actually here

  // #237 (Sam: "make the next level portal majority like the doors") every exit to
  // the next floor - stairs, portal shortcut, descent plunge, nightmare gate - needs
  // a MAJORITY of the live party gathered at it before E works. The presser is
  // already standing on the exit (nearestInteractable range), so "gathered" means
  // teammates within 140px of the presser, same-room, alive and not downed.
  function partyGathered() {
    if (g.huntMode) return false; // #241 the Hunt has no exit - it ends one way
    if (!g.coop) return true;
    const need = plateNeeded();
    const p = g.player;
    let n = (!p.dead && !p.downed) ? 1 : 0;
    for (const rp of g.remotePlayers.values()) {
      if (g.time - (rp.last || 0) > 3 || rp.downed) continue;
      if (!rp.room || !g.room || rp.room[0] !== g.room.gx || rp.room[1] !== g.room.gy) continue;
      if (Math.hypot(rp.x - p.x, rp.y - p.y) < 140) n++;
    }
    return n >= need;
  }
  function gatherDenied() {
    Sfx.play('error');
    Fx.text(g.player.x, g.player.y - 34, g.huntMode ? 'THE HUNT ENDS ONLY ONE WAY' : 'GATHER THE PARTY TO DESCEND', g.huntMode ? '#ff4040' : '#ffd24c', 13);
  }

  function tryRoomExit() {
    const p = g.player;
    if (g.duelMode) { clampPlayer(); return; } // #240 the dueling ground has no exits
    if (doorsLocked()) { clampPlayer(); return; }
    // #101 co-op: leave via the majority-occupied door-plate, not by walking out
    // (#241: NOT in a hunt - hunters roam alone through solo-style doors)
    if (g.coop && !g.huntMode) {
      const need = plateNeeded();
      if (!g.plateArmed) g.plateArmed = new Set();
      for (const d of doorRects(g.room)) {
        if (doorSealed(g.room, d.dir)) continue;
        const occ = plateOccupancy(d.dir);
        // #137 ARM-ON-VACATE: a plate only counts once it has been EMPTY at least once
        // this room. You spawn standing on the door you came in through, so that plate
        // starts DISARMED and cannot bounce you straight back to the previous room
        // (Sam's teleport bug). It arms the moment it is vacated; every other plate
        // arms on its first empty frame. Belt-and-suspenders with a short entry settle.
        if (occ === 0) g.plateArmed.add(d.dir);
        if (g.roomSettleT > 0) continue;
        // #235 (Sam: "plates bounce us back and forth") DWELL: the plate must HOLD its
        // majority for 0.45s before firing. Before this, one frame of overlap fired the
        // door - so drifting off the entry plate (arming it) and drifting back sent the
        // party straight back where it came from, and a laggy remote ghost crossing a
        // plate could misfire it. The charge-up ring (drawDoorPlates) makes it legible.
        if (!g.plateHold) g.plateHold = {};
        if (occ >= need && g.plateArmed.has(d.dir)) {
          if (g.plateHold[d.dir] === undefined) g.plateHold[d.dir] = g.time;
          if (g.time - g.plateHold[d.dir] < 0.45) continue;
          const next = g.room.doors[d.dir];
          if (typeof Net !== 'undefined') Net.send({ t: 'room', gx: next.gx, gy: next.gy, dir: d.dir, fl: g.floorNum }); // #216
          g.transition = { dir: d.dir, next, t: 0 };
          g.state = 'transition';
          return;
        } else delete g.plateHold[d.dir];
      }
      clampPlayer(); // the plate is the only way out; walls stay solid
      return;
    }
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
        if (g.coop && typeof Net !== 'undefined') Net.send({ t: 'room', gx: next.gx, gy: next.gy, dir: d.dir, fl: g.floorNum }); // #216
        g.transition = { dir: d.dir, next, t: 0 };
        g.state = 'transition';
        return;
      }
      return; // in the lane, not past yet: allow walking into the doorway
    }
    clampPlayer();
  }

  // #101 render each unsealed door's gather-plate with a live occupancy count so the
  // party knows where to stand and how many more teammates are needed to open it.
  function drawDoorPlates(c) {
    if (g.duelMode) return;    // #240 no plates on the dueling ground
    if (doorsLocked()) return; // nothing to gather for while monsters are alive
    const need = plateNeeded();
    const half = 22;
    for (const d of doorRects(g.room)) {
      if (doorSealed(g.room, d.dir)) continue;
      const pp = platePos(d.dir);
      const on = plateOccupancy(d.dir);
      const ready = on >= need;
      const pulse = 0.4 + Math.sin(g.time * 4) * 0.18;
      c.save();
      c.translate(pp.x, pp.y);
      // plate square: gold-lit when the majority is standing, cool blue otherwise
      c.fillStyle = ready ? `rgba(201,162,39,${0.28 + pulse * 0.3})` : 'rgba(127,212,255,0.16)';
      c.fillRect(-half, -half, half * 2, half * 2);
      c.strokeStyle = ready ? '#ffd24c' : '#7fd4ff';
      c.lineWidth = 2;
      c.strokeRect(-half, -half, half * 2, half * 2);
      // #235 the dwell charge-up: a gold ring sweeps closed while the plate holds its
      // majority, so the 0.45s delay reads as "opening..." instead of lag
      const hold = g.plateHold && g.plateHold[d.dir];
      if (ready && hold !== undefined) {
        const k = Math.min(1, (g.time - hold) / 0.45);
        c.strokeStyle = '#ffd24c'; c.lineWidth = 4; c.lineCap = 'round';
        c.beginPath(); c.arc(0, 0, half + 8, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); c.stroke();
      }
      // occupancy label e.g. "1/2" -> "2/2"
      c.textAlign = 'center'; c.font = 'bold 11px monospace';
      c.fillStyle = ready ? '#ffe9a8' : '#bfe3ff';
      c.fillText(ready && hold !== undefined ? 'OPENING...' : `${on}/${need}`, 0, -half - 6);
      c.restore();
    }
  }

  function clampPlayer() {
    const p = g.player;
    // Each wall is clamped INDEPENDENTLY: a wall only opens if there's a real door
    // on THAT side and the player is lined up with its lane. (Bug fix: N and S doors
    // share the same centre-X lane, so the old "inLaneY" let a north door leak you
    // out through the south wall - and W/E likewise.)
    let openTop = false, openBot = false, openLeft = false, openRight = false;
    // #137 CO-OP: the door GAPS stay solid. In solo you walk out through the door lane
    // (and tryRoomExit's 'past' check transitions you); in co-op the ONLY way out is the
    // majority door-plate, so if the gaps opened here you could walk straight through
    // them and off the map (Sam's bug) because nothing triggers a transition from a
    // walk. Keep every wall solid when co-op - the plate does the leaving.
    if (!doorsLocked() && !g.coop) {
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
    // the stranger with an offer. Once you have taken (or refused) it, they stop
    // being interactable - you do not get to shop the same deal twice.
    if (g.room.encounter && !g.room.encounter.taken && !g.room.encounter.refused) {
      const e = g.room.encounter;
      consider(e.x, e.y, { kind: 'encounter', e });
    }
    for (const pk of g.pickups) {
      if (pk.kind === 'weapon') consider(pk.x, pk.y, { kind: 'weaponPickup', pk });
      if (pk.kind === 'armorItem') consider(pk.x, pk.y, { kind: 'armorPickup', pk });
      if (pk.kind === 'trinketItem') consider(pk.x, pk.y, { kind: 'trinketPickup', pk });
      if (pk.kind === 'potionItem') consider(pk.x, pk.y, { kind: 'potionPickup', pk }); // #186
    }
    if ((g.room.type === 'shop' || g.room.type === 'mythicshop') && g.room.shopStock) {
      for (const it of g.room.shopStock.items) if (!it.sold) consider(it.x, it.y, { kind: 'shopItem', it });
    }
    // #50 haggle with the shopkeeper (regular shops only; mythics stay premium)
    if (g.room.type === 'shop' && g.room.shopStock && g.room.shopStock.keeper) {
      const k = g.room.shopStock.keeper;
      consider(k.x, k.y, { kind: 'shopkeeper', k });
    }
    // #60 enchant table (regular shops)
    if (g.room.type === 'shop' && g.room.shopStock && g.room.shopStock.enchTable) {
      const et = g.room.shopStock.enchTable;
      consider(et.x, et.y, { kind: 'enchantTable', et });
    }
    // #187 crafting stations (regular shops)
    if (g.room.type === 'shop' && g.room.shopStock && g.room.shopStock.craft) {
      const cr = g.room.shopStock.craft;
      consider(cr.anvil.x, cr.anvil.y, { kind: 'craftWeapon', st: cr.anvil });
      consider(cr.dummy.x, cr.dummy.y, { kind: 'craftArmor', st: cr.dummy });
    }
    // #75 training barracks stations
    // #181 the trap chest is interactable until it is opened
    if (g.room.type === 'trap' && g.room.trapChest && !g.room.trapChest.opened) {
      consider(g.room.trapChest.x, g.room.trapChest.y, { kind: 'trapChest' });
    }
    if (g.room.type === 'barracks' && g.room.barracks) {
      for (const st of g.room.barracks.stations) consider(st.x, st.y, { kind: 'trainStation', st });
    }
    if (g.room.stairs && g.room.stairs.open !== undefined) {
      if (Dungeon.uncleared(g.dungeon) === 0) consider(g.room.stairs.x, g.room.stairs.y, { kind: 'stairs' });
    }
    if (g.portal && g.portal.room === g.room) consider(g.portal.x, g.portal.y, { kind: 'portal' });
    if (g.descentPortal && g.descentPortal.room === g.room) consider(g.descentPortal.x, g.descentPortal.y, { kind: 'descentPortal' });
    // #13 (Sam) TWIN PORTAL: a nightmare exit beside the normal descent exit
    { const ex = descentExitPoint(); if (ex) { const np = nightmarePos(ex); consider(np.x, np.y, { kind: 'nightmareExit' }); } }
    if (g.room.merc && !g.room.merc.hired && g.mercs.length < 2) consider(g.room.merc.x, g.room.merc.y, { kind: 'merc' });
    if (g.room.pet && !g.room.pet.activated) consider(g.room.pet.x, g.room.pet.y, { kind: 'pet' });
    return best;
  }

  // the co-op menu overlay (see the pause note in updatePlay). The world is live
  // behind it; this only handles the two buttons. P/Esc toggles it (in updatePlay).
  function handleCoopMenu() {
    if (!input.mouse.clicked) return;
    for (const r of (g.uiRects || [])) {
      if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
        if (r.action === 'menu') { g.coopMenu = false; quitToTitle(); }
        else if (r.action === 'retire') { g.coopMenu = false; retireRun(); }
        else if (r.action === 'fullscreen') toggleFullscreen();
      }
    }
  }

  // ======================= QUEST ENCOUNTERS ================================
  // The stranger's offer is on the screen and the game is paused. Take it or leave
  // it. Refusing is free and always allowed - they just go, and the room is quiet.
  function updateOffer() {
    const e = g.offer;
    if (!e) { g.state = 'play'; return; }
    const q = Encounters.byKey(e.key);
    if (input.pressed('Escape') || input.pressed('KeyQ')) {  // refuse
      e.refused = true;
      g.offer = null;
      g.state = 'play';
      g.shareMsg = { text: 'you turn them down. they do not seem surprised.', t: 2.6 };
      Sfx.play('ui');
      return;
    }
    if (input.pressed('KeyE') || input.pressed('Space') || input.pressed('Enter')) { // accept
      e.taken = true;
      g.questRoll = e.roll;                 // deterministic: the quest's own seeded roll
      g.quest = { key: e.key, room: g.room };
      q.accept(g);
      g.offer = null;
      g.state = 'play';
      g.shareMsg = { text: `${q.name} accepted.`, t: 3 };
      Sfx.play('upgrade');
      Fx.burst(e.x, e.y, ['#ffd24c', '#fff'], 20, { speed: 150, life: 0.6, glow: true });
    }
  }

  // Check the live quest every frame: has it been earned, or blown?
  function updateQuest(dt) {
    if (!g.quest || g.quest.paid) return;
    const q = Encounters.byKey(g.quest.key);
    if (!q) { g.quest = null; return; }
    if (q.failed && q.failed(g)) {
      g.shareMsg = { text: `${q.name} FAILED.`, t: 3.5 };
      Sfx.play('error');
      g.quest = null;
      return;
    }
    if (q.done(g)) {
      const got = q.pay(g);
      g.quest.paid = true;
      g.shareMsg = { text: `${q.name} complete: ${got}`, t: 5 };
      Sfx.play('upgrade');
      Fx.burst(g.player.x, g.player.y, ['#ffd24c', '#fff', '#d4af37'], 34,
        { speed: 220, life: 1.0, glow: true });
      g.quest = null;
    }
  }

  function interact() {
    const t = nearestInteractable();
    if (!t) return;
    const p = g.player;

    // QUEST ENCOUNTER: they make you an offer. The game stops while you read it.
    if (t.kind === 'encounter') {
      g.offer = t.e;
      g.state = 'offer';
      Sfx.play('ui');
      return;
    }

    if (t.kind === 'chest') {
      const ch = t.ch;
      if (ch.mimic && !g.huntMode) { wakeMimic(ch); return; } // #241 hunt chests never bite
      ch.opened = true;
      Sfx.play('pickup');
      Fx.burst(ch.x, ch.y, ['#ffd24c', '#d4af37', '#fff'], 22, { speed: 200, life: 0.7, glow: true, grav: 150 });
      const nCoins = 8 + ((Math.random() * 7) | 0);
      for (let i = 0; i < nCoins; i++) spawnPickup('coin', ch.x, ch.y - 10, true); // #97 chest loot is per-player: don't mirror
      const tier = Monsters.tierFor(g.floorNum, g.room.dist);
      g.pickups.push({ kind: 'weapon', weapon: Weapons.rollWeapon(tier, { luck: 0.35 }), x: ch.x, y: ch.y + 34, t: 0 });
      if (Math.random() < 0.45) g.pickups.push({ kind: 'armorItem', armor: Weapons.rollArmor(tier, { luck: 0.3 }), x: ch.x - 50, y: ch.y + 20, t: 0 });
      if (Math.random() < 0.4) spawnPickup('heart', ch.x, ch.y, true); // #97 chest loot is per-player: don't mirror
      p.addXp(10, g);
      vacuumPickups(); // #140 (Sam) opening a chest sweeps its coins (and any loose in the room) to you - the weapon/armor it drops stay put (vacuumPickups skips gear)
    }

    if (t.kind === 'weaponPickup') {
      p.pickupWeapon(t.pk.weapon, g);
      consumeGear(t.pk); // #96 despawn this drop for the whole party
    }

    if (t.kind === 'armorPickup') {
      p.equipArmor(t.pk.armor, g);
      consumeGear(t.pk); // #96 despawn this drop for the whole party
    }

    // #186 pick up a dropped flask (one slot; leave it if you already carry one)
    if (t.kind === 'potionPickup') {
      if (p.potion) { g.shopMsg = { text: 'You already carry a potion', t: 1.4 }; Sfx.play('error'); return; }
      p.potion = true;
      const i = g.pickups.indexOf(t.pk); if (i >= 0) g.pickups.splice(i, 1);
      Fx.text(p.x, p.y - 30, 'POTION (press H)', '#ff5a6e', 12);
      Sfx.play('buy');
      return;
    }
    if (t.kind === 'trinketPickup') {   // #134 the fourth slot
      p.equipTrinket(t.pk.trinket, g);
      consumeGear(t.pk);
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
      } else if (it.kind === 'trinket') {   // #134 the fourth slot
        p.coins -= it.price; it.sold = true;
        p.equipTrinket(it.trinket, g);
        Sfx.play('buy');
      } else if (it.kind === 'potion') {
        // #186 (Sam) potions are CARRIED now, not drunk at the counter. One slot.
        if (p.potion) { g.shopMsg = { text: 'You already carry a potion (press H to drink it)', t: 1.6 }; Sfx.play('error'); return; }
        p.coins -= it.price;
        p.potion = true;
        g.shopMsg = { text: 'Potion pocketed - press H when you need it', t: 2 };
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

    // #50 HAGGLE: press the shopkeeper for a 50/50 gamble - every price drops 30%
    // or climbs 30%. One attempt per shop (the keeper won't be pushed twice).
    if (t.kind === 'shopkeeper') {
      const stock = g.room.shopStock, k = t.k;
      if (stock.haggled) {
        g.shopMsg = { text: 'The keeper won\'t haggle twice', t: 1.6 };
        Sfx.play('error');
        return;
      }
      stock.haggled = true;
      const win = Math.random() < 0.5;
      const factor = win ? 0.7 : 1.3;
      for (const it of stock.items) it.price = Math.max(1, Math.round(it.price * factor));
      // #198 tell the party: one haggle per shop, same outcome on every screen
      if (g.coop && typeof Net !== 'undefined' && Net.connected) Net.send({ t: 'haggle', gx: g.room.gx, gy: g.room.gy, win: win ? 1 : 0 });
      if (win) {
        g.shopMsg = { text: 'Haggled! Every price drops 30%', t: 2.2 };
        Sfx.play('buy');
        Fx.text(k.x, k.y - 30, 'PRICES -30%', '#7ee0a0', 15);
        Fx.burst(k.x, k.y, ['#7ee0a0', '#ffd24c', '#fff'], 20, { speed: 160, life: 0.6, glow: true });
      } else {
        g.shopMsg = { text: 'The keeper drives a hard bargain: prices +30%', t: 2.2 };
        Sfx.play('error');
        Fx.text(k.x, k.y - 30, 'PRICES +30%', '#ff6b6b', 15);
        Fx.burst(k.x, k.y, ['#ff6b6b', '#8a5a5a'], 16, { speed: 120, life: 0.5 });
      }
    }

    // #187 (Sam) CRAFTING: gold + shards in, a freshly-rolled piece out. The anvil
    // forges your HELD weapon's archetype (a bow-user gets a bow); the mannequin
    // tailors armor. minRarity 2, so a craft is never vendor trash.
    if (t.kind === 'craftWeapon' || t.kind === 'craftArmor') {
      // #206 (Sam) like the enchant table, crafting shows THREE rolled options first.
      // You pay only when you pick one; Esc walks away free.
      const st = t.st, tier = Monsters.tierFor(g.floorNum, g.room.dist);
      const gold = Math.round((50 + 25 * (tier - 1)) * Math.pow(1.4, st.uses));
      const shards = Math.round((6 + 2 * (tier - 1)) * Math.pow(1.4, st.uses));
      if (p.coins < gold) { g.shopMsg = { text: `Crafting needs ${gold} gold`, t: 1.5 }; Sfx.play('error'); return; }
      if ((p.shards || 0) < shards) { g.shopMsg = { text: `Crafting needs ${shards} shards (X salvages gear into shards)`, t: 2 }; Sfx.play('error'); return; }
      const isW = t.kind === 'craftWeapon';
      const arch = isW ? ((p.weapon && p.weapon.archetype) || undefined) : undefined;
      const items = [];
      for (let i = 0; i < 3; i++) items.push(isW ? Weapons.rollWeapon(tier, { minRarity: 2, luck: 0.35, archetype: arch }) : Weapons.rollArmor(tier, { minRarity: 2, luck: 0.35 }));
      g.craftPick = { st, isW, items, gold, shards };
      g.state = 'craftpick'; g.overlayT = 0; p.drawT = -1;
      Sfx.play('ui');
      return;
    }
    // #60 ENCHANT TABLE: spend gold + shards to disenchant + re-roll your active
    // weapon's enchants (a gamble to improve your gear). Cost climbs each use.
    if (t.kind === 'enchantTable') {
      openEnchantTable(t.et);
    }

    // #181 (Sam) the TRAP CHEST: open it and the doors slam, the ambush springs.
    // Kill everything and the chest gives up its loot.
    if (t.kind === 'trapChest') {
      springTrap(true);
      return;
    }
    // #75 TRAINING BARRACKS: spend gold at a station for a run-only stat boost
    if (t.kind === 'trainStation') {
      const st = t.st, cost = barracksCost();
      if (barracksMaxed()) { g.shopMsg = { text: `Your body is at its limit - trained ${BARRACKS_CAP} times this run`, t: 2 }; Sfx.play('error'); return; }
      if (p.coins < cost) { g.shopMsg = { text: `Need ${cost} gold to train ${st.stat}`, t: 1.6 }; Sfx.play('error'); return; }
      p.coins -= cost; st.uses++; p.barracksTrained = barracksTrained() + 1;
      st.apply(p);
      Sfx.play('upgrade');
      Fx.text(st.x, st.y - 30, st.stat + ' TRAINED', st.color, 14);
      Fx.burst(st.x, st.y, [st.color, '#ffd24c', '#fff'], 22, { speed: 170, life: 0.6, glow: true });
      g.shopMsg = { text: `${st.stat}: ${st.label}`, t: 2 };
      if (typeof Ach !== 'undefined') Ach.flag('barracks', g); // #86
    }

    if (t.kind === 'stairs') {
      if (!partyGathered()) { gatherDenied(); return; } // #237 descending is a party decision
      Sfx.play('stairs');
      g.floorNum++;
      g.player.heal(20); // breather between floors
      // tethered party: bring everyone down to the same next floor
      if (g.coop && typeof Net !== 'undefined') Net.sendR({ t: 'floor', floor: g.floorNum, seed: g.coopSeed });
      startFloor();
    }

    if (t.kind === 'portal') {
      if (!partyGathered()) { gatherDenied(); return; } // #237 the shortcut yanks the party (room-follow) - so the party decides
      // one-way ride to the floor's exit: the stairs room, or on a boss floor the
      // room right OUTSIDE the boss door (#21 - no long backtrack to the boss)
      const stairsRoom = g.dungeon.rooms.find(r => r.type === 'stairs');
      const dest = stairsRoom || roomOutsideBoss();
      if (dest) {
        Sfx.play('stairs');
        Fx.burst(p.x, p.y, ['#4cc9a8', '#b88aff'], 20, { speed: 180, life: 0.5, glow: true });
        g.portal = null;
        // co-op: pull the party along so nobody is left behind by the shortcut
        if (g.coop && typeof Net !== 'undefined') Net.send({ t: 'room', gx: dest.gx, gy: dest.gy, dir: null, fl: g.floorNum }); // #216
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
      if (typeof Ach !== 'undefined') Ach.flag('mercHired', g); // #86
    }

    if (t.kind === 'descentPortal') {
      if (!partyGathered()) { gatherDenied(); return; } // #237
      // plunge straight to the next circle - no stairs room, the fall IS the descent
      Sfx.play('stairs');
      Fx.burst(p.x, p.y, ['#ff5a2c', '#ffcc44', '#ff2200'], 24, { speed: 200, life: 0.5, glow: true });
      g.descentPortal = null;
      g.toadMsg = null;
      bankEssenceCheckpoint();
      g.floorNum++;
      if (g.coop && typeof Net !== 'undefined') Net.sendR({ t: 'floor', floor: g.floorNum, seed: g.coopSeed });
      p.heal(25); // a breath before the next circle
      startFloor();
    }

    // #13 (Sam) the NIGHTMARE portal: the next floor, but far deadlier and far richer.
    if (t.kind === 'nightmareExit') {
      if (!partyGathered()) { gatherDenied(); return; } // #237 nobody gets dragged into a nightmare alone
      Sfx.play('roar');
      Fx.burst(p.x, p.y, ['#ff2020', '#ff5a2c', '#3a0000', '#000'], 30, { speed: 220, life: 0.6, glow: true });
      Fx.shake(9, 0.5);
      g.descentPortal = null;
      g.portal = null;
      g.toadMsg = null;
      bankEssenceCheckpoint();
      g.nightmareNext = true;           // startFloor reads this to mark the new floor
      g.floorNum++;
      // co-op is host-authoritative: whoever takes the portal pulls the party, and the
      // nightmare flag rides the shared floor message so everyone lands on the same floor.
      if (g.coop && typeof Net !== 'undefined') Net.sendR({ t: 'floor', floor: g.floorNum, seed: g.coopSeed, nm: 1 });
      p.heal(20);
      startFloor();
    }
  }

  // ============================ ABILITIES (Q / R / ULTIMATE) ============================
  // Q = first two evolutions, R = next two, Ultimate (left-click) = a chosen fusion of Q+R.
  function useAbility() { castAbility(g.player.ability); }
  function useAbilityR() { castAbility(g.player.abilityR); }
  function useUltimate() { castAbility(g.player.abilityUlt); }

  // run ANY ability (Q/R/ultimate). Ults just carry bigger numbers + the ult flag.
  // #10 (Sam) a dungeon-wide ULTIMATE cast flash: a full-screen colour wash + a big
  // banner. Set here, ticked in updateUltFx, drawn over the HUD. In co-op it is also
  // triggered on remote clients (visual only, no sim impact).
  function triggerUltFlash(name, color) { g.ultFlash = { t: 0.7, max: 0.7, name: name || 'ULTIMATE', color: color || '#fff' }; }

  function castAbility(a) {
    const p = g.player;
    if (!a || a.cd > 0 || p.dead || p.rollT >= 0) return;
    // #78 Engineer turret is gated on CHARGES, not just cooldown - don't waste the cd if empty
    if (a.kind === 'turret' && ((p.turretCharges | 0) <= 0 || g.turrets.length >= p.turretMax())) {
      g.shopMsg = { text: (p.turretCharges | 0) <= 0 ? 'No turret charges' : 'Turret limit reached', t: 1.2 };
      Sfx.play('error'); return;
    }
    // #78/#92 Summoner: while the elemental is alive Q no longer errors - once it's
    // been out a moment, Q EMPOWERS the current elemental (earth=stone shield,
    // fire=nova, lightning=chain storm, poison=toxic cloud) on its own cooldown.
    // #229 summoner R8: TWO elementals - if the first lives and the second slot is
    // open, Q summons the second instead of empowering
    const _sumRank = (a.kind === 'summon' && a.classQ && typeof Abilities !== 'undefined' && Abilities.qRank) ? Abilities.qRank('summoner', p.statPoints) : 0;
    if (a.kind === 'summon' && g.summon && !g.summon.dead && !(_sumRank >= 8 && (!g.summon2 || g.summon2.dead))) {
      const s = g.summon;
      if ((s.empowerCd || 0) > 0) { g.shopMsg = { text: `Empower charging (${Math.ceil(s.empowerCd)}s)`, t: 1.2 }; Sfx.play('error'); return; }
      empowerSummon(s, p);
      return;
    }
    const dmgMul = a.dmgMul || 1;
    if (typeof Ach !== 'undefined') Ach.cast(a.ult ? 'ult' : (a === p.abilityR ? 'R' : 'Q'), g); // #86
    Sfx.play(a.ult ? 'roar' : 'heavy');

    // #109 class Q abilities GROW with player level. Scale the value-driven fields for
    // this cast (turret/summon read none of these - they fold level into their own
    // scaling below), then restore the base values before the post-cast modifiers.
    let _qScaled = null, _qGates = null;
    if (a === p.ability && a.classQ && typeof Abilities !== 'undefined' && Abilities.qLevelScale) {
      const s = Abilities.qLevelScale(p.level);
      // #226 (Q-DESIGN, supersedes #205's flat 4%) THE RANK SYSTEM. rank = points in
      // the class's RULING STAT. Each point grows the Q's SIGNATURE quantity
      // (Q_TUNE per-point channels); damage Qs also carry a PERCENT RIDER (qRider)
      // applied per target at the hit sites, so the Q stays a constant fraction of a
      // monster at every depth instead of being outscaled by the floor curve.
      const cls = (p.class && p.class.id) || '';
      const rank = Abilities.qRank ? Abilities.qRank(cls, p.statPoints) : 0;
      const tune = (Abilities.Q_TUNE && Abilities.Q_TUNE[cls]) || {};
      const pp = tune.perPoint || {};
      _qScaled = { dmg: a.dmg, radius: a.radius, heal: a.heal, dur: a.dur, knock: a.knock, dist: a.dist, dps: a.dps, qRider: a.qRider, _rank: a._rank, coinScaleCap: a.coinScaleCap };
      a.qRider = tune.rider || 0;
      a._rank = rank; // milestone gates (waves 1-4) and tooltips read this
      if (a.dmg) a.dmg = Math.round(a.dmg * s.dmg * (1 + (pp.dmgMul || 0) * rank));
      if (a.knock) a.knock = Math.round(a.knock * s.knock + (pp.knock || 0) * rank);
      if (a.radius) a.radius = Math.round(a.radius * s.radius + (pp.radius || 0) * rank);
      if (a.heal) a.heal = Math.min(0.95, a.heal * s.heal + (pp.heal || 0) * rank);
      if (a.dur) a.dur = +(a.dur + s.durBonus + (pp.dur || 0) * rank).toFixed(2);
      if (a.dist && pp.dist) a.dist = Math.round(a.dist + pp.dist * rank);
      if (a.dps) a.dps = Math.round(a.dps + (pp.dps || 0) * rank);
      _qGates = { cls, rank };
      // #227 (Q wave 1) MIGHT milestones that act at cast time
      if (cls === 'warrior' && rank >= 8 && a.knock) a.knock *= 2; // R8: the shove DOUBLES
      // #258 GAMBLER: FORTUNE raises the jackpot odds, +1% per rank (cap 50%)
      if (cls === 'gambler' && a.gamble) a.gamble = Math.min(0.5, 0.25 + 0.01 * rank);
      // #259 (Sam) the BANKROLL loads the gun: held gold adds damage, cap grows with rank
      if (cls === 'gambler') a.coinScaleCap = 100 + 10 * rank;
      // #260/#261 (Sam) THE ANTE: every pull costs 5 gold, and the Gambler alone may
      // go into DEBT - NO FLOOR. In debt the bankroll bonus runs BACKWARDS through
      // the same coinScale math; dig deep enough and a pull does nothing at all.
      if (cls === 'gambler') {
        p.coins -= 5;
        Fx.text(p.x, p.y - 74, '-5g ANTE', '#c9a86a', 11);
        if (p.coins < 0) Fx.text(p.x, p.y - 88, 'IN DEBT', '#e05555', 11);
      }
    }
    // #252 FUSION v2 scaling: an R fusion grows with POWER RANK = the combined points
    // in its two governing stats - the Q_TUNE recipe (per-rank channels, %-of-target
    // riders at the hit sites, hard caps on economy channels so PVP can't be farmed).
    let _fScaled = null;
    if (a.fusion && a === p.abilityR && typeof Abilities !== 'undefined' && Abilities.fusionRank) {
      const fRank = Abilities.fusionRank(p.statPoints, a.fusionStats);
      a._rank = fRank;
      const fpp = a.pp || {};
      _fScaled = { dmg: a.dmg, radius: a.radius, heal: a.heal, dur: a.dur, thorns: a.thorns, regen: a.regen, charges: a.charges, mint: a.mint, burstCap: a.burstCap, qRider: a.qRider, zap: a.zap, dist: a.dist, decoyHp: a.decoyHp, atkSpd: a.atkSpd, ringDmg: a.ringDmg, transmute: a.transmute, critCh: a.critCh, grind: a.grind, gamble: a.gamble, beamMul: a.beamMul, flameDmg: a.flameDmg };
      if (a.fRider) a.qRider = 0.06; // +6% of each target's max HP (bosses 1/3) - the hit sites already honour it
      if (fpp.dmg && a.dmg) a.dmg = Math.round(a.dmg * (1 + fpp.dmg * fRank));
      if (fpp.radius && a.radius) a.radius = Math.round(a.radius + fpp.radius * fRank);
      if (fpp.heal && a.heal) a.heal = Math.min(0.9, a.heal + fpp.heal * fRank);
      if (fpp.dur && a.dur) a.dur = +(a.dur + fpp.dur * fRank).toFixed(2);
      if (fpp.thorns && a.thorns) a.thorns = Math.round(a.thorns + fpp.thorns * fRank);
      if (fpp.regen && a.regen) a.regen = +(a.regen + fpp.regen * fRank).toFixed(1);
      if (fpp.charges && a.charges) a.charges = Math.min(6, Math.round(a.charges + fpp.charges * fRank));
      if (fpp.mint && a.mint) a.mint = Math.min(20, Math.round(a.mint + fpp.mint * fRank));
      if (fpp.burstCap && a.burstCap) a.burstCap = Math.round(a.burstCap + fpp.burstCap * fRank);
      if (fpp.zap && a.zap) a.zap = Math.round(a.zap * (1 + fpp.zap * fRank));
      if (fpp.dist && a.dist) a.dist = Math.round(a.dist + fpp.dist * fRank);
      if (fpp.decoyHp && a.decoyHp) a.decoyHp = Math.round(a.decoyHp + fpp.decoyHp * fRank);
      if (fpp.atkSpd && a.atkSpd) a.atkSpd = +(a.atkSpd + fpp.atkSpd * fRank).toFixed(2);
      if (fpp.ringDmg && a.ringDmg) a.ringDmg = Math.round(a.ringDmg * (1 + fpp.ringDmg * fRank));
      if (fpp.transmute && a.transmute) a.transmute = Math.round(a.transmute + fpp.transmute * fRank);
      if (fpp.critCh && a.critCh) a.critCh = +(a.critCh + fpp.critCh * fRank).toFixed(3);
      if (fpp.grind && a.grind) a.grind = Math.round(a.grind + fpp.grind * fRank);
      if (fpp.gamble && a.gamble) a.gamble = Math.min(0.4, +(a.gamble + fpp.gamble * fRank).toFixed(3));
      if (fpp.beamMul && a.beamMul) a.beamMul = +(a.beamMul + fpp.beamMul * fRank).toFixed(2);   // #256 EXCALIBUR
      if (fpp.flameDmg && a.flameDmg) a.flameDmg = Math.round(a.flameDmg + fpp.flameDmg * fRank); // #256 PROMETHEUS
    }

    if (a.kind === 'nova' || a.kind === 'strike') {
      // #228 rogue R8 SHADOWSTEP: cast at range and you step BEHIND the nearest
      // target before the blade lands - gap-closer and execute in one press.
      if (_qGates && _qGates.cls === 'rogue' && _qGates.rank >= 8) {
        let best = null, bd = 1e9;
        for (const m of g.monsters) { if (m.dead || m.airborne || m.spawnT > 0) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; best = m; } }
        if (best && bd > (a.radius || 115) && bd < 340) {
          const ang = Math.atan2(best.y - p.y, best.x - p.x);
          p.x = Math.max(PF.x + p.r, Math.min(PF.x + PF.w - p.r, best.x + Math.cos(ang) * (best.r + p.r + 6)));
          p.y = Math.max(PF.y + p.r, Math.min(PF.y + PF.h - p.r, best.y + Math.sin(ang) * (best.r + p.r + 6)));
          Fx.burst(p.x, p.y, ['#2a2a35', '#ffd24c'], 14, { speed: 150, life: 0.4, glow: true });
        }
      }
      let qKills = 0;
      let dmg = (a.dmg || 60) * dmgMul;
      if (a.coinScale) dmg += Math.min(a.coinScaleCap || 140, p.coins * 0.5); // Coin Storm / #259 the Gambler's bankroll
      if (a.missingHp) dmg += Math.round((p.maxHp - p.hp) * a.missingHp); // #252 BLOOD MONEY
      if (a.gamble) { // #255/#258 JACKPOT: pull the lever
        a._jackpot = Math.random() < Math.min(0.85, a.gamble + (a._pity || 0));
        if (_qGates && _qGates.cls === 'gambler') { // #258 the milestone ladder
          if (a._jackpot) {
            a._pity = 0;
            if (_qGates.rank >= 8) a._halfCd = true;   // R8: the house pays back half
            if (_qGates.rank >= 12) a._resetCd = true; // R12: and deals again
          } else if (_qGates.rank >= 4) {
            a._pity = (a._pity || 0) + 0.10;           // R4: the machine is DUE
            Fx.text(p.x, p.y - 46, `DUE UP +${Math.round(a._pity * 100)}%`, '#c9a86a', 11);
          }
        }
        if (a._jackpot) { // the win triples EVERYTHING, rider included - it must feel huge
          dmg *= 3; a.qRider = (a.qRider || 0) * 3;
          Fx.text(p.x, p.y - 60, 'JACKPOT!', '#ffce54', 20); Fx.shake(8, 0.3);
        }
        // #258 THE REEL: three glyphs spin over your head, then lock on the verdict
        if (a.reel) g.ultFx.push({ type: 'reel', x: p.x, y: p.y - 46, t: 0, dur: 0.9, win: !!a._jackpot });
      }
      if (a.transmute) { // #254 PHILOSOPHER'S STONE: gold IS mana (#260: debt spends nothing)
        const spend = Math.max(0, Math.min(a.transmute, p.coins));
        p.coins -= spend; dmg += spend;
        Fx.text(p.x, p.y - 46, `${spend}g TRANSMUTED`, '#c9a86a', 13);
      }
      let fHits = 0;
      const R = a.radius || 150;
      Fx.burst(p.x, p.y, [a.color, '#fff'], 34, { speed: 340, life: 0.5, glow: true });
      Fx.shake(6, 0.22);
      for (const m of g.monsters) {
        if (m.dead || m.airborne || m.spawnT > 0) continue;
        if (Math.hypot(m.x - p.x, m.y - p.y) > R + m.r) continue;
        // #226 percent rider: + a slice of THIS target's max HP (bosses at 1/3)
        let hitDmg = Math.max(0, dmg + (a.qRider ? m.maxHp * a.qRider * (m.isBoss ? 1 / 3 : 1) : 0)); // #261 bottomless debt zeroes a pull, never heals the target
        if (a.executeBelow && m.hp <= m.maxHp * a.executeBelow) hitDmg *= 2; // #255 GORDIAN CUT
        // #227 warrior R12 WALL SLAM: shoved into a wall within the window = hit again
        if (_qGates && _qGates.cls === 'warrior' && _qGates.rank >= 12) m._slam = { dmg: Math.round(hitDmg), t: 0.6 };
        m.takeHit(hitDmg, { sx: p.x, sy: p.y, knock: a.knock || 120, crit: !!a.critAll, fromPlayer: true, hitSfx: 'hitHeavy' }, g);
        if (_qGates && _qGates.cls === 'mage' && _qGates.rank >= 12 && !m.dead) { m.chillT = Math.max(m.chillT || 0, 2.5); m.chillMul = 0.5; } // #229 R12: everything hit is CHILLED
        if (m.dead) qKills++;
        if (a.ignite && !m.dead) m.burn = { t: 3, tick: 0, dps: a.ignite }; // #253 PROMETHEUS
        if (a.coinLoose || a._jackpot) for (let ci = 0; ci < (a.coinLoose || 8); ci++) spawnPickup('coin', m.x, m.y); // #254 CROESUS / #255 JACKPOT
        fHits++;
      }
      // #253 PROMETHEUS: stolen fire feeds your spells - power per enemy ignited
      if (a.ignite && fHits) {
        p.fstance = { id: 'prometheus', t: 6, spellPow: Math.min(0.6, 0.05 * fHits), color: a.color };
        Fx.text(p.x, p.y - 46, `STOLEN FIRE +${Math.round(Math.min(0.6, 0.05 * fHits) * 100)}%`, '#ff8a3d', 13);
      }
      // #252 BLOOD MONEY: every enemy struck pays a bounty (hard-capped, PVP-safe)
      if (a.coinPerHit && fHits) {
        const pay = Math.min(24, fHits * a.coinPerHit);
        p.coins += pay;
        Fx.text(p.x, p.y - 46, `+${pay} BOUNTY`, '#ffce54', 13);
      }
      // #258 MOTHER LODE: sometimes the eruption unearths a weapon
      if (a.loot && Math.random() < a.loot) dropGearInstanced('weapon', p.x, p.y - 24, { tier: 2, minRarity: 2 });
      // #252 ATLAS: allies caught in the slam gain a shield charge (their client owns
      // their buffs - send it, they apply it, mirror of the 'pheal' flow)
      if (a.allyShield && g.coop && typeof Net !== 'undefined' && Net.connected) {
        for (const [id, rp] of g.remotePlayers) {
          if (rp.downed || !rp.room || !g.room || rp.room[0] !== g.room.gx || rp.room[1] !== g.room.gy) continue;
          if (Math.hypot(rp.x - p.x, rp.y - p.y) < R) Net.sendR({ t: 'fshield', to: id });
        }
      }
      // #229 mage: R4 the nova leaves a 2s SLOW FIELD; R8 a second, smaller pulse
      if (_qGates && _qGates.cls === 'mage') {
        if (_qGates.rank >= 4) g.ultFx.push({ type: 'qslow', x: p.x, y: p.y, t: 0, dur: 2, radius: R, color: a.color });
        if (_qGates.rank >= 8) g.ultFx.push({ type: 'qpulse', x: p.x, y: p.y, t: 0, delay: 0.5, dmg: Math.round(dmg * 0.5), radius: Math.round(R * 0.75), rider: (a.qRider || 0) * 0.5, color: a.color });
      }
      // #228 rogue: R4 a kill RESETS the cooldown (chain executions); R12 kills grant Vanish
      if (_qGates && _qGates.cls === 'rogue' && qKills > 0) {
        if (_qGates.rank >= 4) { a._resetCd = true; Fx.text(p.x, p.y - 40, 'RESET', '#ffd24c', 12); }
        if (_qGates.rank >= 12) { p.invisT = Math.max(p.invisT || 0, 1.5); Fx.text(p.x, p.y - 54, 'VANISH', '#b6c0d0', 12); }
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
            const dashDmg = (a.dmg || 55) * dmgMul + (a.qRider ? m.maxHp * a.qRider * (m.isBoss ? 1 / 3 : 1) : 0); // #226
            m.takeHit(dashDmg, { sx: px, sy: py, knock: a.dashKnock || 150, crit: !!a.critAll, fromPlayer: true, hitSfx: a.dashKnock ? 'hitHeavy' : 'hitLight' }, g); // #255 RHINO sends them flying
            hit.add(m);
            if (a.rob) { p.coins += 2; Fx.text(m.x, m.y - 18, '+2', '#ffce54', 10); } // #254 HIGHWAYMAN
          }
        }
      }
      // #253 TYPHOON: the whirlwind bursts where you land
      if (a.exitBurst) {
        for (const m of g.monsters) {
          if (m.dead || m.airborne || m.spawnT > 0) continue;
          if (Math.hypot(m.x - tx, m.y - ty) > 130 + m.r) continue;
          m.takeHit((a.dmg || 55) * 1.5 * dmgMul + (a.qRider ? m.maxHp * a.qRider * (m.isBoss ? 1 / 3 : 1) : 0), { sx: tx, sy: ty, knock: 240, fromPlayer: true, hitSfx: 'hitHeavy' }, g);
        }
        Fx.burst(tx, ty, [a.color, '#fff'], 30, { speed: 300, life: 0.5, glow: true });
        Fx.shake(5, 0.2);
      }
      // #253 HERMES: three afterimages pulse along the blink path (the mage-R8 qpulse rig)
      if (a.afterimages) {
        for (let k = 1; k <= 3; k++) {
          g.ultFx.push({ type: 'qpulse', x: p.x + (tx - p.x) * k / 3, y: p.y + (ty - p.y) * k / 3, t: 0, delay: 0.25 + k * 0.12, dmg: Math.round((a.dmg || 55) * dmgMul * 0.8), radius: 95, rider: (a.qRider || 0) * 0.5, color: a.color });
        }
      }
      // #228 (Q wave 2) ranger: THE VOLLEY IS REAL. Arrows loose from the middle of
      // the tumble at your WEAPON's damage (so they scale with gear, deliberately no
      // rider). R1: 3 arrows at the nearest enemies. R4: a full circle. R8: pierce.
      if (_qGates && _qGates.cls === 'ranger' && _qGates.rank >= 1) {
        const vx = (p.x + tx) / 2, vy = (p.y + ty) / 2;
        const wdmg = Math.round(((p.weapon && p.weapon.dmg) || 12) * (p.stats.dmgMul || 1));
        const pierce = _qGates.rank >= 8 ? 3 : 0;
        const shots = [];
        if (_qGates.rank >= 4) {
          for (let k = 0; k < 12; k++) shots.push((k / 12) * Math.PI * 2);
        } else {
          const near = g.monsters.filter(m => !m.dead && !m.airborne && m.spawnT <= 0)
            .sort((A, B) => Math.hypot(A.x - vx, A.y - vy) - Math.hypot(B.x - vx, B.y - vy)).slice(0, 3);
          for (const t of near) shots.push(Math.atan2(t.y - vy, t.x - vx));
        }
        for (const sa of shots) {
          g.projectiles.push({ x: vx, y: vy, vx: Math.cos(sa) * 520, vy: Math.sin(sa) * 520, r: 4,
            dmg: wdmg, from: 'player', color: '#6ee7a0', life: 1.1, arrow: true, hitSet: new Set(), pierce, crit: false });
        }
        if (shots.length) { Sfx.play('bowfire'); Fx.burst(vx, vy, ['#6ee7a0', '#fff'], 10, { speed: 160, life: 0.35, glow: true }); }
      }
      p.x = tx; p.y = ty;
      p.iframes = Math.max(p.iframes, (a.iframe || 0.4) + (a.iframeAfter || 0));
      if (a.refundRoll) p.rollCd = 0;
      Fx.shake(4, 0.15);
    } else if (a.kind === 'buff') {
      // #230 paladin: R8 the cast CLEANSES; R12 overhealing grants a bonus shield
      if (_qGates && _qGates.cls === 'paladin') {
        if (_qGates.rank >= 8) { p.bleed = null; p.slowT = 0; p.slowMul = 1; p.blindT = 0; Fx.text(p.x, p.y - 46, 'CLEANSED', '#ffe08a', 12); }
        if (_qGates.rank >= 12 && a.heal && p.hp + p.maxHp * a.heal > p.maxHp) {
          _qGates.oh = 1; // consumed by the castShield line below, AFTER the base charges
          Fx.text(p.x, p.y - 60, 'OVERHEAL SHIELD', '#ffe08a', 11);
        }
      }
      if (a.heal) p.heal(p.maxHp * a.heal);
      Fx.burst(p.x, p.y, [a.color, '#fff'], 26, { speed: 170, life: 0.7, glow: true });
    } else if (a.kind === 'meteor') {
      // a huge delayed blast where you're aiming
      g.ultFx.push({ type: 'meteor', x: input.mouse.x, y: input.mouse.y, t: 0, delay: 0.8, dmg: a.dmg, radius: a.radius, color: a.color });
    } else if (a.kind === 'inferno') {
      for (const m of g.monsters) { if (!m.dead) m.burn = { t: a.dur, tick: 0, dps: a.dps }; }
      Fx.burst(p.x, p.y, ['#ff5a2c', '#ffcc44'], 32, { speed: 220, life: 0.6, glow: true });
    } else if (a.kind === 'sleep') {
      for (const m of g.monsters) { if (!m.dead && !m.isBoss) { m.stagger = Math.max(m.stagger || 0, a.dur); m.state = 'idle'; } }
      Fx.burst(p.x, p.y, ['#9ecbff', '#fff'], 24, { speed: 150, life: 0.6, glow: true });
    } else if (a.kind === 'freeze') {
      for (const m of [...g.monsters]) { if (m.dead) continue; m.chillT = a.dur; m.chillMul = 0.32; m.takeHit(a.dmg, { sx: p.x, sy: p.y, fromPlayer: true, hitSfx: 'hitLight' }, g); }
      Fx.burst(p.x, p.y, ['#7fe0ff', '#fff'], 32, { speed: 240, life: 0.6, glow: true });
    } else if (a.kind === 'storm') {
      g.ultFx.push({ type: 'storm', t: 0, dur: a.dur, next: 0, dmg: a.dmg, strikes: a.strikes, done: 0, color: a.color });
    } else if (a.kind === 'poison') {
      g.ultFx.push({ type: 'poison', x: p.x, y: p.y, t: 0, dur: a.dur, tick: 0, dps: a.dps, color: a.color });
    } else if (a.kind === 'vanish') {
      p.invisT = a.dur; p.iframes = Math.max(p.iframes, a.dur);
      Fx.burst(p.x, p.y, ['#b6c0d0', '#fff'], 26, { speed: 180, life: 0.6 });
    } else if (a.kind === 'midas') {
      g.midasT = 12; // kills drop double gold for a window
      for (const m of [...g.monsters]) { if (m.dead || m.airborne || m.spawnT > 0) continue; if (Math.hypot(m.x - p.x, m.y - p.y) > (a.radius || 180) + m.r) continue; m.takeHit(a.dmg, { sx: p.x, sy: p.y, knock: 150, fromPlayer: true, hitSfx: 'hitHeavy' }, g); }
      Fx.burst(p.x, p.y, ['#ffd24c', '#fff'], 34, { speed: 300, life: 0.5, glow: true });
    } else if (a.kind === 'caltrops') {
      g.ultFx.push({ type: 'caltrops', t: 0, dur: a.dur, color: a.color });
    } else if (a.kind === 'fear') {
      // #78 Barbarian War Shout: every enemy in range flees in terror
      const R = a.radius || 300;
      for (const m of g.monsters) {
        if (m.dead || m.isBoss || Math.hypot(m.x - p.x, m.y - p.y) >= R + m.r) continue;
        m.feared = a.dur || 5;
        if (_qGates && _qGates.rank >= 4) m.fearedAmp = 1.15;  // #227 barb R4: fear opens them up
        if (_qGates && _qGates.rank >= 12) m._cower = true;    // #227 barb R12: cornered = stunned
      }
      // #227 barb R8: allies near you catch the fury (their client applies its own rage)
      if (_qGates && _qGates.cls === 'barbarian' && _qGates.rank >= 8 && g.coop && typeof Net !== 'undefined') {
        for (const [id, rp] of g.remotePlayers) {
          if (rp.downed || !rp.room || !g.room || rp.room[0] !== g.room.gx || rp.room[1] !== g.room.gy) continue;
          if (Math.hypot(rp.x - p.x, rp.y - p.y) < R) Net.sendR({ t: 'qbuff', to: id, k: 'rage', dur: 3 });
        }
      }
      Fx.burst(p.x, p.y, [a.color, '#fff', '#ff9a9a'], 34, { speed: 300, life: 0.6, glow: true });
      Fx.shake(6, 0.28);
    } else if (a.kind === 'ftoggle') { // #256 PHILOSOPHER'S STONE: gold burns while it's lit
      if (p.fstance && p.fstance.id === 'stone') {
        p.fstance = null;
        Fx.text(p.x, p.y - 40, 'THE STONE COOLS', a.color, 13);
      } else if (p.coins <= 0) {
        g.shopMsg = { text: 'No gold to burn', t: 1.2 }; Sfx.play('error');
        a.cd = 0; return;
      } else {
        const rank = (typeof Abilities !== 'undefined' && Abilities.fusionRank) ? Abilities.fusionRank(p.statPoints, a.fusionStats) : 0;
        p.fstance = { id: 'stone', t: 9999, color: a.color, drain: a.drain || 4, drainT: 0,
          dmgStack: Math.min(0.5, 0.15 + ((a.pp && a.pp.power) || 0.015) * rank) };
        Fx.text(p.x, p.y - 40, `THE STONE BURNS +${Math.round(p.fstance.dmgStack * 100)}%`, a.color, 14);
        Fx.burst(p.x, p.y, [a.color, '#ffd24c'], 24, { speed: 200, life: 0.6, glow: true });
      }
    } else if (a.kind === 'fzone') { // #254 SANCTUARY / #255 EVENT HORIZON (grind: rot, no heal)
      if (a.grind) g.ultFx.push({ type: 'miasma', x: p.x, y: p.y, t: 0, dur: a.dur || 6, radius: a.radius || 170, dps: a.grind, rider: 0.01 });
      else g.ultFx.push({ type: 'qregen', x: p.x, y: p.y, t: 0, dur: a.dur || 5, radius: a.radius || 150, hps: Math.round(p.maxHp * 0.03) });
      g.ultFx.push({ type: 'qslow', x: p.x, y: p.y, t: 0, dur: a.dur || 5, radius: a.radius || 150, color: a.color });
      if (g.coop && typeof Net !== 'undefined') Net.sendR({ t: 'qzone', x: Math.round(p.x), y: Math.round(p.y), dur: a.dur || 5, radius: a.radius || 150, fl: g.floorNum });
      Fx.text(p.x, p.y - 40, 'SANCTUARY', a.color, 14);
    } else if (a.kind === 'fmark') { // #254 KING'S RANSOM: mark the richest head in the room
      let best = null, bs = -1;
      for (const m of g.monsters) {
        if (m.dead || m.spawnT > 0) continue;
        const score = (m.isBoss ? 2 : m.elite ? 1 : 0) * 1e6 + m.maxHp;
        if (score > bs) { bs = score; best = m; }
      }
      if (best) {
        best.ransom = true;
        best.takeHit((a.dmg || 40) * dmgMul + best.maxHp * (a.qRider || 0.06) * 2 * (best.isBoss ? 1 / 3 : 1), { sx: p.x, sy: p.y, fromPlayer: true, hitSfx: 'hitHeavy' }, g);
        Fx.text(best.x, best.y - best.r - 12, 'RANSOM', '#ffd24c', 14);
        Fx.burst(best.x, best.y, ['#ffd24c', '#fff'], 20, { speed: 200, life: 0.5, glow: true });
      }
    } else if (a.kind === 'foracle') { // #254 ORACLE OF DELPHI: sight, then insight
      if (g.dungeon) for (const rm of g.dungeon.rooms) rm.visited = true; // the floor lays itself bare
      // #257 the PROPHECY: the Oracle names your fortune - the best room left on the
      // floor gets a pulsing star on the minimap for the rest of the floor
      if (g.dungeon) {
        const PRIO = { mythicshop: 4, boss: 3, treasure: 2, shop: 1 };
        let best = null, bp = 0;
        for (const rm of g.dungeon.rooms) {
          if (rm === g.room || rm.cleared) continue;
          const pr = PRIO[rm.type] || 0;
          if (pr > bp) { bp = pr; best = rm; }
        }
        if (best) { g.oracleMark = { gx: best.gx, gy: best.gy }; Fx.text(p.x, p.y - 56, 'THE ORACLE NAMES YOUR FORTUNE', '#b06bff', 12); }
      }
      for (const m of g.monsters) {
        if (m.dead || m.spawnT > 0) continue;
        m.takeHit((a.dmg || 30) * dmgMul + m.maxHp * (a.qRider || 0) * (m.isBoss ? 1 / 3 : 1), { sx: m.x, sy: m.y, fromPlayer: true, hitSfx: 'hitArrow' }, g);
        m.chillT = Math.max(m.chillT || 0, 2.5); m.chillMul = 0.5;
      }
      Fx.shake(3, 0.15);
      Fx.text(p.x, p.y - 40, 'THE ORACLE SPEAKS', a.color, 14);
    } else if (a.kind === 'fgoose') { // #257 (Sam) GOLDEN GOOSE is a REAL BIRD now
      g.goose = { x: p.x - 24, y: p.y + 10, r: 10, hp: 40, maxHp: 40, t: (a.dur || 8), dead: false,
        layT: 1.0, bob: 0 };
      p.fstance = { id: 'goldengoose', t: a.dur || 8, color: a.color }; // the aura ring tracks it
      Fx.text(p.x, p.y - 40, 'THE GOOSE', a.color, 14);
      Fx.burst(p.x - 24, p.y + 10, [a.color, '#fff'], 16, { speed: 140, life: 0.5, glow: true });
    } else if (a.kind === 'fstance' || a.kind === 'fparthian' || a.kind === 'fstorm' || a.kind === 'ffoot' || a.kind === 'fflame') { // #252-#256 the stances
      p.fstance = { id: a.stance, t: a.dur || 5, reduce: a.reduce || 0, thorns: a.thorns || 0, cleave: !!a.cleave, goldArmorCap: a.goldArmorCap || 0, regen: a.regen || 0, ramp: 0, healed: false, color: a.color,
        atkSpd: a.atkSpd || 0, spdMul: a.spdMul || 0, noSlow: !!a.noSlow, firstCrit: !!a.firstCrit, seen: a.firstCrit ? new Set() : null,
        echoBoost: a.echoBoost || 0, zap: a.zap || 0, zapT: 0, shotT: 0,
        critCh: a.critCh || 0, critPay: !!a.critPay, dmgStack: 0, zapFast: !!a.zapFast, zapChain: a.zapChain || 1, gooseT: 0,
        beamMul: a.beamMul || 0, flameDmg: a.flameDmg || 0, ignite: a.ignite || 0, flameT: 0 };
      Fx.text(p.x, p.y - 40, a.name.toUpperCase(), a.color, 14);
      Fx.burst(p.x, p.y, [a.color, '#fff'], 24, { speed: 200, life: 0.6, glow: true });
    } else if (a.kind === 'froot') { // #252 ANTAEUS: the release happens in player.update
      p.rootT = a.dur || 3; p.rootRegen = a.regen || 8; p.rootStore = 0; p.rootCap = a.burstCap || 220;
      Fx.text(p.x, p.y - 40, 'ROOTED', a.color, 14);
      Fx.burst(p.x, p.y, [a.color, '#6b4a2a'], 18, { speed: 120, life: 0.5 });
    } else if (a.kind === 'fvanish') { // #252 HOUDINI / #255 SMOKE BOMB
      if (a.smoke) g.ultFx.push({ type: 'qslow', x: p.x, y: p.y, t: 0, dur: 4, radius: 140, color: a.color });
      p.invisT = Math.max(p.invisT || 0, a.dur || 1.2);
      p.iframes = Math.max(p.iframes, (a.dur || 1.2) + 0.3);
      p.bleed = null; p.slowT = 0; p.slowMul = 1; // shed every DoT and slow
      p._houdini = true;
      Fx.burst(p.x, p.y, ['#b6c0d0', '#fff'], 30, { speed: 260, life: 0.5, glow: true });
    } else if (a.kind === 'fdecoy') { // #253 MIRAGE: a shimmering double that taunts, then detonates
      g.decoy = { x: p.x, y: p.y, r: 14, hp: a.decoyHp || 120, maxHp: a.decoyHp || 120, t: a.dur || 5, dead: false,
        boom: Math.round((a.dmg || 90) * dmgMul), rider: (a.qRider || 0), color: a.color };
      p.invisT = Math.max(p.invisT || 0, 1.0); // slip away while every eye turns
      Fx.burst(p.x, p.y, [a.color, '#fff'], 26, { speed: 220, life: 0.6, glow: true });
    } else if (a.kind === 'ffleece') { // #252 GOLDEN FLEECE: the mint lives in player.damage
      p.buffs.shield = (p.buffs.shield || 0) + (a.charges || 2);
      p.fleeceT = 12; p.fleeceMint = a.mint || 6;
      Fx.text(p.x, p.y - 40, 'THE FLEECE', a.color, 14);
      Fx.burst(p.x, p.y, [a.color, '#fff'], 22, { speed: 180, life: 0.6, glow: true });
    } else if (a.kind === 'heal') {
      // #78 Cleric Mend: heal self + allies (mercs/summons) in range
      p.heal(p.maxHp * (a.heal || 0.4));
      const R = a.radius || 240;
      for (const merc of g.mercs) { if (!merc.dead && Math.hypot(merc.x - p.x, merc.y - p.y) < R) merc.hp = Math.min(merc.maxHp, merc.hp + merc.maxHp * (a.heal || 0.4)); }
      if (a.ringDmg) { // #254 ASCLEPIUS: the serpent staff cuts both ways
        for (const m of g.monsters) {
          if (m.dead || m.airborne || m.spawnT > 0) continue;
          if (Math.hypot(m.x - p.x, m.y - p.y) > R + m.r) continue;
          m.takeHit(a.ringDmg * dmgMul + (a.qRider ? m.maxHp * a.qRider * (m.isBoss ? 1 / 3 : 1) : 0), { sx: p.x, sy: p.y, knock: 100, fromPlayer: true, hitSfx: 'hitHeavy' }, g);
        }
        Fx.burst(p.x, p.y, [a.color, '#fff'], 26, { speed: 280, life: 0.5, glow: true });
      }
      // #230 cleric milestones: R4 heals also CURE (bleed/slow); R8 consecrates the
      // ground (a 4s regen circle, mirrored to teammates who heal their OWN champion
      // standing in it); R12 everyone healed gains a shield charge.
      if (_qGates && _qGates.cls === 'cleric') {
        if (_qGates.rank >= 4) { p.bleed = null; p.slowT = 0; p.slowMul = 1; }
        if (_qGates.rank >= 8) {
          g.ultFx.push({ type: 'qregen', x: p.x, y: p.y, t: 0, dur: 4, radius: 140, hps: Math.round(p.maxHp * 0.02) });
          if (g.coop && typeof Net !== 'undefined') Net.sendR({ t: 'qzone', x: Math.round(p.x), y: Math.round(p.y), dur: 4, radius: 140, fl: g.floorNum });
        }
        if (_qGates.rank >= 12) p.buffs.shield = Math.max(p.buffs.shield || 0, 1);
      }
      // #197 (Sam, live playtest) Mend finally heals TEAMMATES in range too. Their client
      // owns their hp, so we send the heal and they apply it (mirror of the 'phit' flow).
      if (g.coop && typeof Net !== 'undefined' && Net.connected) {
        for (const [id, rp] of g.remotePlayers) {
          if (rp.downed || !rp.room || !g.room || rp.room[0] !== g.room.gx || rp.room[1] !== g.room.gy) continue;
          if (Math.hypot(rp.x - p.x, rp.y - p.y) < R) Net.sendR({ t: 'pheal', to: id, frac: a.heal || 0.4,
            cl: (_qGates && _qGates.cls === 'cleric' && _qGates.rank >= 4) ? 1 : 0,
            sh: (_qGates && _qGates.cls === 'cleric' && _qGates.rank >= 12) ? 1 : 0 });
        }
      }
      Fx.burst(p.x, p.y, [a.color, '#fff', '#9effc0'], 30, { speed: 180, life: 0.7, glow: true });
    } else if (a.kind === 'turret') {
      // #78 Engineer: build a turret at the player's feet (charge consumed above-guarded)
      p.turretCharges--;
      const agi = (p.statPoints && p.statPoints.AGILITY) || 0;
      const lvlUp = 1 + 0.05 * (p.level - 1); // #109 turret power grows with level too
      const dmg = Math.round(11 * (p.stats.dmgMul || 1) * (1 + 0.15 * agi) * lvlUp);
      const hp = Math.round(60 * (1 + 0.06 * agi + 0.08 * Math.max(0, g.floorNum - 1)) * lvlUp);
      // #226 per-point channel: fire RATE (cap stays 5 - depth over width); the shot
      // carries the percent rider so turrets stay a real weapon on deep floors
      const tn = (typeof Abilities !== 'undefined' && Abilities.Q_TUNE && Abilities.Q_TUNE.engineer) || {};
      const rate = 0.7 / (1 + ((tn.perPoint && tn.perPoint.rateMul) || 0) * agi);
      // #228 R4: shots slow what they hit; R8: turrets inherit your weapon's element
      g.turrets.push({ x: p.x, y: p.y + 6, hp, maxHp: hp, dmg, atkCd: 0, atkRate: rate, range: 300, facing: 0, flash: 0, hurtCd: 0, dead: false, t: 0, qRider: tn.rider || 0,
        qSlow: agi >= 4, elem: agi >= 8 ? elementFromWeapon(p) : null });
      Fx.burst(p.x, p.y, [a.color, '#fff'], 16, { speed: 120, life: 0.4 });
      Fx.text(p.x, p.y - 30, 'TURRET', a.color, 12);
    } else if (a.kind === 'summon') {
      // #78 Summoner: conjure an elemental matching your slot-1 weapon (earth by default)
      const elem = elementFromWeapon(p);
      const arc = (p.statPoints && p.statPoints.ARCANE) || 0;
      const scale = 1 + 0.12 * arc + 0.06 * Math.max(0, g.floorNum - 1) + 0.05 * (p.level - 1); // #109 also grows with level
      // #229 fill the open slot (second elemental homes to your other side)
      const mk = makeElemental(elem, p.x - 24, p.y + 16, scale);
      mk.aura = _sumRank >= 4;      // R4: its element radiates
      mk.explode = _sumRank >= 12;  // R12: a parting gift on death
      if (g.summon && !g.summon.dead && _sumRank >= 8) { mk.hdx = 26; g.summon2 = mk; }
      else { mk.hdx = -26; g.summon = mk; }
      Fx.text(p.x, p.y - 30, elem.toUpperCase() + ' ELEMENTAL', a.color, 12);
      Fx.burst(p.x, p.y, [a.color, '#fff'], 22, { speed: 160, life: 0.5, glow: true });

    // ---- #156 the five new classes ------------------------------------------------
    } else if (a.kind === 'clones') {
      // MESMER: three copies of you. They are real bodies - enemies chase them (see
      // targeting in updateMonsters), and when one dies it detonates. Built on the merc
      // follower so they already move, get hit, and get targeted; the clone flag gives
      // them a lifespan and the death blast.
      // #229 R12: recasting with clones alive SWAPS you with the farthest one - a
      // planned blink - on a 1s micro-cooldown instead of a resummon.
      if (_qGates && _qGates.rank >= 12) {
        const live = g.mercs.filter(m => m.clone && !m.dead);
        if (live.length) {
          let far = live[0], fd = -1;
          for (const c2 of live) { const d = Math.hypot(c2.x - p.x, c2.y - p.y); if (d > fd) { fd = d; far = c2; } }
          const ox = p.x, oy = p.y;
          p.x = far.x; p.y = far.y; far.x = ox; far.y = oy;
          Fx.burst(p.x, p.y, ['#c78bff', '#fff'], 16, { speed: 180, life: 0.4, glow: true });
          Fx.burst(far.x, far.y, ['#c78bff', '#fff'], 16, { speed: 180, life: 0.4, glow: true });
          Sfx.play('ui');
          a._swapCd = true;
          if (_qScaled) Object.assign(a, _qScaled);
          if (_fScaled) Object.assign(a, _fScaled);
          a.cd = 1.0; a._swapCd = false;
          return; // the swap IS the cast
        }
      }
      const n = (a.clones || 3) + ((_qGates && _qGates.rank >= 4) ? 1 : 0); // #229 R4: FOUR clones
      // #158 (Sam) clones were far too weak - fragile, slow, and barely scratched. They are
      // COPIES OF YOU now: real HP, your move speed, and a real bite scaled to YOUR damage,
      // so they hold aggro AND kill, not just soak a hit and pop.
      const pdmg = Math.round((p.weapon && p.weapon.dmg || 14) * (p.stats.dmgMul || 1));
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const cl = makeMercFollower({ cls: 'blade' }, g.floorNum);
        cl.clone = true;
        cl.qRider = a.qRider || 0; // #226 the detonation carries the mesmer's rider
        cl.life = a.dur || 8;   // already level-scaled above
        cl.blastDmg = Math.round((a.dmg || 70) * (p.stats.dmgMul || 1));
        cl.blastR = a.radius || 130;
        cl.color = a.color;
        cl.maxHp = cl.hp = Math.max(1, Math.round(p.maxHp * 0.55));   // sturdy, not a wet decoy
        cl.speed = Math.round(cl.speed * 1.6);                          // keeps up and chases in
        cl.dmg = Math.max(cl.dmg * 2, Math.round(pdmg * 0.7));          // hits like you
        cl.atkRate = 0.34;                                             // and swings almost twice as often
        cl.x = p.x + Math.cos(ang) * 46; cl.y = p.y + Math.sin(ang) * 46;
        g.mercs.push(cl);
      }
      Fx.text(p.x, p.y - 30, 'MIRROR IMAGE', a.color, 13);
      Fx.burst(p.x, p.y, [a.color, '#fff', '#e8c8ff'], 26, { speed: 190, life: 0.55, glow: true });

    } else if (a.kind === 'shift') {
      // DRUID: cycle Bear -> Wolf -> Owl -> back to your own body. Each form is a real
      // trade-off (PlayerDef.FORMS); shifting is nearly free so you shift constantly.
      const FORMS = PlayerDef.FORMS;
      const cur = p.form ? FORMS.findIndex(f => f.id === p.form.id) : -1;
      const next = cur + 1;
      // #157 setForm sets the form AND the hitbox from the same scale, so a bear is really
      // a bigger target and an owl is really a smaller one. Never assign p.form directly.
      PlayerDef.setForm(p, next >= FORMS.length ? null : FORMS[next]);
      const label = p.form ? p.form.name.toUpperCase() : 'OWN SHAPE';
      const col = p.form ? p.form.color : '#7fd47f';
      Fx.text(p.x, p.y - 32, label, col, 14);
      if (p.form && p.form.note) Fx.text(p.x, p.y - 16, p.form.note, col, 9);
      Fx.burst(p.x, p.y, [col, '#fff', '#7fd47f'], 22, { speed: 170, life: 0.5, glow: true });
      // #230 druid milestones: R4 shifting heals 5%; R8 each form gains a MOVE (on a
      // 6s internal gate); R12 PRIMAL MASTERY - EVERY shift fires the move for free.
      if (_qGates && p.form) {
        if (_qGates.rank >= 4) p.heal(p.maxHp * 0.05);
        const moveOk = _qGates.rank >= 12 || (_qGates.rank >= 8 && g.time - (a._moveT === undefined ? -99 : a._moveT) > 6);
        if (_qGates.rank >= 8 && moveOk) {
          a._moveT = g.time;
          const fid = p.form.id;
          if (fid === 'bear') {          // ROAR: everything close flinches
            for (const m of g.monsters) { if (!m.dead && !m.isBoss && Math.hypot(m.x - p.x, m.y - p.y) < 180 + m.r) m.stagger = Math.max(m.stagger || 0, 0.8); }
            Fx.text(p.x, p.y - 46, 'ROAR', '#a8763f', 13); Fx.shake(5, 0.2); Sfx.play('roar');
          } else if (fid === 'wolf') {   // POUNCE: a short lunge that rakes what it crosses
            const ang = p.facing, d0 = 120;
            const tx = Math.max(PF.x + p.r, Math.min(PF.x + PF.w - p.r, p.x + Math.cos(ang) * d0));
            const ty = Math.max(PF.y + p.r, Math.min(PF.y + PF.h - p.r, p.y + Math.sin(ang) * d0));
            const dx2 = tx - p.x, dy2 = ty - p.y, len2 = dx2 * dx2 + dy2 * dy2 || 1;
            for (const m of g.monsters) {
              if (m.dead || m.airborne || m.spawnT > 0) continue;
              const t2 = Math.max(0, Math.min(1, ((m.x - p.x) * dx2 + (m.y - p.y) * dy2) / len2));
              if (Math.hypot(m.x - (p.x + dx2 * t2), m.y - (p.y + dy2 * t2)) < m.r + p.r + 6) m.takeHit(Math.round(14 * (p.stats.dmgMul || 1)), { sx: p.x, sy: p.y, knock: 90, fromPlayer: true, hitSfx: 'hitLight' }, g);
            }
            p.x = tx; p.y = ty;
            Fx.text(p.x, p.y - 40, 'POUNCE', '#c8d0de', 12);
          } else if (fid === 'owlbear') { // WING BUFFET: a violent gust
            for (const m of g.monsters) { if (m.dead || m.airborne || m.spawnT > 0) continue; if (Math.hypot(m.x - p.x, m.y - p.y) < 120 + m.r) m.takeHit(Math.round(10 * (p.stats.dmgMul || 1)), { sx: p.x, sy: p.y, knock: 320, fromPlayer: true, hitSfx: 'hitLight' }, g); }
            Fx.text(p.x, p.y - 46, 'WING BUFFET', '#c9a86a', 12); Fx.shake(4, 0.15);
          }
        }
      }

    } else if (a.kind === 'miasma') {
      // #230 DEATH KNIGHT: MIASMA. A cloud of rot - poison DoT (with the %/s rider)
      // and WITHER: everything inside deals 20% less damage. R4 it follows you,
      // R8 the rot feeds you, R12 what the poison kills rises for you.
      const rk = _qGates ? _qGates.rank : 0;
      g.ultFx.push({ type: 'miasma', x: p.x, y: p.y, t: 0, dur: a.dur || 8, radius: a.radius || 180,
        dps: (a.dps || 25) * (p.stats.dmgMul || 1), rider: a.qRider || 0,
        follow: rk >= 4, regen: rk >= 8, rise: rk >= 12 });
      Fx.text(p.x, p.y - 32, rk >= 4 ? 'THE BLACK WIND' : 'MIASMA', a.color, 14);
      Fx.burst(p.x, p.y, ['#7aa06a', '#4a6a3a', '#2a3a24'], 30, { speed: 140, life: 0.9 });
      Sfx.play('burn');

    } else if (a.kind === 'undying') {
      // DEATH KNIGHT: LIFE AFTER DEATH. Arm the rune - the next killing blow leaves you
      // on 1 HP (player.js hurt() spends it). DEATH OVER EVERYTHING: it also detonates.
      p.buffs.undyingT = a.dur || 12;   // already level-scaled above
      Fx.text(p.x, p.y - 32, 'LIFE AFTER DEATH', a.color, 14);
      Fx.burst(p.x, p.y, [a.color, '#dff7f4', '#2a4a4e'], 30, { speed: 200, life: 0.7, glow: true });

    } else if (a.kind === 'raise') {
      // NECROMANCER: the grave gives more as you grow. Tier by level:
      //   1-4   one skeletal knight
      //   5-9   two skeletal knights
      //   10+   THREE knights and TWO archers - the final form
      const L = p.level | 0;
      // #229 (Q-DESIGN, approved) the army ladder is keyed to ARCANE RANK now, not
      // level: rank 0-3 one knight, 4-7 two, 8+ the full 3+2, 12+ adds the GOLEM.
      const rk = _qGates ? _qGates.rank : 0;
      const tier = rk >= 8 ? 3 : rk >= 4 ? 2 : 1;
      p.undeadTier = tier;
      const knights = tier === 3 ? 3 : tier;
      const archers = tier === 3 ? 2 : 0;
      for (const m of g.mercs) if (m.bone && !m.dead) m.dead = true;   // the old dead lie back down
      g.mercs = g.mercs.filter(m => !(m.bone && m.dead));
      const arc = (p.statPoints && p.statPoints.ARCANE) || 0;
      const scale = 1 + 0.10 * arc + 0.05 * (L - 1);
      const raise = (cls, i, n) => {
        const s = makeMercFollower({ cls }, g.floorNum);
        s.bone = true;
        s.color = cls === 'bow' ? '#cfe6cf' : '#e6efe6';
        s.dmg = Math.round(s.dmg * scale);
        s.maxHp = s.hp = Math.round(s.maxHp * scale);
        const ang = (i / Math.max(1, n)) * Math.PI * 2;
        s.x = p.x + Math.cos(ang) * 40; s.y = p.y + Math.sin(ang) * 40 + 10;
        g.mercs.push(s);
        Fx.burst(s.x, s.y, ['#9ae6a0', '#e6efe6', '#3a5a40'], 14, { speed: 130, life: 0.5, glow: true });
      };
      const total = knights + archers;
      for (let i = 0; i < knights; i++) raise('blade', i, total);
      // #229 R12: a BONE GOLEM - huge, slow, and monsters can't ignore it (it taunts
      // by standing in partyTargets like a mesmer clone does)
      if (rk >= 12) {
        const gm = makeMercFollower({ cls: 'blade' }, g.floorNum);
        gm.bone = true; gm.golem = true; gm.color = '#8a9a8a';
        gm.r = 18; gm.speed = Math.round((gm.speed || 80) * 0.6);
        gm.dmg = Math.round(gm.dmg * scale * 1.6);
        gm.maxHp = gm.hp = Math.round(gm.maxHp * scale * 4);
        gm.x = p.x; gm.y = p.y - 44;
        g.mercs.push(gm);
        Fx.text(gm.x, gm.y - 30, 'THE GOLEM RISES', '#9ae6a0', 13);
        Fx.burst(gm.x, gm.y, ['#9ae6a0', '#e6efe6', '#3a5a40'], 26, { speed: 170, life: 0.7, glow: true });
      }
      for (let i = 0; i < archers; i++) raise('bow', knights + i, total);
      const label = tier === 3 ? 'THE DEAD RISE - 3 KNIGHTS, 2 ARCHERS'
                  : tier === 2 ? 'TWO SKELETAL KNIGHTS RISE'
                               : 'A SKELETAL KNIGHT RISES';
      Fx.text(p.x, p.y - 32, label, a.color, tier === 3 ? 14 : 12);
      Fx.shake(tier === 3 ? 10 : 4, 0.3);

    } else if (a.kind === 'immolate') {
      // PYROMANCER: EVERYTHING MUST BURN. Every enemy in the room catches, and the fire
      // spreads - a burning enemy that dies sets its neighbours alight (see monsters.js
      // death hook via g.pyroSpread).
      const dur = a.dur || 6;   // already level-scaled above
      const dps = (a.dps || 60) * (p.stats.dmgMul || 1);
      let lit = 0;
      // #191 (player report) a GUEST pyro was lighting its local PROXIES - the host never
      // heard about it, so Immolate did zero real damage in co-op. Forward to the host,
      // whose monsters are the truth; the burn flag then flows back via snapshots.
      if (isCoopGuest()) {
        Net.sendR({ t: 'immolate', dps: Math.round(dps), dur, rd: a.qRider || 0 }); // #226 rider travels too
        lit = g.monsters.filter(m => !m.dead).length;
      } else {
        for (const m of g.monsters) {
          if (m.dead) continue;
          // #226 rider as %-of-maxHp PER SECOND, so the burn matters on floor 25
          m.burn = { t: dur, tick: 0, dps: dps + (a.qRider ? m.maxHp * a.qRider * (m.isBoss ? 1 / 3 : 1) : 0) };
          lit++;
        }
        g.pyroSpread = { t: dur + 4, dps, dur, rm: (_qGates && _qGates.rank >= 4) ? 1.6 : 1, boom: !!(_qGates && _qGates.rank >= 12) };
      }
      // #229 R8: while your inferno burns, Hell's own fire cannot touch you
      if (_qGates && _qGates.rank >= 8) { p.fireImmuneT = Math.max(p.fireImmuneT || 0, dur); Fx.text(p.x, p.y - 46, 'FIREPROOF', '#ffd24c', 11); }
      Fx.burst(p.x, p.y, ['#ff8a3d', '#ffd24c', '#ff3d1f'], 40, { speed: 240, life: 0.8, glow: true });
      Fx.text(p.x, p.y - 32, lit ? 'EVERYTHING MUST BURN' : 'NOTHING LEFT TO BURN', a.color, 15);
      Fx.shake(10, 0.35);
    }

    // #212 (co-op review P1-7, generalizing #191) GUEST ROOM-STATUS CASTS reach the
    // host in ONE generic event instead of a bespoke message per ability. The guest's
    // local proxy-mutations are harmless (snapshots overwrite them); the REAL effect
    // lands on the host's monsters via this. Damage-carrying kinds (freeze/midas)
    // exclude damage here - the guest's own proxy hits already forward per-monster.
    if (isCoopGuest() && typeof Net !== 'undefined' &&
        ['inferno', 'sleep', 'freeze', 'fear', 'midas', 'caltrops'].includes(a.kind)) {
      Net.sendR({ t: 'ultfx', k: a.kind, x: Math.round(p.x), y: Math.round(p.y),
                 radius: Math.round(a.radius || 0), dur: +(a.dur || 0), dps: Math.round(a.dps || 0) });
    }
    if (_qScaled) Object.assign(a, _qScaled); // #109 restore base Q values after the scaled cast
    if (_fScaled) Object.assign(a, _fScaled); // #252 restore base fusion values too

    // universal post-cast modifiers (folded on by the 2nd evolution)
    // #227 warrior R4 (and later paladin R4): the holy/steel shield holds 2 charges
    if (a.castShield) p.buffs.shield = Math.max(p.buffs.shield || 0, ((_qGates && (_qGates.cls === 'warrior' || _qGates.cls === 'paladin') && _qGates.rank >= 4) ? 2 : 1) + ((_qGates && _qGates.oh) ? 1 : 0)); // #230 overheal stacks a 3rd charge
    // #227 adventurer milestones: the everyman's rush earns real perks
    if (_qGates && _qGates.cls === '') {
      if (_qGates.rank >= 4) p.rollCd = 0;
      if (_qGates.rank >= 8) p.heal(p.maxHp * 0.05);
      if (_qGates.rank >= 12 && g.coop && typeof Net !== 'undefined') {
        for (const [id, rp] of g.remotePlayers) {
          if (rp.downed || !rp.room || !g.room || rp.room[0] !== g.room.gx || rp.room[1] !== g.room.gy) continue;
          if (Math.hypot(rp.x - p.x, rp.y - p.y) < 300) Net.sendR({ t: 'qbuff', to: id, k: 'adren', dur: 3 });
        }
      }
    }
    if (a.healOnCast) p.heal(p.maxHp * a.healOnCast);
    if (a.refundRoll) p.rollCd = 0; // #252 generic (SECOND WIND rides kind 'heal')
    if (a.rageAfter) p.buffs.rageT = Math.max(p.buffs.rageT, a.rageAfter);
    if (a.hasteAfter) p.buffs.hasteT = Math.max(p.buffs.hasteT, a.hasteAfter);
    Fx.text(p.x, p.y - 40, a.name.toUpperCase(), a.color, a.ult ? 17 : 14);
    if (a.ult) {
      // #10 (Sam) the whole dungeon should know: full-screen flash + banner + heavy
      // shake, and in co-op the rest of the party's screens flash too (visual only).
      triggerUltFlash(a.name, a.color);
      Fx.shake(16, 0.5);
      if (g.coop && typeof Net !== 'undefined' && Net.connected) Net.send({ t: 'ultcast', n: a.name, c: a.color });
    }
    // #134 ANTIKYTHERA GEAR: the two-thousand-year-old machine still turns, and your
    // powers turn with it. Applied here, at the ONE place a cooldown is armed.
    const haste = p.trinketFlag('abilityHaste') ? (p.trinket.abilityCd || 0) : 0;
    a.cd = a.cdMax * (1 - haste);
    if (a._halfCd) { a.cd *= 0.5; a._halfCd = false; } // #258 gambler R8
    // #228 rogue R4: the execute chained a kill - the blade is instantly ready again
    if (a._resetCd) { a.cd = 0; a._resetCd = false; }
    // #228 ranger R12: TWO tumbles in the tank. Resting a full cooldown restores both;
    // spending the first leaves the second ready almost immediately.
    if (_qGates && _qGates.cls === 'ranger' && _qGates.rank >= 12) {
      if (g.time - (a._lastQ === undefined ? -999 : a._lastQ) > a.cdMax) a._stock = 2;
      a._stock = (a._stock === undefined ? 2 : a._stock) - 1;
      a._lastQ = g.time;
      if (a._stock > 0) a.cd = 0.2;
    }
    // #78 the summon's cooldown does NOT run while the elemental lives - it starts the
    // moment the elemental dies (killSummon sets a.cd). Until then Q is gated, not on cd.
    if (a.kind === 'summon') a.cd = 0; // (the necromancer's 'raise' does NOT get this - it is on a real cooldown)
  }

  // --- SHARD SALVAGE (Sam's idea: floor loot shouldn't be waste) ------------------
  // X breaks a nearby dropped weapon/armor into shards; U spends shards to hone
  // your equipped weapon (+8% damage per hone, 5 hones max per weapon).
  const SHARD_VALUE = [1, 2, 4, 7, 12, 20]; // by rarity index (last = mythic)
  // #139 (Sam) honing used to HARD-cap at 5, which left shards with no sink at all
  // once your weapon was maxed - a deep player ends up with hundreds of shards and
  // leaves loot on the floor. Past 5 you can now OVERCHARGE: a smaller gain (+4% vs
  // +8%) for a steeper, ever-climbing shard cost, so surplus shards always have
  // somewhere to go and salvaging is never pointless again.
  const HONE_MAX = 5;
  // NOTE: ui.js drawHUD recomputes this same curve inline for the shard prompt - keep
  // the two in sync. Base hones 5/9/13/17/21; overcharge climbs 25/39/53/... forever.
  const honeCost = w => { const lv = w.upLvl || 0; return lv < HONE_MAX ? 5 + lv * 4 : 25 + (lv - HONE_MAX) * 14; };

  function salvageNearest() {
    // #261 (Sam) turrets salvage with X, exactly like gear. Own proximity check so a
    // standing turret never shadows a chest or a drop in the E-interact list.
    const p2 = g.player;
    for (let i = 0; i < g.turrets.length; i++) {
      const tu = g.turrets[i];
      if (Math.hypot(p2.x - tu.x, p2.y - tu.y) < 55) {
        g.turrets.splice(i, 1);
        p2.turretCharges = Math.min(p2.turretMax ? p2.turretMax() : 5, (p2.turretCharges | 0) + 1);
        if (p2.ability && p2.ability.classQ && p2.ability.kind === 'turret') p2.ability.cd = 0;
        Fx.text(tu.x, tu.y - 20, 'SALVAGED +1', '#c9a227', 13);
        Fx.burst(tu.x, tu.y, ['#c9a227', '#8a6a2a'], 14, { speed: 140, life: 0.5 });
        Sfx.play('ui');
        return;
      }
    }
    const t = nearestInteractable();
    if (!t || (t.kind !== 'weaponPickup' && t.kind !== 'armorPickup' && t.kind !== 'trinketPickup')) return;
    const item = t.pk.weapon || t.pk.armor || t.pk.trinket;
    // #201 (Sam) trinkets have no rarity index - X on one crashed the lookup and the
    // salvage silently did nothing. They scrap for shards off their gold price instead.
    const val = t.pk.trinket ? Math.max(2, Math.round((item.price || 30) / 10)) : (SHARD_VALUE[item.rarIdx] || 1);
    g.player.shards += val;
    consumeGear(t.pk); // #96 salvaging also despawns this drop for the whole party
    Sfx.play('kill');
    Fx.burst(t.pk.x, t.pk.y, ['#7fe8e0', item.color], 14, { speed: 150, life: 0.5, glow: true });
    Fx.text(t.pk.x, t.pk.y - 20, `+${val} SHARDS`, '#7fe8e0', 13);
  }

  function honeWeapon() {
    const p = g.player, w = p.weapon;
    if (!w) return;
    w.upLvl = w.upLvl || 0;
    const cost = honeCost(w);
    if (p.shards < cost) {
      g.shopMsg = { text: `Need ${cost} shards to hone (have ${p.shards})`, t: 1.6 };
      Sfx.play('error');
      return;
    }
    p.shards -= cost;
    w.upLvl++;
    const over = w.upLvl > HONE_MAX;          // #139 overcharge: smaller gain, no ceiling
    w.dmg = Math.round(w.dmg * (over ? 1.04 : 1.08));
    Sfx.play('upgrade');
    Fx.burst(p.x, p.y, ['#7fe8e0', w.color, '#fff'], 20, { speed: 170, life: 0.6, glow: true });
    const tag = over ? `OVERCHARGE ${w.upLvl - HONE_MAX}` : `+${w.upLvl}`;
    Fx.text(p.x, p.y - 30, `${w.name} · ${tag} · ${w.dmg} DMG`, over ? '#ff9a4c' : w.color, 13);
  }

  // #214 (co-op review P0-3) the mimic is HOST-OWNED like every monster. Any player
  // can spring it; the chest opens on every screen; only the host spawns the beast
  // (and if the host is elsewhere, the spawn is deferred to its room entry).
  function wakeMimic(ch, fromNet) {
    if (ch.opened) return;
    ch.opened = true; // remove the chest prop
    Sfx.play('mimic');
    Fx.shake(6, 0.3);
    Fx.burst(ch.x, ch.y, ['#7a5230', '#d4af37', '#c0392b'], 20, { speed: 190, life: 0.5 });
    Fx.text(ch.x, ch.y - 30, 'MIMIC!', '#ff5555', 18);
    if (!isCoopGuest()) {
      const tier = Monsters.tierFor(g.floorNum, g.room.dist);
      const m = Monsters.make('mimic', ch.x, ch.y, tier);
      m.netId = ++g.netMobId;
      g.monsters.push(m);
      g.room.cleared = false; // doors slam shut until it's dead
    }
    if (!fromNet && g.coop && typeof Net !== 'undefined' && g.room) {
      Net.sendR({ t: 'mimicwake', gx: g.room.gx, gy: g.room.gy, ci: (g.room.chests || []).indexOf(ch), fl: g.floorNum });
    }
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
    // #156 clones burn down and blow up: on expiry OR on death they detonate. Done first
    // so a clone that died to a hit this frame still pays out its blast.
    for (const merc of g.mercs) {
      // #230 the DK's plague-born skeletons crumble after their 30 seconds
      if (merc.dkTemp && !merc.dead && merc.life !== undefined) {
        merc.life -= dt;
        if (merc.life <= 0) { merc.dead = true; Fx.burst(merc.x, merc.y, ['#9fb8a0', '#4a5a4a'], 10, { speed: 90, life: 0.5 }); }
      }
      if (!merc.clone) continue;
      if (!merc.dead && merc.life !== undefined) {
        merc.life -= dt;
        if (merc.life <= 0) merc.dead = true;
      }
      if (merc.dead && !merc.blown) {
        merc.blown = true;
        const R = merc.blastR || 130, D = merc.blastDmg || 70;
        for (const m of g.monsters) {
          if (m.dead || m.airborne || m.spawnT > 0) continue;
          const d = Math.hypot(m.x - merc.x, m.y - merc.y);
          if (d > R + m.r) continue;
          // damage falls off with distance, like every other blast in the game
          // (#226: + the mesmer's percent rider so clone blasts matter at depth)
          const blast = D * (1 - 0.4 * (d / R)) + (merc.qRider ? m.maxHp * merc.qRider * (m.isBoss ? 1 / 3 : 1) : 0);
          m.takeHit(blast, { sx: merc.x, sy: merc.y, knock: 150, fromPlayer: true, hitSfx: 'hitHeavy' }, g);
        }
        Fx.burst(merc.x, merc.y, ['#c78bff', '#fff', '#e8c8ff'], 26, { speed: 230, life: 0.55, glow: true });
        Fx.shake(5, 0.2);
        Sfx.play('hitHeavy');
      }
    }
    g.mercs = g.mercs.filter(m => !(m.clone && m.dead && m.blown && (m.life === undefined || m.life <= -0.4)));

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

  // #78 Engineer turrets: stationary auto-cannons. Charges regrow with level + on a
  // per-charge recharge that STARTS when a turret dies; leaving a room refunds 80%.
  function killTurret(tr) {
    if (tr.dead) return;
    tr.dead = true;
    Fx.burst(tr.x, tr.y, ['#c9a227', '#888', '#fff'], 18, { speed: 150, life: 0.5 });
    Sfx.play('hitHeavy');
    g.player.turretRecharge.push(10); // a downed turret starts recharging a charge (~10s)
  }
  function updateTurrets(dt) {
    const p = g.player;
    const mx = p.turretMax ? p.turretMax() : 1;
    if (mx > (p.turretMaxSeen || 1)) { p.turretCharges += mx - (p.turretMaxSeen || 1); p.turretMaxSeen = mx; } // +1 charge per 5 levels
    if (p.turretCharges > mx) p.turretCharges = mx;
    if (p.turretRecharge) for (let i = p.turretRecharge.length - 1; i >= 0; i--) {
      p.turretRecharge[i] -= dt;
      if (p.turretRecharge[i] <= 0) { p.turretRecharge.splice(i, 1); if (p.turretCharges < mx) p.turretCharges++; }
    }
    // #228 R12 TESLA COIL: the OLDEST living turret is the landmark - its shots chain
    const tesla12 = p.class && p.class.id === 'engineer' && ((p.statPoints && p.statPoints.AGILITY) | 0) >= 12;
    let teslaSet = false;
    for (const tr of g.turrets) {
      if (tr.dead) { tr.tesla = false; continue; }
      tr.tesla = tesla12 && !teslaSet; if (tr.tesla) teslaSet = true;
      tr.t += dt;
      if (tr.atkCd > 0) tr.atkCd -= dt;
      if (tr.flash > 0) tr.flash -= dt;
      if (tr.hurtCd > 0) tr.hurtCd -= dt;
      if (tr.recoil > 0) tr.recoil -= dt;
      if (tr.hurtCd <= 0) for (const m of g.monsters) {
        if (m.dead || m.spawnT > 0 || m.airborne) continue;
        if (Math.hypot(m.x - tr.x, m.y - tr.y) < m.r + 12) { tr.hp -= m.dmg; tr.hurtCd = 0.5; tr.flash = 0.12; break; }
      }
      if (tr.hp <= 0) { killTurret(tr); continue; }
      let target = null, td = 1e9;
      for (const m of g.monsters) { if (m.dead || m.spawnT > 0 || m.airborne) continue; const d = Math.hypot(m.x - tr.x, m.y - tr.y); if (d < td) { td = d; target = m; } }
      if (target && td < tr.range) {
        tr.facing = Math.atan2(target.y - tr.y, target.x - tr.x);
        if (tr.atkCd <= 0) {
          const a = tr.facing;
          g.projectiles.push({ x: tr.x + Math.cos(a) * 12, y: tr.y - 6 + Math.sin(a) * 12, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, r: 4, dmg: tr.dmg, from: 'player',
            color: tr.tesla ? '#ffe27a' : '#ffd24c', life: 1.2, arrow: true, hitSet: new Set(), crit: false, qRider: tr.qRider || 0,
            chill: !!tr.qSlow, flame: tr.elem === 'fire', venom: tr.elem === 'poison', chain: tr.elem === 'lightning' || !!tr.tesla, knock: tr.elem === 'earth' ? 140 : 0 }); // #226/#228
          tr.atkCd = tr.atkRate; tr.recoil = 0.12; Sfx.play('bowfire');
        }
      }
    }
    for (let i = g.turrets.length - 1; i >= 0; i--) if (g.turrets[i].dead) g.turrets.splice(i, 1);
  }
  function drawTurret(c, tr) {
    c.save(); c.translate(tr.x, tr.y);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(0, 8, 12, 4, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#5a4a2a'; c.lineWidth = 2.5;                          // tripod legs
    for (const ang of [-2.4, -0.7, 1.6]) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(ang) * 11, 6 + Math.abs(Math.sin(ang)) * 4); c.stroke(); }
    c.save(); c.rotate(tr.facing); c.fillStyle = '#3a3f48';                // barrel toward target (recoils)
    c.fillRect(3 - (tr.recoil > 0 ? 3 : 0), -3, 13, 6); c.restore();
    c.fillStyle = tr.flash > 0 ? '#fff' : (tr.tesla ? '#b8962a' : '#8a7a4a'); c.beginPath(); c.arc(0, -3, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = tr.tesla ? '#ffe27a' : '#c9a227'; c.beginPath(); c.arc(0, -3, 4, 0, Math.PI * 2); c.fill();
    if (tr.tesla) { // #228 the coil crackles so the landmark reads at a glance
      c.strokeStyle = 'rgba(255,226,122,0.8)'; c.lineWidth = 1.5;
      const ph = (tr.t * 7) % (Math.PI * 2);
      c.beginPath(); c.moveTo(Math.cos(ph) * 8, -3 + Math.sin(ph) * 8); c.lineTo(Math.cos(ph + 2.3) * 11, -3 + Math.sin(ph + 2.3) * 11); c.stroke();
    }
    if (tr.hp < tr.maxHp) { const w = 20; c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(-w / 2, -18, w, 3); c.fillStyle = tr.hp / tr.maxHp > 0.4 ? '#5cd65c' : '#e05555'; c.fillRect(-w / 2, -18, w * Math.max(0, tr.hp / tr.maxHp), 3); }
    c.restore();
  }
  // #78 Summoner elementals: a single companion whose behaviour matches your weapon's
  // element (Fire/Lightning/Poison, else Earth). Persistent until killed; the Q cooldown
  // starts the moment it dies. Damage scales with the ARCANE stat at summon time.
  const ELEM_BASE = {
    earth:     { hp: 130, dmg: 15, speed: 92,  r: 13, range: 42,  rate: 0.7 },
    fire:      { hp: 55,  dmg: 15, speed: 122, r: 11, range: 270, rate: 0.85 },
    lightning: { hp: 70,  dmg: 11, speed: 104, r: 12, range: 250, rate: 1.7 },
    poison:    { hp: 90,  dmg: 8,  speed: 74,  r: 12, range: 44,  rate: 0.7 },
  };
  const ELEM_COLOR = { earth: '#a07a4a', fire: '#ff7a2c', lightning: '#ffe27a', poison: '#8ef06e' };
  function elementFromWeapon(p) {
    const w = p.weapons && p.weapons.a;
    if (w && typeof Weapons !== 'undefined') {
      if (Weapons.has(w, 'fireaspect') || Weapons.has(w, 'flame')) return 'fire';
      if (Weapons.has(w, 'chain')) return 'lightning';
      if (Weapons.has(w, 'venom')) return 'poison';
    }
    return 'earth'; // frost or no element defaults to Earth
  }
  function makeElemental(elem, x, y, scale) {
    const b = ELEM_BASE[elem] || ELEM_BASE.earth;
    const hp = Math.round(b.hp * scale);
    // #92 empowerCd: Q can re-empower the elemental only after it's been out a
    // beat (6s), then on an 8s cooldown. shieldT: earth's stone-shield window.
    return { elem, x, y, hp, maxHp: hp, dmg: Math.round(b.dmg * scale), speed: b.speed, r: b.r, range: b.range, atkRate: b.rate, atkCd: 0, facing: 0, flash: 0, hurtCd: 0, dead: false, t: 0, empowerCd: 6, empowerT: 0, shieldT: 0 };
  }

  // #92 Q re-empower: a distinct burst per element, then an 8s recharge. Damage
  // reuses the elemental's own dmg (which scaled with ARCANE at summon time).
  function empowerSummon(s, p) {
    s.empowerCd = 8;
    s.empowerT = 0.6;                    // brief empowered-flash for the sprite
    const col = ELEM_COLOR[s.elem];
    Fx.shake(5, 0.22); Sfx.play('roar');
    Fx.burst(s.x, s.y, [col, '#fff'], 26, { speed: 220, life: 0.6, glow: true });
    if (s.elem === 'earth') {
      // STONE SHIELD: the golem hunkers behind rock - immune for a window, and it
      // shares a shield charm with the summoner if they're close by
      s.shieldT = 6;
      Fx.text(s.x, s.y - s.r - 10, 'STONE SHIELD', '#a07a4a', 13);
      if (p && Math.hypot(p.x - s.x, p.y - s.y) < 160) { p.buffs.shield = Math.max(p.buffs.shield || 0, 1); Fx.text(p.x, p.y - 28, 'SHIELDED', '#7fd4ff', 12); }
    } else if (s.elem === 'fire') {
      // FIRE NOVA: an expanding ring of flame around the elemental
      const R = 150, dmg = Math.round(s.dmg * 2.2);
      Fx.burst(s.x, s.y, ['#ff7a2c', '#ffcc44', '#fff'], 34, { speed: 320, life: 0.55, glow: true });
      for (const m of g.monsters) { if (m.dead || m.airborne || m.spawnT > 0) continue; if (Math.hypot(m.x - s.x, m.y - s.y) < R + m.r) m.takeHit(dmg, { sx: s.x, sy: s.y, knock: 160, flame: 2, fromPlayer: true, hitSfx: 'hitHeavy' }, g); }
      Fx.text(s.x, s.y - s.r - 10, 'FIRE NOVA', '#ff7a2c', 13);
      Sfx.play('explode');
    } else if (s.elem === 'lightning') {
      // CHAIN STORM: a bolt lashes each of the nearest enemies
      const dmg = Math.round(s.dmg * 1.8);
      const near = g.monsters.filter(m => !m.dead && !m.airborne && m.spawnT <= 0 && Math.hypot(m.x - s.x, m.y - s.y) < 320)
        .sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y)).slice(0, 6);
      for (const m of near) {
        m.takeHit(dmg, { sx: s.x, sy: s.y, chain: 1, fromPlayer: true, hitSfx: 'crit' }, g);
        Fx.burst(m.x, m.y, ['#ffe27a', '#fff'], 12, { speed: 180, life: 0.35, glow: true });
      }
      Fx.text(s.x, s.y - s.r - 10, 'CHAIN STORM', '#ffe27a', 13);
      Sfx.play('crit');
    } else { // poison
      // TOXIC CLOUD: a lingering poison field (reuses the player poison ultFx)
      g.ultFx.push({ type: 'poison', x: s.x, y: s.y, t: 0, dur: 5, tick: 0, dps: Math.round(s.dmg * 1.4), color: '#8ef06e' });
      Fx.text(s.x, s.y - s.r - 10, 'TOXIC CLOUD', '#8ef06e', 13);
      Sfx.play('burn');
    }
  }
  function killSummon(s) {
    if (s.dead) return;
    s.dead = true;
    Fx.burst(s.x, s.y, [ELEM_COLOR[s.elem], '#fff'], 20, { speed: 160, life: 0.5, glow: true });
    Sfx.play('hitHeavy');
    // #229 R12: the elemental EXPLODES in its element as it dies
    if (s.explode) {
      Fx.burst(s.x, s.y, [ELEM_COLOR[s.elem], '#fff'], 34, { speed: 280, life: 0.6, glow: true });
      Fx.shake(5, 0.2); Sfx.play('explode');
      for (const m of g.monsters) {
        if (m.dead || m.airborne || m.spawnT > 0) continue;
        if (Math.hypot(m.x - s.x, m.y - s.y) > 130 + m.r) continue;
        m.takeHit(s.dmg * 4, { sx: s.x, sy: s.y, knock: 180, fromPlayer: true, hitSfx: 'hitHeavy',
          flame: s.elem === 'fire' ? 2 : 0, venom: s.elem === 'poison' ? 2 : 0, chain: s.elem === 'lightning' ? 1 : 0, chill: s.elem === 'earth' }, g);
      }
    }
    const a = g.player.ability;
    // #229 with two slots, the resummon cooldown starts when the LAST one falls
    const anyAlive = (g.summon && !g.summon.dead) || (g.summon2 && !g.summon2.dead);
    if (a && a.kind === 'summon' && !anyAlive) a.cd = a.cdMax;
  }
  function summonMove(s, tx, ty, dt, mul) {
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1;
    s.x += (dx / d) * s.speed * (mul || 1) * dt; s.y += (dy / d) * s.speed * (mul || 1) * dt;
  }
  function summonBolt(s, ang, color, opts) {
    g.projectiles.push(Object.assign({ x: s.x + Math.cos(ang) * 12, y: s.y + Math.sin(ang) * 12, vx: Math.cos(ang) * 520, vy: Math.sin(ang) * 520, r: 4, dmg: s.dmg, from: 'player', color, life: 1.2, arrow: true, hitSet: new Set(), crit: false }, opts || {}));
  }
  function updateSummons(dt) {
    updateOneSummon(g.summon, dt);
    updateOneSummon(g.summon2, dt); // #229 the second elemental
  }
  function updateOneSummon(s, dt) {
    if (!s || s.dead) return;
    const p = g.player;
    s.t += dt;
    if (s.atkCd > 0) s.atkCd -= dt;
    if (s.flash > 0) s.flash -= dt;
    if (s.hurtCd > 0) s.hurtCd -= dt;
    if (s.empowerCd > 0) s.empowerCd -= dt; // #92 Q re-empower recharge
    if (s.empowerT > 0) s.empowerT -= dt;
    if (s.shieldT > 0) s.shieldT -= dt;     // earth stone-shield: immune while up
    // #92 the stone shield eats contact damage entirely
    if (s.shieldT <= 0 && s.hurtCd <= 0) for (const m of g.monsters) { if (m.dead || m.spawnT > 0 || m.airborne) continue; if (Math.hypot(m.x - s.x, m.y - s.y) < m.r + s.r) { s.hp -= m.dmg; s.hurtCd = 0.5; s.flash = 0.12; break; } }
    if (s.hp <= 0) { killSummon(s); return; }
    let target = null, td = 1e9;
    for (const m of g.monsters) { if (m.dead || m.spawnT > 0 || m.airborne) continue; const d = Math.hypot(m.x - s.x, m.y - s.y); if (d < td) { td = d; target = m; } }
    const hasT = target && td < 360;
    const home = () => summonMove(s, p.x + (s.hdx || -26), p.y + 18, dt, 0.9);
    // #229 R4 AURA: the element radiates from the elemental's body (ticked ~2x/s)
    if (s.aura && Math.floor(s.t / 0.5) !== Math.floor((s.t - dt) / 0.5)) {
      for (const m of g.monsters) {
        if (m.dead || m.spawnT > 0 || Math.hypot(m.x - s.x, m.y - s.y) > 80 + m.r) continue;
        if (s.elem === 'fire') m.burn = m.burn || { t: 1.2, tick: 0, dps: Math.round(s.dmg * 0.6) };
        else if (s.elem === 'earth') { m.chillT = Math.max(m.chillT || 0, 0.6); m.chillMul = 0.55; }
        else if (s.elem === 'poison') m.poison = m.poison || { t: 1.5, dps: Math.round(s.dmg * 0.6), tick: 0 };
        else if (s.elem === 'lightning') m.takeHit(Math.max(1, Math.round(s.dmg * 0.25)), { sx: s.x, sy: s.y, fromPlayer: true, hitSfx: 'hitLight' }, g);
      }
      Fx.burst(s.x, s.y, [ELEM_COLOR[s.elem]], 3, { speed: 60, life: 0.5, glow: true });
    }
    if (s.elem === 'earth') {
      if (hasT) { s.facing = Math.atan2(target.y - s.y, target.x - s.x); if (td > s.range) summonMove(s, target.x, target.y, dt); else if (s.atkCd <= 0) { target.takeHit(s.dmg, { sx: s.x, sy: s.y, knock: 120, fromPlayer: true, hitSfx: 'hitHeavy' }, g); s.atkCd = s.atkRate; } }
      else if (Math.hypot(p.x - s.x, p.y - s.y) > 40) home();
    } else if (s.elem === 'fire') {
      if (hasT) { s.facing = Math.atan2(target.y - s.y, target.x - s.x); if (td < 150) summonMove(s, s.x * 2 - target.x, s.y * 2 - target.y, dt, 0.8); else if (td > s.range) summonMove(s, target.x, target.y, dt); if (s.atkCd <= 0) { summonBolt(s, s.facing, '#ff7a2c', { flame: 2 }); s.atkCd = s.atkRate; Sfx.play('bowfire'); } }
      else home();
    } else if (s.elem === 'lightning') {
      if (hasT && td > 130) summonMove(s, target.x, target.y, dt, 0.7);
      else if (!hasT) home();
      if (hasT && s.atkCd <= 0) { for (let i = 0; i < 8; i++) summonBolt(s, i / 8 * Math.PI * 2, '#ffe27a', { chain: 1 }); s.atkCd = s.atkRate; Sfx.play('bowfire'); }
    } else { // poison
      if (hasT) { s.facing = Math.atan2(target.y - s.y, target.x - s.x); summonMove(s, target.x, target.y, dt); if (td < s.range && s.atkCd <= 0) { target.takeHit(s.dmg, { sx: s.x, sy: s.y, venom: 2, fromPlayer: true }, g); s.atkCd = s.atkRate; } }
      else home();
      if (Math.floor(s.t / 0.25) !== Math.floor((s.t - dt) / 0.25)) { // ~4x/s trail
        Fx.burst(s.x, s.y, ['#8ef06e', '#3aa83a'], 2, { speed: 20, life: 0.6 });
        for (const m of g.monsters) { if (!m.dead && Math.hypot(m.x - s.x, m.y - s.y) < 34) m.poison = { t: 2, dps: s.dmg, tick: 0 }; }
      }
    }
    s.x = Math.max(PF.x + 10, Math.min(PF.x + PF.w - 10, s.x));
    s.y = Math.max(PF.y + 10, Math.min(PF.y + PF.h - 10, s.y));
  }
  function drawSummon(c) {
    drawOneSummon(c, g.summon);
    drawOneSummon(c, g.summon2); // #229
  }
  function drawOneSummon(c, s) {
    if (!s || s.dead) return;
    const col = ELEM_COLOR[s.elem];
    c.save(); c.translate(s.x, s.y);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(0, s.r * 0.8, s.r * 0.9, s.r * 0.35, 0, 0, Math.PI * 2); c.fill();
    // #92 empower burst flash (a quick bright halo right after Q re-empowers)
    if (s.empowerT > 0) { c.save(); c.globalAlpha = Math.min(1, s.empowerT * 1.6); c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, s.r + 6 + (0.6 - s.empowerT) * 40, 0, Math.PI * 2); c.stroke(); c.restore(); }
    c.fillStyle = (s.flash > 0 || s.empowerT > 0) ? '#fff' : col;
    if (s.elem === 'earth') {
      // #91 a proper little EARTH ELEMENTAL: a hunched golem of stacked boulders
      // with mossy tops, cracked plating, stubby rock arms and glowing gem eyes.
      const flash = s.flash > 0;
      const rock = flash ? '#fff' : '#7a5a38';
      const rockLo = flash ? '#eee' : '#5b4128';
      const rockHi = flash ? '#fff' : '#8f6b45';
      c.save();
      const bob = Math.sin(s.t * 3) * 1.2;
      c.translate(0, bob);
      // stubby boulder arms
      c.fillStyle = rockLo;
      c.beginPath(); c.arc(-s.r * 1.05, s.r * 0.2, s.r * 0.42, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(s.r * 1.05, s.r * 0.2, s.r * 0.42, 0, Math.PI * 2); c.fill();
      // main body: a chunky lumpy boulder (overlapping rounded rects)
      c.fillStyle = rock;
      c.beginPath();
      c.moveTo(-s.r, s.r * 0.7);
      c.lineTo(-s.r * 1.05, -s.r * 0.15);
      c.lineTo(-s.r * 0.5, -s.r * 0.85);
      c.lineTo(s.r * 0.5, -s.r * 0.9);
      c.lineTo(s.r * 1.05, -s.r * 0.1);
      c.lineTo(s.r, s.r * 0.75);
      c.closePath(); c.fill();
      // lighter top-left facet (top-down light)
      c.fillStyle = rockHi;
      c.beginPath();
      c.moveTo(-s.r * 0.5, -s.r * 0.85); c.lineTo(s.r * 0.2, -s.r * 0.9);
      c.lineTo(s.r * 0.1, -s.r * 0.25); c.lineTo(-s.r * 0.55, -s.r * 0.2);
      c.closePath(); c.fill();
      // moss patches on the crown
      c.fillStyle = flash ? '#dfe' : '#4e7034';
      c.beginPath(); c.ellipse(-s.r * 0.2, -s.r * 0.78, s.r * 0.34, s.r * 0.18, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(s.r * 0.45, -s.r * 0.7, s.r * 0.2, s.r * 0.12, 0, 0, Math.PI * 2); c.fill();
      // crack lines across the plating
      c.strokeStyle = rockLo; c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-s.r * 0.4, -s.r * 0.3); c.lineTo(-s.r * 0.1, s.r * 0.1); c.lineTo(-s.r * 0.35, s.r * 0.5);
      c.moveTo(s.r * 0.5, -s.r * 0.1); c.lineTo(s.r * 0.2, s.r * 0.25);
      c.stroke();
      // glowing gem eyes set into the rock
      const eg = 0.6 + Math.sin(Date.now() / 240) * 0.35;
      c.fillStyle = `rgba(150,220,120,${eg})`;
      c.beginPath(); c.arc(-s.r * 0.32, -s.r * 0.15, s.r * 0.16, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(s.r * 0.32, -s.r * 0.15, s.r * 0.16, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#eaffd8';
      c.beginPath(); c.arc(-s.r * 0.3, -s.r * 0.18, s.r * 0.06, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(s.r * 0.34, -s.r * 0.18, s.r * 0.06, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    else { c.beginPath(); c.arc(0, 0, s.r, 0, Math.PI * 2); c.fill(); }
    c.save(); c.globalAlpha = 0.6 + Math.sin(Date.now() / 120) * 0.3;
    if (s.elem === 'fire') { c.fillStyle = '#ffd24c'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(Math.sin(Date.now() / 80 + i) * s.r * 0.4, -s.r - 2 - i * 2, 2, 0, Math.PI * 2); c.fill(); } }
    else if (s.elem === 'lightning') { c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-s.r, 0); c.lineTo(-2, -3); c.lineTo(2, 3); c.lineTo(s.r, 0); c.stroke(); }
    else if (s.elem === 'poison') { c.fillStyle = '#cfffb0'; c.beginPath(); c.arc(0, 0, s.r * 0.5, 0, Math.PI * 2); c.fill(); }
    c.restore();
    if (s.hp < s.maxHp) { const w = 22; c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(-w / 2, -s.r - 8, w, 3); c.fillStyle = s.hp / s.maxHp > 0.4 ? '#5cd65c' : '#e05555'; c.fillRect(-w / 2, -s.r - 8, w * Math.max(0, s.hp / s.maxHp), 3); }
    // #92 stone-shield: a rotating ring of rock shards while the shield is up
    if (s.shieldT > 0) {
      c.save();
      c.globalAlpha = 0.5 + Math.sin(Date.now() / 120) * 0.2;
      c.rotate(s.t * 1.5);
      c.fillStyle = '#8f6b45'; c.strokeStyle = '#5b4128'; c.lineWidth = 1;
      const rr = s.r + 8;
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        c.save(); c.translate(Math.cos(a) * rr, Math.sin(a) * rr); c.rotate(a);
        c.beginPath(); c.moveTo(-3, -3); c.lineTo(3, -4); c.lineTo(4, 3); c.lineTo(-3, 4); c.closePath();
        c.fill(); c.stroke(); c.restore();
      }
      c.restore();
    }
    c.restore();
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
    // #163 (Sam) the title song plays on the menu and stops the moment a run begins.
    if (typeof Sfx !== 'undefined' && Sfx.startMenuMusic) {
      if (g.state === 'title') { if (!g._menuMusic) { Sfx.startMenuMusic(); g._menuMusic = true; } }
      else if (g._menuMusic) { Sfx.stopMenuMusic(); g._menuMusic = false; }
    }
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
    // MOBILE: fold the thumbstick + auto-aim into `input` BEFORE anything reads it,
    // so the rest of the game cannot tell a thumb from a keyboard. No-op on desktop.
    if (typeof Mobile !== 'undefined') Mobile.update(g);

    // global keys
    if (input.pressed('KeyM')) Sfx.toggleMute();

    // #100 safety: never let the chat text-capture leak out of play (e.g. you died
    // mid-sentence). If we're not in play but the box is still open, force it shut so
    // menu/initials typing works normally again.
    if (g.chat.open && g.state !== 'play') closeChat();

    // #86 accolade toasts fade regardless of game state
    if (g.achToasts && g.achToasts.length) {
      for (const t of g.achToasts) t.t -= dt;
      g.achToasts = g.achToasts.filter(t => t.t > 0);
    }
    // #123 advance the mythic-drop fanfare regardless of state/hit-stop
    if (g.mythicFx) { g.mythicFx.t += dt; if (g.mythicFx.t >= g.mythicFx.dur) g.mythicFx = null; }

    // #192 kept presence alive while frozen; #249 (Sam) goes all the way: NOTHING
    // pauses in multiplayer. While any menu or pick screen is up in co-op, the whole
    // world sim runs underneath with this player's controls idled (the model chat and
    // the co-op pause overlay already use, applied to every menu). The state swap
    // matters twice: it lets updatePlay past its own not-in-play early-outs, and it
    // means damage resolves normally - a menu is NOT armor, the monsters don't wait.
    // If the sim flips the state itself (death, a descent), that outranks the menu.
    if (g.coop && (g.state === 'levelup' || g.state === 'evolution' || g.state === 'ultpick' ||
        g.state === 'rpick' || g.state === 'pause' || g.state === 'charsheet' || g.state === 'enchantpick' || g.state === 'offer' || g.state === 'craftpick')) {
      const menuState = g.state;
      const sPressed = input.pressed, sKey = input.key, sClicked = input.mouse.clicked;
      input.pressed = () => false; input.key = () => false; input.mouse.clicked = false;
      g.state = 'play';
      try { updatePlay(dt); } finally {
        input.pressed = sPressed; input.key = sKey; input.mouse.clicked = sClicked;
        if (g.state === 'play') g.state = menuState;
      }
    }
    switch (g.state) {
      case 'title': updateTitle(); break;
      case 'lobby': updateLobby(); break;
      case 'play': updatePlay(dt); break;
      // (co-op presence in frozen states is handled just above the switch - #192)
      // #85 press C during any pick to peek the character sheet, then return to the pick
      case 'levelup': g.overlayT += dt; if (peekCharSheet()) break; updateLevelUp(dt); break;
      case 'evolution': g.overlayT += dt; if (peekCharSheet()) break; updateEvolution(); break;
      case 'ultpick': g.overlayT += dt; if (peekCharSheet()) break; updateUltPick(); break;
      case 'rpick': g.overlayT += dt; if (peekCharSheet()) break; updateRPick(); break;
      case 'enchantpick': g.overlayT += dt; updateEnchantPick(); break;
      case 'craftpick': g.overlayT += dt; updateCraftPick(); break; // #206
      case 'offer': g.overlayT += dt; updateOffer(); break;
      case 'levelwait': g.overlayT += dt; updateLevelWait(dt); break;
      case 'pause':
        g.overlayT += dt;
        if (input.pressed('KeyP') || input.pressed('Escape')) g.state = 'play';
        else if (input.mouse.clicked) {
          for (const r of g.uiRects) {
            if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
              if (r.action === 'menu') quitToTitle();
              else if (r.action === 'retire') retireRun();
              else if (r.action === 'fullscreen') toggleFullscreen();
            }
          }
        }
        break;
      case 'charsheet':
        g.overlayT += dt;
        // THE PORTRAIT: HOVER a ring to drill into it. Hovering rather than clicking is
        // the point - the drill-down is a glance, not a mode you have to click out of.
        // Moving the mouse off the rings returns you to the quiet default view.
        if (g.uiRects && input.mouse.moved) {
          let over = null;
          for (const r of g.uiRects) {
            if (r.stat && input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) { over = r.stat; break; }
          }
          if (over !== g.charDetail) { g.charDetail = over; if (over) Sfx.play('ui'); }
        }
        // 1-5 pick a ring by number (and it STICKS, so you can read it without holding
        // the mouse still); 0 goes back to the portrait. While the LEVEL UP popup is
        // open (#231), the digits belong to the CARDS instead.
        if (!(g.spendOpen && g.pendingChoices)) {
          for (let i = 0; i < 5; i++) {
            if (input.pressed('Digit' + (i + 1))) { g.charDetail = Evolutions.STATS[i]; Sfx.play('ui'); }
          }
          if (input.pressed('Digit0')) { g.charDetail = null; Sfx.play('ui'); }
        }
        // #199/#231/#234 (Sam: "look at my stats without having to choose right away")
        // banked points do NOT auto-open the popup - a LEVEL UP button on the sheet
        // (or V - #246, L made the left hand travel; V sits next to C) opens it; V or
        // Esc closes it back to browsing. Closing KEEPS the rolled cards, so
        // open-close-open is never a free reroll.
        // V is a TOGGLE, resolved in one branch - split open/close checks fired in
        // the same frame (open at the top, the close-check below saw it open, closed it)
        if (input.pressed('KeyV')) {
          if (g.spendOpen && g.pendingChoices) { g.spendOpen = false; Sfx.play('ui'); break; }
          if (g.levelUpQueue > 0) { g.spendOpen = true; Sfx.play('ui'); }
        }
        if (g.levelUpQueue > 0 && !g.spendOpen) {
          if (input.mouse.clicked && g.uiRects) {
            for (const r of g.uiRects) {
              if (r.action === 'openSpend' && input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) { g.spendOpen = true; Sfx.play('ui'); break; }
            }
          }
        }
        if (g.levelUpQueue > 0 && g.spendOpen && !g.pendingChoices) g.pendingChoices = pickUpgrades();
        if (g.levelUpQueue <= 0) { g.pendingChoices = null; g.spendOpen = false; }
        if (g.spendOpen && g.pendingChoices && input.pressed('Escape')) { g.spendOpen = false; Sfx.play('ui'); break; } // close the popup, keep browsing
        if (g.spendOpen && g.pendingChoices) {
          const spend = (idx) => {
            const ch = g.pendingChoices[idx];
            if (!ch) return;
            applyUpgrade(ch);          // note: applyUpgrade ends in state 'play'...
            g.state = 'charsheet';     // ...but we stay on the sheet to keep spending
            g.levelUpQueue--;
            g.pendingChoices = g.levelUpQueue > 0 ? pickUpgrades() : null;
            Sfx.play('upgrade');
          };
          // #233 (Sam) the paid REROLL from the old level-up screen lives here now:
          // same economics - 10 gold, +1 gold per reroll this run. R or the button.
          if (g.rerollDenyT > 0) g.rerollDenyT -= dt;
          const reroll = () => {
            const cost = rerollCost();
            if (!g.player || g.player.coins < cost) { Sfx.play('error'); g.rerollDenyT = 0.6; return; }
            g.player.coins -= cost;
            g.rerollCount = (g.rerollCount || 0) + 1;
            g.pendingChoices = pickUpgrades();
            Sfx.play('ui');
          };
          if (input.pressed('KeyR')) reroll();
          // #248 (Sam) WASD walks the cards again, Enter/Space/E takes the glowing one
          const nCh = g.pendingChoices.length;
          g.spendSel = Math.min(g.spendSel || 0, nCh - 1);
          if (input.pressed('KeyA') || input.pressed('KeyW') || input.pressed('ArrowLeft') || input.pressed('ArrowUp')) { g.spendSel = (g.spendSel + nCh - 1) % nCh; Sfx.play('ui'); }
          if (input.pressed('KeyD') || input.pressed('KeyS') || input.pressed('ArrowRight') || input.pressed('ArrowDown')) { g.spendSel = (g.spendSel + 1) % nCh; Sfx.play('ui'); }
          if (input.pressed('Enter') || input.pressed('Space') || input.pressed('KeyE')) { spend(g.spendSel); }
          for (let i = 0; i < 3; i++) if (input.pressed('Digit' + (i + 1))) { spend(i); break; }
          if (g.pendingChoices && input.mouse.clicked && g.uiRects) {
            for (const r of g.uiRects) {
              if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
                if (r.action === 'spendCard') { spend(r.idx); break; }
                if (r.action === 'rerollCards') { reroll(); break; }
              }
            }
          }
        }
        // #85 close: return to whatever we peeked FROM (a level-up/evolution/ultimate
        // pick), else back to play
        if (input.pressed('KeyC') || input.pressed('Escape') || input.pressed('KeyP')) { g.state = g.charReturn || 'play'; g.charReturn = null; g.charDetail = null; }
        break;
      case 'transition': updateTransition(dt); break;
      case 'bossintro': updateBossIntro(dt); break;
      case 'dead': case 'win': g.overlayT += dt; updateEnd(); break;
      case 'initials': g.overlayT += dt; updateInitials(); break;
    }
    Fx.update(dt);
  }

  function updateTitle() {
    // #265 presence heartbeat: once on arrival, then every 60s while on the title
    if (!g._presT || g.time - g._presT > 60) { g._presT = g.time || 0.001; pingPresence(); }
    if (g.shareMsg && g.shareMsg.t > 0) g.shareMsg.t -= 1 / 60;
    if (g.prestigeConfirm > 0) g.prestigeConfirm -= 1 / 60; // an armed prestige-reset confirm expires
    // #149 (Sam) a death-snapshot can be opened from the scoreboard OR the Top Raiders
    // panel. Close it here so it works from either: click/Esc returns to whatever is
    // underneath (the full board, or the title itself).
    if (g.snapView) {
      if (g.snapCopiedT > 0) g.snapCopiedT -= 1 / 60;
      // #208 the SHARE button eats its click before the close-on-any-click rule
      if (input.mouse.clicked && g.snapShareRect) {
        const r = g.snapShareRect;
        if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
          const text = (typeof Eulogy !== 'undefined' && Eulogy.shareText) ? Eulogy.shareText(g.snapView, UI.GAME_URL) : '';
          if (text && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => { g.snapCopiedT = 1.8; }).catch(() => { g.snapCopiedT = 0; });
          }
          Sfx.play('ui');
          return;
        }
      }
      if (input.mouse.clicked || input.pressed('Escape')) { g.snapView = null; g.snapShareRect = null; Sfx.play('ui'); }
      return;
    }
    if (g.showPatch) {
      // #76 arrow / page keys scroll the changelog (mouse wheel handled in the wheel listener)
      if (input.pressed('ArrowDown')) g.patchScroll = (g.patchScroll || 0) + 40;
      if (input.pressed('ArrowUp'))   g.patchScroll = Math.max(0, (g.patchScroll || 0) - 40);
      if (input.pressed('PageDown'))  g.patchScroll = (g.patchScroll || 0) + 240;
      if (input.pressed('PageUp'))    g.patchScroll = Math.max(0, (g.patchScroll || 0) - 240);
      // patch-notes overlay: any click or Esc closes it (and marks this version seen)
      if (input.mouse.clicked || input.pressed('Escape')) { g.showPatch = false; markVersionSeen(); }
      return;
    }
    if (g.showScores) {
      // #102 death-snapshot popup (opened from a row) is handled by the top-level
      // g.snapView guard in this function, above.
      if (input.pressed('Escape')) { g.showScores = false; return; }
      if (input.mouse.clicked) {
        // click an underlined name -> open that fallen hero's snapshot
        for (const r of (g.scoreRects || [])) {
          if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
            const img = new Image(); img.src = r.snap.avatar;
            // #178 (Sam) global slim snaps carry no floor - the ENTRY does. Merge it, plus
            // the board rank so each top raider's eulogy verse is salted differently.
            g.snapView = Object.assign({ initials: r.initials, _img: img }, r.snap,
              { floor: (r.snap.floor != null ? r.snap.floor : r.floor), rank: r.rank, score: r.score }); // #208 score rides along for the share text
            Sfx.play('ui');
            return;
          }
        }
        g.showScores = false; // click elsewhere closes the board
      }
      return;
    }
    if (g.showMythics) {
      // #38 mythic gallery: any click or Esc closes it
      if (input.mouse.clicked || input.pressed('Escape')) g.showMythics = false;
      return;
    }
    if (g.showAchievements) {
      // #86 accolades gallery: arrows/wheel scroll, click or Esc closes
      if (input.pressed('ArrowDown')) g.achScroll = (g.achScroll || 0) + 52;
      if (input.pressed('ArrowUp'))   g.achScroll = Math.max(0, (g.achScroll || 0) - 52);
      if (input.pressed('PageDown'))  g.achScroll = (g.achScroll || 0) + 260;
      if (input.pressed('PageUp'))    g.achScroll = Math.max(0, (g.achScroll || 0) - 260);
      if (input.pressed('Escape')) { g.showAchievements = false; return; }
      // a click on the gallery body closes it (but ignore the click that opened it this frame)
      if (input.mouse.clicked && g.overlayT > 0.2) g.showAchievements = false;
      g.overlayT += 1 / 60;
      return;
    }
    if (g.showUpgrades) {
      // permanent-boosts popup: clicking a boost/prestige row BUYS it (popup stays open
      // so you can keep spending); a click on empty space or Esc closes it.
      if (input.pressed('Escape')) { g.showUpgrades = false; return; }
      if (input.mouse.clicked && g.overlayT > 0.2) {
        for (const r of (g.upgradeRects || [])) {
          if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
            if (r.action === 'upgrade') buyMetaUpgrade(r.key);
            else if (r.action === 'prestige') doPrestige();
            return; // stay open after a purchase
          }
        }
        g.showUpgrades = false; // clicked away from any row -> close
      }
      g.overlayT += 1 / 60;
      return;
    }
    // pet tooltip: which companion chip is the mouse hovering (previewed in the loadout
    // panel by ui.js). Uses last frame's uiRects, imperceptible one-frame lag.
    g.hoverPet = null;
    for (const r of (g.uiRects || [])) {
      if (r.action === 'selectPet' && input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) { g.hoverPet = r.key; break; }
    }
    if (input.pressed('Enter')) { newRun(); return; }
    // #203 N (or clicking your name in the loadout panel): change the name your
    // high scores are listed under
    const openRename = () => {
      g.renameOnly = true;
      g.initials = { name: (g.playerName || ''), max: 10 };
      g.state = 'initials'; g.overlayT = 0;
      Sfx.play('ui');
    };
    if (input.pressed('KeyN')) { openRename(); return; }
    if (input.mouse.clicked) {
      for (const r of g.uiRects) {
        if (input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) {
          if (r.action === 'start') { newRun(); return; }
          if (r.action === 'coop') { openLobby(); return; }
          if (r.action === 'fullscreen') { toggleFullscreen(); return; }
          if (r.action === 'rename') { openRename(); return; }
          if (r.action === 'upgrade') buyMetaUpgrade(r.key);
          if (r.action === 'share') shareGame();
          if (r.action === 'scores') { g.showScores = true; Sfx.play('ui'); }
          if (r.action === 'raiderSnap') { // #149 open a top-5 raider's loadout snapshot from the main page
            const img = new Image(); img.src = r.snap.avatar || '';
            g.snapView = Object.assign({ initials: r.initials, _img: img }, r.snap,
              { floor: (r.snap.floor != null ? r.snap.floor : r.floor), rank: r.rank, score: r.score }); // #208 score rides along for the share text // #178
            Sfx.play('ui'); return;
          }
          if (r.action === 'patchnotes') { g.showPatch = true; g.patchScroll = 0; Sfx.play('ui'); }
          if (r.action === 'mythics') { g.showMythics = true; Sfx.play('ui'); }
          if (r.action === 'achievements') { g.showAchievements = true; g.achScroll = 0; g.overlayT = 0; Sfx.play('ui'); }
          if (r.action === 'upgrades') { g.showUpgrades = true; g.overlayT = 0; Sfx.play('ui'); }
          if (r.action === 'selectPet') { // toggle the stable pet chosen for the next run
            g.meta.selectedPet = g.meta.selectedPet === r.key ? '' : r.key;
            saveMeta(); Sfx.play('ui');
          }
          if (r.action === 'selectRace') {   // #156 pick the blood for the next run
            g.meta.selectedRace = r.key;
            saveMeta(); Sfx.play('ui');
            break;
          }
          if (r.action === 'classScroll') {  // #156 the strip's < > arrows
            if (typeof UI !== 'undefined' && UI.scrollClasses) UI.scrollClasses(r.key);
            Sfx.play('ui');
            break;
          }
          if (r.action === 'selectClass') { // #30 pick the class for the next run
            g.meta.selectedClass = r.key;
            saveMeta(); Sfx.play('ui');
          }
          if (r.action === 'prestige') doPrestige(); // #43 reset account for a prestige level
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

  // #43 PRESTIGE: sacrifice your whole essence account (essence + every upgrade rank)
  // to climb one prestige level. The ONLY reward is cosmetic - a grander cape. The
  // gate climbs each time so a new prestige always costs more than the last.
  function prestigeCost() { return 500 * ((g.meta.prestige || 0) + 1); }
  function doPrestige() {
    const cost = prestigeCost();
    if (g.meta.essence < cost) { Sfx.play('error'); g.prestigeConfirm = 0; return; }
    // first click arms a confirm (this wipes your account); second click commits
    if (!g.prestigeConfirm) { g.prestigeConfirm = 4; Sfx.play('ui'); return; }
    // wipe EVERYTHING except the prestige level (Sam): essence, all upgrade ranks,
    // the mythic collection, befriended pets, and the chosen pet/class all reset.
    const keptPrestige = (g.meta.prestige || 0) + 1;
    g.meta.essence = 0;
    g.meta.ranks = {};
    g.meta.mythics = [];
    g.meta.petsUnlocked = [];
    g.meta.selectedPet = '';
    g.meta.selectedClass = '';
    g.meta.prestige = keptPrestige;
    g.prestigeConfirm = 0;
    saveMeta();
    Sfx.play('levelup');
    g.shareMsg = { text: `PRESTIGE ${g.meta.prestige} - your cape grows grander`, t: 3.5 };
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
      rp.facing = m.f; rp.room = m.r; rp.floor = m.fl; rp.hp = m.hp; rp.maxHp = m.mh; rp.wc = m.wc; rp.name = (m.nm && m.nm.trim()) || m.from;
      rp.downed = !!m.dd; // P1-C: render peers as downed + gate revive/wipe
      rp.wa = m.wa || 'light'; rp.pr = m.pr || 0; rp.mv = !!m.mv; // weapon archetype, prestige, moving
      rp.wm = m.wm || null;                                       // weapon MODEL slug (per-name look)
      rp.cw = Array.isArray(m.cw) ? m.cw : null;                  // #117 cape wind vector
      rp.cl = m.cl || ''; rp.u = m.u || null;                     // #98 class id, #99 stable uid
      rp.form = m.fm || '';                                       // #162 druid form id
      rp.mn = m.mn || null;                                       // #174 their minions
      rp.busy = !!m.bz;                                           // #192 they are on a menu
      rp.invis = !!m.iv;                                          // #212 vanished (untargetable)
      rp.loot = m.lo || 0;                                        // #213 their looting level
      rp.bodyC = m.bc || 0; rp.cloakC = m.cc || 0;                // #220 their real robe colours
      rp.last = g.time;
      if (m.u && g.runHostU && m.u === g.runHostU) g.lastHostSeenT = g.time; // #173 host liveness
      // #99 a peer that reconnected shows up under a NEW m.from while its old ghost
      // lingers. Evict any OTHER entry that shares this stable uid so it can't clone.
      if (m.u) for (const [k, other] of g.remotePlayers) { if (k !== m.from && other.u === m.u) g.remotePlayers.delete(k); }
    });
    Net.on('start', m => {
      if (m.to && m.to !== Net.id) return;       // #173 targeted late-join start: not for me
      if (m.hu && m.hu === g.clientId) return;   // my own broadcast echoed back
      // #217 (co-op review) DUAL PLAY-AGAIN RACE: both players pressed within a beat,
      // each pinned themself and broadcast. Deterministic tie-break: the LOWER clientId
      // keeps the pin; the other adopts their run. Both sides apply the same rule.
      if (g.coop && g.runHostU === g.clientId && m.hu && Date.now() - (g.runStartT || 0) < 3000) {
        if (m.hu < g.clientId) { startCoop(m.seed, m.hu, m.ff, m.duel, m.hunt); }
        return; // higher id: ignore theirs - they adopt ours by this same rule
      }
      // #173 a reconnecting client that KEPT its run must not restart it: same seed,
      // already in this co-op run -> ignore (the targeted 'floor' that follows resyncs us)
      if (g.coop && g.state !== 'lobby' && g.coopSeed === m.seed) return;
      // #194 pulled into the new party run while typing a high-score name: bank the
      // score with whatever was typed so PLAY AGAIN never eats a kid's high score
      if (g.state === 'initials') { try { commitInitials(); } catch (e) { /* score save must never block the restart */ } }
      startCoop(m.seed, m.hu || null, m.ff, m.duel, m.hunt);
    });
    // #173 LATE-JOIN / REJOIN: a peer connected mid-run (fresh player, or a teammate whose
    // page reloaded). The pinned host hands them the run: a targeted 'start' with the seed
    // + authority pin, then a targeted 'floor' to land them on the current floor. The
    // room-follow pulls them into the host's room from there.
    Net.on('peer-join', m => {
      if (!g.coop || !isRunHost() || !g.dungeon) return;
      Net.sendR({ t: 'start', seed: g.coopSeed, hu: g.clientId, to: m.id, ff: g.friendlyFire ? 1 : 0, duel: g.duelMode ? 1 : 0, hunt: g.huntMode ? 1 : 0 });
      Net.sendR({ t: 'floor', floor: g.floorNum, seed: g.coopSeed, nm: g.floorNightmare ? 1 : 0, to: m.id });
    });
    // #100 a teammate's chat line
    Net.on('chat', m => { if (!g.coop) return; pushChat((m.nm && m.nm.trim()) || m.from || 'peer', m.text || '', false); });
    // P1-C: downed / revive / party-wipe game-over
    Net.on('downed', m => { const rp = g.remotePlayers.get(m.id); if (rp) rp.downed = true; dropFromLevelGate(m.id); });
    Net.on('round', m => { if (g.coop && g.duelMode) applyRound(m); }); // #240 the host called the round
    Net.on('swarm', m => { if (g.coop && g.huntMode && isCoopGuest()) applySwarm(m); });      // #241
    Net.on('huntend', m => { if (g.coop && g.huntMode && isCoopGuest()) applyHuntEnd(m); });  // #241
    Net.on('crown', m => { if (g.coop && g.huntMode && m.w !== g.clientId) applyCrown(m); });  // #243
    Net.on('revive', m => { if (m.id === Net.id && g.player && g.player.dead) reviveLocal(); });
    Net.on('gameover', m => { if (g.coop) coopGameOver(m); });
    // host -> guests: authoritative monster snapshot (guests render proxies)
    Net.on('mobs', m => {
      if (!isCoopGuest() || g.huntMode) return; // #242
      g.lastHostSeenT = g.time;
      if (m.fl !== undefined && m.fl !== g.floorNum) return; // #216 a snapshot from another floor is noise
      applyMobSnapshot(m.list, m.room);
      // #193 mirror the host's mines as draw-only proxies (drawMines reads x/y/armed/fuse/r)
      if (m.room && g.room && (g.room.gx !== m.room[0] || g.room.gy !== m.room[1])) { g.mines = []; }
      else g.mines = (m.mines || []).map(mn => ({ x: mn.x, y: mn.y, r: 8, armed: !!mn.a, fuse: mn.f ? 0 : -1, blastR: 105, dmg: 0, t: 0, armT: 0, proxy: true }));
    });
    // co-op: the guest levels off the host's shared kills
    Net.on('xp', m => { if (isCoopGuest() && g.player) g.player.addXp(m.a, g); });
    // PR-2: the host tells a peer it got hit by a monster/boss (peer self-filters on its id).
    // A player mid-pick (level-up / evolution / ultimate / gate) is frozen and can't
    // dodge, so it's shielded from damage until it resumes - no dying on the menu.
    Net.on('phit', m => {
      if (m.to !== Net.id || !g.player || g.player.dead) return;
      // frozen on any menu/overlay -> shielded (can't dodge). Includes pause + the
      // character sheet, which a first-timer WILL open assuming it's safe.
      if (g.state === 'levelup' || g.state === 'evolution' || g.state === 'ultpick' || g.state === 'rpick' ||
          g.state === 'levelwait' || g.state === 'pause' || g.state === 'charsheet') return;
      g.player.damage(m.dmg, m.sx, m.sy, g);
    });
    // P1-B: enemy projectile from the host - guest spawns a real from:'enemy' bolt it can be
    // hit by / dodge (updateProjectiles resolves the damage vs the local player)
    Net.on('proj', m => { if (isCoopGuest()) g.projectiles.push({ x: m.x, y: m.y, vx: m.vx, vy: m.vy, r: m.r, dmg: m.dmg, from: 'enemy', color: m.c, life: 3, glow: !!m.gl, glue: !!m.gu, freeze: !!m.fz, blind: !!m.bl, hitSet: null }); }); // #179/#180/#182 status flags mirror
    // P1-B: AoE blast visual (damage already arrived via phit); guest plays the boom
    Net.on('boom', m => { if (isCoopGuest()) { Fx.shake(9, 0.3); Sfx.play('explode'); Fx.burst(m.x, m.y, ['#ff8833', '#ffcc44', '#ff4422', '#888'], 28, { speed: 260, life: 0.6, glow: true }); } });
    // #10 a teammate cast their ULTIMATE: flash our screen too (visual only, no sim impact)
    Net.on('ultcast', m => { if (g.coop) { triggerUltFlash(m.n, m.c); Fx.shake(12, 0.4); Sfx.play('roar'); } });
    // P1-D: currency drop mirrored from the host -> guest's own instance (own wallet)
    Net.on('pk', m => { if (isCoopGuest()) spawnPickup(m.k, m.x, m.y); });
    // #32: GEAR drop mirrored from the host -> guest's OWN instanced copy on the
    // #136 spawn a shared gear pickup from a net message (used by both the 'gear' event
    // and the 'gearsnap' reconcile). Handles all three gear kinds, including the trinket
    // the old 'gear' handler silently dropped. Idempotent-ish: callers guard the gid.
    function addSharedGear(m) {
      if (g.pickups.some(pk => pk.gid && pk.gid === m.gid)) return; // never double-spawn a gid
      const pk = { kind: m.kind, x: m.x, y: m.y, t: 0, gid: m.gid };
      if (m.kind === 'weapon') pk.weapon = m.item;
      else if (m.kind === 'trinketItem') pk.trinket = m.item;
      else pk.armor = m.item;
      g.pickups.push(pk);
    }
    // ground, so player 2/3 can walk over + grab stronger weapons/armor of their own
    // #239 the host says A DROP HAPPENED HERE - roll YOUR OWN item for it
    Net.on('lootroll', m => {
      if (!isCoopGuest()) return;
      spawnInstancedGear(m.knd === 'armorItem' ? 'armorItem' : 'weapon', +m.x || 0, +m.y || 0,
        { tier: Math.max(1, Math.min(12, +m.tier || 1)), minRarity: Math.max(0, Math.min(5, +m.mr || 0)), luck: Math.max(0, Math.min(3, +m.lk || 0)), mythic: !!m.my });
    });
    Net.on('gear', m => {
      if (!isCoopGuest()) return;
      addSharedGear(m);   // instant feedback; the gearsnap below is the safety net
      Fx.text(m.x, m.y - 24, 'LOOT', m.item && m.item.color || '#ffd24c', 12);
    });
    // #136 GEAR SNAPSHOT: the reliability layer. The guest reconciles the ground gear in
    // its CURRENT room against the host's authoritative list - adds a drop it missed,
    // removes one that is gone. This is what actually cures the weapon desync: a lost
    // 'gear' or 'gearget' event self-heals on the very next snapshot (~4 Hz).
    Net.on('gearsnap', m => {
      if (!isCoopGuest() || !g.room) return;
      if (m.fl !== undefined && m.fl !== g.floorNum) return; // #216 stale-floor packet
      if (!m.room || m.room[0] !== g.room.gx || m.room[1] !== g.room.gy) return; // not our room
      // #137 heal a lost 'roomclear': if the host says this room is cleared and we still
      // think it is not, catch up - vacuum the loot, unseal the doors.
      if (m.cleared && !g.room.cleared) {
        g.room.cleared = true;
        vacuumPickups(); Sfx.play('unlock');
      }
      const have = new Set(g.pickups.filter(pk => pk.gid).map(pk => pk.gid));
      const authoritative = new Set((m.list || []).map(e => e.gid));
      // add anything the host has that we are missing (a lost 'gear' event)
      for (const e of (m.list || [])) if (!have.has(e.gid)) addSharedGear(e);
      // drop anything WE have that the host does not (a lost 'gearget', or grabbed)
      for (let i = g.pickups.length - 1; i >= 0; i--) {
        const pk = g.pickups[i];
        if (pk.gid && !authoritative.has(pk.gid)) g.pickups.splice(i, 1);
      }
    });
    // #96 a teammate grabbed a shared gear drop -> despawn our linked copy (same gid).
    // Symmetric (host<->guest) and idempotent (findIndex no-ops if already gone).
    Net.on('gearget', m => {
      if (!g.coop) return;
      const i = g.pickups.findIndex(pk => pk.gid === m.gid);
      if (i >= 0) g.pickups.splice(i, 1);
    });
    // P1-D: room cleared on the host -> guest vacuums its coins + unseals its doors
    Net.on('roomclear', m => {
      if (!isCoopGuest() || !g.dungeon) return;
      if (m.fl !== undefined && m.fl !== g.floorNum) return; // #216 stale-floor packet
      if (m.al !== undefined) g.alarm = m.al; // #216 the guest's alarm finally tracks the host's
      const room = g.dungeon.rooms.find(r => r.gx === m.gx && r.gy === m.gy);
      if (room) room.cleared = true;
      if (g.room && g.room.gx === m.gx && g.room.gy === m.gy) {
        vacuumPickups(); Sfx.play('unlock'); Fx.text(W / 2, H / 2 - 60, 'ROOM CLEARED', '#6ee7a0', 18);
      }
      // #232 the floor is DONE: the guest opens the same portal the host just did,
      // in the same room (the room this clear happened in)
      if (m.pt && room && !g.portal) {
        g.portal = { room, x: PF.x + PF.w / 2, y: PF.y + PF.h / 2, t: 0 };
        if (room === g.room) {
          Fx.burst(g.portal.x, g.portal.y, ['#4cc9a8', '#b88aff', '#fff'], 26, { speed: 160, life: 0.8, glow: true });
          Fx.text(W / 2, H / 2 - 30, m.pb ? 'THE BOSS DOOR OPENS...' : 'A PORTAL TO THE STAIRS OPENS', m.pb ? '#ffd24c' : '#4cc9a8', 15);
        } else {
          Fx.text(W / 2, H / 2 - 30, m.pb ? 'THE BOSS DOOR OPENS...' : 'A PORTAL OPENS BEHIND YOU', '#4cc9a8', 14);
        }
        Sfx.play('stairs');
      }
    });
    // #221 (Phase C) the keyframe lands: re-converge the durable floor state. Applied
    // SILENTLY (no fx) - if nothing diverged, nothing visibly happens.
    Net.on('key', m => {
      if (!isCoopGuest() || !g.dungeon) return;
      if (m.fl !== g.floorNum) {
        // the host is on another floor - maybe a lost 'floor' message. Adopt it only
        // after TWO consecutive mismatched keyframes AND while idle (never yank a
        // player out of an evolution/ultimate pick - that destroys the pick, #14).
        g.keyFloorMiss = (g.keyFloorMiss || 0) + 1;
        if (g.keyFloorMiss >= 2 && g.state === 'play' && !g.leveling) {
          g.keyFloorMiss = 0;
          releaseLevelGate();
          g.floorNum = m.fl; g.nightmareNext = !!m.nm;
          startFloor(); g.state = 'play';
        }
        return;
      }
      g.keyFloorMiss = 0;
      if (m.al !== undefined) g.alarm = m.al;
      if (g.huntMode && m.swn > g.huntSwarmN) g.huntSwarmN = m.swn; // #241 a missed swarm advance heals
      // #232 a guest that missed the portal event (blip, late join) heals it here
      if (m.pt && !g.portal) {
        const proom = g.dungeon.rooms.find(r => r.gx === m.pt.gx && r.gy === m.pt.gy);
        if (proom) g.portal = { room: proom, x: PF.x + PF.w / 2, y: PF.y + PF.h / 2, t: 0 };
      }
      for (const rs of m.rooms || []) {
        const room = g.dungeon.rooms.find(r => r.gx === rs.gx && r.gy === rs.gy);
        if (!room) continue;
        if (rs.cl && !room.cleared) {
          room.cleared = true;
          if (room === g.room) vacuumPickups(); // same convergence the 'roomclear' path does, minus the fanfare
        }
        if (rs.tc && room.trapChest && !room.trapChest.opened) room.trapChest.opened = true;
        if (rs.mi && room.chests) {
          for (let i = 0; i < room.chests.length; i++) {
            if ((rs.mi >> i) & 1 && !room.chests[i].opened) room.chests[i].opened = true;
          }
        }
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
        const opts = (m.db || m.fb) ? { descent: { name: m.name, pal: m.pal, anger: m.an, hpMul: 1, dmgMul: 1, variant: m.vr || 'king', skin: m.sk || null, forest: !!m.fb } } : { variant: m.vr || 'king' }; // #188/#251
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
      // #175 (Sam) CRITICAL: the guest must open the descent portal after the celebration,
      // exactly like the host. Without pendingDescent the winTimer's else-branch fired
      // onVictory() and dumped the GUEST to the victory/name-entry screen mid-run while
      // the host kept playing. Found live in the two-instance harness.
      g.pendingDescent = { toadIdx: m.toad || 0, forest: !!m.fb }; // #251
      if (typeof Descent !== 'undefined' && m.toad !== undefined) g.toadMsg = { text: Descent.toadLine(m.toad), t: 4 };
    });
    // guest -> host: "I hit monster <i> for <dmg>" (host is the source of truth)
    Net.on('hit', m => {
      if (g.coop && isRunHost()) {
        const mon = g.monsters.find(x => x.netId === m.i && !x.dead);
        if (mon) {
          mon._lastHitBy = m.from; // #207 so a kill credits the RIGHT player's class perks
          // #211 the full option bag rides in m.o; legacy fields cover an older client
          const opts = Object.assign(
            { knock: m.k || 0, flame: m.fl, chill: m.ch, venom: m.vn, crit: m.cr, hitSfx: m.hs },
            m.o || {},
            { sx: m.sx, sy: m.sy, fromPlayer: true });
          mon.takeHit(m.dmg, opts, g);
        }
      }
    });
    // tethered party: a peer moved through a door - everyone follows to that room
    // #214 a teammate sprang a mimic: open the chest on this screen too; the HOST
    // spawns the beast (immediately if standing there, else deferred to room entry)
    Net.on('mimicwake', m => {
      if (!g.coop || !g.dungeon) return;
      if (m.fl !== undefined && m.fl !== g.floorNum) return;
      const room = g.dungeon.rooms.find(r => r.gx === m.gx && r.gy === m.gy);
      if (!room || !room.chests || !room.chests[m.ci]) return;
      const ch = room.chests[m.ci];
      if (ch.opened) return;
      if (g.room === room) { wakeMimic(ch, true); return; }
      ch.opened = true;
      if (!isCoopGuest()) ch.pendingMimic = true; // host spawns it on arrival
    });
    // #227 a teammate's Q blessed you (barb R8 rage / adventurer R12 adrenaline)
    Net.on('qbuff', m => {
      if (m.to !== Net.id || !g.player || g.player.dead) return;
      const P = g.player, d = Math.max(0.5, Math.min(6, +m.dur || 3));
      P.buffs.rageT = Math.max(P.buffs.rageT, d);
      if (m.k === 'adren') P.buffs.hasteT = Math.max(P.buffs.hasteT, d);
      Fx.text(P.x, P.y - 30, m.k === 'adren' ? 'ADRENALINE!' : 'RAGE!', '#d6482e', 12);
    });
    // #213 your kill: run YOUR perks (kill count, procs, quest + achievement counters)
    Net.on('kill', m => {
      // #222 accept by socket id OR stable uid - a reconnect mid-fight changes the
      // socket id, and the kill credit must still find its owner
      if ((m.to !== Net.id && !(m.tu && m.tu === g.clientId)) || !g.player || g.player.dead) return;
      killerPerks(m.x, m.y, m.ty, !!m.el);
    });
    // #207 your kill raised a skeleton (you are the necromancer; the host rolled it)
    Net.on('rise', m => {
      if ((m.to !== Net.id && !(m.tu && m.tu === g.clientId)) || !g.player || g.player.dead) return; // #222
      riseSkeleton(m.x, m.y);
    });
    // #197 a cleric teammate Mended you: apply their heal to your own champion
    // #257 TAILWIND: a teammate's wake carries you - brief haste, your client applies
    Net.on('fwake', m => {
      if (m.to !== Net.id || !g.player || g.player.dead) return;
      g.player.buffs.hasteT = Math.max(g.player.buffs.hasteT || 0, 1.5);
      Fx.text(g.player.x, g.player.y - 30, 'TAILWIND', '#7fd4ff', 11);
    });
    // #252 ATLAS: a teammate's slam grants YOUR champion a shield charge
    Net.on('fshield', m => {
      if (m.to !== Net.id || !g.player || g.player.dead) return;
      g.player.buffs.shield = (g.player.buffs.shield || 0) + 1;
      Fx.text(g.player.x, g.player.y - 30, 'ATLAS', '#8fb7ff', 12);
    });
    Net.on('pheal', m => {
      if (m.to !== Net.id || !g.player || g.player.dead) return;
      g.player.heal(g.player.maxHp * Math.max(0, Math.min(1, +m.frac || 0.4)));
      if (m.cl) { g.player.bleed = null; g.player.slowT = 0; g.player.slowMul = 1; } // #230 cleric R4 cure
      if (m.sh) g.player.buffs.shield = Math.max(g.player.buffs.shield || 0, 1);    // #230 cleric R12 shield
      Fx.burst(g.player.x, g.player.y, ['#9effc0', '#fff'], 18, { speed: 140, life: 0.5, glow: true });
      Fx.text(g.player.x, g.player.y - 30, 'MENDED', '#9effc0', 13);
    });
    // #230 a cleric teammate consecrated ground: the same circle appears on YOUR
    // screen and heals YOUR champion standing in it (each client owns its own hp)
    Net.on('qzone', m => {
      if (!g.coop || !g.player) return;
      if (m.fl !== undefined && m.fl !== g.floorNum) return;
      g.ultFx.push({ type: 'qregen', x: +m.x || 0, y: +m.y || 0, t: 0, dur: Math.min(8, +m.dur || 4), radius: Math.min(300, +m.radius || 140), hps: Math.round(g.player.maxHp * 0.02) });
    });
    // #198 a teammate haggled: same 50/50 outcome lands on YOUR copy of that shop too
    Net.on('haggle', m => {
      if (!g.coop || !g.dungeon) return;
      const room = g.dungeon.rooms.find(r => r.gx === m.gx && r.gy === m.gy);
      if (!room || !room.shopStock || room.shopStock.haggled) return;
      room.shopStock.haggled = true;
      const factor = m.win ? 0.7 : 1.3;
      for (const it of room.shopStock.items) it.price = Math.max(1, Math.round(it.price * factor));
      g.shopMsg = { text: m.win ? 'Your partner haggled: every price drops 30%' : 'Your partner pushed the keeper: prices +30%', t: 2.4 };
      Sfx.play(m.win ? 'buy' : 'error');
    });
    // #212 a guest cast a room-status ability: apply the STATUS to the real monsters
    // (never damage - that forwards per-hit through the normal 'hit' path)
    Net.on('ultfx', m => {
      if (!g.coop || !isRunHost()) return;
      const dur = Math.max(0, Math.min(20, +m.dur || 0));
      const dps = Math.max(0, Math.min(500, +m.dps || 0));
      const R = Math.max(0, Math.min(900, +m.radius || 0));
      switch (m.k) {
        case 'inferno':
          for (const mon of g.monsters) { if (!mon.dead) mon.burn = { t: dur || 6, tick: 0, dps: dps || 60 }; }
          break;
        case 'sleep':
          for (const mon of g.monsters) { if (!mon.dead && !mon.isBoss) { mon.stagger = Math.max(mon.stagger || 0, dur || 3); mon.state = 'idle'; } }
          break;
        case 'freeze':
          for (const mon of g.monsters) { if (!mon.dead) { mon.chillT = dur || 4; mon.chillMul = 0.32; } }
          break;
        case 'fear':
          for (const mon of g.monsters) { if (!mon.dead && !mon.isBoss && Math.hypot(mon.x - m.x, mon.y - m.y) < (R || 300) + mon.r) mon.feared = dur || 5; }
          break;
        case 'midas':
          g.midasT = Math.max(g.midasT || 0, 12); // shared double-gold window
          break;
        case 'caltrops':
          g.ultFx.push({ type: 'caltrops', t: 0, dur: dur || 6, color: '#c9b37a' });
          break;
      }
    });
    // #209 a boss/bomber lob from the host: spawn the same telegraph + boom locally,
    // damage-free (the host's party blast already phits us if we stand in it)
    Net.on('lob', m => {
      if (!isCoopGuest()) return;
      g.ultFx.push({ type: 'lob', x: m.x, y: m.y, sx: m.sx, sy: m.sy, t: 0, delay: m.d || 0.9, dmg: 0, radius: m.rad || 48 });
    });
    // #191 a guest pyromancer cast Immolate: the HOST owns the monsters, so the burn
    // lands here and flows back to every screen via the snapshot burn flag.
    Net.on('immolate', m => {
      if (!g.coop || !isRunHost()) return;
      const dur = Math.max(1, Math.min(20, +m.dur || 6)), dps = Math.max(1, Math.min(500, +m.dps || 60));
      const rd = Math.max(0, Math.min(0.1, +m.rd || 0)); // #226 the guest pyro's percent rider
      for (const mon of g.monsters) { if (!mon.dead) mon.burn = { t: dur, tick: 0, dps: dps + rd * mon.maxHp * (mon.isBoss ? 1 / 3 : 1) }; }
      g.pyroSpread = { t: dur + 4, dps, dur };
    });
    // #181 someone opened a trap chest: everyone's chest opens; the pinned host spawns
    Net.on('trapopen', m => {
      if (!g.coop || !g.dungeon) return;
      const room = g.dungeon.rooms.find(r => r.gx === m.gx && r.gy === m.gy);
      if (!room || room.type !== 'trap' || !room.trapChest) return;
      if (g.room === room) springTrap(false);
      else { room.trapChest.opened = true; room.trapPending = true; } // #215 the wave spawns when the host arrives
    });
    // #175 drop a follow from a different floor (stale packet around a floor transition)
    Net.on('room', m => { if (g.huntMode) return; if (g.coop && g.dungeon && (m.fl === undefined || m.fl === g.floorNum)) coopEnterRoom(m.gx, m.gy, m.dir, false); }); // #241 hunters move alone
    // host advanced the floor - regenerate the shared floor and follow (a floor change
    // trumps any pending level-up gate: clear it so nothing is left stranded)
    Net.on('floor', m => {
      if (m.to && m.to !== Net.id) return; // #173 targeted late-join floor: not for me
      // #195 (Sam, live playtest) ALREADY THERE: after a guest's WiFi blip the host
      // re-sends the floor (late-join path), and rebuilding it teleported the non-host
      // back to the first room every time. Same floor + same seed = nothing to do.
      if (g.coop && g.dungeon && g.floorNum === m.floor && g.coopSeed === m.seed) return;
      // #236 (review #14) NEVER destroy an open pick: if this player is mid
      // evolution/ultimate choice, the descent waits for them and applies the moment
      // their pick closes (updatePlay drains g.pendingFloor).
      if (g.coop && (g.state === 'evolution' || g.state === 'ultpick' || g.state === 'rpick')) { g.pendingFloor = m; return; }
      if (g.coop) applyFloorMsg(m);
    });
    Net.on('peer-leave', m => { g.remotePlayers.delete(m.id); dropFromLevelGate(m.id); });
    // NOTE: a mid-run socket close must NOT yank the player to the menu (that kicked
    // live players out on every WiFi blip). net.js now auto-reconnects to the same room
    // and keeps the local game state, so a brief drop self-heals. Only surface status
    // in the lobby; show a transient "reconnecting" banner in-run.
    Net.onLifecycle('close', () => {
      if (g.lobby && g.lobby.mode === 'join') { g.lobby.status = 'disconnected'; return; }
      if (g.coop && g.state !== 'title') g.shareMsg = { text: 'Reconnecting...', t: 3 };
    });
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

  function startCoop(seed, hostU, ff, duel, hunt) {
    g.duelMode = !!duel;   // #240 THE DUEL rides the run start like friendly fire does
    g.huntMode = !!hunt && !duel; // #241 THE GILDED HUNT (duel wins if both are set)
    g.friendlyFire = !!ff || !!duel || g.huntMode; // duels and hunts ARE friendly fire
    g.coopSeed = (seed !== undefined && seed !== null) ? seed : (Math.random() * 1e9) | 0;
    g.remotePlayers.clear();
    g.lobby = null;
    // (#M4's coopHostId tracker retired: #173's pinned runHostU + the host-liveness
    // watchdog cover host-drop detection now)
    // #173 (Sam) PINNED RUN AUTHORITY. The relay reassigns its "host" whenever the host's
    // socket blips (server/src/index.js host migration). The game must NOT follow that:
    // a mid-run migration made the guest start broadcasting its proxy mobs as truth while
    // the real host's sim got culled - "no mobs", phantom mobs, duplicate players, all of
    // it. The run's authority is the stable per-tab clientId of whoever pressed START,
    // carried in the 'start' message, and it never changes for the life of the run.
    g.runHostU = hostU || null;
    g.runStartT = Date.now(); // #217 for the dual PLAY AGAIN tie-break window
    newRun(true);
    // #241 hunt setup: hunters start in far-apart rooms, the whole map is known
    // (the swarm demands map awareness), every room pre-cleared, no tether.
    if (g.huntMode) {
      g.huntScore = {}; g.huntSwarmN = 0; g.huntSwarmT = 0; g.huntGraceT = 3; g._swarmOrd = null;
      // #242 (Phase 3) rooms stay cleared (doors never seal) but UNSPAWNED - each
      // hunter fights their OWN monsters as they explore
      for (const r of g.dungeon.rooms) { r.visited = true; r.cleared = true; }
      // #243 the CROWN ROOM: the centre-most room the swarm never touches - THE
      // GILDED KING'S CHAMPION waits there with the crown. Both hunters' maps mark it.
      (function () {
        const rooms = g.dungeon.rooms; let cx = 0, cy = 0;
        for (const r of rooms) { cx += r.gx; cy += r.gy; }
        cx /= rooms.length; cy /= rooms.length;
        // never put the crown in either hunter's SPAWN room - that would gift it
        const start = rooms.find(r => r.type === 'start') || rooms[0];
        let far = rooms[0], fd = -1;
        for (const r of rooms) { const d2 = Math.abs(r.gx - start.gx) + Math.abs(r.gy - start.gy); if (d2 > fd) { fd = d2; far = r; } }
        let best = null, bd = 1e9;
        for (const r of rooms) {
          if (r === start || r === far) continue;
          const d = Math.hypot(r.gx - cx, r.gy - cy);
          if (d < bd) { bd = d; best = r; }
        }
        g.huntCrownRoom = best || start; g.crownedU = null;
      })();
      placeHuntSpawn();
      g.floorBanner = { text: 'THE GILDED HUNT', t: 4.5, sub: 'gear up. the swarm is coming. last champion standing.' };
    }
    // #240 duel setup: fighters start in opposite corners, scores clean, 3-2-1
    if (g.duelMode) {
      g.duelScore = {}; g.duelCountdownT = 3.2; g.duelFightT = 0;
      const p0 = g.player;
      p0.x = PF.x + (g.runHostU === g.clientId ? 140 : PF.w - 140); p0.y = PF.y + PF.h / 2;
      g.floorBanner = { text: 'THE DUELING GROUND', t: 4, sub: 'first to 3 rounds takes the set' };
    }
    g.lastHostSeenT = g.time; // #173 watchdog baseline: host has 12s to make first contact
  }
  // #173 the ONE test for "am I the simulation authority this run". Pinned to the
  // clientId from the 'start' message; falls back to the relay's live isHost only for
  // runs started by an older client that didn't send hu.
  function isRunHost() {
    if (!g.coop) return true;
    if (g.runHostU) return g.runHostU === g.clientId;
    return typeof Net !== 'undefined' && Net.isHost;
  }

  // #M4 a co-op run ended by a network event (our own drop, or the host leaving).
  // Proxy monsters have no AI so a promoted host can't take over the sim - rather
  // than a silent frozen world, bail to the menu with a clear message. Idempotent
  // (guards on g.coop, which an intentional quit already cleared).
  function endCoopDisconnected(msg) {
    if (!g.coop) return;
    g.coop = false;
    if (typeof Net !== 'undefined') Net.disconnect();
    g.remotePlayers.clear();
    g.lobby = null;
    g.state = 'title';
    g.shareMsg = { text: msg, t: 8 };
    Sfx.play('error');
  }

  // co-op room change: move to room (gx,gy). If `initiator`, tell everyone else.
  // #137 STRANDED-FOLLOWER SELF-HEAL. The 'room' change is still a one-shot event: if
  // it is lost, and you did not co-detect the plate yourself, the party moves on and you
  // are left behind. But everyone broadcasts which room they are in (the 'p' snapshot),
  // so a stranded player can SEE the rest of the party is elsewhere and follow.
  //
  // Deliberately conservative: it only fires when EVERY live teammate has been in the
  // SAME room - one that connects to yours by a door - continuously for 2 seconds. That
  // never triggers during a normal split-second transition (the party is not "stably
  // elsewhere" then), only when a room event was genuinely dropped.
  // #173 (Sam) HOST-LIVENESS WATCHDOG. Authority is pinned to whoever pressed START; the
  // relay's host migration is ignored. So if the pinned host truly leaves (page closed,
  // not a blip - blips auto-reconnect in ~1-4s), a guest would otherwise wait in a world
  // with no simulation forever. 12s of total host silence = the run is over, say so.
  function checkHostAlive() {
    if (!g.coop || isRunHost() || g.state === 'title' || g.state === 'lobby') return;
    if (g.lastHostSeenT === undefined || g.lastHostSeenT === null) return;
    if (g.time - g.lastHostSeenT > 12) endCoopDisconnected('The host left the game - run over');
  }

  function checkStrandedFollow(dt) {
    if (!g.coop || !g.room || !g.dungeon || g.state !== 'play' || g.transition) { g.strandT = 0; return; }
    // #175 only mates on MY floor count: around a floor transition a peer's room report
    // is briefly from the previous floor's map, and following those coordinates teleports
    // you somewhere nonsensical on your own floor. (rp.floor may be undefined from an
    // older client - treat that as matching.)
    const mates = [...g.remotePlayers.values()].filter(rp =>
      g.time - (rp.last || 0) < 3 && rp.room && (rp.floor === undefined || rp.floor === g.floorNum));
    if (!mates.length) { g.strandT = 0; return; }
    // are ALL of them in one room, and is it NOT my room?
    const r0 = mates[0].room;
    const together = mates.every(rp => rp.room[0] === r0[0] && rp.room[1] === r0[1]);
    if (!together || (r0[0] === g.room.gx && r0[1] === g.room.gy)) { g.strandT = 0; return; }
    // is their room adjacent to mine (connected by one of my doors)?
    const doorTo = Object.keys(g.room.doors || {}).find(d => {
      const nb = g.room.doors[d]; return nb && nb.gx === r0[0] && nb.gy === r0[1];
    });
    g.strandT = (g.strandT || 0) + dt;
    // #173 (Sam) adjacent split: follow through my own door after 2s (as before).
    // NON-adjacent split (a missed room event plus more movement used to strand a player
    // PERMANENTLY - "entered the dungeon and there were no mobs"): wait longer (4s, so it
    // never fires on a normal transition), then center-drop into the party's room.
    const wait = doorTo ? 2 : 4;
    if (g.strandT >= wait) {
      g.strandT = 0;
      Fx.text(g.player.x, g.player.y - 40, 'CATCHING UP', '#7fd4ff', 14);
      coopEnterRoom(r0[0], r0[1], doorTo || null, false); // via my door, or a center drop
    }
  }

  function coopEnterRoom(gx, gy, dir, initiator) {
    const room = g.dungeon.rooms.find(r => r.gx === gx && r.gy === gy);
    if (!room || room === g.room) return;
    // #32: don't yank a player out of a level-up/evolution/ultimate/gate overlay
    // (that would discard their in-progress pick). Defer the follow until they resume.
    if (!initiator && (g.state === 'levelup' || g.state === 'evolution' || g.state === 'ultpick' || g.state === 'rpick' || g.state === 'levelwait')) {
      g.pendingCoopRoom = { gx, gy, dir };
      return;
    }
    // #69 a follower must enter via the door in ITS OWN room that leads to the
    // destination - not the initiator's exit dir, which is only correct when both
    // stood in the same room. Derive the follower's real door; center-drop if the
    // follower was somewhere that doesn't connect (better than a wrong-side door).
    let myDir = dir;
    if (!initiator && g.room && g.room.doors) {
      myDir = Object.keys(g.room.doors).find(dd => g.room.doors[dd] === room) || null;
    }
    enterRoom(room, myDir);
    if (initiator) Net.send({ t: 'room', gx, gy, dir, fl: g.floorNum }); // #175 floor-stamped
  }

  // #206 the crafting pick: click one of the three to pay and forge it; Esc/E leaves free
  function updateCraftPick() {
    const cp = g.craftPick, p = g.player;
    if (!cp) { g.state = 'play'; return; }
    if (input.pressed('Escape') || input.pressed('KeyE')) { g.craftPick = null; g.state = 'play'; Sfx.play('ui'); return; }
    let idx = -1;
    if (input.pressed('Digit1')) idx = 0;
    if (input.pressed('Digit2')) idx = 1;
    if (input.pressed('Digit3')) idx = 2;
    if (idx < 0 && input.mouse.clicked) {
      for (const r of (g.uiRects || [])) {
        if (r.action === 'craft' && input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h) { idx = r.idx; break; }
      }
    }
    if (idx < 0 || !cp.items[idx]) return;
    if (p.coins < cp.gold || (p.shards || 0) < cp.shards) { g.shopMsg = { text: 'You can no longer afford this', t: 1.6 }; Sfx.play('error'); g.craftPick = null; g.state = 'play'; return; }
    p.coins -= cp.gold; p.shards -= cp.shards; cp.st.uses++;
    const made = cp.items[idx];
    dropGear(cp.isW ? 'weapon' : 'armorItem', made, cp.st.x, cp.st.y + 34);
    g.shopMsg = { text: `Forged: ${Weapons.displayName(made)}`, t: 2.4 };
    Fx.burst(cp.st.x, cp.st.y, ['#ffd24c', '#ff8a3d', '#fff'], 24, { speed: 180, life: 0.6, glow: true });
    Fx.shake(5, 0.2);
    Sfx.play('upgrade');
    g.craftPick = null; g.state = 'play';
  }

  function updateLobby() {
    const lb = g.lobby;
    if (input.pressed('Escape')) { closeLobby(); return; }
    // #29: type your character name on the menu screen (persists in localStorage)
    // We iterate input.just in TYPING order (not a fixed alphabet) so a phone swipe /
    // autocomplete keyboard, which can deliver several characters in one frame, spells
    // the name/code the way it was typed instead of re-sorting it alphabetically.
    if (lb.mode === 'menu' || !lb.mode) {
      for (const code of input.just) {
        const kl = /^Key([A-Z])$/.exec(code), dg = /^Digit([0-9])$/.exec(code);
        const ch = kl ? kl[1] : dg ? dg[1] : '';
        if (ch && (g.playerName || '').length < 12) { g.playerName = (g.playerName || '') + ch; saveName(); Sfx.play('ui'); }
      }
      if (input.pressed('Space') && (g.playerName || '').length < 12) { g.playerName += ' '; saveName(); }
      if (input.pressed('Backspace') && (g.playerName || '').length) { g.playerName = g.playerName.slice(0, -1); saveName(); }
    }
    // code entry while joining. Restricted to the SAME confusable-free alphabet the
    // host generator uses (net.js) so a newcomer can't type an impossible code
    // (I/L/O/0/1 are never in a real code) and get silently dropped into an orphan room.
    if (lb.mode === 'join' && !Net.connected) {
      const allowed = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      for (const code of input.just) {
        const kl = /^Key([A-Z])$/.exec(code), dg = /^Digit([0-9])$/.exec(code);
        const ch = kl ? kl[1] : dg ? dg[1] : '';
        if (ch && allowed.includes(ch) && lb.entry.length < 4) { lb.entry += ch; Sfx.play('ui'); }
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
            Net.sendR({ t: 'start', seed, hu: g.clientId, ff: g.lobbyFF ? 1 : 0, duel: g.lobbyDuel ? 1 : 0, hunt: g.lobbyHunt ? 1 : 0 }); startCoop(seed, g.clientId, g.lobbyFF, g.lobbyDuel, g.lobbyHunt); return; // #173 pin authority
          }
          if (r.action === 'lobby-ff') { g.lobbyFF = !g.lobbyFF; Sfx.play('ui'); } // #224
          if (r.action === 'lobby-duel') { g.lobbyDuel = !g.lobbyDuel; if (g.lobbyDuel) g.lobbyHunt = false; Sfx.play('ui'); } // #240
          if (r.action === 'lobby-hunt') { g.lobbyHunt = !g.lobbyHunt; if (g.lobbyHunt) g.lobbyDuel = false; Sfx.play('ui'); } // #241
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
    const ep = PlayerDef.evoPalFor ? PlayerDef.evoPalFor(p) : null; // #220 evolution robe recolour
    Net.send({
      t: 'p', x: Math.round(p.x), y: Math.round(p.y), f: +p.facing.toFixed(2),
      r: [g.room.gx, g.room.gy], fl: g.floorNum, hp: Math.round(p.hp), mh: Math.round(p.maxHp),
      wc: p.weapon ? p.weapon.color : '#9ee7ff', dd: p.downed ? 1 : 0,
      nm: g.playerName || '',
      wa: p.weapon ? p.weapon.archetype : 'light',  // so peers can draw your weapon
      wm: p.weapon ? Weapons.modelFor(p.weapon) : '', // ...with its per-name model
      pr: (g.meta.prestige || 0),                     // so peers can draw your prestige cape
      mv: p.moving ? 1 : 0,                            // so your cape waves for others too
      cw: [Math.round(p.capeWind.x), Math.round(p.capeWind.y)], // #117 cape wind vector for peers
      cl: (p.class && p.class.id) || '',              // #98 so peers render your class headgear
      fm: (p.form && p.form.id) || '',                // #162 (Sam) so peers see your druid shape
      u: g.clientId,                                  // #99 stable identity to dedup reconnect ghosts
      mn: minionSnapshot(),                           // #174 (Sam) so peers see your army
      bz: (g.state !== 'play') ? 1 : 0,               // #192 frozen in a menu (peers show CHOOSING)
      iv: p.invisT > 0 ? 1 : 0,                       // #212 vanished: monsters must not hunt me
      lo: Weapons.has(p.weapon, 'looting') || 0,      // #213 my looting level (kill drops read the killer's)
      bc: ep ? ep.body : 0, cc: ep ? ep.cloak : 0,    // #220 my TRUE body/cloak colours (evolution recolour)
    });
  }

  // #174 (Sam) compact snapshot of everything fighting FOR this player, so teammates
  // see the necromancer's skeletons, the mesmer's clones, hired mercs, the summoner's
  // elemental and the pet - previously all invisible to the rest of the party.
  // Kinds: b=skeleton, c=clone, m=merc, s=elemental (e=element), p=pet (pc=colour).
  function minionSnapshot() {
    const mn = [];
    for (const m of g.mercs) {
      if (m.dead) continue;
      mn.push({ k: m.bone ? 'b' : (m.clone ? 'c' : 'm'), x: Math.round(m.x), y: Math.round(m.y) });
    }
    if (g.summon && !g.summon.dead) mn.push({ k: 's', x: Math.round(g.summon.x), y: Math.round(g.summon.y), e: g.summon.elem || 'earth' });
    if (g.summon2 && !g.summon2.dead) mn.push({ k: 's', x: Math.round(g.summon2.x), y: Math.round(g.summon2.y), e: g.summon2.elem || 'earth' }); // #229
    // #228 (COOP-REVIEW #9) an engineer's turrets were INVISIBLE to teammates
    for (const tr of g.turrets) if (!tr.dead) mn.push({ k: 't', x: Math.round(tr.x), y: Math.round(tr.y), f: +(tr.facing || 0).toFixed(2), tl: tr.tesla ? 1 : 0 });
    const pet = g.player && g.player.pet;
    if (pet) mn.push({ k: 'p', x: Math.round(pet.x), y: Math.round(pet.y), pc: pet.color || '#6ee7a0' });
    return mn.length ? mn : undefined;
  }

  // smooth remote players toward their last reported position
  function interpRemotes(dt) {
    const k = Math.min(1, dt * 12);
    for (const [id, rp] of g.remotePlayers) {
      // #99 hard backstop: a peer that stops sending 'p' for 5s is gone - evict it so
      // a stale ghost can never persist as a clone (peer-leave usually beats this).
      if (g.time - (rp.last || 0) > 5) { g.remotePlayers.delete(id); dropFromLevelGate(id); continue; }
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
      if (rp.mn) drawPeerMinions(c, rp);   // #174 their skeletons/clones/mercs/summon/pet
      if (rp.swing) drawPeerSwing(c, rp);
      c.save();
      c.translate(rp.x, rp.y);
      // prestige cape (behind the body) - so teammates see each other's capes
      if (rp.pr > 0 && PlayerDef.capeAt) PlayerDef.capeAt(c, 13, rp.pr, rp.mv, rp.x, rp.cw ? rp.cw[0] : 0, rp.cw ? rp.cw[1] : 0);
      // #162 (Sam) a shifted druid teammate reads as their BEAST - the body recolours and
      // resizes and grows the animal head, exactly like their own screen shows it.
      const form = rp.form && PlayerDef.formById ? PlayerDef.formById(rp.form) : null;
      const R = form ? Math.round(13 * form.scale) : 13;
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.ellipse(0, R - 2, R * 0.85, R * 0.27, 0, 0, Math.PI * 2); c.fill();
      // #220 (Sam) the BODY was painted with rp.wc - the WEAPON's colour - so a teammate's
      // whole champion turned gold/purple with every weapon swap. The body now wears their
      // real colours: druid form, else the evolution recolour, else the default blue.
      c.fillStyle = form ? form.cloak : (rp.cloakC || '#2c3e60'); c.beginPath(); c.arc(0, 2, R, 0, Math.PI * 2); c.fill();
      c.fillStyle = form ? form.body : (rp.bodyC || '#4a6fa5'); c.beginPath(); c.arc(0, -2, R * 0.85, 0, Math.PI * 2); c.fill();
      c.save(); c.rotate(rp.facing || 0);
      c.fillStyle = '#0e1420'; c.fillRect(2, -4, 10, 8);
      c.fillStyle = form ? form.accent : '#9ee7ff'; c.fillRect(4, -2.5, 7, 5);
      c.restore();
      // #98/#162 the head: a druid form's animal head, else class headgear
      if (form && PlayerDef.drawFormHead) PlayerDef.drawFormHead(c, form.id, R);
      else if (rp.cl && PlayerDef.classFeature) PlayerDef.classFeature(c, rp.cl, 13);
      // held weapon (aimed where they're facing) - so teammates see each other's weapons
      if (PlayerDef.peerWeapon) PlayerDef.peerWeapon(c, rp.wa, rp.wc, rp.facing, R, rp.wm);
      c.restore();
      c.textAlign = 'center';
      c.fillStyle = '#7fd4ff'; c.font = 'bold 10px monospace';
      c.fillText(rp.name || id, rp.x, rp.y - 22);
      // #192 a teammate frozen on a pick screen says so - not an unexplained statue
      if (rp.busy) {
        const dots = '.'.repeat(1 + (Math.floor(Date.now() / 400) % 3));
        c.fillStyle = '#ffd24c'; c.font = 'italic 9px monospace';
        c.fillText('CHOOSING' + dots, rp.x, rp.y - 33);
      }
      if (rp.maxHp) {
        const bw = 26, kk = Math.max(0, (rp.hp || 0) / rp.maxHp);
        c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(rp.x - bw / 2 - 1, rp.y - 19, bw + 2, 4);
        c.fillStyle = '#7ee0a0'; c.fillRect(rp.x - bw / 2, rp.y - 18, bw * kk, 2);
      }
    }
  }

  // #174 (Sam) a teammate's army, drawn as slightly-ghosted versions of the real thing so
  // you can tell whose units they are at a glance. Positions come straight off the 'p'
  // snapshot (15 Hz) - simple markers, not full AI sprites.
  const PEER_ELEM_COLOR = { earth: '#a07a4a', fire: '#ff7a2c', lightning: '#ffe27a', poison: '#8ef06e' };
  function drawPeerMinions(c, rp) {
    for (const mn of rp.mn) {
      c.save();
      c.translate(mn.x, mn.y);
      c.globalAlpha = 0.8;
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, 8, 8, 3, 0, 0, Math.PI * 2); c.fill();
      if (mn.k === 'b') {          // skeleton: bone-white with dark sockets
        c.fillStyle = '#ddd5c2'; c.beginPath(); c.arc(0, 0, 8, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1c1c22';
        c.beginPath(); c.arc(-2.6, -1.5, 1.7, 0, Math.PI * 2); c.arc(2.6, -1.5, 1.7, 0, Math.PI * 2); c.fill();
      } else if (mn.k === 'c') {   // mesmer clone: their owner's colours, shimmering
        c.fillStyle = rp.cloakC || '#2c3e60'; c.beginPath(); c.arc(0, 1, 10, 0, Math.PI * 2); c.fill();
        c.fillStyle = rp.bodyC || '#4a6fa5'; c.beginPath(); c.arc(0, -1, 8, 0, Math.PI * 2); c.fill(); // #220 owner's REAL body colour, not their weapon's
        c.strokeStyle = 'rgba(255,94,219,0.5)'; c.lineWidth = 1;
        c.beginPath(); c.arc(0, 0, 11, 0, Math.PI * 2); c.stroke();
      } else if (mn.k === 's') {   // elemental: a glowing blob in its element's colour
        const col = PEER_ELEM_COLOR[mn.e] || '#a07a4a';
        c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 8;
        c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill();
        c.shadowBlur = 0;
      } else if (mn.k === 't') {   // #228 a teammate's turret: tripod + barrel
        c.strokeStyle = '#5a4a2a'; c.lineWidth = 2;
        for (const ang of [-2.4, -0.7, 1.6]) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(ang) * 9, 5 + Math.abs(Math.sin(ang)) * 3); c.stroke(); }
        c.save(); c.rotate(mn.f || 0); c.fillStyle = '#3a3f48'; c.fillRect(2, -2, 10, 4); c.restore();
        c.fillStyle = mn.tl ? '#ffe27a' : '#c9a227'; c.beginPath(); c.arc(0, -3, 5, 0, Math.PI * 2); c.fill();
      } else if (mn.k === 'p') {   // pet: a small bright companion dot
        c.fillStyle = mn.pc || '#6ee7a0';
        c.beginPath(); c.arc(0, 0, 6, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#0e1420';
        c.beginPath(); c.arc(-1.6, -1, 1.1, 0, Math.PI * 2); c.arc(1.6, -1, 1.1, 0, Math.PI * 2); c.fill();
      } else {                     // hired merc: an armoured grey fighter
        c.fillStyle = '#5d6675'; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#8f9aab'; c.beginPath(); c.arc(0, -2, 6, 0, Math.PI * 2); c.fill();
      }
      c.restore();
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
  function isCoopGuest() { return g.coop && !isRunHost(); } // #173 pinned, not relay-live
  function coopPlayers() { return (g.coop && typeof Net !== 'undefined') ? Math.max(2, Net.playerCount) : 1; }

  // PR-1: everyone the monsters may target. Always the local player; on the host,
  // also every remote peer sharing this room (so enemies chase BOTH players).
  function partyTargets() {
    const P = g.player;
    // DOWNED/dead players are NOT valid targets - monsters must ignore a downed body
    // (otherwise they swarm it, no one can revive, and the party false-wipes to menu).
    const list = [];
    if (!P.dead && !P.downed && !(P.invisT > 0)) list.push({ x: P.x, y: P.y, r: P.r, ref: P, isRemote: false, id: 'me' });
    // #156 MESMER: the copies are real targets. Monsters chase them instead of you -
    // that IS the class. They are pushed as ordinary party targets so the existing
    // nearestTarget() in monsters.js finds them with no AI change.
    for (const m of g.mercs) {
      if (m.clone && !m.dead) list.push({ x: m.x, y: m.y, r: 12, ref: m, isRemote: false, id: 'clone' });
      if (m.golem && !m.dead) list.push({ x: m.x, y: m.y, r: 18, ref: m, isRemote: false, id: 'golem' }); // #229 the golem TAUNTS
    }
    if (g.decoy && !g.decoy.dead) { // #253 MIRAGE draws every eye, exactly like a clone
      list.push({ x: g.decoy.x, y: g.decoy.y, r: 14, ref: g.decoy, isRemote: false, id: 'decoy' });
    }
    if (g.goose && !g.goose.dead) { // #257 the goose is huntable - protect it
      list.push({ x: g.goose.x, y: g.goose.y, r: 10, ref: g.goose, isRemote: false, id: 'goose' });
    }
    // #224 with FRIENDLY FIRE on, every client enumerates its peers (a guest must be
    // able to aim at the host); without it, only the host does (monster AI targeting).
    if (g.coop && typeof Net !== 'undefined' && (isRunHost() || g.friendlyFire) && g.room) {
      for (const [id, rp] of g.remotePlayers) {
        if (g.time - (rp.last || 0) > 3 || rp.dead || rp.downed || rp.invis) continue; // #212 a vanished peer is untargetable
        if (!rp.room || rp.room[0] !== g.room.gx || rp.room[1] !== g.room.gy) continue;
        list.push({ x: rp.x, y: rp.y, r: 13, ref: rp, isRemote: true, id });
      }
    }
    return list;
  }
  // PR-2: deal damage to a party target - the local player directly, a remote peer
  // over the wire ({t:'phit'} that the peer self-filters on Net.id).
  function hurtTarget(target, dmg, sx, sy, src) {
    // #242 in a HUNT, monsters are per-player illusions - MY monsters (src.type is a
    // monster tell; players carry no .type) must never wound the REAL other hunter
    if (g.huntMode && target && target.isRemote && src && src.type) return;
    if (!target || !target.isRemote) { if (g.player && !g.player.dead) g.player.damage(dmg, sx, sy, g, src); return; }
    if (typeof Net !== 'undefined') Net.sendR({ t: 'phit', to: target.id, dmg: Math.round(dmg), sx: Math.round(sx || 0), sy: Math.round(sy || 0) });
  }
  g.partyTargets = partyTargets;
  g.hurtTarget = hurtTarget;
  g.swarmConsumed = swarmConsumed; // #241 the minimap paints consumed rooms
  // #229 mesmer R8: your clones ECHO your melee swings at 30% power around themselves
  g.cloneEcho = (p2, w, scale) => {
    if (!g.coop && false) return; // works solo and co-op alike
    if (!p2.class || p2.class.id !== 'mesmer') return;
    if (typeof Abilities === 'undefined' || !Abilities.qRank || Abilities.qRank('mesmer', p2.statPoints) < 8) return;
    const dmg = Math.max(1, Math.round((w.dmg || 10) * (p2.stats.dmgMul || 1) * 0.3 * (scale || 1)));
    for (const cl of g.mercs) {
      if (!cl.clone || cl.dead) continue;
      let any = false;
      for (const m of g.monsters) {
        if (m.dead || m.airborne || m.spawnT > 0) continue;
        if (Math.hypot(m.x - cl.x, m.y - cl.y) < (w.range || 50) * 0.8 + m.r) { m.takeHit(dmg, { sx: cl.x, sy: cl.y, fromPlayer: true, hitSfx: 'hitLight' }, g); any = true; }
      }
      if (any) Fx.burst(cl.x, cl.y, ['#c78bff'], 5, { speed: 110, life: 0.3, glow: true });
    }
  };
  g.isRunHost = isRunHost; // #189 so monsters.js mirrors use the PINNED authority, not the relay's live host flag

  // P1-C: DOWNED / REVIVE / party-wipe -----------------------------------------
  function goDowned() {
    const p = g.player; // p.dead already true
    p.downed = true;
    Fx.text(p.x, p.y - 40, 'DOWNED - hold on!', '#7fd4ff', 15);
    Sfx.play('hurt');
    if (typeof Net !== 'undefined') Net.sendR({ t: 'downed', id: Net.id });
    // #32: if we're downed with a level cycle still open, forfeit it so a waiting
    // teammate isn't stranded on the gate (our picks resume when we're revived)
    if (g.leveling) { g.leveling = false; if (typeof Net !== 'undefined' && Net.connected) Net.sendR({ t: 'lvldone' }); }
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
    if (g.duelMode || g.huntMode) return; // #240/#241 the fallen stay down - the next round revives them
    const p = g.player;
    if (p.dead) return; // the downed can't revive
    for (const [id, rp] of g.remotePlayers) {
      if (!rp.downed || !rp.room || rp.room[0] !== g.room.gx || rp.room[1] !== g.room.gy) { rp.reviveT = 0; continue; }
      if (Math.hypot(rp.x - p.x, rp.y - p.y) < 46) {
        rp.reviveT = (rp.reviveT || 0) + dt;
        Fx.burst(rp.x, rp.y, ['#7fd4ff'], 1, { speed: 20, life: 0.3 });
        if (rp.reviveT >= 3) { rp.reviveT = 0; rp.downed = false; Net.sendR({ t: 'revive', id }); Fx.text(rp.x, rp.y - 30, 'REVIVED!', '#6ee7a0', 14); }
      } else rp.reviveT = 0;
    }
  }
  // #241 THE GILDED HUNT. Hunters spawn far apart, move INDEPENDENTLY (no tether,
  // solo-style doors), see each other only in a shared room, gear up from their own
  // instanced chests - and the SWARM consumes the floor from the outside in, on the
  // host's clock but in a seed-deterministic order, herding both toward the middle.
  function placeHuntSpawn() {
    const rooms = g.dungeon.rooms;
    const start = rooms.find(r => r.type === 'start') || rooms[0];
    let far = rooms[0], fd = -1;
    for (const r of rooms) { const d = Math.abs(r.gx - start.gx) + Math.abs(r.gy - start.gy); if (d > fd) { fd = d; far = r; } }
    const mine = (g.runHostU === g.clientId) ? start : far;
    enterRoom(mine, null);
    g.player.x = PF.x + PF.w / 2; g.player.y = PF.y + PF.h / 2;
    g.player.dead = false; g.player.downed = false; g.player.hp = g.player.maxHp;
  }
  // the seed-deterministic consumption order: farthest from the map's centroid first,
  // the centre-most room NEVER falls (the showdown ground). State = one integer.
  function swarmOrder() {
    const rooms = g.dungeon.rooms;
    let cx = 0, cy = 0;
    for (const r of rooms) { cx += r.gx; cy += r.gy; }
    cx /= rooms.length; cy /= rooms.length;
    const ord = [...rooms].sort((a, b) => {
      const da = Math.hypot(a.gx - cx, a.gy - cy), db = Math.hypot(b.gx - cx, b.gy - cy);
      return db - da || a.gx - b.gx || a.gy - b.gy;
    });
    return ord.slice(0, Math.max(0, ord.length - 1)); // spare the final room
  }
  function swarmConsumed(room) {
    if (!g.huntMode || g.huntSwarmN <= 0) return false;
    const ord = g._swarmOrd || (g._swarmOrd = swarmOrder());
    for (let i = 0; i < Math.min(g.huntSwarmN, ord.length); i++) if (ord[i] === room) return true;
    return false;
  }
  function updateHunt(dt) {
    if (!g.huntMode || !g.coop) return;
    if (g.huntGraceT > 0) { g.huntGraceT -= dt; g.player.iframes = Math.max(g.player.iframes, 0.25); }
    // the swarm eats whoever lingers in a consumed room - each client drains its OWN
    // champion (it owns its hp), on a tick that outpaces hurt-iframes
    // #243 the crowned hunter blazes: permanent rage + haste + a golden wake
    if (g.crownedU === g.clientId && !g.player.dead) {
      g.player.buffs.rageT = Math.max(g.player.buffs.rageT, 0.5);
      g.player.buffs.hasteT = Math.max(g.player.buffs.hasteT, 0.5);
      if (Math.random() < 0.15) Fx.burst(g.player.x, g.player.y + 6, ['#ffd24c', '#fff'], 2, { speed: 40, life: 0.5, glow: true });
    }
    // #243 the stalking cue: your opponent moving through an ADJACENT room makes
    // noise - a whisper at the connecting door every few seconds. Hunt them by ear.
    g.huntCueT -= dt;
    if (g.huntCueT <= 0 && g.room) {
      g.huntCueT = 3;
      for (const rp of g.remotePlayers.values()) {
        if (!rp.room || (g.time - (rp.last || 0)) > 3) continue;
        for (const dk of Object.keys(g.room.doors)) {
          const n = g.room.doors[dk];
          if (n && n.gx === rp.room[0] && n.gy === rp.room[1]) {
            const pp = platePos(dk);
            const word = { N: 'north', S: 'south', W: 'west', E: 'east' }[dk];
            Fx.text(pp.x, pp.y - 14, `...something moves to the ${word}...`, '#9aa4b8', 10);
            break;
          }
        }
      }
    }
    if (g.room && swarmConsumed(g.room) && !g.player.dead) {
      g._swarmTick = (g._swarmTick || 0) - dt;
      if (g._swarmTick <= 0) {
        g._swarmTick = 0.8;
        g.player.damage(Math.max(8, Math.round(g.player.maxHp * 0.08)), g.player.x, g.player.y - 40, g);
        Fx.text(g.player.x, g.player.y - 44, 'THE SWARM', '#ff4040', 12);
      }
    }
    if (!isRunHost()) return;
    // host clock: 75s of grace, then a room falls every 18s
    g.huntSwarmT += dt;
    const due = g.huntSwarmT < 75 ? 0 : 1 + Math.floor((g.huntSwarmT - 75) / 18);
    const ord = g._swarmOrd || (g._swarmOrd = swarmOrder());
    if (due > g.huntSwarmN && g.huntSwarmN < ord.length) {
      g.huntSwarmN = Math.min(due, ord.length);
      Net.sendR({ t: 'swarm', n: g.huntSwarmN });
      applySwarm({ n: g.huntSwarmN });
    }
    // last champion standing: exactly one hunter down ends the hunt
    if (g.huntGraceT > 0) return;
    const meDown = g.player.dead || g.player.downed;
    let theirDown = false, theirU = null;
    for (const rp of g.remotePlayers.values()) { if (rp.u) theirU = rp.u; if (rp.downed) theirDown = true; }
    if (meDown === theirDown) return; // both up, or a double-down = the swarm decides next round
    const winnerU = meDown ? theirU : g.clientId;
    g.huntScore[winnerU] = (g.huntScore[winnerU] || 0) + 1;
    const payload = { t: 'huntend', w: winnerU, sc: g.huntScore };
    Net.sendR(payload);
    applyHuntEnd(payload);
  }
  // #243 the crown lands: both hunters see it. The crowned one blazes gold and
  // carries permanent rage + haste; the other now knows exactly what is coming.
  function applyCrown(m) {
    g.crownedU = m.w;
    const mine = m.w === g.clientId;
    triggerUltFlash(mine ? 'THE CROWN IS YOURS' : 'THE CROWN IS TAKEN', '#ffd24c');
    g.floorBanner = mine
      ? { text: 'THE CROWN IS YOURS', t: 4, sub: 'they heard. they know. finish it.' }
      : { text: 'YOUR OPPONENT WEARS THE CROWN', t: 4, sub: 'fight now or die in the swarm' };
    Sfx.play('roar'); Fx.shake(8, 0.4);
  }
  function applySwarm(m) {
    g.huntSwarmN = Math.max(g.huntSwarmN, +m.n || 0);
    g.floorBanner = { text: 'THE SWARM ADVANCES', t: 2.2, sub: `${g.huntSwarmN} room${g.huntSwarmN > 1 ? 's' : ''} consumed - stay ahead of it` };
    Sfx.play('roar'); Fx.shake(4, 0.25);
  }
  function applyHuntEnd(m) {
    g.huntScore = m.sc || {};
    const iWon = m.w === g.clientId;
    triggerUltFlash(iWon ? 'HUNT CHAMPION' : 'HUNTED DOWN', iWon ? '#ffd24c' : '#e05555');
    g.floorBanner = { text: iWon ? 'HUNT CHAMPION' : 'HUNTED DOWN', t: 4.5, sub: 'the hunt begins again' };
    Sfx.play(iWon ? 'levelup' : 'hurt');
    // run it back: fresh swarm, fresh crown, back to your corners of the map
    g.huntSwarmN = 0; g.huntSwarmT = 0; g._swarmOrd = null; g.huntGraceT = 4;
    g.crownedU = null;
    if (g.huntCrownRoom) { g.huntCrownRoom.kingDown = false; g.huntCrownRoom.spawned = false; }
    placeHuntSpawn();
  }

  // #240 THE DUEL referee. Both clients run the countdown (fighters untouchable);
  // only the HOST calls rounds (single announcer - each client owns its own hp, so
  // ties need one judge). A double-down is a DOUBLE KO: replayed, no point.
  function updateDuel(dt) {
    if (!g.duelMode || !g.coop) return;
    if (g.duelFightT > 0) g.duelFightT -= dt;
    if (g.duelCountdownT > 0) {
      g.duelCountdownT -= dt;
      g.player.iframes = Math.max(g.player.iframes, 0.25); // untouchable until FIGHT
      if (g.duelCountdownT <= 0) { g.duelFightT = 0.8; Sfx.play('roar'); }
      return;
    }
    if (!isRunHost()) return;
    const meDown = g.player.dead || g.player.downed;
    let theirDown = false, theirU = null;
    for (const rp of g.remotePlayers.values()) { if (rp.u) theirU = rp.u; if (rp.downed) theirDown = true; }
    if (!meDown && !theirDown) return;
    // someone fell: score it (or call the double KO) and reset the round
    let winnerU = null;
    if (meDown && !theirDown) winnerU = theirU;
    else if (theirDown && !meDown) winnerU = g.clientId;
    if (winnerU) g.duelScore[winnerU] = (g.duelScore[winnerU] || 0) + 1;
    const fin = winnerU && g.duelScore[winnerU] >= 3 ? 1 : 0;
    const payload = { t: 'round', w: winnerU || 0, sc: g.duelScore, fin };
    Net.sendR(payload);
    applyRound(payload);
  }
  function applyRound(m) {
    g.duelScore = m.sc || {};
    const iWon = m.w && m.w === g.clientId;
    const p = g.player;
    p.dead = false; p.downed = false; p.hp = p.maxHp; p.iframes = 2;
    p.x = PF.x + (g.runHostU === g.clientId ? 140 : PF.w - 140); p.y = PF.y + PF.h / 2;
    g.projectiles = [];
    if (g.state === 'dead' || g.state === 'win') g.state = 'play';
    if (m.fin) {
      triggerUltFlash(iWon ? 'DUEL CHAMPION' : 'DEFEATED', iWon ? '#ffd24c' : '#e05555');
      g.floorBanner = { text: iWon ? 'DUEL CHAMPION' : 'DEFEAT', t: 4.5, sub: 'the set resets - fight on' };
      g.duelScore = {};
      Sfx.play(iWon ? 'levelup' : 'hurt');
    } else {
      g.floorBanner = { text: !m.w ? 'DOUBLE KO - replay the round' : (iWon ? 'ROUND YOURS' : 'ROUND LOST'), t: 2.2 };
      Sfx.play('unlock');
    }
    g.duelCountdownT = 3.2;
  }

  // host: end the run only when EVERYONE is down
  function checkPartyWipe() {
    if (g.duelMode || g.huntMode) return; // #240/#241 pvp ends in rounds, never a game over
    if (!isRunHost() || g.runEnded) return;
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
    Net.sendR({ t: 'gameover', floor: g.floorNum, king: g.kingSlain ? 1 : 0 });
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

  // #136 host: broadcast a SNAPSHOT of the ground gear in the current room (~4 Hz).
  //
  // This is the reliability layer under the fragile one-shot 'gear' event. Weapons
  // desynced because a dropped gear-drop packet is never re-sent - one lost packet and
  // the guest never sees that weapon (Sam's bug). Positions and monsters do not have
  // this problem because they are SNAPSHOTS: a lost packet is corrected by the next.
  // So gear becomes a snapshot too. The 'gear' event stays for instant feedback; this
  // is the safety net that heals a miss. Guests reconcile their room against it: add a
  // gid they are missing, drop a gid that is gone (already grabbed).
  //
  // Tagged with the room, and the guest applies it only when in that same room, so it
  // never wipes a guest's gear while the party is briefly split across a doorway.
  function broadcastGear(dt) {
    if (!g.coop || typeof Net === 'undefined' || !isRunHost() || !Net.connected || !g.room) return;
    g.gearSendT -= dt;
    if (g.gearSendT > 0) return;
    g.gearSendT = 0.25;
    const list = [];
    for (const pk of g.pickups) {
      if (!pk.gid) continue; // only shared, id-bearing gear (weapon/armorItem/trinketItem)
      const e = { gid: pk.gid, kind: pk.kind, x: Math.round(pk.x), y: Math.round(pk.y) };
      if (pk.kind === 'weapon') e.item = pk.weapon;
      else if (pk.kind === 'trinketItem') e.item = pk.trinket;
      else e.item = pk.armor;
      list.push(e);
    }
    // #137 the snapshot also carries the room's CLEARED flag, so a lost one-shot
    // 'roomclear' event self-heals: without this, a guest that missed it keeps its doors
    // sealed and is trapped in a room it has actually already cleared.
    Net.send({ t: 'gearsnap', room: [g.room.gx, g.room.gy], fl: g.floorNum, list, cleared: !!g.room.cleared }); // #216 floor-stamped
  }

  // #221 (co-op review Phase C) the KEYFRAME: every ~5s the host broadcasts the
  // durable SHARED state of the floor - floor number, alarm, and each room's
  // cleared / trap-sprung / mimic-opened flags. Guests re-converge on it silently.
  // After this, an effect that misses its net path degrades to "heals within
  // seconds" instead of "diverges for the rest of the run" (Fiedler: divergence is
  // expected and healed, never fatal). Regular chest 'opened' state is deliberately
  // NOT here: chest loot is per-player by design (#97).
  function broadcastKeyframe(dt) {
    if (!g.coop || typeof Net === 'undefined' || !isRunHost() || !Net.connected || !g.dungeon) return;
    g.keySendT = (g.keySendT || 0) - dt;
    if (g.keySendT > 0) return;
    g.keySendT = 5;
    const rooms = [];
    for (const r of g.dungeon.rooms) {
      const mi = (r.chests || []).reduce((b, ch, i) => b | ((ch.mimic && ch.opened) ? (1 << i) : 0), 0);
      const tc = (r.trapChest && r.trapChest.opened) ? 1 : 0;
      if (r.cleared || tc || mi) rooms.push({ gx: r.gx, gy: r.gy, cl: r.cleared ? 1 : 0, tc, mi });
    }
    Net.send({ t: 'key', fl: g.floorNum, al: g.alarm, nm: g.floorNightmare ? 1 : 0, rooms,
      pt: g.portal && g.portal.room ? { gx: g.portal.room.gx, gy: g.portal.room.gy } : 0,
      swn: g.huntMode ? g.huntSwarmN : 0 }); // #232 the portal self-heals; #241 so does the swarm
  }

    // host: broadcast a compact snapshot of every monster (~15 Hz)
  function broadcastMobs(dt) {
    if (g.huntMode) return; // #242 hunt monsters are local to each player - never broadcast
    if (!g.coop || typeof Net === 'undefined' || !isRunHost() || !Net.connected) return;
    if (Net.peers && Net.peers.size === 0) return; // #262 nobody is listening - skip the serialization
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
                  st: m.state, tg: +(m.telegraph || 0).toFixed(2), lg: m.lungeAngle !== undefined ? +m.lungeAngle.toFixed(2) : undefined, fu: m.fuse,
                  bn: (m.burn && m.burn.t > 0) ? 1 : 0 }); // #191 so guests SEE the fire
    }
    // #172 (Sam) room-tag every snapshot. A guest standing in a DIFFERENT room must not
    // render these - that was the "phantom invulnerable mob" that only one player could
    // see and that sealed the room shut.
    // #193 (Sam, live playtest) mines were host-local: player 2 walked over bombs it
    // could not see. A compact list rides the same room-tagged snapshot (visual +
    // positional only; the HOST still owns arming, fuses and the blast).
    const mines = (g.mines || []).slice(0, 24).map(mn => ({ x: Math.round(mn.x), y: Math.round(mn.y), a: mn.armed ? 1 : 0, f: mn.fuse >= 0 ? 1 : 0 }));
    Net.send({ t: 'mobs', room: g.room ? [g.room.gx, g.room.gy] : null, fl: g.floorNum, list, mines }); // #216 floor-stamped
    // P1-E: the boss rides its own message (crown/jaw/hop/shadow draw fields)
    const b = g.boss;
    if (b && !b.dead && b.netId) {
      Net.send({ t: 'boss', i: b.netId, name: b.name, pal: b.pal, an: b.anger || 0, db: b.isDescentBoss ? 1 : 0, fb: b.forestBoss ? 1 : 0, dm: b.dmg || 16, vr: b.variant || 'king', sk: b.skin || '', // #188 the Dante model / #251 the Harpy
        x: Math.round(b.x), y: Math.round(b.y), f: +(b.facing || 0).toFixed(2), hp: Math.round(b.hp), mh: Math.round(b.maxHp),
        st: b.state, tg: +(b.telegraph || 0).toFixed(2), jaw: Math.round(b.jaw || 0), hop: Math.round(b.hop || 0),
        sx: Math.round(b.shadowX || 0), sy: Math.round(b.shadowY || 0) });
    }
  }

  // guest: reconcile local proxies against the host's snapshot
  function applyMobSnapshot(list, room) {
    // #172 (Sam) if the guest is not standing in the room the host snapshotted, these
    // mobs belong somewhere the guest isn't. Rendering them was the phantom-mob room-lock.
    // Drop every proxy and wait for the rooms to reconverge (the room-follow mechanic).
    if (room && g.room && (g.room.gx !== room[0] || g.room.gy !== room[1])) {
      for (let i = g.monsters.length - 1; i >= 0; i--) {
        const m = g.monsters[i];
        if (m.proxy && !m.isBoss) { m.dead = true; g.monsters.splice(i, 1); }
      }
      return;
    }
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
      // #191 (player report) burning mobs now burn on EVERY screen. Visual-only marker,
      // refreshed by each snapshot; dps 0 so the proxy never double-ticks damage.
      m.burn = s.bn ? { t: 0.5, tick: 9, dps: 0 } : null;
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
    // #211 (co-op review P1-6) ship EVERY serializable takeHit option, so a status
    // added to takeHit next month works for guests automatically instead of dying in
    // a hand-kept whitelist (stagger, chain and executioner already had).
    const o = {};
    for (const key in (opts || {})) {
      if (key === 'sx' || key === 'sy' || key === 'fromPlayer' || key === 'hitSet' || key === 'owner' || key === 'src') continue;
      const v = opts[key];
      if (v === undefined || v === null || typeof v === 'function' || typeof v === 'object') continue;
      o[key] = v;
    }
    Net.sendR({ t: 'hit', i: mon.netId, dmg: Math.round(dmg),
      sx: Math.round((opts && opts.sx) || mon.x), sy: Math.round((opts && opts.sy) || mon.y), o });
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
      // visual-only shot: from:'remote' so updateProjectiles never applies damage.
      // magic (sp set) renders as a glowing orb + trail; a bow arrow stays an arrow.
      if (m.sp) {
        g.projectiles.push({ from: 'remote', x: m.x, y: m.y, vx: m.vx, vy: m.vy, r: m.r || 6,
          color: m.c || '#b06bff', life: 1.4, glow: true, spell: m.sp, hitSet: new Set(),
          trail: [m.c || '#b06bff'], glowTrail: true });
        Sfx.play(m.sp === 'fireball' ? 'heavy' : 'bowfire');
      } else {
        g.projectiles.push({ from: 'remote', x: m.x, y: m.y, vx: m.vx, vy: m.vy, r: 4, color: m.c || '#e8e3d0', life: 1.4, arrow: true, hitSet: new Set() });
        Sfx.play('bowfire');
      }
    }
  }

  // guest: smooth proxies toward their reported position + take contact damage
  function updateGuestMobs(dt) {
    if (g.huntMode) return; // #242 no proxies in a hunt - the guest's monsters are REAL
    const p = g.player, k = Math.min(1, dt * 14);
    for (const m of g.monsters) {
      if (!m.proxy) continue;
      if (m.tx !== undefined) { m.x += (m.tx - m.x) * k; m.y += (m.ty - m.y) * k; }
      // P1-A: guest no longer self-damages from contact - the HOST's AI now targets
      // the guest and deals damage authoritatively via {t:'phit'} (no double-count).
    }
  }

  // #100 co-op text chat helpers ------------------------------------------------
  function openChat() {
    g.chat.open = true; g.chat.buffer = '';
    input.textCapture = true; input.textBuf = ''; input.keys.clear(); // drop held movement
    Sfx.play('ui');
  }
  function closeChat() {
    g.chat.open = false; g.chat.buffer = '';
    input.textCapture = false; input.textBuf = '';
  }
  function pushChat(name, text, mine) {
    g.chat.log.push({ name: String(name).slice(0, 16), text: String(text).slice(0, 120), t: g.time, mine: !!mine });
    if (g.chat.log.length > 30) g.chat.log.shift();
  }
  function sendChat() {
    const text = g.chat.buffer.trim();
    if (!text) return;
    const name = g.playerName || 'you';
    pushChat(name, text, true);
    if (typeof Net !== 'undefined' && Net.connected) Net.send({ t: 'chat', text, nm: name });
  }
  function updateChat() {
    const ch = g.chat;
    if (!ch.open) {
      if (input.pressed('Enter')) { openChat(); input.just.delete('Enter'); }
      return;
    }
    // pull the real characters harvested by the keydown handler
    if (input.textBuf) { ch.buffer = (ch.buffer + input.textBuf).slice(0, 120); input.textBuf = ''; }
    if (input.pressed('Backspace')) { ch.buffer = ch.buffer.slice(0, -1); input.just.delete('Backspace'); }
    if (input.pressed('Enter')) { sendChat(); closeChat(); input.just.delete('Enter'); }
    else if (input.pressed('Escape')) { closeChat(); input.just.delete('Escape'); } // consume so it doesn't open pause
  }

  function updatePlay(dt) {
    // #236 a floor advance arrived while this player was mid-pick: apply it now
    if (g.coop && g.pendingFloor) { const fm = g.pendingFloor; g.pendingFloor = null; applyFloorMsg(fm); return; }
    // #100 co-op text chat. Deliberately does NOT pause the world (the host is
    // authoritative over monsters - freezing here would freeze the guests). It only
    // captures typing; movement/ability keys are already swallowed by the keydown
    // handler while the box is open, so the player just stands and auto-fights.
    if (g.coop) updateChat();
    updateQuest(dt); // has the stranger's errand been earned, or blown?
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      // YOU CANNOT PAUSE AN ONLINE GAME. In co-op, a true pause (g.state='pause')
      // stops updatePlay, and with it the host's authoritative monster tick and every
      // client's position broadcast - so ONE player pausing froze the whole party
      // (Sam's bug). Instead we open a menu OVERLAY: the world keeps running underneath
      // (monsters, other players, your own peril), input is swallowed, and it is purely
      // a menu. Same model co-op chat already uses. Solo play still truly pauses.
      if (g.coop) {
        g.coopMenu = !g.coopMenu;
        g.player.drawT = -1;
        Sfx.play('ui');
      } else {
        g.state = 'pause'; g.overlayT = 0;
        g.player.drawT = -1; // a held bow draw must not survive pause and fire on resume
        return;
      }
    }
    // while the co-op menu is open, swallow player control (movement/abilities) but let
    // the rest of updatePlay run, so the shared world never freezes for anyone.
    if (g.coopMenu) {
      handleCoopMenu();
      // fall through: monsters, sync, other players all keep updating below
    }
    if (input.pressed('KeyC')) { // character sheet: stats + evolutions (pauses solo; in co-op the world runs on underneath - #249)
      g.state = 'charsheet'; g.overlayT = 0;
      g.player.drawT = -1;
      Sfx.play('ui');
      return;
    }
    if (Fx.tickHitstop(dt)) { g.preserveInput = true; return; } // hit-stop: world freezes, but buffered presses survive it
    if (typeof Ach !== 'undefined') Ach.tick(g); // #86 live maxes (hp/coins/rooms)

    // #32: a room-follow that arrived while we were gated/picking now applies (party
    // stays together - we catch up to wherever the mover led once we're back in play)
    if (g.pendingCoopRoom && g.dungeon) {
      const pr = g.pendingCoopRoom; g.pendingCoopRoom = null;
      coopEnterRoom(pr.gx, pr.gy, pr.dir, false);
      if (g.state !== 'play') return;
    }

    const p = g.player;
    // while the co-op menu overlay is up, the player stands still and holds fire (its
    // timers, cooldowns and regen still tick) - but the world around it keeps moving.
    const pInput = g.coopMenu ? IDLE_INPUT : input;
    if (!p.dead && pInput.pressed('Tab')) p.swapWeapon();
    p.update(dt, g, pInput);
    // #156 DEATH KNIGHT: the rune ate a killing blow this frame - DEATH OVER EVERYTHING.
    // player.hurt() only raises the flag; the room is detonated here so the blast is not
    // resolved inside the damage path it was triggered from.
    if (p.undyingBlast) {
      p.undyingBlast = false;
      const a = p.ability || {};
      const R = a.radius || 240, D = (a.dmg || 150) * (p.stats.dmgMul || 1);
      for (const m of g.monsters) {
        if (m.dead || m.airborne || m.spawnT > 0) continue;
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d > R + m.r) continue;
        m.takeHit(D * (1 - 0.35 * (d / R)), { sx: p.x, sy: p.y, knock: 320, crit: true, fromPlayer: true, hitSfx: 'hitHeavy' }, g);
      }
    }
    if (!g.coopMenu) tryRoomExit();   // don't walk through a door while the menu is up
    if (g.state !== 'play') return; // transition may have started

    if (!p.dead) { // a corpse can't loot chests or wake mimics during the death beat
      checkMimicProximity();
      if (input.pressed('KeyE')) { interact(); g.trainHoldCd = 0.35; } // #146 seed the auto-repeat delay
      // #146 (Sam) BARRACKS hold-to-buy: holding E at a training station auto-repeats the
      // purchase (Sam shows up with 50k+ gold; one-at-a-time was a slog). Gated to stations
      // and to affordability, so it stops the instant you cannot pay - no error-sound spam.
      else if (input.key('KeyE')) {
        const t = nearestInteractable();
        if (t && t.kind === 'trainStation' && !barracksMaxed() && g.player.coins >= barracksCost()) {
          g.trainHoldCd = (g.trainHoldCd || 0) - dt;
          if (g.trainHoldCd <= 0) { interact(); g.trainHoldCd = 0.1; }
        }
      }
      if (input.pressed('KeyH')) { // #186 drink the carried potion
        if (!p.potion) { Fx.text(p.x, p.y - 34, 'NO POTION', '#a05555', 12); Sfx.play('error'); }
        else if (p.hp >= p.maxHp) { Fx.text(p.x, p.y - 34, 'FULL HEALTH', '#8fa3bf', 12); Sfx.play('error'); }
        else {
          p.potion = false;
          p.heal(POTION_HEAL);
          Fx.burst(p.x, p.y, ['#ff5a6e', '#ffd2d8', '#fff'], 18, { speed: 130, life: 0.5, glow: true });
          Sfx.play('buy');
        }
      }
      if (input.pressed('KeyF')) { // #51 toggle auto-attack
        p.autoAttack = !p.autoAttack;
        p.drawT = -1; // drop any held bow draw when switching off
        Fx.text(p.x, p.y - 34, p.autoAttack ? 'AUTO-ATTACK ON' : 'AUTO-ATTACK OFF', p.autoAttack ? '#7ee0a0' : '#ff9a3d', 13);
        Sfx.play('ui');
      }
      if (input.pressed('KeyQ')) useAbility();
      if (input.pressed('KeyR')) useAbilityR();
      // left-click = manual attack while auto-attack is OFF (ultimate moved to RMB)
      if (input.mouse.clicked && !p.autoAttack) p.manualAttack(g, input.mouse.x, input.mouse.y);
      if (input.pressed('KeyX')) salvageNearest();
      if (input.pressed('KeyU')) honeWeapon();
    }

    for (const m of g.monsters) if (!m.dead) { m.update(dt, g); if (g.rules) g.rules.monster(m, dt, g); }
    // #134 NEWTON'S APPLE: everything is pulled gently toward you. A weak, constant tug
    // (not a yank) so you can line a room up along your swing - and so the enemies also
    // arrive sooner than they meant to, which is the apple's price.
    if (g.player && !g.player.dead && g.player.trinketFlag('gravity')) {
      const p = g.player;
      for (const m of g.monsters) {
        if (m.dead || m.isBoss || m.spawnT > 0) continue;
        const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
        if (d > 40 && d < 420) { const pull = 34 * dt; m.x += dx / d * pull; m.y += dy / d * pull; }
      }
    }
    updateMercs(dt);
    updateProjectiles(dt);
    updatePickups(dt);
    updateMines(dt);
    updateStalactites(dt);   // #164 falling stalactites on the underground floors
    updateGluePuddles(dt);   // #179 sticky glue on the floor slows everything in it
    updateBirdShadow(dt);    // #183 the hawk over the forest canopy
    updateDecoy(dt);         // #253 MIRAGE
    updateGoose(dt);         // #257 the golden goose
    updateSmokeBanks(dt);    // #184 Wrath's drifting smoke
    updateTurrets(dt);
    updateSummons(dt);
    updateUltFx(dt);
    if (g.playerTaunt.t > 0) { g.playerTaunt.t -= dt; if (g.playerTaunt.src && g.playerTaunt.src.dead) g.playerTaunt.t = 0; }

    // co-op: broadcast our position + smooth the other players; sync monsters;
    // revive downed teammates; end only on a full party wipe
    if (g.coop) {
      broadcastSelf(dt); interpRemotes(dt); reviveNearbyDowned(dt);
      checkStrandedFollow(dt);
      if (g.duelMode) updateDuel(dt); // #240 the duel referee (countdown on both, rounds on the host)
      if (g.huntMode) updateHunt(dt); // #241 the swarm clock + last-champion-standing
      if (isCoopGuest()) { updateGuestMobs(dt); checkHostAlive(); } else { broadcastMobs(dt); broadcastGear(dt); broadcastKeyframe(dt); checkPartyWipe(); }
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
    if (g.roomSettleT > 0) g.roomSettleT -= dt; // #137 post-entry plate settle
    if (g.shopMsg) { g.shopMsg.t -= dt; if (g.shopMsg.t <= 0) g.shopMsg = null; }
    if (g.floorBanner && g.floorBanner.t > 0) g.floorBanner.t -= dt;
    if (g.floorRule && g.floorRule.t > 0) g.floorRule.t -= dt;
    if (g.toadMsg && g.toadMsg.t > 0) g.toadMsg.t -= dt;

    // #161 (Sam) level-ups, evolutions and the ultimate pick WAIT until the room is
    // cleared - they never interrupt an active fight. A non-combat room (shop, treasure,
    // start) has no live mobs, so a pickup-triggered level still opens right away there.
    const roomClear = !g.room || g.room.cleared || !g.monsters.some(m => !m.dead);

    // evolution menus take priority over further level-ups (the pick that
    // triggered the evolution should resolve before the next level-up card)
    if (g.evoQueue.length > 0 && roomClear && p.rollT < 0 && g.winTimer <= 0 && !p.dead) {
      const evo = g.evoQueue.shift();
      const options = Evolutions.optionsForStat(evo.stat, evo.stacks);
      if (options) { // guard: an invalid queue entry (dbg typo) must never soft-lock
        beginLevelCycle();
        g.evoChoices = { stat: evo.stat, stacks: evo.stacks, options };
        g.hoverChoice = -1;
        g.state = 'evolution';
        g.overlayT = 0;
        p.drawT = -1;
        Sfx.play('mimic'); // something stirs in you
        return;
      }
    }
    // #199 (Sam) LEVEL-UPS NO LONGER PAUSE THE GAME. Each level banks a POINT you
    // spend in the character menu (C) whenever you like. This removes the mid-fight
    // freeze AND the whole family of co-op desyncs the pick screens caused (a frozen
    // picker vanishing, gates stranding the party, fusion desyncs). Evolutions and
    // the ultimate offer keep their own screens - they are rare, big moments.
    // offer the ULTIMATE on its own beat, a couple levels AFTER R was forged (never
    // simultaneously - Sam: avoid information overload). #10 the 3 picks are now WEIGHTED
    // toward your build (evolution history + Q/R kinds), so the offer feels like yours.
    if (p.abilityR && !p.abilityUlt && p.ultAtLevel && p.level >= p.ultAtLevel &&
        !g.ultChoices && g.evoQueue.length === 0 && // #199 unspent points don't delay the ult offer
        roomClear && p.rollT < 0 && g.winTimer <= 0 && !p.dead) {
      g.ultChoices = Abilities.rollUltimates(3, {
        evo: p.evoHistory || [],
        qKind: p.ability && p.ability.kind,
        rKind: p.abilityR && p.abilityR.kind,
      });
      g.hoverChoice = -1; g.state = 'ultpick'; g.overlayT = 0;
      p.drawT = -1; p.ultAtLevel = 0;
      Sfx.play('roar');
      return;
    }
    // #32 co-op: once the whole pick sequence is drained, don't slip back into play
    // alone - hold at the gate until every teammate has also finished choosing
    if (g.coop && g.leveling && g.evoQueue.length === 0 && // #199 points spend at leisure, never gate the party
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
    if (typeof Net !== 'undefined' && Net.connected) Net.sendR({ t: 'lvlbusy' });
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
  // #236 the floor advance a mid-pick player deferred: applied by updatePlay the
  // moment their pick closes (also reachable straight from the 'floor' handler)
  function applyFloorMsg(m) {
    releaseLevelGate(); g.leveling = false;
    g.floorNum = m.floor; g.coopSeed = m.seed; g.nightmareNext = !!m.nm;
    startFloor(); g.state = 'play';
  }
  function finishLevelCycle() {
    g.leveling = false;
    if (typeof Net === 'undefined' || !Net.connected) { g.state = 'play'; return; }
    Net.sendR({ t: 'lvldone' }); // exactly one done per busy - WebSocket/TCP is reliable+ordered
    // #236 (Sam: "whole game got paused because a player was choosing") the LEVELWAIT
    // hold is GONE - finish your pick, play on. A teammate still choosing is safe
    // (menus already drop incoming damage) and wears the CHOOSING tag so their frozen
    // champion reads as deliberate. The 'levelwait' state remains only as dead code.
    g.state = 'play';
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
    if (ch.fx) {
      p.applyEvolution(ch.fx); // new feeder cards use engine-consumed fx fields
    } else switch (ch.key) {
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
    p.upgradeStacks[ch.key] = (p.upgradeStacks[ch.key] || 0) + 1; // per-card (body-part visuals)
    // #stat-redesign: EVOLUTION triggers on the base STAT this card governs, so any
    // mix of a stat's feeder cards (3/6/9/12 total) opens that stat's evolution.
    const stat = ch.stat || Evolutions.STAT_SCHOOL[ch.key];
    p.statPoints[stat] = (p.statPoints[stat] || 0) + 1;
    const sp = p.statPoints[stat];
    if (Evolutions.TIER_LABEL[sp]) g.evoQueue.push({ stat, stacks: sp });
    Sfx.play('upgrade');
    g.state = 'play';
  }

  function applyEvolutionChoice(opt) {
    const p = g.player;
    // #86 record the base stat + tier reached (stacks 3/6/9/12 -> tier 1-4)
    if (typeof Ach !== 'undefined' && g.evoChoices) Ach.evolve(g.evoChoices.stat, Math.round((g.evoChoices.stacks || 3) / 3), g);
    p.applyEvolution(opt.fx);
    // #stat-redesign: the chosen option carries statKey = its origin sub-stat tree,
    // so evoTaken + R-fusion keep receiving valid fine-grained keys (dmg/crit/...).
    p.evoTaken.push({ key: opt.statKey, name: opt.name, tier: Evolutions.TIER_LABEL[g.evoChoices.stacks] });
    p.recordEvoPick(opt.statKey, g.evoChoices && g.evoChoices.stat); // first two picks fuse into the R ability (#252: base stat rides along)
    Sfx.play('levelup');
    Fx.text(p.x, p.y - 34, opt.name.toUpperCase(), '#b88aff', 14);
    Fx.burst(p.x, p.y, ['#b88aff', '#ffd24c', '#fff'], 26, { speed: 200, life: 0.8, glow: true });
    g.evoChoices = null;
    // #84 the 2nd evolution FORGES R - offer three candidates to choose from (like the
    // ultimate) instead of auto-assigning. The ultimate is offered a couple levels later.
    if (p.evoHistory.length === 2 && !p.abilityR) {
      g.rChoices = Abilities.rOptions(p.evoHistory, p.evoSchools);
      g.hoverChoice = -1; g.state = 'rpick'; g.overlayT = 0;
      p.drawT = -1; Sfx.play('roar');
      return;
    }
    g.state = 'play';
  }

  function applyRChoice(r) {
    const p = g.player;
    p.abilityR = Object.assign({ cd: 0 }, r);
    p.ultAtLevel = p.level + 2; // the ultimate is offered a couple levels after R lands
    g.rChoices = null;
    Sfx.play('levelup');
    Fx.text(p.x, p.y - 40, `R: ${r.name.toUpperCase()}`, r.color, 15);
    Fx.burst(p.x, p.y, [r.color, '#fff', '#ffd24c'], 30, { speed: 220, life: 0.8, glow: true });
    g.state = 'play';
  }

  function updateRPick() {
    const opts = g.rChoices, n = opts.length;
    if (g.hoverChoice < 0) g.hoverChoice = 0;
    if (input.pressed('KeyA') || input.pressed('ArrowLeft')) { g.hoverChoice = (g.hoverChoice + n - 1) % n; Sfx.play('ui'); }
    if (input.pressed('KeyD') || input.pressed('ArrowRight')) { g.hoverChoice = (g.hoverChoice + 1) % n; Sfx.play('ui'); }
    for (const r of g.uiRects) {
      const over = input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h;
      if (!over) continue;
      if (input.mouse.moved) g.hoverChoice = r.idx;
      if (input.mouse.clicked) { applyRChoice(opts[r.idx]); return; }
    }
    if ((input.pressed('Space') || input.pressed('Enter')) && opts[g.hoverChoice]) { applyRChoice(opts[g.hoverChoice]); return; }
    if (input.pressed('Digit1') && opts[0]) { applyRChoice(opts[0]); return; }
    if (input.pressed('Digit2') && opts[1]) { applyRChoice(opts[1]); return; }
    if (input.pressed('Digit3') && opts[2]) { applyRChoice(opts[2]); return; }
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

  // #85 peek the character sheet from a level-up / evolution / ultimate pick; the
  // charsheet close handler restores g.charReturn so you land back on the same pick
  function peekCharSheet() {
    if (input.pressed('KeyC')) { g.charReturn = g.state; g.state = 'charsheet'; g.overlayT = 0; return true; }
    return false;
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

  function updateLevelUp(dt) {
    if (g.rerollDenyT > 0) g.rerollDenyT -= (dt || 0);
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
        if (input.mouse.clicked) { rerollLevelChoices(); return; }
        continue;
      }
      if (input.mouse.moved) g.hoverChoice = r.idx;
      if (input.mouse.clicked) { applyUpgrade(g.levelChoices[r.idx]); return; }
    }
    if ((input.pressed('Space') || input.pressed('Enter')) && g.levelChoices[g.hoverChoice]) { applyUpgrade(g.levelChoices[g.hoverChoice]); return; }
    if (input.pressed('Digit1') && g.levelChoices[0]) { applyUpgrade(g.levelChoices[0]); return; }
    if (input.pressed('Digit2') && g.levelChoices[1]) { applyUpgrade(g.levelChoices[1]); return; }
    if (input.pressed('Digit3') && g.levelChoices[2]) { applyUpgrade(g.levelChoices[2]); return; }
    // continuous paid reroll (R or the button): 10g, then +1g each time this run
    if (input.pressed('KeyR')) rerollLevelChoices();
  }

  function rerollCost() { return 10 + (g.rerollCount || 0); }

  function rerollLevelChoices() {
    const p = g.player, cost = rerollCost();
    if (!p || p.coins < cost) { Sfx.play('error'); g.rerollDenyT = 0.6; return; }
    p.coins -= cost;
    g.rerollCount = (g.rerollCount || 0) + 1;
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

  // #89 ENCHANT TABLE (reworked): a popup offering 3 random enchants; the player
  // REPLACES one of the equipped weapon's existing enchants with a chosen offer.
  // Cost scales with the offer's quality (tier/level). Each attempt carries a 0.5%
  // chance the weapon SHATTERS - a deliberately dramatic, unlucky moment.
  function enchantCost(offer) {
    return { gold: 40 + 35 * offer.tier + 10 * (offer.level || 0), shards: 1 + offer.tier };
  }
  function openEnchantTable(et) {
    const p = g.player, w = p.weapon;
    if (!w || w.isArmor) { g.shopMsg = { text: 'No weapon to enchant', t: 1.4 }; Sfx.play('error'); return; }
    if (!w.enchants || w.enchants.length === 0) { g.shopMsg = { text: 'This weapon has no enchant slots to replace', t: 2 }; Sfx.play('error'); return; }
    const offers = Weapons.rollEnchantOffers(w, 3);
    if (!offers.length) { g.shopMsg = { text: 'No new enchants suit this weapon', t: 2 }; Sfx.play('error'); return; }
    g.enchant = { et, offers, slotSel: -1, offerSel: -1, msg: '', breakT: 0, broke: false };
    g.state = 'enchantpick'; g.overlayT = 0; p.drawT = -1; Sfx.play('ui');
  }
  function updateEnchantPick() {
    const e = g.enchant;
    if (!e) { g.state = 'play'; return; }
    if (e.breakT > 0) { // the shatter drama plays out, then we bail to the room
      e.breakT -= 1 / 60;
      if (e.breakT <= 0) { g.enchant = null; g.state = 'play'; }
      return;
    }
    if (input.pressed('Escape') || input.pressed('KeyE')) { g.enchant = null; g.state = 'play'; Sfx.play('ui'); return; }
    if (input.mouse.clicked) {
      for (const r of g.uiRects) {
        if (!(input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h)) continue;
        if (r.action === 'ench-offer') { e.offerSel = r.idx; e.msg = ''; Sfx.play('ui'); }
        else if (r.action === 'ench-slot') { e.slotSel = r.idx; e.msg = ''; Sfx.play('ui'); }
        else if (r.action === 'ench-confirm') enchantAttempt();
        else if (r.action === 'ench-exit') { g.enchant = null; g.state = 'play'; Sfx.play('ui'); }
        return;
      }
    }
  }
  function enchantAttempt() {
    const e = g.enchant, p = g.player, w = p.weapon;
    if (!w || e.offerSel < 0 || e.slotSel < 0) { e.msg = 'Pick an enchant AND a slot to replace'; Sfx.play('error'); return; }
    const offer = e.offers[e.offerSel];
    const cost = enchantCost(offer);
    if (p.coins < cost.gold || p.shards < cost.shards) { e.msg = `Need ${cost.gold}g + ${cost.shards} shards`; Sfx.play('error'); return; }
    p.coins -= cost.gold; p.shards -= cost.shards;
    // 0.5% catastrophic failure: the weapon shatters on the table
    if (Math.random() < 0.005) { breakWeapon(w); return; }
    // success: overwrite the chosen slot with the offered enchant
    w.enchants[e.slotSel] = { key: offer.key, name: offer.name, tier: offer.tier, desc: offer.desc, level: offer.level || 0 };
    Weapons.applyEnchantStats(w);
    Sfx.play('upgrade');
    Fx.burst(p.x, p.y, ['#b06bff', '#ffd24c', '#fff'], 24, { speed: 180, life: 0.6, glow: true });
    Fx.text(p.x, p.y - 30, offer.name.toUpperCase() + ' APPLIED', '#b06bff', 14);
    if (typeof Ach !== 'undefined') Ach.flag('enchanted', g);
    // fresh offers for another go (same weapon, now with one fewer free enchant)
    e.offers = Weapons.rollEnchantOffers(w, 3);
    e.offerSel = -1;
    e.msg = e.offers.length ? 'Enchanted! ' + Weapons.displayName(w) : 'No more new enchants suit this weapon';
  }
  function breakWeapon(w) {
    const e = g.enchant, p = g.player;
    // remove the shattered weapon; keep the player armed (other slot, or a crude backup)
    if (p.weapons.a === w) p.weapons.a = null;
    if (p.weapons.b === w) p.weapons.b = null;
    if (!p.weapons[p.slot]) p.slot = p.weapons.a ? 'a' : 'b';
    if (!p.weapons.a && !p.weapons.b) {
      p.weapons.a = Weapons.rollWeapon(Math.max(1, g.floorNum), { exactRarity: 0, archetype: w.archetype });
      p.slot = 'a';
    }
    e.breakT = 2.8; e.broke = true; e.brokeName = Weapons.displayName(w);
    Fx.shake(16, 0.7); Fx.hitstop(0.12);
    Sfx.play('explode'); Sfx.play('error');
    Fx.burst(p.x, p.y, ['#1a1a1a', '#3a3a3a', '#e05555', '#000'], 70, { speed: 380, life: 1.1, grav: 180 });
    Fx.text(p.x, p.y - 40, 'SHATTERED', '#e05555', 26);
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
    // #194 (Sam, live playtest) co-op PLAY AGAIN keeps the party TOGETHER: same room,
    // fresh shared seed, everyone pulled straight into the new run. Whoever presses it
    // becomes the new pinned host (exactly like pressing START in the lobby). Escape
    // still leaves the party for the title screen.
    const clickedAgain = input.mouse.clicked && (g.uiRects || []).some(r =>
      r.action === 'again' && input.mouse.x > r.x && input.mouse.x < r.x + r.w && input.mouse.y > r.y && input.mouse.y < r.y + r.h);
    if ((input.pressed('Enter') || clickedAgain) && g.coop && typeof Net !== 'undefined' && Net.connected) {
      const seed = (Math.random() * 1e9) | 0;
      Net.sendR({ t: 'start', seed, hu: g.clientId });
      startCoop(seed, g.clientId);
      return;
    }
    // solo, or the connection died: the old drop-and-restart behavior
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
    const _worms = g.monsters.filter(w => !w.dead && w.type === 'worm' && w.bodySegs); // #262 hoisted once per frame
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
      // #134 ZENO'S ARROW: to reach you, the arrow must first come half way. An enemy
      // shot inside 150px of you crawls toward half speed - which does not STOP it, it
      // just gives you the time to not be standing there. Your own shots are untouched.
      let zeno = 1;
      if (pr.from === 'enemy' && p && p.trinketFlag('zeno')) {
        const d = Math.hypot(pr.x - p.x, pr.y - p.y);
        if (d < 150) zeno = 0.5 + 0.5 * (d / 150);   // 1.0 at the edge, 0.5 point-blank
      }
      pr.x += pr.vx * dt * zeno; pr.y += pr.vy * dt * zeno;
      pr.life -= dt;
      // #262 perf: trail emission is TIME-based now (fps-independent, same density
      // as the old 60fps behavior: homing 60/s, enchant trails ~51/s)
      pr._trailT = (pr._trailT || 0) + dt;
      if (pr.homing !== undefined && pr._trailT >= 1 / 60) { pr._trailT = 0; Fx.burst(pr.x, pr.y, [pr.color, '#fff'], 1, { speed: 12, life: 0.25, glow: true, size: 2 }); }
      // enchant trail on player arrows (fire streaks behind a Flame arrow, etc.)
      else if (pr.trail && pr._trailT >= 0.0196) {
        pr._trailT = 0;
        Fx.burst(pr.x, pr.y, pr.trail, 1, { speed: 18, life: 0.22, glow: pr.glowTrail, size: 2.2 });
      }
      let dead = pr.life <= 0 ||
        pr.x < PF.x - 10 || pr.x > PF.x + PF.w + 10 || pr.y < PF.y - 10 || pr.y > PF.y + PF.h + 10;

      // obstacle hits (pits are just holes in the floor - projectiles sail over them)
      if (!dead) for (const o of g.room.obstacles) {
        // (worm hoist for this frame lives just above the projectile loop - #262)
        if (o.kind === 'pit') continue;
        if (Math.hypot(pr.x - o.x, pr.y - o.y) < o.r + pr.r) { dead = true; break; }
      }
      // #67b solid wall rects stop projectiles too
      if (!dead && g.room.walls) for (const w of g.room.walls) {
        if (pr.x > w.x - pr.r && pr.x < w.x + w.w + pr.r && pr.y > w.y - pr.r && pr.y < w.y + w.h + pr.r) { dead = true; break; }
      }

      if (!dead && pr.from === 'enemy') {
        if (Math.hypot(pr.x - p.x, pr.y - p.y) < p.r + pr.r) {
          p.damage(pr.dmg, pr.x - pr.vx * 0.01, pr.y - pr.vy * 0.01, g, pr.owner); // #144 thorns bite the shooter
          // #179 (Sam) a glue blob GUMS you up: heavy slow for a couple of seconds
          if (pr.glue) { p.slowT = 2.2; p.slowMul = 0.55; if (typeof Fx !== 'undefined') Fx.text(p.x, p.y - 30, 'GLUED', '#cdbf49', 12); }
          // #182/#238 (Sam) a glass FLASH-bolt: a true FLASHBANG - the screen whites
          // out and sight bleeds back over 2s (render in drawGame)
          if (pr.blind) {
            p.blindT = 2.0;
            if (typeof Fx !== 'undefined') { Fx.text(p.x, p.y - 30, 'FLASHED', '#ffffff', 13); Fx.shake(6, 0.25); }
            Sfx.play('explode');
          }
          // #180 (Sam) an icicle FREEZES you solid for a beat (i-frames stop chain-freezing)
          if (pr.freeze) {
            p.slowT = 0.7; p.slowMul = 0.04; p.frozenFxT = 0.7;
            if (typeof Fx !== 'undefined') { Fx.text(p.x, p.y - 30, 'FROZEN', '#aee7ff', 13); Fx.burst(p.x, p.y, ['#bfefff', '#7fd4ff', '#fff'], 12, { speed: 90, life: 0.4, glow: true }); }
          }
          dead = true;
        } else { // INCIDENTAL: an enemy arrow can catch a mercenary in its flight path
          for (const merc of g.mercs) {
            if (merc.dead) continue;
            if (Math.hypot(pr.x - merc.x, pr.y - merc.y) < 12 + pr.r) { damageMerc(merc, pr.dmg); dead = true; break; }
          }
        }
      } else if (!dead && pr.from === 'player') {
        // #56 worm body segments are INVULNERABLE shields: a shot hitting a segment is
        // blocked (consumed) with no damage, so you must thread shots past the body to
        // the head. The head itself (m.x,m.y) is a normal target below.
        let blocked = false;
        if (_worms.length) for (const w of _worms) { // #262 hoisted: no full monster scan per projectile
          if (w.dead) continue; // a worm can die mid-loop to an earlier projectile
          for (const s of w.bodySegs) { const dx = pr.x - s.x, dy = pr.y - s.y, rr = s.r + pr.r; if (dx * dx + dy * dy < rr * rr) { blocked = true; break; } }
          if (blocked) break;
        }
        if (blocked) { Fx.burst(pr.x, pr.y, ['#8fd0a0', '#cfe8b0'], 5, { speed: 70, life: 0.25 }); g.projectiles.splice(i, 1); continue; }
        for (const m of g.monsters) {
          if (m.dead || m.airborne || (pr.hitSet && pr.hitSet.has(m))) continue; // airborne boss can't eat arrows
          const _dx = pr.x - m.x, _dy = pr.y - m.y, _rr = m.r + pr.r; // #262 squared-distance test
          if (_dx * _dx + _dy * _dy < _rr * _rr) {
            // target-conditional evolution bonuses resolve at impact for arrows
            const P = g.player;
            let dmg = pr.dmg;
            if (pr.qRider) dmg += m.maxHp * pr.qRider * (m.isBoss ? 1 / 3 : 1); // #226 turret shots
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
            else { dead = true; pr._primary = m; break; } // remember the struck target so the blast doesn't double-hit it
          }
        }
        // #224 FRIENDLY FIRE (PVP Phase 0): your shots also test teammates. The attacker
        // resolves the hit against its own lerped view of the peer; the victim applies
        // it through the normal phit -> player.damage path (armor + iframes intact).
        if (!dead && g.friendlyFire && g.coop) {
          for (const t of partyTargets()) {
            if (!t.isRemote) continue;
            if (Math.hypot(pr.x - t.x, pr.y - t.y) < (t.r || 13) + pr.r) {
              hurtTarget(t, pr.dmg, pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02);
              dead = true; break;
            }
          }
        }
      }
      if (dead) {
        // #16 staff fireball: bursts on impact for AOE + burn to nearby monsters
        if (pr.blast && pr.from === 'player') {
          // #49 the burst carries the staff's element to everyone caught in it
          const ec = pr.elem === 'ice' ? ['#7fe0ff', '#bfefff', '#4aa8d8']
                   : pr.elem === 'poison' ? ['#8ef06e', '#bfffa0', '#3aa83a']
                   : pr.elem === 'storm' ? ['#ffe27a', '#fff6c0', '#e0b020']
                   : ['#ff8833', '#ffcc44', '#ff4422'];
          Fx.shake(5, 0.2); Sfx.play('explode');
          Fx.burst(pr.x, pr.y, ec, 22, { speed: 230, life: 0.5, glow: true });
          const P = g.player;
          for (const m of g.monsters) {
            if (m.dead || m.airborne || m === pr._primary) continue; // the direct target already ate the full hit
            if (Math.hypot(pr.x - m.x, pr.y - m.y) < pr.blast + m.r) m.takeHit(pr.dmg * 0.8, { sx: pr.x, sy: pr.y, knock: 110, flame: pr.flame, chill: pr.chill, venom: pr.venom, chain: pr.chain, crit: pr.crit, fromPlayer: true, hitSfx: 'hitHeavy' }, g);
          }
          // #224 FRIENDLY FIRE: the fireball's blast catches teammates too (80% like monsters)
          if (g.friendlyFire && g.coop) {
            for (const t of partyTargets()) {
              if (!t.isRemote) continue;
              if (Math.hypot(pr.x - t.x, pr.y - t.y) < pr.blast + (t.r || 13)) hurtTarget(t, pr.dmg * 0.8, pr.x, pr.y);
            }
          }
        }
        if (pr.glue) spawnGluePuddle(pr.x, pr.y); // #179 the blob leaves its sticky mark wherever it ends up
        Fx.burst(pr.x, pr.y, pr.color, 4, { speed: 70, life: 0.25 });
        g.projectiles.splice(i, 1);
      }
    }
  }

  // #27 minelayer: mines arm, then a nearby player trips a short fuse -> blast.
  // Auto-detonate after 7s so they never pile up forever.
  function updateMines(dt) {
    if (isCoopGuest()) return; // #193 a guest's mines are draw-only proxies; the HOST owns arming and blasts
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
    if (g.coop && typeof Net !== 'undefined' && isRunHost()) Net.send({ t: 'boom', x: Math.round(mn.x), y: Math.round(mn.y), r: mn.blastR });
  }

  // #164 (Sam) FALLING STALACTITES: on the underground floors (the Descent), a stalactite
  // shears off the ceiling every few seconds, telegraphed by a growing ground-shadow, then
  // drops and crushes anything standing under it. A dodge hazard, not an instakill.
  // #179 (Sam) GLUE PUDDLES. A glue blob that lands (on you, a wall, or the floor)
  // leaves a sticky amber patch for ~9s. Anything that walks through it is slowed:
  // the party via player.slowT, monsters via their existing chill fields. Mutual
  // hazard - a smart player can kite melee mobs THROUGH the glue.
  function spawnGluePuddle(x, y) {
    if (!g.gluePuddles) g.gluePuddles = [];
    g.gluePuddles.push({ x, y, r: 34, t: 9, max: 9 });
    if (typeof Sfx !== 'undefined') Sfx.play('hitLight');
  }
  function updateGluePuddles(dt) {
    const list = g.gluePuddles; if (!list || !list.length) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const gp = list[i];
      gp.t -= dt;
      if (gp.t <= 0) { list.splice(i, 1); continue; }
      const p = g.player;
      if (p && !p.dead && Math.hypot(p.x - gp.x, p.y - gp.y) < gp.r + p.r * 0.5) {
        p.slowT = Math.max(p.slowT || 0, 0.25); p.slowMul = 0.6; // gentler than a direct hit
      }
      for (const m of g.monsters) {
        if (m.dead || m.airborne || m.isBoss) continue;
        if (Math.hypot(m.x - gp.x, m.y - gp.y) < gp.r + m.r * 0.5) { m.chillT = Math.max(m.chillT || 0, 0.25); m.chillMul = 0.6; }
      }
    }
  }
  function drawGluePuddles(c) {
    const list = g.gluePuddles; if (!list || !list.length) return;
    for (const gp of list) {
      const fade = Math.min(1, gp.t / 1.5); // last 1.5s: dry up
      c.save();
      c.globalAlpha = 0.55 * fade;
      c.fillStyle = '#b9a83e';
      c.beginPath(); c.ellipse(gp.x, gp.y, gp.r, gp.r * 0.62, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 0.35 * fade;
      c.fillStyle = '#e6d76a';
      c.beginPath(); c.ellipse(gp.x - 6, gp.y - 4, gp.r * 0.55, gp.r * 0.32, 0, 0, Math.PI * 2); c.fill();
      // a few fixed sheen dots so it reads sticky, not just a stain
      c.globalAlpha = 0.5 * fade; c.fillStyle = '#f2e9a0';
      c.beginPath(); c.arc(gp.x + gp.r * 0.4, gp.y + 3, 2.2, 0, Math.PI * 2); c.arc(gp.x - gp.r * 0.3, gp.y + 8, 1.7, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }

  // #183 (Sam) the giant bird's shadow: update + draw. It glides in a shallow sine,
  // wings beating slowly, then is gone. Drawn on the floor under all actors.
  // #184 Wrath's smoke banks drift slowly and wrap; drawn OVER the actors so shapes
  // loom in and out of them - completely different feel from Envy's hard circle.
  function updateSmokeBanks(dt) {
    const list = g.smokeBanks; if (!list) return;
    for (const b of list) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.ph += dt * 0.7;
      if (b.x < PF.x - b.r) b.x = PF.x + PF.w + b.r; if (b.x > PF.x + PF.w + b.r) b.x = PF.x - b.r;
      if (b.y < PF.y - b.r) b.y = PF.y + PF.h + b.r; if (b.y > PF.y + PF.h + b.r) b.y = PF.y - b.r;
    }
  }
  function drawSmokeBanks(c) {
    const list = g.smokeBanks; if (!list) return;
    c.save();
    for (const b of list) {
      const wob = 1 + Math.sin(b.ph) * 0.12;
      const grad = c.createRadialGradient(b.x, b.y, b.r * 0.15, b.x, b.y, b.r * wob);
      grad.addColorStop(0, 'rgba(16,14,12,0.42)');
      grad.addColorStop(0.7, 'rgba(20,17,14,0.30)');
      grad.addColorStop(1, 'rgba(20,17,14,0)');
      c.fillStyle = grad;
      c.beginPath(); c.arc(b.x, b.y, b.r * wob, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  // #253 MIRAGE: monsters chip the double on contact; empty or expired, it detonates
  function updateDecoy(dt) {
    const d = g.decoy; if (!d || d.dead) return;
    d.t -= dt;
    for (const m of g.monsters) {
      if (m.dead || m.spawnT > 0) continue;
      if (Math.hypot(m.x - d.x, m.y - d.y) < m.r + d.r + 6) d.hp -= 30 * dt;
    }
    if (d.t <= 0 || d.hp <= 0) {
      d.dead = true; g.decoy = null;
      for (const m of g.monsters) {
        if (m.dead || m.airborne || m.spawnT > 0) continue;
        if (Math.hypot(m.x - d.x, m.y - d.y) > 150 + m.r) continue;
        m.takeHit(d.boom + m.maxHp * d.rider * (m.isBoss ? 1 / 3 : 1), { sx: d.x, sy: d.y, knock: 220, fromPlayer: true, hitSfx: 'hitHeavy' }, g);
      }
      Fx.burst(d.x, d.y, [d.color, '#fff'], 34, { speed: 320, life: 0.6, glow: true });
      Fx.shake(5, 0.2);
    }
  }
  // #257 GOLDEN GOOSE: waddles after you laying gold; monsters can kill it, and
  // its death is a payout. Expiry = it flies away, no burst.
  function updateGoose(dt) {
    const gs = g.goose; if (!gs || gs.dead) return;
    const p = g.player;
    gs.t -= dt; gs.bob += dt * 6;
    const tx = p.x - Math.cos(p.facing) * 30, ty = p.y - Math.sin(p.facing) * 30 + 8;
    const k = 1 - Math.pow(0.02, dt);
    gs.x += (tx - gs.x) * k; gs.y += (ty - gs.y) * k;
    gs.layT -= dt;
    if (gs.layT <= 0) { gs.layT = 1.0; spawnPickup('coin', gs.x, gs.y); Fx.text(gs.x, gs.y - 16, 'honk', '#ffe08a', 9); }
    for (const m of g.monsters) {
      if (m.dead || m.spawnT > 0) continue;
      if (Math.hypot(m.x - gs.x, m.y - gs.y) < m.r + gs.r + 4) gs.hp -= 26 * dt;
    }
    if (gs.hp <= 0) { // the payout: a dead goose is a pile of gold
      gs.dead = true; g.goose = null;
      if (g.player.fstance && g.player.fstance.id === 'goldengoose') g.player.fstance = null;
      for (let i = 0; i < 15; i++) spawnPickup('coin', gs.x, gs.y);
      Fx.text(gs.x, gs.y - 18, 'THE GOOSE!', '#ffe08a', 14);
      Fx.burst(gs.x, gs.y, ['#ffe08a', '#ffd24c', '#fff'], 26, { speed: 240, life: 0.7, glow: true });
      Sfx.play('hitHeavy');
    } else if (gs.t <= 0) { // time up: it flies off, keeping its unlaid eggs
      gs.dead = true; g.goose = null;
      if (g.player.fstance && g.player.fstance.id === 'goldengoose') g.player.fstance = null;
      Fx.burst(gs.x, gs.y, ['#ffe08a', '#fff'], 14, { speed: 120, life: 0.5 });
    }
  }
  function drawGoose(c) {
    const gs = g.goose; if (!gs || gs.dead) return;
    const bob = Math.sin(gs.bob) * 1.5;
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(gs.x, gs.y + 8, 9, 3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd24c';
    c.beginPath(); c.ellipse(gs.x, gs.y + bob, 9, 7, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(gs.x + 7, gs.y - 7 + bob, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff8a3d';
    c.beginPath(); c.moveTo(gs.x + 10, gs.y - 8 + bob); c.lineTo(gs.x + 15, gs.y - 6 + bob); c.lineTo(gs.x + 10, gs.y - 5 + bob); c.closePath(); c.fill();
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.arc(gs.x + 8, gs.y - 8 + bob, 1, 0, Math.PI * 2); c.fill();
    if (gs.hp < gs.maxHp) {
      c.fillStyle = '#3a0f0f'; c.fillRect(gs.x - 9, gs.y - 16, 18, 3);
      c.fillStyle = '#ffe08a'; c.fillRect(gs.x - 9, gs.y - 16, 18 * Math.max(0, gs.hp / gs.maxHp), 3);
    }
    c.restore();
  }
  function drawDecoy(c) {
    const d = g.decoy; if (!d || d.dead) return;
    c.save();
    c.globalAlpha = 0.55 + Math.sin(Date.now() / 120) * 0.2;
    c.strokeStyle = d.color; c.lineWidth = 2;
    c.beginPath(); c.arc(d.x, d.y, d.r, 0, Math.PI * 2); c.stroke();
    c.fillStyle = d.color; c.globalAlpha *= 0.4;
    c.beginPath(); c.arc(d.x, d.y, d.r * 0.7, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function updateBirdShadow(dt) {
    if (!g.birdShadow) return;
    g.birdShadow.t += dt;
    if (g.birdShadow.t >= g.birdShadow.dur) g.birdShadow = null;
  }
  function drawBirdShadow(c) {
    const b = g.birdShadow; if (!b) return;
    const k = b.t / b.dur;
    const x = b.fromLeft ? (PF.x - 140 + (PF.w + 280) * k) : (PF.x + PF.w + 140 - (PF.w + 280) * k);
    const y = b.y + Math.sin(k * Math.PI * 2) * 26;
    // #251 (Sam: "it looks like a butterfly and everyone is asking") a RAPTOR now:
    // the old wings were two fat ellipses - four round lobes, i.e. a butterfly. An
    // eagle from below is the opposite shape: long THIN swept wings with fingered
    // primaries, a small body, a wedge of tail. Mostly gliding, the beat is slow.
    const flap = Math.sin(b.t * 2.6);
    const fade = Math.min(1, Math.min(k, 1 - k) * 5); // ease in/out at the edges
    c.save();
    c.translate(x, y);
    if (!b.fromLeft) c.scale(-1, 1);
    c.globalAlpha = 0.30 * fade;
    c.fillStyle = '#0a0f08';
    // body
    c.beginPath(); c.ellipse(0, 0, 22, 6.5, 0, 0, Math.PI * 2); c.fill();
    // head + hooked beak
    c.beginPath(); c.arc(23, 0, 5.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(27, -2); c.quadraticCurveTo(36, 0, 27, 4); c.closePath(); c.fill();
    // wedge tail
    c.beginPath(); c.moveTo(-18, 0); c.lineTo(-38, -6); c.lineTo(-33, 0); c.lineTo(-38, 6); c.closePath(); c.fill();
    // wings: thin swept blades, four finger feathers at each tip
    const wr = 56 + flap * 9;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(6, side * 4);
      c.quadraticCurveTo(-4, side * wr * 0.55, -12, side * wr);
      c.lineTo(-18, side * (wr - 4)); c.lineTo(-14, side * (wr - 9));
      c.lineTo(-21, side * (wr - 12)); c.lineTo(-16, side * (wr - 17));
      c.lineTo(-24, side * (wr - 20));
      c.quadraticCurveTo(-14, side * wr * 0.35, -11, side * 4);
      c.closePath(); c.fill();
    }
    c.restore();
  }

  function updateStalactites(dt) {
    if (typeof Descent === 'undefined' || !Descent.isDescent(g.floorNum)) { if (g.stalactites) g.stalactites.length = 0; return; }
    g.stalactites = g.stalactites || [];
    g.stalT = (g.stalT || 0) - dt;
    if (g.stalT <= 0 && g.state === 'play' && g.player && !g.player.dead) {
      g.stalT = 2.6 + Math.random() * 2.4;
      const p = g.player, nearP = Math.random() < 0.55;
      let x = nearP ? p.x + (Math.random() * 180 - 90) : PF.x + 40 + Math.random() * (PF.w - 80);
      let y = nearP ? p.y + (Math.random() * 180 - 90) : PF.y + 40 + Math.random() * (PF.h - 80);
      x = Math.max(PF.x + 22, Math.min(PF.x + PF.w - 22, x));
      y = Math.max(PF.y + 22, Math.min(PF.y + PF.h - 22, y));
      g.stalactites.push({ x, y, t: 0, fell: false, boom: 0 });
    }
    const DMG = Math.round(14 + g.floorNum * 1.6), DELAY = 1.15, R = 38;
    for (let i = g.stalactites.length - 1; i >= 0; i--) {
      const s = g.stalactites[i];
      s.t += dt;
      if (!s.fell && s.t >= DELAY) {
        s.fell = true;
        Fx.shake(5, 0.22); Sfx.play('explode');
        Fx.burst(s.x, s.y, ['#7a6a5a', '#3a2a1a', '#aaa'], 20, { speed: 240, life: 0.5, grav: 320 });
        for (const t of g.partyTargets()) if (Math.hypot(t.x - s.x, t.y - s.y) < R + t.r) g.hurtTarget(t, DMG, s.x, s.y, null);
      }
      if (s.fell && (s.boom += dt) >= 0.4) g.stalactites.splice(i, 1);
    }
  }
  function drawStalactites(c) {
    for (const s of (g.stalactites || [])) {
      if (!s.fell) {
        const k = Math.min(1, s.t / 1.15);
        c.fillStyle = `rgba(0,0,0,${0.14 + 0.34 * k})`;
        c.beginPath(); c.ellipse(s.x, s.y, 8 + 14 * k, 4 + 7 * k, 0, 0, Math.PI * 2); c.fill();
        const rockY = s.y - (1 - k) * 300;
        c.fillStyle = '#4a3a28'; c.beginPath();
        c.moveTo(s.x, rockY + 18); c.lineTo(s.x - 10, rockY - 10); c.lineTo(s.x + 10, rockY - 10); c.closePath(); c.fill();
        c.fillStyle = '#6a5a48'; c.beginPath();
        c.moveTo(s.x, rockY + 8); c.lineTo(s.x - 5, rockY - 4); c.lineTo(s.x + 5, rockY - 4); c.closePath(); c.fill();
      } else {
        const b = Math.min(1, s.boom / 0.4);
        c.strokeStyle = `rgba(140,120,100,${0.6 * (1 - b)})`; c.lineWidth = 3 * (1 - b) + 1;
        c.beginPath(); c.arc(s.x, s.y, 16 + 26 * b, 0, Math.PI * 2); c.stroke();
      }
    }
  }

  // ULTIMATE room-effects (meteor / lightning storm / poison cloud / caltrops)
  function updateUltFx(dt) {
    if (g.midasT > 0) g.midasT -= dt;
    // #230 WITHER wears off: restore a monster's strength when it leaves the miasma
    for (const m of g.monsters) {
      if (m._wT > 0) { m._wT -= dt; if (m._wT <= 0 && m._wBase) { m.dmg = m._wBase; m._wBase = null; } }
    }
    if (g.ultFlash && g.ultFlash.t > 0) g.ultFlash.t -= dt; // #10 fade the ult-cast flash
    for (let i = g.ultFx.length - 1; i >= 0; i--) {
      const e = g.ultFx[i];
      e.t += dt;
      if (e.type === 'reel') {           // #258 the Gambler's slot reel
        if (e.t >= e.dur) { g.ultFx.splice(i, 1); continue; }
        e.x = g.player.x; e.y = g.player.y - 46; // it rides over your head
        continue;
      }
      if (e.type === 'qregen') {         // #230 cleric R8: consecrated ground
        if (e.t >= e.dur) { g.ultFx.splice(i, 1); continue; }
        const p2 = g.player;
        if (p2 && !p2.dead && Math.hypot(p2.x - e.x, p2.y - e.y) < e.radius) p2.heal((e.hps || 2) * dt, true);
        continue;
      }
      if (e.type === 'miasma') {         // #230 death knight: the rot cloud
        if (e.follow) { e.x = g.player.x; e.y = g.player.y; }
        if (e.t >= e.dur) { g.ultFx.splice(i, 1); continue; }
        if (Math.floor(e.t / 0.5) !== Math.floor((e.t - dt) / 0.5)) {
          for (const m of g.monsters) {
            if (m.dead || m.spawnT > 0) continue;
            if (Math.hypot(m.x - e.x, m.y - e.y) > e.radius + m.r) continue;
            m.poison = { t: 1.4, dps: e.dps + (e.rider ? m.maxHp * e.rider * (m.isBoss ? 1 / 3 : 1) : 0), tick: m.poison ? m.poison.tick : 0 };
            if (e.rise) m._dkRise = 1;   // a poison death rises for the DK (onKill)
            if (!m._wBase) { m._wBase = m.dmg; m.dmg = Math.max(1, Math.round(m.dmg * 0.8)); } // WITHER
            m._wT = 0.8;
          }
        }
        if (e.regen) { // R8: the rot feeds you while anything is withering in it
          let rotting = 0;
          for (const m of g.monsters) if (!m.dead && m._wT > 0) rotting++;
          if (rotting > 0 && g.player && !g.player.dead) g.player.heal(3 * dt, true);
        }
        continue;
      }
      if (e.type === 'qslow') {          // #229 mage R4: a lingering slow field
        if (e.t < e.dur) {
          for (const m of g.monsters) { if (m.dead) continue; if (Math.hypot(m.x - e.x, m.y - e.y) < e.radius + m.r) { m.chillT = Math.max(m.chillT || 0, 0.3); m.chillMul = 0.45; } }
        } else g.ultFx.splice(i, 1);
        continue;
      }
      if (e.type === 'qpulse') {         // #229 mage R8: the aftershock
        if (e.t >= e.delay) {
          Fx.burst(e.x, e.y, [e.color || '#b06bff', '#fff'], 24, { speed: 260, life: 0.4, glow: true });
          Fx.shake(4, 0.15); Sfx.play('heavy');
          for (const m of g.monsters) {
            if (m.dead || m.airborne || m.spawnT > 0) continue;
            if (Math.hypot(m.x - e.x, m.y - e.y) < e.radius + m.r) m.takeHit(e.dmg + (e.rider ? m.maxHp * e.rider * (m.isBoss ? 1 / 3 : 1) : 0), { sx: e.x, sy: e.y, knock: 90, fromPlayer: true, hitSfx: 'hitLight' }, g);
          }
          g.ultFx.splice(i, 1);
        }
        continue;
      }
      if (e.type === 'meteor') {
        // #145 (Sam) COLOSSAL meteor: on impact, land the blast once, then keep the fx
        // alive a beat as an expanding shockwave ring + fireball (drawUltFx reads e.boom).
        if (!e.boom && e.t >= e.delay) {
          e.boom = 0;                                   // seconds since impact
          Fx.shake(18, 0.55); Sfx.play('explode');
          Fx.burst(e.x, e.y, ['#ff8a3d', '#ffcc44', '#fff'], 110, { speed: 460, life: 0.75, glow: true, size: 4 });
          Fx.burst(e.x, e.y, ['#5a3520', '#7a4a28'], 30, { speed: 260, life: 0.9, grav: 420, size: 3 }); // debris
          for (const m of [...g.monsters]) { if (m.dead || m.airborne || m.spawnT > 0) continue; if (Math.hypot(m.x - e.x, m.y - e.y) < e.radius + m.r) m.takeHit(e.dmg, { sx: e.x, sy: e.y, knock: 340, crit: true, fromPlayer: true, hitSfx: 'hitHeavy' }, g); }
        }
        if (e.boom !== undefined) {
          e.boom += dt;
          if (e.boom >= 0.5) g.ultFx.splice(i, 1);      // shockwave finishes, then clear
        }
      } else if (e.type === 'lob') {
        // #209 first tick on the HOST: mirror the telegraph to guests (visual-only copy,
        // dmg 0 - the real damage reaches remote players via the party blast's phit)
        if (!e._mirrored) {
          e._mirrored = true;
          if (g.coop && typeof Net !== 'undefined' && isRunHost()) {
            Net.send({ t: 'lob', x: Math.round(e.x), y: Math.round(e.y), sx: Math.round(e.sx || e.x), sy: Math.round(e.sy || e.y), d: +(e.delay || 0.9).toFixed(2), rad: e.radius || 48 });
          }
        }
        // #66 an ENEMY lobbed bomb: on landing it blasts the PLAYER + allies, not monsters
        if (e.t >= e.delay) {
          Fx.shake(6, 0.25); Sfx.play('explode');
          Fx.burst(e.x, e.y, ['#ff5a2c', '#ffcc44', '#fff'], 30, { speed: 280, life: 0.5, glow: true });
          // #209 the blast hits the whole PARTY (a remote player gets it via phit).
          // dmg 0 = a guest's visual-only mirror: boom, no bite (a zero hit would
          // still eat a shield charm through damage()).
          if (e.dmg > 0) for (const t of g.partyTargets()) {
            if (Math.hypot(t.x - e.x, t.y - e.y) < e.radius + (t.r || 13)) g.hurtTarget(t, e.dmg, e.x, e.y, null);
          }
          for (const merc of g.mercs) if (!merc.dead && Math.hypot(merc.x - e.x, merc.y - e.y) < e.radius) damageMerc(merc, e.dmg);
          for (const tr of g.turrets) if (!tr.dead && Math.hypot(tr.x - e.x, tr.y - e.y) < e.radius) { tr.hp -= e.dmg; tr.flash = 0.12; }
          if (g.summon && !g.summon.dead && Math.hypot(g.summon.x - e.x, g.summon.y - e.y) < e.radius) g.summon.hp -= e.dmg;
          if (g.summon2 && !g.summon2.dead && Math.hypot(g.summon2.x - e.x, g.summon2.y - e.y) < e.radius) g.summon2.hp -= e.dmg; // #229
          // #113 shrapnel bombs also spray a ring of fragments from the impact point
          if (e.shrapnel) {
            const n = 9;
            for (let k = 0; k < n; k++) {
              const a = k / n * Math.PI * 2 + Math.random() * 0.2;
              g.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, r: 4, dmg: e.shrapDmg || Math.round(e.dmg * 0.6), from: 'enemy', color: '#ff9a3d', life: 1.4, glow: true, hitSet: null });
            }
          }
          g.ultFx.splice(i, 1);
        }
      } else if (e.type === 'storm') {
        e.next -= dt;
        if (e.done < e.strikes && e.next <= 0 && e.t < e.dur) {
          e.next = e.dur / e.strikes;
          const alive = g.monsters.filter(m => !m.dead && !m.airborne && m.spawnT <= 0);
          const tgt = alive.length ? alive[(Math.random() * alive.length) | 0] : null;
          const sx = tgt ? tgt.x : PF.x + 60 + Math.random() * (PF.w - 120);
          const sy = tgt ? tgt.y : PF.y + 60 + Math.random() * (PF.h - 120);
          Fx.burst(sx, sy, ['#ffe27a', '#fff'], 14, { speed: 180, life: 0.35, glow: true });
          Fx.shake(3, 0.12); Sfx.play('crit');
          for (const m of [...g.monsters]) { if (m.dead || m.airborne) continue; if (Math.hypot(m.x - sx, m.y - sy) < 62 + m.r) m.takeHit(e.dmg, { sx, sy, knock: 120, crit: true, fromPlayer: true, hitSfx: 'hitHeavy' }, g); }
          e.done++;
        }
        if (e.t >= e.dur) g.ultFx.splice(i, 1);
      } else if (e.type === 'poison') {
        e.tick -= dt;
        if (e.tick <= 0) {
          e.tick = 0.5;
          for (const m of [...g.monsters]) { if (m.dead || m.airborne) continue; if (Math.hypot(m.x - e.x, m.y - e.y) < 210 + m.r) m.takeHit(e.dps * 0.5, { sx: e.x, sy: e.y, fromPlayer: true, hitSfx: 'hitLight' }, g); } // #165 bigger, deadlier cloud
        }
        if (e.t >= e.dur) g.ultFx.splice(i, 1);
      } else if (e.type === 'caltrops') {
        for (const m of g.monsters) { if (!m.dead) { m.chillT = 0.4; m.chillMul = 0.5; } }
        if (e.t >= e.dur) g.ultFx.splice(i, 1);
      }
    }
  }
  function drawUltFx(c) {
    // #229/#230 the rank-milestone ZONES: translucent breathing circles
    for (const e of g.ultFx) {
      if (e.type === 'reel') {           // #258 three glyphs spin, then the verdict locks
        const SYM = ['\u2694', '\u2665', '\u25cf', '\u2726', '\u27d0'];
        const spin = e.t < 0.55;
        c.save();
        c.font = 'bold 14px monospace'; c.textAlign = 'center';
        for (let k = 0; k < 3; k++) {
          let ch;
          if (spin) ch = SYM[(Math.floor(e.t * 24) + k * 2) % SYM.length];
          else ch = e.win ? '\u27d0' : SYM[(k * 3 + 1) % SYM.length];
          c.globalAlpha = e.t > e.dur - 0.25 ? (e.dur - e.t) / 0.25 : 1;
          c.fillStyle = spin ? '#c8d2e0' : (e.win ? '#ffce54' : '#8a8f9a');
          c.fillText(ch, e.x + (k - 1) * 16, e.y);
        }
        c.restore();
        continue;
      }
      if (e.type === 'qslow' || e.type === 'qregen' || e.type === 'miasma') {
        c.save();
        c.globalAlpha = 0.14 + 0.05 * Math.sin((e.t || 0) * 5);
        c.fillStyle = e.type === 'miasma' ? '#5a7a4a' : (e.type === 'qregen' ? '#8effc0' : '#b06bff');
        c.beginPath(); c.arc(e.x, e.y, e.radius || 100, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 0.45; c.strokeStyle = c.fillStyle; c.lineWidth = 2; c.stroke();
        c.restore();
      }
    }
    for (const e of g.ultFx) {
      if (e.type === 'meteor') {
        if (e.boom !== undefined) {
          // #145 impact: an expanding shockwave ring + a fading fireball out to the full radius
          const b = Math.min(1, e.boom / 0.5);
          c.save();
          c.strokeStyle = `rgba(255,190,90,${0.85 * (1 - b)})`; c.lineWidth = 8 * (1 - b) + 2;
          c.beginPath(); c.arc(e.x, e.y, e.radius * (0.3 + 0.9 * b), 0, Math.PI * 2); c.stroke();
          const grd = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius * (0.5 + 0.5 * b));
          grd.addColorStop(0, `rgba(255,240,200,${0.6 * (1 - b)})`);
          grd.addColorStop(0.5, `rgba(255,138,61,${0.45 * (1 - b)})`);
          grd.addColorStop(1, 'rgba(255,90,44,0)');
          c.fillStyle = grd; c.beginPath(); c.arc(e.x, e.y, e.radius * (0.5 + 0.5 * b), 0, Math.PI * 2); c.fill();
          c.restore();
        } else {
          const k = Math.min(1, e.t / e.delay);
          // telegraph: a pulsing target ring that fills to the true blast radius
          c.strokeStyle = `rgba(255,138,61,${0.4 + 0.4 * Math.abs(Math.sin(g.time * 18))})`; c.lineWidth = 3;
          c.beginPath(); c.arc(e.x, e.y, e.radius * (0.4 + 0.6 * k), 0, Math.PI * 2); c.stroke();
          // a big rock plunging from high up, wrapped in a fiery glow, trailing embers
          const rockY = e.y - (1 - k) * 460;
          const rr = 20 + 8 * k;
          const glow = c.createRadialGradient(e.x, rockY, 0, e.x, rockY, rr * 2.4);
          glow.addColorStop(0, 'rgba(255,200,90,0.9)'); glow.addColorStop(1, 'rgba(255,90,44,0)');
          c.fillStyle = glow; c.beginPath(); c.arc(e.x, rockY, rr * 2.4, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#5a3520'; c.beginPath(); c.arc(e.x, rockY, rr, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#ff8a3d'; c.beginPath(); c.arc(e.x - rr * 0.2, rockY - rr * 0.2, rr * 0.5, 0, Math.PI * 2); c.fill();
          if (k > 0.15) Fx.burst(e.x, rockY + rr, ['#ff8a3d', '#ffcc44'], 2, { speed: 40, life: 0.4, glow: true, vy: -80, size: 3 });
        }
      } else if (e.type === 'lob') {
        // #66 landing telegraph ring + the arcing bomb flying from the lobber to the spot
        const k = Math.min(1, e.t / e.delay);
        c.strokeStyle = `rgba(255,90,44,${0.45 + 0.4 * Math.abs(Math.sin(g.time * 16))})`; c.lineWidth = 2.5;
        c.beginPath(); c.arc(e.x, e.y, e.radius * (0.55 + 0.45 * k), 0, Math.PI * 2); c.stroke();
        // #113 shrapnel bombs show spikes on the landing ring so the player reads the extra threat
        if (e.shrapnel) {
          const rr = e.radius * (0.55 + 0.45 * k);
          c.strokeStyle = `rgba(255,180,80,${0.5 + 0.4 * Math.abs(Math.sin(g.time * 16))})`; c.lineWidth = 2;
          for (let s = 0; s < 9; s++) { const a = s / 9 * Math.PI * 2; c.beginPath(); c.moveTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr); c.lineTo(e.x + Math.cos(a) * (rr + 8), e.y + Math.sin(a) * (rr + 8)); c.stroke(); }
        }
        const bx = (e.sx != null ? e.sx : e.x) + (e.x - (e.sx != null ? e.sx : e.x)) * k;
        const by = (e.sy != null ? e.sy : e.y) + (e.y - (e.sy != null ? e.sy : e.y)) * k - Math.sin(k * Math.PI) * 90;
        c.fillStyle = '#2a1810'; c.beginPath(); c.arc(bx, by, 5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(bx + 1.5, by - 5, 1.8 + Math.random(), 0, Math.PI * 2); c.fill(); // fuse spark
      } else if (e.type === 'poison') {
        c.save(); c.globalAlpha = 0.24 * Math.min(1, (e.dur - e.t) * 1.5); c.fillStyle = e.color;
        c.beginPath(); c.arc(e.x, e.y, 210, 0, Math.PI * 2); c.fill(); c.restore();
      } else if (e.type === 'caltrops') {
        c.fillStyle = e.color;
        for (let s = 0; s < 12; s++) { const a = s * 2.3, rr = 45 + (s % 4) * 40; c.beginPath(); c.arc(PF.x + PF.w / 2 + Math.cos(a) * rr, PF.y + PF.h / 2 + Math.sin(a) * rr * 0.7, 2.5, 0, Math.PI * 2); c.fill(); }
      }
    }
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
      if (pk.kind === 'weapon' || pk.kind === 'armorItem' || pk.kind === 'trinketItem' || pk.kind === 'potionItem') continue; // gear sits still; E to pick up
      // scatter physics then magnet toward the player
      pk.x += (pk.vx || 0) * dt; pk.y += (pk.vy || 0) * dt;
      pk.vx = (pk.vx || 0) * 0.9; pk.vy = (pk.vy || 0) * 0.9;
      const d = Math.hypot(p.x - pk.x, p.y - pk.y) || 1;
      if (pk.vacuum && pk.t > 0.2) {
        // room-clear vacuum: full-room pull, accelerating as it closes in
        const sp = 380 + Math.max(0, 300 - d);
        pk.x += (p.x - pk.x) / d * sp * dt;
        pk.y += (p.y - pk.y) / d * sp * dt;
      } else if (d < 85 && pk.t > 0.25) { // small base grab radius; room-clear vacuum (above) does the real gathering
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
    // #203 rename opened FROM THE TITLE: no run exists, so there is no room to
    // draw behind the overlay - drawing the world here crashed paletteFor(null)
    // every frame and the screen went black. Draw the title underneath instead.
    if (g.state === 'initials' && !g.room) {
      UI.drawTitle(c, g);
      g.uiRects = UI.drawInitials(c, g);
      return;
    }

    const shake = Fx.getShake();
    c.save();
    c.translate(shake.x, shake.y);

    drawRoom(c, g.room);
    if (g.coop) drawDoorPlates(c); // #101 majority-gather plates (on the floor, under actors)
    Fx.drawGhosts(c);

    drawGluePuddles(c);   // #179 glue decals sit on the floor, under everything
    drawBirdShadow(c);    // #183 the shadow sweeps the floor, under all actors
    drawDecoy(c);         // #253 the mirage shimmers among the monsters
    drawGoose(c);         // #257 the goose waddles behind you
    // pickups under actors
    for (const pk of g.pickups) drawPickup(c, pk);
    drawMines(c);
    drawStalactites(c);   // #164 falling stalactites (underground floors)
    drawUltFx(c);

    // actors
    // THE STRANGER WITH AN OFFER. A hooded figure with a lantern; the lantern is the
    // tell, so you can pick them out of a busy room from across it.
    if (g.room.encounter && !g.room.encounter.refused) {
      const e = g.room.encounter;
      const q = Encounters.byKey(e.key);
      const bob = Math.sin(g.time * 2 + e.bob) * 2.5;
      c.save();
      c.translate(e.x, e.y + bob);
      // the lantern glow
      c.save();
      c.globalAlpha = 0.30 + Math.sin(g.time * 3) * 0.07;
      c.fillStyle = '#ffd24c'; c.shadowColor = '#ffd24c'; c.shadowBlur = 20;
      c.beginPath(); c.arc(0, 0, 30, 0, Math.PI * 2); c.fill();
      c.restore();
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.ellipse(0, 15, 12, 5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = e.taken ? '#4a5568' : '#2f3a4c';   // the robe
      c.beginPath();
      c.moveTo(0, -16); c.quadraticCurveTo(13, -6, 11, 14);
      c.lineTo(-11, 14); c.quadraticCurveTo(-13, -6, 0, -16);
      c.closePath(); c.fill();
      c.fillStyle = '#141a24';                          // the hood, and nothing in it
      c.beginPath(); c.arc(0, -13, 8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffd24c';                          // the lantern
      c.beginPath(); c.arc(10, 2, 3.4, 0, Math.PI * 2); c.fill();
      c.restore();
      if (!e.taken) {
        c.font = 'bold 10px monospace'; c.textAlign = 'center'; c.fillStyle = '#ffd24c';
        c.fillText(q ? q.name : 'AN OFFER', e.x, e.y - 30 + bob);
      }
    }

    // THE SMOKE (Wrath's terrace): the bank of bitter black smoke hides everything
    // until it is close. The monster is still there and still coming - you just
    // cannot see it yet. Faded by DISTANCE, not culled, so a shape looms out of it.
    const fadeR = g.rules ? g.rules.fade : Infinity;
    for (const m of g.monsters) {
      if (m.dead) continue;
      if (fadeR !== Infinity) {
        const d = Math.hypot(m.x - g.player.x, m.y - g.player.y);
        const a = Math.max(0, Math.min(1, (fadeR + 60 - d) / 90)); // fully out by fadeR+60
        if (a <= 0.02) continue;
        c.save(); c.globalAlpha = a; m.draw(c, g); c.restore();
        continue;
      }
      m.draw(c, g);
    }
    for (const merc of g.mercs) if (!merc.dead) drawMerc(c, merc);
    for (const tr of g.turrets) if (!tr.dead) drawTurret(c, tr);
    drawSummon(c);
    if (g.coop) drawRemotePlayers(c);
    // #257 (Sam) STANCE AURA: while any fusion stance is live, a colored ring with a
    // draining arc circles the player - fourteen stances instantly legible.
    if (g.player.fstance && g.player.fstance.t > 0 && g.player.fstance.t < 900) {
      const fsr = g.player.fstance;
      const frac = Math.min(1, fsr.t / (fsr.t0 || (fsr.t0 = fsr.t)));
      c.save();
      c.globalAlpha = 0.5 + Math.sin(Date.now() / 160) * 0.15;
      c.strokeStyle = fsr.color || '#ffd24c'; c.lineWidth = 2.5;
      c.beginPath(); c.arc(g.player.x, g.player.y, g.player.r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); c.stroke();
      c.globalAlpha *= 0.35; c.lineWidth = 6;
      c.beginPath(); c.arc(g.player.x, g.player.y, g.player.r + 9, 0, Math.PI * 2); c.stroke();
      c.restore();
    }
    if (g.player.fstance && g.player.fstance.id === 'fortknox') { // #257 the treasury orbits you
      const n = Math.min(8, 2 + (g.player.coins / 100 | 0));
      c.save(); c.fillStyle = '#ffd24c';
      for (let i = 0; i < n; i++) {
        const a2 = Date.now() / 500 + (i / n) * Math.PI * 2;
        c.globalAlpha = 0.85;
        c.beginPath(); c.arc(g.player.x + Math.cos(a2) * (g.player.r + 16), g.player.y + Math.sin(a2) * (g.player.r + 16) * 0.6, 3, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
    if (g.player.fstance && g.player.fstance.t >= 900) { // the Stone: no timer, just the glow
      c.save();
      c.globalAlpha = 0.45 + Math.sin(Date.now() / 200) * 0.15;
      c.strokeStyle = g.player.fstance.color || '#c9a86a'; c.lineWidth = 3;
      c.beginPath(); c.arc(g.player.x, g.player.y, g.player.r + 9, 0, Math.PI * 2); c.stroke();
      c.restore();
    }
    g.player.draw(c, g);

    // projectiles on top. #106 ENEMY fire (pr.from==='enemy') gets a dark outline and
    // a white core pip so it can NEVER be confused with the player's own shots or the
    // floor - this is what disambiguates the gold King coins from gold crit arrows, and
    // the ember-Warden bullets from the fire background.
    for (const pr of g.projectiles) {
      c.save();
      const enemy = pr.from === 'enemy';
      if (pr.glow) { c.shadowColor = pr.color; c.shadowBlur = 10; }
      c.fillStyle = pr.color;
      if (pr.arrow) {
        c.translate(pr.x, pr.y);
        c.rotate(Math.atan2(pr.vy, pr.vx));
        if (enemy) { // dark backing arrow behind the colored one
          c.shadowBlur = 0; c.fillStyle = 'rgba(18,9,4,0.95)';
          c.fillRect(-9, -2.6, 16, 5.2); c.beginPath(); c.moveTo(6, -5.2); c.lineTo(12.4, 0); c.lineTo(6, 5.2); c.fill();
          c.fillStyle = pr.color;
        }
        c.fillRect(-8, -1.5, 14, 3);
        c.beginPath(); c.moveTo(6, -4); c.lineTo(11, 0); c.lineTo(6, 4); c.fill();
      } else if (pr.spin) {
        c.translate(pr.x, pr.y);
        c.rotate(g.time * 10);
        c.beginPath(); c.ellipse(0, 0, pr.r, pr.r * 0.6, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#b8912f';
        c.beginPath(); c.ellipse(0, 0, pr.r * 0.55, pr.r * 0.3, 0, 0, Math.PI * 2); c.fill();
        if (enemy) {
          c.shadowBlur = 0; c.strokeStyle = 'rgba(18,9,4,0.95)'; c.lineWidth = 2;
          c.beginPath(); c.ellipse(0, 0, pr.r, pr.r * 0.6, 0, 0, Math.PI * 2); c.stroke();
        }
      } else {
        if (pr.glow) { // #262 perf: pre-baked halo instead of a live blur pass per bolt
          c.shadowBlur = 0;
          const _h = pr.r * 2.4;
          c.drawImage(Fx.glowSprite(pr.color), pr.x - _h, pr.y - _h, _h * 2, _h * 2);
        }
        c.beginPath(); c.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); c.fill();
        if (enemy) {
          c.shadowBlur = 0;
          c.strokeStyle = 'rgba(18,9,4,0.95)'; c.lineWidth = 2;
          c.beginPath(); c.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); c.stroke();
          c.fillStyle = 'rgba(255,255,255,0.85)'; // bright core pip = "this is a threat"
          c.beginPath(); c.arc(pr.x, pr.y, Math.max(1, pr.r * 0.34), 0, Math.PI * 2); c.fill();
        }
      }
      c.restore();
    }

    Fx.draw(c);

    drawSmokeBanks(c); // #184 Wrath's smoke rolls over everything except the HUD

    // THE SEWN EYES (Envy's terrace): the envious have their eyelids stitched shut
    // with iron wire, and so, more or less, do you. Everything past a short radius
    // goes black. Drawn over the whole world but UNDER the HUD - you keep your
    // health bar and your minimap, you just cannot see the room you are standing in.
    // #177 (Sam) the shroud must survive the pick overlays: it used to vanish the moment
    // a level-up opened (state != 'play'), floodlighting the whole room through the
    // half-transparent menu - free wallhacks on the blind terrace.
    const shroudState = g.state === 'play' || g.state === 'levelup' || g.state === 'evolution' ||
      g.state === 'ultpick' || g.state === 'rpick' || g.state === 'levelwait' || g.state === 'pause' || g.state === 'charsheet';
    // #238 (Sam) the glass mob's blind is a FLASHBANG now, not darkness - it gets its
    // own white-out below. Envy's sewn-eyes dark shroud is its own look again.
    const visionR = g.rules ? g.rules.vision : Infinity;
    if (visionR !== Infinity && g.player && shroudState) {
      // #262 perf: the shroud was TWO full-canvas alpha fills + a fresh radial
      // gradient EVERY frame. Both passes are now replayed once into a 2W x 2H
      // sprite centered on the player (covers the whole screen from any player
      // position) and stamped down with a single drawImage.
      const R = visionR;
      if (!g._shroudCv || g._shroudR !== R) {
        g._shroudR = R;
        g._shroudCv = document.createElement('canvas');
        g._shroudCv.width = W * 2; g._shroudCv.height = H * 2;
        const sc = g._shroudCv.getContext('2d');
        const grad = sc.createRadialGradient(W, H, R * 0.45, W, H, R);
        grad.addColorStop(0, 'rgba(6,8,8,0)');
        grad.addColorStop(1, 'rgba(6,8,8,0.97)');
        sc.fillStyle = grad;
        sc.fillRect(0, 0, W * 2, H * 2);
        sc.fillStyle = 'rgba(6,8,8,0.97)';
        sc.beginPath();
        sc.rect(0, 0, W * 2, H * 2);
        sc.arc(W, H, R, 0, Math.PI * 2, true); // punch the lit circle out
        sc.fill();
      }
      c.drawImage(g._shroudCv, g.player.x - W, g.player.y - H);
    }
    // #238 the FLASHBANG: a searing white-out that sight bleeds back through. Full
    // white for the first beat, then an eased fade - the opposite of the old shroud.
    if (g.player && g.player.blindT > 0 && shroudState) {
      const a = 0.98 * Math.pow(Math.min(1, g.player.blindT / 1.5), 1.5);
      c.save();
      c.fillStyle = `rgba(255,252,235,${a.toFixed(3)})`;
      c.fillRect(0, 0, W, H);
      c.restore();
    }

    c.restore(); // end shake

    // interaction prompt + info card
    if (g.state === 'play') drawInteractPrompt(c);
    // #199 banked level-up points: a steady nudge, never a freeze
    if (g.state === 'play' && g.levelUpQueue > 0) {
      const pulse = 0.7 + Math.sin(Date.now() / 300) * 0.3;
      c.save(); c.globalAlpha = pulse; c.textAlign = 'center';
      c.font = 'bold 13px monospace'; c.fillStyle = '#ffd24c';
      c.fillText(`LEVEL UP! press C to spend ${g.levelUpQueue} point${g.levelUpQueue > 1 ? 's' : ''}`, W / 2, H - 26);
      c.restore();
    }

    // vignette when hurt - #262 perf: the gradient is built ONCE (fixed 0.35 outer
    // stop) and the pulse rides globalAlpha, so no per-frame gradient allocation
    if (g.player && g.player.hp / g.player.maxHp < 0.3) {
      if (!g._hurtGrad) {
        g._hurtGrad = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
        g._hurtGrad.addColorStop(0, 'rgba(120,0,0,0)');
        g._hurtGrad.addColorStop(1, 'rgba(120,0,0,0.35)');
      }
      c.globalAlpha = (0.25 + Math.sin(Date.now() / 200) * 0.1) / 0.35;
      c.fillStyle = g._hurtGrad;
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
    }

    UI.drawHUD(c, g);
    // #241 the hunt HUD: score, swarm count, and a red edge when your room is falling
    if (g.huntMode && g.coop) {
      c.save(); c.textAlign = 'center';
      const my = (g.huntScore && g.huntScore[g.clientId]) || 0;
      let their = 0; for (const k in (g.huntScore || {})) if (k !== g.clientId) their = Math.max(their, g.huntScore[k]);
      c.font = 'bold 16px monospace'; c.fillStyle = '#ffd24c';
      c.fillText(`HUNTS  ${my} — ${their}`, W / 2, 30);
      if (g.huntSwarmN > 0) {
        c.font = '10px monospace'; c.fillStyle = '#ff7a6a';
        c.fillText(`the swarm holds ${g.huntSwarmN} room${g.huntSwarmN > 1 ? 's' : ''}`, W / 2, 44);
      }
      if (g.room && swarmConsumed(g.room)) {
        const th = 0.5 + Math.sin(Date.now() / 150) * 0.25;
        c.globalAlpha = th; c.strokeStyle = '#ff3030'; c.lineWidth = 14;
        c.strokeRect(0, 0, W, H);
        c.globalAlpha = 1; c.font = 'bold 16px monospace'; c.fillStyle = '#ff6060';
        c.fillText('RUN. THIS ROOM IS FALLING.', W / 2, 66);
      }
      c.restore();
    }
    // #240 the duel scoreboard + the 3-2-1
    if (g.duelMode && g.coop) {
      c.save(); c.textAlign = 'center';
      const my = (g.duelScore && g.duelScore[g.clientId]) || 0;
      let their = 0; for (const k in (g.duelScore || {})) if (k !== g.clientId) their = Math.max(their, g.duelScore[k]);
      c.font = 'bold 20px monospace'; c.fillStyle = '#ffd24c';
      c.fillText(`${my}  —  ${their}`, W / 2, 30);
      c.font = '9px monospace'; c.fillStyle = '#8fa3bf';
      c.fillText('FIRST TO 3', W / 2, 44);
      if (g.duelCountdownT > 0) {
        c.font = 'bold 72px monospace'; c.fillStyle = '#fff';
        c.globalAlpha = 0.9;
        c.fillText(String(Math.ceil(g.duelCountdownT)), W / 2, H / 2 - 40);
      } else if (g.duelFightT > 0) {
        c.font = 'bold 64px monospace'; c.fillStyle = '#ffd24c';
        c.globalAlpha = Math.min(1, g.duelFightT / 0.4);
        c.fillText('FIGHT!', W / 2, H / 2 - 40);
      }
      c.restore();
    }
    // #10 (Sam) ULTIMATE cast flash: a full-screen colour wash that fades fast, plus a
    // big centred banner naming the ult. Screen-space, over the HUD - the whole dungeon
    // feels it (and in co-op every player's screen flashes).
    if (g.ultFlash && g.ultFlash.t > 0) {
      const f = g.ultFlash, k = f.t / f.max; // 1 -> 0
      c.save();
      c.globalAlpha = 0.5 * k * k;
      c.fillStyle = f.color; c.fillRect(0, 0, W, H);
      c.globalAlpha = Math.min(1, k * 1.5);
      c.textAlign = 'center';
      const sz = Math.round(38 * (1 + (1 - k) * 0.35));
      c.font = `bold ${sz}px monospace`;
      c.fillStyle = '#0a0a0a'; c.fillText(f.name.toUpperCase(), W / 2 + 3, H / 2 + 3);
      c.fillStyle = '#fff'; c.fillText(f.name.toUpperCase(), W / 2, H / 2);
      c.restore();
    }
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

    // THE FLOOR RULE card: names the rule in force, in the circle's own colour, and
    // says what it does. A player should never be left wondering why they suddenly
    // slide, or burn on the scenery.
    // #245 (Sam: "too long to read them all") the intro card is now CONTRAPASSO -
    // one compact line per rule, name in the circle's colour, effect truncated. The
    // full effect lives with you anyway: the tags under the minimap stay all floor.
    if (g.floorRule && g.floorRule.t > 0 && g.state === 'play') {
      const a = Math.min(1, g.floorRule.t) * Math.min(1, (5.5 - g.floorRule.t) * 1.6);
      c.save();
      c.globalAlpha = a;
      c.textAlign = 'center';
      let y = 122;
      c.font = 'bold 11px monospace'; c.fillStyle = '#8a7340';
      c.fillText('\u00b7 C O N T R A P A S S O \u00b7', W / 2, y); y += 20;
      for (const r of g.floorRule.lines) {
        const d = (r.desc || '').length > 46 ? (r.desc || '').slice(0, 45) + '\u2026' : (r.desc || '');
        c.font = 'bold 13px monospace';
        const nameW = c.measureText(r.name).width;
        c.font = '11px monospace';
        const sep = '  \u00b7  ';
        const descW = c.measureText(sep + d).width;
        const x0 = W / 2 - (nameW + descW) / 2;
        c.textAlign = 'left';
        c.font = 'bold 13px monospace';
        c.fillStyle = '#0a0a0a'; c.fillText(r.name, x0 + 1, y + 1);
        c.fillStyle = r.color;   c.fillText(r.name, x0, y);
        c.font = '11px monospace'; c.fillStyle = '#9a8f7a';
        c.fillText(sep + d, x0 + nameW, y);
        c.textAlign = 'center';
        y += 19;
      }
      c.restore();
    }

    // Toad's line when the King falls and the Descent opens
    if (g.toadMsg && g.toadMsg.t > 0 && g.state === 'play') {
      const a = Math.min(1, g.toadMsg.t) * Math.min(1, (5 - g.toadMsg.t) * 2);
      c.save();
      c.globalAlpha = a;
      c.textAlign = 'center';
      // Toad's line follows the run. Falling: fire, and the pit below. Climbing: dawn,
      // and the mountain above. At the END of the book it is gold, and it is the truth,
      // and there is nothing below or above any more.
      const climbing = typeof Ascent !== 'undefined' && Ascent.isAscent(g.floorNum);
      const heaven = typeof Paradiso !== 'undefined' && Paradiso.isParadiso(g.floorNum);
      const end = heaven && Paradiso.inEmpyrean(g.floorNum);
      const col = end ? '#c9a227' : heaven ? '#dfe6ff' : climbing ? '#9fc6e8' : '#ff8a3d';
      const subCol = end ? '#8a7320' : heaven ? '#ffffff' : climbing ? '#cfe6ff' : '#ffcc88';
      const sub = end ? 'she always was'
                : heaven ? 'the spheres turn around you'
                : climbing ? 'the mountain rises above you'
                : g.floorNum < 3 ? 'the dungeon goes deeper' // #251 the Harpy's stairs are not the Descent
                : 'the Descent yawns open below';
      c.font = 'bold 26px monospace';
      c.fillStyle = end ? 'rgba(255,255,255,0.85)' : '#1a0a04';   // the Empyrean is WHITE: the shadow must invert
      c.fillText(g.toadMsg.text, W / 2 + 2, H / 2 - 58);
      c.fillStyle = col;
      c.fillText(g.toadMsg.text, W / 2, H / 2 - 60);
      c.font = '14px monospace';
      c.fillStyle = subCol;
      c.fillText(sub, W / 2, H / 2 - 34);
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
    // THE OFFER: the stranger's terms and the price, on one panel (drawn in ui.js
    // where the other panels live, and where wrapText is in scope).
    if (g.state === 'offer' && g.offer) UI.drawOffer(c, g);

    if (g.state === 'levelup') g.uiRects = UI.drawLevelUp(c, g);
    if (g.state === 'evolution') g.uiRects = UI.drawEvolution(c, g);
    if (g.state === 'ultpick') g.uiRects = UI.drawUltPick(c, g);
    if (g.state === 'rpick') g.uiRects = UI.drawRPick(c, g);
    if (g.state === 'enchantpick') g.uiRects = UI.drawEnchantPick(c, g);
    if (g.state === 'craftpick') g.uiRects = UI.drawCraftPick(c, g); // #206
    if (g.state === 'levelwait') drawLevelWait(c);
    if (g.state === 'pause') g.uiRects = UI.drawPause(c, g);
    // the co-op menu overlay draws over a LIVE world (g.state is still 'play')
    if (g.coopMenu && g.state === 'play') g.uiRects = UI.drawPause(c, g);
    if (g.state === 'charsheet') g.uiRects = UI.drawCharSheet(c, g);
    if (g.state === 'dead') g.uiRects = UI.drawEnd(c, g, false);
    if (g.state === 'win') g.uiRects = UI.drawEnd(c, g, true);
    if (g.state === 'initials') g.uiRects = UI.drawInitials(c, g);

    // #100 co-op chat log + input box (under the accolade toasts)
    if (g.coop) drawChat(c);

    // #123 mythic-drop fanfare (flash + banner) over the field, under the toasts
    if (g.mythicFx) drawMythicFanfare(c);

    // #86 accolade unlock toasts render on top of everything, in any play state
    UI.drawToasts(c, g);

    // MOBILE: the thumbstick and the buttons sit on top of the HUD. Drawn in game
    // coordinates on the same canvas, so they scale with everything else and need no
    // DOM at all. No-op on desktop.
    if (typeof Mobile !== 'undefined') Mobile.draw(c, g);
  }

  // #100 render the co-op chat: recent lines fade after a while, and an input box
  // shows while you're typing. Bottom-left, above the weapon/ability HUD row.
  function drawChat(c) {
    const ch = g.chat;
    const boxX = 14, boxW = 340, lineH = 16;
    const baseY = ch.open ? H - 92 : H - 74; // sit above the input box when open
    // show the last few lines; when closed, drop lines older than 9s
    const recent = ch.log.filter(m => ch.open || (g.time - m.t) < 9).slice(-6);
    c.save();
    c.textAlign = 'left';
    c.font = '12px monospace';
    for (let i = 0; i < recent.length; i++) {
      const m = recent[i];
      const y = baseY - (recent.length - 1 - i) * lineH;
      const age = g.time - m.t;
      const fade = (!ch.open && age > 7) ? Math.max(0, 1 - (age - 7) / 2) : 1;
      const line = `${m.name}: ${m.text}`;
      c.globalAlpha = 0.55 * fade;
      c.fillStyle = '#05070d'; c.fillRect(boxX - 4, y - 12, Math.min(boxW, c.measureText(line).width + 8), lineH);
      c.globalAlpha = fade;
      c.fillStyle = m.mine ? '#ffd24c' : '#7fd4ff';
      c.fillText(m.name + ':', boxX, y);
      c.fillStyle = '#e6ebf5';
      c.fillText(' ' + m.text, boxX + c.measureText(m.name + ':').width, y);
    }
    c.globalAlpha = 1;
    if (ch.open) {
      const iy = H - 70;
      c.fillStyle = 'rgba(5,8,16,0.85)'; c.fillRect(boxX - 4, iy - 14, boxW, 22);
      c.strokeStyle = '#7fd4ff'; c.lineWidth = 1; c.strokeRect(boxX - 4, iy - 14, boxW, 22);
      c.fillStyle = '#8fb6d8'; c.font = '11px monospace';
      c.fillText('say:', boxX, iy - 1);
      c.fillStyle = '#e6ebf5'; c.font = '12px monospace';
      const caret = (Math.floor(Date.now() / 400) % 2) ? '_' : ' ';
      c.fillText(ch.buffer + caret, boxX + 30, iy);
      c.fillStyle = '#5a6b82'; c.font = '10px monospace'; c.textAlign = 'right';
      c.fillText('Enter send · Esc cancel', boxX + boxW - 8, iy - 1);
    }
    c.restore();
  }

  // deterministic per-room decoration random
  function roomRand(room, i) {
    const s = Math.sin(room.gx * 127.1 + room.gy * 311.7 + i * 74.7 + g.floorNum * 53.3) * 43758.5453;
    return s - Math.floor(s);
  }

  // #T2a (PERF-NOTES) obstacle themes animated via Date.now() - these must draw
  // in the live path every frame; every other theme draws identically each frame
  // and gets baked into the room's static layer.
  const ANIMATED_OBSTACLES = { plume: 1, tomb: 1, reed: 1, brazier: 1, flamewall: 1, orrery: 1, wheel: 1 };

  // #T2a static room layer (PERF-NOTES: pre-render static content once to an
  // offscreen canvas, drawImage per frame). Everything painted here is
  // deterministic per (room, floor): palette/theme are floor-keyed, decoration
  // uses roomRand (seeded per room+floor), pits and non-animated obstacles never
  // change. Ambient Fx spawners, doors (lock/seal state changes mid-room) and
  // Date.now()-animated obstacles stay live in drawRoom.
  // --- HELL BACKDROPS: each circle's floor tells you where you ARE -------------
  // One deterministic (roomRand) ground treatment per circle, baked into the
  // static room cache (zero per-frame cost). Keyed by CIRCLE key and gated on
  // Descent.isHell - Purgatorio reuses WRATH/GLUTTONY/LUST as terrace keys and
  // must NOT get these. noGrid circles suppress the square tile grid where a
  // frozen lake / mire / river of blood shouldn't be tiled.
  const HELL_BACKDROPS = {
    LIMBO: { // far monoliths standing in flat bands of fog
      draw(c, room) {
        c.fillStyle = 'rgba(70,76,86,0.4)';
        for (let i = 0; i < 6; i++) {
          const x = PF.x + 20 + roomRand(room, 300 + i) * (PF.w - 50);
          const h = 24 + roomRand(room, 310 + i) * 36;
          c.fillRect(x, PF.y + 6 + roomRand(room, 320 + i) * 46, 7 + roomRand(room, 330 + i) * 8, h);
        }
        c.fillStyle = 'rgba(143,151,163,0.07)';
        for (let i = 0; i < 4; i++) {
          const y = PF.y + (0.12 + i * 0.24) * PF.h + roomRand(room, 340 + i) * 12;
          c.fillRect(PF.x, y, PF.w, 9 + roomRand(room, 350 + i) * 15);
        }
      } },
    LUST: { // the storm: wind streaks dragged across the whole floor
      draw(c, room) {
        c.lineWidth = 1.5; c.lineCap = 'round';
        for (let i = 0; i < 11; i++) {
          const y = PF.y + roomRand(room, 300 + i) * PF.h;
          const x = PF.x + roomRand(room, 320 + i) * PF.w * 0.5;
          const len = 90 + roomRand(room, 340 + i) * 170;
          const sag = 8 + roomRand(room, 360 + i) * 16;
          c.strokeStyle = 'rgba(192,96,255,' + (0.10 + roomRand(room, 380 + i) * 0.12).toFixed(2) + ')';
          c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len * 0.5, y - sag, x + len, y); c.stroke();
        }
      } },
    GLUTTONY: { noGrid: true, // cold rain on the mire: mud pools, pocked with rings
      draw(c, room) {
        for (let i = 0; i < 7; i++) {
          const x = PF.x + roomRand(room, 300 + i) * PF.w, y = PF.y + roomRand(room, 320 + i) * PF.h;
          const rx = 20 + roomRand(room, 340 + i) * 42;
          c.fillStyle = 'rgba(16,18,6,0.5)';
          c.beginPath(); c.ellipse(x, y, rx, rx * 0.45, 0, 0, Math.PI * 2); c.fill();
          c.strokeStyle = 'rgba(154,174,74,0.18)'; c.lineWidth = 1.5;
          c.beginPath(); c.ellipse(x, y, rx * 0.94, rx * 0.42, 0, 0, Math.PI * 2); c.stroke();
        }
        c.strokeStyle = 'rgba(160,220,200,0.15)'; c.lineWidth = 1;
        for (let i = 0; i < 10; i++) { // rain rings on the wet ground
          const x = PF.x + roomRand(room, 400 + i) * PF.w, y = PF.y + roomRand(room, 420 + i) * PF.h;
          c.beginPath(); c.ellipse(x, y, 3 + roomRand(room, 440 + i) * 5, 1.6 + roomRand(room, 440 + i) * 2, 0, 0, Math.PI * 2); c.stroke();
        }
      } },
    GREED: { // the hoard, spilled and half-buried where it fell
      draw(c, room) {
        for (let i = 0; i < 5; i++) { // sunken ingots
          const x = PF.x + roomRand(room, 300 + i) * PF.w, y = PF.y + roomRand(room, 320 + i) * PF.h;
          c.save(); c.translate(x, y); c.rotate((roomRand(room, 340 + i) - 0.5) * 1.2);
          c.fillStyle = 'rgba(184,145,47,0.5)'; c.fillRect(-7, -3, 14, 6);
          c.fillStyle = 'rgba(255,210,76,0.35)'; c.fillRect(-7, -3, 14, 2);
          c.restore();
        }
        for (let i = 0; i < 26; i++) { // loose coins glinting in the dark
          const x = PF.x + roomRand(room, 400 + i) * PF.w, y = PF.y + roomRand(room, 440 + i) * PF.h;
          c.fillStyle = 'rgba(255,210,76,' + (0.18 + roomRand(room, 480 + i) * 0.3).toFixed(2) + ')';
          c.beginPath(); c.ellipse(x, y, 2.2, 1.4, 0, 0, Math.PI * 2); c.fill();
        }
      } },
    WRATH: { // the marsh of the Styx: dark channels, and the sullen below them
      draw(c, room) {
        for (let i = 0; i < 3; i++) {
          const y = PF.y + (0.2 + i * 0.28) * PF.h + roomRand(room, 300 + i) * 20;
          const sag = 20 + roomRand(room, 320 + i) * 26;
          c.strokeStyle = 'rgba(8,4,6,0.55)'; c.lineWidth = 16 + roomRand(room, 340 + i) * 10; c.lineCap = 'round';
          c.beginPath(); c.moveTo(PF.x, y);
          c.quadraticCurveTo(PF.x + PF.w * 0.33, y + sag, PF.x + PF.w * 0.55, y);
          c.quadraticCurveTo(PF.x + PF.w * 0.8, y - sag, PF.x + PF.w, y + sag * 0.4); c.stroke();
        }
        c.strokeStyle = 'rgba(255,68,68,0.22)'; c.lineWidth = 1.2;
        for (let i = 0; i < 9; i++) { // sullen bubbles breaking the surface
          const x = PF.x + roomRand(room, 400 + i) * PF.w, y = PF.y + roomRand(room, 430 + i) * PF.h;
          c.beginPath(); c.arc(x, y, 2 + roomRand(room, 460 + i) * 2.5, Math.PI, Math.PI * 2); c.stroke();
        }
      } },
    HERESY: { // the burning tombs, lids ajar, fire in the seams
      draw(c, room) {
        for (let i = 0; i < 6; i++) {
          const x = PF.x + 14 + roomRand(room, 300 + i) * (PF.w - 60), y = PF.y + 10 + roomRand(room, 320 + i) * (PF.h - 50);
          const w2 = 26 + roomRand(room, 340 + i) * 14, h2 = 14 + roomRand(room, 360 + i) * 8;
          c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, y, w2, h2);
          c.strokeStyle = 'rgba(255,106,44,0.3)'; c.lineWidth = 1.5; c.strokeRect(x, y, w2, h2);
          c.strokeStyle = 'rgba(255,106,44,0.5)';
          c.beginPath(); c.moveTo(x + 2, y + h2 * 0.35); c.lineTo(x + w2 - 2, y + h2 * 0.35); c.stroke(); // the lid, ajar
        }
        c.strokeStyle = 'rgba(255,60,20,0.28)'; c.lineWidth = 1.2;
        for (let i = 0; i < 7; i++) { // ember cracks between the tombs
          const x = PF.x + roomRand(room, 400 + i) * PF.w, y = PF.y + roomRand(room, 430 + i) * PF.h;
          c.beginPath(); c.moveTo(x, y);
          c.lineTo(x + 8 + roomRand(room, 460 + i) * 10, y + 4 - roomRand(room, 470 + i) * 8);
          c.lineTo(x + 18 + roomRand(room, 480 + i) * 12, y + roomRand(room, 490 + i) * 6); c.stroke();
        }
      } },
    VIOLENCE: { noGrid: true, // Phlegethon: the river of boiling blood crosses the floor
      draw(c, room) {
        const y = PF.y + PF.h * (0.35 + roomRand(room, 300) * 0.3);
        const sag = 26 + roomRand(room, 301) * 30;
        const path = () => {
          c.beginPath(); c.moveTo(PF.x, y);
          c.quadraticCurveTo(PF.x + PF.w * 0.3, y - sag, PF.x + PF.w * 0.55, y + sag * 0.3);
          c.quadraticCurveTo(PF.x + PF.w * 0.8, y + sag, PF.x + PF.w, y - sag * 0.4);
        };
        c.lineCap = 'round';
        c.strokeStyle = 'rgba(20,2,6,0.75)'; c.lineWidth = 30; path(); c.stroke();   // the channel
        c.strokeStyle = 'rgba(120,8,24,0.55)'; c.lineWidth = 20; path(); c.stroke(); // the blood
        c.strokeStyle = 'rgba(255,42,74,0.30)'; c.lineWidth = 7; path(); c.stroke(); // the boil line
        c.fillStyle = 'rgba(255,90,60,0.4)';
        for (let i = 0; i < 8; i++) { // bursting boils along the run
          const t = roomRand(room, 320 + i), bx = PF.x + t * PF.w;
          const by = y + Math.sin(t * 6.2) * sag * 0.5;
          c.beginPath(); c.arc(bx, by, 1.6 + roomRand(room, 340 + i) * 2, 0, Math.PI * 2); c.fill();
        }
      } },
    FRAUD: { // Malebolge: concentric ditches, and shards that show you nothing true
      draw(c, room) {
        const cx = PF.x + PF.w * (0.3 + roomRand(room, 300) * 0.4), cy = PF.y + PF.h * (0.3 + roomRand(room, 301) * 0.4);
        c.lineWidth = 5;
        for (let i = 0; i < 4; i++) { // the ditch rings, fading out
          c.strokeStyle = 'rgba(6,4,12,' + (0.4 - i * 0.08).toFixed(2) + ')';
          c.beginPath(); c.arc(cx, cy, 46 + i * 44, 0, Math.PI * 2); c.stroke();
        }
        for (let i = 0; i < 6; i++) { // half-buried mirror shards
          const x = PF.x + roomRand(room, 400 + i) * PF.w, y = PF.y + roomRand(room, 430 + i) * PF.h;
          const s = 4 + roomRand(room, 460 + i) * 5, a = roomRand(room, 480 + i) * Math.PI;
          c.save(); c.translate(x, y); c.rotate(a);
          c.fillStyle = 'rgba(110,255,192,0.30)';
          c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.7, s * 0.6); c.lineTo(-s * 0.5, s * 0.4); c.closePath(); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.35)';
          c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.25, -s * 0.2); c.lineTo(-s * 0.2, -s * 0.15); c.closePath(); c.fill();
          c.restore();
        }
      } },
    TREACHERY: { noGrid: true, // Cocytus: crack webs in the ice, and shapes beneath it
      draw(c, room) {
        c.fillStyle = 'rgba(127,212,255,0.05)'; c.fillRect(PF.x, PF.y, PF.w, PF.h); // the sheet
        c.fillStyle = 'rgba(6,14,22,0.4)';
        for (let i = 0; i < 5; i++) { // the treacherous, frozen under your feet
          const x = PF.x + roomRand(room, 300 + i) * PF.w, y = PF.y + roomRand(room, 320 + i) * PF.h;
          c.beginPath(); c.ellipse(x, y, 9 + roomRand(room, 340 + i) * 8, 5 + roomRand(room, 350 + i) * 4, roomRand(room, 360 + i) * Math.PI, 0, Math.PI * 2); c.fill();
        }
        c.strokeStyle = 'rgba(200,240,255,0.22)'; c.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) { // crack webs spreading from impact points
          let x = PF.x + roomRand(room, 400 + i) * PF.w, y = PF.y + roomRand(room, 420 + i) * PF.h;
          for (let j = 0; j < 5; j++) {
            const a = roomRand(room, 440 + i * 7 + j) * Math.PI * 2;
            const len = 18 + roomRand(room, 480 + i * 7 + j) * 34;
            const mx = x + Math.cos(a) * len * 0.55 + (roomRand(room, 520 + i * 7 + j) - 0.5) * 10;
            const my = y + Math.sin(a) * len * 0.55 + (roomRand(room, 560 + i * 7 + j) - 0.5) * 10;
            c.beginPath(); c.moveTo(x, y); c.lineTo(mx, my);
            c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
          }
        }
      } },
  };

  function renderRoomStatic(room, sc) {
    const c = sc; // drawing code below kept verbatim from drawRoom
    const pal = Dungeon.paletteFor(room, g.floorNum);
    const theme = Dungeon.themeFor(g.floorNum);
    const descent = typeof Descent !== 'undefined' && Descent.isDescent(g.floorNum);
    const hellBackdrop = (typeof Descent !== 'undefined' && Descent.isHell && Descent.isHell(g.floorNum))
      ? HELL_BACKDROPS[theme.key] : null;
    // outer wall fill
    c.fillStyle = pal.wall;
    c.fillRect(0, 0, W, H);
    // Descent backdrop: a wash bleeding in from the edge of the frame. The colour
    // and the direction come from the CIRCLE (descent.js), not from a hardcoded
    // lava red - Limbo is grey fog from above, Treachery is cold light off the ice,
    // Heresy is the classic fire from below.
    if (descent && theme.glow) {
      const grad = theme.glowTop
        ? c.createLinearGradient(0, 0, 0, H * 0.65)   // light pressing down from above
        : c.createLinearGradient(0, H, 0, H * 0.35);  // fire rising from below
      grad.addColorStop(0, theme.glow);
      grad.addColorStop(1, theme.glow.replace(/[\d.]+\)$/, '0)'));
      c.fillStyle = grad;
      c.fillRect(0, 0, W, H);
    }
    // floor
    c.fillStyle = pal.floor;
    c.fillRect(PF.x, PF.y, PF.w, PF.h);
    // subtle tile grid - unless this circle's ground shouldn't be tiled
    // (a frozen lake, a mire, a river of blood)
    if (!(hellBackdrop && hellBackdrop.noGrid)) {
      c.strokeStyle = 'rgba(0,0,0,0.15)';
      c.lineWidth = 1;
      for (let x = PF.x; x <= PF.x + PF.w; x += 54) {
        c.beginPath(); c.moveTo(x, PF.y); c.lineTo(x, PF.y + PF.h); c.stroke();
      }
      for (let y = PF.y; y <= PF.y + PF.h; y += 54) {
        c.beginPath(); c.moveTo(PF.x, y); c.lineTo(PF.x + PF.w, y); c.stroke();
      }
    }
    // scattered floor detail (cracks/pebbles), deterministic per room
    c.fillStyle = pal.detail;
    for (let i = 0; i < 14; i++) {
      const x = PF.x + roomRand(room, i) * PF.w;
      const y = PF.y + roomRand(room, i + 50) * PF.h;
      c.fillRect(x, y, 3 + roomRand(room, i + 100) * 4, 2 + roomRand(room, i + 150) * 3);
    }
    // the circle's signature ground (baked, deterministic, under walls/obstacles)
    if (hellBackdrop) { c.save(); hellBackdrop.draw(c, room); c.restore(); }
    // #67b room-shape walls: a raised natural stone mass, tinted to the floor theme
    // so it reads as part of the room (a rock outcrop / cliff wall) rather than a flat
    // panel that doesn't belong. Cast shadow + lit top slab + rough speckle sell depth.
    if (room.walls) for (const w of room.walls) {
      c.fillStyle = 'rgba(0,0,0,0.4)';                          // soft cast shadow, down
      c.fillRect(w.x - 2, w.y + 5, w.w + 5, w.h + 3);
      c.fillStyle = '#2b3038';                                  // neutral dark rock base
      c.fillRect(w.x, w.y, w.w, w.h);
      c.fillStyle = (pal.accent || '#556677') + '1c';           // theme colour wash so it matches the room
      c.fillRect(w.x, w.y, w.w, w.h);
      c.fillStyle = 'rgba(0,0,0,0.22)';                         // sunken inner core (depth)
      c.fillRect(w.x + 3, w.y + 11, w.w - 6, w.h - 15);
      c.fillStyle = '#3b434f';                                  // lit top slab (seen from above)
      c.fillRect(w.x, w.y, w.w, Math.min(11, w.h));
      c.fillStyle = (pal.accent || '#7788aa') + '30';
      c.fillRect(w.x, w.y, w.w, 3);
      // deterministic speckle: rough stone, not a smooth face
      c.fillStyle = 'rgba(0,0,0,0.28)';
      const specks = Math.min(80, (w.w * w.h / 700) | 0);
      for (let i = 0; i < specks; i++) {
        const rx = w.x + 5 + roomRand(room, (i * 7 + w.x) | 0) * (w.w - 10);
        const ry = w.y + 13 + roomRand(room, (i * 13 + w.y + 91) | 0) * (w.h - 18);
        c.fillRect(rx, ry, 2, 2);
      }
      c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 1.5;
      c.strokeRect(w.x + 0.75, w.y + 0.75, w.w - 1.5, w.h - 1.5);
    }

    // molten rounded corners: mask the square corners so the arena reads oblong
    // and cornerless (collision stays rectangular underneath - a deliberate call)
    if (descent) drawMoltenCorners(c, pal, theme.accent);

    // wall inner edge highlight - skip in the Descent, where the molten rounded
    // corners define the oblong edge (the rectangle outline was showing through)
    if (!descent) {
      c.strokeStyle = pal.accent + '44';
      c.lineWidth = 2;
      c.strokeRect(PF.x + 1, PF.y + 1, PF.w - 2, PF.h - 2);
    }

    // #74/#82 PITS drawn first, in merge-friendly passes so a COMPOSITE pit (a
    // group of overlapping circles - donut / missing corner / bridge) reads as one
    // seamless hole instead of lumpy circles. Pass 1 lays all the soft lip shadows,
    // pass 2 paints every void opaque (covering the interior overlap-darkening), so
    // only the true outer edge keeps its shadow. Lone pits (no group) additionally
    // get the pretty radial gradient + lit near-rim; grouped circles skip the rim
    // (its arcs would cut across the middle of the merged shape).
    const pits = room.obstacles.filter(o => o.kind === 'pit');
    if (pits.length) {
      c.fillStyle = 'rgba(0,0,0,0.32)';
      for (const o of pits) { c.beginPath(); c.ellipse(o.x, o.y + 2, o.r + 5, (o.r + 5) * 0.82, 0, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#090a0c';
      for (const o of pits) { c.beginPath(); c.ellipse(o.x, o.y, o.r, o.r * 0.8, 0, 0, Math.PI * 2); c.fill(); }
      for (const o of pits) {
        const gr = c.createRadialGradient(o.x, o.y - o.r * 0.2, o.r * 0.15, o.x, o.y + o.r * 0.2, o.r);
        gr.addColorStop(0, '#000'); gr.addColorStop(1, 'rgba(26,20,12,0.85)');
        c.fillStyle = gr;
        c.beginPath(); c.ellipse(o.x, o.y, o.r * 0.9, o.r * 0.72, 0, 0, Math.PI * 2); c.fill();
      }
      c.strokeStyle = 'rgba(150,138,110,0.4)'; c.lineWidth = 2;
      for (const o of pits) {
        if (o.group) continue;                                   // merged shapes: no internal rim seams
        c.beginPath(); c.ellipse(o.x, o.y, o.r, o.r * 0.8, 0, Math.PI * 0.12, Math.PI * 0.88); c.stroke();
      }
    }

    // non-animated obstacle themes draw identically every frame - bake them here
    if (!ANIMATED_OBSTACLES[theme.obstacle]) drawRoomObstacles(c, room, pal, theme);
  }

  function drawRoom(c, room) {
    const pal = Dungeon.paletteFor(room, g.floorNum);
    const theme = Dungeon.themeFor(g.floorNum);
    // #T2a static layer cache: rebuild only when the key changes. The key is
    // lock-independent (doors/locks/seals draw live below); floorNum is in the
    // key defensively even though rooms are recreated per floor. Cache canvas is
    // exactly main-canvas size (PERF-NOTES: snug caches; full-room = W x H).
    const staticKey = g.floorNum + ':' + room.gx + ',' + room.gy;
    if (!room._staticCv || room._staticKey !== staticKey) {
      if (!room._staticCv) {
        room._staticCv = document.createElement('canvas');
        room._staticCv.width = W;
        room._staticCv.height = H;
      }
      const sc = room._staticCv.getContext('2d');
      sc.clearRect(0, 0, W, H);
      renderRoomStatic(room, sc);
      room._staticKey = staticKey;
    }
    c.drawImage(room._staticCv, 0, 0);

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
    if (theme.ambient === 'limbo') {
      // grey ash, drifting down. Nothing burns here; it has simply always been falling.
      if (Math.random() < 0.35) Fx.burst(PF.x + Math.random() * PF.w, PF.y + Math.random() * 30,
        ['#8f97a3', '#5c626c'], 1, { speed: 4, life: 3.2, grav: 9, size: 1.5, drag: 0.999 });
    }
    if (theme.ambient === 'storm') {
      // the gale, dragging everything sideways across the room
      if (Math.random() < 0.6) Fx.burst(PF.x - 10, PF.y + Math.random() * PF.h,
        ['#c060ff', '#6effc0', '#e0d0ff'], 1, { speed: 18, vx: 150, life: 1.6, size: 1.6, drag: 0.998 });
    }
    if (theme.ambient === 'ice') {
      // frost falling through the still air over the frozen lake
      if (Math.random() < 0.4) Fx.burst(PF.x + Math.random() * PF.w, PF.y + Math.random() * 20,
        ['#cfeeff', '#7fd4ff'], 1, { speed: 5, life: 3.6, grav: 12, glow: true, size: 1.6, drag: 0.998 });
    }
    // --- MOUNT PURGATORY: the air goes UP here, not down. Everything on the mountain
    // rises (grav is negative), which is the whole point of the place.
    if (theme.ambient === 'shore') {
      // sea spray off the water at the foot of the mountain, and the dawn coming
      if (Math.random() < 0.3) Fx.burst(PF.x + Math.random() * PF.w, PF.y + PF.h - Math.random() * 30,
        ['#cfe6ff', '#9fc6e8'], 1, { speed: 10, life: 2.4, grav: -16, glow: true, size: 1.5, drag: 0.996 });
    }
    if (theme.ambient === 'stonework') {
      // dust off the carved rock, drifting up in the light
      if (Math.random() < 0.28) Fx.burst(PF.x + Math.random() * PF.w, PF.y + PF.h - Math.random() * 40,
        ['#d8c39a', '#8fb8b0'], 1, { speed: 6, life: 3.0, grav: -10, size: 1.3, drag: 0.998 });
    }
    if (theme.ambient === 'smoke') {
      // the bank of bitter smoke itself, rolling through the room
      if (Math.random() < 0.7) Fx.burst(PF.x - 10, PF.y + Math.random() * PF.h,
        ['#6d6a64', '#8b877f', '#4f4d49'], 1, { speed: 14, vx: 60, life: 2.6, size: 5.5, drag: 0.999 });
    }
    if (theme.ambient === 'wind') {
      // clean mountain air, and something green on it
      if (Math.random() < 0.3) Fx.burst(PF.x + Math.random() * PF.w, PF.y + PF.h - Math.random() * 30,
        ['#9ad0a4', '#c3dd8a'], 1, { speed: 9, vx: 26, life: 2.8, grav: -14, size: 1.5, drag: 0.997 });
    }
    if (theme.ambient === 'refiner') {
      // embers off the refining fire - they rise, and they are WARM, not cruel
      if (Math.random() < 0.5) Fx.burst(PF.x + Math.random() * PF.w, PF.y + PF.h - Math.random() * 30,
        ['#ffb27a', '#ffd24c', '#ff7a3c'], 1, { speed: 9, life: 2.2, grav: -30, glow: true, size: 1.9, drag: 0.998 });
    }
    // --- THE HEAVENS: everything here is made of light, and all of it RISES.
    if (theme.ambient === 'eden') {
      if (Math.random() < 0.35) Fx.burst(PF.x + Math.random() * PF.w, PF.y + PF.h - Math.random() * 40,
        ['#b7f0c0', '#eaf7ea', '#ffd24c'], 1, { speed: 7, vx: 14, life: 3.4, grav: -8, glow: true, size: 1.6, drag: 0.998 }); // petals on the air
    }
    if (theme.ambient === 'celestial') {
      if (Math.random() < 0.4) Fx.burst(PF.x + Math.random() * PF.w, PF.y + PF.h - Math.random() * 50,
        [theme.accent, '#ffffff'], 1, { speed: 6, life: 3.2, grav: -18, glow: true, size: 1.5, drag: 0.999 });
    }
    if (theme.ambient === 'radiance') {
      if (Math.random() < 0.5) Fx.burst(PF.x + Math.random() * PF.w, PF.y + PF.h - Math.random() * 40,
        [theme.accent, '#fff8e0'], 1, { speed: 8, life: 2.6, grav: -26, glow: true, size: 2.0, drag: 0.998 });
    }
    if (theme.ambient === 'martial') {
      if (Math.random() < 0.4) Fx.burst(PF.x + Math.random() * PF.w, PF.y + PF.h - Math.random() * 30,
        ['#ff9a8a', '#ffd0c4'], 1, { speed: 10, life: 2.0, grav: -30, glow: true, size: 1.8, drag: 0.998 });
    }
    if (theme.ambient === 'silence') {
      // almost nothing, very slowly. Saturn is the quiet heaven.
      if (Math.random() < 0.12) Fx.burst(PF.x + Math.random() * PF.w, PF.y + PF.h - Math.random() * 40,
        ['#e8dcc0', '#c9a227'], 1, { speed: 3, life: 5.0, grav: -6, glow: true, size: 1.4, drag: 0.999 });
    }
    if (theme.ambient === 'starlight') {
      if (Math.random() < 0.55) Fx.burst(PF.x + Math.random() * PF.w, PF.y + Math.random() * PF.h,
        ['#ffffff', '#dfe6ff'], 1, { speed: 2, life: 2.4, glow: true, size: 1.3, drag: 0.999 }); // stars, not dust
    }
    if (theme.ambient === 'empyrean') {
      // the rose of light. It falls UP, and it never stops.
      if (Math.random() < 0.8) Fx.burst(PF.x + Math.random() * PF.w, PF.y + PF.h - Math.random() * 60,
        ['#ffffff', '#ffe9a8', '#c9a227'], 1, { speed: 8, life: 3.6, grav: -22, glow: true, size: 2.1, drag: 0.998 });
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

    // obstacles: Date.now()-animated themes draw live every frame; every other
    // theme was baked into the static layer by renderRoomStatic.
    if (ANIMATED_OBSTACLES[theme.obstacle]) drawRoomObstacles(c, room, pal, theme);

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
    if (room.type === 'barracks' && room.barracks) drawBarracks(c, room);
    if (room.type === 'trap' && room.trapChest) drawTrapChest(c, room.trapChest);

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
      c.fillText('E · DESCEND', pt.x, pt.y + 50); // #169 shortened so it can't overlap the nightmare label beside it
    }

    // #13 (Sam) TWIN PORTAL: the NIGHTMARE rift, a bleeding red tear beside the normal
    // descent exit. Only on descent floors, only in the exit room, only once it is open.
    {
      const ex = (typeof descentExitPoint === 'function') ? descentExitPoint() : null;
      if (ex && room === g.room) {
        const np = nightmarePos(ex);
        c.save();
        c.translate(np.x, np.y);
        const spin = g.time * 3.2;
        for (let i = 0; i < 3; i++) {
          c.strokeStyle = i === 1 ? 'rgba(255,32,32,0.9)' : 'rgba(180,0,40,0.85)';
          c.lineWidth = 5 - i;
          c.beginPath();
          c.ellipse(0, 0, 26 + i * 8 + Math.sin(spin * 2 + i) * 3, 14 + i * 4, spin * (i % 2 ? -0.7 : 0.7), 0.3, Math.PI * 2 - 0.3);
          c.stroke();
        }
        const grad = c.createRadialGradient(0, 0, 2, 0, 0, 32);
        grad.addColorStop(0, 'rgba(120,0,10,0.85)');
        grad.addColorStop(0.6, 'rgba(255,32,32,0.35)');
        grad.addColorStop(1, 'rgba(60,0,0,0)');
        c.fillStyle = grad; c.beginPath(); c.arc(0, 0, 32, 0, Math.PI * 2); c.fill();
        if (Math.random() < 0.4) Fx.burst(np.x + (Math.random() * 40 - 20), np.y + (Math.random() * 24 - 12), Math.random() < 0.5 ? '#ff2020' : '#7a0010', 1, { speed: 45, life: 0.7, glow: true });
        c.restore();
        // #169 shortened + a second smaller line, so the label no longer runs into the
        // normal DESCEND label sitting beside it.
        c.font = 'bold 12px monospace'; c.textAlign = 'center'; c.fillStyle = '#ff3b3b';
        c.fillText('E · NIGHTMARE', np.x, np.y + 50);
        c.font = '9px monospace'; c.fillStyle = 'rgba(255,90,90,0.85)';
        c.fillText('harder · richer', np.x, np.y + 62);
      }
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

  // obstacles, dressed for the floor's theme. Shared painter: called live from
  // drawRoom for Date.now()-animated themes, and from renderRoomStatic (into the
  // offscreen static layer) for every other theme.
  function drawRoomObstacles(c, room, pal, theme) {
    for (const o of room.obstacles) {
      if (o.kind === 'pit') continue;
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
      } else if (theme.obstacle === 'monolith') {
        // LIMBO: a blank grey slab. No carving, no meaning. That is the point.
        c.fillStyle = '#3a3e46';
        c.beginPath(); c.arc(o.x, o.y, o.r, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#4a4f59';
        c.beginPath(); c.arc(o.x - o.r * 0.22, o.y - o.r * 0.26, o.r * 0.66, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#20232a'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.98, 0, Math.PI * 2); c.stroke();
      } else if (theme.obstacle === 'plume') {
        // LUST: a column of the eternal storm, turning where it stands
        const t = Date.now() / 900 + o.x * 0.05;
        c.save();
        c.translate(o.x, o.y);
        for (let i = 0; i < 3; i++) {
          const rr = o.r * (1 - i * 0.24);
          c.strokeStyle = `rgba(192,96,255,${0.30 + i * 0.16})`;
          c.lineWidth = 2 + i;
          c.beginPath(); c.arc(0, 0, rr, t + i * 2.1, t + i * 2.1 + Math.PI * 1.35); c.stroke();
        }
        c.fillStyle = 'rgba(60,20,80,0.75)';
        c.beginPath(); c.arc(0, 0, o.r * 0.42, 0, Math.PI * 2); c.fill();
        c.restore();
      } else if (theme.obstacle === 'slop') {
        // GLUTTONY: a mound of cold filth, half-melted
        c.fillStyle = 'rgba(70,80,30,0.55)';
        c.beginPath(); c.ellipse(o.x, o.y + 2, o.r * 1.3, o.r * 0.8, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#4a4a20';
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.9, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#6b6e2c';
        c.beginPath(); c.arc(o.x - o.r * 0.2, o.y - o.r * 0.22, o.r * 0.55, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(154,174,74,0.5)'; // a sickly gleam on the crest
        c.beginPath(); c.arc(o.x - o.r * 0.3, o.y - o.r * 0.34, o.r * 0.2, 0, Math.PI * 2); c.fill();
      } else if (theme.obstacle === 'hoard') {
        // GREED: a heaped pile of coin, the weight they push forever
        c.fillStyle = '#6b5518';
        c.beginPath(); c.ellipse(o.x, o.y + 2, o.r * 1.15, o.r * 0.78, 0, 0, Math.PI * 2); c.fill();
        for (let i = 0; i < 7; i++) {
          const a = i * 2.39, rr = o.r * (0.28 + (i % 3) * 0.22);
          c.fillStyle = i % 2 ? '#ffd24c' : '#d4af37';
          c.beginPath();
          c.ellipse(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr * 0.6, o.r * 0.26, o.r * 0.17, 0, 0, Math.PI * 2);
          c.fill();
        }
      } else if (theme.obstacle === 'tomb') {
        // HERESY: a burning sarcophagus, its lid ajar
        c.fillStyle = '#3a3038';
        c.fillRect(o.x - o.r, o.y - o.r * 0.72, o.r * 2, o.r * 1.44);
        c.fillStyle = '#4c4048';
        c.fillRect(o.x - o.r * 0.9, o.y - o.r * 0.6, o.r * 1.8, o.r * 0.55);
        c.strokeStyle = '#1c161c'; c.lineWidth = 1.5;
        c.strokeRect(o.x - o.r, o.y - o.r * 0.72, o.r * 2, o.r * 1.44);
        c.save(); // the flame licking out of the gap
        c.shadowColor = '#ff5a2c'; c.shadowBlur = 10;
        for (let i = 0; i < 3; i++) {
          const fy = Math.sin(Date.now() / 130 + i * 2) * 2;
          c.fillStyle = i === 1 ? '#ffd24c' : '#ff6a2c';
          c.beginPath();
          c.arc(o.x + (i - 1) * o.r * 0.5, o.y - o.r * 0.15 + fy, o.r * 0.2, 0, Math.PI * 2);
          c.fill();
        }
        c.restore();
      } else if (theme.obstacle === 'mirror') {
        // FRAUD: a shard of black glass. It shows you something, but not the truth.
        c.save();
        c.translate(o.x, o.y);
        c.rotate((o.x + o.y) * 0.01); // fixed per-obstacle tilt, not animated
        c.fillStyle = '#161226';
        c.beginPath();
        c.moveTo(0, -o.r); c.lineTo(o.r * 0.72, -o.r * 0.15);
        c.lineTo(o.r * 0.4, o.r); c.lineTo(-o.r * 0.55, o.r * 0.7);
        c.lineTo(-o.r * 0.75, -o.r * 0.4); c.closePath(); c.fill();
        c.strokeStyle = '#6effc0'; c.lineWidth = 1.4; c.globalAlpha = 0.75; c.stroke();
        c.globalAlpha = 0.28; // the false reflection
        c.fillStyle = '#6effc0';
        c.beginPath();
        c.moveTo(-o.r * 0.2, -o.r * 0.6); c.lineTo(o.r * 0.3, -o.r * 0.2);
        c.lineTo(-o.r * 0.1, o.r * 0.5); c.closePath(); c.fill();
        c.restore();
      } else if (theme.obstacle === 'ice') {
        // TREACHERY: a spire of black ice. Something is frozen inside it.
        c.fillStyle = 'rgba(150,210,255,0.18)';
        c.beginPath(); c.ellipse(o.x, o.y + 3, o.r * 1.25, o.r * 0.8, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#2c4b63';
        c.beginPath();
        c.moveTo(o.x, o.y - o.r * 1.05); c.lineTo(o.x + o.r * 0.85, o.y + o.r * 0.2);
        c.lineTo(o.x + o.r * 0.35, o.y + o.r * 0.95); c.lineTo(o.x - o.r * 0.6, o.y + o.r * 0.8);
        c.lineTo(o.x - o.r * 0.9, o.y - o.r * 0.15); c.closePath(); c.fill();
        c.fillStyle = 'rgba(190,235,255,0.42)'; // lit facet
        c.beginPath();
        c.moveTo(o.x, o.y - o.r * 1.0); c.lineTo(o.x - o.r * 0.55, o.y + o.r * 0.7);
        c.lineTo(o.x - o.r * 0.85, o.y - o.r * 0.1); c.closePath(); c.fill();
        c.fillStyle = 'rgba(10,20,30,0.55)'; // the shape suspended in it
        c.beginPath(); c.arc(o.x + o.r * 0.05, o.y + o.r * 0.05, o.r * 0.28, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#7fd4ff'; c.lineWidth = 1.2; c.globalAlpha = 0.8;
        c.beginPath();
        c.moveTo(o.x, o.y - o.r * 1.05); c.lineTo(o.x + o.r * 0.85, o.y + o.r * 0.2);
        c.lineTo(o.x + o.r * 0.35, o.y + o.r * 0.95); c.stroke();
        c.globalAlpha = 1;
      } else if (theme.obstacle === 'reed') {
        // THE SHORE: the rush that grows at the foot of the mountain. Dante is told
        // to bind one round his waist - the only humble plant, and it grows back.
        c.fillStyle = 'rgba(120,170,200,0.25)';
        c.beginPath(); c.ellipse(o.x, o.y + 3, o.r * 1.2, o.r * 0.55, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#6f8f70'; c.lineWidth = 2; c.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.28 + Math.sin(Date.now() / 700 + i + o.x * 0.03) * 0.10;
          c.beginPath(); c.moveTo(o.x + (i - 2) * 3, o.y + o.r * 0.5);
          c.lineTo(o.x + (i - 2) * 3 + Math.cos(a) * o.r * 1.25, o.y + o.r * 0.5 + Math.sin(a) * o.r * 1.25);
          c.stroke();
        }
      } else if (theme.obstacle === 'carving') {
        // PRIDE: a great carved stone. The terrace floor is cut with reliefs of the
        // proud brought low, and the proud walk bent double under blocks like this.
        c.fillStyle = '#6b6153';
        c.fillRect(o.x - o.r, o.y - o.r * 0.85, o.r * 2, o.r * 1.7);
        c.fillStyle = '#837768';
        c.fillRect(o.x - o.r * 0.9, o.y - o.r * 0.75, o.r * 1.8, o.r * 0.7);
        c.strokeStyle = '#4a4238'; c.lineWidth = 1.4;
        c.strokeRect(o.x - o.r, o.y - o.r * 0.85, o.r * 2, o.r * 1.7);
        c.strokeStyle = '#d8c39a'; c.lineWidth = 1; c.globalAlpha = 0.55; // the relief
        c.beginPath();
        c.moveTo(o.x - o.r * 0.6, o.y + o.r * 0.35); c.lineTo(o.x - o.r * 0.1, o.y - o.r * 0.1);
        c.lineTo(o.x + o.r * 0.35, o.y + o.r * 0.4); c.lineTo(o.x + o.r * 0.7, o.y - o.r * 0.2);
        c.stroke();
        c.globalAlpha = 1;
      } else if (theme.obstacle === 'cairn') {
        // ENVY: a stack of grey stones against the cliff, where the envious sit
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.beginPath(); c.ellipse(o.x, o.y + o.r * 0.7, o.r, o.r * 0.4, 0, 0, Math.PI * 2); c.fill();
        const st = [[0, 0.55, 0.9], [-0.12, 0.02, 0.72], [0.1, -0.42, 0.52], [0, -0.8, 0.3]];
        for (let i = 0; i < st.length; i++) {
          const [dx, dy, w] = st[i];
          c.fillStyle = i % 2 ? '#7c8a86' : '#616e6b';
          c.beginPath();
          c.ellipse(o.x + dx * o.r, o.y + dy * o.r, o.r * w, o.r * w * 0.46, 0, 0, Math.PI * 2);
          c.fill();
        }
      } else if (theme.obstacle === 'brazier') {
        // WRATH: the iron pans that make the smoke. The source of the blindness.
        c.fillStyle = '#2f2c28';
        c.fillRect(o.x - o.r * 0.18, o.y - o.r * 0.1, o.r * 0.36, o.r * 1.0); // stem
        c.fillStyle = '#4a453e';
        c.beginPath(); c.ellipse(o.x, o.y - o.r * 0.2, o.r * 0.85, o.r * 0.36, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1a1815'; // the pitch burning in it
        c.beginPath(); c.ellipse(o.x, o.y - o.r * 0.26, o.r * 0.62, o.r * 0.24, 0, 0, Math.PI * 2); c.fill();
        for (let i = 0; i < 3; i++) { // the smoke, rolling up
          const t = Date.now() / 620 + i * 2.1 + o.x * 0.02;
          const ry = (t % 1);
          c.fillStyle = `rgba(150,146,138,${0.30 * (1 - ry)})`;
          c.beginPath();
          c.arc(o.x + Math.sin(t * 3) * o.r * 0.35, o.y - o.r * 0.5 - ry * o.r * 1.5, o.r * (0.25 + ry * 0.5), 0, Math.PI * 2);
          c.fill();
        }
      } else if (theme.obstacle === 'terrace') {
        // SLOTH: a low step in the mountain path. The slothful run past it forever.
        c.fillStyle = '#42513f';
        c.fillRect(o.x - o.r, o.y - o.r * 0.5, o.r * 2, o.r * 1.0);
        c.fillStyle = '#55684f';
        c.fillRect(o.x - o.r, o.y - o.r * 0.5, o.r * 2, o.r * 0.34);
        c.strokeStyle = '#2c3a2c'; c.lineWidth = 1.3;
        c.strokeRect(o.x - o.r, o.y - o.r * 0.5, o.r * 2, o.r * 1.0);
        c.fillStyle = '#9ad0a4'; c.globalAlpha = 0.4; // grass in the joints
        for (let i = 0; i < 4; i++) c.fillRect(o.x - o.r * 0.8 + i * o.r * 0.5, o.y - o.r * 0.56, 2, 5);
        c.globalAlpha = 1;
      } else if (theme.obstacle === 'chain') {
        // AVARICE: the bindings. The avaricious lie face-down, hand and foot, who in
        // life would look at nothing but the ground.
        c.fillStyle = '#5a5540';
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.85, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#6d6749';
        c.beginPath(); c.arc(o.x - o.r * 0.2, o.y - o.r * 0.22, o.r * 0.5, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#e0cc84'; c.lineWidth = 2; c.globalAlpha = 0.8;
        for (let i = 0; i < 4; i++) { // the links, pinned into the rock
          const a = i * 1.57 + 0.4;
          c.beginPath();
          c.ellipse(o.x + Math.cos(a) * o.r * 0.95, o.y + Math.sin(a) * o.r * 0.95, 4.5, 3, a, 0, Math.PI * 2);
          c.stroke();
        }
        c.globalAlpha = 1;
      } else if (theme.obstacle === 'flamewall') {
        // LUST: the refining fire. Not the fire of Hell - this one is meant to
        // CLEAN you, and the only way onward is straight through it.
        c.save();
        c.shadowColor = '#ff9a4c'; c.shadowBlur = 14;
        for (let i = 0; i < 4; i++) {
          const t = Date.now() / 190 + i * 1.7 + o.x * 0.04;
          const h = o.r * (1.1 + Math.sin(t) * 0.30);
          const xo = (i - 1.5) * o.r * 0.44;
          c.fillStyle = i % 2 ? '#ffb27a' : '#ff7a3c';
          c.beginPath();
          c.moveTo(o.x + xo - o.r * 0.24, o.y + o.r * 0.6);
          c.quadraticCurveTo(o.x + xo - o.r * 0.1, o.y - h * 0.35, o.x + xo, o.y - h);
          c.quadraticCurveTo(o.x + xo + o.r * 0.1, o.y - h * 0.35, o.x + xo + o.r * 0.24, o.y + o.r * 0.6);
          c.closePath(); c.fill();
        }
        c.shadowBlur = 0;
        c.fillStyle = 'rgba(255,225,180,0.55)'; // the white heart of it
        c.beginPath(); c.ellipse(o.x, o.y + o.r * 0.35, o.r * 0.5, o.r * 0.22, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      } else if (theme.obstacle === 'blossom') {
        // THE EARTHLY PARADISE: the garden at the top of the mountain
        c.fillStyle = '#2f4a34';
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.85, 0, Math.PI * 2); c.fill();
        for (let i = 0; i < 6; i++) {
          const a = i * 1.047 + o.x * 0.01;
          c.fillStyle = i % 2 ? '#eaf7ea' : '#b7f0c0';
          c.beginPath();
          c.ellipse(o.x + Math.cos(a) * o.r * 0.5, o.y + Math.sin(a) * o.r * 0.5, o.r * 0.3, o.r * 0.18, a, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = '#ffd24c';
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.24, 0, Math.PI * 2); c.fill();
      } else if (theme.obstacle === 'crater') {
        // THE MOON: even the rock here is pocked and unreliable
        c.fillStyle = '#5a637f';
        c.beginPath(); c.arc(o.x, o.y, o.r, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#464e66';
        c.beginPath(); c.arc(o.x + o.r * 0.15, o.y + o.r * 0.1, o.r * 0.7, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#6d769a';
        c.beginPath(); c.arc(o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.3, 0, Math.PI * 2); c.fill();
      } else if (theme.obstacle === 'orrery') {
        // MERCURY: rings inside rings, turning. The machinery of the heavens.
        const t = Date.now() / 1100 + o.x * 0.02;
        c.save(); c.translate(o.x, o.y);
        for (let i = 0; i < 3; i++) {
          c.save(); c.rotate(t * (i % 2 ? -1 : 1) * (1 + i * 0.4));
          c.strokeStyle = '#a8d8e8'; c.globalAlpha = 0.5 + i * 0.15; c.lineWidth = 1.6;
          c.beginPath(); c.ellipse(0, 0, o.r * (1 - i * 0.2), o.r * (0.4 - i * 0.08), 0, 0, Math.PI * 2); c.stroke();
          c.restore();
        }
        c.globalAlpha = 1; c.fillStyle = '#e8f6ff';
        c.beginPath(); c.arc(0, 0, o.r * 0.28, 0, Math.PI * 2); c.fill();
        c.restore();
      } else if (theme.obstacle === 'rose') {
        // VENUS, and the Empyrean: the white rose of the blessed
        const white = theme.ambient === 'empyrean';
        for (let i = 4; i >= 1; i--) {
          c.fillStyle = white ? (i % 2 ? '#ffffff' : '#f3ead0') : (i % 2 ? '#ffb0d8' : '#e089b8');
          c.globalAlpha = 0.55 + i * 0.1;
          c.beginPath(); c.arc(o.x, o.y, o.r * (i / 4), 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;
        c.fillStyle = '#c9a227';
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.18, 0, Math.PI * 2); c.fill();
      } else if (theme.obstacle === 'halo') {
        // THE SUN: the wise, turning in a ring of light
        c.save();
        c.shadowColor = '#ffe08a'; c.shadowBlur = 16;
        c.strokeStyle = '#ffe08a'; c.lineWidth = 3; c.globalAlpha = 0.85;
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.9, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 0.4; c.lineWidth = 1.5;
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.55, 0, Math.PI * 2); c.stroke();
        c.restore();
        c.fillStyle = 'rgba(255,235,170,0.35)';
        c.beginPath(); c.arc(o.x, o.y, o.r * 0.42, 0, Math.PI * 2); c.fill();
      } else if (theme.obstacle === 'sword') {
        // MARS: the fallen soldiers, standing in a cross of light
        c.save();
        c.translate(o.x, o.y);
        c.shadowColor = '#ff9a8a'; c.shadowBlur = 10;
        c.strokeStyle = '#ffd0c4'; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.moveTo(0, -o.r); c.lineTo(0, o.r); c.stroke();
        c.beginPath(); c.moveTo(-o.r * 0.55, -o.r * 0.35); c.lineTo(o.r * 0.55, -o.r * 0.35); c.stroke();
        c.shadowBlur = 0;
        c.fillStyle = '#ff9a8a';
        c.beginPath(); c.arc(0, -o.r * 0.62, 3.2, 0, Math.PI * 2); c.fill();
        c.restore();
      } else if (theme.obstacle === 'scales') {
        // JUPITER: the scales of the just, hanging exactly level
        c.strokeStyle = '#a8c0ff'; c.lineWidth = 2; c.lineCap = 'round';
        c.beginPath(); c.moveTo(o.x, o.y - o.r * 0.8); c.lineTo(o.x, o.y + o.r * 0.7); c.stroke();
        c.beginPath(); c.moveTo(o.x - o.r * 0.8, o.y - o.r * 0.5); c.lineTo(o.x + o.r * 0.8, o.y - o.r * 0.5); c.stroke();
        for (const s of [-1, 1]) {
          c.fillStyle = '#8fa8e8';
          c.beginPath();
          c.ellipse(o.x + s * o.r * 0.8, o.y - o.r * 0.16, o.r * 0.3, o.r * 0.14, 0, 0, Math.PI); c.fill();
          c.strokeStyle = 'rgba(168,192,255,0.6)'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(o.x + s * o.r * 0.8, o.y - o.r * 0.5); c.lineTo(o.x + s * o.r * 0.8, o.y - o.r * 0.16); c.stroke();
        }
      } else if (theme.obstacle === 'ladder') {
        // SATURN: the golden ladder, going up out of sight
        c.strokeStyle = '#e8dcc0'; c.lineWidth = 2.4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(o.x - o.r * 0.5, o.y - o.r); c.lineTo(o.x - o.r * 0.5, o.y + o.r); c.stroke();
        c.beginPath(); c.moveTo(o.x + o.r * 0.5, o.y - o.r); c.lineTo(o.x + o.r * 0.5, o.y + o.r); c.stroke();
        c.lineWidth = 1.8; c.strokeStyle = '#c9a227';
        for (let i = 0; i < 4; i++) {
          const ry = o.y - o.r + (i + 0.5) * (o.r * 2 / 4);
          c.beginPath(); c.moveTo(o.x - o.r * 0.5, ry); c.lineTo(o.x + o.r * 0.5, ry); c.stroke();
        }
      } else if (theme.obstacle === 'star') {
        // THE FIXED STARS
        c.save();
        c.translate(o.x, o.y);
        c.shadowColor = '#dfe6ff'; c.shadowBlur = 14;
        c.fillStyle = '#ffffff';
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 ? o.r * 0.4 : o.r;
          const a = -Math.PI / 2 + i * Math.PI / 5;
          if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.closePath(); c.fill();
        c.restore();
      } else if (theme.obstacle === 'wheel') {
        // THE PRIMUM MOBILE: the sphere that turns all the others. It never stops.
        const t = Date.now() / 700 + o.x * 0.03;
        c.save(); c.translate(o.x, o.y); c.rotate(t);
        c.shadowColor = '#ffffff'; c.shadowBlur = 12;
        c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.globalAlpha = 0.9;
        c.beginPath(); c.arc(0, 0, o.r * 0.9, 0, Math.PI * 2); c.stroke();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * o.r * 0.9, Math.sin(a) * o.r * 0.9); c.stroke();
        }
        c.restore();
      } else {
        // plain rock (special rooms keep the classic look)
        c.fillStyle = pal.detail;
        c.beginPath(); c.arc(o.x, o.y, o.r, 0, Math.PI * 2); c.fill();
        c.fillStyle = pal.accent + '33';
        c.beginPath(); c.arc(o.x - o.r * 0.25, o.y - o.r * 0.3, o.r * 0.5, 0, Math.PI * 2); c.fill();
      }
    }
  }

  // masks the four square corners of the playfield with wall-colored notches and
  // a glowing lava rim, so a descent room reads as an oblong pit of fire. Purely
  // cosmetic - the collision rectangle underneath is unchanged.
  // The rounded corner notches that make a Descent arena read oblong. The rim used
  // to be hardcoded molten orange, which looked absurd once the circles stopped all
  // being fire - so it now glows in the CIRCLE's accent (grey in Limbo, gold in
  // Greed, pale blue off the ice in Treachery).
  function drawMoltenCorners(c, pal, accent) {
    const rim = accent || '#ff6a2c';
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
      c.strokeStyle = rim; c.shadowColor = rim; c.shadowBlur = 10; c.lineWidth = 3;
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

  // #181 (Sam) the trap chest: fat, gilded, and sitting alone in the middle of an
  // empty room - exactly the kind of thing a smart raider should be suspicious of.
  function drawTrapChest(c, ch) {
    c.save();
    c.translate(ch.x, ch.y);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(0, 14, 24, 7, 0, 0, Math.PI * 2); c.fill();
    if (!ch.opened) {
      c.fillStyle = '#6a4a2a'; c.fillRect(-22, -8, 44, 24);            // body
      c.fillStyle = '#7d5a35'; c.fillRect(-22, -16, 44, 10);           // lid
      c.strokeStyle = '#c9a227'; c.lineWidth = 2;
      c.strokeRect(-22, -16, 44, 32);
      c.beginPath(); c.moveTo(-22, -6); c.lineTo(22, -6); c.stroke();  // lid seam
      c.fillStyle = '#ffd24c'; c.fillRect(-4, -9, 8, 10);              // the LOCK
      c.fillStyle = '#0a0a0a'; c.fillRect(-1.5, -6, 3, 4);             // keyhole
      const t = Date.now() / 500;
      c.globalAlpha = 0.5 + Math.sin(t) * 0.25;                         // tempting shimmer
      c.strokeStyle = '#ffe08a'; c.lineWidth = 1;
      c.strokeRect(-25, -19, 50, 38);
      c.globalAlpha = 1;
    } else {
      c.fillStyle = '#4a3520'; c.fillRect(-22, -8, 44, 24);            // body, darker
      c.fillStyle = '#33261a'; c.fillRect(-24, -26, 48, 12);           // lid thrown back
      c.strokeStyle = '#8a7340'; c.lineWidth = 1.5;
      c.strokeRect(-22, -8, 44, 24);
      c.fillStyle = '#141414'; c.fillRect(-18, -6, 36, 8);             // dark maw
    }
    c.restore();
    // #200 (Sam) no label: a chest that ANNOUNCES itself is worse bait
  }

  // #75 the training barracks: a drill sergeant + five stat stations
  function drawBarracks(c, room) {
    const b = room.barracks;
    c.textAlign = 'center'; c.font = 'bold 16px monospace'; c.fillStyle = '#c9a227';
    c.fillText('TRAINING BARRACKS', PF.x + PF.w / 2, PF.y + 40);
    c.font = '11px monospace'; c.fillStyle = '#8fa3bf';
    const left = Math.max(0, BARRACKS_CAP - barracksTrained());
    c.fillText(`spend gold to sharpen your stats for this run  ·  ${left} training${left === 1 ? '' : 's'} left`, PF.x + PF.w / 2, PF.y + 56);
    const t = b.trainer;
    c.save(); c.translate(t.x, t.y);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(0, 16, 14, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5a6b4a'; c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8d3b0'; c.beginPath(); c.arc(0, -4, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a4a2a'; c.beginPath(); c.arc(0, -8, 8, Math.PI, 0); c.fill();
    c.restore();
    const maxed = barracksMaxed();
    for (const st of b.stations) {
      const cost = barracksCost(), afford = !maxed && g.player.coins >= cost;
      c.save(); c.translate(st.x, st.y);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(0, 20, 14, 5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#6a4a2a'; c.fillRect(-3, -4, 6, 26);
      c.fillStyle = st.color; c.beginPath(); c.arc(0, -10, 12, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.arc(-3, -13, 4, 0, Math.PI * 2); c.fill();
      c.restore();
      c.textAlign = 'center'; c.font = 'bold 11px monospace'; c.fillStyle = st.color;
      c.fillText(st.stat, st.x, st.y - 30);
      c.font = '10px monospace'; c.fillStyle = '#c8d0de';
      c.fillText(st.label, st.x, st.y + 34);
      c.font = 'bold 10px monospace'; c.fillStyle = maxed ? '#8fa3bf' : (afford ? '#ffd24c' : '#a05555');
      c.fillText(maxed ? 'MAXED' : '◉ ' + cost + (st.uses ? '  (x' + st.uses + ')' : ''), st.x, st.y + 48);
    }
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

    // #60 enchant table (regular shops): a runed table with a floating arcane orb
    if (room.shopStock.enchTable) {
      const et = room.shopStock.enchTable;
      c.save(); c.translate(et.x, et.y);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(0, 14, 26, 8, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a2456'; c.fillRect(-22, -2, 44, 16);       // table
      c.fillStyle = '#241c2e'; c.fillRect(-22, 10, 6, 8); c.fillRect(16, 10, 6, 8); // legs
      const pulse = 0.6 + Math.sin(g.time * 3) * 0.35;
      c.globalAlpha = pulse; c.fillStyle = '#b06bff';
      c.beginPath(); c.arc(0, -8, 6, 0, Math.PI * 2); c.fill();   // floating orb
      c.globalAlpha = 1; c.fillStyle = '#e0c0ff';
      c.beginPath(); c.arc(0, -8, 2.5, 0, Math.PI * 2); c.fill();
      c.font = '10px monospace'; c.textAlign = 'center'; c.fillStyle = 'rgba(176,107,255,0.8)';
      c.fillText('ENCHANT', 0, 30);
      c.restore();
    }
    // #187 the crafting corner: an ANVIL (weapons) and a MANNEQUIN (armor)
    if (room.shopStock.craft) {
      const cr = room.shopStock.craft;
      c.save(); c.translate(cr.anvil.x, cr.anvil.y);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(0, 14, 22, 7, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#4a4e57'; c.fillRect(-16, 2, 32, 8);           // anvil base
      c.fillStyle = '#5d6675'; c.fillRect(-19, -6, 38, 9);          // anvil body
      c.beginPath(); c.moveTo(19, -6); c.lineTo(29, -4); c.lineTo(19, 3); c.closePath(); c.fill(); // the horn
      const gk = 0.5 + Math.sin(g.time * 4) * 0.3;
      c.globalAlpha = gk; c.fillStyle = '#ff8a3d';
      c.beginPath(); c.arc(-4, -8, 2.5, 0, Math.PI * 2); c.fill();  // a hot ember on it
      c.globalAlpha = 1;
      c.font = '10px monospace'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,138,61,0.8)';
      c.fillText('FORGE', 0, 30);
      c.restore();
      c.save(); c.translate(cr.dummy.x, cr.dummy.y);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(0, 14, 14, 5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#6a4a2a'; c.fillRect(-1.5, -2, 3, 16);         // the stand
      c.fillStyle = '#8fa3bf'; c.beginPath(); c.arc(0, -12, 7, 0, Math.PI * 2); c.fill(); // torso form
      c.fillStyle = '#aab8cf'; c.fillRect(-9, -10, 18, 10);         // shoulders
      c.font = '10px monospace'; c.textAlign = 'center'; c.fillStyle = 'rgba(143,163,191,0.8)';
      c.fillText('TAILOR', 0, 30);
      c.restore();
    }

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
      if (it.kind === 'trinket') drawTrinketGlyph(c, it.trinket, it.x, it.y - 18, 1.4);
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
    UI.weaponSilhouette(c, w.archetype, Weapons.modelFor(w)); // shared unmistakable per-MODEL silhouette
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
    } else if (pk.kind === 'potionItem') {
      // #186 a little red flask: round body, cork, glint
      c.save(); c.translate(pk.x, pk.y + bobY);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(0, 9, 8, 3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c22a3e'; c.beginPath(); c.arc(0, 2, 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#8a1f2e'; c.fillRect(-2.5, -9, 5, 6);
      c.fillStyle = '#b08050'; c.fillRect(-3, -12, 6, 4);
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(-2.4, 0, 1.8, 0, Math.PI * 2); c.fill();
      c.restore();
    } else if (pk.kind === 'trinketItem') {
      drawTrinketGlyph(c, pk.trinket, pk.x, pk.y + bobY, 1);
    }
  }

  // #134 a trinket on the ground: a small faceted gem in the trinket's colour, on a
  // slow spin, so it reads as "a rare little thing" and not as another sword or vest.
  function drawTrinketGlyph(c, t, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.rotate(Math.sin(g.time * 1.5 + x) * 0.2);
    c.shadowColor = t.color; c.shadowBlur = 10;
    c.fillStyle = t.color;
    c.beginPath();
    c.moveTo(0, -9); c.lineTo(7, -2); c.lineTo(4, 8); c.lineTo(-4, 8); c.lineTo(-7, -2);
    c.closePath(); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,255,255,0.55)';   // a lit facet
    c.beginPath(); c.moveTo(0, -9); c.lineTo(7, -2); c.lineTo(0, 0); c.closePath(); c.fill();
    c.restore();
  }

  function drawInteractPrompt(c) {
    const t = nearestInteractable();
    if (!t) return;
    let x, y, label = 'E';
    if (t.kind === 'chest') { x = t.ch.x; y = t.ch.y - 34; label = 'E - open'; }
    if (t.kind === 'weaponPickup') { x = t.pk.x; y = t.pk.y - 30; label = `E take · X salvage +${[1,2,4,7,12,20][t.pk.weapon.rarIdx]}◈`; }
    if (t.kind === 'armorPickup') { x = t.pk.x; y = t.pk.y - 30; label = `E equip · X salvage +${[1,2,4,7,12,20][t.pk.armor.rarIdx]}◈`; }
    if (t.kind === 'trinketPickup') { x = t.pk.x; y = t.pk.y - 30; label = `E equip ${t.pk.trinket.name}`; } // #134 (the info card shows the gift/price)
    if (t.kind === 'potionPickup') { x = t.pk.x; y = t.pk.y - 30; label = 'E take potion'; } // #186
    if (t.kind === 'craftWeapon' || t.kind === 'craftArmor') { // #187
      const tier2 = Monsters.tierFor(g.floorNum, g.room.dist);
      const gold2 = Math.round((50 + 25 * (tier2 - 1)) * Math.pow(1.4, t.st.uses));
      const shards2 = Math.round((6 + 2 * (tier2 - 1)) * Math.pow(1.4, t.st.uses));
      x = t.st.x; y = t.st.y - 44;
      label = `E - craft ${t.kind === 'craftWeapon' ? 'a weapon' : 'armor'} (${gold2}g + ${shards2}◈)`;
    }
    if (t.kind === 'encounter') { x = t.e.x; y = t.e.y - 34; label = 'E to interact'; } // the quest giver (Sam)
    if (t.kind === 'shopItem') { x = t.it.x; y = t.it.y - 52; label = 'E - buy'; }
    if (t.kind === 'shopkeeper') { x = t.k.x; y = t.k.y - 40; label = g.room.shopStock.haggled ? 'E - (haggled)' : 'E - haggle (50/50: -30% or +30%)'; }
    if (t.kind === 'enchantTable') { x = t.et.x; y = t.et.y - 34; label = 'E - enchant weapon (swap an enchant)'; }
    if (t.kind === 'trainStation') { x = t.st.x; y = t.st.y - 46; label = barracksMaxed() ? 'fully trained this run' : `E - train ${t.st.stat} ${t.st.label} (${barracksCost()}g)`; } // #167 the REAL per-run price
    if (t.kind === 'trapChest') { x = t.st ? t.st.x : g.room.trapChest.x; y = g.room.trapChest.y - 44; label = 'E - open the chest'; } // #181
    if (t.kind === 'merc') { x = g.room.merc.x; y = g.room.merc.y - 42; label = `E - hire ${g.room.merc.cost}c`; }
    if (t.kind === 'pet') { x = g.room.pet.x; y = g.room.pet.y - 34; label = g.player.pet ? `E - stable ${g.room.pet.name}` : `E - befriend ${g.room.pet.name}`; }
    if (t.kind === 'stairs' || t.kind === 'portal' || t.kind === 'descentPortal' || t.kind === 'nightmareExit') return; // these draw their own prompt
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
    // #134 the trinket card: its gift, its price, and the story, BEFORE you commit -
    // because a trinket is a decision and you should get to read it first.
    let tr = null;
    if (t.kind === 'trinketPickup') tr = t.pk.trinket;
    if (t.kind === 'shopItem' && t.it.kind === 'trinket') tr = t.it.trinket;
    if (tr) drawTrinketCard(c, tr, x, y);
    c.restore();
  }

  function drawTrinketCard(c, tr, anchorX, anchorY, owned) {
    const lines = [
      { text: tr.name, color: tr.color, bold: true },
      { text: 'Trinket · the fourth slot', color: '#8fa3bf' },
      { text: tr.gift, color: '#6ee7a0' },
      // #170 (Sam) hovering the EQUIPPED trinket shows no price - you already own it.
      ...(owned ? [] : [{ text: `${tr.price} gold`, color: '#e0894a' }]), // #153 (Sam) was a raw number - drawGearCardLines .split()'d it and black-screened the game
      ...(tr.lore ? [{ text: `"${tr.lore}"`, color: '#9a8f7a', italic: true }] : []),
    ];
    drawGearCardLines(c, lines, anchorX, anchorY);
  }

  // a hovering stat card for a weapon or armor item, anchored above (anchorX, anchorY)
  function drawGearCard(c, w, anchorX, anchorY) {
    const ARCH_LABEL = { bow: 'Bow', heavy: 'Heavy melee', light: 'Light melee', wand: 'Wand · magic', staff: 'Staff · magic' };
    const subtitle = w.isArmor
      ? `Armor · ${Math.round(w.defense * 100)}% protection`
      : `${ARCH_LABEL[w.archetype] || 'Weapon'}${w.magicReq ? ` (Magic ${w.magicReq})` : ''} · ${w.dmg} dmg`;
    const lines = [
      { text: `${w.rarityName} ${w.name}`, color: w.color, bold: true },
      { text: subtitle, color: '#c8d2e0' },
      ...w.enchants.map(e => ({
        text: `${e.name}${e.level ? ' ' + ['', 'I', 'II', 'III'][e.level] : ''} - ${e.desc}`,
        color: e.tier === 3 ? '#ffd24c' : e.tier === 2 ? '#b88aff' : '#7fc79a',
      })),
      ...(w.flavor ? [{ text: `"${w.flavor}"`, color: '#9a8f7a', italic: true }] : []),
    ];
    drawGearCardLines(c, lines, anchorX, anchorY);
  }

  // #134 the box-rendering half of the gear card, split out so the trinket card
  // (drawTrinketCard) and the weapon/armour card share the exact same wrap + layout.
  function drawGearCardLines(c, lines, anchorX, anchorY) {
    const cw = 262, pad = 10, maxTextW = cw - pad * 2, lh = 15;
    c.save();
    // wrap every raw line to the box width, using each line's own font, so long
    // mythic flavor/enchant text stays INSIDE the card (bug: it used to overflow)
    const render = [];
    for (const l of lines) {
      const font = (l.bold ? 'bold 12px' : l.italic ? 'italic 11px' : '11px') + ' monospace';
      c.font = font;
      let cur = '';
      for (const wd of String(l.text).split(' ')) { // #153 never let a non-string line crash the render loop
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
    // the border wears the title's colour (the first line is always the item name in
    // its own colour) - drawGearCardLines no longer has the item object itself.
    c.strokeStyle = (lines[0] && lines[0].color) || '#b88aff'; c.lineWidth = 1.5;
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
    // #170 (Sam) the trinket (the fourth slot at x=158) had no hover card. Now it does.
    if (p.trinket && mx >= 158 && mx <= 158 + sh && my >= sy && my <= sy + sh) {
      drawTrinketCard(c, p.trinket, 158 + sh / 2, sy - 4, true);
    }
    // ability badge tooltips (Q / R / Ultimate): what does each do? Use UI's own
    // badge layout so the hover zone always tracks the real badges (they moved to
    // the bottom-right in #63; the old hard-coded centre layout stopped matching).
    // #226 the Q card shows your RANK and the milestone ladder - what each rank
    // unlocks, greyed until you reach it, "(coming soon)" until its wave ships.
    const qCls = (p.class && p.class.id) || '';
    const qStat = (Abilities.CLASS_STAT && Abilities.CLASS_STAT[qCls]) || '';
    const qRk = Abilities.qRank ? Abilities.qRank(qCls, p.statPoints) : 0;
    const FORGED = {
      'Q': `your ${(p.class && p.class.name) || 'class'} ability · RANK ${qRk}  (rank = your ${qStat})`,
      'R': 'forged from your first two evolutions',
      '★': 'right-click · forged from Q + R',
    };
    const LABEL = { 'Q': 'Q', 'R': 'R', '★': 'Ultimate' };
    for (const b of UI.abilityBadges(p)) {
      if (mx >= b.x && mx <= b.x + b.s && my >= b.y && my <= b.y + b.s) {
        let extra = [];
        if (b.key === 'Q' && Abilities.Q_MILESTONES && Abilities.Q_MILESTONES[qCls]) {
          extra = Abilities.Q_MILESTONES[qCls].map(ms => ({
            text: `RANK ${ms.at}: ${ms.txt}${ms.impl ? '' : ' (coming soon)'}`,
            color: qRk >= ms.at ? (ms.impl ? '#8fd0a0' : '#c9b98a') : '#5a6070',
          }));
        }
        drawAbilityCard(c, b.a, LABEL[b.key] || b.key, FORGED[b.key] || '', b.x + b.s / 2, b.y - 6, extra);
        break;
      }
    }
  }

  // hovering an ability badge explains the power and where it came from
  function drawAbilityCard(c, a, key, forged, anchorX, anchorY, extra) {
    const lines = [
      { text: a.name, color: a.color, bold: true },
      { text: `${key} · ${a.cdMax}s cooldown`, color: '#8fa3bf' },
      ...(a.desc ? wrapToLines(c, a.desc, 250) : []).map(t => ({ text: t, color: '#cdd4e2' })),
      { text: forged, color: '#9a8f7a', italic: true },
      ...(extra || []), // #226 the Q milestone ladder
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
    // jump straight to a floor (the only way to eyeball a deep Descent circle
    // without playing down to it). Rebuilds the floor exactly like a real descent.
    floor(n) {
      if (!g.player) return 'no run';
      g.floorNum = Math.max(1, n | 0);
      g.monsters = []; g.projectiles = [];
      startFloor();
      return Dungeon.themeFor(g.floorNum).name;
    },
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
    mpStart() { const seed = (Math.random() * 1e9) | 0; Net.sendR({ t: 'start', seed, hu: g.clientId, ff: g.lobbyFF ? 1 : 0, duel: g.lobbyDuel ? 1 : 0, hunt: g.lobbyHunt ? 1 : 0 }); startCoop(seed, g.clientId, g.lobbyFF, g.lobbyDuel, g.lobbyHunt); }, // #224/#240/#241
    mpState() { return { coop: g.coop, connected: typeof Net !== 'undefined' && Net.connected, isHost: Net && Net.isHost, code: Net && Net.code, peers: Net ? [...Net.peers] : [], remotes: [...g.remotePlayers.keys()], room: g.room && [g.room.gx, g.room.gy] }; },
    // testing: pretend a net message arrived (drives the real Net.on handlers)
    mpRecv(m) { if (typeof Net !== 'undefined' && Net._dispatch) Net._dispatch(m); return m && m.t; },
    // testing: force this client into guest mode so guest-only handlers run
    mpForceGuest() { g.coop = true; g.runHostU = 'someone-else'; setupNet(); if (typeof Net !== 'undefined') { Object.defineProperty(Net, 'isHost', { get: () => false, configurable: true }); Object.defineProperty(Net, 'id', { get: () => 'guest', configurable: true }); Object.defineProperty(Net, 'hostId', { get: () => 'host', configurable: true }); } return isCoopGuest(); },
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
  console.log('[dungeon] loaded - Barrowlight');
  // MOBILE: bind the touch layer to the SAME input object the desktop game reads, so a
  // synthetic 'KeyE' from a thumb is indistinguishable from a real keypress. Returns
  // false and does nothing at all on a device with a real pointer.
  if (typeof Mobile !== 'undefined' && Mobile.init(canvas, input, useUltimate, toggleFullscreen)) {
    console.log('[dungeon] touch controls ON');
  }
  maybeShowPatchNotes();
  fetchGlobalScores();            // #62 pull the global leaderboard for the title board
  setInterval(() => { if (g.state === 'title') fetchGlobalScores(); }, 300000); // refresh every 5 min on the title
  requestAnimationFrame(frame);
})();
