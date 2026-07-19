// Deep-floor variety (Sam): elites are ~half of deep-floor mobs, so the affix pool must carry
// BEHAVIOURAL variety, not just size/speed. This guards that the three behavioural affixes
// (berserk/warded/vampiric) stay in the pool with the flags monsters.js / player.js read, and
// that every affix keeps the stat-mul shape make() consumes.
import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Descent } = loadGame();

describe('elite affixes', () => {
  it('the pool holds all six affixes, including the three behavioural ones', () => {
    const keys = Descent.AFFIXES.map(a => a.key);
    for (const k of ['giant', 'swift', 'volatile', 'berserk', 'warded', 'vampiric']) {
      expect(keys, `missing affix ${k}`).toContain(k);
    }
  });

  it('berserk frenzies, warded blocks, vampiric leeches - the behaviour flags are present', () => {
    const by = k => Descent.AFFIXES.find(a => a.key === k);
    expect(by('berserk').frenzy, 'berserk lost its frenzy flag').toBeTruthy();
    expect(by('warded').ward, 'warded lost its ward flag').toBeTruthy();
    expect(by('vampiric').leech, 'vampiric lost its leech fraction').toBeGreaterThan(0);
    expect(by('volatile').blast, 'volatile lost its death blast').toBeGreaterThan(0);
  });

  it('every affix keeps the stat-mul shape make() reads', () => {
    for (const a of Descent.AFFIXES) {
      expect(typeof a.hpMul, `${a.key} hpMul`).toBe('number');
      expect(typeof a.dmgMul, `${a.key} dmgMul`).toBe('number');
      expect(typeof a.speedMul, `${a.key} speedMul`).toBe('number');
      expect(a.color, `${a.key} color`).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  });

  it('rollAffix only ever returns a member of the pool', () => {
    const set = new Set(Descent.AFFIXES);
    for (let i = 0; i < 300; i++) expect(set.has(Descent.rollAffix())).toBe(true);
  });
});
