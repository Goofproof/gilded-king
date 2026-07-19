// Mythics out-class legendaries (Sam): every mythic carries an EXTRA enchant slot beyond
// its hand-picked set - a bonus from its own pool, deterministic per mythic. This guards
// that so a future change to buildMythic can't quietly drop mythics back to a legendary's 3.
import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Weapons } = loadGame();

// force a specific mythic by excluding every other id from the roll
const build = (table, kind, id) =>
  Weapons.rollMythic(kind, { exclude: table.map(x => x.id).filter(x => x !== id) });

describe('mythics: every one gets an extra enchant slot', () => {
  it('each mythic WEAPON carries its 3 signature enchants + 1 bonus = 4, all unique + valid', () => {
    const validKeys = new Set(Weapons.ENCHANTS.map(e => e.key));
    for (const e of Weapons.MYTHIC_WEAPONS) {
      const w = build(Weapons.MYTHIC_WEAPONS, 'weapon', e.id);
      expect(w.mythicId, `built the wrong mythic for ${e.id}`).toBe(e.id);
      const keys = w.enchants.map(x => x.key);
      expect(keys.length, `${e.id} should have 4 enchants (3 + bonus)`).toBe(4);
      expect(new Set(keys).size, `${e.id} has a duplicate enchant`).toBe(4);
      for (const k of keys) expect(validKeys.has(k), `${e.id} has unknown enchant ${k}`).toBe(true);
    }
  });

  it('each mythic ARMOR gains one enchant beyond its hand-picked set, all unique + valid', () => {
    const validKeys = new Set(Weapons.ARMOR_ENCHANTS.map(e => e.key));
    for (const e of Weapons.MYTHIC_ARMOR) {
      const a = build(Weapons.MYTHIC_ARMOR, 'armor', e.id);
      const keys = a.enchants.map(x => x.key);
      expect(keys.length, `${e.id} should have base+1 enchants`).toBe(e.enchants.length + 1);
      expect(new Set(keys).size, `${e.id} has a duplicate enchant`).toBe(keys.length);
      for (const k of keys) expect(validKeys.has(k), `${e.id} has unknown enchant ${k}`).toBe(true);
    }
  });

  it('the bonus enchant is DETERMINISTIC - the same mythic always rolls the same one', () => {
    for (const e of Weapons.MYTHIC_WEAPONS.slice(0, 6)) {
      const a = build(Weapons.MYTHIC_WEAPONS, 'weapon', e.id).enchants.map(x => x.key);
      const b = build(Weapons.MYTHIC_WEAPONS, 'weapon', e.id).enchants.map(x => x.key);
      expect(b, `${e.id} rolled a different bonus on rebuild`).toEqual(a);
    }
  });
});
