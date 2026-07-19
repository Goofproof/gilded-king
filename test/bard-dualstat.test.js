// Bard is the first DUAL-STAT class (Sam): its Q ranks off Fortune + Arcane, not one stat.
// A ruling stat may be an array now; qRank sums the points across all ruling stats. Guards
// that the bard is dual, sums correctly, VIGOR no longer feeds it, and single-stat classes
// are untouched.
import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Abilities } = loadGame();

describe('bard dual-stat Q rank', () => {
  it('the bard is ruled by BOTH Fortune and Arcane', () => {
    const ruling = Abilities.CLASS_STAT.bard;
    expect(Array.isArray(ruling)).toBe(true);
    expect(ruling).toContain('FORTUNE');
    expect(ruling).toContain('ARCANE');
  });

  it('qRank SUMS the two ruling stats', () => {
    expect(Abilities.qRank('bard', { FORTUNE: 3, ARCANE: 5 })).toBe(8);
    expect(Abilities.qRank('bard', { FORTUNE: 12, ARCANE: 0 })).toBe(12);
    expect(Abilities.qRank('bard', { FORTUNE: 6, ARCANE: 6 })).toBe(12);
  });

  it('the old ruling stat (VIGOR) no longer feeds the bard Q', () => {
    expect(Abilities.qRank('bard', { VIGOR: 9 })).toBe(0);
  });

  it('single-stat classes are unchanged', () => {
    expect(Abilities.qRank('mage', { ARCANE: 7 })).toBe(7);
    expect(Abilities.qRank('warrior', { MIGHT: 5 })).toBe(5);
    expect(Abilities.qRank('gambler', { FORTUNE: 4 })).toBe(4);
  });
});
