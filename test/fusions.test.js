// #252 FUSION v2 (FUSION-DESIGN.md): a mapped base-stat pair must offer its named
// STRIKE/STANCE/TRICK trio; unmapped pairs and Prime doubles keep the legacy grid.
import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Abilities } = loadGame();

describe('#252 fusion tables', () => {
  it('every mapped pair has exactly 3 options with the diversity rule', () => {
    for (const [key, trio] of Object.entries(Abilities.FUSIONS)) {
      expect(trio.length, `${key} must offer exactly 3`).toBe(3);
      const roles = trio.map(e => e.role).sort();
      expect(roles, `${key} must be Strike/Stance/Trick`).toEqual(['STANCE', 'STRIKE', 'TRICK']);
      const kinds = new Set(trio.map(e => e.kind));
      expect(kinds.size, `${key} options must not share a kind`).toBe(3);
      for (const e of trio) {
        expect(e.name, `${key} entry missing name`).toBeTruthy();
        expect(e.cdMax, `${e.name} missing cdMax`).toBeGreaterThan(0);
        expect(e.pp, `${e.name} missing per-rank scaling (pp)`).toBeTruthy();
        expect(e.desc, `${e.name} missing desc`).toBeTruthy();
      }
    }
  });

  it('pair keys are sorted base-stat names', () => {
    const STATS = ['MIGHT', 'VIGOR', 'AGILITY', 'ARCANE', 'FORTUNE'];
    for (const key of Object.keys(Abilities.FUSIONS)) {
      const [a, b] = key.split('+');
      expect(STATS).toContain(a);
      expect(STATS).toContain(b);
      expect([a, b].sort().join('+'), `${key} must be alphabetically sorted`).toBe(key);
    }
  });

  it('a mapped pair returns its named trio from rOptions', () => {
    const out = Abilities.rOptions(['dmg', 'hp'], ['MIGHT', 'VIGOR']);
    expect(out.map(r => r.name)).toEqual(['ATLAS', 'AJAX', 'ANTAEUS']);
    for (const r of out) {
      expect(r.fusion).toBe(true);
      expect(r.fusionStats).toEqual(['MIGHT', 'VIGOR']);
      expect(r.desc).toMatch(/Grows with your/);
    }
  });

  it('schools order does not matter (sorted key)', () => {
    const out = Abilities.rOptions(['hp', 'coin'], ['VIGOR', 'FORTUNE']);
    expect(out.map(r => r.name)).toEqual(['BLOOD MONEY', 'FORT KNOX', 'GOLDEN FLEECE']);
  });

  it('an unmapped pair falls back to the legacy grid (3 distinct kinds)', () => {
    const out = Abilities.rOptions(['dmg', 'magic'], ['MIGHT', 'ARCANE']); // wave 2 pair
    expect(out.length).toBe(3);
    expect(out.every(r => !r.fusion)).toBe(true);
    expect(new Set(out.map(r => r.kind)).size).toBe(3);
  });

  it('a Prime double (same school) keeps the legacy grid', () => {
    const out = Abilities.rOptions(['dmg', 'crit'], ['MIGHT', 'MIGHT']);
    expect(out.length).toBe(3);
    expect(out.every(r => !r.fusion)).toBe(true);
  });

  it('fusionRank sums the pair points', () => {
    expect(Abilities.fusionRank({ MIGHT: 4, VIGOR: 3, ARCANE: 9 }, ['MIGHT', 'VIGOR'])).toBe(7);
    expect(Abilities.fusionRank({}, ['MIGHT', 'VIGOR'])).toBe(0);
  });
});
