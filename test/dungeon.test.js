import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Dungeon } = loadGame();

// A stable signature of a floor's LAYOUT (rooms + their type), order-independent.
const sig = d => d.rooms.map(r => `${r.gx},${r.gy}:${r.type}`).sort().join('|');

describe('Dungeon.generateFloor', () => {
  it('is DETERMINISTIC for a given seed (co-op requires identical maps)', () => {
    const a = Dungeon.generateFloor(1, 12345);
    const b = Dungeon.generateFloor(1, 12345);
    expect(sig(a)).toBe(sig(b));
  });

  it('produces DIFFERENT layouts for different seeds', () => {
    const a = Dungeon.generateFloor(1, 12345);
    const c = Dungeon.generateFloor(1, 999);
    expect(sig(a)).not.toBe(sig(c));
  });

  it('mixes the floor number into the seed (same seed, different floor => different map)', () => {
    const f1 = Dungeon.generateFloor(1, 42);
    const f2 = Dungeon.generateFloor(2, 42);
    expect(sig(f1)).not.toBe(sig(f2));
  });

  it('always has a start room at (0,0) and at least one exit', () => {
    for (let s = 0; s < 20; s++) {
      const d = Dungeon.generateFloor(2, s * 7 + 1);
      const start = d.rooms.find(r => r.type === 'start');
      expect(start).toBeTruthy();
      expect(start.gx).toBe(0);
      expect(start.gy).toBe(0);
      expect(Object.keys(start.doors).length).toBeGreaterThan(0);
    }
  });

  it('floor 3 has a boss room; other early floors end in stairs', () => {
    const f3 = Dungeon.generateFloor(3, 5);
    expect(f3.rooms.some(r => r.type === 'boss')).toBe(true);
    const f1 = Dungeon.generateFloor(1, 5);
    expect(f1.rooms.some(r => r.type === 'stairs')).toBe(true);
    expect(f1.rooms.some(r => r.type === 'boss')).toBe(false);
  });

  it('every room is reachable from start (connected graph)', () => {
    const d = Dungeon.generateFloor(4, 314);
    const seen = new Set(['0,0']);
    const q = [d.start];
    while (q.length) {
      const r = q.shift();
      for (const dir of Object.keys(r.doors)) {
        const n = r.doors[dir];
        const k = `${n.gx},${n.gy}`;
        if (!seen.has(k)) { seen.add(k); q.push(n); }
      }
    }
    expect(seen.size).toBe(d.rooms.length);
  });
});
