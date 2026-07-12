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
    return a;
  }

  return { build, ACTIONS, MODS };
})();
