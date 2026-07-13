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
    regen:  { verb: 'Bloom',     kind: 'buff',   color: '#6ee7a0', heal: 0.35, castShield: true },
    atkspd: { verb: 'Overclock', kind: 'buff',   color: '#ffe08a', rageAfter: 6, hasteAfter: 6 },
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
      bits.push(`Dash forward through enemies for ${dmg}, with i-frames`);
      if (a.refundRoll) bits.push('refunds your roll');
    } else if (a.kind === 'buff') {
      if (a.heal) bits.push(`Heal ${Math.round(a.heal * 100)}% max HP`);
      if (a.rageAfter) bits.push('rage (+damage)');
      if (a.hasteAfter) bits.push('haste (+speed)');
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
  };
  function classAbility(classId) {
    const spec = CLASS_Q[classId] || CLASS_Q[''];
    const act = ACTIONS[spec.base];
    const a = { key: 'class:' + (classId || 'adv'), classQ: true, kind: act.kind, color: spec.color, verb: spec.name, cdMax: 7, cd: 0 };
    for (const k of ['dmg', 'radius', 'knock', 'dist', 'iframe', 'heal', 'castShield',
                     'critAll', 'coinScale', 'coinBurst', 'refundRoll', 'rageAfter', 'hasteAfter']) {
      if (act[k] !== undefined) a[k] = act[k];
    }
    if (spec.dmg !== undefined) a.dmg = spec.dmg;
    if (spec.radius !== undefined) a.radius = spec.radius;
    if (spec.knock !== undefined) a.knock = spec.knock;
    a.name = spec.name;
    a.desc = describe(a);
    return a;
  }

  // ULTIMATES (Sam): a POOL of wildly distinct room-scale powers, NOT amped Q/R.
  // You're offered 3 random ones to choose from, so builds feel unique. Each maps to
  // a `kind` handled in main.js castAbility(); numbers are first-pass and tunable.
  const ULTIMATES = [
    { id: 'meteor',    name: 'METEOR',          color: '#ff8a3d', kind: 'meteor',  dmg: 300, radius: 200, cdMax: 16, desc: 'Call down a meteor where you aim - a huge delayed blast' },
    { id: 'inferno',   name: 'INFERNO',         color: '#ff5a2c', kind: 'inferno', dps: 55,  dur: 5,   cdMax: 15, desc: 'Every enemy in the room bursts into flame' },
    { id: 'timestop',  name: 'TIME STOP',       color: '#9ecbff', kind: 'sleep',   dur: 3.5, cdMax: 18, desc: 'Freeze every enemy in place for a few seconds' },
    { id: 'blizzard',  name: 'DEEP FREEZE',     color: '#7fe0ff', kind: 'freeze',  dmg: 70,  dur: 4.5, cdMax: 15, desc: 'The whole room ices over - enemies crawl and take frost damage' },
    { id: 'storm',     name: 'LIGHTNING STORM', color: '#ffe27a', kind: 'storm',   dmg: 95,  strikes: 11, dur: 3, cdMax: 16, desc: 'Lightning hammers random enemies across the room' },
    { id: 'miasma',    name: 'POISON MIASMA',   color: '#8ef06e', kind: 'poison',  dps: 45,  dur: 5.5, cdMax: 15, desc: 'A creeping poison cloud rots everything in the room' },
    { id: 'vanish',    name: 'VANISH',          color: '#b6c0d0', kind: 'vanish',  dur: 4,   cdMax: 15, desc: 'Turn invisible - enemies lose track of you' },
    { id: 'midas',     name: 'MIDAS WAVE',      color: '#ffd24c', kind: 'midas',   dmg: 90,  radius: 190, cdMax: 15, desc: 'A golden blast - every enemy here drops DOUBLE gold' },
    { id: 'caltrops',  name: 'CALTROPS',        color: '#c9a227', kind: 'caltrops', dur: 6,  cdMax: 14, desc: 'Scatter caltrops that cripple every enemy in the room' },
    { id: 'cataclysm', name: 'CATACLYSM',       color: '#ff2fb0', kind: 'nova',    dmg: 420, radius: 250, knock: 340, critAll: true, castShield: true, cdMax: 18, desc: 'A screen-shaking blast that levels everything nearby' },
  ];
  function rollUltimates(n) {
    const pool = ULTIMATES.slice(), out = [];
    for (let i = 0; i < n && pool.length; i++) {
      out.push(Object.assign({ cd: 0, ult: true }, pool.splice((Math.random() * pool.length) | 0, 1)[0]));
    }
    return out;
  }

  return { build, buildUltimates, classAbility, rollUltimates, describe, ACTIONS, MODS, CLASS_Q, ULTIMATES };
})();
