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
  // deterministic per-floor RNG: floor number + run seed, never Math.random, so
  // host and guest roll the identical rules.
  // ---------------------------------------------------------------------------
  function hash32(a) {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // The rules in force on a floor: the circle's signature rule, plus (layer 2)
  // any mutators. Returns a merged view so callers never walk the list themselves.
  function forFloor(floorNum, seed) {
    const active = [];
    if (typeof Descent !== 'undefined' && Descent.isDescent(floorNum)) {
      const idx = (floorNum - Descent.FIRST_FLOOR) % CIRCLE_RULES.length;
      active.push(CIRCLE_RULES[idx]);
    }
    const r = {
      list: active,
      // the gale needs a stable direction for the whole floor
      windAngle: hash32((seed || 0) + floorNum * 977) * Math.PI * 2,
      moveMul:   active.reduce((a, x) => a * (x.moveMul   ?? 1), 1),
      coinMul:   active.reduce((a, x) => a * (x.coinMul   ?? 1), 1),
      monDmgMul: active.reduce((a, x) => a * (x.monDmgMul ?? 1), 1),
      monHpMul:  active.reduce((a, x) => a * (x.monHpMul  ?? 1), 1),
      eliteAdd:  active.reduce((a, x) => a + (x.eliteAdd  ?? 0), 0),
      mimicAdd:  active.reduce((a, x) => a + (x.mimicAdd  ?? 0), 0),
      // a rule sets moveMul 0 when it means to drive movement itself (the ice)
      ownsMovement: active.some(x => x.moveMul === 0),
    };
    r.player = (p, dt, g) => { for (const x of active) if (x.player) x.player(p, dt, g); };
    r.spawn  = (m, g)     => { for (const x of active) if (x.spawn)  x.spawn(m, g); };
    return r;
  }

  // an empty rule set, for floors 1-3 and for any code path that runs before a
  // floor exists. Same shape, so callers never null-check.
  function none() {
    return {
      list: [], windAngle: 0, moveMul: 1, coinMul: 1, monDmgMul: 1, monHpMul: 1,
      eliteAdd: 0, mimicAdd: 0, ownsMovement: false,
      player() { }, spawn() { },
    };
  }

  return { forFloor, none, CIRCLE_RULES };
})();
