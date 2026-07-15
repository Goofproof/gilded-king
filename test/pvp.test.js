// #224 PVP Phase 0: FRIENDLY FIRE. The melee sweep in applyMelee gained a second
// loop that tests TEAMMATES (partyTargets isRemote entries) with the same
// range/arc/wall rules as monsters, gated on g.friendlyFire. These tests guard the
// gate and the geometry: FF off must never hurt a teammate (normal co-op depends on
// it), FF on must respect range, arc and walls, and must never target yourself.
import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { PlayerDef, Weapons } = loadGame();

// a melee weapon with known reach; roll until we get a sword-type (not bow/wand/staff)
function meleeWeapon() {
  for (let i = 0; i < 200; i++) {
    const w = Weapons.rollWeapon(1, {});
    if (w.archetype === 'light' || w.archetype === 'heavy') return w;
  }
  throw new Error('no melee weapon in 200 rolls');
}

// a player mid-swing, aimed due east, with a scripted party around them
function rig(opts = {}) {
  const p = new PlayerDef.Player(null);
  p.weapons.a = opts.weapon || meleeWeapon(); p.slot = 'a'; // .weapon is a getter over weapons[slot]
  p.facing = 0; // east
  p.swing = { fx: null };
  const hits = [];
  const g = {
    friendlyFire: opts.ff !== false,
    coop: true,
    monsters: [],
    room: { walls: opts.walls ? opts.walls(p) : [] },
    partyTargets: () => opts.targets(p),
    hurtTarget: (t, dmg, sx, sy, src) => hits.push({ id: t.id, dmg }),
  };
  p.applyMelee(g);
  return { p, hits };
}

describe('#224 friendly fire melee sweep', () => {
  it('FF ON: a teammate in range, in the arc, gets hit with real damage', () => {
    const { hits } = rig({
      targets: p => [{ x: p.x + 30, y: p.y, r: 13, isRemote: true, id: 'p9' }],
    });
    expect(hits.length).toBe(1);
    expect(hits[0].id).toBe('p9');
    expect(hits[0].dmg).toBeGreaterThan(0);
    expect(Number.isFinite(hits[0].dmg)).toBe(true);
  });

  it('FF OFF: the identical swing hurts nobody (normal co-op depends on this)', () => {
    const { hits } = rig({
      ff: false,
      targets: p => [{ x: p.x + 30, y: p.y, r: 13, isRemote: true, id: 'p9' }],
    });
    expect(hits.length).toBe(0);
  });

  it('never targets yourself or local clones (isRemote false is skipped)', () => {
    const { hits } = rig({
      targets: p => [
        { x: p.x, y: p.y, r: 13, isRemote: false, id: 'me' },
        { x: p.x + 20, y: p.y, r: 12, isRemote: false, id: 'clone' },
      ],
    });
    expect(hits.length).toBe(0);
  });

  it('respects weapon range: a teammate across the room is safe', () => {
    const { hits } = rig({
      targets: p => [{ x: p.x + 500, y: p.y, r: 13, isRemote: true, id: 'far' }],
    });
    expect(hits.length).toBe(0);
  });

  it('respects the swing arc: a teammate BEHIND you is safe', () => {
    const { hits } = rig({
      targets: p => [{ x: p.x - 30, y: p.y, r: 13, isRemote: true, id: 'behind' }],
    });
    expect(hits.length).toBe(0);
  });

  it('a wall between you blocks the swing, same as for monsters', () => {
    const { hits } = rig({
      // a thin wall RECT (dungeon walls are {x,y,w,h}) exactly between attacker and target
      walls: p => [{ x: p.x + 15, y: p.y - 100, w: 4, h: 200 }],
      targets: p => [{ x: p.x + 30, y: p.y, r: 13, isRemote: true, id: 'p9' }],
    });
    expect(hits.length).toBe(0);
  });

  it('computeDmg survives a null target (PVP hits have no monster to inspect)', () => {
    const p = new PlayerDef.Player(null);
    p.weapons.a = meleeWeapon(); p.slot = 'a';
    const { dmg, crit } = p.computeDmg(10, null, {});
    expect(Number.isFinite(dmg)).toBe(true);
    expect(dmg).toBeGreaterThan(0);
    expect(typeof crit).toBe('boolean');
  });
});
