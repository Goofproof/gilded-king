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
// ============================================================================
const Evolutions = (() => {

  const STAT_NAMES = {
    hp: 'TOUGH', dmg: 'BRUTAL', spd: 'FLEET', roll: 'ACROBAT',
    crit: 'DEADLY', coin: 'GREEDY', regen: 'MENDING', atkspd: 'FRENZY',
  };

  const TABLE = {
    // -------------------------------------------------- MENDING (regen)
    regen: {
      3: [
        { name: 'Body of Theseus', desc: 'Healing is stronger the more health you are missing (up to double)', fx: { theseus: 1.0 } },
        { name: 'Sanguivorous Gut Microbiome', desc: 'Enemies slain within arm\'s reach heal 2% of your max health', fx: { soulFeast: 2 } },
        { name: 'Kleptoplasty', desc: 'Steal the sun like a solar sea slug: regenerate +0.8 HP/s, always', fx: { regenFlat: 0.8 } },
      ],
      6: [
        { name: 'Axolotl Factor', desc: 'All healing +35%', fx: { healMult: 0.35 } },
        { name: 'Hirudotherapy', desc: 'Nearby deaths heal 4% of your max health', fx: { soulFeast: 4 } },
        { name: 'Tardigrade Tun', desc: 'Take 6% less damage and regenerate +0.5 HP/s', fx: { reduce: 0.06, regenFlat: 0.5 } },
      ],
      9: [
        { name: 'Planarian Split', desc: 'Regenerate +2 HP/s, always', fx: { regenFlat: 2.0 } },
        { name: 'Lamprey Covenant', desc: 'Nearby deaths heal 6%; low-health healing +50%', fx: { soulFeast: 6, theseus: 0.5 } },
        { name: 'Second Spleen', desc: 'Healing past full converts into a shield charm', fx: { overhealShield: 1 } },
      ],
      12: [
        { name: 'Telomerase Wellspring', desc: 'All healing +60% and regenerate +1.5 HP/s', fx: { healMult: 0.6, regenFlat: 1.5 } },
        { name: 'Vampire Finch', desc: 'Nearby deaths heal a monstrous 10% of max health', fx: { soulFeast: 10 } },
        { name: 'Lazarus Taxon', desc: 'Survive death once per run, clinging on at 1 HP', fx: { lifeline: 1 } },
      ],
    },
    // -------------------------------------------------- TOUGH (hp)
    hp: {
      3: [
        { name: 'Osteoderm Plating', desc: 'Crocodile-bone skin: take 8% less damage', fx: { reduce: 0.08 } },
        { name: 'Hedgehog\'s Dilemma', desc: 'Enemies that touch you take 6 damage', fx: { thorns: 6 } },
        { name: 'Wolff\'s Law', desc: 'Bone builds under load: +15% max health', fx: { maxHpPct: 0.15 } },
      ],
      6: [
        { name: 'Mithridatism', desc: 'A little poison every day: take 12% less damage', fx: { reduce: 0.12 } },
        { name: 'Crown-of-Thorns', desc: 'Contact thorns deal 12 damage', fx: { thorns: 12 } },
        { name: 'Square-Cube Heresy', desc: 'The law says you can\'t scale up. Heresy: +25% max health', fx: { maxHpPct: 0.25 } },
      ],
      9: [
        { name: 'Testudo Formation', desc: 'Take 15% less damage; 8 thorns damage', fx: { reduce: 0.15, thorns: 8 } },
        { name: 'Bombardier Reflex', desc: 'Getting hit blasts 20 damage to everything nearby', fx: { retaliateNova: 20 } },
        { name: 'Blue Whale Heart', desc: '+35% max health', fx: { maxHpPct: 0.35 } },
      ],
      12: [
        { name: 'Osmium Lattice', desc: 'Densest matter there is: take 22% less damage', fx: { reduce: 0.22 } },
        { name: 'Pistol Shrimp Reprisal', desc: '25 thorns damage and a 30-damage snap when struck', fx: { thorns: 25, retaliateNova: 30 } },
        { name: 'Sauropod Scale', desc: '+60% max health', fx: { maxHpPct: 0.6 } },
      ],
    },
    // -------------------------------------------------- BRUTAL (dmg)
    dmg: {
      3: [
        { name: 'Coup de Grâce', desc: '+30% damage to enemies below 30% health', fx: { dmgVsWounded: 0.3 } },
        { name: 'Trapdoor Doctrine', desc: 'Spider patience: +40% damage to enemies at full health', fx: { firstStrike: 0.4 } },
        { name: 'Mantis Shrimp Strike', desc: 'Fastest punch in the ocean: +12% damage', fx: { dmg: 0.12 } },
      ],
      6: [
        { name: 'Regicide', desc: '+35% damage to bosses', fx: { bossSlayer: 0.35 } },
        { name: 'Berserkergang', desc: '+40% damage while below 35% health', fx: { lowHpRage: 0.4 } },
        { name: 'Newton\'s Second Law', desc: 'Force equals mass times acceleration: +18% damage', fx: { dmg: 0.18 } },
      ],
      9: [
        { name: 'Damnatio Memoriae', desc: 'Erase them: +60% damage to enemies below 30% health', fx: { dmgVsWounded: 0.6 } },
        { name: 'Cursorial Hunter', desc: 'Run them down: +15% damage and +8% move speed', fx: { dmg: 0.15, spd: 0.08 } },
        { name: 'Nantucket Sleighride', desc: 'Harpoon the big one: +50% damage to bosses', fx: { bossSlayer: 0.5 } },
      ],
      12: [
        { name: 'Occam\'s Cleaver', desc: 'The simplest solution: +40% damage', fx: { dmg: 0.4 } },
        { name: 'Running Amok', desc: 'Double damage while below 35% health', fx: { lowHpRage: 1.0 } },
        { name: 'Trophic Cascade', desc: 'Apex predator effects: +50% vs the wounded AND the untouched', fx: { dmgVsWounded: 0.5, firstStrike: 0.5 } },
      ],
    },
    // -------------------------------------------------- FLEET (spd)
    spd: {
      3: [
        { name: 'Kármán Vortex', desc: 'Rolling leaves the air spinning: 1s speed burst after each roll', fx: { windWake: 1.0 } },
        { name: 'Sidewinder', desc: '+10% move speed', fx: { spd: 0.10 } },
        { name: 'Lagrange Point', desc: 'Things fall toward you: +50px pickup magnet range', fx: { magnetR: 50 } },
      ],
      6: [
        { name: 'Mercurial Humour', desc: '+15% move speed', fx: { spd: 0.15 } },
        { name: 'Zephyrus Contract', desc: 'The west wind owes you: 1.6s speed burst after each roll', fx: { windWake: 1.6 } },
        { name: 'Quantum Tunneling', desc: '+0.08s of i-frames on every roll', fx: { phantomStep: 0.08 } },
      ],
      9: [
        { name: 'Cheetah Spine', desc: '+20% move speed', fx: { spd: 0.20 } },
        { name: 'Tachypsychia', desc: 'Time slows when it matters: +0.15s of i-frames on every roll', fx: { phantomStep: 0.15 } },
        { name: 'Jet Stream Rider', desc: '2.2s roll speed burst and +8% move speed', fx: { windWake: 2.2, spd: 0.08 } },
      ],
      12: [
        { name: 'Myelin Overdrive', desc: 'Insulated nerves fire faster: +35% move speed', fx: { spd: 0.35 } },
        { name: 'Phase Velocity', desc: 'Faster than light (in a medium): +15% speed, +0.2s roll i-frames', fx: { spd: 0.15, phantomStep: 0.2 } },
        { name: 'Cherenkov Wake', desc: 'Your roll glows past the limit: 35 damage rolling through enemies, +10% speed', fx: { rollNova: 35, spd: 0.10 } },
      ],
    },
    // -------------------------------------------------- ACROBAT (roll)
    roll: {
      3: [
        { name: 'Saccadic Masking', desc: 'Your brain edits out the blur: +0.1s of i-frames on every roll', fx: { phantomStep: 0.10 } },
        { name: 'Ukemi', desc: 'The judoka\'s art of falling: kills refund 0.15s of roll cooldown', fx: { rollReset: 0.15 } },
        { name: 'Crumple Zone', desc: 'Built to absorb the hit: take 5% less damage', fx: { reduce: 0.05 } },
      ],
      6: [
        { name: 'Escapology', desc: 'Houdini\'s trade: +0.15s of i-frames on every roll', fx: { phantomStep: 0.15 } },
        { name: 'Flywheel Effect', desc: 'Kills refund 0.3s of roll cooldown', fx: { rollReset: 0.3 } },
        { name: 'Pangolin Gambit', desc: 'Roll like armor: rolling through enemies deals 20 damage', fx: { rollNova: 20 } },
      ],
      9: [
        { name: 'Vestibular Overclock', desc: 'Inner ear, outer limits: -15% roll cooldown', fx: { rollCd: 0.15 } },
        { name: 'Boulder of Sisyphus', desc: 'Let them feel the rock: rolling through enemies deals 40 damage', fx: { rollNova: 40 } },
        { name: 'Matador\'s Veronica', desc: 'The slowest, closest pass: +0.2s roll i-frames, -8% cooldown', fx: { phantomStep: 0.2, rollCd: 0.08 } },
      ],
      12: [
        { name: 'Heisenberg Uncertainty', desc: 'Position unknowable: +0.35s of i-frames on every roll', fx: { phantomStep: 0.35 } },
        { name: 'Human Cannonball', desc: 'Rolling through enemies deals 70 damage', fx: { rollNova: 70 } },
        { name: 'Perpetuum Mobile', desc: 'The impossible machine: kills refund 0.5s, -15% roll cooldown', fx: { rollReset: 0.5, rollCd: 0.15 } },
      ],
    },
    // -------------------------------------------------- DEADLY (crit)
    crit: {
      3: [
        { name: 'Dim Mak', desc: 'The fabled death touch: +8% crit chance', fx: { critCh: 0.08 } },
        { name: 'Jugular Sense', desc: 'Crits hit 50% harder', fx: { critDmg: 0.5 } },
        { name: 'Desmodus Draw', desc: 'The vampire bat\'s trick: crits heal 2 HP', fx: { critHeal: 2 } },
      ],
      6: [
        { name: 'Obsidian Edge', desc: 'Sharper than surgical steel: +10% crit chance, +30% crit damage', fx: { critCh: 0.10, critDmg: 0.3 } },
        { name: 'Komodo Gambit', desc: 'The wound does the work: crits make enemies bleed', fx: { critBleed: 1 } },
        { name: 'Phlebotomy Dividend', desc: 'Bloodletting, but it pays YOU: crits heal 4 HP', fx: { critHeal: 4 } },
      ],
      9: [
        { name: 'Achilles Registry', desc: 'Every heel catalogued: crits hit 100% harder', fx: { critDmg: 1.0 } },
        { name: 'Artery Atlas', desc: '+15% crit chance', fx: { critCh: 0.15 } },
        { name: 'Ikejime Rhythm', desc: 'The cleanest cut: bleeding crits that also heal 3 HP', fx: { critBleed: 2, critHeal: 3 } },
      ],
      12: [
        { name: 'Madame Guillotine', desc: '+20% crit chance, +80% crit damage', fx: { critCh: 0.20, critDmg: 0.8 } },
        { name: 'Exsanguinator', desc: 'Savage bleeds; crits heal 6 HP', fx: { critBleed: 3, critHeal: 6 } },
        { name: 'Death of a Thousand Cuts', desc: '+30% crit chance', fx: { critCh: 0.30 } },
      ],
    },
    // -------------------------------------------------- GREEDY (coin)
    coin: {
      3: [
        { name: 'Numismatist\'s Pull', desc: 'Coins know a collector: +80px pickup magnet range', fx: { magnetR: 80 } },
        { name: 'Letter of Marque', desc: 'Licensed piracy: elites drop +2 bonus coins', fx: { eliteCoins: 2 } },
        { name: 'Midas Metacarpals', desc: '+1 damage per 40 coins held (max +10)', fx: { midasPer: 40, midasCap: 10 } },
      ],
      6: [
        { name: 'Dowser\'s Divining', desc: '+30% coins from everything', fx: { coin: 0.3 } },
        { name: 'Gold Standard', desc: '+1 damage per 30 coins held (max +14)', fx: { midasPer: 30, midasCap: 14 } },
        { name: 'War Profiteer', desc: 'Elites drop +4 bonus coins', fx: { eliteCoins: 4 } },
      ],
      9: [
        { name: 'Seigniorage', desc: 'Profit from the mint itself: +1 damage per 30 coins (max +20)', fx: { midasPer: 30, midasCap: 20 } },
        { name: 'Rare Earth Attractor', desc: '+160px magnet range, +20% coins', fx: { magnetR: 160, coin: 0.2 } },
        { name: 'Prize Court', desc: 'The admiralty rules in your favor: elites drop +6 coins', fx: { eliteCoins: 6 } },
      ],
      12: [
        { name: 'The Gilded Touch', desc: '+1 damage per 25 coins held (max +30)', fx: { midasPer: 25, midasCap: 30 } },
        { name: 'Mansa Musa Moment', desc: 'Richest human who ever lived: +80% coins', fx: { coin: 0.8 } },
        { name: 'King\'s Ransom', desc: 'Elites drop +10 coins; +100px magnet range', fx: { eliteCoins: 10, magnetR: 100 } },
      ],
    },
    // -------------------------------------------------- FRENZY (atkspd)
    atkspd: {
      3: [
        { name: 'Epinephrine Cascade', desc: 'Hits build +2% attack speed (3s), stacking to 5', fx: { frenzyMax: 5 } },
        { name: 'Fast-Twitch Fibers', desc: '+12% attack speed', fx: { atkSpd: 0.12 } },
        { name: 'Stroboscopic Strike', desc: 'Light swings have a 15% chance to strike twice', fx: { echo: 0.15 } },
      ],
      6: [
        { name: 'Neural Overclock', desc: '+18% attack speed', fx: { atkSpd: 0.18 } },
        { name: 'Battle Trance', desc: 'Frenzy stacks to 10', fx: { frenzyMax: 10 } },
        { name: 'Flam Rudiment', desc: 'The drummer\'s double-hit: 25% chance light swings strike twice', fx: { echo: 0.25 } },
      ],
      9: [
        { name: 'Hummingbird Heart', desc: '1,200 beats a minute: +25% attack speed', fx: { atkSpd: 0.25 } },
        { name: 'Tarantism', desc: 'The dancing plague takes you: frenzy stacks to 15', fx: { frenzyMax: 15 } },
        { name: 'Paradiddle Doctrine', desc: '35% chance light swings strike twice', fx: { echo: 0.35 } },
      ],
      12: [
        { name: 'Time Dilation', desc: '+40% attack speed', fx: { atkSpd: 0.40 } },
        { name: 'Thousand-Armed Kannon', desc: 'Half of all light swings strike twice', fx: { echo: 0.5 } },
        { name: 'St. Vitus\' Dance', desc: 'Frenzy stacks to 25', fx: { frenzyMax: 25 } },
      ],
    },
  };

  const TIER_LABEL = { 3: 'I', 6: 'II', 9: 'III', 12: 'IV' };

  function optionsFor(statKey, stacks) {
    return (TABLE[statKey] && TABLE[statKey][stacks]) || null;
  }

  return { TABLE, STAT_NAMES, TIER_LABEL, optionsFor };
})();
