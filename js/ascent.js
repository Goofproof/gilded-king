// ============================================================================
// ascent.js - MOUNT PURGATORY. The run turns around and CLIMBS (2026-07-14).
//
// Dante does not stop at the bottom of Hell. He climbs down the frozen giant at
// the centre of the earth, passes the point where gravity reverses, and comes out
// the far side on the shore of a mountain in the southern ocean. Then he goes UP:
// seven terraces, one for each deadly sin, each a penance rather than a torment.
//
// So does this game. Floors 4-12 are the nine circles (descent.js). Floor 13 is
// THE SHORE, where you break through the ice at the bottom of Hell and come out
// under an open sky. Floors 14+ are the seven terraces, cycling, so the run stays
// endless the way the Descent was.
//
// STRUCTURE (deliberate):
//   - descent.js is UNTOUCHED. This module owns everything above the ice, and the
//     dispatch is a floor-number check in dungeon.js / rules.js / ui.js.
//   - The Descent's difficulty machinery still applies up here (threat curve,
//     elites, boss cadence, mythic shops) - Descent.isDescent() means "past the
//     King", i.e. the endless region, and the mountain is part of that region. We
//     are changing where you ARE, not how hard the numbers climb.
//   - Score is still g.floorNum, so the leaderboard keeps working untouched. What
//     changes is the READOUT: depth becomes altitude.
//
// PURGATORY IS NOT HELL REPAINTED. Hell was fire in a hole. This is stone and
// dawn and open sky, and the light gets stronger the higher you go. If a terrace
// looks like a recoloured circle, it is wrong.
// ============================================================================
const Ascent = (() => {

  // the nine circles are floors 4-12. Floor 13 is where you come out the other side.
  const SHORE_FLOOR = 13;
  const FIRST_TERRACE = 14;
  const isAscent = f => f >= SHORE_FLOOR;
  const onShore = f => f === SHORE_FLOOR;

  // --- THE SHORE --------------------------------------------------------------
  // Ante-Purgatory: the beach at the foot of the mountain, before the climb. A
  // breather, and the beat where the game turns around.
  const SHORE = {
    key: 'SHORE', name: 'THE SHORE OF THE MOUNTAIN',
    floor: '#3a4450', wall: '#141b22', accent: '#9fc6e8', detail: '#4c5a68',
    obstacle: 'reed', ambient: 'shore', glow: 'rgba(180,215,255,0.30)', glowTop: true,
  };

  // --- THE SEVEN TERRACES -----------------------------------------------------
  // Dante's order, climbing: the worst sin is at the bottom of the mountain and
  // the lightest at the top, so the climb gets gentler in spirit as it gets higher
  // in fact. The light rises with you: the palettes brighten terrace by terrace.
  const TERRACES = [
    { key: 'PRIDE', // the proud walk bent double under great carved stones
      floor: '#4a4038', wall: '#1c1814', accent: '#d8c39a', detail: '#5e5245',
      obstacle: 'carving', ambient: 'stonework', glow: 'rgba(190,160,110,0.26)', glowTop: true },
    { key: 'ENVY', // the envious sit against the rock with their eyes sewn shut
      floor: '#3d4a4a', wall: '#151d1d', accent: '#8fb8b0', detail: '#4d5e5e',
      obstacle: 'cairn', ambient: 'stonework', glow: 'rgba(140,190,180,0.22)', glowTop: true },
    { key: 'WRATH', // the wrathful walk blind through a bank of acrid black smoke
      floor: '#40403f', wall: '#171716', accent: '#b9b3a6', detail: '#525150',
      obstacle: 'brazier', ambient: 'smoke', glow: 'rgba(90,88,84,0.55)' },
    { key: 'SLOTH', // the slothful run without ceasing, and are never allowed to rest
      floor: '#3c4a3e', wall: '#141c16', accent: '#9ad0a4', detail: '#4d5e50',
      obstacle: 'terrace', ambient: 'wind', glow: 'rgba(150,210,160,0.24)', glowTop: true },
    { key: 'AVARICE', // the avaricious lie bound face-down, who once looked only at the ground
      floor: '#4a4636', wall: '#1b1a12', accent: '#e0cc84', detail: '#5d5945',
      obstacle: 'chain', ambient: 'stonework', glow: 'rgba(210,190,110,0.26)', glowTop: true },
    { key: 'GLUTTONY', // the gluttonous starve beneath a fruit tree they can never reach
      floor: '#48503a', wall: '#1a1e14', accent: '#c3dd8a', detail: '#5b6449',
      obstacle: 'tree', ambient: 'wind', glow: 'rgba(180,215,120,0.26)', glowTop: true },
    { key: 'LUST', // the last terrace: the lustful pass through a wall of refining fire
      floor: '#54463e', wall: '#1f1712', accent: '#ffb27a', detail: '#67564b',
      obstacle: 'flamewall', ambient: 'refiner', glow: 'rgba(255,150,90,0.34)', glowTop: true },
  ];

  const terraceIndex = f => (f - FIRST_TERRACE) % TERRACES.length;

  function placeName(f) {
    if (onShore(f)) return SHORE.name;
    const t = TERRACES[terraceIndex(f)];
    const lap = Math.floor((f - FIRST_TERRACE) / TERRACES.length);
    const name = 'THE TERRACE OF ' + t.key;
    return lap > 0 ? name + ' · HIGHER' : name;
  }

  // Pure function of the floor number, like Descent.themeFor - so a co-op host and
  // guest land on the same mountain with no syncing.
  function themeFor(f) {
    if (onShore(f)) return { ...SHORE, name: SHORE.name };
    return { ...TERRACES[terraceIndex(f)], name: placeName(f) };
  }

  // How high you have climbed. The HUD shows this instead of a depth: you are not
  // falling any more. Floor 13 (the shore) is altitude 0 - you are at the bottom
  // of the mountain, having just come up out of the earth.
  const altitude = f => Math.max(0, f - SHORE_FLOOR);

  // --- THE LINES AT THE TURN --------------------------------------------------
  // Toad's joke has curdled all the way down. At the bottom of Hell it breaks, and
  // he says the only true thing he has ever said.
  const SHORE_LINE = 'there is no castle down here. you have to go UP.';

  return {
    SHORE_FLOOR, FIRST_TERRACE, isAscent, onShore, altitude,
    themeFor, placeName, terraceIndex, TERRACES, SHORE, SHORE_LINE,
  };
})();
