// ============================================================================
// descent.js - ENDLESS MODE: "The Descent" (Sam's son, designed 2026-07-11).
//
// Beat the Gilded King on floor 3 and a portal opens to The Descent - an
// endless plunge through the circles of hell that just gets harder. There is
// no bottom; the run ends when you die, and how deep you got is the score.
//
// This module owns everything that is DIFFERENT about descent floors so the
// base game's tuning tables stay untouched:
//   - the continuous difficulty curve past the tier-5 cap (threat)
//   - elite monster affixes
//   - which floors carry a boss / a mythic shop
//   - the recurring boss's recolor + rising anger
//   - the hell theme (names, palette) for descent floors
//
// ALL TUNING KNOBS ARE AT THE TOP. Change a number, refresh, play.
// ============================================================================
const Descent = (() => {

  // first floor of the descent (the Gilded King is floor 3, so the plunge is 4+)
  const FIRST_FLOOR = 4;
  const isDescent = f => f >= FIRST_FLOOR;

  // --- DIFFICULTY CURVE -------------------------------------------------------
  // The base game caps monster variety at tier 5 (monsters.js SPAWN_TABLE). Past
  // floor 3 we keep the tier-5 roster but multiply raw stats forever, so it never
  // flatlines. depth = floors below the King.
  function threat(f) {
    const d = Math.max(0, f - 3);
    return {
      // #126 the player out-scaled deep floors (a mage was one-shotting the floor-9
      // boss). HP now ACCELERATES with depth (quadratic term) so it barely moves on
      // floors 4-5 but keeps pace with a compounding build deep: d2 ~1.42, d6 ~2.62,
      // d12 ~5.32 (was linear 1.32 / 1.96 / 2.92).
      hp:    1 + 0.18 * d + 0.015 * d * d,
      dmg:   1 + 0.09 * d,             // damage climbs slower (still fair to dodge)
      speed: Math.min(1.45, 1 + 0.02 * d),
      count: 1 + 0.10 * d,             // more bodies per room, capped by spawnForRoom
    };
  }

  // --- ELITES -----------------------------------------------------------------
  // chance any given spawned monster is an elite, rising with depth
  function eliteChance(f) { return Math.min(0.45, 0.10 + 0.03 * (f - FIRST_FLOOR)); }

  // affix table. mul fields multiply the monster's stats; the rest are behaviour
  // flags read by monsters.js. color drives the elite ring + tint.
  const AFFIXES = [
    { key: 'giant',    name: 'Giant',    color: '#ff8a3d', hpMul: 1.9, dmgMul: 1.25, speedMul: 0.85, rMul: 1.45 },
    { key: 'swift',    name: 'Swift',    color: '#7fd4ff', hpMul: 0.9, dmgMul: 1.0,  speedMul: 1.55, rMul: 0.95 },
    { key: 'volatile', name: 'Volatile', color: '#ff4444', hpMul: 1.1, dmgMul: 1.0,  speedMul: 1.05, rMul: 1.05, blast: 120 },
  ];
  function rollAffix() { return AFFIXES[(Math.random() * AFFIXES.length) | 0]; }

  // --- FLOOR STRUCTURE --------------------------------------------------------
  // a Circle Warden (the recurring boss) guards every 3rd descent floor: 6, 9, 12
  const BOSS_EVERY = 3;
  function isBossFloor(f) { return isDescent(f) && ((f - FIRST_FLOOR) % BOSS_EVERY) === 2; }
  // a secret mythic shop opens every 5th floor overall: 5, 10, 15 ... (Phase 2)
  function isMythicFloor(f) { return isDescent(f) && f % 5 === 0; }

  // --- THE NINE CIRCLES -------------------------------------------------------
  // Each circle is a PLACE, not just a name. Before this, themeFor() returned one
  // hardcoded brimstone palette for every floor from 4 to infinity - so the whole
  // Descent was a single red room with a different sign on the door, which is
  // exactly why it stopped being interesting after a floor or two.
  //
  // Same contract as dungeon.js FLOOR_THEMES: {name, floor, wall, accent, detail,
  // obstacle, ambient} - plus `glow`, the backdrop wash (main.js used to hardcode
  // a red lava gradient for ALL descent floors, which would fight the ice and the
  // grey). obstacle -> a renderer in main.js drawRoom; ambient -> a soundscape in
  // audio.js.
  //
  // Dante's order, and Dante's ending: the bottom of Hell is NOT fire. The ninth
  // circle is a frozen lake. Eight floors of flame and then sudden silent ice is
  // the whole point of the descent.
  const CIRCLES = [
    { key: 'LIMBO', // colorless twilight - the virtuous pagans, no torment, no hope
      floor: '#24262b', wall: '#0d0e10', accent: '#8f97a3', detail: '#33363d',
      obstacle: 'monolith', ambient: 'limbo', glow: 'rgba(140,150,170,0.16)', glowTop: true },
    { key: 'LUST', // the souls blown forever on an unending storm
      floor: '#2a1a2e', wall: '#120a14', accent: '#c060ff', detail: '#3d2745',
      obstacle: 'plume', ambient: 'storm', glow: 'rgba(150,60,220,0.30)', glowTop: true },
    { key: 'GLUTTONY', // cold rain, foul mire
      floor: '#2b2a18', wall: '#14130a', accent: '#9aae4a', detail: '#3d3b22',
      obstacle: 'slop', ambient: 'swamp', glow: 'rgba(90,120,40,0.35)' },
    { key: 'GREED', // the hoarders and the wasters, rolling their weights
      floor: '#2e2718', wall: '#16120a', accent: '#ffd24c', detail: '#43391f',
      obstacle: 'hoard', ambient: 'castle', glow: 'rgba(200,150,40,0.30)' },
    { key: 'WRATH', // the marsh of the Styx - the sullen drowned beneath it
      floor: '#2a1414', wall: '#120808', accent: '#ff4444', detail: '#3d1e1e',
      obstacle: 'stump', ambient: 'swamp', glow: 'rgba(150,30,30,0.40)' },
    { key: 'HERESY', // the burning tombs of the City of Dis
      floor: '#2a1410', wall: '#0a0403', accent: '#ff6a2c', detail: '#3a1a12',
      obstacle: 'tomb', ambient: 'inferno', glow: 'rgba(150,26,0,0.55)' },
    { key: 'VIOLENCE', // Phlegethon, the river of boiling blood
      floor: '#2e1216', wall: '#14080a', accent: '#ff2a4a', detail: '#40191f',
      obstacle: 'brimstone', ambient: 'inferno', glow: 'rgba(170,10,30,0.55)' },
    { key: 'FRAUD', // Malebolge, the ditches of the deceivers - nothing here is what it looks like
      floor: '#221c2e', wall: '#100c18', accent: '#6effc0', detail: '#322a44',
      obstacle: 'mirror', ambient: 'storm', glow: 'rgba(60,200,150,0.22)', glowTop: true },
    { key: 'TREACHERY', // Cocytus. the frozen lake. the bottom.
      floor: '#1a2630', wall: '#0a1016', accent: '#7fd4ff', detail: '#26384a',
      obstacle: 'ice', ambient: 'ice', glow: 'rgba(120,200,255,0.26)', glowTop: true },
  ];

  const circleIndex = f => (f - FIRST_FLOOR) % CIRCLES.length;
  function circleName(f) {
    const loop = Math.floor((f - FIRST_FLOOR) / CIRCLES.length);
    const name = 'THE ' + CIRCLES[circleIndex(f)].key + ' CIRCLE';
    return loop > 0 ? name + ' · DEEPER' : name; // second loop and beyond
  }
  // ordinary descent rooms wear this; special rooms keep their signature palettes.
  // Pure function of the floor number, so host and guest agree with no seed sync.
  function themeFor(f) {
    return { ...CIRCLES[circleIndex(f)], name: circleName(f) };
  }

  // --- RECURRING BOSS: recolor + rising anger --------------------------------
  // Each time you meet the King in the Descent he wears a new color and looks
  // angrier. anger = how many descent bosses you've faced (0-based); it only
  // rises. Palettes cycle so the color is "different each time".
  const BOSS_PALS = [
    { body: '#7a2a1e', lidLo: '#5a1c12', lid: '#8a3320', trim: '#ff7a3c', crown: '#ff5a2c', jewel: [255, 60, 40] },   // ember
    { body: '#4a1f5e', lidLo: '#331545', lid: '#5a2470', trim: '#c060ff', crown: '#b84cff', jewel: [224, 60, 255] }, // amethyst
    { body: '#123a5a', lidLo: '#0c2740', lid: '#184a70', trim: '#4aa0ff', crown: '#3ca0ff', jewel: [60, 200, 255] }, // abyssal
    { body: '#1a4a2a', lidLo: '#0f3018', lid: '#245a34', trim: '#4cff9a', crown: '#3cff8a', jewel: [60, 255, 140] }, // venom
    { body: '#1a1416', lidLo: '#0c0809', lid: '#2a1c20', trim: '#ff3030', crown: '#ff2020', jewel: [255, 20, 20] },  // obsidian rage
  ];
  // palette adjective + archetype noun -> a themed title. Deeper Wardens rotate
  // the archetype so no two Descent bosses are the same creature.
  const PAL_ADJ = ['ASHEN', 'HOLLOW', 'DROWNED', 'VENOM', 'OBSIDIAN'];
  const BOSS_VARIANTS = ['king', 'colossus', 'matriarch'];
  const VARIANT_NOUN = { king: 'KING', colossus: 'COLOSSUS', matriarch: 'MATRIARCH' };
  const VARIANT_SUB = {
    king: 'the King claws his way back, angrier',
    colossus: 'a mountain of stone stirs and rises',
    matriarch: 'the brood-mother descends, fangs bared',
  };

  // Called when a descent boss is created. Reads/advances g.circleBossSeen and
  // returns the config boss.js needs. hp/dmg muls fold in the depth threat too.
  function bossConfig(g) {
    const anger = g.circleBossSeen || 0;
    g.circleBossSeen = anger + 1;
    const t = threat(g.floorNum);
    const idx = anger % BOSS_PALS.length;
    const variant = BOSS_VARIANTS[anger % BOSS_VARIANTS.length];
    return {
      anger,
      variant,
      pal: BOSS_PALS[idx],
      name: 'THE ' + PAL_ADJ[idx] + ' ' + VARIANT_NOUN[variant],
      subtitle: VARIANT_SUB[variant],
      hpMul: t.hp * (1 + 0.18 * anger),   // #126 beefier each appearance (was 0.12), on top of the steeper depth curve so a burst build can't delete a Warden
      dmgMul: t.dmg,
    };
  }

  // essence a descent boss coughs up (scales with depth)
  function bossEssence(f) { return 12 + Math.floor((f - 3) * 1.5); }

  // chance a Circle Warden drops a mythic (the ONLY source besides the mythic shop)
  const MYTHIC_DROP_CHANCE = 0.5;

  // --- PETS -------------------------------------------------------------------
  // Little creatures that stand dormant in a room until you activate them with E
  // (spawn chances live in dungeon.js). One follows you at a time and grants a
  // passive buff (the key/val fold into player.mod(), same plumbing as
  // evolutions/armor). Extra pets you activate are banked to your home-screen
  // stable (meta.petsUnlocked) and can be pre-selected before a run.
  const PET_DROP_CHANCE = 0.4; // retained for save-compat; no longer the spawn source
  const PETS = [
    { type: 'imp',   name: 'Imp',       color: '#ff5a4a', key: 'dmg',       val: 0.15, desc: '+15% damage' },
    { type: 'sprite',name: 'Sprite',    color: '#7fd4ff', key: 'spd',       val: 0.12, desc: '+12% move speed' },
    { type: 'wisp',  name: 'Wisp',      color: '#6ee7a0', key: 'regenFlat', val: 0.8,  desc: '+0.8 HP/s regen' },
    { type: 'mole',  name: 'Coin Mole', color: '#ffd24c', key: 'coin',      val: 0.20, desc: '+20% coins' },
    { type: 'owl',   name: 'Owl',       color: '#b88aff', key: 'critCh',    val: 0.08, desc: '+8% crit chance' },
  ];
  function rollPet() { return { ...PETS[(Math.random() * PETS.length) | 0] }; }

  // --- TOAD LINES -------------------------------------------------------------
  // The King's fall shows the line verbatim (index 0). Every deeper Warden you
  // fell shows the next line - the joke curdles the further down you go.
  const TOAD_LINES = [
    'THE PRINCESS IS IN ANOTHER CASTLE!',                       // 0 - the Gilded King (verbatim)
    'THANK YOU! BUT OUR PRINCESS IS IN ANOTHER CASTLE...',      // 1
    'the princess is in another castle. she always was.',       // 2
    'thank you... but our princess is in another CASTLE.',      // 3
    'there is no princess. there is only another castle.',      // 4
    'YOU are in another castle. you always have been.',         // 5
    'the castle is inside you now. keep descending.',           // 6
    'th4nk y0u... but y0u are the pr1ncess n0w.',               // 7
    'ANOTHER. CASTLE. ANOTHER. CASTLE. ANOTHER.',               // 8
  ];
  function toadLine(n) { return TOAD_LINES[Math.min(Math.max(0, n | 0), TOAD_LINES.length - 1)]; }

  return {
    FIRST_FLOOR, isDescent, threat, eliteChance, rollAffix, AFFIXES,
    isBossFloor, isMythicFloor, BOSS_EVERY, MYTHIC_DROP_CHANCE, PET_DROP_CHANCE,
    circleName, themeFor, bossConfig, bossEssence, toadLine, rollPet, PETS,
  };
})();
