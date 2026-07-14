import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Evolutions } = loadGame();
const STATS = Object.keys(Evolutions.STAT_NAMES);

describe('Evolutions table', () => {
  it('has the 9 stat paths', () => {
    expect(STATS).toEqual(
      ['hp', 'dmg', 'spd', 'roll', 'crit', 'coin', 'regen', 'atkspd', 'magic']);
  });

  it('every stat offers 3 options at each of the I/II/III/IV tiers', () => {
    for (const key of STATS) {
      for (const stacks of [3, 6, 9, 12]) {
        const opts = Evolutions.optionsFor(key, stacks);
        expect(opts, `${key}@${stacks}`).toBeTruthy();
        expect(opts.length).toBe(3);
        for (const o of opts) {
          expect(o.name).toBeTruthy();
          expect(o.desc).toBeTruthy();
          expect(o.fx && typeof o.fx).toBe('object');
        }
      }
    }
  });

  it('returns null for non-tier stack counts', () => {
    expect(Evolutions.optionsFor('dmg', 1)).toBeNull();
    expect(Evolutions.optionsFor('dmg', 99)).toBeNull();
    expect(Evolutions.optionsFor('nonsense', 3)).toBeNull();
  });

  it('damage-reduction fx never implies going past the 60% cap in a single pick', () => {
    // sanity: no single evolution grants >= 0.6 reduce on its own
    for (const key of STATS) for (const stacks of [3, 6, 9, 12]) {
      for (const o of Evolutions.optionsFor(key, stacks)) {
        if (o.fx.reduce !== undefined) expect(o.fx.reduce).toBeLessThan(0.6);
      }
    }
  });
});
