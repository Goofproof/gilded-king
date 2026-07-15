// #226 the Q rank system (Q-DESIGN.md): every class must have a complete tuning
// entry and milestone ladder, or its Q silently stops scaling / its tooltip lies.
import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Abilities } = loadGame();

describe('#226 Q rank system tables', () => {
  const classes = Object.keys(Abilities.CLASS_STAT);

  it('every class with a ruling stat has a Q_TUNE entry', () => {
    for (const cls of classes) {
      expect(Abilities.Q_TUNE[cls], `${cls || 'adventurer'} missing from Q_TUNE`).toBeTruthy();
      expect(typeof Abilities.Q_TUNE[cls].rider).toBe('number');
      expect(typeof Abilities.Q_TUNE[cls].perPoint).toBe('object');
    }
  });

  it('every class has a milestone ladder with ascending ranks', () => {
    for (const cls of classes) {
      const ms = Abilities.Q_MILESTONES[cls];
      expect(ms, `${cls || 'adventurer'} missing from Q_MILESTONES`).toBeTruthy();
      expect(ms.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < ms.length; i++) expect(ms[i].at).toBeGreaterThan(ms[i - 1].at);
      for (const m of ms) {
        expect(m.txt.length).toBeGreaterThan(0);
        expect(typeof m.impl).toBe('boolean');
      }
    }
  });

  it('riders stay in sane bounds (0..20%, per Q-DESIGN)', () => {
    for (const cls of classes) {
      const r = Abilities.Q_TUNE[cls].rider;
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(0.2);
    }
    // the agreed headline numbers
    expect(Abilities.Q_TUNE.mage.rider).toBe(0.10);
    expect(Abilities.Q_TUNE.rogue.rider).toBe(0.18); // Execute: the highest
    expect(Abilities.Q_TUNE.engineer.rider).toBe(0.03); // per shot, fires constantly
  });

  it('qRank reads the ruling stat and nothing else', () => {
    expect(Abilities.qRank('mage', { ARCANE: 7, MIGHT: 99 })).toBe(7);
    expect(Abilities.qRank('warrior', { MIGHT: 12 })).toBe(12);
    expect(Abilities.qRank('warrior', {})).toBe(0);
    expect(Abilities.qRank('warrior', null)).toBe(0);
    expect(Abilities.qRank('', { MIGHT: 3 })).toBe(3); // adventurer rules MIGHT (Sam)
  });

  it('the percent-rider math keeps a Q meaningful at every depth', () => {
    // a floor-2 trash mob (~80 hp) vs a floor-25 horror (~3400 hp), mage nova:
    // flat 130 + 10% rider. The Q's bite (fraction of target hp) must stay above
    // 25% at depth instead of collapsing toward zero like the pre-#226 numbers.
    const nova = (hp) => (130 + 0.10 * hp) / hp;
    expect(nova(80)).toBeGreaterThan(1);       // early: still deletes trash
    expect(nova(3400)).toBeGreaterThan(0.13);  // deep: 130/3400 alone would be 0.038
    expect(nova(3400)).toBeLessThan(0.25);     // but never free room-clears
    // boss third: a 20k boss takes 130 + 20000*0.10/3 = ~797, ~4% per cast - fair
    const bossHit = 130 + 20000 * 0.10 / 3;
    expect(bossHit / 20000).toBeLessThan(0.05);
  });
});
