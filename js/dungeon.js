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

  // #299 SPIKE TRAP cycle: a floor plate that pops steel spikes on a beat. Derived from the
  // global clock + a per-plate phase, so it is stateless (co-op peers agree without syncing).
  // Down most of the cycle -> a TELEGRAPH (cracks glint, tips peek) -> UP (spikes out, damage).
  const SPIKE_PERIOD = 2.6, SPIKE_UP = 0.8, SPIKE_TELE = 0.55;
  function spikeState(s, t) {
    const lt = (((t + s.phase) % SPIKE_PERIOD) + SPIKE_PERIOD) % SPIKE_PERIOD;
    const upStart = SPIKE_PERIOD - SPIKE_UP;      // spikes out for the tail of each period
    const teleStart = upStart - SPIKE_TELE;       // warning window just before
    if (lt >= upStart) return { up: true, tele: false, k: (lt - upStart) / SPIKE_UP };
    if (lt >= teleStart) return { up: false, tele: true, k: (lt - teleStart) / SPIKE_TELE };
    return { up: false, tele: false, k: 0 };
  }

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
      monsters: [], chests: [], obstacles: [], walls: [], shopStock: null, stairs: null,
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
      ? 11 + ((rnd() * 4) | 0)                                                  // #124 11-14 (was 8-10, felt too small) - roomier but still a tight descent, not the old sprawl
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
      // #275 (Sam) LESS-LINEAR FLOORS: the old rule rejected any spot touching >1 room, which
      // forced a single punishing corridor. Now a spot touching TWO existing rooms becomes a
      // LOOP (a cross-connection / shortcut) about half the time - so picking the "wrong" path
      // or skipping a side chamber rarely dead-ends you - while a 3+ junction is still rejected
      // so floors never blob into a slab. Seeded (co-op stays in sync); doors-by-adjacency +
      // the flood-fill guard below keep every room reachable.
      if (touching > 2) continue;
      if (touching > 1 && rnd() > 0.5) continue;
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
    // THE EMPYREAN (floor 31) is ALWAYS a boss floor, whatever the Warden cadence
    // says: it is the last castle at the end of the book, and the King is in it.
    const bossFloor = floorNum === 1 || floorNum === 3 || // #251 the Harpy owns floor 1
      (typeof Paradiso !== 'undefined' && Paradiso.inEmpyrean(floorNum)) ||
      (typeof Descent !== 'undefined' && Descent.isBossFloor(floorNum));
    claim(bossFloor ? 'boss' : 'stairs');
    claim('shop');
    // #75 a training barracks (spend gold on stat boosts) appears from floor 2 on,
    // most floors - a gold sink alternative to the item shop
    if (floorNum >= 2 && rnd() < 0.7) claim('barracks');
    // a secret mythic-only shop opens every 5th floor of the Descent
    if (typeof Descent !== 'undefined' && Descent.isMythicFloor(floorNum)) claim('mythicshop');
    // #181 (Sam) TRAP ROOM: looks like a treasure room on the map, but the chest is
    // bait - opening it slams the doors and springs an ambush. Seeded, co-op safe.
    if (floorNum >= 2 && rnd() < 0.45) claim('trap');
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
        // is (x,y) with radius rad clear of the centre spawn area, every door lane,
        // AND every wall rect? (shared by rocks + pits so nothing spawns in a wall)
        const spotOk = (x, y, rad) => {
          if (Math.abs(x - cx) < 95 && Math.abs(y - cy) < 95) return false;      // keep the spawn area clear
          for (const dir in r.doors) { const dp = doorPt(dir); if (Math.hypot(x - dp.x, y - dp.y) < 88) return false; } // never seal a door lane
          for (const w of r.walls) { if (x > w.x - rad && x < w.x + w.w + rad && y > w.y - rad && y < w.y + w.h + rad) return false; } // not inside a wall
          if (r.poly && !polyClear(x, y, rad, r.poly)) return false;             // #67c not outside the room polygon
          return true;
        };
        const push = (x, y, rad, kind) => { if (spotOk(x, y, rad)) r.obstacles.push({ x, y, r: rad, kind }); };
        const W = PF.w, H = PF.h, X = PF.x, Y = PF.y;

        // #298 ARENA: a wide-open colosseum floor. From floor 2 on, ~11% of combat rooms
        // roll as an arena - NO shape carve, NO obstacles, NO pits, NO lava. Just a clean
        // brawl space with a bigger horde and nowhere to hide (the spawn boost + sand-ring
        // visual live in monsters.js / main.js). Seeded, so co-op peers agree.
        r.arena = floorNum >= 2 && rnd() < 0.11;
        // #303 ELITE DEN: a deep-floor (4+) challenge room. A SMALL pack, but every one of
        // them is elite (forced affixes), guarding a guaranteed treasure chest. High risk,
        // real reward. Never stacks with an arena. Seeded, so co-op peers agree.
        r.eliteDen = !r.arena && floorNum >= 4 && rnd() < 0.10;
        if (r.eliteDen) r.chests.push({ x: PF.x + PF.w / 2, y: PF.y + PF.h / 2, opened: false, mimic: false, wobble: rnd() * Math.PI * 2 });
        r.shape = 'rect';
        if (!r.arena) {
        // #67b ROOM SHAPE: carve the rectangle into a real non-rect shape with solid
        // wall rects - an L-room missing a corner, a plus, a chamfered octagon, or an
        // off-centre divider. Every wall sits >=86px clear of the edge midpoints, so it
        // can never cover a mid-edge door, its inward lane, or the room centre. Verified
        // door-safe + fully connected across 400 floors before shipping.
        // #67c the corner-BLOCK shapes (plus/octagon-of-rects) are retired in favour of a
        // true convex POLYGON room (octagon / rounded hall / diamond / hex). lshape (one
        // genuine missing corner) and notch (an interior divider) stay - they are real
        // shapes, not corner-lumps.
        const shape = ['rect', 'rect', 'rect', 'lshape', 'notch', 'poly', 'poly', 'poly', 'poly'][(rnd() * 9) | 0];
        r.shape = shape;
        if (shape === 'poly') {
          r.poly = makeRoomPoly(X, Y, W, H, rnd);                                // walls stay empty; the poly IS the shape
        } else if (shape === 'lshape') {
          const sx = rnd() < 0.5 ? 1 : -1, sy = rnd() < 0.5 ? 1 : -1;          // which corner is missing
          const wW = W * (0.33 + rnd() * 0.08), wH = H * (0.35 + rnd() * 0.08);
          r.walls.push({ x: sx > 0 ? X + W - wW : X, y: sy > 0 ? Y + H - wH : Y, w: wW, h: wH });
        } else if (shape === 'notch') {
          // an off-centre divider that splits the room - open at BOTH ends (>=86px) AND
          // a wide gap through the MIDDLE (Sam: encourage flow, no full-width barrier),
          // so it reads as two short stub-walls with a doorway between them.
          const GAP = 100;
          if (rnd() < 0.5) {
            const wx = X + W * (rnd() < 0.5 ? 0.36 : 0.64), cy = Y + H / 2;
            const topH = (cy - GAP / 2) - (Y + 86), botY = cy + GAP / 2, botH = (Y + H - 86) - botY;
            if (topH > 24) r.walls.push({ x: wx - 13, y: Y + 86, w: 26, h: topH });
            if (botH > 24) r.walls.push({ x: wx - 13, y: botY, w: 26, h: botH });
          } else {
            const wy = Y + H * (rnd() < 0.5 ? 0.36 : 0.64), cx = X + W / 2;
            const leftW = (cx - GAP / 2) - (X + 86), rightX = cx + GAP / 2, rightW = (X + W - 86) - rightX;
            if (leftW > 24) r.walls.push({ x: X + 86, y: wy - 13, w: leftW, h: 26 });
            if (rightW > 24) r.walls.push({ x: rightX, y: wy - 13, w: rightW, h: 26 });
          }
        }

        // #27 interior OBSTACLE layout, dropped INSIDE whatever shape we carved
        const layout = ['scatter', 'pillars', 'ring', 'corners', 'columns'][(rnd() * 5) | 0];
        r.layout = layout;
        if (layout === 'pillars') {
          for (let gx = 0; gx < 3; gx++) for (let gy = 0; gy < 2; gy++) push(X + W * (0.26 + gx * 0.24), Y + H * (0.30 + gy * 0.40), 15);
        } else if (layout === 'ring') {
          const R = Math.min(W, H) * 0.35;
          for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; push(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 16); }
        } else if (layout === 'corners') {
          for (const sx of [-1, 1]) for (const sy of [-1, 1]) { push(cx + sx * W * 0.33, cy + sy * H * 0.33, 24); push(cx + sx * W * 0.24, cy + sy * H * 0.30, 16); push(cx + sx * W * 0.30, cy + sy * H * 0.22, 16); }
        } else if (layout === 'columns') {
          for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) push(cx + sx * W * 0.30, Y + H * (0.26 + i * 0.24), 15);
        } else {
          const n = OBSTACLES_PER_COMBAT[0] + ((rnd() * (OBSTACLES_PER_COMBAT[1] - OBSTACLES_PER_COMBAT[0] + 1)) | 0);
          for (let i = 0; i < n; i++) push(X + 90 + rnd() * (W - 180), Y + 90 + rnd() * (H - 180), 16 + rnd() * 12);
        }

        // #74/#82 PITS: some rooms get floor holes. Solid to anyone walking, but
        // arrows and spells sail over them, and an enemy knocked in falls to its
        // death. #82: instead of only lone circles, a pit can be a big COMPOSITE
        // shape built from overlapping circles that render as one hole - a donut
        // (walkable island in the middle), a whole missing corner, or two large
        // sections split by a walkable bridge. Each circle stays a solid-circle
        // obstacle, so all pit mechanics work unchanged; a shared `group` id just
        // tells the renderer to merge them into one seamless void.
        if (rnd() < 0.46) {
          // drop a pit circle if it clears the spawn box, door lanes, walls, and
          // any ROCK (pit-on-pit overlap is wanted - that's how shapes merge)
          const pit = (x, y, pr, group) => {
            if (!spotOk(x, y, pr + 6)) return false;
            if (r.obstacles.some(o => o.kind !== 'pit' && Math.hypot(o.x - x, o.y - y) < o.r + pr + 18)) return false;
            r.obstacles.push({ x, y, r: pr, kind: 'pit', group });
            return true;
          };
          const gid = 'g' + (r.gx * 97 + r.gy * 131 + ((rnd() * 1000) | 0)); // stable-ish per room
          const shape = ['blob', 'blob', 'donut', 'corner', 'bridge'][(rnd() * 5) | 0];
          if (shape === 'donut') {
            // a solid ring around the clear centre spawn box: the middle is a
            // walkable island. Circles are packed tight (spacing < diameter) so
            // they merge into one continuous ring; the connectivity guard nibbles
            // one open doorway into it so the island stays reachable.
            const RR = Math.min(W, H) * (0.24 + rnd() * 0.03), n = 18, r0 = 30 + rnd() * 4;
            const a0 = rnd() * Math.PI * 2;
            for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; pit(cx + Math.cos(a) * RR, cy + Math.sin(a) * RR * 0.92, r0, gid); }
          } else if (shape === 'corner') {
            // fill one corner with an overlapping cluster - that corner is just gone
            const sx = rnd() < 0.5 ? 1 : -1, sy = rnd() < 0.5 ? 1 : -1;
            const ox = sx > 0 ? X + W - 66 : X + 66, oy = sy > 0 ? Y + H - 66 : Y + 66;
            for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
              if (a + b > 3) continue;                                     // quarter-disc, not a full square
              pit(ox - sx * a * 38, oy - sy * b * 38, 30 + ((a + b) === 0 ? 6 : 0), gid);
            }
          } else if (shape === 'bridge') {
            // two LARGE holes (2 columns each) split by a walkable strip down the
            // middle - the bridge. Circles pack tight so each side reads as one
            // solid section rather than a row of dots.
            const vertical = rnd() < 0.5;
            const r0 = 32 + rnd() * 4, half = 120;                         // strip half-width
            if (vertical) {
              for (let sx = -1; sx <= 1; sx += 2) {
                for (let cxi = 0; cxi < 2; cxi++) {
                  const bx = cx + sx * (half + r0 + cxi * (r0 * 1.4));
                  for (let k = -2; k <= 2; k++) pit(bx, cy + k * (r0 * 1.3), r0, gid);
                }
              }
            } else {
              for (let sy = -1; sy <= 1; sy += 2) {
                for (let cyi = 0; cyi < 2; cyi++) {
                  const by = cy + sy * (half + r0 + cyi * (r0 * 1.4));
                  for (let k = -3; k <= 3; k++) pit(cx + k * (r0 * 1.3), by, r0, gid);
                }
              }
            }
          } else {
            // classic: 1-3 lone circles scattered (rendered with full rim detail)
            const nPits = 1 + ((rnd() * 3) | 0);
            for (let i = 0, tries = 0; i < nPits && tries < 30; tries++) {
              const px = X + 110 + rnd() * (W - 220), py = Y + 90 + rnd() * (H - 180), pr = 26 + rnd() * 16;
              if (r.obstacles.some(o => Math.hypot(o.x - px, o.y - py) < o.r + pr + 20)) continue;
              if (pit(px, py, pr)) i++;
            }
          }
        }
        } // #298 end of the !arena open-floor guard (shape + obstacles + pits)

        // GUARANTEE traversability: every door must be able to walk to the room
        // centre. In rare cases a pit or loose rock clogs a narrow arm of a plus/notch
        // room - pull obstacles (pits first, then rocks) until the flood-fill connects.
        const connected = () => {
          const step = 14, cols = Math.ceil(W / step), rows = Math.ceil(H / step), PRR = 15;
          const blk = (gx, gy) => {
            const x = X + gx * step, y = Y + gy * step;
            for (const w of r.walls) if (x > w.x - PRR && x < w.x + w.w + PRR && y > w.y - PRR && y < w.y + w.h + PRR) return true;
            for (const o of r.obstacles) if (Math.hypot(x - o.x, y - o.y) < o.r + PRR) return true;
            if (r.poly && !polyClear(x, y, PRR, r.poly)) return true;            // #67c outside the room polygon = wall
            return false;
          };
          const cgx = Math.round((W / 2) / step), cgy = Math.round((H / 2) / step);
          for (const dir in r.doors) {
            const dp = doorPt(dir);
            const seen = new Set(), q = [[Math.max(0, Math.min(cols - 1, Math.round((dp.x - X) / step))), Math.max(0, Math.min(rows - 1, Math.round((dp.y - Y) / step)))]];
            let ok = false;
            while (q.length) {
              const [gx, gy] = q.pop();
              if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
              const k = gx + ',' + gy; if (seen.has(k)) continue; seen.add(k);
              if (blk(gx, gy)) continue;
              if (Math.abs(gx - cgx) <= 1 && Math.abs(gy - cgy) <= 1) { ok = true; break; }
              q.push([gx + 1, gy], [gx - 1, gy], [gx, gy + 1], [gx, gy - 1]);
            }
            if (!ok) return false;
          }
          return true;
        };
        for (let guard = 0; guard < 24 && !connected(); guard++) {
          let pit = -1;
          for (let i = r.obstacles.length - 1; i >= 0; i--) if (r.obstacles[i].kind === 'pit') { pit = i; break; }
          if (pit >= 0) r.obstacles.splice(pit, 1);
          else if (r.obstacles.length) r.obstacles.pop();
          else break;
        }

        // #293 (Sam) LAVA POOLS - a deeper-floor room HAZARD. Unlike a pit (solid), you CAN
        // walk through lava; it just BURNS while you stand in it. Traversable, so it needs no
        // connectivity guard - it punishes lingering and reshapes how you use the room. Grows
        // more common the deeper you go (a rarity on the top floors, a real threat down below).
        r.lava = [];
        if (!r.arena && rnd() < Math.min(0.26, 0.03 + 0.035 * floorNum)) {
          const nPools = 1 + ((rnd() * 3) | 0);
          for (let i = 0, tries = 0; i < nPools && tries < 40; tries++) {
            const lr = 34 + rnd() * 26;
            const lx = PF.x + 110 + rnd() * (PF.w - 220), ly = PF.y + 95 + rnd() * (PF.h - 190);
            if (!spotOk(lx, ly, lr)) continue;                                              // clear of spawn, doors, walls, poly
            if (r.obstacles.some(o => Math.hypot(o.x - lx, o.y - ly) < o.r + lr + 10)) continue; // not on a rock/pit
            if (r.lava.some(o => Math.hypot(o.x - lx, o.y - ly) < o.r + lr - 10)) continue;       // slight merge allowed
            r.lava.push({ x: lx, y: ly, r: lr });
            i++;
          }
        }

        // #299 SPIKE TRAPS - a timed floor HAZARD (the rhythm counterpart to static lava).
        // Plates sit flush and safe most of the time, then pop steel spikes on a beat; step
        // off before they rise. Each plate carries a seeded PHASE so they fire out of sync -
        // a shifting no-stand grid you fight around. Traversable, so no connectivity guard.
        r.spikes = [];
        if (!r.arena && rnd() < Math.min(0.30, 0.05 + 0.03 * floorNum)) {
          const nS = 2 + ((rnd() * 3) | 0);
          for (let i = 0, tries = 0; i < nS && tries < 40; tries++) {
            const sr = 26 + rnd() * 14;
            const sx = PF.x + 100 + rnd() * (PF.w - 200), sy = PF.y + 90 + rnd() * (PF.h - 180);
            if (!spotOk(sx, sy, sr)) continue;                                                    // clear of spawn, doors, walls, poly
            if (r.obstacles.some(o => Math.hypot(o.x - sx, o.y - sy) < o.r + sr + 10)) continue;   // not on a rock/pit
            if (r.lava.some(o => Math.hypot(o.x - sx, o.y - sy) < o.r + sr + 10)) continue;        // not on lava
            if (r.spikes.some(o => Math.hypot(o.x - sx, o.y - sy) < o.r + sr + 8)) continue;       // not on another plate
            r.spikes.push({ x: sx, y: sy, r: sr, phase: rnd() * SPIKE_PERIOD });
            i++;
          }
        }
      }
      if (r.type === 'treasure') {
        // each chest rolls its mimic chance INDEPENDENTLY - twins can both bite.
        // symmetric placement so position never reads as a tell.
        const nChests = rnd() < 0.35 ? 2 : 1;
        // FLOOR RULES raise the odds a chest is lying to you (Greed's Hoard, and the
        // Malebolge, where nothing is what it looks like). Rolled with the SEEDED rnd
        // inside generateFloor, so co-op peers agree on which chests bite.
        const mimicChance = MIMIC_CHANCE + (typeof Rules !== 'undefined'
          ? Rules.forFloor(floorNum, seed).mimicAdd : 0);
        for (let i = 0; i < nChests; i++) {
          r.chests.push({
            x: PF.x + PF.w / 2 + (nChests === 1 ? 0 : (i === 0 ? -90 : 90)),
            y: PF.y + PF.h / 2,
            opened: false,
            mimic: rnd() < mimicChance,
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
        const pet = Descent.rollPet(rnd);
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

    // QUEST ENCOUNTERS (Sam, 2026-07-14): somebody is standing in a room, and they
    // want something. At most ONE per floor, from floor 2 on, and never in the room
    // you start in - you should have to find them. Rolled with the SEEDED rng like
    // every other occupant, so a co-op host and guest meet the same stranger in the
    // same room.
    if (floorNum >= 2 && typeof Encounters !== 'undefined') {
      const candidates = list.filter(r => (r.type === 'combat' || r.type === 'treasure')
                                       && !r.pet && !r.merc && r !== start);
      if (candidates.length && rnd() < 0.55) {
        const room = candidates[(rnd() * candidates.length) | 0];
        const e = Encounters.make(rnd, floorNum);
        e.x = PF.x + PF.w / 2 + (rnd() < 0.5 ? -120 : 120);
        e.y = PF.y + PF.h / 2 + 46;
        room.encounter = e;
      }
    }

    // #148 (Sam) DOPPELGANGER mini-boss: occasionally (floor 4+, ~30%) a seed-chosen
    // combat room stages a solo duel against a shadow of the player. Rolled with the
    // SEEDED rng so a co-op host and guest agree the encounter exists (host owns it).
    if (floorNum >= 4) {
      const dcand = list.filter(r => r.type === 'combat' && r !== start
                                  && !r.encounter && !r.pet && !r.merc);
      if (dcand.length && rnd() < 0.3) {
        dcand[(rnd() * dcand.length) | 0].doppelRoom = true;
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
    // The whole Comedy, checked from the top down. Everything past the King is still
    // "the Descent" as far as the DIFFICULTY machinery is concerned (threat curve,
    // elites, boss cadence) - these checks only decide WHERE you are.
    // Heaven (22+), then the mountain (13-21), then Hell (4-12), then the castle.
    if (typeof Paradiso !== 'undefined' && Paradiso.isParadiso(floorNum)) return Paradiso.themeFor(floorNum);
    if (typeof Ascent !== 'undefined' && Ascent.isAscent(floorNum)) return Ascent.themeFor(floorNum);
    // the nine circles of Hell (floors 4-12)
    if (typeof Descent !== 'undefined' && Descent.isDescent(floorNum)) return Descent.themeFor(floorNum);
    return FLOOR_THEMES[floorNum] || FLOOR_THEMES[1];
  }

  // #67b resolve a circle (x,y,r) out of an axis-aligned wall rect. Returns the
  // corrected {x,y} if it was overlapping, else null. Shared by player + monsters.
  // (px,py) = the entity's position BEFORE this frame's movement; when given, the
  // circle is pushed back out the side it APPROACHED from, so a fast knockback can
  // never punch through a thin wall and pop out the far side (#81 anti-tunnel).
  function rectPush(x, y, r, w, px, py) {
    // overlap test against the inflated rect
    if (!(x > w.x - r && x < w.x + w.w + r && y > w.y - r && y < w.y + w.h + r)) return null;
    if (px !== undefined) {
      // if last frame the centre was clear on one side of the inflated rect, that's the
      // side it came from - clamp it back there (never resolve to the opposite face)
      if (px <= w.x - r + 0.5)        return { x: w.x - r, y };
      if (px >= w.x + w.w + r - 0.5)  return { x: w.x + w.w + r, y };
      if (py <= w.y - r + 0.5)        return { x, y: w.y - r };
      if (py >= w.y + w.h + r - 0.5)  return { x, y: w.y + w.h + r };
    }
    // no clear approach (spawned inside / grazing a corner): nearest-edge resolution
    const nx = Math.max(w.x, Math.min(x, w.x + w.w));
    const ny = Math.max(w.y, Math.min(y, w.y + w.h));
    let dx = x - nx, dy = y - ny, d = Math.hypot(dx, dy);
    if (d >= r) return null;
    if (d > 0.0001) return { x: nx + dx / d * r, y: ny + dy / d * r };
    const l = x - w.x, ri = w.x + w.w - x, t = y - w.y, b = w.y + w.h - y;
    const m = Math.min(l, ri, t, b);
    if (m === l) return { x: w.x - r, y };
    if (m === ri) return { x: w.x + w.w + r, y };
    if (m === t) return { x, y: w.y - r };
    return { x, y: w.y + w.h + r };
  }

  // #83 does the segment (x1,y1)->(x2,y2) cross any wall rect? (melee/LoS blocking)
  function segBlocked(x1, y1, x2, y2, walls) {
    if (!walls) return false;
    const crs = (ox, oy, px, py) => ox * py - oy * px;
    const segSeg = (ax, ay, bx, by, cx, cy, dx, dy) => {
      const d1 = crs(dx - cx, dy - cy, ax - cx, ay - cy), d2 = crs(dx - cx, dy - cy, bx - cx, by - cy);
      const d3 = crs(bx - ax, by - ay, cx - ax, cy - ay), d4 = crs(bx - ax, by - ay, dx - ax, dy - ay);
      return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
    };
    for (const w of walls) {
      const inside = (x, y) => x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h;
      if (inside(x2, y2)) return true; // target buried in the wall
      if (segSeg(x1, y1, x2, y2, w.x, w.y, w.x + w.w, w.y) ||
          segSeg(x1, y1, x2, y2, w.x + w.w, w.y, w.x + w.w, w.y + w.h) ||
          segSeg(x1, y1, x2, y2, w.x + w.w, w.y + w.h, w.x, w.y + w.h) ||
          segSeg(x1, y1, x2, y2, w.x, w.y + w.h, w.x, w.y)) return true;
    }
    return false;
  }

  // #67c (Sam) A REAL non-rect ROOM SHAPE, done elegantly: a convex WALKABLE POLYGON
  // instead of blocky corner-rects. The mid-edges stay at full extent so every door
  // opens straight in; only the CORNERS are cut (or rounded), which is what makes the
  // chamber read as an octagon / rounded hall / diamond rather than a box with lumps.
  // Convex => no interior line-of-sight ever crosses the boundary, so collision is just
  // "keep the circle inside", and LoS/segBlocked need no changes at all.
  function makeRoomPoly(X, Y, W, H, rnd) {
    const style = ['octagon', 'octagon', 'round', 'diamond', 'hex'][(rnd() * 5) | 0];
    // corner cut depth - clamped so the mid-edge FLAT stays >= 150px each side of centre
    // (a door lane is 88px), guaranteeing the door approach is never pinched.
    const maxCx = W * 0.5 - 150, maxCy = H * 0.5 - 120;
    let cx = Math.min(maxCx, W * (0.14 + rnd() * 0.14));
    let cy = Math.min(maxCy, H * (0.20 + rnd() * 0.16));
    if (style === 'diamond') { cx = maxCx; cy = maxCy; }       // deepest cut -> a lozenge
    if (style === 'hex') { cx = Math.min(maxCx, W * 0.30); cy = Math.min(maxCy, H * 0.10); } // pointy sides
    const poly = [];
    const arc = (ccx, ccy, rx, ry, a0, a1, steps) => {
      for (let i = 0; i <= steps; i++) { const a = a0 + (a1 - a0) * i / steps; poly.push({ x: ccx + Math.cos(a) * rx, y: ccy + Math.sin(a) * ry }); }
    };
    if (style === 'round') {
      const S = 5;
      poly.push({ x: X + cx, y: Y }, { x: X + W - cx, y: Y });
      arc(X + W - cx, Y + cy, cx, cy, -Math.PI / 2, 0, S);        // TR
      poly.push({ x: X + W, y: Y + H - cy });
      arc(X + W - cx, Y + H - cy, cx, cy, 0, Math.PI / 2, S);     // BR
      poly.push({ x: X + cx, y: Y + H });
      arc(X + cx, Y + H - cy, cx, cy, Math.PI / 2, Math.PI, S);   // BL
      poly.push({ x: X, y: Y + cy });
      arc(X + cx, Y + cy, cx, cy, Math.PI, Math.PI * 1.5, S);     // TL
    } else {
      // straight corner cuts: 8 vertices (octagon family; diamond is just a deep cut)
      poly.push(
        { x: X + cx, y: Y }, { x: X + W - cx, y: Y },
        { x: X + W, y: Y + cy }, { x: X + W, y: Y + H - cy },
        { x: X + W - cx, y: Y + H }, { x: X + cx, y: Y + H },
        { x: X, y: Y + H - cy }, { x: X, y: Y + cy },
      );
    }
    // arc endpoints meet the flats on the same point - drop consecutive (and wrap-around)
    // DUPLICATES so there are no zero-length edges (their normals would be NaN and break
    // both the collision push and the fill).
    const clean = [];
    for (const v of poly) { const p = clean[clean.length - 1]; if (!p || Math.abs(p.x - v.x) > 0.5 || Math.abs(p.y - v.y) > 0.5) clean.push(v); }
    if (clean.length > 2) { const f = clean[0], l = clean[clean.length - 1]; if (Math.abs(f.x - l.x) < 0.5 && Math.abs(f.y - l.y) < 0.5) clean.pop(); }
    return clean;
  }
  // per-edge inward unit normals + offset, cached on the poly so we don't rebuild them
  // every collision test. Inward is decided against the centroid (winding-agnostic).
  function polyEdges(poly) {
    if (poly._edges) return poly._edges;
    const n = poly.length; let cxp = 0, cyp = 0;
    for (const v of poly) { cxp += v.x; cyp += v.y; } cxp /= n; cyp /= n;
    const edges = [];
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      let nx = -(b.y - a.y), ny = (b.x - a.x); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      if (nx * (cxp - a.x) + ny * (cyp - a.y) < 0) { nx = -nx; ny = -ny; }  // point it inward
      // a boundary FLAT (axis-aligned normal) sits on the room's rect edge, where the
      // DOORS are - main.js owns those (it must let you walk out). Only the diagonal /
      // arc corner-cut edges are the poly's own to enforce. Flagged so polyPush skips them.
      const axis = Math.abs(nx) < 0.02 || Math.abs(ny) < 0.02;
      edges.push({ nx, ny, ox: a.x, oy: a.y, axis });
    }
    Object.defineProperty(poly, '_edges', { value: edges, enumerable: false });
    return edges;
  }
  // keep a circle of radius rad inside the convex poly; returns a corrected {x,y} or null.
  function polyPush(x, y, rad, poly) {
    const edges = polyEdges(poly);
    let px = x, py = y, moved = false;
    for (let pass = 0; pass < 2; pass++) for (const e of edges) {
      if (e.axis) continue;                                     // boundary flat -> main.js/door logic owns it
      const dist = e.nx * (px - e.ox) + e.ny * (py - e.oy);
      if (dist < rad) { px += e.nx * (rad - dist); py += e.ny * (rad - dist); moved = true; }
    }
    return moved ? { x: px, y: py } : null;
  }
  // is a disc of radius rad fully inside the poly? (obstacle/spawn placement, connectivity)
  function polyClear(x, y, rad, poly) {
    for (const e of polyEdges(poly)) if (e.nx * (x - e.ox) + e.ny * (y - e.oy) < rad) return false;
    return true;
  }

  return { generateFloor, uncleared, paletteFor, themeFor, FLOOR_THEMES, PF, DOOR_W, DIRS, OPP, MIMIC_CHANCE, rectPush, segBlocked, makeRoomPoly, polyPush, polyClear, spikeState };
})();
