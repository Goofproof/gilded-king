import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Rules, Descent, Dungeon } = loadGame();

// The Descent's floor rules are picked from (run seed, floor number) and NEVER from
// Math.random at pick time. Co-op depends on that: the host and the guest each build
// their own floor and must land on the same rules, or one player slides on ice while
// the other walks. These tests are the guard on that property.
describe('Floor rules: determinism (co-op safety)', () => {
  it('the same seed + floor always yields the same rules', () => {
    for (let f = 4; f <= 40; f++) {
      const a = Rules.forFloor(f, 12345).list.map(r => r.key);
      const b = Rules.forFloor(f, 12345).list.map(r => r.key);
      expect(b, `floor ${f}`).toEqual(a);
    }
  });

  it('a different seed yields a different run (the floors are not fixed)', () => {
    const runA = [], runB = [];
    for (let f = 4; f <= 40; f++) {
      runA.push(Rules.forFloor(f, 111).list.map(r => r.key).join('|'));
      runB.push(Rules.forFloor(f, 222).list.map(r => r.key).join('|'));
    }
    expect(runA).not.toEqual(runB);
  });

  it('the wind direction is stable for a floor, so the Gale is learnable', () => {
    expect(Rules.forFloor(5, 7).windAngle).toBe(Rules.forFloor(5, 7).windAngle);
    expect(Rules.forFloor(5, 7).windAngle).not.toBe(Rules.forFloor(14, 7).windAngle);
  });
});

describe('Floor rules: the nine circles', () => {
  it('every descent floor carries exactly one circle rule, and floors 1-3 carry none', () => {
    for (let f = 1; f <= 3; f++) expect(Rules.forFloor(f, 1).circle, `floor ${f}`).toBeNull();
    for (let f = 4; f <= 30; f++) expect(Rules.forFloor(f, 1).circle, `floor ${f}`).toBeTruthy();
  });

  it('the circle rule matches the circle you are actually standing in', () => {
    // circle rules are declared in Descent.CIRCLES order; floor 12 is TREACHERY = ice
    expect(Rules.forFloor(12, 1).circle.key).toBe('ice');
    expect(Dungeon.themeFor(12).name).toContain('TREACHERY');
    expect(Rules.forFloor(4, 1).circle.key).toBe('stillness');
    expect(Dungeon.themeFor(4).name).toContain('LIMBO');
  });

  it('the ice hands movement to its own hook rather than scaling the walk', () => {
    const r = Rules.forFloor(12, 1);
    expect(r.ownsMovement).toBe(true);
    expect(r.moveMul).toBe(0);
  });

  it('every circle rule has a name, a colour and a line of description for the card', () => {
    for (const r of Rules.CIRCLE_RULES) {
      expect(r.name, r.key).toBeTruthy();
      expect(r.color, r.key).toMatch(/^#[0-9a-f]{6}$/i);
      expect(r.desc && r.desc.length, r.key).toBeGreaterThan(10);
    }
  });
});

describe('Floor rules: the mutators', () => {
  it('mutators escalate with depth and start only after the first two circles', () => {
    expect(Rules.mutatorCount(4)).toBe(0);
    expect(Rules.mutatorCount(5)).toBe(0);
    expect(Rules.mutatorCount(6)).toBe(1);
    expect(Rules.mutatorCount(15)).toBe(2);
    expect(Rules.mutatorCount(25)).toBe(3);
  });

  it('a floor never rolls the same mutator twice', () => {
    for (let s = 1; s <= 40; s++) {
      for (let f = 6; f <= 40; f++) {
        const keys = Rules.forFloor(f, s).mutators.map(m => m.key);
        expect(new Set(keys).size, `seed ${s} floor ${f}`).toBe(keys.length);
      }
    }
  });

  it('the point of the whole thing: a long run is all distinct floors', () => {
    const seen = new Set();
    for (let f = 4; f <= 40; f++) seen.add(Rules.forFloor(f, 777).list.map(r => r.key).join('|'));
    expect(seen.size).toBe(37); // floors 4..40, no two alike
  });

  it('multipliers from the circle and its mutators STACK', () => {
    // Stillness (monHpMul 0.9) under The Swarm (monHpMul 0.5) => 0.45
    const stillness = Rules.CIRCLE_RULES.find(r => r.key === 'stillness');
    const swarm = Rules.MUTATORS.find(m => m.key === 'swarm');
    expect(stillness.monHpMul * swarm.monHpMul).toBeCloseTo(0.45, 5);
  });

  it('every mutator has a name, a colour and a line for the card', () => {
    for (const m of Rules.MUTATORS) {
      expect(m.name, m.key).toBeTruthy();
      expect(m.color, m.key).toMatch(/^#[0-9a-f]{6}$/i);
      expect(m.desc && m.desc.length, m.key).toBeGreaterThan(10);
    }
  });
});

describe('Floor rules: the empty set', () => {
  it('none() has the same shape as a real rule set, so callers never null-check', () => {
    const n = Rules.none(), r = Rules.forFloor(12, 1);
    for (const k of Object.keys(r)) expect(n, `missing ${k}`).toHaveProperty(k);
    expect(() => { n.player({}, 0.016, {}); n.spawn({}, {}); n.monster({}, 0.016, {}); }).not.toThrow();
  });
});
