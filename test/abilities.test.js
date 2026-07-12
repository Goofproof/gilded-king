import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Abilities, Evolutions } = loadGame();
const STATS = Object.keys(Evolutions.STAT_NAMES); // hp dmg spd roll crit coin regen atkspd

describe('Abilities.build (Q = first two evolutions)', () => {
  it('builds a known combo with the right action + modifier', () => {
    const a = Abilities.build('dmg', 'spd'); // Cleave nova + Swift modifier
    expect(a.name).toBe('Swift Cleave');
    expect(a.kind).toBe('nova');
    expect(a.cdMax).toBeCloseTo(6.8, 5); // 8 * 0.85 (Swift shortens cooldown)
    expect(a.desc.length).toBeGreaterThan(0);
  });

  it('same stat twice yields a Prime version', () => {
    expect(Abilities.build('hp', 'hp').name).toBe('Prime Bulwark');
    expect(Abilities.build('dmg', 'dmg').dmgMul).toBeGreaterThan(1);
  });

  it('every one of the 64 stat pairs yields a valid ability', () => {
    let count = 0;
    for (const s1 of STATS) {
      for (const s2 of STATS) {
        const a = Abilities.build(s1, s2);
        expect(a.name, `${s1}+${s2}`).toBeTruthy();
        expect(['nova', 'dash', 'strike', 'buff']).toContain(a.kind);
        expect(a.cdMax).toBeGreaterThan(0);
        expect(typeof a.desc).toBe('string');
        count++;
      }
    }
    expect(count).toBe(64);
  });

  it('cooldown starts ready (cd 0) and never exceeds a sane bound', () => {
    for (const s1 of STATS) for (const s2 of STATS) {
      const a = Abilities.build(s1, s2);
      expect(a.cd).toBe(0);
      expect(a.cdMax).toBeLessThanOrEqual(12);
    }
  });
});

describe('Abilities.buildUltimates (left-click = choose 1 of 3 from Q + R)', () => {
  it('returns exactly three ready ultimates carrying the ult flag', () => {
    const q = Abilities.build('dmg', 'crit');
    const r = Abilities.build('spd', 'hp');
    const ults = Abilities.buildUltimates(q, r);
    expect(ults.length).toBe(3);
    for (const u of ults) {
      expect(u.ult).toBe(true);
      expect(u.cd).toBe(0);
      expect(u.cdMax).toBeGreaterThanOrEqual(15); // ults are long-cooldown
      expect(u.name).toBeTruthy();
      expect(typeof u.desc).toBe('string');
    }
  });

  it('amped ults out-damage their source ability; fusion is a nova', () => {
    const q = Abilities.build('dmg', 'dmg'); // Prime Cleave, big numbers
    const r = Abilities.build('crit', 'crit');
    const [uq, ur, fusion] = Abilities.buildUltimates(q, r);
    expect(uq.dmg).toBeGreaterThan(q.dmg);
    expect(ur.dmg).toBeGreaterThan(r.dmg);
    expect(fusion.kind).toBe('nova');
    expect(fusion.name).toBe('FUSION CATACLYSM');
  });

  it('works for all Q x R pairings without throwing', () => {
    for (const s1 of STATS) for (const s2 of STATS) {
      const q = Abilities.build(s1, s2);
      const r = Abilities.build(s2, s1);
      const ults = Abilities.buildUltimates(q, r);
      expect(ults.length).toBe(3);
      ults.forEach(u => expect(u.ult).toBe(true));
    }
  });
});
