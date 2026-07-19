// Gear pacing (Sam): no legendaries can DROP on the first three floors. Implemented as a
// maxRarity cap on the roll (kills + chests pass maxRarity:3 while floorNum <= 3). This guards
// that the cap holds, that a boss's guaranteed legendary (minRarity:4) still wins, and that
// uncapped rolls can still reach legendary - so a future refactor can't quietly undo the pacing.
import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Weapons } = loadGame();
const rarOf = w => w.rarity || (w.rarityName || '').toLowerCase();

describe('early-floor rarity cap', () => {
  it('maxRarity:3 (Epic) never rolls a legendary, across many rolls', () => {
    for (let i = 0; i < 1500; i++) {
      const w = Weapons.rollWeapon(3, { luck: 0.5, maxRarity: 3 });
      expect(rarOf(w), `roll ${i} was ${rarOf(w)} under an Epic cap`).not.toBe('legendary');
    }
  });

  it('the cap applies to armor too', () => {
    for (let i = 0; i < 800; i++) {
      const a = Weapons.rollArmor(3, { luck: 0.5, maxRarity: 3 });
      expect(rarOf(a)).not.toBe('legendary');
    }
  });

  it('a boss guarantee (minRarity:4) still delivers a legendary even under the cap', () => {
    // the cap is clamped to be at least minRarity, so a boss reward is never downgraded
    for (let i = 0; i < 50; i++) {
      const w = Weapons.rollWeapon(3, { minRarity: 4, maxRarity: 3 });
      expect(rarOf(w)).toBe('legendary');
    }
  });

  it('uncapped rolls still reach legendary (the pacing is floor-scoped, not global)', () => {
    let sawLegendary = false;
    for (let i = 0; i < 3000 && !sawLegendary; i++) {
      if (rarOf(Weapons.rollWeapon(3, { luck: 0.5 })) === 'legendary') sawLegendary = true;
    }
    expect(sawLegendary, 'no legendary in 3000 uncapped rolls - cap leaked to floor 4+?').toBe(true);
  });
});
