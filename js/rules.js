// ============================================================================
// rules.js - FLOOR RULES: the things that change how a floor PLAYS, not just how
// it looks (Sam + Claude, 2026-07-14).
//
// One engine, two customers:
//   1. CIRCLE RULES (layer 1) - each of Dante's nine circles has one signature
//      rule, fixed and permanent. Wrath always enrages. Treachery is always ice.
//      That is what makes a circle a PLACE instead of a repaint.
//   2. FLOOR MUTATORS (layer 2) - rolled at random per floor, stacked on top of
//      the circle rule, so floor 20 is never the same floor 20 twice. That is
//      what makes the Descent endless instead of merely long.
//
// Building both on one rule object matters: a mutator and a circle rule do the
// same KINDS of things, so they get the same hooks and are tested by the same
// code path.
//
// A RULE:
//   key, name, desc, color   - identity, and what the floor card shows
//   moveMul                  - multiplies the player's walk speed (1 = normal)
//   coinMul, eliteAdd        - loot and elite-chance nudges
//   monDmgMul, monHpMul      - monster stat nudges
//   player(p, dt, g)         - per-frame, on the player. Runs AFTER normal
//                              movement and BEFORE obstacle/wall resolution, so a
//                              rule can shove the player and still not clip walls.
//   spawn(m, g)              - once, when a monster is created on this floor
//
// Every field is optional. A rule that only sets a colour is legal.
//
// DETERMINISM: rules are chosen from the FLOOR NUMBER and the run seed only, never
// from Math.random at pick time, so a co-op host and guest always agree on the
// rules in force. (Seed determinism is what the dungeon test suite guards.)
// ============================================================================
const Rules = (() => {

  // ---------------------------------------------------------------------------
  // THE NINE CIRCLE RULES - one per circle, in Descent.CIRCLES order.
  // ---------------------------------------------------------------------------
  const CIRCLE_RULES = [
    { key: 'stillness', name: 'STILLNESS', color: '#8f97a3',
      desc: 'Nothing is tormented here. Nothing is spared, either.',
      // Limbo: the one floor with no elites. It is a held breath, and the calm is
      // the point - the circles either side of it hit harder for it.
      eliteAdd: -1, monHpMul: 0.9,
      spawn(m) { m.speed *= 0.82; },
    },
    { key: 'gale', name: 'THE GALE', color: '#c060ff',
      desc: 'The storm that never rests. It will not let you stand still.',
      // Lust: a wind blows across the whole circle and shoves you sideways. The
      // direction is fixed for the floor (set in forFloor) so it is learnable, not
      // just noise.
      player(p, dt, g) {
        const w = g.rules.windAngle;
        p.x += Math.cos(w) * 62 * dt;
        p.y += Math.sin(w) * 62 * dt;
      },
    },
    { key: 'mire', name: 'THE MIRE', color: '#9aae4a',
      desc: 'Cold filth, up to the knee. You will not outrun anything here.',
      // Gluttony: you are slow. Everything that chases you is not.
      moveMul: 0.74,
    },
    { key: 'hoard', name: 'THE HOARD', color: '#ffd24c',
      desc: 'Gold, everywhere. Not all of it is gold.',
      // Greed: double coin, but the chests bite far more often (mimicAdd is read by
      // the chest roll). Greed punished, literally.
      coinMul: 2, mimicAdd: 0.35,
    },
    { key: 'fury', name: 'THE FURY', color: '#ff4444',
      desc: 'Every soul here arrives already screaming.',
      // Wrath: every monster spawns ENRAGED - the empowered state (gold ring, big
      // move armed) that normally has to be earned mid-fight.
      spawn(m) { m.emp = true; m.empowerCd = 0; },
    },
    { key: 'pyres', name: 'THE PYRES', color: '#ff6a2c',
      desc: 'The tombs are open, and they are burning.',
      // Heresy: the obstacles are on fire. Touching one hurts. The room's cover
      // becomes the room's threat, which flips how you fight it.
      player(p, dt, g) {
        if (!g.room || !g.room.obstacles) return;
        p._pyreCd = Math.max(0, (p._pyreCd || 0) - dt);
        if (p._pyreCd > 0) return;
        for (const o of g.room.obstacles) {
          if (o.kind === 'pit') continue;
          if (Math.hypot(p.x - o.x, p.y - o.y) < o.r + p.r + 3) {
            p.damage(6, o.x, o.y, g);
            p._pyreCd = 0.8; // so brushing a tomb is a burn, not instant death
            if (typeof Fx !== 'undefined') Fx.burst(p.x, p.y, ['#ff6a2c', '#ffcc44'], 8, { speed: 90, life: 0.4, glow: true });
            break;
          }
        }
      },
    },
    { key: 'boiling', name: 'THE BOILING RIVER', color: '#ff2a4a',
      desc: 'Phlegethon runs hot, and everything in it hits like it.',
      // Violence: monsters hurt. Straightforwardly the most dangerous circle.
      monDmgMul: 1.30,
    },
    { key: 'malebolge', name: 'THE MALEBOLGE', color: '#6effc0',
      desc: 'Nothing here is what it looks like.',
      // Fraud: the chests lie, constantly.
      mimicAdd: 0.5,
    },
    { key: 'ice', name: 'THE ICE', color: '#7fd4ff',
      desc: 'Cocytus. The bottom. You do not walk here - you slide.',
      // Treachery: momentum. moveMul 0 hands ALL movement to this hook, so the
      // player accelerates into a heading and keeps going when they let go. This is
      // why the hook runs before wall/obstacle resolution: you can slide into a wall
      // and be stopped by it, which is exactly right.
      moveMul: 0,
      player(p, dt, g) {
        if (!p._slide) p._slide = { x: 0, y: 0 };
        const SPEED = 205 * 1.06;               // a shade quicker than a walk, once you get going
        const tx = p.moving ? Math.cos(p.moveAngle) * SPEED : 0;
        const ty = p.moving ? Math.sin(p.moveAngle) * SPEED : 0;
        // low easing = you cannot change direction sharply, and you cannot stop dead
        const k = Math.min(1, dt * (p.moving ? 2.6 : 1.5));
        p._slide.x += (tx - p._slide.x) * k;
        p._slide.y += (ty - p._slide.y) * k;
        p.x += p._slide.x * dt;
        p.y += p._slide.y * dt;
      },
    },
  ];

  // ---------------------------------------------------------------------------
  // THE SEVEN TERRACE RULES (Mount Purgatory - ascent.js).
  //
  // Hell's rules are TORMENTS: they are done to you, and they are cruel. Purgatory's
  // are PENANCES: they are burdens you carry up the mountain, and every one of them
  // is the sin itself turned into the cure. The proud carry the weight they would
  // not bow under. The slothful are never allowed to stand still. The greedy find
  // that gold has stopped meaning anything.
  //
  // Same shape as a circle rule, so the mutators stack on top of these for free.
  // In Descent.CIRCLES order? No - in ascent.js TERRACES order (Pride first).
  // ---------------------------------------------------------------------------
  const TERRACE_RULES = [
    { key: 'weight', name: 'THE WEIGHT', color: '#d8c39a',
      desc: 'The proud go bent double under a stone. You cannot dodge what you cannot bend from.',
      // PRIDE: no dodge roll at all. The single most-used button in the game, taken
      // away - you have to actually walk out of trouble.
      noRoll: true, moveMul: 0.9 },

    { key: 'sewneyes', name: 'THE SEWN EYES', color: '#8fb8b0',
      desc: 'The envious have their eyes stitched shut with wire. You see only what is near.',
      // ENVY: the room goes dark beyond a small radius around you. Read by the
      // renderer (main.js), not by a hook - it is a draw-time effect.
      vision: 150 },

    { key: 'smoke', name: 'THE SMOKE', color: '#b9b3a6',
      desc: 'A bank of bitter smoke, black as pitch. Nothing is visible until it is close.',
      // WRATH: monsters fade out at range. They are still there, still coming.
      fade: 230 },

    { key: 'nevrest', name: 'NEVER REST', color: '#9ad0a4',
      desc: 'The slothful run without ceasing. Stand still and it will find you.',
      // SLOTH: standing still hurts, after a short grace. You fight on the move.
      player(p, dt, g) {
        if (p.moving || p.rollT >= 0) { p._stillT = 0; return; }
        p._stillT = (p._stillT || 0) + dt;
        if (p._stillT > 1.6) {
          p._stillT = 1.6 - 0.55;              // tick roughly every half second stood still
          p.damage(4, p.x, p.y - 1, g);
          if (typeof Fx !== 'undefined') Fx.text(p.x, p.y - p.r - 16, 'MOVE!', '#9ad0a4', 13);
        }
      } },

    { key: 'binding', name: 'THE BINDING', color: '#e0cc84',
      desc: 'They lie bound, face-down, who once looked only at the ground. Gold is worth nothing here.',
      // AVARICE: no gold at all on this terrace. In exchange, the climb itself
      // teaches you faster - the penance pays in experience, not coin.
      coinMul: 0, xpMul: 1.6 },

    { key: 'fast', name: 'THE FAST', color: '#c3dd8a',
      desc: 'The gluttonous starve beneath a tree they cannot reach. Nothing here will feed you.',
      // GLUTTONY: no hearts, and your regeneration stops. What health you have is
      // what you finish the floor with.
      noHearts: true, noRegen: true },

    { key: 'refining', name: 'THE REFINING FIRE', color: '#ffb27a',
      desc: 'The last terrace is a wall of flame, and the only way on is through it.',
      // LUST: the edges of the room burn. You are driven into the open middle, where
      // there is no cover and nowhere to kite. The final penance before the summit.
      player(p, dt, g) {
        const PF = Dungeon.PF;
        const M = 74; // the burning margin, in from the play-field edge
        const near = p.x < PF.x + M || p.x > PF.x + PF.w - M
                  || p.y < PF.y + M || p.y > PF.y + PF.h - M;
        p._fireCd = Math.max(0, (p._fireCd || 0) - dt);
        if (!near) return;
        if (p._fireCd > 0) return;
        p._fireCd = 0.7;
        p.damage(5, p.x, p.y, g);
        if (typeof Fx !== 'undefined') Fx.burst(p.x, p.y, ['#ffb27a', '#ff7a3c', '#ffd24c'], 10, { speed: 100, life: 0.4, glow: true });
      } },
  ];

  // ---------------------------------------------------------------------------
  // LAYER 2 - THE MUTATORS.
  //
  // Nine circles is still only nine floors of content; after that it loops. What
  // makes floor 25 different from floor 25 last run is not more hand-authored
  // circles, it is COMBINATION. One mutator is rolled per floor from depth 6, a
  // second from depth 15, a third from depth 24 - so the deeper you go the weirder
  // the floor gets, and the pairings are never the same twice.
  //
  // Same rule shape as a circle rule, so they stack on top of it for free: the
  // Gale plus Blackout is a dark floor that also shoves you, and neither had to
  // know about the other.
  // ---------------------------------------------------------------------------
  const MUTATORS = [
    { key: 'bloodmoon', name: 'BLOOD MOON', color: '#ff4444',
      desc: 'The dead pay well. They do not, however, leave hearts.',
      coinMul: 2, noHearts: true },
    { key: 'swarm', name: 'THE SWARM', color: '#9aae4a',
      desc: 'Twice as many. Half as sturdy.',
      countMul: 2, monHpMul: 0.5 },
    { key: 'famine', name: 'FAMINE', color: '#8f97a3',
      desc: 'Nothing here bleeds gold.',
      coinMul: 0.35, monHpMul: 0.85 },
    { key: 'brittle', name: 'BRITTLE', color: '#7fd4ff',
      desc: 'Glass, both ways. Everything dies fast - including you.',
      monHpMul: 0.55, monDmgMul: 1.6 },
    { key: 'juggernaut', name: 'JUGGERNAUT', color: '#ff8a3d',
      desc: 'Fewer of them. Each one is a wall.',
      countMul: 0.55, monHpMul: 2.4, coinMul: 1.5 },
    { key: 'haste', name: 'FRENZY', color: '#c060ff',
      desc: 'Everything here is faster than it should be.',
      spawn(m) { m.speed *= 1.4; } },
    { key: 'elite', name: 'THE COURT', color: '#ffd24c',
      desc: 'The nobility have come down to meet you.',
      eliteAdd: 0.45, coinMul: 1.4 },
    { key: 'thin', name: 'THIN AIR', color: '#6effc0',
      desc: 'You are quick here, and so is everything else.',
      moveMul: 1.28, spawn(m) { m.speed *= 1.18; } },
    { key: 'vampiric', name: 'VAMPIRIC', color: '#ff2a4a',
      desc: 'They mend themselves. Kill them faster.',
      spawn(m) { m._vamp = true; },
      // slow regeneration on every monster: a damage race, not a war of attrition
      monster(m, dt) { if (m._vamp && m.hp > 0 && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.02 * dt); } },
    { key: 'greedy', name: 'TITHE', color: '#d4af37',
      desc: 'The chests are hungry. So is everything else.',
      mimicAdd: 0.4, coinMul: 1.6 },
  ];

  // how many mutators a floor carries. Depth is floors below the King.
  function mutatorCount(floorNum) {
    const d = floorNum - (typeof Descent !== 'undefined' ? Descent.FIRST_FLOOR : 4);
    if (d < 2) return 0;    // the first two circles are clean - learn the place first
    if (d < 11) return 1;
    if (d < 20) return 2;
    return 3;
  }

  // ---------------------------------------------------------------------------
  // deterministic per-floor RNG: floor number + run seed, never Math.random, so
  // host and guest roll the identical rules.
  // ---------------------------------------------------------------------------
  function hash32(a) {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // pick n DISTINCT mutators for a floor, deterministically from (seed, floor)
  function rollMutators(floorNum, seed, n) {
    if (n <= 0) return [];
    // a shuffled view of the pool, ordered by a per-floor hash - stable for a given
    // (seed, floor), so every peer picks the same ones and a resumed run is identical
    const ranked = MUTATORS
      .map((m, i) => ({ m, k: hash32((seed || 0) * 31 + floorNum * 7919 + i * 104729) }))
      .sort((a, b) => a.k - b.k);
    return ranked.slice(0, Math.min(n, ranked.length)).map(x => x.m);
  }

  // The rules in force on a floor: the circle's signature rule, plus the mutators.
  // Returns a merged view so callers never walk the list themselves.
  function forFloor(floorNum, seed) {
    const active = [];
    let circle = null, mutators = [];
    const ascending = typeof Ascent !== 'undefined' && Ascent.isAscent(floorNum);
    if (ascending) {
      // MOUNT PURGATORY. The shore (floor 13) carries no rule at all: you have just
      // come up out of the bottom of Hell, and the game lets you breathe once.
      if (!Ascent.onShore(floorNum)) {
        circle = TERRACE_RULES[Ascent.terraceIndex(floorNum)];
        active.push(circle);
      }
      mutators = rollMutators(floorNum, seed, mutatorCount(floorNum));
      active.push(...mutators);
    } else if (typeof Descent !== 'undefined' && Descent.isDescent(floorNum)) {
      circle = CIRCLE_RULES[(floorNum - Descent.FIRST_FLOOR) % CIRCLE_RULES.length];
      active.push(circle);
      mutators = rollMutators(floorNum, seed, mutatorCount(floorNum));
      active.push(...mutators);
    }
    const r = {
      list: active, circle, mutators, ascending,
      // the gale needs a stable direction for the whole floor
      windAngle: hash32((seed || 0) + floorNum * 977) * Math.PI * 2,
      moveMul:   active.reduce((a, x) => a * (x.moveMul   ?? 1), 1),
      coinMul:   active.reduce((a, x) => a * (x.coinMul   ?? 1), 1),
      monDmgMul: active.reduce((a, x) => a * (x.monDmgMul ?? 1), 1),
      monHpMul:  active.reduce((a, x) => a * (x.monHpMul  ?? 1), 1),
      countMul:  active.reduce((a, x) => a * (x.countMul  ?? 1), 1),
      xpMul:     active.reduce((a, x) => a * (x.xpMul     ?? 1), 1),
      eliteAdd:  active.reduce((a, x) => a + (x.eliteAdd  ?? 0), 0),
      mimicAdd:  active.reduce((a, x) => a + (x.mimicAdd  ?? 0), 0),
      noHearts:  active.some(x => x.noHearts),
      noRegen:   active.some(x => x.noRegen),   // the Fast (Gluttony)
      noRoll:    active.some(x => x.noRoll),    // the Weight (Pride)
      // draw-time effects, read by the renderer rather than by a hook
      vision:    active.reduce((a, x) => Math.min(a, x.vision ?? Infinity), Infinity), // the Sewn Eyes
      fade:      active.reduce((a, x) => Math.min(a, x.fade   ?? Infinity), Infinity), // the Smoke
      // a rule sets moveMul 0 when it means to drive movement itself (the ice)
      ownsMovement: active.some(x => x.moveMul === 0),
    };
    r.player  = (p, dt, g) => { for (const x of active) if (x.player)  x.player(p, dt, g); };
    r.spawn   = (m, g)     => { for (const x of active) if (x.spawn)   x.spawn(m, g); };
    r.monster = (m, dt, g) => { for (const x of active) if (x.monster) x.monster(m, dt, g); };
    return r;
  }

  // an empty rule set, for floors 1-3 and for any code path that runs before a
  // floor exists. Same shape, so callers never null-check.
  function none() {
    return {
      list: [], circle: null, mutators: [], ascending: false,
      windAngle: 0, moveMul: 1, coinMul: 1, monDmgMul: 1, monHpMul: 1, countMul: 1,
      xpMul: 1, eliteAdd: 0, mimicAdd: 0,
      noHearts: false, noRegen: false, noRoll: false,
      vision: Infinity, fade: Infinity, ownsMovement: false,
      player() { }, spawn() { }, monster() { },
    };
  }

  return { forFloor, none, rollMutators, mutatorCount, CIRCLE_RULES, TERRACE_RULES, MUTATORS };
})();
