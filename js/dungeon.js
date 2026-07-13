// ============================================================================
// dungeon.js - procedural floor generation (Isaac-style room grid).
// GENERATOR TUNING at the top. Rooms are one screen each; doors N/S/E/W.
// ============================================================================
const Dungeon = (() => {

  // --- GENERATOR TUNING -------------------------------------------------------
  // room count per floor: BASE + floor*PER_FLOOR + random(0..RAND) -> 12..20 range
  const BASE_ROOMS = 10, PER_FLOOR = 2, RAND_ROOMS = 3;
  const TREASURE_ROOMS = [1, 2];            // min,max treasure rooms per floor
  const MIMIC_CHANCE = 0.35;                // chance a treasure chest is a mimic (each chest rolls independently; placement is symmetric so position is never a tell)
  const OBSTACLES_PER_COMBAT = [0, 3];      // rocks per combat room

  // playfield geometry (the arena inside one room, in screen pixels)
  const PF = { x: 48, y: 48, w: 864, h: 444 };
  const DOOR_W = 76; // width of the door gap in a wall

  // FLOOR THEMES (Sam, 2026-07-10): each floor is a place, not just a number.
  // Ordinary rooms (start/combat) wear the theme; special rooms keep their
  // signature palettes so room type stays readable at a glance.
  const FLOOR_THEMES = {
    1: { name: 'THE WHISPERING FOREST', floor: '#232e1d', wall: '#131a0e', accent: '#6b8f4e', detail: '#31402a',
         obstacle: 'tree', ambient: 'forest' },
    2: { name: 'THE SUNKEN SWAMP',      floor: '#1d2a26', wall: '#0e1715', accent: '#4a7a6a', detail: '#2a3a33',
         obstacle: 'stump', ambient: 'swamp' },
    3: { name: "THE GILDED KEEP",       floor: '#2b222a', wall: '#170f16', accent: '#b08d3f', detail: '#3d2f3a',
         obstacle: 'pillar', ambient: 'castle' },
  };

  // special-room palettes: readable at a glance, per the design doc
  const PALETTES = {
    treasure:   { floor: '#332d22', wall: '#211c12', accent: '#d4af37', detail: '#453b28' },
    shop:       { floor: '#33281f', wall: '#221812', accent: '#e8a04c', detail: '#46392c' },
    boss:       { floor: '#221820', wall: '#120c12', accent: '#a03050', detail: '#301f2c' },
    stairs:     { floor: '#232a2c', wall: '#141a1c', accent: '#4cc9a8', detail: '#2c3a3c' },
    mythicshop: { floor: '#2a1230', wall: '#160a1a', accent: '#ff2fb0', detail: '#3a1a44' },
  };

  const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };

  function key(x, y) { return x + ',' + y; }

  // seedable PRNG (co-op: host + joiners generate the SAME floor from one seed).
  // rnd() is Math.random by default; generateFloor swaps in a seeded stream when
  // given a seed, so the room grid, doors, types, obstacles and chests all match.
  let rnd = Math.random;
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

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
  // seed (optional): when provided, the floor is fully deterministic so every
  // player in a co-op lobby builds the identical map. rnd resets to Math.random
  // after, so solo play stays random.
  function generateFloor(floorNum, seed) {
    rnd = (seed === undefined || seed === null) ? Math.random : mulberry32((seed * 2654435761 + floorNum * 40503) | 0);
    // Descent floors were sprawling (10 + 2*floor grows unbounded). They're meant to
    // be tight, quick descents, so give them a small fixed count; cap the base floors.
    const descent = typeof Descent !== 'undefined' && Descent.isDescent(floorNum);
    const target = descent
      ? 8 + ((rnd() * 3) | 0)                                                   // 8-10, tight
      : Math.min(18, BASE_ROOMS + PER_FLOOR * floorNum + ((rnd() * (RAND_ROOMS + 1)) | 0));
    const grid = new Map();
    const start = makeRoom(0, 0);
    start.type = 'start';
    grid.set(key(0, 0), start);
    const list = [start];

    // frontier expansion: pick a random room, grow in a random direction,
    // reject placements that would touch >1 existing room (keeps a corridor feel)
    let guard = 0;
    while (list.length < target && guard++ < 2000) {
      const from = list[(rnd() * list.length) | 0];
      const dirKeys = Object.keys(DIRS);
      const d = dirKeys[(rnd() * 4) | 0];
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

    // farthest special: a boss guards floor 3 (the Gilded King) and every Circle
    // Warden floor in the Descent; every other floor ends in stairs down.
    const bossFloor = floorNum === 3 ||
      (typeof Descent !== 'undefined' && Descent.isBossFloor(floorNum));
    claim(bossFloor ? 'boss' : 'stairs');
    claim('shop');
    // a secret mythic-only shop opens every 5th floor of the Descent
    if (typeof Descent !== 'undefined' && Descent.isMythicFloor(floorNum)) claim('mythicshop');
    const nTreasure = TREASURE_ROOMS[0] + ((rnd() * (TREASURE_ROOMS[1] - TREASURE_ROOMS[0] + 1)) | 0);
    for (let i = 0; i < nTreasure; i++) claim('treasure');

    // populate room furniture (not monsters - those spawn on first entry)
    for (const r of list) {
      if (r.type === 'combat') {
        // #27 room-shape variety: pick an obstacle LAYOUT so rooms feel different
        // (a pillared hall, a central arena ring, blocked corners, a columned
        // corridor) instead of pure random scatter. Seeded, so co-op stays in sync.
        const cx = PF.x + PF.w / 2, cy = PF.y + PF.h / 2;
        const doorPt = d => d === 'N' ? { x: cx, y: PF.y } : d === 'S' ? { x: cx, y: PF.y + PF.h } : d === 'W' ? { x: PF.x, y: cy } : { x: PF.x + PF.w, y: cy };
        const push = (x, y, rad) => {
          if (Math.abs(x - cx) < 95 && Math.abs(y - cy) < 95) return;      // keep the spawn area clear
          for (const dir in r.doors) { const dp = doorPt(dir); if (Math.hypot(x - dp.x, y - dp.y) < 88) return; } // never seal a door lane
          r.obstacles.push({ x, y, r: rad });
        };
        // wall layouts (split / cross / chevron / chambers) carve the room into real
        // SHAPES; the push() guards auto-gap them at the centre + every door lane so
        // they stay passable and never seal a door.
        const layout = ['scatter', 'pillars', 'ring', 'corners', 'columns', 'split', 'cross', 'chevron', 'chambers'][(rnd() * 9) | 0];
        r.layout = layout;
        if (layout === 'pillars') {
          for (let gx = 0; gx < 3; gx++) for (let gy = 0; gy < 2; gy++) push(PF.x + PF.w * (0.26 + gx * 0.24), PF.y + PF.h * (0.30 + gy * 0.40), 15);
        } else if (layout === 'ring') {
          const R = Math.min(PF.w, PF.h) * 0.35;
          for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; push(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 16); }
        } else if (layout === 'corners') {
          for (const sx of [-1, 1]) for (const sy of [-1, 1]) { push(cx + sx * PF.w * 0.33, cy + sy * PF.h * 0.33, 24); push(cx + sx * PF.w * 0.24, cy + sy * PF.h * 0.30, 16); push(cx + sx * PF.w * 0.30, cy + sy * PF.h * 0.22, 16); }
        } else if (layout === 'columns') {
          for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) push(cx + sx * PF.w * 0.30, PF.y + PF.h * (0.26 + i * 0.24), 15);
        } else if (layout === 'split') {
          // a wall bisecting the room; the centre guard leaves a doorway between halves
          const horiz = rnd() < 0.5;
          for (let t = 0.1; t <= 0.9; t += 0.055) { if (horiz) push(PF.x + PF.w * t, cy, 16); else push(cx, PF.y + PF.h * t, 16); }
        } else if (layout === 'cross') {
          for (let t = 0.12; t <= 0.88; t += 0.06) { push(PF.x + PF.w * t, cy, 15); push(cx, PF.y + PF.h * t, 15); }
        } else if (layout === 'chevron') {
          // two angled walls funnelling toward the centre
          for (let t = 0.08; t <= 0.5; t += 0.055) { push(PF.x + PF.w * t, PF.y + PF.h * (0.18 + t * 0.62), 15); push(PF.x + PF.w * (1 - t), PF.y + PF.h * (0.18 + t * 0.62), 15); }
        } else if (layout === 'chambers') {
          // an off-centre wall with a single chokepoint gap
          const wx = PF.x + PF.w * (rnd() < 0.5 ? 0.37 : 0.63), gapY = PF.y + PF.h * (0.28 + rnd() * 0.44);
          for (let y = PF.y + 70; y < PF.y + PF.h - 70; y += 25) { if (Math.abs(y - gapY) < 58) continue; push(wx, y, 15); }
        } else {
          const n = OBSTACLES_PER_COMBAT[0] + ((rnd() * (OBSTACLES_PER_COMBAT[1] - OBSTACLES_PER_COMBAT[0] + 1)) | 0);
          for (let i = 0; i < n; i++) push(PF.x + 90 + rnd() * (PF.w - 180), PF.y + 90 + rnd() * (PF.h - 180), 16 + rnd() * 12);
        }
      }
      if (r.type === 'treasure') {
        // each chest rolls its mimic chance INDEPENDENTLY - twins can both bite.
        // symmetric placement so position never reads as a tell.
        const nChests = rnd() < 0.35 ? 2 : 1;
        for (let i = 0; i < nChests; i++) {
          r.chests.push({
            x: PF.x + PF.w / 2 + (nChests === 1 ? 0 : (i === 0 ? -90 : 90)),
            y: PF.y + PF.h / 2,
            opened: false,
            mimic: rnd() < MIMIC_CHANCE,
            wobble: rnd() * Math.PI * 2, // phase for the mimic's subtle idle tell
          });
        }
      }
      if (r.type === 'stairs') {
        r.stairs = { x: PF.x + PF.w / 2, y: PF.y + PF.h / 2, open: false };
      }
    }

    // ROOM OCCUPANTS (Sam, 2026-07-11): pets and hireable mercenaries no longer
    // drop from mobs - each has a small chance to already be standing in a room
    // when you enter it. Activate with E. Rolled once, at floor-gen, so it stays
    // put if you leave and return. At most one occupant per room.
    // pet:  5% in a treasure room, 2% in a normal combat room.
    // merc: 10% in a treasure room, 5% in a normal combat room (floor 2+).
    const havePets = typeof Descent !== 'undefined' && Descent.rollPet;
    let petPlaced = false; // #65 at most ONE pet per floor (a streak of 3 was possible before)
    for (const r of list) {
      const isTreasure = r.type === 'treasure';
      const isNormal = r.type === 'combat';
      if (!isTreasure && !isNormal) continue;
      // #65 pets are now much rarer (was 5%/2%) AND capped at one per floor
      const petChance = isTreasure ? 0.03 : 0.008;
      const mercChance = isTreasure ? 0.10 : 0.05;
      // offset from centre so the occupant never blocks the door you walk in through
      const ox = PF.x + PF.w / 2 + (rnd() < 0.5 ? -110 : 110);
      const oy = PF.y + PF.h / 2 - 40;
      if (havePets && !petPlaced && rnd() < petChance) {
        const pet = Descent.rollPet();
        pet.activated = false; pet.x = ox; pet.y = oy; pet.bob = rnd() * 6;
        r.pet = pet; petPlaced = true;
      } else if (floorNum >= 2 && rnd() < mercChance) {
        r.merc = {
          hired: false,
          cls: rnd() < 0.5 ? 'blade' : 'bow',
          cost: 40 + floorNum * 8,
          x: ox, y: oy,
        };
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
    return themeFor(floorNum);
  }

  function themeFor(floorNum) {
    // the Descent (floor 4+) supplies its own hell theme per circle
    if (typeof Descent !== 'undefined' && Descent.isDescent(floorNum)) return Descent.themeFor(floorNum);
    return FLOOR_THEMES[floorNum] || FLOOR_THEMES[1];
  }

  return { generateFloor, uncleared, paletteFor, themeFor, FLOOR_THEMES, PF, DOOR_W, DIRS, OPP, MIMIC_CHANCE };
})();
