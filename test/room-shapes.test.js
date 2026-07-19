// #67c convex POLYGON rooms (Sam): the elegant replacement for corner-block rects.
// This geometry is CO-OP CRITICAL - both peers build the room from the same seed and
// must agree on the walkable shape to the pixel, or they desync. It is also easy to
// break silently: a shape that pinches a door lane soft-locks the room, and a push that
// resolves the wrong way lets a mob tunnel out. These guard all three.
import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Dungeon } = loadGame();
const PF = Dungeon.PF;

// the game's mulberry32 (player/eulogy use the same shape) so we can seed makeRoomPoly.
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const SEEDS = [1, 2, 3, 7, 42, 99, 123, 777, 2024, 31337, 555, 8181];
const polyFor = s => Dungeon.makeRoomPoly(PF.x, PF.y, PF.w, PF.h, mulberry32(s));
const POLYS = SEEDS.map(polyFor);

// signed distance to the nearest CORNER-CUT edge (the poly's own edges - axis-aligned
// boundary flats are main.js/door territory and are excluded, matching polyPush).
function cutDist(x, y, poly) {
  const n = poly.length; let cx = 0, cy = 0;
  for (const v of poly) { cx += v.x; cy += v.y; } cx /= n; cy /= n;
  let m = Infinity;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    let nx = -(b.y - a.y), ny = (b.x - a.x); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if (nx * (cx - a.x) + ny * (cy - a.y) < 0) { nx = -nx; ny = -ny; }
    if (Math.abs(nx) < 0.02 || Math.abs(ny) < 0.02) continue; // axis flat - skip
    m = Math.min(m, nx * (x - a.x) + ny * (y - a.y));
  }
  return m;
}

describe('#67c convex polygon rooms', () => {
  it('is deterministic per seed - co-op peers build the identical chamber', () => {
    for (const s of SEEDS) expect(polyFor(s)).toEqual(polyFor(s));
  });

  it('every shape is convex (the push math depends on it)', () => {
    for (const poly of POLYS) {
      const n = poly.length; let sign = 0;
      for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n], c = poly[(i + 2) % n];
        const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
        if (Math.abs(cr) < 1e-6) continue;
        const sg = Math.sign(cr);
        if (sign === 0) sign = sg; else expect(sg, 'a reflex vertex - not convex').toBe(sign);
      }
    }
  });

  it('never pokes outside the playfield rect', () => {
    for (const poly of POLYS) for (const v of poly) {
      expect(v.x).toBeGreaterThanOrEqual(PF.x - 0.5);
      expect(v.x).toBeLessThanOrEqual(PF.x + PF.w + 0.5);
      expect(v.y).toBeGreaterThanOrEqual(PF.y - 0.5);
      expect(v.y).toBeLessThanOrEqual(PF.y + PF.h + 0.5);
    }
  });

  it('keeps all four door lanes open - the shape never pinches a doorway', () => {
    // a door sits at each mid-edge; its approach (46px in) must clear a 24px body
    const approaches = [
      { x: PF.x + PF.w / 2, y: PF.y + 46 }, { x: PF.x + PF.w / 2, y: PF.y + PF.h - 46 },
      { x: PF.x + 46, y: PF.y + PF.h / 2 }, { x: PF.x + PF.w - 46, y: PF.y + PF.h / 2 },
    ];
    for (const poly of POLYS) for (const a of approaches)
      expect(Dungeon.polyClear(a.x, a.y, 24, poly), 'a door lane was pinched').toBe(true);
  });

  it('the centre spawn area is always well inside the room', () => {
    for (const poly of POLYS) expect(Dungeon.polyClear(PF.x + PF.w / 2, PF.y + PF.h / 2, 95, poly)).toBe(true);
  });

  it('polyPush pulls a body OUT of every cut corner and back into the room', () => {
    for (const poly of POLYS) {
      for (let x = PF.x + 4; x < PF.x + PF.w; x += 32) {
        for (let y = PF.y + 4; y < PF.y + PF.h; y += 32) {
          const q = Dungeon.polyPush(x, y, 13, poly);
          const px = q ? q.x : x, py = q ? q.y : y;
          // after the push the body clears every cut edge by ~the radius (small eps for
          // corner interactions); a mob can never end up parked outside the chamber
          expect(cutDist(px, py, poly)).toBeGreaterThan(12);
        }
      }
    }
  });

  it('polyPush leaves a body that is already well inside untouched (no jitter)', () => {
    for (const poly of POLYS) {
      const q = Dungeon.polyPush(PF.x + PF.w / 2, PF.y + PF.h / 2, 13, poly);
      expect(q).toBeNull();
    }
  });
});
