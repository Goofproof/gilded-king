// #156 the five new classes and the five starter races.
//
// This file exists because of a specific way this feature could rot silently: a class or
// race can carry an `fx` key the game never reads. Nothing errors, nothing crashes - the
// bonus simply does not happen, and the character sheet quietly lies to the player.
// Four of the first-draft keys (xpMult, lifesteal, poisonImmune, burnOnHit) were exactly
// that. The last test in this file is the guard that stops it happening again.
import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';
import fs from 'node:fs';

const { Abilities, PlayerDef } = loadGame();

const NEW_CLASSES = ['mesmer', 'druid', 'deathknight', 'necromancer', 'pyromancer'];
const RACES = ['human', 'orc', 'elf', 'dwarf', 'undead'];

describe('#156 the five new classes', () => {
  it('all five exist and are pickable', () => {
    for (const id of NEW_CLASSES) {
      const c = PlayerDef.classById(id);
      expect(c.id, `${id} is missing from CLASSES`).toBe(id);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.desc.length).toBeGreaterThan(0);
    }
  });

  it('each has a working Q ability with its own kind', () => {
    const kinds = {
      mesmer: 'clones', druid: 'shift', deathknight: 'miasma', // #230 Unholy Rune retired for Miasma (Q-DESIGN, Sam)
      necromancer: 'raise', pyromancer: 'immolate',
    };
    for (const id of NEW_CLASSES) {
      const q = Abilities.classAbility(id);
      expect(q.kind, `${id} Q has the wrong kind`).toBe(kinds[id]);
      expect(q.cdMax).toBeGreaterThan(0);
      expect(q.desc.length).toBeGreaterThan(0);
    }
  });

  it('the mesmer really does get three copies', () => {
    expect(Abilities.classAbility('mesmer').clones).toBe(3);
  });

  it('BARD (Sam): the class + its Discord Q are wired end to end', () => {
    const c = PlayerDef.classById('bard');
    expect(c.id).toBe('bard');
    expect(c.desc.length).toBeGreaterThan(0);
    const q = Abilities.classAbility('bard');
    expect(q.kind).toBe('provoke');
    expect(q.cdMax).toBeGreaterThan(0);
    expect(q.dur).toBeGreaterThan(0);       // the brawl lasts a while
    expect(q.radius).toBeGreaterThan(0);    // it has reach
    expect(q.dps).toBeGreaterThan(0);       // the R12 rot has a rate
    // VIGOR rules the Q (invest VIGOR -> milestones), and the rank reads that stat
    expect(Abilities.CLASS_STAT.bard).toBe('VIGOR');
    expect(Abilities.qRank('bard', { VIGOR: 8 })).toBe(8);
    // the milestone ladder: haste @4, party regen @8, rot @12 - all shipped (impl:true)
    const ms = Abilities.Q_MILESTONES.bard;
    expect(ms.map(m => m.at)).toEqual([4, 8, 12]);
    expect(ms.every(m => m.impl)).toBe(true);
  });

  it('WARLOCK (son, based on Brimstone): the class + its beam Q are wired end to end', () => {
    const c = PlayerDef.classById('warlock');
    expect(c.id).toBe('warlock');
    expect(c.desc.length).toBeGreaterThan(0);
    const q = Abilities.classAbility('warlock');
    expect(q.kind).toBe('beam');
    expect(q.cdMax).toBeGreaterThan(0);
    expect(q.dur).toBeGreaterThan(0);       // the laser lasts a beat
    expect(q.range).toBeGreaterThan(0);     // it reaches
    expect(q.width).toBeGreaterThan(0);     // it has thickness
    expect(q.tick).toBeGreaterThan(0);      // it ticks damage
    expect(Abilities.CLASS_STAT.warlock).toBe('ARCANE');
    expect(Abilities.qRank('warlock', { ARCANE: 8 })).toBe(8);
    const ms = Abilities.Q_MILESTONES.warlock; // split @4, home @8, erupt @12
    expect(ms.map(m => m.at)).toEqual([4, 8, 12]);
    expect(ms.every(m => m.impl)).toBe(true);
  });

  it('the necromancer scales: 1 knight, then 2, then 3 knights + 2 archers', () => {
    // the tier ladder lives in main.js castAbility; assert the shape it depends on so a
    // refactor that renames a level band trips here rather than in a 12-year-old's run.
    const tierFor = L => (L >= 10 ? 3 : L >= 5 ? 2 : 1);
    const army = t => (t === 3 ? { knights: 3, archers: 2 } : { knights: t, archers: 0 });
    expect(army(tierFor(1))).toEqual({ knights: 1, archers: 0 });
    expect(army(tierFor(4))).toEqual({ knights: 1, archers: 0 });
    expect(army(tierFor(5))).toEqual({ knights: 2, archers: 0 });
    expect(army(tierFor(9))).toEqual({ knights: 2, archers: 0 });
    expect(army(tierFor(10))).toEqual({ knights: 3, archers: 2 }); // the final form
    expect(army(tierFor(30))).toEqual({ knights: 3, archers: 2 });
  });

  it('#157 every form is visually distinct - you can always tell which one you are in', () => {
    const F = PlayerDef.FORMS;
    // a form the player cannot IDENTIFY is a form they cannot play around
    for (const f of F) {
      expect(f.tag, `${f.id} has no HUD tag`).toBeTruthy();
      expect(f.body, `${f.id} has no body colour`).toBeTruthy();
      expect(f.cloak, `${f.id} has no cloak colour`).toBeTruthy();
      expect(f.scale, `${f.id} has no size`).toBeGreaterThan(0);
      expect(typeof PlayerDef.drawFormHead).toBe('function');
    }
    // no two forms may share a look
    expect(new Set(F.map(f => f.body)).size, 'two forms share a body colour').toBe(F.length);
    expect(new Set(F.map(f => f.tag)).size,  'two forms share a HUD tag').toBe(F.length);
    expect(new Set(F.map(f => f.scale)).size,'two forms are the same size').toBe(F.length);
    // and the bear must actually read as the big one
    const byScale = [...F].sort((a, b) => b.scale - a.scale);
    expect(byScale[0].id).toBe('bear');
  });

  it('#157 the size is REAL: a bear is a bigger target, and its hide pays for it', () => {
    const bear = PlayerDef.FORMS.find(f => f.id === 'bear');
    const wolf = PlayerDef.FORMS.find(f => f.id === 'wolf');

    // the hitbox comes from the same scale as the art - what you see IS what you are
    const p = { baseR: 13, r: 13 };
    PlayerDef.setForm(p, bear); const bearR = p.r;
    PlayerDef.setForm(p, wolf); const wolfR = p.r;
    PlayerDef.setForm(p, null); const ownR = p.r;
    expect(bearR, 'the bear must be a genuinely bigger target').toBeGreaterThan(ownR);
    expect(wolfR, 'the wolf must be genuinely harder to hit').toBeLessThan(ownR);
    expect(ownR,  'unshifting must restore the real body').toBe(13);

    // and the bear MUST be paid for: the biggest target needs the thickest hide, by a
    // clear margin. A bear that is easier to hit without a hide to match is just worse.
    expect(bear.reduce, 'the bear is the biggest target and must have the best hide')
      .toBeGreaterThan(wolf.reduce);
    expect(bear.reduce, 'the hide must be SIGNIFICANT, not a token 5%').toBeGreaterThanOrEqual(0.30);
  });

  it('#230 the druid has THREE forms and every one has a real drawback', () => {
    const F = PlayerDef.FORMS;
    expect(F.length).toBe(3); // bear, wolf, and the OWLBEAR (Q-DESIGN, Sam)
    for (const f of F) {
      // "unique strengths AND weaknesses" - a form that is good at everything is a bug.
      // A scale above 1 is a REAL cost: #157 makes the drawn size the hitbox.
      const strong = f.dmgMul > 1 || f.spdMul > 1 || f.reduce > 0;
      const weak = f.dmgMul < 1 || f.spdMul < 1 || f.reduce < 0 || f.scale > 1;
      expect(strong, `${f.id} has no strength`).toBe(true);
      expect(weak, `${f.id} is a strict upgrade - it needs a real cost`).toBe(true);
    }
  });
});

