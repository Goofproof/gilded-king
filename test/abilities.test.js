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
