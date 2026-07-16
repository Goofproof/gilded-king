// ============================================================================
// achievements.js - ACCOLADES (#86). ~100 unlockable feats, persisted in
// g.meta.ach and surfaced on the title screen + as a toast the moment you earn
// one. Most are simple thresholds read from lifetime stats we accumulate at a
// handful of hook points (kills, hits, floors, evolutions, run start/end); a
// few are one-off flags set by special events (catch a goblin, cast an
// ultimate, clear a floor unscathed, ...).
//
// Hooks called from the game (all no-op-safe if this file is absent):
//   Ach.startRun(g)            - a run begins (records the class played)
//   Ach.kill(m, g)             - a monster died (m has type/isBoss/variant/fell)
//   Ach.hit(dmg, crit, g)      - a player/ally hit landed (tracks biggest crit/hit)
//   Ach.floor(n, g)            - entered floor n (tracks deepest, resets no-hit)
//   Ach.damaged(g)            - the player took damage this floor
//   Ach.evolve(stat, tier, g)  - a base stat evolved to tier (1-4)
//   Ach.level(lvl, g)          - the player reached a new level
//   Ach.cast(slot, g)          - cast an ability ('Q' | 'R' | 'ult')
//   Ach.flag(name, g)          - set a one-off flag (goblin/mimic/enchant/...)
//   Ach.floorCleared(g)        - every room on the floor is down
//   Ach.endRun(g, win)         - the run ended (win => victory)
//   Ach.tick(g)                - per-frame: track live maxes (hp/coins)
// ============================================================================
const Ach = (() => {
  // ---- catalog ---------------------------------------------------------------
  // each: { id, name, desc, test(S, g) -> bool }. S is a flat snapshot of stats.
  const LIST = [];
  const add = (id, name, desc, test) => LIST.push({ id, name, desc, test });
  // milestone family helper: one achievement per threshold on a stat key. If a
  // name repeats across tiers (name() buckets several thresholds), append a roman
  // numeral so every accolade reads distinctly (Cutthroat, Cutthroat II, ...).
  const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII'];
  const miles = (prefix, statKey, thresholds, name, descFn) => {
    const seen = {};
    // count how many thresholds share each name so single-name families get NO
    // numeral and repeated ones get II, III, ... (ROMAN[0] === '' is intentional -
    // don't let `||` swallow it into the fallback)
    const counts = {};
    thresholds.forEach(t => { const b = name(t); counts[b] = (counts[b] || 0) + 1; });
    thresholds.forEach(t => {
      const base = name(t);
      const nth = seen[base] || 0; seen[base] = nth + 1;
      const suffix = counts[base] > 1 ? (nth < ROMAN.length ? ROMAN[nth] : ` ${nth + 1}`) : '';
      add(`${prefix}${t}`, base + suffix, descFn(t), S => (S[statKey] || 0) >= t);
    });
  };

  // -- SLAYER: lifetime kills --------------------------------------------------
  miles('kill', 'kills', [25, 100, 300, 750, 1500, 3000, 6000],
    t => t >= 3000 ? 'Dungeon Reaper' : t >= 750 ? 'Exterminator' : t >= 100 ? 'Cutthroat' : 'First Blood',
    t => `Slay ${t} monsters (lifetime)`);

  // -- BOSSES ------------------------------------------------------------------
  miles('boss', 'bossKills', [1, 5, 15, 30], t => t >= 30 ? 'Kingslayer Eternal' : t >= 15 ? 'Throne Toppler' : t >= 5 ? 'Boss Hunter' : 'Giant Feller',
    t => `Defeat ${t} boss${t > 1 ? 'es' : ''}`);
  add('bossKing', 'The Gilded Fall', 'Slay the Mimic King', S => S.firstKing);
  add('bossColossus', 'Stone Breaker', 'Slay a Colossus', S => S.killColossus);
  add('bossMatriarch', 'Web Cutter', 'Slay a Matriarch', S => S.killMatriarch);
  add('bossDescent', 'Warden Down', 'Slay a Circle Warden in the Descent', S => S.killDescentBoss);

  // -- DEPTH -------------------------------------------------------------------
  miles('floor', 'floorMax', [2, 3, 4, 5, 6, 8, 10, 12, 15],
    t => t >= 15 ? 'Into the Abyss' : t >= 10 ? 'Deep Delver' : t >= 5 ? 'Spelunker' : 'Descender',
    t => `Reach floor ${t}`);
  miles('desc', 'descentMax', [1, 3, 6, 10], t => t >= 10 ? 'Endless Faller' : t >= 3 ? 'Abyss Walker' : 'The Plunge',
    t => `Reach Descent floor ${t}`);

  // -- WEALTH ------------------------------------------------------------------
  miles('coinrun', 'coinRunMax', [100, 300, 750, 1500, 3000],
    t => t >= 1500 ? 'Dragon Hoard' : t >= 750 ? 'Coin Baron' : t >= 300 ? 'Pockets Full' : 'Jingle',
    t => `Hold ${t} coins in one run`);
  miles('ess', 'essence', [50, 200, 600, 1500, 4000],
    t => t >= 4000 ? 'Essence Titan' : t >= 600 ? 'Soul Rich' : t >= 200 ? 'Essence Saver' : 'First Essence',
    t => `Bank ${t} total essence`);

  // -- POWER -------------------------------------------------------------------
  miles('crit', 'critMax', [100, 250, 500, 1000, 2000],
    t => t >= 2000 ? 'Annihilation' : t >= 1000 ? 'Overkill' : t >= 500 ? 'Devastator' : 'Heavy Hitter',
    t => `Land a ${t}-damage critical hit`);
  miles('hit', 'hitMax', [150, 400, 800], t => t >= 800 ? 'Sledgehammer' : t >= 400 ? 'Bonecrusher' : 'Solid Blow',
    t => `Deal ${t} damage in a single hit`);

  // -- SURVIVAL / VITALITY -----------------------------------------------------
  miles('hp', 'hpMax', [150, 250, 400, 600, 900], t => t >= 900 ? 'Immovable' : t >= 400 ? 'Ironhide' : t >= 250 ? 'Sturdy' : 'Hale',
    t => `Reach ${t} max health in a run`);
  miles('lvl', 'levelMax', [5, 10, 15, 20, 25], t => t >= 25 ? 'Ascended' : t >= 15 ? 'Veteran' : t >= 10 ? 'Seasoned' : 'Growing',
    t => `Reach level ${t} in a run`);
  miles('rooms', 'roomsRunMax', [5, 10, 20, 35], t => t >= 35 ? 'No Stone Unturned' : t >= 20 ? 'Thorough' : t >= 10 ? 'Explorer' : 'Wanderer',
    t => `Clear ${t} rooms in one run`);
  miles('roomstot', 'roomsLifetime', [50, 250, 1000], t => t >= 1000 ? 'Cartographer' : t >= 250 ? 'Pathfinder' : 'Roamer',
    t => `Clear ${t} rooms (lifetime)`);

  // -- EVOLUTIONS --------------------------------------------------------------
  const STAT_NAMES = { MIGHT: 'Might', VIGOR: 'Vigor', AGILITY: 'Agility', ARCANE: 'Arcane', FORTUNE: 'Fortune' };
  Object.keys(STAT_NAMES).forEach(st => add('evo' + st, `Path of ${STAT_NAMES[st]}`, `Evolve your ${STAT_NAMES[st]}`,
    (S, g) => ((g.meta.ach.stat.evoStats || {})[st] || 0) >= 1));
  add('evoT2', 'Refined', 'Reach a Tier II evolution', S => (S.evoMaxTier || 0) >= 2);
  add('evoT3', 'Transcendent', 'Reach a Tier III evolution', S => (S.evoMaxTier || 0) >= 3);
  add('evoT4', 'Apotheosis', 'Reach a Tier IV (max) evolution', S => (S.evoMaxTier || 0) >= 4);
  add('evoAll', 'Renaissance', 'Evolve all five base stats', S => (S.evoCount || 0) >= 5);
  add('evoTwo', 'Dual Path', 'Evolve two different stats in one account', S => (S.evoCount || 0) >= 2);

  // -- CLASSES -----------------------------------------------------------------
  miles('class', 'classes', [3, 6, 9], t => t >= 9 ? 'Jack of All Trades' : t >= 6 ? 'Versatile' : 'Multiclass',
    t => `Play ${t} different classes`);
  add('win1', 'Champion', 'Win a run (slay the King)', S => (S.wins || 0) >= 1);
  add('win3', 'Triumphant', 'Win 3 runs', S => (S.wins || 0) >= 3);
  add('win10', 'Legend', 'Win 10 runs', S => (S.wins || 0) >= 10);
  add('winClass3', 'Well Rounded', 'Win with 3 different classes', S => (S.classWins || 0) >= 3);
  add('winClass5', 'Master of Arms', 'Win with 5 different classes', S => (S.classWins || 0) >= 5);

  // -- COLLECTOR ---------------------------------------------------------------
  miles('myth', 'mythics', [1, 3, 6, 10], t => t >= 10 ? 'Mythic Curator' : t >= 3 ? 'Relic Hunter' : 'First Mythic',
    t => `Collect ${t} mythic item${t > 1 ? 's' : ''}`);
  miles('pet', 'pets', [1, 3, 6], t => t >= 6 ? 'Beastmaster' : t >= 3 ? 'Menagerie' : 'A Friend',
    t => `Befriend ${t} pet${t > 1 ? 's' : ''}`);

  // -- PERSISTENCE -------------------------------------------------------------
  miles('runs', 'runs', [5, 25, 75, 200], t => t >= 200 ? 'Obsessed' : t >= 75 ? 'Dedicated' : t >= 25 ? 'Regular' : 'Getting Started',
    t => `Play ${t} runs`);
  miles('death', 'deaths', [10, 50], t => t >= 50 ? 'Glutton for Punishment' : 'Learning Curve',
    t => `Die ${t} times`);
  add('prestige1', 'Reborn', 'Reach Prestige 1', S => (S.prestige || 0) >= 1);
  add('prestige3', 'Thrice Reborn', 'Reach Prestige 3', S => (S.prestige || 0) >= 3);

  // -- FEATS (one-off flags) ---------------------------------------------------
  add('goblin', 'Tax Collector', 'Catch a loot goblin before it escapes', S => S.goblinCaught);
  add('mimic', 'Not Today', 'Kill a mimic', S => S.mimicKill);
  add('pit1', 'Look Out Below', 'Knock an enemy into a pit', S => (S.pitKills || 0) >= 1);
  add('pit10', 'Gravity Always Wins', 'Knock 10 enemies into pits', S => (S.pitKills || 0) >= 10);
  add('pit25', 'Trap Master', 'Knock 25 enemies into pits', S => (S.pitKills || 0) >= 25);
  add('elite10', 'Elite Hunter', 'Slay 10 elite monsters', S => (S.elites || 0) >= 10);
  add('elite50', 'Elite Slayer', 'Slay 50 elite monsters', S => (S.elites || 0) >= 50);
  add('castUlt', 'Unleashed', 'Cast an ultimate ability', S => S.castUlt);
  add('castR', 'Fusion', 'Cast your forged R ability', S => S.castR);
  add('castQ', 'Signature Move', 'Cast your class Q ability', S => S.castQ);
  add('enchant', 'Runesmith', 'Enchant an item at the table', S => S.enchanted);
  add('barracks', 'Basic Training', 'Train a stat at the barracks', S => S.barracks);
  add('merc', 'Hired Help', 'Hire a mercenary', S => S.mercHired);
  add('noHitFloor', 'Untouchable', 'Clear a whole floor without taking damage', S => S.noHitFloor);
  add('fullClear', 'Clean Sweep', 'Fully clear every room on a floor', S => S.fullClear);
  add('mimicKing', 'Nerves of Steel', 'Reach the King on floor 3', S => (S.floorMax || 0) >= 3);
  add('swarm', 'Crowd Control', 'Slay 8 monsters in quick succession', S => S.multiKill);

  // -- KILL VARIETY (by weapon archetype) --------------------------------------
  const ARCHES = { heavy: 'Bruiser', bow: 'Marksman', wand: 'Spellslinger', light: 'Duelist', staff: 'Stormcaller' };
  Object.keys(ARCHES).forEach(a => add('arch' + a, ARCHES[a], `Score 50 kills with a ${a} weapon`,
    (S, g) => ((g.meta.ach.stat.archKills || {})[a] || 0) >= 50));

  // ---- persistence -----------------------------------------------------------
  function store(g) {
    if (!g.meta.ach) g.meta.ach = {};
    const a = g.meta.ach;
    if (!a.done) a.done = {};
    if (!a.stat) a.stat = {};
    if (!a.flags) a.flags = {};
    const s = a.stat;
    for (const k of ['kills', 'bossKills', 'deaths', 'runs', 'wins', 'roomsLifetime', 'goblins',
      'mimics', 'pitKills', 'elites', 'floorMax', 'descentMax', 'levelMax', 'critMax', 'hitMax',
      'hpMax', 'coinRunMax', 'roomsRunMax']) if (typeof s[k] !== 'number') s[k] = 0;
    if (!Array.isArray(s.classesPlayed)) s.classesPlayed = [];
    if (!Array.isArray(s.classWins)) s.classWins = [];
    if (!s.evoStats) s.evoStats = {};
    if (!s.archKills) s.archKills = {};
    return a;
  }

  // flat snapshot the tests read
  function snapshot(g) {
    const a = store(g), s = a.stat, f = a.flags;
    const evoStats = s.evoStats || {};
    const evoMaxTier = Object.keys(evoStats).reduce((m, k) => Math.max(m, evoStats[k] || 0), 0);
    return Object.assign({}, s, f, {
      mythics: (g.meta.mythics || []).length,
      pets: (g.meta.petsUnlocked || []).length,
      prestige: g.meta.prestige || 0,
      essence: g.meta.essence || 0,
      classes: (s.classesPlayed || []).length,
      classWins: (s.classWins || []).length,
      evoCount: Object.keys(evoStats).length,
      evoMaxTier,
    });
  }

  // evaluate every not-yet-earned achievement; toast + save any newly unlocked
  function check(g) {
    if (!g || !g.meta) return;
    const a = store(g);
    const S = snapshot(g);
    // #111 FIRST-EVER pass: an account that already had essence / mythics / pets /
    // prestige before accolades existed would otherwise unlock a wall of milestones
    // (and toast-spam) the instant they log in. Silently grandfather everything
    // already satisfied - the player keeps the credit in the gallery, but no toasts -
    // then only NEW progress from here on pops a banner.
    if (!a.baselined) {
      for (const ach of LIST) {
        if (a.done[ach.id]) continue;
        try { if (ach.test(S, g)) a.done[ach.id] = 1; } catch (e) { }
      }
      a.baselined = 1;
      if (typeof g.saveMeta === 'function') g.saveMeta();
      return false; // no toasts on the grandfather pass
    }
    let unlocked = false;
    for (const ach of LIST) {
      if (a.done[ach.id]) continue;
      let ok = false;
      try { ok = ach.test(S, g); } catch (e) { ok = false; }
      if (ok) {
        a.done[ach.id] = 1;
        unlocked = true;
        g.achToasts = g.achToasts || [];
        g.achToasts.push({ name: ach.name, desc: ach.desc, t: 4.5 });
        if (typeof Sfx !== 'undefined') Sfx.play('unlock');
      }
    }
    if (unlocked && typeof g.saveMeta === 'function') g.saveMeta();
    return unlocked;
  }

  // ---- hooks -----------------------------------------------------------------
  function startRun(g) {
    const a = store(g);
    g.run = { floorDamaged: false, recentKills: [] };
    const cls = g.meta.selectedClass || 'warrior';
    if (!a.stat.classesPlayed.includes(cls)) a.stat.classesPlayed.push(cls);
    a.stat.runs = (a.stat.runs || 0) + 1;
    check(g);
  }

  function kill(m, g) {
    if (!m || !g) return;
    const a = store(g), s = a.stat;
    s.kills++;
    s.roomsLifetime = s.roomsLifetime; // (rooms tracked on clear)
    // multi-kill window (8 within ~1.5s)
    g.run = g.run || {};
    const now = (g.time || 0);
    g.run.recentKills = (g.run.recentKills || []).filter(t => now - t < 1.5);
    g.run.recentKills.push(now);
    if (g.run.recentKills.length >= 8) a.flags.multiKill = 1;
    if (m.isBoss) {
      s.bossKills++;
      a.flags.firstKing = a.flags.firstKing || (!m.isDescentBoss && !m.forestBoss); // #251
      if (m.isDescentBoss) a.flags.killDescentBoss = 1;
      if (m.variant === 'colossus') a.flags.killColossus = 1;
      if (m.variant === 'matriarch') a.flags.killMatriarch = 1;
    }
    if (m.elite) s.elites = (s.elites || 0) + 1;
    if (m.fell) s.pitKills = (s.pitKills || 0) + 1;
    if (m.type === 'mimic') a.flags.mimicKill = 1;
    // a goblin that dies WITHOUT having escaped was caught
    if (m.type === 'goblin' && !m.escaped) a.flags.goblinCaught = 1;
    // credit the kill to the equipped weapon's archetype
    try {
      const w = g.player && g.player.weapon;
      const arch = w && (w.arch || w.archetype);
      if (arch) s.archKills[arch] = (s.archKills[arch] || 0) + 1;
    } catch (e) { }
    check(g);
  }

  function hit(dmg, crit, g) {
    if (!g || !dmg) return;
    const s = store(g).stat;
    const d = Math.round(dmg);
    if (d > (s.hitMax || 0)) s.hitMax = d;
    if (crit && d > (s.critMax || 0)) s.critMax = d;
    check(g);
  }

  function floor(n, g) {
    const s = store(g).stat;
    if (n > (s.floorMax || 0)) s.floorMax = n;
    if (typeof Descent !== 'undefined' && Descent.isDescent(n)) {
      const dd = n - 3;
      if (dd > (s.descentMax || 0)) s.descentMax = dd;
    }
    g.run = g.run || {};
    g.run.floorDamaged = false; // fresh no-hit chance each floor
    check(g);
  }

  function damaged(g) { g.run = g.run || {}; g.run.floorDamaged = true; }

  function evolve(stat, tier, g) {
    const s = store(g).stat;
    if (!stat) return;
    s.evoStats[stat] = Math.max(s.evoStats[stat] || 0, tier || 1);
    check(g);
  }

  function level(lvl, g) {
    const s = store(g).stat;
    if (lvl > (s.levelMax || 0)) s.levelMax = lvl;
    check(g);
  }

  function cast(slot, g) {
    const f = store(g).flags;
    if (slot === 'ult') f.castUlt = 1;
    else if (slot === 'R') f.castR = 1;
    else f.castQ = 1;
    check(g);
  }

  function flag(name, g) { store(g).flags[name] = 1; check(g); }

  function floorCleared(g) {
    const a = store(g);
    a.flags.fullClear = 1;
    if (g.run && !g.run.floorDamaged) a.flags.noHitFloor = 1;
    check(g);
  }

  function endRun(g, win) {
    const a = store(g), s = a.stat;
    if (win) {
      s.wins = (s.wins || 0) + 1;
      const cls = g.meta.selectedClass || 'warrior';
      if (!s.classWins.includes(cls)) s.classWins.push(cls);
    } else {
      s.deaths = (s.deaths || 0) + 1;
    }
    check(g);
  }

  // per-frame: cheap live maxes
  function tick(g) {
    const p = g.player; if (!p) return;
    const s = store(g).stat;
    if (p.maxHp > (s.hpMax || 0)) s.hpMax = Math.round(p.maxHp);
    if (p.coins > (s.coinRunMax || 0)) s.coinRunMax = p.coins;
    if ((p.roomsCleared || 0) > (s.roomsRunMax || 0)) s.roomsRunMax = p.roomsCleared;
    // periodic check (throttled): thresholds that only these track
    g._achTick = (g._achTick || 0) + 1;
    if (g._achTick % 20 === 0) check(g);
  }

  // called when a room is cleared to bump lifetime room count
  function roomCleared(g) { store(g).stat.roomsLifetime++; check(g); }

  // ---- queries for the UI ----------------------------------------------------
  function all() { return LIST; }
  function total() { return LIST.length; }
  function earnedCount(g) { const d = store(g).done; return LIST.filter(a => d[a.id]).length; }
  function isDone(g, id) { return !!store(g).done[id]; }

  return {
    startRun, kill, hit, floor, damaged, evolve, level, cast, flag,
    floorCleared, endRun, tick, roomCleared, check, snapshot,
    all, total, earnedCount, isDone,
  };
})();
