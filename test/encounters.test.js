import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Encounters, Dungeon, Rules } = loadGame();

// The stranger is placed inside Dungeon.generateFloor() with the SEEDED rng, which
// is the whole reason co-op works: the host and the guest each build their own floor
// and must independently arrive at the same person, in the same room, offering the
// same deal. If this drifts, one player is doing a quest the other cannot see.
describe('Quest encounters: co-op determinism', () => {
  const shape = d => d.rooms
    .map((r, i) => r.encounter ? `${i}:${r.encounter.key}` : null)
    .filter(Boolean).join(',');

  it('the same seed puts the same stranger in the same room with the same offer', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const floor of [2, 5, 9, 14]) {
        const a = Dungeon.generateFloor(floor, seed);
        const b = Dungeon.generateFloor(floor, seed);
        expect(shape(b), `floor ${floor} seed ${seed}`).toBe(shape(a));
      }
    }
  });

  it('different seeds give different runs (the stranger is not on rails)', () => {
    const runs = new Set();
    for (let seed = 1; seed <= 25; seed++) runs.add(shape(Dungeon.generateFloor(6, seed)));
    expect(runs.size).toBeGreaterThan(3);
  });

  it('at most ONE stranger per floor, and never on floor 1', () => {
    for (let seed = 1; seed <= 60; seed++) {
      expect(Dungeon.generateFloor(1, seed).rooms.filter(r => r.encounter)).toHaveLength(0);
      for (const floor of [2, 6, 15]) {
        const n = Dungeon.generateFloor(floor, seed).rooms.filter(r => r.encounter).length;
        expect(n, `floor ${floor} seed ${seed}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the stranger never stands in the room you start in', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const d = Dungeon.generateFloor(6, seed);
      expect(d.start.encounter, `seed ${seed}`).toBeUndefined();
    }
  });

  it('they do show up: a stranger appears on most floors, not almost none', () => {
    let withOne = 0;
    for (let seed = 1; seed <= 100; seed++) {
      if (Dungeon.generateFloor(6, seed).rooms.some(r => r.encounter)) withOne++;
    }
    expect(withOne).toBeGreaterThan(30);   // they should be a regular part of a run
    expect(withOne).toBeLessThan(95);      // but not on literally every floor
  });
});

describe('Quest encounters: the offers themselves', () => {
  it('every quest is a complete, readable offer', () => {
    for (const q of Encounters.QUESTS) {
      for (const k of ['key', 'name', 'who', 'pitch', 'terms', 'reward']) {
        expect(q[k], `${q.key} is missing ${k}`).toBeTruthy();
      }
      expect(typeof q.accept, q.key).toBe('function');
      expect(typeof q.done, q.key).toBe('function');
      expect(typeof q.pay, q.key).toBe('function');
      expect(typeof q.objective, q.key).toBe('function');
    }
  });

  it('every quest a floor can hand out is one the game knows how to run', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const d = Dungeon.generateFloor(6, seed);
      for (const r of d.rooms) {
        if (r.encounter) expect(Encounters.byKey(r.encounter.key), `seed ${seed}`).toBeTruthy();
      }
    }
  });

  it('THE PACT can always find a mutator to burden you with', () => {
    // it picks from the mutators NOT already on the floor; with 10 in the pool and at
    // most 3 rolled, there is always something left to hand you
    expect(Rules.MUTATORS.length).toBeGreaterThan(3 + 1);
  });
});
