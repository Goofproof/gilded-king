import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { Ascent, Descent, Paradiso, Rules, Dungeon } = loadGame();

// Mount Purgatory sits INSIDE the Descent's floor range: everything past the King is
// "the Descent" as far as the difficulty curve, the elites and the boss cadence are
// concerned. What changes at floor 13 is where you ARE and which way you are going.
// These tests pin that boundary down, because getting it wrong means either the
// mountain wears Hell's scenery or the difficulty curve silently resets.
describe('The turn: where Hell ends and the mountain begins', () => {
  it('the nine circles are floors 4-12, and nothing above', () => {
    for (let f = 4; f <= 12; f++) {
      expect(Ascent.isAscent(f), `floor ${f} should still be Hell`).toBe(false);
      expect(Dungeon.themeFor(f).name, `floor ${f}`).toContain('CIRCLE');
    }
  });

  it('floor 13 is the shore, and it is where you come out', () => {
    expect(Ascent.isAscent(13)).toBe(true);
    expect(Ascent.onShore(13)).toBe(true);
    expect(Dungeon.themeFor(13).name).toContain('SHORE');
    expect(Ascent.altitude(13)).toBe(0); // you are at the BOTTOM of the mountain
  });

  it('the mountain is still inside the Descent, so the difficulty keeps climbing', () => {
    // this is the load-bearing one: if isDescent() went false up here, the threat
    // curve, the elites, the boss cadence and the mythic shops would all switch off
    for (const f of [13, 14, 20, 30]) expect(Descent.isDescent(f), `floor ${f}`).toBe(true);
    expect(Descent.threat(30).hp).toBeGreaterThan(Descent.threat(14).hp);
  });

  it('the seven terraces run 14-20, and then the mountain ENDS', () => {
    expect(Dungeon.themeFor(14).name).toContain('PRIDE');
    expect(Dungeon.themeFor(20).name).toContain('LUST');
    // The mountain is FINITE, unlike Hell. At the top of Purgatory is the Earthly
    // Paradise and above that there is no more mountain - only sky. Floor 21 used to
    // wrap back round to Pride; now it is the summit, and 22+ are the heavens.
    expect(Ascent.onSummit(21)).toBe(true);
    expect(Dungeon.themeFor(21).name).toContain('EARTHLY PARADISE');
    expect(Ascent.isAscent(22)).toBe(false);                 // the mountain has ended
    expect(Paradiso.isParadiso(22)).toBe(true);              // and the sky has begun
  });

  it('altitude rises with the floor (the readout is not a depth any more)', () => {
    expect(Ascent.altitude(14)).toBe(1);
    expect(Ascent.altitude(20)).toBe(7);
    expect(Ascent.altitude(30)).toBeGreaterThan(Ascent.altitude(20));
  });
});

