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
                   desc: 'Cycle Bear (tanky, slow, huge hits), Wolf (fast, frail, bleeds) and Owl (flies, weak, untouchable)' },
    deathknight: { name: 'Unholy Rune',   color: '#8fd6d0', kind: 'undying', dur: 12, cdMax: 18, dmg: 150, radius: 240,
                   desc: 'LIFE AFTER DEATH - the next killing blow leaves you at 1 HP instead, and the room pays for it' },
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
    { id: 'miasma',    name: 'POISON MIASMA',   color: '#8ef06e', kind: 'poison',  dps: 75,  dur: 7,   cdMax: 22, aff: ['magic', 'regen'],         desc: 'A creeping poison cloud rots everything in the room' },
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
  function rOptions(hist) {
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

  return { build, buildUltimates, classAbility, rollUltimates, rOptions, describe, qLevelScale, ACTIONS, MODS, CLASS_Q, ULTIMATES };
})();
