// ============================================================================
// abilities.js - the Q ability (Sam's design, 2026-07-11).
//
// RULE: the FIRST two evolutions a player picks intermingle into ONE unique
// active ability, bound to Q. The first evolution's stat chooses the ACTION
// (the shape of the power); the second evolution's stat chooses the MODIFIER
// (a twist folded onto it). 8 actions x 8 modifiers = 64 distinct Q powers,
// so two runs rarely wield the same thing.
//
// The ability object is fully resolved here at build time; main.js just reads
// its fields in useAbility(). Effects route through existing player buff
// channels (shield / rageT / hasteT / iframes / heal) so nothing new can break.
// ============================================================================
const Abilities = (() => {

  // PRIMARY: the first evolution's stat picks the action.
  //   kind: nova = radial blast | dash = blink + trail damage | strike =
  //   point-blank execute | buff = self power window.
  const ACTIONS = {
    hp:     { verb: 'Bulwark',   kind: 'nova',   color: '#7fd4ff', dmg: 55,  radius: 165, knock: 230, castShield: true },
    dmg:    { verb: 'Cleave',    kind: 'nova',   color: '#e05555', dmg: 120, radius: 185, knock: 260 },
    spd:    { verb: 'Blink',     kind: 'dash',   color: '#7fe0ff', dmg: 55,  dist: 285, iframe: 0.45 },
    roll:   { verb: 'Vault',     kind: 'dash',   color: '#b8f0ff', dmg: 75,  dist: 320, iframe: 0.60, refundRoll: true },
    crit:   { verb: 'Execute',   kind: 'strike', color: '#ff5a7a', dmg: 150, radius: 115, critAll: true },
    coin:   { verb: 'Coin Storm',kind: 'nova',   color: '#ffd24c', dmg: 45,  radius: 175, knock: 180, coinScale: true, coinBurst: 8 },
    regen:  { verb: 'Bloom',     kind: 'heal',   color: '#6ee7a0', heal: 0.4, radius: 220, castShield: true }, // #93 a real heal pulse (distinct from atkspd's buff), so R fusions vary
    atkspd: { verb: 'Overclock', kind: 'buff',   color: '#ffe08a', rageAfter: 6, hasteAfter: 6 },
    magic:  { verb: 'Arcane Surge', kind: 'nova', color: '#b06bff', dmg: 95, radius: 190, knock: 150 }, // #stat-redesign: ARCANE action (closes the "undefined" fusion bug)
  };

  // SECONDARY: the second evolution's stat picks the twist.
  //   tag names the ability; apply() mutates the resolved ability object.
  const MODS = {
    hp:     { tag: 'Aegis',    apply: a => { a.castShield = true; a.radius = Math.round((a.radius || 0) * 1.2); } },
    dmg:    { tag: 'Savage',   apply: a => { a.dmgMul = (a.dmgMul || 1) * 1.5; } },
    spd:    { tag: 'Swift',    apply: a => { a.hasteAfter = (a.hasteAfter || 0) + 3; a.cdMax *= 0.85; } },
    roll:   { tag: 'Phantom',  apply: a => { a.iframeAfter = (a.iframeAfter || 0) + 0.4; a.cdMax *= 0.9; } },
    crit:   { tag: 'Lethal',   apply: a => { a.critAll = true; a.dmgMul = (a.dmgMul || 1) * 1.25; } },
    coin:   { tag: 'Gilded',   apply: a => { a.coinBurst = (a.coinBurst || 0) + 14; } },
    regen:  { tag: 'Vital',    apply: a => { a.healOnCast = (a.healOnCast || 0) + 0.18; } },
    atkspd: { tag: 'Frenzied', apply: a => { a.rageAfter = (a.rageAfter || 0) + 4; a.hasteAfter = (a.hasteAfter || 0) + 2; } },
    magic:  { tag: 'Arcane',   apply: a => { a.dmgMul = (a.dmgMul || 1) * 1.3; a.radius = Math.round((a.radius || 0) * 1.15); } },
  };

  // same stat twice = a purified, amplified version of the pure action
  const PRIME_TAG = 'Prime';

  function build(statA, statB) {
    const act = ACTIONS[statA] || ACTIONS.dmg;
    const a = {
      key: `${statA}+${statB}`, primary: statA, secondary: statB,
      kind: act.kind, color: act.color, verb: act.verb,
      cdMax: 8, cd: 0,
    };
    // copy the action's numeric params
    for (const k of ['dmg', 'radius', 'knock', 'dist', 'iframe', 'heal',
                     'castShield', 'critAll', 'coinScale', 'coinBurst',
                     'refundRoll', 'rageAfter', 'hasteAfter']) {
      if (act[k] !== undefined) a[k] = act[k];
    }
    let tag;
    if (statA === statB) { a.dmgMul = (a.dmgMul || 1) * 1.6; if (a.heal) a.heal *= 1.4; tag = PRIME_TAG; }
    else { const mod = MODS[statB]; if (mod) { mod.apply(a); tag = mod.tag; } }
    a.cdMax = Math.round(a.cdMax * 10) / 10;
    a.name = `${tag} ${act.verb}`.trim();
    a.desc = describe(a);
    return a;
  }

  // a short, plain-English summary of what pressing Q does (for the HUD tooltip)
  function describe(a) {
    const bits = [];
    const dmg = Math.round((a.dmg || 0) * (a.dmgMul || 1));
    if (a.kind === 'nova' || a.kind === 'strike') {
      bits.push(`Blast nearby enemies for ${dmg}${a.critAll ? ' (crits)' : ''}`);
      if (a.knock) bits.push('knockback');
      if (a.coinScale) bits.push('scales with coins');
    } else if (a.kind === 'dash') {
      bits.push(`Dash through enemies for ${dmg} - you cannot be hit mid-dash`);
      if (a.refundRoll) bits.push('refunds your roll');
    } else if (a.kind === 'buff') {
      if (a.heal) bits.push(`Heal ${Math.round(a.heal * 100)}% max HP`);
      if (a.rageAfter) bits.push('rage (+damage)');
      if (a.hasteAfter) bits.push('haste (+speed)');
    } else if (a.kind === 'heal') {
      bits.push(`Heal ${Math.round((a.heal || 0.4) * 100)}% max HP and nearby allies`);
    } else if (a.kind === 'fear') {
      bits.push(`Terrify nearby enemies - they flee for ${a.dur || 5}s`);
    }
    if (a.castShield) bits.push('grants a shield');
    if (a.healOnCast) bits.push(`heals ${Math.round(a.healOnCast * 100)}%`);
    if (a.hasteAfter && a.kind !== 'buff') bits.push('then haste');
    if (a.rageAfter && a.kind !== 'buff') bits.push('then rage');
    return bits.join(' · ');
  }

  // ULTIMATE (left-click): once you have BOTH Q and R, you choose ONE of three
  // ultimates forged from those two abilities. Long cooldown, big payoff. Options:
  //  1) a supercharged Q,  2) a supercharged R,  3) a fusion cataclysm of both.
  function buildUltimates(q, r) {
    const amp = (a, name) => {
      const u = Object.assign({}, a);
      u.ult = true; u.cd = 0; u.cdMax = 15;
      u.dmg = Math.round((a.dmg || 60) * 2.2);
      u.dmgMul = (a.dmgMul || 1) * 1.5;
      if (u.radius) u.radius = Math.round(u.radius * 1.45);
      if (u.dist) u.dist = Math.round(u.dist * 1.3);
      if (u.heal) u.heal = Math.min(1, u.heal * 1.8);
      u.knock = Math.round((a.knock || 0) * 1.4) || u.knock;
      u.castShield = true; u.critAll = true;
      u.name = name; u.color = a.color;
      u.desc = describe(u);
      return u;
    };
    const u1 = amp(q, `${q.verb} PRIME`.toUpperCase());
    const u2 = amp(r, `${r.verb} PRIME`.toUpperCase());
    // fusion: a screen-shaking nova carrying both abilities' twists at once
    const fusion = {
      ult: true, kind: 'nova', color: '#ff2fb0', cd: 0, cdMax: 18,
      dmg: Math.round(((q.dmg || 60) + (r.dmg || 60)) * 1.6), dmgMul: 1, radius: 240, knock: 320,
      critAll: true, castShield: true, healOnCast: Math.max(q.heal || 0, r.heal || 0, 0.2),
      rageAfter: 6, hasteAfter: 6, name: 'FUSION CATACLYSM',
    };
    fusion.desc = describe(fusion);
    return [u1, u2, fusion];
  }

  // #30/#Q CLASS ABILITY (Q): each class has one fixed signature ability, available
  // from the start of the run (the evolution fusion is now R, and the ultimate is
  // this class Q fused with that R). Built from the same ACTION templates.
  const CLASS_Q = {
    '':      { base: 'atkspd', name: 'Adrenaline',    color: '#cdd4e2' },                 // buff: rage + haste
    warrior: { base: 'hp',     name: 'Shield Bash',   color: '#e0894a', dmg: 95, knock: 300 }, // nova + shield
    ranger:  { base: 'roll',   name: 'Tumble Volley', color: '#6ee7a0' },                 // dash + i-frames + roll refund
    mage:    { base: 'dmg',    name: 'Arcane Nova',   color: '#b06bff', dmg: 130, radius: 205 }, // big AoE burst
    rogue:   { base: 'crit',   name: 'Eviscerate',    color: '#ffd24c' },                 // point-blank execute, crits
    // #78 new classes - these declare `kind` directly (no ACTIONS base template)
    barbarian: { name: 'War Shout',   color: '#d6482e', kind: 'fear', dur: 5, radius: 300, cdMax: 9,
                 desc: 'A terrifying roar - every nearby enemy flees in fear for 5 seconds' },
    paladin:   { name: 'Lay on Hands', color: '#ffe08a', kind: 'buff', heal: 0.30, castShield: true, cdMax: 9,
                 desc: 'Heal 30% and raise a holy shield that blocks the next hit' },
    cleric:    { name: 'Mend',         color: '#8effc0', kind: 'heal', heal: 0.40, radius: 240, cdMax: 8,
                 desc: 'Channel light - heal yourself and every ally near you' },
    engineer:  { name: 'Deploy Turret', color: '#c9a227', kind: 'turret', cdMax: 1.5,
                 desc: 'Build an auto-turret at your feet - more charges as you level (up to 5)' },
    summoner:  { name: 'Summon Elemental', color: '#9ad0ff', kind: 'summon', cdMax: 9,
                 desc: 'Summon an elemental matching your weapon (earth if none). It fights until killed; the cooldown starts when it dies' },
    // #156 five new classes.
    mesmer:      { name: 'Mirror Image',  color: '#c78bff', kind: 'clones', clones: 3, dur: 8, cdMax: 11, dmg: 70, radius: 130,
                   desc: 'Split into three copies - enemies chase them instead of you, and each one detonates when it dies' },
    druid:       { name: 'Shapeshift',    color: '#7fd47f', kind: 'shift', cdMax: 1.2,
                   desc: 'Cycle Bear (tank), Wolf (fast, bleeds) and OWLBEAR (arcane bruiser - swipes grow with ARCANE)' },
    // #230 (Q-DESIGN, Sam) Unholy Rune retired: a cheat-death only pays off when you
    // were about to lose, so it could never be used SKILLFULLY. The death knight's Q
    // is now MIASMA - a plague that lands the moment you press it.
    deathknight: { name: 'Miasma',        color: '#7aa06a', kind: 'miasma', dur: 8, radius: 180, dps: 25, cdMax: 14,
                   desc: 'Exhale a cloud of rot - everything inside WITHERS (deals 20% less damage) and decays' },
    necromancer: { name: 'Raise Dead',    color: '#9ae6a0', kind: 'raise', cdMax: 10,
                   desc: 'Raise a skeletal knight. The grave gives more as you level: two knights, then three knights and two archers' },
    pyromancer:  { name: 'Immolate',      color: '#ff8a3d', kind: 'immolate', dps: 60, dur: 6, cdMax: 14, dmg: 90,
                   desc: 'EVERYTHING MUST BURN - the whole room catches, and the fire spreads from the dying to the living' },
  };
  // #109 every class Q grows with player level (like the Engineer's turret count).
  // Returns multipliers for the value-driven Qs; the turret/summon Qs additionally
  // fold a level term into their own scaling. Applied at cast time in castAbility.
  function qLevelScale(level) {
    const L = Math.max(1, level | 0);
    return {
      dmg: 1 + 0.07 * (L - 1),        // +7% ability damage per level
      radius: 1 + 0.03 * (L - 1),     // a little more reach
      heal: 1 + 0.05 * (L - 1),       // stronger heals
      knock: 1 + 0.02 * (L - 1),
      durBonus: Math.floor((L - 1) / 4) * 0.5, // +0.5s duration every 4 levels
    };
  }

  // #205 (Sam) each class's PRIMARY STAT: investing points in it now also grows the
  // class Q (see main.js useAbility). Thematic, not derived from the Q's card key.
  const CLASS_STAT = {
    '': 'MIGHT', warrior: 'MIGHT', barbarian: 'MIGHT',
    ranger: 'AGILITY', rogue: 'AGILITY', engineer: 'AGILITY',
    mage: 'ARCANE', summoner: 'ARCANE', mesmer: 'ARCANE', necromancer: 'ARCANE', pyromancer: 'ARCANE',
    paladin: 'VIGOR', cleric: 'VIGOR', druid: 'VIGOR', deathknight: 'VIGOR',
  };

  // #226 (Q-DESIGN.md, agreed with Sam 2026-07-15) THE Q RANK SYSTEM.
  // Your Q has a RANK = the points in your class's RULING STAT. Three layers:
  //   1. PERCENT RIDER: damage Qs add rider * target.maxHp per hit (bosses at 1/3),
  //      so a Q stays a constant FRACTION of a monster at every depth. Applied at
  //      the hit sites in main.js castAbility (per target, classQ casts only).
  //   2. PER-POINT CHANNELS: each point grows the Q's SIGNATURE quantity below.
  //      (The pet classes already scale per-stat at spawn time: skeletons +10%/ARCANE
  //      in riseSkeleton, elementals +12%/ARCANE, turrets +15%/AGILITY - those keep
  //      their own channels and are listed empty here.)
  //   3. MILESTONES at ranks 4/8/12 (Q_MILESTONES): discrete new features, shipped
  //      in waves; impl flips true as each wave lands. Tooltips show the ladder.
  const Q_TUNE = {
    '':          { rider: 0,    perPoint: { dur: 0.10 } },
    warrior:     { rider: 0.10, perPoint: { knock: 14 } },
    barbarian:   { rider: 0,    perPoint: { dur: 0.15 } },
    ranger:      { rider: 0.08, perPoint: { dist: 9 } },
    rogue:       { rider: 0.18, perPoint: { dmgMul: 0.06 } },
    engineer:    { rider: 0.03, perPoint: { rateMul: 0.04 } }, // consumed at turret build (fire rate)
    mage:        { rider: 0.10, perPoint: { radius: 5 } },
    summoner:    { rider: 0.03, perPoint: {} },
    mesmer:      { rider: 0.10, perPoint: { dur: 0.4 } },
    necromancer: { rider: 0,    perPoint: {} },
    pyromancer:  { rider: 0.02, perPoint: { dps: 4 } },  // rider is %/s folded into the burn
    paladin:     { rider: 0,    perPoint: { heal: 0.01 } },
    cleric:      { rider: 0,    perPoint: { heal: 0.01, radius: 6 } },
    druid:       { rider: 0,    perPoint: {} },          // forms rework in the VIGOR wave
    deathknight: { rider: 0.02, perPoint: { dps: 3 } }, // #230 Miasma: rider is rot %/s, points feed the poison
  };

  function qRank(classId, statPoints) {
    const st = CLASS_STAT[classId || ''];
    return ((st && statPoints && statPoints[st]) | 0);
  }

  // the agreed milestone ladder (Q-DESIGN.md). impl flips true as each wave ships;
  // unimplemented entries show in tooltips as "coming soon" - anticipation is content.
  const Q_MILESTONES = {
    '':          [{ at: 4, txt: 'Also refunds your roll', impl: true }, { at: 8, txt: 'Small heal on cast', impl: true }, { at: 12, txt: 'The rush extends to allies', impl: true }],
    warrior:     [{ at: 4, txt: 'Shield blocks 2 hits', impl: true }, { at: 8, txt: 'Knockback DOUBLES', impl: true }, { at: 12, txt: 'Wall slams hit a second time', impl: true }],
    barbarian:   [{ at: 4, txt: 'Feared enemies take +15% damage', impl: true }, { at: 8, txt: 'Allies near you gain rage', impl: true }, { at: 12, txt: 'Cornered enemies cower (stunned)', impl: true }],
    ranger:      [{ at: 1, txt: 'The volley is REAL: 3 arrows mid-dash', impl: true }, { at: 4, txt: 'A full CIRCLE of arrows', impl: true }, { at: 8, txt: 'Volley arrows pierce', impl: true }, { at: 12, txt: 'Two dash charges', impl: true }],
    rogue:       [{ at: 4, txt: 'A kill resets the cooldown', impl: true }, { at: 8, txt: 'Shadowstep behind your target', impl: true }, { at: 12, txt: 'Kills grant 1.5s of Vanish', impl: true }],
    engineer:    [{ at: 4, txt: 'Turret shots slow', impl: true }, { at: 8, txt: 'Turrets inherit your weapon element', impl: true }, { at: 12, txt: 'Oldest turret becomes a TESLA COIL', impl: true }],
    mage:        [{ at: 4, txt: 'Nova leaves a 2s slow field', impl: true }, { at: 8, txt: 'A second, smaller pulse', impl: true }, { at: 12, txt: 'Everything hit is chilled', impl: true }],
    summoner:    [{ at: 4, txt: 'Elemental gains its element aura', impl: true }, { at: 8, txt: 'TWO elementals', impl: true }, { at: 12, txt: 'Elementals explode on death', impl: true }],
    mesmer:      [{ at: 4, txt: 'FOUR clones', impl: true }, { at: 8, txt: 'Clones echo your attacks', impl: true }, { at: 12, txt: 'Recast to swap with a clone', impl: true }],
    necromancer: [{ at: 4, txt: 'Two knights', impl: true }, { at: 8, txt: '3 knights + 2 archers', impl: true }, { at: 12, txt: 'A BONE GOLEM joins', impl: true }],
    pyromancer:  [{ at: 4, txt: 'Bigger spread from the dying', impl: true }, { at: 8, txt: 'Fire immunity while it burns', impl: true }, { at: 12, txt: 'Burning enemies EXPLODE on death', impl: true }],
    paladin:     [{ at: 4, txt: 'Shield blocks 2 hits', impl: true }, { at: 8, txt: 'Cast cleanses bleeds and slows', impl: true }, { at: 12, txt: 'Overheal grants a bonus shield', impl: true }],
    cleric:      [{ at: 4, txt: 'Heals cure poison and bleed', impl: true }, { at: 8, txt: 'Leaves a consecrated regen circle', impl: true }, { at: 12, txt: 'Healed allies gain a shield', impl: true }],
    druid:       [{ at: 4, txt: 'Shifting heals 5%', impl: true }, { at: 8, txt: 'Each form gains a MOVE', impl: true }, { at: 12, txt: 'PRIMAL MASTERY: shifting fires the move', impl: true }],
    deathknight: [{ at: 4, txt: 'THE BLACK WIND: it follows you', impl: true }, { at: 8, txt: 'Regenerate while enemies rot', impl: true }, { at: 12, txt: 'Poison kills RISE as your skeletons', impl: true }],
  };

  function classAbility(classId) {
    const spec = CLASS_Q[classId] || CLASS_Q[''];
    const act = spec.base ? ACTIONS[spec.base] : null;
    const a = { key: 'class:' + (classId || 'adv'), classQ: true, kind: spec.kind || (act && act.kind), color: spec.color, verb: spec.name, cdMax: spec.cdMax || 7, cd: 0 };
    if (act) for (const k of ['dmg', 'radius', 'knock', 'dist', 'iframe', 'heal', 'castShield',
                     'critAll', 'coinScale', 'coinBurst', 'refundRoll', 'rageAfter', 'hasteAfter']) {
      if (act[k] !== undefined) a[k] = act[k];
    }
    for (const k of ['dmg', 'radius', 'knock', 'dist', 'iframe', 'heal', 'castShield',
                     'critAll', 'coinScale', 'coinBurst', 'refundRoll', 'rageAfter', 'hasteAfter', 'dur',
                     'clones', 'dps']) { // #156 mesmer clone count, pyromancer burn dps
      if (spec[k] !== undefined) a[k] = spec[k];
    }
    a.name = spec.name;
    a.desc = spec.desc || describe(a);
    return a;
  }

  // ULTIMATES (Sam): a POOL of wildly distinct room-scale powers, NOT amped Q/R.
  // You're offered 3 random ones to choose from, so builds feel unique. Each maps to
  // a `kind` handled in main.js castAbility(); numbers are first-pass and tunable.
  // #10 (Sam) each ult carries AFFINITY tags. rollUltimates scores them against your
  // build (evolution history + Q/R kinds) so the offer leans toward what you've been
  // stacking - a crit-burst build is far likelier to be offered CATACLYSM than MIDAS.
  // cdMax + numbers bumped: an ultimate is now a rarer, bigger moment.
  const ULTIMATES = [
    { id: 'meteor',    name: 'METEOR',          color: '#ff8a3d', kind: 'meteor',  dmg: 460, radius: 340, cdMax: 24, aff: ['dmg', 'magic'],        desc: 'Call down a colossal meteor where you aim - a massive delayed blast' },
    { id: 'inferno',   name: 'INFERNO',         color: '#ff5a2c', kind: 'inferno', dps: 85,  dur: 6,   cdMax: 22, aff: ['magic', 'dmg'],           desc: 'Every enemy in the room bursts into flame' },
    { id: 'timestop',  name: 'TIME STOP',       color: '#9ecbff', kind: 'sleep',   dur: 5,   cdMax: 26, aff: ['spd', 'roll'],                     desc: 'Freeze every enemy in place for a few seconds' },
    { id: 'blizzard',  name: 'DEEP FREEZE',     color: '#7fe0ff', kind: 'freeze',  dmg: 120, dur: 6,   cdMax: 22, aff: ['magic', 'hp'],            desc: 'The whole room ices over - enemies crawl and take frost damage' },
    { id: 'storm',     name: 'LIGHTNING STORM', color: '#ffe27a', kind: 'storm',   dmg: 150, strikes: 16, dur: 3.4, cdMax: 24, aff: ['crit', 'magic'], desc: 'Lightning hammers random enemies across the room' },
    { id: 'miasma',    name: 'POISON MIASMA',   color: '#8ef06e', kind: 'poison',  dps: 150, dur: 8,   cdMax: 22, aff: ['magic', 'regen'],         desc: 'A vast, roiling poison cloud rots everything in the room' },
    { id: 'vanish',    name: 'VANISH',          color: '#b6c0d0', kind: 'vanish',  dur: 6,   cdMax: 22, aff: ['roll', 'spd'],                     desc: 'Turn invisible - enemies lose track of you' },
    { id: 'midas',     name: 'MIDAS WAVE',      color: '#ffd24c', kind: 'midas',   dmg: 150, radius: 210, cdMax: 20, aff: ['coin'],                desc: 'A golden blast - every enemy here drops DOUBLE gold' },
    { id: 'caltrops',  name: 'CALTROPS',        color: '#c9a227', kind: 'caltrops', dur: 8,  cdMax: 20, aff: ['spd', 'roll'],                     desc: 'Scatter caltrops that cripple every enemy in the room' },
    { id: 'cataclysm', name: 'CATACLYSM',       color: '#ff2fb0', kind: 'nova',    dmg: 650, radius: 300, knock: 380, critAll: true, castShield: true, cdMax: 28, aff: ['dmg', 'crit'], desc: 'A screen-shaking blast that levels everything nearby' },
  ];
  // #10 build-weighted offer. `build` = { evo: [statKeys...], qKind, rKind }. Every ult
  // keeps a floor weight so nothing is impossible, but matches to your build multiply it.
  // NOTE: the ult OFFER is a LOCAL per-player menu, not shared sim state, so a weighted
  // Math.random sample is fine here (it was random before) - not a co-op desync vector.
  function rollUltimates(n, build) {
    const b = build || {};
    const evo = b.evo || [];
    const tally = {};
    for (const k of evo) tally[k] = (tally[k] || 0) + 1;
    const weightFor = (u) => {
      let w = 1; // floor so every ult can still appear
      for (const tag of (u.aff || [])) w += 2 * (tally[tag] || 0);
      if (b.qKind && (u.aff || []).includes(b.qKind)) w += 1.5;
      if (b.rKind && (u.aff || []).includes(b.rKind)) w += 1.5;
      return w;
    };
    const pool = ULTIMATES.slice(), out = [];
    for (let i = 0; i < n && pool.length; i++) {
      const weights = pool.map(weightFor);
      let total = weights.reduce((a, x) => a + x, 0), r = Math.random() * total, idx = 0;
      for (; idx < pool.length; idx++) { r -= weights[idx]; if (r <= 0) break; }
      if (idx >= pool.length) idx = pool.length - 1;
      out.push(Object.assign({ cd: 0, ult: true }, pool.splice(idx, 1)[0]));
    }
    return out;
  }

  // #84 three DISTINCT R candidates forged from your first two evolution picks: the
  // two orderings (action from one, modifier from the other) plus Prime variants, then
  // filled with pairings against common stats so you always get three real choices.
  // #84/#93 three R candidates forged from the first two evolution picks. Sam's
  // complaint: they all played the same, because [A,B]/[B,A]/[A,A]/[B,B] usually
  // share ONE kind (e.g. all novas). Now we deliberately spread the offer across
  // DISTINCT kinds (nova / dash / strike / buff / heal) so every choice feels
  // different - A and B still seed every option as its action or its modifier.

  // ==========================================================================
  // #252 FUSION v2 (FUSION-DESIGN.md) - the pair of BASE stats behind your first
  // two evolutions selects a named trio: STRIKE / STANCE / TRICK. Each fusion
  // carries a POWER RANK = combined points in its two governing stats, scaled at
  // cast time in castAbility with the Q_TUNE recipe (per-rank channels + %-of-
  // target riders). Pairs not in this table fall back to the legacy grid below
  // (waves 2-3 fill them in).
  const FUSIONS = {
    'MIGHT+VIGOR': [ // the Immovable
      { name: 'ATLAS', role: 'STRIKE', kind: 'nova', color: '#8fb7ff', dmg: 90, radius: 180, knock: 260, castShield: true, allyShield: true, fRider: true, cdMax: 9,
        pp: { dmg: 0.05, radius: 3 }, desc: 'Slam the ground: a heavy blast, and every ally caught in it gains a shield charge.' },
      { name: 'AJAX', role: 'STANCE', kind: 'fstance', stance: 'ajax', color: '#c9d6ff', dur: 5, reduce: 0.5, thorns: 10, cleave: true, cdMax: 14,
        pp: { thorns: 2, dur: 0.1 }, desc: 'Raise the tower shield: take half damage, sting attackers, and your swings cleave all around you.' },
      { name: 'ANTAEUS', role: 'TRICK', kind: 'froot', color: '#a9744f', dur: 3, regen: 8, burstCap: 220, cdMax: 12,
        pp: { regen: 1.2, burstCap: 20 }, desc: 'Root into the earth: regenerate fast, store the damage you take, then release it all as a burst.' },
    ],
    'AGILITY+VIGOR': [ // the Survivor
      { name: 'SECOND WIND', role: 'TRICK', kind: 'heal', color: '#6ee7a0', heal: 0.3, radius: 200, hasteAfter: 3, refundRoll: true, cdMax: 11,
        pp: { heal: 0.015 }, desc: 'Catch your breath: heal yourself and nearby allies, gain haste, and your roll comes back instantly.' },
      { name: 'MARATHON', role: 'STANCE', kind: 'fstance', stance: 'marathon', color: '#7fd4ff', dur: 6, regen: 4, cdMax: 14,
        pp: { regen: 0.8, dur: 0.12 }, desc: 'Run: speed builds every second and you heal while moving - reach full stride for a burst heal.' },
      { name: 'HOUDINI', role: 'STRIKE', kind: 'fvanish', color: '#b6c0d0', dur: 1.2, cdMax: 12,
        pp: { dur: 0.04 }, desc: 'Vanish: untouchable, shed every poison and slow, and your reappearance chills everything near you.' },
    ],
    'AGILITY+MIGHT': [ // the Tempest (#253 wave 2)
      { name: 'TYPHOON', role: 'STRIKE', kind: 'dash', color: '#7fd4ff', dmg: 60, dist: 300, exitBurst: true, fRider: true, cdMax: 10,
        pp: { dmg: 0.05, dist: 4 }, desc: 'Dash dragging a whirlwind: damage along the path, and a burst where you land.' },
      { name: 'ACHILLES', role: 'STANCE', kind: 'fstance', stance: 'achilles', color: '#ffd7a0', dur: 5, atkSpd: 0.4, spdMul: 0.18, noSlow: true, firstCrit: true, cdMax: 14,
        pp: { dur: 0.1, atkSpd: 0.02 }, desc: 'Fight like the legend: faster attacks and feet, nothing slows you, your first hit on each enemy crits.' },
      { name: 'PARTHIAN SHOT', role: 'TRICK', kind: 'fparthian', stance: 'parthian', color: '#e8c07a', dur: 6, cdMax: 13,
        pp: { dur: 0.12 }, desc: 'The horse-archer\'s retreat: while you back away, arrows fire behind you - and rolling reloads your weapon.' },
    ],
    'ARCANE+MIGHT': [ // the Spellblade (#253 wave 2)
      { name: 'EXCALIBUR', role: 'STRIKE', kind: 'fstance', stance: 'excalibur', color: '#cfeeff', dur: 8, beamMul: 0.9, cdMax: 14,
        pp: { dur: 0.15, beamMul: 0.02 }, desc: 'Draw the true sword: for a while, every melee swing sends a blade of light flying where you aim.' },
      { name: 'MJOLNIR', role: 'STANCE', kind: 'fstorm', stance: 'mjolnir', color: '#ffe27a', dur: 6, zap: 30, cdMax: 15,
        pp: { dur: 0.1, zap: 0.05 }, desc: 'The storm hammer: every beat, lightning strikes the nearest enemy and chains onward.' },
      { name: 'PROMETHEUS', role: 'TRICK', kind: 'fflame', stance: 'prometheus', color: '#ff8a3d', dur: 3, flameDmg: 9, ignite: 10, cdMax: 12,
        pp: { dur: 0.06, flameDmg: 0.6 }, desc: 'The stolen fire is a WEAPON: spray a torrent of flame wherever you aim, and everything it licks keeps burning.' },
    ],
    'AGILITY+ARCANE': [ // the Phantom (#253 wave 2)
      { name: 'HERMES', role: 'STRIKE', kind: 'dash', color: '#b06bff', dmg: 55, dist: 320, afterimages: true, fRider: true, cdMax: 11,
        pp: { dmg: 0.04, dist: 4 }, desc: 'Blink like the messenger god - three afterimages pulse with damage along your path.' },
      { name: 'QUICKSILVER', role: 'STANCE', kind: 'fstance', stance: 'quicksilver', color: '#c8d8e8', dur: 5, atkSpd: 0.3, echoBoost: 0.12, cdMax: 14,
        pp: { dur: 0.1, atkSpd: 0.015 }, desc: 'Become mercury: attacks and spells flow faster, and everything echoes more often.' },
      { name: 'MIRAGE', role: 'TRICK', kind: 'fdecoy', color: '#8ad6c8', dmg: 90, dur: 5, decoyHp: 120, fRider: true, cdMax: 15,
        pp: { dmg: 0.05, decoyHp: 10 }, desc: 'Leave a shimmering double that draws every eye - when it fades or falls, it detonates.' },
    ],
    'FORTUNE+MIGHT': [ // the Kingmaker (#254 wave 3)
      { name: 'CROESUS', role: 'STRIKE', kind: 'strike', color: '#ffd24c', dmg: 100, radius: 125, coinScale: true, coinLoose: 4, fRider: true, cdMax: 11,
        pp: { dmg: 0.04, radius: 2 }, desc: 'A strike that hits harder the richer you are - and knocks gold out of everything it touches.' },
      { name: 'EL DORADO', role: 'STANCE', kind: 'fstance', stance: 'eldorado', color: '#ffe08a', dur: 6, cdMax: 15,
        pp: { dur: 0.12 }, desc: 'The gilded city, briefly: kills fountain gold and every kill makes you hit harder.' },
      { name: "KING'S RANSOM", role: 'TRICK', kind: 'fmark', color: '#e8b52f', dmg: 40, fRider: true, cdMax: 18,
        pp: { dmg: 0.05 }, desc: 'Mark the richest head in the room: it takes a great wound now, and pays double when it falls.' },
    ],
    'ARCANE+VIGOR': [ // the Warden (#254 wave 3)
      { name: 'ASCLEPIUS', role: 'STRIKE', kind: 'heal', color: '#8effc0', heal: 0.22, radius: 210, ringDmg: 70, fRider: true, cdMax: 12,
        pp: { heal: 0.01, ringDmg: 0.05 }, desc: 'The serpent staff cuts both ways: heal everyone in the ring, wound everything else in it.' },
      { name: 'TROLL BLOOD', role: 'STANCE', kind: 'fstance', stance: 'trollblood', color: '#6ee7a0', dur: 8, regen: 10, cdMax: 16,
        pp: { dur: 0.1, regen: 1.0 }, desc: 'Folklore regeneration: knit back together fast - but a truly heavy hit stems the blood for a moment.' },
      { name: 'SANCTUARY', role: 'TRICK', kind: 'fzone', color: '#b06bff', dur: 5, radius: 150, cdMax: 15,
        pp: { dur: 0.1, radius: 2 }, desc: 'Consecrate the ground: allies standing in it heal, enemies inside it wade as if through deep water.' },
    ],
    'AGILITY+FORTUNE': [ // the Gambler (#254 wave 3)
      { name: 'HIGHWAYMAN', role: 'STRIKE', kind: 'dash', color: '#e8c07a', dmg: 60, dist: 300, rob: true, fRider: true, cdMax: 11,
        pp: { dmg: 0.04, dist: 4 }, desc: 'Stand and deliver: dash through the crowd and rob gold from every enemy you pass.' },
      { name: 'LUCKY STREAK', role: 'STANCE', kind: 'fstance', stance: 'luckystreak', color: '#ffce54', dur: 5, critCh: 0.15, critPay: true, cdMax: 14,
        pp: { dur: 0.1, critCh: 0.01 }, desc: 'Ride the streak: bonus crit chance that GROWS with every crit, and each crit pays a coin.' },
      { name: "RABBIT'S FOOT", role: 'TRICK', kind: 'ffoot', stance: 'rabbitsfoot', color: '#c9e8a0', dur: 4, cdMax: 15,
        pp: { dur: 0.08 }, desc: 'For a few charmed seconds every dodge roll is free - and enemies you roll through drop gold and shiver.' },
    ],
    'ARCANE+FORTUNE': [ // the Alchemist (#254 wave 3)
      { name: "PHILOSOPHER'S STONE", role: 'STRIKE', kind: 'ftoggle', stance: 'stone', color: '#c9a86a', drain: 4, cdMax: 2,
        pp: { power: 0.015 }, desc: 'A TOGGLE: while the stone burns, your gold drains away and ALL your damage is amplified. Press R again (or go broke) to stop.' },
      { name: 'GOLD RUSH', role: 'STANCE', kind: 'fstance', stance: 'goldrush', color: '#ffd24c', dur: 6, cdMax: 15,
        pp: { dur: 0.12 }, desc: 'Strike gold: every kill pays extra coins and shaves time off your Q.' },
      { name: 'ORACLE OF DELPHI', role: 'TRICK', kind: 'foracle', color: '#b06bff', dmg: 30, fRider: true, cdMax: 17,
        pp: { dmg: 0.04 }, desc: 'See everything: the whole floor is revealed, and every enemy in the room is struck by the insight and slowed.' },
    ],
    'MIGHT+MIGHT': [ // the Warlord (#255 Primes - pure specialization ranks TWICE as fast)
      { name: 'GORDIAN CUT', role: 'STRIKE', kind: 'strike', color: '#ff5a5a', dmg: 140, radius: 135, executeBelow: 0.5, fRider: true, cdMax: 11,
        pp: { dmg: 0.05, radius: 2 }, desc: 'One cut solves the knot: a heavy blow that deals DOUBLE damage to anything below half health.' },
      { name: 'BERSERK', role: 'STANCE', kind: 'fstance', stance: 'berserk', color: '#d6482e', dur: 5, cleave: true, rageAfter: 5, cdMax: 15,
        pp: { dur: 0.1 }, desc: 'The old fury: rage burns in you and every swing cleaves the full circle.' },
      { name: 'TREBUCHET', role: 'TRICK', kind: 'nova', color: '#c9a86a', dmg: 40, radius: 190, knock: 520, fRider: true, cdMax: 12,
        pp: { dmg: 0.03, radius: 3 }, desc: 'The superior siege weapon: launch everything around you across the room.' },
    ],
    'VIGOR+VIGOR': [ // the Colossus (#255)
      { name: 'RHINO', role: 'STRIKE', kind: 'dash', color: '#8fd0ff', dmg: 70, dist: 260, dashKnock: 430, fRider: true, cdMax: 11,
        pp: { dmg: 0.05, dist: 3 }, desc: 'Two tons of forward: charge the crowd and send everything you touch FLYING.' },
      { name: 'STONEWALL', role: 'STANCE', kind: 'fstance', stance: 'stonewall', color: '#a9b4c0', dur: 6, reduce: 0.6, thorns: 14, cdMax: 16,
        pp: { thorns: 2, dur: 0.1 }, desc: 'Stand like the wall: barely feel their hits, and every one stings them back.' },
      { name: 'HYDRA', role: 'TRICK', kind: 'heal', color: '#6ee7a0', heal: 0.5, radius: 200, castShield: true, cdMax: 14,
        pp: { heal: 0.015 }, desc: 'Cut one head, two grow back: a mighty heal for you and nearby allies, plus a shield charge.' },
    ],
    'AGILITY+AGILITY': [ // the Wind (#255)
      { name: 'ZEPHYR', role: 'STRIKE', kind: 'dash', color: '#b8f0ff', dmg: 65, dist: 420, refundRoll: true, fRider: true, cdMax: 10,
        pp: { dmg: 0.04, dist: 5 }, desc: 'Become the west wind: an enormous dash that cuts everything in its path and refunds your roll.' },
      { name: 'TAILWIND', role: 'STANCE', kind: 'fstance', stance: 'tailwind', color: '#7fd4ff', dur: 6, atkSpd: 0.45, spdMul: 0.22, noSlow: true, cdMax: 15,
        pp: { dur: 0.1, atkSpd: 0.02 }, desc: 'The wind at your back: faster hands, faster feet, and nothing can slow you.' },
      { name: 'SMOKE BOMB', role: 'TRICK', kind: 'fvanish', color: '#9aa4b0', dur: 1.6, smoke: true, cdMax: 13,
        pp: { dur: 0.05 }, desc: 'Vanish and leave the smoke BEHIND: a choking cloud that slows everyone who stands in it.' },
    ],
    'ARCANE+ARCANE': [ // the Archmage (#255)
      { name: 'SUPERNOVA', role: 'STRIKE', kind: 'nova', color: '#b06bff', dmg: 110, radius: 230, knock: 200, fRider: true, cdMax: 12,
        pp: { dmg: 0.05, radius: 4 }, desc: 'A dying star in a dungeon room: the biggest blast the forge can make.' },
      { name: 'TESLA COIL', role: 'STANCE', kind: 'fstorm', stance: 'mjolnir', color: '#9fe8ff', dur: 6, zap: 26, zapFast: true, cdMax: 15,
        zapChain: 2, pp: { dur: 0.1, zap: 0.05 }, desc: 'Crackle: lightning arcs to the nearest enemy on a RAPID beat and forks through two more.' },
      { name: 'EVENT HORIZON', role: 'TRICK', kind: 'fzone', color: '#7a5cff', dur: 6, radius: 170, grind: 14, cdMax: 16,
        pp: { dur: 0.1, radius: 3, grind: 1 }, desc: 'Bend the room: enemies inside crawl as if time thickened, and the void grinds them down.' },
    ],
    'FORTUNE+FORTUNE': [ // the Tycoon (#255)
      { name: 'JACKPOT', role: 'STRIKE', kind: 'strike', color: '#ffce54', dmg: 90, radius: 130, gamble: 0.25, fRider: true, cdMax: 12,
        pp: { dmg: 0.04, radius: 2, gamble: 0.005 }, desc: 'Pull the lever: one strike in four hits TRIPLE and showers gold from everything it touches.' },
      { name: 'GOLD STANDARD', role: 'STANCE', kind: 'fstance', stance: 'goldstandard', color: '#ffd24c', dur: 6, goldArmorCap: 0.4, critPay: true, critCh: 0.1, cdMax: 15,
        pp: { dur: 0.1, critCh: 0.008 }, desc: 'Back yourself with gold: your fortune is your armor, and every critical hit pays interest.' },
      { name: 'GOLDEN GOOSE', role: 'TRICK', kind: 'fgoose', stance: 'goldengoose', color: '#ffe08a', dur: 8, cdMax: 16,
        pp: { dur: 0.15 }, desc: 'The goose lays while you fight: a steady trickle of gold, as long as you keep it alive.' },
    ],
    'FORTUNE+VIGOR': [ // the Treasurer
      { name: 'BLOOD MONEY', role: 'STRIKE', kind: 'nova', color: '#e05555', dmg: 60, radius: 175, knock: 160, missingHp: 1.2, coinPerHit: 2, fRider: true, cdMax: 10,
        pp: { dmg: 0.04, radius: 3 }, desc: 'A blast that hits harder the more hurt you are - and every enemy struck pays a coin bounty.' },
      { name: 'FORT KNOX', role: 'STANCE', kind: 'fstance', stance: 'fortknox', color: '#ffd24c', dur: 6, goldArmorCap: 0.5, cdMax: 15,
        pp: { dur: 0.12 }, desc: 'Your gold is your armor: damage reduction scales with the coins you hold.' },
      { name: 'GOLDEN FLEECE', role: 'TRICK', kind: 'ffleece', color: '#ffe08a', charges: 2, mint: 6, cdMax: 16,
        pp: { charges: 0.15, mint: 0.5 }, desc: 'A shield that MINTS: every hit it eats pays out gold.' },
    ],
  };
  // the two evolutions' BASE stats, normalized to a sorted pair key (or null when
  // both picks share a school - Prime doubles keep the legacy amplified action)
  // NOTE: Evolutions.STAT_SCHOOL predates the 5-stat redesign (it still says FLOW),
  // so the pair comes from the schools recorded at evolution time; this local map is
  // only the fallback for old saves / tests that pass no schools.
  const FUSION_SCHOOL = { dmg: 'MIGHT', crit: 'MIGHT', atkspd: 'AGILITY', hp: 'VIGOR', regen: 'VIGOR', roll: 'AGILITY', spd: 'AGILITY', coin: 'FORTUNE', magic: 'ARCANE' };
  function fusionPairKey(hist, schools) {
    const a = (schools && schools[0]) || FUSION_SCHOOL[hist[0]];
    const b = (schools && schools[1]) || FUSION_SCHOOL[hist[1]];
    if (!a || !b) return null;
    // #255 same-school doubles get their PRIME trio - and since fusionRank sums the
    // pair, a pure build counts its stat twice: specialization ranks twice as fast.
    const stats = [a, b].sort();
    return { key: stats.join('+'), stats };
  }
  function fusionRank(sp, stats) { return ((sp && sp[stats[0]]) | 0) + ((sp && sp[stats[1]]) | 0); }
  function buildFusion(e, stats) {
    const a = Object.assign({ cd: 0 }, e);
    a.fusion = true; a.fusionStats = stats.slice(); a.verb = e.name;
    a.desc = `${e.role} \u00b7 ${e.desc} Grows with your ${stats[0]} + ${stats[1]} points.`;
    return a;
  }

  function rOptions(hist, schools) {
    // #252 a mapped base-stat pair offers its named trio instead of the legacy grid
    const fp = fusionPairKey(hist, schools);
    if (fp && FUSIONS[fp.key]) return FUSIONS[fp.key].map(e => buildFusion(e, fp.stats));
    const A = hist[0], B = hist[1];
    // action-varying seeds first (the action = first stat sets the KIND), so the
    // picker can find different kinds; each still pairs against one of the player's
    // own picks so the R stays "forged from your evolutions".
    const varyAction = ['crit', 'spd', 'regen', 'dmg', 'atkspd', 'roll', 'coin', 'magic', 'hp'];
    const seeds = [[A, B], [B, A]];
    for (const k of varyAction) { seeds.push([k, A]); seeds.push([k, B]); }
    seeds.push([A, A], [B, B]);
    for (const k of varyAction) seeds.push([A, k]);

    const out = [], seenName = new Set(), seenKind = new Set();
    const take = (x, y, requireNewKind) => {
      if (!x || !y || out.length >= 3) return;
      const r = build(x, y);
      if (seenName.has(r.name)) return;
      if (requireNewKind && seenKind.has(r.kind)) return;
      seenName.add(r.name); seenKind.add(r.kind); out.push(r);
    };
    for (const [x, y] of seeds) take(x, y, true);   // pass 1: distinct kinds
    for (const [x, y] of seeds) take(x, y, false);  // pass 2: fill any remaining slots
    return out;
  }

  return { build, buildUltimates, classAbility, rollUltimates, rOptions, describe, qLevelScale, ACTIONS, MODS, CLASS_Q, CLASS_STAT, ULTIMATES, Q_TUNE, Q_MILESTONES, qRank, FUSIONS, fusionRank };
})();
