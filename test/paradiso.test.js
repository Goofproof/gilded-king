import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Paradiso, Ascent, Descent, Rules, Dungeon } = loadGame();

// The whole Comedy, in floor numbers. If this map ever drifts, a player walks out of
// Purgatory straight into Hell's scenery, or the end of the book lands on the wrong
// floor and the joke does not fire.
describe('The whole Comedy maps onto the floors', () => {
  it('the castle, then Hell, then the mountain, then the heavens', () => {
    for (let f = 1; f <= 3; f++) {                      // the Mimic's trap castle
      expect(Descent.isDescent(f), `floor ${f}`).toBe(false);
      expect(Ascent.isAscent(f), `floor ${f}`).toBe(false);
      expect(Paradiso.isParadiso(f), `floor ${f}`).toBe(false);
    }
    for (let f = 4; f <= 12; f++) {                     // the nine circles
      expect(Dungeon.themeFor(f).name, `floor ${f}`).toContain('CIRCLE');
      expect(Paradiso.isParadiso(f), `floor ${f}`).toBe(false);
    }
    for (let f = 13; f <= 21; f++) {                    // the mountain
      expect(Ascent.isAscent(f), `floor ${f}`).toBe(true);
      expect(Paradiso.isParadiso(f), `floor ${f}`).toBe(false);
    }
    for (let f = 22; f <= 31; f++) {                    // the heavens
      expect(Ascent.isAscent(f), `floor ${f}`).toBe(false);
      expect(Paradiso.isParadiso(f), `floor ${f}`).toBe(true);
    }
  });

  it('the difficulty machinery still applies all the way up', () => {
    // isDescent() means "past the King", i.e. the endless region - it gates the threat
    // curve, the elites, the boss cadence and the mythic shops. Heaven is INSIDE it.
    for (const f of [13, 21, 22, 31, 40]) expect(Descent.isDescent(f), `floor ${f}`).toBe(true);
    expect(Descent.threat(31).hp).toBeGreaterThan(Descent.threat(22).hp);
  });
});

describe('The nine spheres', () => {
  it('run 22-30, in Dante\'s order, rising', () => {
    expect(Dungeon.themeFor(22).name).toContain('MOON');
    expect(Dungeon.themeFor(25).name).toContain('SUN');
    expect(Dungeon.themeFor(26).name).toContain('MARS');
    expect(Dungeon.themeFor(30).name).toContain('PRIMUM MOBILE');
    expect(Paradiso.SPHERES).toHaveLength(9);
  });

  it('every sphere is a full, usable theme', () => {
    for (let f = 22; f <= 31; f++) {
      const t = Dungeon.themeFor(f);
      for (const k of ['name', 'floor', 'wall', 'accent', 'detail', 'obstacle', 'ambient']) {
        expect(t[k], `floor ${f} is missing ${k}`).toBeTruthy();
      }
      expect(t.floor, `floor ${f}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('heaven does not wear hell\'s scenery', () => {
    const hell = [4, 5, 6, 7, 8, 9, 10, 11, 12].map(f => Dungeon.themeFor(f));
    for (let f = 22; f <= 31; f++) {
      const t = Dungeon.themeFor(f);
      for (const h of hell) {
        expect(t.floor, `floor ${f} floor colour`).not.toBe(h.floor);
        expect(t.accent, `floor ${f} accent`).not.toBe(h.accent);
      }
    }
  });
});

describe('The Empyrean: the end of the book', () => {
  it('is floor 31, and it is always a boss floor', () => {
    expect(Paradiso.EMPYREAN_FLOOR).toBe(31);
    expect(Paradiso.inEmpyrean(31)).toBe(true);
    // the last castle. The King is in it, whatever the Warden cadence says.
    for (let seed = 1; seed <= 25; seed++) {
      const d = Dungeon.generateFloor(31, seed);
      expect(d.rooms.some(r => r.type === 'boss'), `seed ${seed}`).toBe(true);
    }
  });

  it('carries no rule and no mutator - the only thing in the room is the King', () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(Rules.forFloor(31, seed).list, `seed ${seed}`).toHaveLength(0);
    }
  });

  it('the run does not end there: the spheres turn again, and say so', () => {
    expect(Paradiso.beyond(32)).toBe(true);
    expect(Dungeon.themeFor(32).name).toContain('BEYOND');
    expect(Dungeon.themeFor(32).name).toContain('MOON');   // round again from the first sphere
    expect(Rules.forFloor(32, 1).circle).toBeTruthy();     // and it has its rule back
  });
});

describe('The blessings, and their prices', () => {
  it('every sphere carries exactly one rule, and each one gives AND takes', () => {
    for (let f = 22; f <= 30; f++) {
      const r = Rules.forFloor(f, 1);
      expect(r.circle, `floor ${f}`).toBeTruthy();
    }
    // Paradiso's rules are blessings that cost something. Every one of them must move
    // at least one number in the player's favour AND one against, or it is just a
    // free floor (boring) or just a torment (that is Hell's job, not Heaven's).
    for (const s of Rules.SPHERE_RULES) {
      expect(s.name, s.key).toBeTruthy();
      expect(s.color, s.key).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.desc && s.desc.length, s.key).toBeGreaterThan(10);
    }
  });

  it('Mars cuts both ways, Venus heals you but you are made of glass', () => {
    const mars = Rules.forFloor(26, 1);          // MARS
    expect(mars.dmgMul).toBeGreaterThan(1);      // you hit harder
    expect(mars.monDmgMul).toBeGreaterThan(1);   // and so do they
    const venus = Rules.forFloor(24, 1);         // VENUS
    expect(venus.lifesteal).toBeGreaterThan(0);  // what you give comes back
    expect(venus.monDmgMul).toBeGreaterThan(1);  // and it costs you
  });

  it('Jupiter bills you for what you deal', () => {
    expect(Rules.forFloor(27, 1).justice).toBeGreaterThan(0);
  });

  it('Saturn is the exact inversion of Sloth\'s terrace', () => {
    // on SLOTH (floor 17) standing still HURTS you; on SATURN (28) it is the only
    // thing that heals you, and nothing else does.
    expect(Rules.forFloor(17, 1).circle.key).toBe('nevrest');
    const saturn = Rules.forFloor(28, 1);
    expect(saturn.circle.key).toBe('contemplative');
    expect(saturn.noRegen).toBe(true);
    expect(saturn.noHearts).toBe(true);
  });
});