describe('The mountain is not Hell repainted', () => {
  it('no terrace reuses a circle palette, obstacle set or soundscape wholesale', () => {
    const hellFloors = Object.fromEntries(
      [4, 5, 6, 7, 8, 9, 10, 11, 12].map(f => [f, Dungeon.themeFor(f)]));
    for (let f = 13; f <= 20; f++) {
      const t = Dungeon.themeFor(f);
      for (const h of Object.values(hellFloors)) {
        expect(t.floor, `floor ${f} floor colour`).not.toBe(h.floor);
        expect(t.accent, `floor ${f} accent`).not.toBe(h.accent);
      }
    }
  });

  it('every terrace has a full theme the renderer and the audio engine can use', () => {
    for (let f = 13; f <= 20; f++) {
      const t = Dungeon.themeFor(f);
      for (const k of ['name', 'floor', 'wall', 'accent', 'detail', 'obstacle', 'ambient']) {
        expect(t[k], `floor ${f} is missing ${k}`).toBeTruthy();
      }
      expect(t.floor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('The seven penances', () => {
  it('each terrace carries exactly one rule, and the shore carries none', () => {
    expect(Rules.forFloor(13, 1).circle, 'the shore is a breather').toBeNull();
    for (let f = 14; f <= 20; f++) expect(Rules.forFloor(f, 1).circle, `floor ${f}`).toBeTruthy();
  });

  it('the shore carries no MUTATOR either - it is the one calm floor in the endless region', () => {
    for (let s = 1; s <= 30; s++) {
      expect(Rules.forFloor(13, s).mutators, `seed ${s}`).toHaveLength(0);
      expect(Rules.forFloor(13, s).list, `seed ${s}`).toHaveLength(0);
    }
    // and the terrace immediately above it goes straight back to carrying them
    expect(Rules.forFloor(14, 1).mutators.length).toBeGreaterThan(0);
  });

  it('the rule on a terrace is that terrace\'s own penance', () => {
    expect(Rules.forFloor(14, 1).circle.key).toBe('weight');    // Pride
    expect(Rules.forFloor(15, 1).circle.key).toBe('sewneyes');  // Envy
    expect(Rules.forFloor(17, 1).circle.key).toBe('nevrest');   // Sloth
    expect(Rules.forFloor(20, 1).circle.key).toBe('refining');  // Lust
  });

  it('Pride takes the dodge roll away; nothing else does', () => {
    expect(Rules.forFloor(14, 1).noRoll).toBe(true);
    for (const f of [13, 15, 16, 17, 18, 19, 20]) expect(Rules.forFloor(f, 1).noRoll, `floor ${f}`).toBe(false);
  });

  it('Avarice pays nothing in gold and more in experience', () => {
    const r = Rules.forFloor(18, 1);
    expect(r.coinMul).toBe(0);
    expect(r.xpMul).toBeGreaterThan(1);
  });

  it('Gluttony stops both the hearts and the regeneration', () => {
    const r = Rules.forFloor(19, 1);
    expect(r.noHearts).toBe(true);
    expect(r.noRegen).toBe(true);
  });

  it('Envy and Wrath set a finite sight range; the other terraces do not', () => {
    expect(Rules.forFloor(15, 1).vision).toBeLessThan(Infinity);
    expect(Rules.forFloor(16, 1).fade).toBeLessThan(Infinity);
    expect(Rules.forFloor(14, 1).vision).toBe(Infinity);
  });

  it('every penance has a name, a colour and a line for the floor card', () => {
    for (const r of Rules.TERRACE_RULES) {
      expect(r.name, r.key).toBeTruthy();
      expect(r.color, r.key).toMatch(/^#[0-9a-f]{6}$/i);
      expect(r.desc && r.desc.length, r.key).toBeGreaterThan(10);
    }
  });
});

describe('The mountain keeps co-op honest', () => {
  it('terrace rules are stable for a seed and the mutators still stack on them', () => {
    for (let f = 13; f <= 40; f++) {
      const a = Rules.forFloor(f, 4242).list.map(r => r.key);
      const b = Rules.forFloor(f, 4242).list.map(r => r.key);
      expect(b, `floor ${f}`).toEqual(a);
    }
    // a deep terrace carries its penance AND its mutators
    const deep = Rules.forFloor(30, 99);
    expect(deep.circle).toBeTruthy();
    expect(deep.mutators.length).toBeGreaterThan(0);
    expect(deep.list.length).toBe(1 + deep.mutators.length);
  });

  it('the whole climb is distinct floors, apart from the QUIET ones', () => {
    // Three floors carry no rules at all, on purpose: the Shore (13), the Earthly
    // Paradise (21) and the Empyrean (31). They are the beats. Every OTHER floor from
    // 13 to 40 must be a unique combination, or the run has started repeating itself.
    const quiet = [13, 21, 31];
    const seen = new Set();
    let n = 0;
    for (let f = 13; f <= 40; f++) {
      if (quiet.includes(f)) {
        expect(Rules.forFloor(f, 31337).list, `floor ${f} should be quiet`).toHaveLength(0);
        continue;
      }
      seen.add(Rules.forFloor(f, 31337).list.map(r => r.key).join('|'));
      n++;
    }
    expect(seen.size).toBe(n);   // no two alike
  });
});
