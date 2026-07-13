// ============================================================================
// evolutions.js - the upgrade evolution tree (Sam's design, 2026-07-10).
// Stack the same level-up pick to 3 / 6 / 9 / 12 and choose one of three
// themed evolutions for that stat.
//
// NAMING RULE (Sam): every evolution references something REAL - biology,
// physics, history, myth - catchy enough to be cool, obscure enough that the
// player googles it and learns something. Body of Theseus and Sanguivorous
// Gut Microbiome (Sam's own) set the bar.
//
// MAGNITUDE (Sam, 2026-07-11): buffs were too timid to feel. Every value was
// lifted so an evolution is a REAL power spike, not a rounding error. Tier I
// already reads on the HUD; Tier IV is a build-defining capstone. `reduce`
// still hard-caps at 60% in player.damage so tank stacks can't go invincible.
//
// fx legend (all additive unless noted):
//   healMult          all healing x(1+v)
//   theseus           healing scales with missing health: x(1 + v * missingFraction)
//   soulFeast         enemies dying within 140px heal v% of max HP
//   regenFlat         +v HP/s regeneration
//   overhealShield    healing past full grants a shield charm (bool)
//   lifeline          survive a killing blow at 1 HP, v times per run
//   reduce            damage taken x(1-v)  (total capped at 60%)
//   thorns            contact attackers take v damage
//   retaliateNova     taking a hit blasts v damage in a 130px ring
//   maxHpPct          +v% max health (applied immediately)
//   dmg               +v% damage (all sources)
//   dmgVsWounded      +v% damage vs enemies below 30% health
//   firstStrike       +v% damage vs enemies at full health
//   bossSlayer        +v% damage vs the boss
//   lowHpRage         +v% damage while YOU are below 35% health
//   spd               +v% move speed
//   windWake          rolling grants a speed burst for v seconds
//   phantomStep       +v seconds of i-frames on every roll
//   rollNova          rolling through enemies deals v damage
//   rollReset         kills refund v seconds of roll cooldown
//   rollCd            -v% roll cooldown
//   critCh            +v crit chance
//   critDmg           +v crit damage multiplier
//   critHeal          crits heal v HP
//   critBleed         crits ignite (bleed) at intensity v
//   coin              +v% coins
//   magnetR           +v px pickup magnet radius
//   midasPer/midasCap +1 damage per (midasPer) coins held, capped at midasCap
//   eliteCoins        elites drop +v bonus coins
//   atkSpd            +v% attack speed
//   frenzyMax         hits grant +2% attack speed for 3s, stacking to v
//   echo              light-melee swings have v chance to strike twice (2nd at 50%)
//   spellPower        wand/staff spell damage x(1+v)  (read in player.fireSpell)
//   blastBonus        +v px to staff-burst blast radius  (read in player.fireSpell)
// ============================================================================
// #46 STAT WEB (Sam + Claude, 2026-07-12): the nine stats sort into three schools.
//   MIGHT (kill fast): dmg, crit, atkspd
//   VIGOR (stay alive): hp, regen, roll
//   FLOW  (tempo/economy/arcane): spd, coin, magic
// The cross-school evolutions (e.g. Cursorial Hunter's dmg+spd) are the deliberate
// bridges. MAGIC finally gets its own tree below, themed to its FLOW school:
// Spell Power (raw arcane), Elemental Reach (bigger bursts), Cast Tempo (speed).
const Evolutions = (() => {

  const STAT_NAMES = {
    hp: 'TOUGH', dmg: 'BRUTAL', spd: 'FLEET', roll: 'ACROBAT',
    crit: 'DEADLY', coin: 'GREEDY', regen: 'MENDING', atkspd: 'FRENZY',
    magic: 'ARCANE',
  };

  // #46 which school each stat belongs to (drives the character-sheet grouping)
  const STAT_SCHOOL = {
    dmg: 'MIGHT', crit: 'MIGHT', atkspd: 'MIGHT',
    hp: 'VIGOR', regen: 'VIGOR', roll: 'VIGOR',
    spd: 'FLOW', coin: 'FLOW', magic: 'FLOW',
  };
  const SCHOOL_COLOR = { MIGHT: '#ffd24c', VIGOR: '#6ee7a0', FLOW: '#7fd4ff' };

  const TABLE = {
    // -------------------------------------------------- MENDING (regen)
    regen: {
      3: [
        { name: 'Body of Theseus', desc: 'Healing is stronger the more health you are missing (up to +150%)', fx: { theseus: 1.5 } },
        { name: 'Sanguivorous Gut Microbiome', desc: 'Enemies slain within arm\'s reach heal 3% of your max health', fx: { soulFeast: 3 } },
        { name: 'Kleptoplasty', desc: 'Steal the sun like a solar sea slug: regenerate +1.5 HP/s, always', fx: { regenFlat: 1.5 } },
      ],
      6: [
        { name: 'Axolotl Factor', desc: 'All healing +60%', fx: { healMult: 0.6 } },
        { name: 'Hirudotherapy', desc: 'Nearby deaths heal 6% of your max health', fx: { soulFeast: 6 } },
        { name: 'Tardigrade Tun', desc: 'Take 10% less damage and regenerate +1 HP/s', fx: { reduce: 0.10, regenFlat: 1.0 } },
      ],
      9: [
        { name: 'Planarian Split', desc: 'Regenerate +3.5 HP/s, always', fx: { regenFlat: 3.5 } },
        { name: 'Lamprey Covenant', desc: 'Nearby deaths heal 10%; low-health healing +80%', fx: { soulFeast: 10, theseus: 0.8 } },
        { name: 'Second Spleen', desc: 'Healing past full converts into a shield charm', fx: { overhealShield: 1 } },
      ],
      12: [
        { name: 'Telomerase Wellspring', desc: 'All healing +100% and regenerate +3 HP/s', fx: { healMult: 1.0, regenFlat: 3.0 } },
        { name: 'Vampire Finch', desc: 'Nearby deaths heal a monstrous 16% of max health', fx: { soulFeast: 16 } },
        { name: 'Lazarus Taxon', desc: 'Survive death twice per run, clinging on at 1 HP', fx: { lifeline: 2 } },
      ],
    },
    // -------------------------------------------------- TOUGH (hp)
    hp: {
      3: [
        { name: 'Osteoderm Plating', desc: 'Crocodile-bone skin: take 12% less damage', fx: { reduce: 0.12 } },
        { name: 'Hedgehog\'s Dilemma', desc: 'Enemies that touch you take 12 damage', fx: { thorns: 12 } },
        { name: 'Wolff\'s Law', desc: 'Bone builds under load: +25% max health', fx: { maxHpPct: 0.25 } },
      ],
      6: [
        { name: 'Mithridatism', desc: 'A little poison every day: take 18% less damage', fx: { reduce: 0.18 } },
        { name: 'Crown-of-Thorns', desc: 'Contact thorns deal 24 damage', fx: { thorns: 24 } },
        { name: 'Square-Cube Heresy', desc: 'The law says you can\'t scale up. Heresy: +40% max health', fx: { maxHpPct: 0.40 } },
      ],
      9: [
        { name: 'Testudo Formation', desc: 'Take 22% less damage; 16 thorns damage', fx: { reduce: 0.22, thorns: 16 } },
        { name: 'Bombardier Reflex', desc: 'Getting hit blasts 40 damage to everything nearby', fx: { retaliateNova: 40 } },
        { name: 'Blue Whale Heart', desc: '+55% max health', fx: { maxHpPct: 0.55 } },
      ],
      12: [
        { name: 'Osmium Lattice', desc: 'Densest matter there is: take 30% less damage', fx: { reduce: 0.30 } },
        { name: 'Pistol Shrimp Reprisal', desc: '50 thorns damage and a 60-damage snap when struck', fx: { thorns: 50, retaliateNova: 60 } },
        { name: 'Sauropod Scale', desc: '+95% max health', fx: { maxHpPct: 0.95 } },
      ],
    },
    // -------------------------------------------------- BRUTAL (dmg)
    dmg: {
      3: [
        { name: 'Coup de Grâce', desc: '+50% damage to enemies below 30% health', fx: { dmgVsWounded: 0.5 } },
        { name: 'Trapdoor Doctrine', desc: 'Spider patience: +65% damage to enemies at full health', fx: { firstStrike: 0.65 } },
        { name: 'Mantis Shrimp Strike', desc: 'Fastest punch in the ocean: +20% damage', fx: { dmg: 0.20 } },
      ],
      6: [
        { name: 'Regicide', desc: '+55% damage to bosses', fx: { bossSlayer: 0.55 } },
        { name: 'Berserkergang', desc: '+65% damage while below 35% health', fx: { lowHpRage: 0.65 } },
        { name: 'Newton\'s Second Law', desc: 'Force equals mass times acceleration: +30% damage', fx: { dmg: 0.30 } },
      ],
      9: [
        { name: 'Damnatio Memoriae', desc: 'Erase them: +100% damage to enemies below 30% health', fx: { dmgVsWounded: 1.0 } },
        { name: 'Cursorial Hunter', desc: 'Run them down: +25% damage and +14% move speed', fx: { dmg: 0.25, spd: 0.14 } },
        { name: 'Nantucket Sleighride', desc: 'Harpoon the big one: +80% damage to bosses', fx: { bossSlayer: 0.80 } },
      ],
      12: [
        { name: 'Occam\'s Cleaver', desc: 'The simplest solution: +65% damage', fx: { dmg: 0.65 } },
        { name: 'Running Amok', desc: 'Triple damage while below 35% health', fx: { lowHpRage: 2.0 } },
        { name: 'Trophic Cascade', desc: 'Apex predator effects: +80% vs the wounded AND the untouched', fx: { dmgVsWounded: 0.8, firstStrike: 0.8 } },
      ],
    },
    // -------------------------------------------------- FLEET (spd)
    // #46 sharpened: FLEET is pure MOVEMENT now - raw speed, slipstream (roll speed
    // burst), and a magnet/economy line (its FLOW bridge). Roll i-frames (phantomStep)
    // and roll-through damage (rollNova) belong to ACROBAT, not here - so the two
    // trees no longer read as one stat split in two.
    spd: {
      3: [
        { name: 'Sidewinder', desc: '+16% move speed', fx: { spd: 0.16 } },
        { name: 'Kármán Vortex', desc: 'Rolling leaves the air spinning: 1.5s speed burst after each roll', fx: { windWake: 1.5 } },
        { name: 'Lagrange Point', desc: 'Things fall toward you: +90px pickup magnet range', fx: { magnetR: 90 } },
      ],
      6: [
        { name: 'Mercurial Humour', desc: '+24% move speed', fx: { spd: 0.24 } },
        { name: 'Zephyrus Contract', desc: 'The west wind owes you: 2.4s speed burst after each roll', fx: { windWake: 2.4 } },
        { name: 'Lodestone Vein', desc: 'A natural magnet in your bones: +150px pickup range and +10% move speed', fx: { magnetR: 150, spd: 0.10 } },
      ],
      9: [
        { name: 'Cheetah Spine', desc: '+32% move speed', fx: { spd: 0.32 } },
        { name: 'Jet Stream Rider', desc: '3.2s roll speed burst and +14% move speed', fx: { windWake: 3.2, spd: 0.14 } },
        { name: 'Lorentz Draw', desc: 'Charge in a field bends toward you: +240px pickup range and +24% coins', fx: { magnetR: 240, coin: 0.24 } },
      ],
      12: [
        { name: 'Myelin Overdrive', desc: 'Insulated nerves fire faster: +55% move speed', fx: { spd: 0.55 } },
        { name: 'Coandă Effect', desc: 'The jet clings to your wake: 4.5s roll speed burst and +20% move speed', fx: { windWake: 4.5, spd: 0.20 } },
        { name: 'Meissner Effect', desc: 'Levitate over the field, sweeping it clean: +320px pickup range and +45% coins', fx: { magnetR: 320, coin: 0.45 } },
      ],
    },
    // -------------------------------------------------- ACROBAT (roll)
    roll: {
      3: [
        { name: 'Saccadic Masking', desc: 'Your brain edits out the blur: +0.16s of i-frames on every roll', fx: { phantomStep: 0.16 } },
        { name: 'Ukemi', desc: 'The judoka\'s art of falling: kills refund 0.25s of roll cooldown', fx: { rollReset: 0.25 } },
        { name: 'Crumple Zone', desc: 'Built to absorb the hit: take 9% less damage', fx: { reduce: 0.09 } },
      ],
      6: [
        { name: 'Escapology', desc: 'Houdini\'s trade: +0.24s of i-frames on every roll', fx: { phantomStep: 0.24 } },
        { name: 'Flywheel Effect', desc: 'Kills refund 0.5s of roll cooldown', fx: { rollReset: 0.5 } },
        { name: 'Pangolin Gambit', desc: 'Roll like armor: rolling through enemies deals 40 damage', fx: { rollNova: 40 } },
      ],
      9: [
        { name: 'Vestibular Overclock', desc: 'Inner ear, outer limits: -25% roll cooldown', fx: { rollCd: 0.25 } },
        { name: 'Boulder of Sisyphus', desc: 'Let them feel the rock: rolling through enemies deals 70 damage', fx: { rollNova: 70 } },
        { name: 'Matador\'s Veronica', desc: 'The slowest, closest pass: +0.3s roll i-frames, -14% cooldown', fx: { phantomStep: 0.3, rollCd: 0.14 } },
      ],
      12: [
        { name: 'Heisenberg Uncertainty', desc: 'Position unknowable: +0.5s of i-frames on every roll', fx: { phantomStep: 0.5 } },
        { name: 'Human Cannonball', desc: 'Rolling through enemies deals 120 damage', fx: { rollNova: 120 } },
        { name: 'Perpetuum Mobile', desc: 'The impossible machine: kills refund 0.8s, -25% roll cooldown', fx: { rollReset: 0.8, rollCd: 0.25 } },
      ],
    },
    // -------------------------------------------------- DEADLY (crit)
    crit: {
      3: [
        { name: 'Dim Mak', desc: 'The fabled death touch: +12% crit chance', fx: { critCh: 0.12 } },
        { name: 'Jugular Sense', desc: 'Crits hit 80% harder', fx: { critDmg: 0.8 } },
        { name: 'Desmodus Draw', desc: 'The vampire bat\'s trick: crits heal 4 HP', fx: { critHeal: 4 } },
      ],
      6: [
        { name: 'Obsidian Edge', desc: 'Sharper than surgical steel: +16% crit chance, +50% crit damage', fx: { critCh: 0.16, critDmg: 0.5 } },
        { name: 'Komodo Gambit', desc: 'The wound does the work: crits make enemies bleed', fx: { critBleed: 1 } },
        { name: 'Phlebotomy Dividend', desc: 'Bloodletting, but it pays YOU: crits heal 7 HP', fx: { critHeal: 7 } },
      ],
      9: [
        { name: 'Achilles Registry', desc: 'Every heel catalogued: crits hit 160% harder', fx: { critDmg: 1.6 } },
        { name: 'Artery Atlas', desc: '+24% crit chance', fx: { critCh: 0.24 } },
        { name: 'Ikejime Rhythm', desc: 'The cleanest cut: bleeding crits that also heal 6 HP', fx: { critBleed: 2, critHeal: 6 } },
      ],
      12: [
        { name: 'Madame Guillotine', desc: '+30% crit chance, +130% crit damage', fx: { critCh: 0.30, critDmg: 1.3 } },
        { name: 'Exsanguinator', desc: 'Savage bleeds; crits heal 10 HP', fx: { critBleed: 3, critHeal: 10 } },
        { name: 'Death of a Thousand Cuts', desc: '+45% crit chance', fx: { critCh: 0.45 } },
      ],
    },
    // -------------------------------------------------- GREEDY (coin)
    coin: {
      3: [
        { name: 'Numismatist\'s Pull', desc: 'Coins know a collector: +130px pickup magnet range', fx: { magnetR: 130 } },
        { name: 'Letter of Marque', desc: 'Licensed piracy: elites drop +4 bonus coins', fx: { eliteCoins: 4 } },
        { name: 'Midas Metacarpals', desc: '+1 damage per 40 coins held (max +16)', fx: { midasPer: 40, midasCap: 16 } },
      ],
      6: [
        { name: 'Dowser\'s Divining', desc: '+50% coins from everything', fx: { coin: 0.5 } },
        { name: 'Gold Standard', desc: '+1 damage per 30 coins held (max +22)', fx: { midasPer: 30, midasCap: 22 } },
        { name: 'War Profiteer', desc: 'Elites drop +7 bonus coins', fx: { eliteCoins: 7 } },
      ],
      9: [
        { name: 'Seigniorage', desc: 'Profit from the mint itself: +1 damage per 25 coins (max +32)', fx: { midasPer: 25, midasCap: 32 } },
        { name: 'Rare Earth Attractor', desc: '+220px magnet range, +32% coins', fx: { magnetR: 220, coin: 0.32 } },
        { name: 'Prize Court', desc: 'The admiralty rules in your favor: elites drop +10 coins', fx: { eliteCoins: 10 } },
      ],
      12: [
        { name: 'The Gilded Touch', desc: '+1 damage per 20 coins held (max +50)', fx: { midasPer: 20, midasCap: 50 } },
        { name: 'Mansa Musa Moment', desc: 'Richest human who ever lived: +130% coins', fx: { coin: 1.3 } },
        { name: 'King\'s Ransom', desc: 'Elites drop +18 coins; +160px magnet range', fx: { eliteCoins: 18, magnetR: 160 } },
      ],
    },
    // -------------------------------------------------- FRENZY (atkspd)
    atkspd: {
      3: [
        { name: 'Epinephrine Cascade', desc: 'Hits build +2% attack speed (3s), stacking to 8', fx: { frenzyMax: 8 } },
        { name: 'Fast-Twitch Fibers', desc: '+20% attack speed', fx: { atkSpd: 0.20 } },
        { name: 'Stroboscopic Strike', desc: 'Light swings have a 25% chance to strike twice', fx: { echo: 0.25 } },
      ],
      6: [
        { name: 'Neural Overclock', desc: '+30% attack speed', fx: { atkSpd: 0.30 } },
        { name: 'Battle Trance', desc: 'Frenzy: hits build +2% attack speed (3s), stacking to 16', fx: { frenzyMax: 16 } },
        { name: 'Flam Rudiment', desc: 'The drummer\'s double-hit: 40% chance light swings strike twice', fx: { echo: 0.40 } },
      ],
      9: [
        { name: 'Hummingbird Heart', desc: '1,200 beats a minute: +40% attack speed', fx: { atkSpd: 0.40 } },
        { name: 'Tarantism', desc: 'The dancing plague: hits build +2% attack speed (3s), stacking to 24', fx: { frenzyMax: 24 } },
        { name: 'Paradiddle Doctrine', desc: '50% chance light swings strike twice', fx: { echo: 0.50 } },
      ],
      12: [
        { name: 'Time Dilation', desc: '+60% attack speed', fx: { atkSpd: 0.60 } },
        { name: 'Thousand-Armed Kannon', desc: '70% of light swings strike twice', fx: { echo: 0.70 } },
        { name: 'St. Vitus\' Dance', desc: 'Frenzy: hits build +2% attack speed (3s), stacking to 40', fx: { frenzyMax: 40 } },
      ],
    },
    // -------------------------------------------------- ARCANE (magic)  [#46]
    // Three branches: Spell Power (raw) / Elemental Reach (bigger bursts) / Cast Tempo (speed)
    magic: {
      3: [
        { name: 'Dirac Sea', desc: 'Draw from the vacuum\'s infinite energy: +25% spell damage', fx: { spellPower: 0.25 } },
        { name: 'Brocken Spectre', desc: 'Your shadow looms huge on the cloud: +35px staff blast, +90px pickup range', fx: { blastBonus: 35, magnetR: 90 } },
        { name: 'Larmor Precession', desc: 'Spin faster in the field: +20% cast and attack speed', fx: { atkSpd: 0.20 } },
      ],
      6: [
        { name: 'Zero-Point Field', desc: 'Energy even at absolute zero: +40% spell damage', fx: { spellPower: 0.40 } },
        { name: 'Sympathetic Detonation', desc: 'One blast sets off the next: +55px staff blast radius', fx: { blastBonus: 55 } },
        { name: 'Saltatory Conduction', desc: 'The signal leaps node to node: +30% cast and attack speed', fx: { atkSpd: 0.30 } },
      ],
      9: [
        { name: 'Chandrasekhar Limit', desc: 'Past the point of collapse: +60% spell damage', fx: { spellPower: 0.60 } },
        { name: 'Kessler Syndrome', desc: 'A cascade with no end: +80px staff blast and +15% spell damage', fx: { blastBonus: 80, spellPower: 0.15 } },
        { name: 'Ballistospore', desc: 'Launched at ten-thousand g: +40% cast speed and +14% move speed', fx: { atkSpd: 0.40, spd: 0.14 } },
      ],
      12: [
        { name: 'Vacuum Decay', desc: 'Rewrite the laws themselves: +90% spell damage', fx: { spellPower: 0.90 } },
        { name: 'Tunguska Event', desc: 'Flatten the forest for miles: +120px staff blast radius', fx: { blastBonus: 120 } },
        { name: 'Nerve of Mauthner', desc: 'The fastest reflex in nature: +55% cast and attack speed', fx: { atkSpd: 0.55 } },
      ],
    },
  };

  const TIER_LABEL = { 3: 'I', 6: 'II', 9: 'III', 12: 'IV' };

  function optionsFor(statKey, stacks) {
    return (TABLE[statKey] && TABLE[statKey][stacks]) || null;
  }

  // ============================================================================
  // #stat-redesign (Sam, 2026-07-12): FIVE base stats. Each is fed by several
  // level-up "skill" cards; picking ANY of a stat's cards advances that ONE stat,
  // and at 3/6/9/12 points its evolution opens - drawn from the evolution trees of
  // the sub-stats it owns. So three different MIGHT picks (damage, crit, atk-speed)
  // in any order forge the MIGHT evolution; you never re-pick the same card.
  // ============================================================================
  const STATS = ['MIGHT', 'VIGOR', 'AGILITY', 'ARCANE', 'FORTUNE'];
  const STAT_TREES = {
    MIGHT:   ['dmg', 'crit', 'atkspd'], // kill fast
    VIGOR:   ['hp', 'regen'],           // stay alive
    AGILITY: ['spd', 'roll'],           // nimble / evasion
    ARCANE:  ['magic'],                 // spellcasting
    FORTUNE: ['coin'],                  // luck / economy
  };
  const STAT_COLOR = { MIGHT: '#ffd24c', VIGOR: '#6ee7a0', AGILITY: '#7fd4ff', ARCANE: '#b06bff', FORTUNE: '#ffce54' };
  const STAT_BLURB = { MIGHT: 'kill fast', VIGOR: 'stay alive', AGILITY: 'nimble & evasive', ARCANE: 'spellcasting', FORTUNE: 'luck & economy' };
  // reverse map: sub-stat evolution-tree key -> its base stat (for the char sheet)
  const STAT_OF = {};
  for (const s in STAT_TREES) for (const k of STAT_TREES[s]) STAT_OF[k] = s;

  // the evolution menu for a base stat: guarantee one option from each sub-tree it
  // owns (so you always see the flavors you invested in), then fill up to 3.
  function optionsForStat(stat, stacks) {
    const trees = STAT_TREES[stat];
    if (!trees) return null;
    const byTree = trees.map(tk => ((TABLE[tk] && TABLE[tk][stacks]) || []).map(o => ({ ...o, statKey: tk })));
    if (byTree.every(a => a.length === 0)) return null; // past tier IV: no more evolutions
    const out = [], rest = [];
    for (const arr of byTree) {
      if (!arr.length) continue;
      const i = (Math.random() * arr.length) | 0;
      out.push(arr[i]);
      arr.forEach((o, j) => { if (j !== i) rest.push(o); });
    }
    while (out.length < 3 && rest.length) out.push(rest.splice((Math.random() * rest.length) | 0, 1)[0]);
    return out.slice(0, 3);
  }

  return { TABLE, STAT_NAMES, STAT_SCHOOL, SCHOOL_COLOR, TIER_LABEL, optionsFor, STATS, STAT_TREES, STAT_COLOR, STAT_BLURB, STAT_OF, optionsForStat };
})();
