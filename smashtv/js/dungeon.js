// ============================================================================
// dungeon.js - procedural floor generation (Isaac-style room grid).
// GENERATOR TUNING at the top. Rooms are one screen each; doors N/S/E/W.
// ============================================================================
const Dungeon = (() => {

  // --- GENERATOR TUNING -------------------------------------------------------
  // room count per floor: BASE + floor*PER_FLOOR + random(0..RAND) -> 12..20 range
  const BASE_ROOMS = 10, PER_FLOOR = 2, RAND_ROOMS = 3;
  const TREASURE_ROOMS = [1, 2];            // min,max treasure rooms per floor
  const MIMIC_CHANCE = 0.22;                // chance a treasure chest is a mimic
  const OBSTACLES_PER_COMBAT = [0, 3];      // rocks per combat room

  // playfield geometry (the arena inside one room, in screen pixels)
  const PF = { x: 48, y: 48, w: 864, h: 444 };
  const DOOR_W = 76; // width of the door gap in a wall

  // FLOOR THEMES (Sam, 2026-07-10): each floor is a place, not just a number.
  // Ordinary rooms (start/combat) wear the theme; special rooms keep their
  // signature palettes so room type stays readable at a glance.
  // SMASH ARENA TV: three studio sets instead of dungeon floors
  const FLOOR_THEMES = {
    1: { name: 'STUDIO A · SIGN-UP ROUND', floor: '#141a2e', wall: '#0a0e1c', accent: '#00e5ff', detail: '#1e2a48',
         obstacle: 'pillar', ambient: 'studioA' },
    2: { name: 'THE PLEASURE DOME',        floor: '#241432', wall: '#140a20', accent: '#ff2d95', detail: '#3a2050',
         obstacle: 'pillar', ambient: 'dome' },
    3: { name: "THE HOST'S STAGE",         floor: '#2c1410', wall: '#180a08', accent: '#ffd23f', detail: '#48200f',
         obstacle: 'pillar', ambient: 'stage' },
  };

  // special-room palettes: readable at a glance, per the design doc
  const PALETTES = {
    treasure: { floor: '#332d22', wall: '#211c12', accent: '#d4af37', detail: '#453b28' },
    shop:     { floor: '#33281f', wall: '#221812', accent: '#e8a04c', detail: '#46392c' },
    boss:     { floor: '#221820', wall: '#120c12', accent: '#a03050', detail: '#301f2c' },
    stairs:   { floor: '#232a2c', wall: '#141a1c', accent: '#4cc9a8', detail: '#2c3a3c' },
  };

  const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

  function key(x, y) { return x + ',' + y; }

  function makeRoom(gx, gy) {
    return {
      gx, gy, type: 'combat',
      doors: {},            // dir -> neighbor room
      visited: false, cleared: false, spawned: false,
      monsters: [], chests: [], obstacles: [], shopStock: null, stairs: null,
      dist: 0,
    };
  }

  // --- generation --------------------------------------------------------------
  function generateFloor(floorNum) {
    const target = BASE_ROOMS + PER_FLOOR * floorNum + ((Math.random() * (RAND_ROOMS + 1)) | 0);
    const grid = new Map();
    const start = makeRoom(0, 0);
    start.type = 'start';
    grid.set(key(0, 0), start);
    const list = [start];

    // frontier expansion: pick a random room, grow in a random direction,
    // reject placements that would touch >1 existing room (keeps a corridor feel)
    let guard = 0;
    while (list.length < target && guard++ < 2000) {
      const from = list[(Math.random() * list.length) | 0];
      const dirKeys = Object.keys(DIRS);
      const d = dirKeys[(Math.random() * 4) | 0];
      const nx = from.gx + DIRS[d][0], ny = from.gy + DIRS[d][1];
      if (grid.has(key(nx, ny))) continue;
      let touching = 0;
      for (const dk of dirKeys) {
        if (grid.has(key(nx + DIRS[dk][0], ny + DIRS[dk][1]))) touching++;
      }
      if (touching > 1) continue;
      const r = makeRoom(nx, ny);
      grid.set(key(nx, ny), r);
      list.push(r);
    }

    // connect doors by adjacency
    for (const r of list) {
      for (const dk of Object.keys(DIRS)) {
        const n = grid.get(key(r.gx + DIRS[dk][0], r.gy + DIRS[dk][1]));
        if (n) r.doors[dk] = n;
      }
    }

    // BFS distances from start
    const q = [start]; start.dist = 0;
    const seen = new Set([key(0, 0)]);
    while (q.length) {
      const r = q.shift();
      for (const dk of Object.keys(r.doors)) {
        const n = r.doors[dk];
        if (!seen.has(key(n.gx, n.gy))) {
          seen.add(key(n.gx, n.gy));
          n.dist = r.dist + 1;
          q.push(n);
        }
      }
    }

    // special room assignment: dead-ends sorted farthest-first
    const deadEnds = list.filter(r => r !== start && Object.keys(r.doors).length === 1)
                         .sort((a, b) => b.dist - a.dist);
    const fallback = list.filter(r => r !== start).sort((a, b) => b.dist - a.dist);
    const taken = new Set();
    function claim(type) {
      let room = deadEnds.find(r => !taken.has(r));
      if (!room) room = fallback.find(r => !taken.has(r));
      if (room) { room.type = type; taken.add(room); }
      return room;
    }

    // farthest special: boss on the last floor, stairs down otherwise
    claim(floorNum >= 3 ? 'boss' : 'stairs');
    claim('shop');
    const nTreasure = TREASURE_ROOMS[0] + ((Math.random() * (TREASURE_ROOMS[1] - TREASURE_ROOMS[0] + 1)) | 0);
    for (let i = 0; i < nTreasure; i++) claim('treasure');

    // populate room furniture (not monsters - those spawn on first entry)
    for (const r of list) {
      if (r.type === 'combat' || r.type === 'boss') {
        const n = OBSTACLES_PER_COMBAT[0] +
          ((Math.random() * (OBSTACLES_PER_COMBAT[1] - OBSTACLES_PER_COMBAT[0] + 1)) | 0);
        for (let i = 0; i < (r.type === 'boss' ? 0 : n); i++) {
          // keep rocks away from door lanes and the center spawn area
          const ox = PF.x + 90 + Math.random() * (PF.w - 180);
          const oy = PF.y + 90 + Math.random() * (PF.h - 180);
          if (Math.abs(ox - (PF.x + PF.w / 2)) < 120 && Math.abs(oy - (PF.y + PF.h / 2)) < 120) continue;
          r.obstacles.push({ x: ox, y: oy, r: 16 + Math.random() * 12 });
        }
      }
      if (r.type === 'treasure') {
        // each chest rolls its mimic chance INDEPENDENTLY - twins can both bite.
        // symmetric placement so position never reads as a tell.
        const nChests = Math.random() < 0.35 ? 2 : 1;
        for (let i = 0; i < nChests; i++) {
          r.chests.push({
            x: PF.x + PF.w / 2 + (nChests === 1 ? 0 : (i === 0 ? -90 : 90)),
            y: PF.y + PF.h / 2,
            opened: false,
            mimic: Math.random() < MIMIC_CHANCE,
            wobble: Math.random() * Math.PI * 2, // phase for the mimic's subtle idle tell
          });
        }
      }
      if (r.type === 'stairs') {
        r.stairs = { x: PF.x + PF.w / 2, y: PF.y + PF.h / 2, open: false };
      }
    }

    return { grid, start, rooms: list, floor: floorNum };
  }

  // combat rooms remaining before the boss/stairs gate opens
  function uncleared(dungeon) {
    return dungeon.rooms.filter(r => r.type === 'combat' && !r.cleared).length;
  }

  function paletteFor(room, floorNum) {
    if (PALETTES[room.type]) return PALETTES[room.type];
    return FLOOR_THEMES[floorNum] || FLOOR_THEMES[1];
  }

  function themeFor(floorNum) { return FLOOR_THEMES[floorNum] || FLOOR_THEMES[1]; }

  return { generateFloor, uncleared, paletteFor, themeFor, FLOOR_THEMES, PF, DOOR_W, DIRS, OPP, MIMIC_CHANCE };
})();
