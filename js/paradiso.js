// ============================================================================
// paradiso.js - THE HEAVENS, and the end of the book (Sam, 2026-07-14).
//
// Sam: "continue on through the dante's inferno levels all the way to the very end
// of the book." The book does not end at the bottom of Hell, and it does not end on
// the mountain either. Dante rises from the Earthly Paradise through NINE CELESTIAL
// SPHERES and comes at last to the EMPYREAN, which is not a place at all - it is
// light, and the vision, and the last line of the poem.
//
// So the run is now the whole Comedy:
//   floors 1-3    the Mimic's trap castle   (forest, swamp, keep - the King)
//   floors 4-12   INFERNO, nine circles, fire down into ice
//   floor  13     the Shore
//   floors 14-20  PURGATORIO, seven terraces, climbing
//   floor  21     the Earthly Paradise, the summit
//   floors 22-30  PARADISO, nine spheres, rising
//   floor  31     THE EMPYREAN. The end of the book. And the last castle.
//   floors 32+    beyond the book: the spheres turn again, forever, for the score.
//
// PARADISO IS NOT A DUNGEON. Hell was a furnace and the mountain was stone; this is
// light and glass and enormous open space. The rules up here are not torments and
// not penances - they are BLESSINGS THAT COST SOMETHING. Every one of them gives you
// a real gift and takes a real price, because that is what the spheres do to Dante.
//
// THE JOKE PAYS OFF. Toad has told you the princess is in another castle since the
// Gilded King fell on floor 3. At the top of Heaven there IS another castle. It is
// the same castle. It was always going to be the same castle.
// ============================================================================
const Paradiso = (() => {

  const FIRST_SPHERE = 22;                 // the summit is 21
  const SPHERES_N = 9;
  const EMPYREAN_FLOOR = FIRST_SPHERE + SPHERES_N;   // 31
  const isParadiso = f => f >= FIRST_SPHERE;
  const inEmpyrean = f => f === EMPYREAN_FLOOR;

  // Past the Empyrean the run does not stop - the score chase needs somewhere to go,
  // and "beyond the end of the book" is a perfectly good place. The spheres turn
  // again, and say so.
  const beyond = f => f > EMPYREAN_FLOOR;
  function sphereIndex(f) {
    if (beyond(f)) return (f - (EMPYREAN_FLOOR + 1)) % SPHERES_N;
    return (f - FIRST_SPHERE) % SPHERES_N;
  }

  // --- THE NINE SPHERES -------------------------------------------------------
  // Dante's order, rising. The light gets whiter and the space gets bigger the
  // higher you go; by the Primum Mobile there is almost no colour left at all,
  // because there is almost nothing left but light.
  const SPHERES = [
    { key: 'THE MOON',          // the inconstant: those who broke their vows
      floor: '#39435c', wall: '#141a26', accent: '#cfd8f0', detail: '#4a5674',
      obstacle: 'crater', ambient: 'celestial', glow: 'rgba(200,215,255,0.28)', glowTop: true },
    { key: 'MERCURY',           // the ambitious: those who did good, but for fame
      floor: '#3d4a52', wall: '#161d22', accent: '#a8d8e8', detail: '#4f6069',
      obstacle: 'orrery', ambient: 'celestial', glow: 'rgba(170,220,240,0.28)', glowTop: true },
    { key: 'VENUS',             // the lovers
      floor: '#54415a', wall: '#1e1622', accent: '#ffb0d8', detail: '#6a5372',
      obstacle: 'rose', ambient: 'celestial', glow: 'rgba(255,175,220,0.30)', glowTop: true },
    { key: 'THE SUN',           // the wise
      floor: '#5c5138', wall: '#221d13', accent: '#ffe08a', detail: '#75683f',
      obstacle: 'halo', ambient: 'radiance', glow: 'rgba(255,225,140,0.40)', glowTop: true },
    { key: 'MARS',              // the warriors, arrayed in a cross of light
      floor: '#5c3a38', wall: '#211413', accent: '#ff9a8a', detail: '#754c48',
      obstacle: 'sword', ambient: 'martial', glow: 'rgba(255,140,120,0.34)', glowTop: true },
    { key: 'JUPITER',           // the just rulers, who spell out a word in light
      floor: '#3f4a63', wall: '#161c28', accent: '#a8c0ff', detail: '#54628a',
      obstacle: 'scales', ambient: 'radiance', glow: 'rgba(170,195,255,0.32)', glowTop: true },
    { key: 'SATURN',            // the contemplatives, and the golden ladder
      floor: '#4c4a42', wall: '#1b1a16', accent: '#e8dcc0', detail: '#63604f',
      obstacle: 'ladder', ambient: 'silence', glow: 'rgba(230,220,190,0.30)', glowTop: true },
    { key: 'THE FIXED STARS',   // where Dante is examined on faith, hope and love
      floor: '#2f3450', wall: '#101322', accent: '#dfe6ff', detail: '#414a70',
      obstacle: 'star', ambient: 'starlight', glow: 'rgba(220,230,255,0.36)', glowTop: true },
    { key: 'THE PRIMUM MOBILE', // the angels. Pure motion. The source of all motion.
      floor: '#5a5c68', wall: '#1f2028', accent: '#ffffff', detail: '#75788a',
      obstacle: 'wheel', ambient: 'starlight', glow: 'rgba(255,255,255,0.44)', glowTop: true },
  ];

  // --- THE EMPYREAN -----------------------------------------------------------
  // Not a sphere. Not a place. In the poem it is light, a white rose of souls, and
  // the vision that ends the book. In the game it is all of that AND the last
  // castle, because the joke has been running for thirty floors and it has earned
  // its ending.
  // The FLOOR is ivory and the WALL is near-black on purpose: the room is a disc of
  // light hanging in nothing, which is what the Empyrean is. It also keeps the HUD
  // legible - a light wall put white HUD text on a white background and the whole
  // bottom-left corner vanished.
  const EMPYREAN = {
    key: 'THE EMPYREAN', name: 'THE EMPYREAN',
    floor: '#efe9d6', wall: '#14120c', accent: '#c9a227', detail: '#d8cfae',
    obstacle: 'rose', ambient: 'empyrean', glow: 'rgba(255,248,214,0.30)', glowTop: true,
  };

  function placeName(f) {
    if (inEmpyrean(f)) return EMPYREAN.name;
    const s = SPHERES[sphereIndex(f)];
    return beyond(f) ? 'THE SPHERE OF ' + s.key + ' · BEYOND' : 'THE SPHERE OF ' + s.key;
  }

  // Pure function of the floor number (co-op safe, like Descent/Ascent).
  function themeFor(f) {
    if (inEmpyrean(f)) return { ...EMPYREAN, name: EMPYREAN.name };
    return { ...SPHERES[sphereIndex(f)], name: placeName(f) };
  }

  // --- TOAD, AT THE END -------------------------------------------------------
  // He has said it thirty times. He gets to say it once more, and this time it is
  // not a joke, and it is not a lie either.
  const EMPYREAN_LINE = 'THE PRINCESS IS IN THIS CASTLE.';
  const RISE_LINE = 'the earth is below you now. all of it.';

  return {
    FIRST_SPHERE, SPHERES_N, EMPYREAN_FLOOR,
    isParadiso, inEmpyrean, beyond, sphereIndex,
    themeFor, placeName, SPHERES, EMPYREAN,
    EMPYREAN_LINE, RISE_LINE,
  };
})();