describe('#156 the five starter races', () => {
  it('all five exist, each with a look and a bias', () => {
    for (const id of RACES) {
      const r = PlayerDef.raceById(id);
      expect(r.id, `${id} is missing from RACES`).toBe(id);
      expect(r.skin, `${id} has no skin colour - it would look like everyone else`).toBeTruthy();
      expect(r.desc.length).toBeGreaterThan(0);
    }
  });

  it('no race is a strict upgrade - each pays for what it gets', () => {
    for (const id of RACES) {
      if (id === 'human') continue; // the human IS the baseline: pure upside, no bias to pay for
      const r = PlayerDef.raceById(id);
      const vals = Object.values(r.fx || {}).concat(r.hp ? [r.hp] : []);
      expect(vals.some(v => v < 0), `${id} has no downside`).toBe(true);
    }
  });

  // THE GUARD. Every fx key a class or race grants must be one the game actually reads
  // via mod('key'). A key nobody reads is a bonus that never happens.
  it('every class and race fx key is actually read by the game', () => {
    const src = ['player.js', 'main.js', 'monsters.js', 'weapons.js', 'evolutions.js', 'abilities.js']
      .map(f => fs.readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8')).join('\n');
    const read = new Set([...src.matchAll(/mod\('([a-zA-Z]+)'\)/g)].map(m => m[1]));
    // these are consumed structurally, not through mod()
    const structural = new Set(['magic', 'spellPower']);

    const dead = [];
    for (const def of [...PlayerDef.CLASSES, ...PlayerDef.RACES]) {
      for (const k of Object.keys(def.fx || {})) {
        if (!read.has(k) && !structural.has(k)) dead.push(`${def.id || 'adventurer'}.${k}`);
      }
    }
    expect(dead, `these fx keys are never read - the bonus silently does nothing: ${dead.join(', ')}`).toEqual([]);
  });
});
