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
        if (p.fireImmuneT > 0) return; // #229 pyromancer R8: fireproof while Immolate burns
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
        const s = p._slide || (p._slide = { x: 0, y: 0, hold: 0, dir: 0 });
        // #143 (Sam) MOMENTUM BUILD: hold the SAME heading and you keep gathering speed
        // like a real slide. A turn (heading swings past ~35deg) resets the build, so
        // you commit to a line. Base is a shade quicker than a walk; full build ~1.8x.
        const BASE = 205 * 1.06, MAX = BASE * 1.85;
        if (p.moving) {
          const turn = Math.abs(((p.moveAngle - s.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          s.hold = turn < 0.6 ? s.hold + dt : 0;
          s.dir = p.moveAngle;
        } else s.hold = 0;
        const ramp = Math.min(1, s.hold / 2.2);  // ~2.2s of committed input to top out
        const SPEED = p.moving ? BASE + (MAX - BASE) * ramp : 0;
        const tx = p.moving ? Math.cos(p.moveAngle) * SPEED : 0;
        const ty = p.moving ? Math.sin(p.moveAngle) * SPEED : 0;
        // low easing = you cannot change direction sharply, and you cannot stop dead
        const k = Math.min(1, dt * (p.moving ? 2.6 : 1.5));
        s.x += (tx - s.x) * k;
        s.y += (ty - s.y) * k;
        p.x += s.x * dt;
        p.y += s.y * dt;
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
          // #141 (Sam) a PERCENT of max HP, not a flat 4 - a flat 4 was nothing once you
          // had thousands of HP deep in the run. 4% per tick (~8%/s stood still) is a real
          // reason to keep moving at any depth, and never an instant death.
          p.damage(Math.max(4, p.maxHp * 0.04), p.x, p.y - 1, g);
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
        if (p.fireImmuneT > 0) return; // #229 pyromancer R8: the burning margin spares you
        if (p._fireCd > 0) return;
        p._fireCd = 0.7;
        p.damage(5, p.x, p.y, g);
        if (typeof Fx !== 'undefined') Fx.burst(p.x, p.y, ['#ffb27a', '#ff7a3c', '#ffd24c'], 10, { speed: 100, life: 0.4, glow: true });
      } },
  ];

  // ---------------------------------------------------------------------------
  // THE NINE SPHERE RULES (Paradiso - paradiso.js).
  //
  // Hell's rules are TORMENTS, done to you and cruel. Purgatory's are PENANCES,
  // burdens you carry up the mountain. Heaven's are BLESSINGS THAT COST SOMETHING:
  // every one gives you a real gift and takes a real price. That is what the spheres
  // do to Dante - each one lifts him and each one asks him a question he cannot dodge.
  //
  // A blessing with no price would just be a free floor, and a free floor is a boring
  // floor. The gift is what makes you want to go up. The price is what makes it a game.
  // ---------------------------------------------------------------------------
  const SPHERE_RULES = [
    { key: 'inconstant', name: 'THE INCONSTANT', color: '#cfd8f0',
      desc: 'The Moon, and the souls who broke their vows. Your strength waxes and wanes, and will not hold still.',
      // MOON: damage swings on a slow tide. Sometimes you are enormous, sometimes you
      // are nothing, and you do not get to choose which.
      monster(m, dt, g) { /* the tide is read by the player, not the mob */ },
      player(p, dt, g) {
        const t = (g.time || 0) * 0.5;
        g.moonTide = 0.55 + 0.75 * (0.5 + 0.5 * Math.sin(t));  // 0.55x .. 1.30x
      } },

    { key: 'ambition', name: 'THE AMBITIOUS', color: '#a8d8e8',
      desc: 'Mercury, and those who did good for glory. Kill quickly and be paid. Dawdle and be forgotten.',
      // MERCURY: a kill streak that pays gold, and decays the moment you stop.
      coinMul: 1.5, monHpMul: 0.85 },

    { key: 'lovers', name: 'THE LOVERS', color: '#ffb0d8',
      desc: 'Venus. What you give away comes back to you.',
      // VENUS: you heal for a share of the damage you deal, but you are made of glass.
      lifesteal: 0.10, monDmgMul: 1.35 },

    { key: 'wise', name: 'THE WISE', color: '#ffe08a',
      desc: 'The Sun, and the light of the wise. Nothing is hidden from you here. Nor are you hidden from anything.',
      // SUN: no fog, no surprises - but the whole floor is awake and coming, and there
      // are more of them.
      countMul: 1.35, xpMul: 1.5, eliteAdd: 0.15 },

    { key: 'warriors', name: 'THE WARRIORS', color: '#ff9a8a',
      desc: 'Mars, where the fallen soldiers stand in a cross of light. Everything here hits harder. Including you.',
      // MARS: the pure crucible. Everyone hits like a truck, both ways.
      monDmgMul: 1.5, dmgMul: 1.5 },

    { key: 'just', name: 'THE JUST', color: '#a8c0ff',
      desc: 'Jupiter, and the just rulers. The scales are exact: what you deal, you are dealt.',
      // JUPITER: justice, literally. A share of the damage you deal comes back at you.
      // Enormous burst is punished; steady, careful play is not.
      justice: 0.12, coinMul: 1.4 },

    { key: 'contemplative', name: 'THE CONTEMPLATIVES', color: '#e8dcc0',
      desc: 'Saturn, and the golden ladder. Stand still and be mended. Nothing else will mend you.',
      // SATURN: the exact inversion of Sloth's terrace. Down there, standing still hurt
      // you. Up here it is the only thing that heals you - and nothing else does.
      noRegen: true, noHearts: true,
      player(p, dt, g) {
        if (p.moving || p.rollT >= 0) { p._stillHeal = 0; return; }
        p._stillHeal = (p._stillHeal || 0) + dt;
        if (p._stillHeal > 0.7 && p.hp < p.maxHp) {
          p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.05 * dt);   // 5% max hp per second stood still
        }
      } },

    { key: 'examined', name: 'THE EXAMINATION', color: '#dfe6ff',
      desc: 'The Fixed Stars, where Dante was examined on faith, hope and love. You will be examined on all three.',
      // FIXED STARS: elites everywhere, and they pay for themselves. The hardest normal
      // floor in the game, and the richest.
      eliteAdd: 0.55, coinMul: 1.8, xpMul: 1.4 },

    { key: 'primemover', name: 'THE FIRST MOTION', color: '#ffffff',
      desc: 'The Primum Mobile: the sphere that moves all the others. Everything here is faster. Everything.',
      // PRIMUM MOBILE: pure speed, both ways. The last sphere before the end.
      moveMul: 1.35,
      spawn(m) { m.speed *= 1.45; } },
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
    // #307 a SPATIAL mutator (a new axis - the others touch stats/loot, this touches the
    // floor itself): a steady drag toward the room's heart, so you can't hold a corner and
    // every fight collapses to the middle. Player-only (monsters ignore it), gentle enough to
    // still reach a door. The hook runs before wall resolution, so it never shoves you into one.
    { key: 'maelstrom', name: 'THE MAELSTROM', color: '#6a8fff',
      desc: 'The floor tilts toward its heart. You will not hold the edges.',
      player(p, dt, g) {
        const cx = 480, cy = 270;                 // PF centre (the 960x540 field is fixed)
        const dx = cx - p.x, dy = cy - p.y, d = Math.hypot(dx, dy);
        if (d > 26) { p.x += (dx / d) * 42 * dt; p.y += (dy / d) * 42 * dt; }
      } },
    // #312 BLACKOUT: brings the Sewn Eyes' limited vision to the mutator rotation, so any deep
    // floor can go dark (and it stacks - Gale + Blackout is a dark floor that also shoves you).
    // Reuses the existing r.vision render; a touch more generous than the circle since it stacks.
    { key: 'blackout', name: 'BLACKOUT', color: '#3a3f4a',
      desc: 'The dark presses in. You see only what is almost upon you.',
      vision: 200 },
    // #314 a RISK/REWARD floor - the only mutator that pays out in XP. Everything hits harder,
    // but every kill is worth far more, so a dangerous floor is also the fast way to level.
    { key: 'trial', name: 'TRIAL BY FIRE', color: '#ff8a3d',
      desc: 'Everything here hits harder - but every kill pays out in experience.',
      monDmgMul: 1.3, xpMul: 1.6 },
    // #335 (Sam) INFORMATION-SUBTRACTION curses (a new axis - these take away what you can
    // SEE, not change stats). Pure render flags read by the renderer (like vision), so they
    // are co-op-safe by construction and stack with anything.
    { key: 'blind', name: 'THE BLIND', color: '#b8a0d8',
      desc: 'You cannot tell what any loot is until you pick it up.',
      hidePickupLabels: 1 },
    { key: 'nomap', name: 'NO MAP', color: '#8f97a3',
      desc: 'The map is gone. Find your own way. (Not on phones.)',
      hideMinimap: 1 },
  ];

  // how many mutators a floor carries. Depth is floors below the King.
  function mutatorCount(floorNum) {
    // THE QUIET FLOORS carry nothing at all - no rule, and no mutator either. There
    // are exactly three in the whole run and each one is a beat the game has earned:
    // the SHORE (you just came up through the bottom of Hell), the EARTHLY PARADISE
    // (the mountain is finished), and the EMPYREAN (the end of the book, where the
    // only thing in the room is the King). A mutator on any of them steps on the beat.
    if (typeof Ascent !== 'undefined' && (Ascent.onShore(floorNum) || Ascent.onSummit(floorNum))) return 0;
    if (typeof Paradiso !== 'undefined' && Paradiso.inEmpyrean(floorNum)) return 0;
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
    const inHeaven = typeof Paradiso !== 'undefined' && Paradiso.isParadiso(floorNum);
    const ascending = typeof Ascent !== 'undefined' && Ascent.isAscent(floorNum);
    if (inHeaven) {
      // THE HEAVENS. The Empyrean carries no rule: it is the end of the book and the
      // last castle, and the only thing on it is the King.
      if (!Paradiso.inEmpyrean(floorNum)) {
        circle = SPHERE_RULES[Paradiso.sphereIndex(floorNum)];
        active.push(circle);
      }
      mutators = rollMutators(floorNum, seed, mutatorCount(floorNum));
      active.push(...mutators);
    } else if (ascending) {
      // MOUNT PURGATORY. The two floors that BRACKET the mountain - the Shore (13) and
      // the Earthly Paradise at the summit (21) - carry no rule at all. They are the
      // arrival and the departure, and they are the only places on the whole climb
      // where the game lets you stand still and look at it.
      if (!Ascent.onShore(floorNum) && !Ascent.onSummit(floorNum)) {
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
    };
    remerge(r);
    return r;
  }

  // Recompute every merged field from r.list. Split out of forFloor because a rule
  // can be added to a floor you are ALREADY STANDING ON: the Pact (encounters.js)
  // lets a stranger drop one more mutator on you mid-floor, and the multipliers have
  // to start biting the moment you shake hands. One merge function, so a rule added
  // at floor-gen and a rule added by a handshake behave identically.
  function remerge(r) {
    const active = r.list;
    r.moveMul   = active.reduce((a, x) => a * (x.moveMul   ?? 1), 1);
    r.coinMul   = active.reduce((a, x) => a * (x.coinMul   ?? 1), 1);
    r.monDmgMul = active.reduce((a, x) => a * (x.monDmgMul ?? 1), 1);
    r.monHpMul  = active.reduce((a, x) => a * (x.monHpMul  ?? 1), 1);
    r.countMul  = active.reduce((a, x) => a * (x.countMul  ?? 1), 1);
    r.xpMul     = active.reduce((a, x) => a * (x.xpMul     ?? 1), 1);
    // PARADISO: the blessings, and their prices
    r.dmgMul    = active.reduce((a, x) => a * (x.dmgMul    ?? 1), 1);  // Mars: you hit harder too
    r.lifesteal = active.reduce((a, x) => a + (x.lifesteal ?? 0), 0);  // Venus: what you give comes back
    r.justice   = active.reduce((a, x) => a + (x.justice   ?? 0), 0);  // Jupiter: what you deal, you are dealt
    r.eliteAdd  = active.reduce((a, x) => a + (x.eliteAdd  ?? 0), 0);
    r.mimicAdd  = active.reduce((a, x) => a + (x.mimicAdd  ?? 0), 0);
    r.noHearts  = active.some(x => x.noHearts);
    r.noRegen   = active.some(x => x.noRegen);   // the Fast (Gluttony)
    r.noRoll    = active.some(x => x.noRoll);    // the Weight (Pride)
    // draw-time effects, read by the renderer rather than by a hook
    r.vision    = active.reduce((a, x) => Math.min(a, x.vision ?? Infinity), Infinity); // the Sewn Eyes
    r.fade      = active.reduce((a, x) => Math.min(a, x.fade   ?? Infinity), Infinity); // the Smoke
    r.hidePickupLabels = active.some(x => x.hidePickupLabels); // #335 THE BLIND
    r.hideMinimap      = active.some(x => x.hideMinimap);      // #335 NO MAP (renderer gates it off on touch)
    // a rule sets moveMul 0 when it means to drive movement itself (the ice)
    r.ownsMovement = active.some(x => x.moveMul === 0);
    r.player  = (p, dt, g) => { for (const x of r.list) if (x.player)  x.player(p, dt, g); };
    r.spawn   = (m, g)     => { for (const x of r.list) if (x.spawn)   x.spawn(m, g); };
    r.monster = (m, dt, g) => { for (const x of r.list) if (x.monster) x.monster(m, dt, g); };
    return r;
  }

  // an empty rule set, for floors 1-3 and for any code path that runs before a
  // floor exists. Same shape, so callers never null-check.
  function none() {
    return remerge({ list: [], circle: null, mutators: [], ascending: false, windAngle: 0 });
  }

  // the Moon's tide (set by its player hook each frame; 1 = neutral)
  const tide = g => (g && g.rules && g.rules.list.some(r => r.key === 'inconstant')) ? (g.moonTide || 1) : 1;

  return { forFloor, none, remerge, tide, rollMutators, mutatorCount,
           CIRCLE_RULES, TERRACE_RULES, SPHERE_RULES, MUTATORS };
})();
