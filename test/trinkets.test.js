import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Trinkets } = loadGame();

describe('Trinkets: the shape of the deal', () => {
  it('every trinket is one gift and one price, with a real name', () => {
    expect(Trinkets.TRINKETS.length).toBeGreaterThanOrEqual(8);
    for (const t of Trinkets.TRINKETS) {
      expect(t.name, t.key).toBeTruthy();
      expect(t.color, t.key).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.gift && t.gift.length, `${t.key} gift`).toBeGreaterThan(4);
      expect(t.price && t.price.length, `${t.key} price`).toBeGreaterThan(4);
      // the price should read like a cost: it starts with "but"
      expect(t.price.toLowerCase().startsWith('but'), `${t.key} price phrasing`).toBe(true);
      expect(t.lore && t.lore.length, `${t.key} lore`).toBeGreaterThan(4);
    }
  });

  it('every trinket actually MOVES a number, one way and the other', () => {
    // a trinket that only gives, or only takes, is not a trinket - it is armour, or a
    // curse. Each one must have at least one favourable effect and at least one cost.
    for (const t of Trinkets.TRINKETS) {
      const mods = t.mods || {};
      const vals = Object.entries(mods);
      // reduce/maxHpPct/dmg etc: a positive is (almost always) a gift, negative a cost.
      // Every trinket must carry at least one of each, OR a behaviour flag that is the
      // gift with a numeric price (the flagged ones).
      const hasCost = vals.some(([, v]) => v < 0);
      const hasGain = vals.some(([, v]) => v > 0) || !!t.flag;
      expect(hasCost, `${t.key} must have a price`).toBe(true);
      expect(hasGain, `${t.key} must have a gift`).toBe(true);
    }
  });

  it('rollTrinket can exclude what you already carry', () => {
    const keys = Trinkets.TRINKETS.map(t => t.key);
    const exclude = keys.slice(0, keys.length - 1);   // everything but one
    for (let i = 0; i < 30; i++) {
      const t = Trinkets.rollTrinket({ exclude });
      expect(t.key).toBe(keys[keys.length - 1]);       // must roll the only one left
      expect(t.isTrinket).toBe(true);
    }
  });

  it('the behaviour flags are all wired to something the engine reads', () => {
    // if a trinket declares a flag, the engine has a matching check. A flag with no
    // consumer is a silent dead trinket - keep this set in step with the read sites.
    const known = new Set(['abilityHaste', 'zeno', 'gravity', 'revealMap', 'noSecondChance', 'medusa']);
    for (const t of Trinkets.TRINKETS) {
      if (t.flag) expect(known.has(t.flag), `${t.key} flag ${t.flag}`).toBe(true);
    }
  });
});
