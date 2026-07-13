// ============================================================================
// monsters.js - the 8-type roster + mimics + summoned adds.
// SPAWN TABLES AND BASE STATS at the top for retuning.
// Every attack is telegraphed (windup flash / draw animation) so it can be
// dodged on reaction - this is a core design rule from the design doc.
// ============================================================================
const Monsters = (() => {
  const PF = Dungeon.PF;

  // --- BASE STATS -------------------------------------------------------------
  // hp/dmg scale with tier: hp * (1 + 0.30*(tier-1)), dmg * (1 + 0.15*(tier-1))
  const BASE = {
    chaser:   { hp: 26, dmg: 10, speed: 95,  r: 14, xp: 4,  coins: [1, 3] },
    archer:   { hp: 20, dmg: 9,  speed: 80,  r: 12, xp: 6,  coins: [1, 3] },
    tank:     { hp: 90, dmg: 18, speed: 42,  r: 22, xp: 12, coins: [3, 6] },
    swarmer:  { hp: 10, dmg: 6,  speed: 150, r: 9,  xp: 2,  coins: [0, 2] },
    glass:    { hp: 14, dmg: 24, speed: 70,  r: 12, xp: 6,  coins: [2, 4] },
    shielded: { hp: 55, dmg: 12, speed: 60,  r: 16, xp: 10, coins: [2, 5] },
    bomber:   { hp: 22, dmg: 20, speed: 120, r: 13, xp: 6,  coins: [2, 4] },
    summoner: { hp: 40, dmg: 0,  speed: 55,  r: 14, xp: 12, coins: [3, 6] },
    add:      { hp: 6,  dmg: 5,  speed: 140, r: 8,  xp: 1,  coins: [0, 1] },
    mimic:    { hp: 70, dmg: 14, speed: 105, r: 17, xp: 25, coins: [8, 14] },
    mimicbaby:{ hp: 18, dmg: 8,  speed: 115, r: 11, xp: 3,  coins: [1, 3] },
    // loot goblin: never attacks, flees for a door, spills gold when hit and drops a
    // fat purse if you catch it. Escapes (and takes the loot) if it reaches a door.
    goblin:   { hp: 46, dmg: 0,  speed: 188, r: 13, xp: 8,  coins: [18, 30] },
    // #27 heat-seeker: slow drifter that lobs a homing orb you must juke
    seeker:   { hp: 30, dmg: 12, speed: 58,  r: 13, xp: 9,  coins: [2, 5] },
    // #27 minelayer: kites and litters the floor with proximity mines
    miner:    { hp: 44, dmg: 15, speed: 74,  r: 14, xp: 10, coins: [2, 5] },
    // #27 pulser: slow bruiser that erupts rings of bullets like the Mimic King
    pulser:   { hp: 58, dmg: 10, speed: 44,  r: 15, xp: 13, coins: [3, 6] },
    // #56 worm: only the HEAD is damageable; its body segments are invulnerable
    // shields, and it splits into scattering wormlings when the head dies
    worm:     { hp: 64, dmg: 11, speed: 112, r: 12, xp: 11, coins: [2, 5] },
    // a body segment set loose when a worm's head dies - small, fast, scatters
    wormling: { hp: 7,  dmg: 6,  speed: 165, r: 8,  xp: 1,  coins: [0, 1] },
    // #66 lobber: ranged artillery that kites and LOBS arcing bombs over walls/obstacles,
    // landing where you stand (telegraphed) - punishes standing still behind cover
    lobber:   { hp: 48, dmg: 16, speed: 64,  r: 14, xp: 11, coins: [3, 6] },
    // #114 gunner: mid-range machine-gunner. Kites, revs up (telegraphed), then unloads
    // a rapid BURST of weak tracers before a long reload. Each round is soft; the STREAM
    // is the threat, so you break line-of-sight / roll through the gap between bursts.
    gunner:   { hp: 34, dmg: 6,  speed: 76,  r: 13, xp: 10, coins: [2, 5] },
  };

  // --- SPAWN TABLE by tier (tier = floor + roomDist/3, see tierFor) ------------
  const SPAWN_TABLE = {
    1: ['chaser', 'chaser', 'chaser', 'swarmer', 'shielded', 'tank'], // #112 shielders + #103 tanks (the gray hexagons) on floor 1
    2: ['chaser', 'swarmer', 'archer', 'bomber', 'worm', 'shielded'],
    3: ['chaser', 'archer', 'bomber', 'glass', 'tank', 'swarmer', 'seeker', 'miner', 'worm', 'lobber', 'gunner'],
    4: ['archer', 'tank', 'glass', 'shielded', 'summoner', 'bomber', 'seeker', 'miner', 'pulser', 'worm', 'lobber', 'gunner'],
    5: ['tank', 'glass', 'shielded', 'summoner', 'archer', 'bomber', 'seeker', 'miner', 'pulser', 'worm', 'lobber', 'gunner'],
  };
  // playtest: rooms were too sparse for how strong players get. Far more bodies on
  // deeper tiers (was cap 8, ~2+t): tier 1 ~4-6, tier 3 ~7-9, tier 5 ~11-13.
  const COUNT = t => Math.min(14, 2 + Math.round(t * 1.8) + ((Math.random() * 3) | 0)); // monsters per combat room

  function tierFor(floor, dist) { return Math.max(1, Math.min(5, floor + Math.floor(dist / 3))); }

  // #110 EMPOWERED MOVES: every combat type occasionally does a bigger, telegraphed
  // version of its attack (or a one-off buff). The cooldown ticks in update(); when it
  // fires, ranged/melee types just flag m.emp = true so their NEXT wind-up becomes the
  // empowered one (reusing the existing telegraph), while a few passive types act now.
  const EMPOWER_TYPES = new Set(['chaser', 'archer', 'tank', 'swarmer', 'glass', 'bomber',
    'summoner', 'seeker', 'miner', 'pulser', 'worm', 'lobber', 'gunner']);
  function triggerEmpower(m, g) {
    if (m.type === 'worm') {
      // #110 (Sam) worm gets a temporary SLITHER SPEED burst
      m.empSpeedT = 2.6; m.emp = false;
      Fx.text(m.x, m.y - m.r - 10, 'FRENZY!', '#8fd0a0', 12);
      Fx.burst(m.x, m.y, ['#8fd0a0', '#cfe8b0'], 12, { speed: 130, life: 0.4, glow: true });
      return;
    }
    if (m.type === 'swarmer') {
      // #110 (Sam) swarmers REPLICATE (split a copy) if the room isn't already flooded
      const n = g.monsters.filter(x => (x.type === 'swarmer' || x.type === 'add') && !x.dead).length;
      if (n < 22) {
        const a = Math.random() * Math.PI * 2;
        const baby = make('swarmer', m.x + Math.cos(a) * 18, m.y + Math.sin(a) * 18, m.tier);
        baby.empowerCd = 8 + Math.random() * 6; // its own clock, staggered
        g.monsters.push(baby);
        Fx.text(m.x, m.y - m.r - 8, 'SPLIT!', '#c9b3ff', 11);
        Fx.burst(m.x, m.y, ['#c9b3ff', '#fff'], 10, { speed: 120, life: 0.35, glow: true });
      }
      return;
    }
    // everyone else: flag the next attack as empowered + a gold "big one coming" cue
    m.emp = true;
    m.empAura = 0.9; // brief gold aura pulse timer, faded in update
    Fx.text(m.x, m.y - m.r - 10, 'EMPOWERED', '#ffd24c', 11);
  }

  // ============================================================================
  // mods (Descent): { hpMul, dmgMul, speedMul, elite } - endless-floor scaling and
  // an optional elite affix. null on the base 3 floors, so those are untouched.
  function make(type, x, y, tier = 1, mods = null) {
    const b = BASE[type];
    // #28 + playtest tune: players out-scale mobs badly by floor 2-3, so deeper
    // tiers are now MUCH tankier (+100%/tier HP, was +34%): tier 3 = 3x, tier 5 = 5x.
    // Floor 1 (tier 1) is unchanged since (tier-1)=0. Damage ramp left at +24%/tier -
    // the problem was mobs dying too fast, not hitting too soft.
    const hpMul = 1 + 1.0 * (tier - 1), dmgMul = 1 + 0.24 * (tier - 1);
    const m = {
      type, x, y, r: b.r,
      hp: Math.round(b.hp * hpMul), maxHp: Math.round(b.hp * hpMul),
      dmg: Math.round(b.dmg * dmgMul), speed: b.speed,
      xp: b.xp, coins: b.coins, tier,
      facing: 0, state: 'idle', t: Math.random() * 0.8, telegraph: 0,
      contactCd: 0, burn: null, stagger: 0, flash: 0,
      kvx: 0, kvy: 0, dead: false, spawnT: 0.35, // brief spawn-in so rooms don't insta-hit
      shieldUp: type === 'shielded',
      fuse: -1,
      // #110 every combat type gets an occasional EMPOWERED move (telegraphed): first
      // one after 6-11s, then every ~10-16s. undefined for trash that shouldn't.
      empowerCd: EMPOWER_TYPES.has(type) ? 6 + Math.random() * 5 : undefined,
      emp: false, empSpeedT: 0,
      update(dt, g) { update(this, dt, g); },
      draw(c, g) { draw(this, c, g); },
      takeHit(dmg, opts, g) { takeHit(this, dmg, opts, g); },
    };
    // --- Descent scaling + elite affix ------------------------------------------
    if (mods) {
      if (mods.hpMul)    { m.hp = Math.max(1, Math.round(m.hp * mods.hpMul)); m.maxHp = m.hp; }
      if (mods.dmgMul)   m.dmg = Math.round(m.dmg * mods.dmgMul);
      if (mods.speedMul) m.speed = m.speed * mods.speedMul;
      if (mods.elite) {
        const af = mods.elite;
        m.elite = af;
        m.r = Math.round(m.r * (af.rMul || 1));
        m.hp = Math.max(1, Math.round(m.hp * af.hpMul)); m.maxHp = m.hp;
        m.dmg = Math.round(m.dmg * af.dmgMul);
        m.speed = m.speed * af.speedMul;
        m.xp = Math.round(m.xp * 2.2);
        m.coins = [m.coins[0] + 2, m.coins[1] + 4]; // new array: never mutates BASE
      }
    }
    return m;
  }

  // --- shared movement helpers -------------------------------------------------
  function moveToward(m, tx, ty, dt, sp) {
    if (m.chillT > 0) sp *= (m.chillMul || 1);   // Frost slow
    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 1;
    m.x += (dx / d) * sp * dt;
    m.y += (dy / d) * sp * dt;
    m.facing = Math.atan2(dy, dx);
  }
  function clampToField(m) {
    m.x = Math.max(PF.x + m.r, Math.min(PF.x + PF.w - m.r, m.x));
    m.y = Math.max(PF.y + m.r, Math.min(PF.y + PF.h - m.r, m.y));
  }
  // the edge point of a door on a given side (the loot goblin's escape route)
  function doorPoint(dir) {
    if (dir === 'N') return { x: PF.x + PF.w / 2, y: PF.y };
    if (dir === 'S') return { x: PF.x + PF.w / 2, y: PF.y + PF.h };
    if (dir === 'W') return { x: PF.x, y: PF.y + PF.h / 2 };
    return { x: PF.x + PF.w, y: PF.y + PF.h / 2 }; // E
  }
  function distToPlayer(m, g) { return Math.hypot(g.player.x - m.x, g.player.y - m.y); }

  // PR-1: nearest party member to m (host: both players in-room; guest/solo: just you).
  // g.partyTargets() returns [{x,y,r,ref,isRemote,id}] and is always defined by main.js.
  function nearestTarget(m, g) {
    const ts = g.partyTargets ? g.partyTargets() : null;
    if (!ts || !ts.length) return g.player;
    let best = ts[0], bd = 1e9;
    for (const t of ts) { const d = Math.hypot(t.x - m.x, t.y - m.y); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  // #48 UNIT TACTICS: enemies that shoot from range are "line troops" the melee
  // units screen for. Bulwarks (shielded) body-block for them, swarmers picket
  // them, and chasers flank the player instead of charging straight in.
  const RANGED_ALLY = { archer: 1, glass: 1, seeker: 1, pulser: 1, miner: 1, summoner: 1, gunner: 1 };
  function nearestRangedAlly(m, g) {
    let best = null, bd = 1e9;
    for (const o of g.monsters) {
      if (o === m || o.dead || o.spawnT > 0 || !RANGED_ALLY[o.type]) continue;
      const d = Math.hypot(o.x - m.x, o.y - m.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  function tryContactHit(m, g, p, mult = 1) {
    if (m.contactCd > 0) return;
    if (Math.hypot(p.x - m.x, p.y - m.y) < m.r + p.r + 2) {
      g.hurtTarget(p, m.dmg * mult, m.x, m.y, m); // PR-2: local player OR a remote peer
      m.contactCd = 0.8;
    }
  }

  // --- per-type AI --------------------------------------------------------------
  function update(m, dt, g) {
    if (m.spawnT > 0) { m.spawnT -= dt; return; }
    m.t += dt;
    m.px = m.x; m.py = m.y; // #81 pre-move position, for anti-tunnel wall resolution
    if (m.contactCd > 0) m.contactCd -= dt;
    if (m.flash > 0) m.flash -= dt;

    // knockback decay
    m.x += m.kvx * dt; m.y += m.kvy * dt;
    m.kvx *= Math.pow(0.002, dt); m.kvy *= Math.pow(0.002, dt);

    // burn damage over time (from Flame / Fire Aspect)
    if (m.burn) {
      m.burn.t -= dt; m.burn.tick -= dt;
      if (m.burn.tick <= 0) {
        m.burn.tick = 0.5;
        applyDamage(m, m.burn.dps * 0.5, g, { silent: true, burn: true });
        Fx.burst(m.x, m.y - m.r, ['#ff9944', '#ffcc44'], 3, { speed: 40, life: 0.4, glow: true });
      }
      if (m.burn.t <= 0) m.burn = null;
    }
    // Frost chill timer (slow applied in moveToward)
    if (m.chillT > 0) m.chillT -= dt;
    // Venom poison damage over time (longer + stronger than burn, green)
    if (m.poison) {
      m.poison.t -= dt; m.poison.tick -= dt;
      if (m.poison.tick <= 0) {
        m.poison.tick = 0.5;
        applyDamage(m, m.poison.dps * 0.5, g, { silent: true, poison: true });
        Fx.burst(m.x, m.y - m.r, ['#6ee76e', '#3aa83a'], 3, { speed: 40, life: 0.4, glow: true });
      }
      if (m.poison.t <= 0) m.poison = null;
    }
    if (m.dead) return;

    // bomber fuse burns through stagger and death throes - the blink IS the telegraph
    if (m.type === 'bomber' && m.fuse >= 0) {
      m.fuse -= dt;
      if (m.fuse <= 0) { explode(m, g); return; }
    }

    // stagger (from heavy weapon) freezes behavior briefly
    if (m.stagger > 0) { m.stagger -= dt; clampToField(m); return; }

    // #78 FEAR (Barbarian War Shout): the monster panics and flees from the nearest
    // player, throwing no attacks, until the timer runs out. Bosses are immune.
    if (m.feared > 0) {
      m.feared -= dt;
      if (!m.isBoss) {
        const t = nearestTarget(m, g);
        const dx = m.x - t.x, dy = m.y - t.y, d = Math.hypot(dx, dy) || 1;
        const sp = (m.speed || 60) * 1.2;
        m.x += (dx / d) * sp * dt; m.y += (dy / d) * sp * dt;
        m.facing = Math.atan2(dy, dx);
        if (Math.random() < 0.04) Fx.text(m.x, m.y - m.r - 8, '!', '#c9b3ff', 12);
        clampToField(m);
        return;
      }
    }

    // #68/#94 FORMATION: a prepared UNIT. It doesn't sit still - it ADVANCES as one
    // rigid block (base-of-fire + maneuver): every mob's slot creeps forward along
    // the SAME shared axis so relative spacing is preserved, while ranged units lay
    // down SUPPRESSING FIRE immediately, even with the player out of their normal
    // range. The whole line breaks to individual AI together once it closes to
    // engagement range (or the brace timer runs out).
    if (m.holdT > 0) {
      m.holdT -= dt;
      const t = nearestTarget(m, g);
      const td = Math.hypot(t.x - m.x, t.y - m.y);
      if (td < 150) { m.holdT = 0; }
      else {
        // #115 SMARTER TACTICS - base of fire HOLDS its ground. A ranged trooper that
        // already has a good standoff AND a clear shot stops advancing and keeps
        // suppressing; only the melee/screen element keeps maneuvering forward. It used
        // to march the whole block (archers included) straight into your lap - now the
        // shooters sit at range where they're strong and let the wall close the gap.
        const walls = g.room && g.room.walls;
        const losClear = !walls || !walls.length || !Dungeon.segBlocked(m.x, m.y, t.x, t.y, walls);
        const holdGround = RANGED_ALLY[m.type] && td >= 240 && losClear;
        if (!holdGround && m.formationX != null) {
          // rigid group advance: translate the assigned slot along the shared front axis
          const adv = 30 * dt; // px/s the line pushes forward together
          m.formationX += (m.formFX || 0) * adv;
          m.formationY += (m.formFY || 0) * adv;
          m.x += (m.formationX - m.x) * Math.min(1, dt * 4);
          m.y += (m.formationY - m.y) * Math.min(1, dt * 4);
        }
        m.facing = Math.atan2(t.y - m.y, t.x - m.x);
        formationSuppress(m, t, g, dt); // #94 ranged fire on the advance, in or out of range
        clampToField(m);
        return;
      }
    }

    const p = nearestTarget(m, g), dist = Math.hypot(p.x - m.x, p.y - m.y); // PR-1: chase the closest player

    // #110 empowered-move cooldown: tick it down and, when ready, arm/trigger the move
    if (m.empowerCd !== undefined) {
      m.empowerCd -= dt;
      if (m.empowerCd <= 0) { m.empowerCd = 10 + Math.random() * 6; triggerEmpower(m, g); }
    }
    if (m.empSpeedT > 0) m.empSpeedT -= dt;
    if (m.empAura > 0) m.empAura -= dt;

    switch (m.type) {
      case 'chaser':
      case 'mimicbaby':
      case 'add': {
        // telegraphed lunge when close: pause + flash, then dash.
        // #48 cavalry: at range it swings wide to the player's flank (each rider
        // commits to a side) instead of charging head-on; commits straight once near.
        if (m.state === 'idle') {
          let tx = p.x, ty = p.y;
          if (dist > 120) {
            if (m.flankSide === undefined) m.flankSide = Math.random() < 0.5 ? 1 : -1;
            const bearing = Math.atan2(m.y - p.y, m.x - p.x) + m.flankSide * 0.9;
            tx = p.x + Math.cos(bearing) * 120; ty = p.y + Math.sin(bearing) * 120;
          }
          moveToward(m, tx, ty, dt, m.speed);
          if (dist < 95 && m.t > 0.4) { m.state = 'windup'; m.t = 0; m.lungeAngle = Math.atan2(p.y - m.y, p.x - m.x); }
          tryContactHit(m, g, p);
        } else if (m.state === 'windup') {
          // #110 EMPOWERED chaser: a longer-telegraphed BULL CHARGE - faster, travels far
          const w = m.emp ? 0.42 : 0.32;
          m.telegraph = w - m.t;
          if (m.t >= w) { m.state = 'lunge'; m.t = 0; Sfx.play('swing'); if (m.emp) Fx.burst(m.x, m.y, ['#ffd24c', '#fff'], 10, { speed: 120, life: 0.3 }); }
        } else if (m.state === 'lunge') {
          const boost = m.emp ? 1.5 : 1;
          m.x += Math.cos(m.lungeAngle) * m.speed * 3.4 * boost * dt;
          m.y += Math.sin(m.lungeAngle) * m.speed * 3.4 * boost * dt;
          tryContactHit(m, g, p, 1.2);
          if (m.t >= (m.emp ? 0.42 : 0.28)) { m.state = 'idle'; m.t = 0; m.emp = false; }
        }
        break;
      }
      case 'wormling': {
        // #80 a loosed body segment moves through three beats: SCATTER (flung outward,
        // harmless) -> SWARM (regroup and rush the player as a pack) -> ATTACK (jittery
        // chase that bites). Gives the player a readable window before the swarm lands.
        if (!m.wlPhase) { m.wlPhase = 'scatter'; m.wlT = 0; }
        m.wlT += dt;
        if (m.wlPhase === 'scatter') {
          const away = Math.atan2(m.y - p.y, m.x - p.x) + Math.sin(m.x) * 0.5;
          moveToward(m, m.x + Math.cos(away) * 60, m.y + Math.sin(away) * 60, dt, m.speed * 0.55);
          if (m.wlT > 0.7) { m.wlPhase = 'swarm'; m.wlT = 0; }
        } else if (m.wlPhase === 'swarm') {
          const jx = Math.sin(m.t * 11 + m.x) * 18;
          moveToward(m, p.x + jx, p.y, dt, m.speed * 1.15);
          if (m.wlT > 0.6) m.wlPhase = 'attack';
        } else {
          const jx = Math.sin(m.t * 11 + m.x) * 30;
          moveToward(m, p.x + jx, p.y + Math.cos(m.t * 8) * 24, dt, m.speed);
          tryContactHit(m, g, p);
        }
        break;
      }
      case 'swarmer': {
        // jittery fast chase, threatens through numbers.
        // #48 picket: while a ranged ally is alive and the player is at range, the
        // swarm orbits/screens that ally; it peels off to swarm once the player closes.
        const jx = Math.sin(m.t * 9 + m.x) * 40;
        const ward = nearestRangedAlly(m, g);
        if (ward && dist > 150) {
          const a = m.t * 2 + (m.x % 6);
          moveToward(m, ward.x + Math.cos(a) * 46, ward.y + Math.sin(a) * 46, dt, m.speed * 0.7);
        } else {
          moveToward(m, p.x + jx, p.y + Math.cos(m.t * 7) * 30, dt, m.speed);
        }
        tryContactHit(m, g, p);
        break;
      }
      case 'goblin': {
        // LOOT GOBLIN: never attacks. Sprints for whichever door is farthest from
        // the nearest player, bowing away when crowded. It bolts for good on a timer
        // (12%/sec after 3s in the room, per Sam) or the moment it reaches a door.
        m.roomT = (m.roomT || 0) + dt;
        m.escRollT = (m.escRollT || 0) + dt;
        m.bob = (m.bob || 0) + dt * 12;
        if (m.roomT > 3 && m.escRollT >= 1) { m.escRollT = 0; if (Math.random() < 0.12) { escapeGoblin(m); break; } }
        let goal = null, gd = -1;
        for (const dir in g.room.doors) { const dp = doorPoint(dir); const d = Math.hypot(dp.x - p.x, dp.y - p.y); if (d > gd) { gd = d; goal = dp; } }
        if (!goal) goal = { x: m.x - (p.x - m.x), y: m.y - (p.y - m.y) };
        let tx = goal.x, ty = goal.y;
        if (dist < 140) { tx += (m.x - p.x) * 0.9; ty += (m.y - p.y) * 0.9; } // juke away when close
        moveToward(m, tx, ty, dt, m.speed);
        clampToField(m);
        if (Math.hypot(m.x - goal.x, m.y - goal.y) < 26) escapeGoblin(m);
        break;
      }
      case 'archer': {
        // kite: keep 200-300px, back off if the player closes in
        if (dist < 170) moveToward(m, m.x * 2 - p.x, m.y * 2 - p.y, dt, m.speed);
        else if (dist > 310) moveToward(m, p.x, p.y, dt, m.speed * 0.8);
        else m.facing = Math.atan2(p.y - m.y, p.x - m.x);
        if (m.state === 'idle' && m.t > 2.1) { m.state = 'draw'; m.t = 0; }
        if (m.state === 'draw') {
          m.facing = Math.atan2(p.y - m.y, p.x - m.x); // tracks while drawing (dodge on release)
          m.telegraph = 0.6 - m.t;
          if (m.t >= 0.6) {
            m.state = 'idle'; m.t = 0;
            if (m.emp) { // #110 EMPOWERED: a flaming three-arrow volley
              for (let k = -1; k <= 1; k++) fireProjectile(g, m, m.facing + k * 0.2, 340, m.dmg, '#ff9a3d', 5, { glow: true });
              m.emp = false;
            } else fireProjectile(g, m, m.facing, 330, m.dmg, '#cfe8b0', 4);
            Sfx.play('bowfire');
          }
        }
        break;
      }
      case 'gunner': {
        // #114 machine-gunner: kite at mid range, rev up (telegraphed), then unload a
        // rapid tracer BURST with a bit of spread, then a long reload. Soft per-round.
        if (dist < 190) moveToward(m, m.x * 2 - p.x, m.y * 2 - p.y, dt, m.speed);
        else if (dist > 330) moveToward(m, p.x, p.y, dt, m.speed * 0.8);
        else m.facing = Math.atan2(p.y - m.y, p.x - m.x);
        if (m.state === 'idle') {
          if (m.t > 2.4 && dist < 420) { m.state = 'spin'; m.t = 0; } // reload done -> spin up
        } else if (m.state === 'spin') {
          m.facing = Math.atan2(p.y - m.y, p.x - m.x); // tracks while revving
          m.telegraph = 0.7 - m.t;                     // long readable spin-up (red ring)
          m.spin = (m.spin || 0) + dt * 22;            // barrel spin for the draw
          if (m.t >= 0.7) {
            m.state = 'burst'; m.t = 0; m.telegraph = 0;
            m.burstLeft = m.emp ? 12 : 7; m.burstShotT = 0; m.empBurst = m.emp; m.emp = false;
          }
        } else if (m.state === 'burst') {
          m.spin = (m.spin || 0) + dt * 34;
          m.facing = Math.atan2(p.y - m.y, p.x - m.x);
          m.burstShotT -= dt;
          if (m.burstShotT <= 0 && m.burstLeft > 0) {
            m.burstShotT = 0.085; // ~12 rounds/sec
            const spread = (Math.random() - 0.5) * (m.empBurst ? 0.34 : 0.2);
            fireProjectile(g, m, m.facing + spread, 400, m.dmg, m.empBurst ? '#ff7a2c' : '#ffd24c', 3, { glow: true });
            m.muzzle = 0.07;
            m.burstLeft--;
            Sfx.play('bowfire');
            if (m.burstLeft <= 0) { m.state = 'idle'; m.t = 0; } // into the reload
          }
        }
        if (m.muzzle > 0) m.muzzle -= dt;
        break;
      }
      case 'lobber': {
        // #66 artillery: kite to mid-range, then LOB an arcing bomb over any walls/
        // obstacles that lands where you're standing (telegraphed ~1s, so keep moving)
        const ideal = 230;
        if (dist < ideal - 40) moveToward(m, m.x * 2 - p.x, m.y * 2 - p.y, dt, m.speed);
        else if (dist > ideal + 70) moveToward(m, p.x, p.y, dt, m.speed * 0.8);
        m.facing = Math.atan2(p.y - m.y, p.x - m.x);
        if (m.state === 'draw') { m.telegraph = 0.5 - (m.t - m.lobStart); if (m.t - m.lobStart >= 0.5) m.state = 'idle'; }
        m.lobT = (m.lobT || 0) + dt;
        if (m.lobT > 2.6 && dist < 400 && m.state !== 'draw') {
          m.lobT = 0; m.state = 'draw'; m.lobStart = m.t;
          // #113 every OTHER bomb bursts into shrapnel on landing (parity toggles per bomb)
          const lob = (x, y, delay) => { m.lobParity = (m.lobParity || 0) + 1; g.ultFx.push({ type: 'lob', x, y, sx: m.x, sy: m.y, t: 0, delay, dmg: m.dmg, radius: 68, color: '#ff5a2c', shrapnel: m.lobParity % 2 === 0, shrapDmg: Math.round(m.dmg * 0.6) }); };
          if (m.emp) { // #110 EMPOWERED: a three-bomb BARRAGE straddling the player
            for (const off of [[0, 0], [-70, -30], [70, 40]]) lob(p.x + off[0], p.y + off[1], 1.05);
            m.emp = false;
          } else lob(p.x, p.y, 1.0);
          Sfx.play('bowfire');
        }
        break;
      }
      case 'tank': {
        if (m.state === 'idle') {
          moveToward(m, p.x, p.y, dt, m.speed);
          if (dist < 105 && m.t > 0.8) { m.state = 'windup'; m.t = 0; }
          tryContactHit(m, g, p, 0.6);
        } else if (m.state === 'windup') {
          m.telegraph = 0.75 - m.t; // long readable windup; heavy weapon stagger cancels it
          if (m.t >= 0.75) {
            m.state = 'slam'; m.t = 0;
            Fx.shake(7, 0.25); Sfx.play('heavy');
            Fx.burst(m.x, m.y, ['#8899aa', '#ffffff'], 16, { speed: 200, life: 0.4 });
            if (dist < 115 + p.r) g.hurtTarget(p, m.dmg, m.x, m.y, m); // p is a party-target wrapper (no .damage); route like tryContactHit
            if (m.emp) { // #110 EMPOWERED: the slam throws off a shockwave RING of shrapnel
              for (let i = 0; i < 12; i++) fireProjectile(g, m, i / 12 * Math.PI * 2, 190, Math.round(m.dmg * 0.7), '#c8d2e0', 5, { glow: true });
              Fx.shake(10, 0.35); m.emp = false;
            }
          }
        } else if (m.state === 'slam') {
          if (m.t > 0.5) { m.state = 'idle'; m.t = 0; }
        }
        break;
      }
      case 'glass': {
        // fragile artillery: bright silhouette, brutal bolt, dies to a sneeze
        if (dist < 200) moveToward(m, m.x * 2 - p.x, m.y * 2 - p.y, dt, m.speed);
        else m.facing = Math.atan2(p.y - m.y, p.x - m.x);
        if (m.state === 'idle' && m.t > 1.8) { m.state = 'charge'; m.t = 0; }
        if (m.state === 'charge') {
          m.facing = Math.atan2(p.y - m.y, p.x - m.x);
          m.telegraph = 0.55 - m.t;
          if (m.t >= 0.55) {
            m.state = 'idle'; m.t = 0;
            if (m.emp) { // #110 EMPOWERED: a three-bolt scatter
              for (let k = -1; k <= 1; k++) fireProjectile(g, m, m.facing + k * 0.16, 430, m.dmg, '#ff66dd', 6, { glow: true });
              m.emp = false;
            } else fireProjectile(g, m, m.facing, 420, m.dmg, '#ff66dd', 6, { glow: true });
            Sfx.play('crit');
          }
        }
        break;
      }
      case 'seeker': {
        // keeps mid-range and lobs a slow HOMING orb every ~2.4s - keep moving to shake it
        if (dist < 150) moveToward(m, m.x * 2 - p.x, m.y * 2 - p.y, dt, m.speed);
        else if (dist > 340) moveToward(m, p.x, p.y, dt, m.speed);
        else m.facing = Math.atan2(p.y - m.y, p.x - m.x);
        if (m.state === 'idle' && m.t > 2.4) { m.state = 'charge'; m.t = 0; }
        if (m.state === 'charge') {
          m.facing = Math.atan2(p.y - m.y, p.x - m.x);
          m.telegraph = 0.7 - m.t;
          if (m.t >= 0.7) {
            m.state = 'idle'; m.t = 0;
            if (m.emp) { // #110 EMPOWERED: three homing orbs in a spread
              for (let k = -1; k <= 1; k++) fireProjectile(g, m, m.facing + k * 0.35, 150, m.dmg, '#ff8a3d', 6, { glow: true, homing: 1.6, turnRate: 2.5 });
              m.emp = false;
            } else fireProjectile(g, m, m.facing, 155, m.dmg, '#ff8a3d', 6, { glow: true, homing: 1.8, turnRate: 2.7 });
            Sfx.play('bowfire');
          }
        }
        break;
      }
      case 'worm': {
        // #56 the HEAD chases with a strong serpentine weave, threading between the
        // player and any other mob. Only the head takes damage; the body segments are
        // INVULNERABLE shields (updateProjectiles blocks shots on them), and on death
        // each segment scatters away as a wormling.
        let tx = p.x, ty = p.y;
        // thread toward the midpoint between the player and the nearest OTHER mob
        let near = null, nd = 1e9;
        for (const o of g.monsters) { if (o === m || o.dead || o.type === 'wormling') continue; const d = Math.hypot(o.x - m.x, o.y - m.y); if (d < nd) { nd = d; near = o; } }
        if (near && nd < 260) { tx = (p.x + near.x) / 2; ty = (p.y + near.y) / 2; }
        moveToward(m, tx, ty, dt, m.speed * (m.empSpeedT > 0 ? 1.7 : 1)); // #110 EMPOWERED: slither-speed frenzy
        const perp = m.facing + Math.PI / 2, wob = Math.sin(m.t * 6.5) * 62; // strong zig-zag
        m.x += Math.cos(perp) * wob * dt; m.y += Math.sin(perp) * wob * dt;
        clampToField(m);
        if (!m.trail) m.trail = [];
        m.trailT = (m.trailT || 0) + dt;
        if (m.trailT > 0.025) { m.trailT = 0; m.trail.unshift({ x: m.x, y: m.y }); if (m.trail.length > 48) m.trail.pop(); }
        // body segments (invulnerable shields) sampled behind the head
        m.bodySegs = [];
        for (let i = 6; i < m.trail.length && m.bodySegs.length < 6; i += 7) m.bodySegs.push({ x: m.trail[i].x, y: m.trail[i].y, r: m.r * 0.85 });
        if (m.contactCd <= 0) {
          const pts = [{ x: m.x, y: m.y }, ...m.bodySegs];
          for (const s of pts) if (Math.hypot(p.x - s.x, p.y - s.y) < m.r + p.r + 2) { g.hurtTarget(p, m.dmg, s.x, s.y, m); m.contactCd = 0.7; break; }
        }
        break;
      }
      case 'pulser': {
        // erupts a radiating RING of bullets every ~3s (Mimic-King style); slow, so
        // it wants space - each ring is spun a little so consecutive rings interleave
        if (dist < 130) moveToward(m, m.x * 2 - p.x, m.y * 2 - p.y, dt, m.speed);
        else if (dist > 300) moveToward(m, p.x, p.y, dt, m.speed * 0.6);
        else m.facing = Math.atan2(p.y - m.y, p.x - m.x);
        if (m.state === 'idle' && m.t > 3.0) { m.state = 'charge'; m.t = 0; }
        if (m.state === 'charge') {
          m.telegraph = 0.85 - m.t;
          if (m.t >= 0.85) {
            m.state = 'idle'; m.t = 0;
            const n = 14;
            for (let i = 0; i < n; i++) fireProjectile(g, m, (i / n) * Math.PI * 2 + (m.pulseSpin || 0), 172, m.dmg, '#b06bff', 5, { glow: true });
            if (m.emp) { // #110 EMPOWERED: a SECOND ring offset to fill the gaps + a faster wave
              for (let i = 0; i < n; i++) fireProjectile(g, m, (i / n) * Math.PI * 2 + (m.pulseSpin || 0) + Math.PI / n, 232, m.dmg, '#d09bff', 5, { glow: true });
              m.emp = false;
            }
            m.pulseSpin = (m.pulseSpin || 0) + 0.224;
            Fx.shake(4, 0.2); Sfx.play('mimic');
            Fx.burst(m.x, m.y, ['#b06bff', '#fff'], 20, { speed: 200, life: 0.4, glow: true });
          }
        }
        break;
      }
      case 'miner': {
        // keeps its distance and drops a proximity mine every ~1.9s as it weaves
        if (dist < 200) moveToward(m, m.x * 2 - p.x, m.y * 2 - p.y, dt, m.speed);
        else if (dist > 360) moveToward(m, p.x, p.y, dt, m.speed * 0.8);
        else { moveToward(m, m.x + Math.sin(m.t * 1.5) * 70, m.y + Math.cos(m.t * 1.2) * 70, dt, m.speed * 0.55); m.facing = Math.atan2(p.y - m.y, p.x - m.x); }
        if (m.t - (m.lastMine || -2) > 1.9 && g.dropMine) {
          m.lastMine = m.t;
          if (m.emp) { // #110 EMPOWERED: a whole MINEFIELD cluster in one drop
            for (const off of [[0, 0], [-34, -20], [34, -18], [0, 34]]) g.dropMine(m.x + off[0], m.y + off[1], m.dmg);
            m.emp = false; Fx.shake(3, 0.15);
          } else g.dropMine(m.x, m.y, m.dmg);
          Sfx.play('upgrade'); Fx.burst(m.x, m.y + m.r * 0.5, ['#9a3a24', '#888'], 6, { speed: 50, life: 0.3 });
        }
        break;
      }
      case 'shielded': {
        // shield blocks frontal damage; bash leaves it open - flank or bait.
        // BULWARK (Sam): shield guys do NOT rush the player. If there's ANY ranged
        // mob in the room they plant themselves between it and the player and hold
        // the line, shield toward the threat, never leaving formation to charge. With
        // nobody to guard they advance SLOWLY behind the shield and only bash if the
        // player is right on top of them.
        if (m.state === 'idle') {
          m.shieldUp = true;
          const ward = nearestRangedAlly(m, g);
          if (ward) {
            // screen the ranged ally: sit ~halfway between it and the player, tracking
            const bx = ward.x + (p.x - ward.x) * 0.5, by = ward.y + (p.y - ward.y) * 0.5;
            moveToward(m, bx, by, dt, m.speed * 0.9);
            m.facing = Math.atan2(p.y - m.y, p.x - m.x);
            tryContactHit(m, g, p, 0.7);
            // #55 TAUNT: while guarding, it periodically FORCES you to aim/attack it (so you
            // must chew through the shield before the ranged mob behind it). ~every 5.5s.
            m.tauntCd = (m.tauntCd === undefined ? 3 : m.tauntCd) - dt;
            if (m.tauntCd <= 0 && dist > 60 && dist < 430 && g.playerTaunt) {
              m.tauntCd = 5.5; g.playerTaunt = { src: m, t: 2.2 };
              Fx.text(m.x, m.y - 30, 'TAUNT!', '#e0894a', 13);
              Fx.burst(m.x, m.y, ['#e0894a', '#fff'], 12, { speed: 130, life: 0.45, glow: true });
              Sfx.play('roar');
            }
            // it won't CHASE across the room, but if you push up on it, it bashes -
            // that drops its shield (recover = punish window), so it stays killable.
            if (dist < 88 && m.t > 1.0) { m.state = 'windup'; m.t = 0; }
          } else {
            // no one to guard: creep forward behind the shield, bash only point-blank
            moveToward(m, p.x, p.y, dt, m.speed * 0.55);
            m.facing = Math.atan2(p.y - m.y, p.x - m.x);
            tryContactHit(m, g, p, 0.7);
            if (dist < 62 && m.t > 1.6) { m.state = 'windup'; m.t = 0; }
          }
        } else if (m.state === 'windup') {
          m.telegraph = 0.45 - m.t;
          m.facing = Math.atan2(p.y - m.y, p.x - m.x);
          if (m.t >= 0.45) { m.state = 'bash'; m.t = 0; m.shieldUp = false; m.lungeAngle = m.facing; Sfx.play('swing'); }
        } else if (m.state === 'bash') {
          m.x += Math.cos(m.lungeAngle) * m.speed * 4 * dt;
          m.y += Math.sin(m.lungeAngle) * m.speed * 4 * dt;
          tryContactHit(m, g, p, 1.3);
          if (m.t > 0.3) { m.state = 'recover'; m.t = 0; } // shield stays down: punish window
        } else if (m.state === 'recover') {
          if (m.t > 0.9) { m.state = 'idle'; m.t = 0; }
        }
        break;
      }
      case 'bomber': {
        // rush and detonate; explosion also hurts other monsters (kite it!)
        // (fuse countdown lives above the stagger check so it always burns down)
        if (m.fuse < 0) {
          moveToward(m, p.x, p.y, dt, m.speed);
          if (dist < 65) { m.fuse = 0.8; Sfx.play('burn'); } // lit! blinking telegraph
        }
        break;
      }
      case 'summoner': {
        if (dist < 180) moveToward(m, m.x * 2 - p.x, m.y * 2 - p.y, dt, m.speed);
        if (m.state === 'idle' && m.t > 3.2) { m.state = 'channel'; m.t = 0; }
        if (m.state === 'channel') {
          m.telegraph = 1.0 - m.t;
          if (m.t >= 1.0) {
            m.state = 'idle'; m.t = 0;
            const adds = g.monsters.filter(x => x.type === 'add' && !x.dead).length;
            const n = Math.min(m.emp ? 4 : 2, (m.emp ? 8 : 6) - adds); // #110 EMPOWERED: a bigger brood
            if (m.emp) { m.emp = false; Fx.text(m.x, m.y - m.r - 10, 'SWARM!', '#9ef01a', 11); }
            for (let i = 0; i < n; i++) {
              const a = Math.random() * Math.PI * 2;
              const add = make('add', m.x + Math.cos(a) * 40, m.y + Math.sin(a) * 40, m.tier);
              g.monsters.push(add);
              Fx.burst(add.x, add.y, '#66ff99', 8, { speed: 90, life: 0.4 });
            }
            Sfx.play('mimic');
          }
        }
        break;
      }
      case 'mimic': {
        // woken mimic: aggressive hopping chomper
        if (m.state === 'idle') {
          moveToward(m, p.x, p.y, dt, m.speed);
          m.hop = Math.abs(Math.sin(m.t * 8)) * 8;
          if (dist < 100 && m.t > 0.5) { m.state = 'windup'; m.t = 0; m.lungeAngle = Math.atan2(p.y - m.y, p.x - m.x); }
          tryContactHit(m, g, p);
        } else if (m.state === 'windup') {
          m.telegraph = 0.35 - m.t;
          if (m.t >= 0.35) { m.state = 'lunge'; m.t = 0; Sfx.play('mimic'); }
        } else if (m.state === 'lunge') {
          m.x += Math.cos(m.lungeAngle) * m.speed * 3.8 * dt;
          m.y += Math.sin(m.lungeAngle) * m.speed * 3.8 * dt;
          tryContactHit(m, g, p, 1.4);
          if (m.t >= 0.3) { m.state = 'idle'; m.t = 0; }
        }
        break;
      }
    }

    // rock + pit collision (simple circle push-out). Pits are solid to a monster
    // walking normally, but if it's under real knockback and gets shoved OUT over
    // the lip (centre crosses into the hole), it falls to its death (#74).
    for (const o of g.room.obstacles) {
      const dx = m.x - o.x, dy = m.y - o.y, d = Math.hypot(dx, dy);
      if (o.kind === 'pit') {
        const knocked = (m.kvx * m.kvx + m.kvy * m.kvy) > 140 * 140 && !m.isBoss && m.type !== 'worm';
        if (knocked) { if (d < o.r) { fallInPit(m, g); return; } }        // shoved over the edge - no push, let it fall
        else if (d < o.r + m.r && d > 0) { m.x = o.x + (dx / d) * (o.r + m.r); m.y = o.y + (dy / d) * (o.r + m.r); }
        continue;
      }
      if (d < o.r + m.r && d > 0) { m.x = o.x + (dx / d) * (o.r + m.r); m.y = o.y + (dy / d) * (o.r + m.r); }
    }
    // #67b solid wall rects (anti-tunnel via pre-move pos)
    if (g.room.walls) for (const w of g.room.walls) { const q = Dungeon.rectPush(m.x, m.y, m.r, w, m.px, m.py); if (q) { m.x = q.x; m.y = q.y; } }
    clampToField(m);
  }

  function fireProjectile(g, m, angle, speed, dmg, color, r, opts = {}) {
    const x = m.x + Math.cos(angle) * (m.r + 6), y = m.y + Math.sin(angle) * (m.r + 6);
    const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
    g.projectiles.push({ x, y, vx, vy, r, dmg, from: 'enemy', color, life: opts.life || 3, glow: opts.glow || false, hitSet: null, homing: opts.homing, turnRate: opts.turnRate || 2.6 });
    // P1-B: mirror the bolt to guests (constant velocity -> reproduces the whole path,
    // and updateProjectiles already resolves from:'enemy' damage vs the local player)
    if (g.coop && typeof Net !== 'undefined' && Net.isHost) {
      Net.send({ t: 'proj', x: Math.round(x), y: Math.round(y), vx: Math.round(vx), vy: Math.round(vy), r, dmg, c: color, gl: opts.glow ? 1 : 0 });
    }
  }

  function explode(m, g) {
    const R = 105;
    m.dead = true; m.exploded = true;
    Fx.shake(9, 0.3); Fx.hitstop(0.04); Sfx.play('explode');
    Fx.burst(m.x, m.y, ['#ff8833', '#ffcc44', '#ff4422', '#888888'], 30, { speed: 260, life: 0.6, glow: true });
    // P1-A/B: every party member in range takes it; broadcast the blast so guests SEE it
    for (const t of g.partyTargets()) if (Math.hypot(t.x - m.x, t.y - m.y) < R + t.r) g.hurtTarget(t, m.dmg, m.x, m.y, m);
    if (g.coop && typeof Net !== 'undefined' && Net.isHost) Net.send({ t: 'boom', x: Math.round(m.x), y: Math.round(m.y), r: R });
    // friendly fire: rewards kiting the bomber into the pack
    for (const o of g.monsters) {
      if (o !== m && !o.dead && Math.hypot(o.x - m.x, o.y - m.y) < R + o.r) {
        applyDamage(o, m.dmg * 1.5, g, {});
      }
    }
    // #110 EMPOWERED bomber: the blast calls down an AIRSTRIKE - a ring of delayed,
    // telegraphed napalm impacts around it (each uses the lob-ring tell, so it's dodgeable)
    if (m.emp && g.ultFx) {
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2, rr = 90 + Math.random() * 30;
        g.ultFx.push({ type: 'lob', x: m.x + Math.cos(a) * rr, y: m.y + Math.sin(a) * rr, sx: m.x, sy: m.y - 30, t: 0, delay: 0.9 + i * 0.12, dmg: Math.round(m.dmg * 0.8), radius: 60, color: '#ff7a2c' });
      }
      Fx.text(m.x, m.y - 20, 'AIRSTRIKE!', '#ff7a2c', 12);
    }
    g.onKill(m);
  }

  // --- damage ---------------------------------------------------------------
  function takeHit(m, dmg, opts, g) {
    if (m.dead || m.spawnT > 0) return false;
    // Shielded: a hit from its front 120-degree arc (shield up) is USUALLY stopped cold,
    // but #120 not always - 85% full block, 15% a glancing blow that lets ~40% through,
    // so a shielder is a hard wall you can still chip rather than a total dead end.
    if (m.type === 'shielded' && m.shieldUp && opts.sx !== undefined) {
      const hitAngle = Math.atan2(opts.sy - m.y, opts.sx - m.x);
      let diff = Math.abs(((hitAngle - m.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff < Math.PI / 3) {
        const impX = m.x + Math.cos(hitAngle) * m.r, impY = m.y + Math.sin(hitAngle) * m.r;
        if (Math.random() < 0.85) {
          Fx.burst(impX, impY, '#aaddff', 6, { speed: 120, life: 0.3 });
          Fx.text(m.x, m.y - m.r - 8, 'BLOCKED', '#aaddff', 11);
          Sfx.play('hit');
          return false; // full block: no frenzy stacks or crit lifesteal
        }
        // glancing blow: a chunk slips past the shield (min 1 so it always registers)
        dmg = Math.max(1, Math.round(dmg * 0.4));
        Fx.burst(impX, impY, '#cfe8ff', 4, { speed: 90, life: 0.25 });
        Fx.text(m.x, m.y - m.r - 8, 'GLANCING', '#cfe8ff', 11);
        opts = Object.assign({}, opts, { crit: false }); // a graze can't crit
      }
    }
    if (opts.knock) {
      const ka = Math.atan2(m.y - opts.sy, m.x - opts.sx);
      // #79 the worm is a serpent: knockback yanks its HEAD off its trail-sampled body
      // (a visible detach), so it's knockback-immune. Tanks just resist heavily.
      const kmul = m.type === 'worm' ? 0 : m.type === 'tank' ? 0.3 : 1;
      m.kvx += Math.cos(ka) * opts.knock * kmul;
      m.kvy += Math.sin(ka) * opts.knock * kmul;
    }
    if (opts.flame) m.burn = { t: 2.5, dps: 3 + opts.flame * 2, tick: 0.4 };
    // Frost: slow the target; deep chill can briefly freeze it (reuses stagger)
    if (opts.chill) {
      m.chillT = 2.2; m.chillMul = Math.max(0.3, 1 - 0.45 * opts.chill);
      if (Math.random() < 0.2 * opts.chill && !m.isBoss) {
        m.stagger = Math.max(m.stagger || 0, 0.7);
        Fx.text(m.x, m.y - m.r - 8, 'FROZEN', '#aee7ff', 11);
      }
    }
    // Venom: heavy DOT
    if (opts.venom) m.poison = { t: 4.5, dps: 4 + opts.venom * 3, tick: 0.5 };
    if (opts.stagger) {
      m.stagger = Math.max(m.stagger, opts.stagger);
      // heavy hits INTERRUPT telegraphed attacks, not just delay them
      // (the tank windup is the designed testbed for this)
      if (['windup', 'draw', 'charge', 'channel'].includes(m.state)) {
        m.state = 'idle'; m.t = 0; m.telegraph = 0;
        Fx.text(m.x, m.y - m.r - 20, 'INTERRUPTED', '#aaddff', 11);
      }
    }
    if (typeof Ach !== 'undefined') Ach.hit(dmg, !!opts.crit, g); // #86 biggest hit / crit
    applyDamage(m, dmg, g, opts);
    // Chain Lightning: the strike arcs to nearby OTHER monsters (no re-chain)
    if (opts.chain && !opts.chainArc) chainArc(m, dmg, g, opts.chain);
    return true; // hit landed
  }

  // arc lightning from m to up to 2 nearby monsters for reduced damage
  function chainArc(m, dmg, g, power) {
    let arcs = 0;
    for (const o of g.monsters) {
      if (o === m || o.dead || o.spawnT > 0) continue;
      if (Math.hypot(o.x - m.x, o.y - m.y) > 155) continue;
      lightningFx(m, o);
      applyDamage(o, dmg * 0.45, g, { hitSfx: 'hitArrow', chainArc: true });
      if (++arcs >= 2) break;
    }
    if (arcs) Sfx.play('bowfire');
  }
  function lightningFx(a, b) {
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const x = a.x + (b.x - a.x) * i / steps + (Math.random() * 12 - 6);
      const y = a.y + (b.y - a.y) * i / steps + (Math.random() * 12 - 6);
      Fx.burst(x, y, ['#bfe8ff', '#7fd4ff', '#fff'], 1, { speed: 18, life: 0.2, glow: true, size: 2.6 });
    }
  }

  // the loot goblin got away: gone, and it takes its unclaimed gold with it (no onKill)
  function escapeGoblin(m) {
    m.dead = true; m.escaped = true;
    Fx.text(m.x, m.y - m.r - 14, 'ESCAPED!', '#ffd24c', 15);
    Fx.burst(m.x, m.y, ['#ffd24c', '#fff', '#6ee7a0'], 18, { speed: 210, life: 0.55, glow: true });
    Sfx.play('stairs');
  }

  // #74 an enemy shoved into a floor pit falls to its death - still counts as a
  // kill (score + loot), but no elite death-blast (it's at the bottom of a hole).
  function fallInPit(m, g) {
    m.kvx = 0; m.kvy = 0; m.hp = 0; m.dead = true; m.fell = true;
    Fx.burst(m.x, m.y, ['#000000', '#231a10', '#463a24'], 16, { speed: 70, life: 0.55 });
    Fx.text(m.x, m.y - 8, 'FELL', '#c9a227', 13);
    Sfx.play('hit');
    g.onKill(m);
  }

  function applyDamage(m, dmg, g, opts) {
    if (m.dead) return;
    // loot goblin spills a few coins every time it's struck (catch it for the jackpot)
    if (m.type === 'goblin' && !opts.silent && m.hp - dmg > 0 && g.spawnPickup) {
      const n = 1 + ((Math.random() * 2) | 0);
      for (let i = 0; i < n; i++) g.spawnPickup('coin', m.x, m.y);
    }
    if (m.type === 'bomber' && m.hp <= 0) return; // already in death throes, fuse lit
    m.hp -= dmg;
    m.flash = 0.12;
    // Executioner (ORIGINAL enchant): finish off weakened enemies (bosses resist)
    if (opts.execute && !m.isBoss && m.hp > 0 && m.hp <= m.maxHp * 0.3) {
      m.hp = 0;
      Fx.text(m.x, m.y - m.r - 18, 'EXECUTED', '#ffd24c', 14);
      Fx.burst(m.x, m.y, '#ffd24c', 12, { speed: 150, life: 0.5, glow: true });
      Sfx.play('deathtouch'); // the death-touch proc gets its own ominous cue
    }
    if (!opts.silent) {
      Fx.text(m.x + (Math.random() * 16 - 8), m.y - m.r - 6, Math.round(dmg), opts.crit ? '#ffd24c' : '#ffffff', opts.crit ? 16 : 12);
      Fx.burst(m.x, m.y, opts.crit ? '#ffd24c' : '#ff6655', opts.crit ? 10 : 5, { speed: 110, life: 0.35 });
      // impact sound matches the weapon that landed (hitSfx from the attacker)
      Sfx.play(opts.crit ? 'crit' : (opts.hitSfx || 'hit'));
      if (opts.flame) Sfx.play('burn'); // fire weapons sizzle on contact
    }
    if (m.hp <= 0) {
      if (m.type === 'bomber' && !m.exploded) {
        // dead-man's fuse: killing a bomber lights a SHORT telegraphed fuse instead
        // of detonating instantly (spec: death explosion must be dodgeable too)
        m.hp = 0;
        m.fuse = m.fuse >= 0 ? Math.min(m.fuse, 0.65) : 0.65; // #105 longer dead-man fuse (was 0.45) for a fair dodge window
        Sfx.play('burn');
        return;
      }
      m.dead = true;
      if (m.elite && m.elite.blast) eliteBlast(m, g);
      g.onKill(m);
    }
  }

  // a Volatile elite bursts on death: hurts the player and nearby monsters.
  // deliberately NOT routed through explode() (that would re-trigger onKill).
  function eliteBlast(m, g) {
    const R = m.elite.blast;
    Fx.shake(7, 0.25); Sfx.play('explode');
    Fx.burst(m.x, m.y, ['#ff4444', '#ffcc44', '#ff2200'], 26, { speed: 250, life: 0.6, glow: true });
    for (const t of g.partyTargets()) if (Math.hypot(t.x - m.x, t.y - m.y) < R + t.r) g.hurtTarget(t, Math.round(m.dmg * 1.2), m.x, m.y, m);
    if (g.coop && typeof Net !== 'undefined' && Net.isHost) Net.send({ t: 'boom', x: Math.round(m.x), y: Math.round(m.y), r: R });
    for (const o of g.monsters) {
      if (o !== m && !o.dead && Math.hypot(o.x - m.x, o.y - m.y) < R + o.r) applyDamage(o, m.dmg, g, {});
    }
  }

  // --- room spawning ------------------------------------------------------------
  function spawnForRoom(room, floor, g) {
    const tier = tierFor(floor, room.dist);
    const table = SPAWN_TABLE[tier];
    // Descent floors keep the tier-5 roster but scale raw stats + body count and
    // sprinkle in elites; the base 3 floors pass no mods and are unchanged.
    const descent = typeof Descent !== 'undefined' && Descent.isDescent(floor);
    const th = descent ? Descent.threat(floor) : null;
    let n = COUNT(tier);
    if (th) n = Math.min(14, Math.round(n * th.count));
    // #77 the floor's ALARM adds a few more bodies per room (capped) - the difficulty
    // side of the risk/reward: staying longer means fuller rooms.
    if (g.alarm) n = Math.min(16, n + Math.round(g.alarm * 0.35));
    const out = [];
    const p = g.player;
    // #67b/#74 don't spawn a mob buried in a wall or standing in a pit
    const blocked = (x, y) => {
      for (const w of room.walls || []) if (x > w.x - 20 && x < w.x + w.w + 20 && y > w.y - 20 && y < w.y + w.h + 20) return true;
      for (const o of room.obstacles) if (o.kind === 'pit' && Math.hypot(x - o.x, y - o.y) < o.r + 22) return true;
      return false;
    };
    // #27 THEMED ROOM: ~22% of combat rooms are a single enemy type (an all-archer
    // gauntlet, a bomb room, a nest of worms...). Cached on the room so it shows a
    // banner. A couple of types make miserable full rooms, so they're excluded.
    const BAD_THEME = ['summoner', 'tank', 'mimic', 'mimicbaby', 'add'];
    let themeType = null;
    if (room.enemyTheme === undefined) {
      const pool = table.filter(t => !BAD_THEME.includes(t));
      room.enemyTheme = (pool.length && Math.random() < 0.22) ? pool[(Math.random() * pool.length) | 0] : null;
    }
    themeType = room.enemyTheme;
    for (let i = 0; i < n; i++) {
      const type = themeType || table[(Math.random() * table.length) | 0];
      // swarmers arrive as a pack of 2-3 for the price of one slot
      const pack = type === 'swarmer' ? 2 + ((Math.random() * 2) | 0) : 1;
      for (let k = 0; k < pack; k++) {
        let x, y, tries = 0;
        do {
          x = PF.x + 60 + Math.random() * (PF.w - 120);
          y = PF.y + 60 + Math.random() * (PF.h - 120);
          tries++;
        } while ((Math.hypot(x - p.x, y - p.y) < 160 || blocked(x, y)) && tries < 30);
        let mods = null;
        if (th) {
          mods = { hpMul: th.hp, dmgMul: th.dmg, speedMul: th.speed };
          if (Math.random() < Descent.eliteChance(floor)) mods.elite = Descent.rollAffix();
        }
        out.push(make(type, x, y, tier, mods));
      }
    }
    // loot goblin: a rare visitor (~11% of combat rooms). Spawns away from the player
    // so it has room to run. Never carries Descent elite mods (it doesn't fight).
    if (Math.random() < 0.11) {
      let x, y, tries = 0;
      do { x = PF.x + 90 + Math.random() * (PF.w - 180); y = PF.y + 90 + Math.random() * (PF.h - 180); tries++; }
      while ((Math.hypot(x - p.x, y - p.y) < 240 || blocked(x, y)) && tries < 30);
      out.push(make('goblin', x, y, tier));
    }
    // #68 FORMATION room: some rooms stage the mob as a prepared UNIT opposite the door
    // you entered - shields/tanks front, ranged/casters back, the rest flanking - and
    // they HOLD the line for a beat before breaking to engage. More common at high alarm.
    if (g.enterFrom && out.length >= 3 && Math.random() < Math.min(0.6, 0.24 + 0.05 * (g.alarm || 0))) {
      repositionFormation(out, g.enterFrom, p);
      room.formation = true;
    }
    return out;
  }

  // arrange the mob into ranks opposite the entry side (the player enters on `side`)
  function repositionFormation(out, side, p) {
    const cx = PF.x + PF.w / 2, cy = PF.y + PF.h / 2;
    let ax, ay, fx, fy; // anchor (opposite the entry) + front unit vector (toward player)
    if (side === 'W') { ax = PF.x + PF.w * 0.72; ay = cy; fx = -1; fy = 0; }
    else if (side === 'E') { ax = PF.x + PF.w * 0.28; ay = cy; fx = 1; fy = 0; }
    else if (side === 'N') { ax = cx; ay = PF.y + PF.h * 0.72; fx = 0; fy = -1; }
    else { ax = cx; ay = PF.y + PF.h * 0.28; fx = 0; fy = 1; } // 'S'
    const px = -fy, py = fx; // lateral axis
    // #103 ROLE-BASED RANKS (Sam): sturdy tanks/shielded hold the FRONT line closest to
    // the player; the fuzzies (swarmers) picket a SCREEN just ahead of the ranged to body-
    // block for them; chargers (chasers) FLANK wide to the sides instead of tanking the
    // front; the ranged sit at the BACK.
    const FRONT = ['tank', 'shielded'], FLANK = ['chaser'], SCREEN = ['swarmer', 'add'];
    const BACK = ['archer', 'glass', 'summoner', 'lobber', 'pulser', 'seeker', 'miner'];
    const rank = { front: [], flank: [], screen: [], mid: [], back: [] };
    for (const m of out) {
      if (m.type === 'goblin') continue;
      const r = FRONT.includes(m.type) ? 'front' : FLANK.includes(m.type) ? 'flank'
              : SCREEN.includes(m.type) ? 'screen' : BACK.includes(m.type) ? 'back' : 'mid';
      rank[r].push(m);
    }
    const place = (m, depth, lat) => {
      m.x = Math.max(PF.x + 24, Math.min(PF.x + PF.w - 24, ax + fx * depth + px * lat));
      m.y = Math.max(PF.y + 24, Math.min(PF.y + PF.h - 24, ay + fy * depth + py * lat));
      m.facing = Math.atan2(-fy, -fx);   // face the player's entry side
      m.holdT = 2.8 + Math.random() * 1.4; // hold the line ~2.8-4.2s (or until the player closes)
      m.formationX = m.x; m.formationY = m.y;
      m.formFX = fx; m.formFY = fy;      // #94 shared forward axis: the whole line advances as ONE rigid block
      m.suppressCd = 0.2 + Math.random() * 0.5; // #94 base-of-fire: ranged open up almost at once
    };
    const lay = (arr, depth) => arr.forEach((m, i) => place(m, depth, (i - (arr.length - 1) / 2) * 36));
    lay(rank.front, 46);   // tanks/shielded: the wall closest to the player
    lay(rank.screen, 20);  // fuzzies: a picket line in front of the ranged
    lay(rank.mid, -12);
    lay(rank.back, -60);   // ranged: safest, farthest from the player
    // chargers flank: split to both sides, far out laterally, staggered slightly in depth
    rank.flank.forEach((m, i) => { const side = i % 2 === 0 ? 1 : -1, idx = (i / 2) | 0; place(m, 6 - idx * 22, side * (150 + idx * 38)); });
  }

  // #94 BASE OF FIRE: while a prepared unit advances, its ranged mobs open fire on
  // the player IMMEDIATELY - even from beyond their usual range (suppressing fire) -
  // using each type's own projectile so it reads the same as their normal attack.
  function formationSuppress(m, t, g, dt) {
    if (m.type !== 'archer' && m.type !== 'lobber' && m.type !== 'seeker' && m.type !== 'gunner') return;
    const ang = Math.atan2(t.y - m.y, t.x - m.x);
    // #105 AIM WINDUP: telegraph every suppressing shot so it stays dodgeable (it
    // used to fire the instant the cooldown cleared, violating the "every attack is
    // telegraphed" rule). m.telegraph in (0,1) draws the red windup ring (draw() @875).
    if (m.suppressAimT > 0) {
      m.suppressAimT -= dt;
      m.facing = ang;
      m.telegraph = Math.max(0.02, Math.min(0.99, m.suppressAimT));
      if (m.suppressAimT <= 0) {
        m.telegraph = 0;
        if (m.type === 'archer') { fireProjectile(g, m, ang, 330, m.dmg, '#cfe8b0', 4); m.suppressCd = 1.5; Sfx.play('bowfire'); }
        else if (m.type === 'seeker') { fireProjectile(g, m, ang, 155, m.dmg, '#ff8a3d', 6, { glow: true, homing: 1.8, turnRate: 2.7 }); m.suppressCd = 2.4; Sfx.play('bowfire'); }
        else if (m.type === 'gunner') { for (let k = -1; k <= 1; k++) fireProjectile(g, m, ang + k * 0.12, 400, m.dmg, '#ffd24c', 3, { glow: true }); m.muzzle = 0.07; m.suppressCd = 1.6; Sfx.play('bowfire'); } // #115 held gunner lays down a short burst
        else { g.ultFx.push({ type: 'lob', x: t.x, y: t.y, sx: m.x, sy: m.y, t: 0, delay: 1.0, dmg: m.dmg, radius: 68, color: '#ff5a2c' }); m.suppressCd = 2.6; Sfx.play('bowfire'); }
      }
      return;
    }
    m.suppressCd = (m.suppressCd || 0) - dt;
    if (m.suppressCd > 0) return;
    // cooldown cleared: begin the aim windup (the lobber's arc is its own tell, so it
    // gets a shorter one). The shot fires when the windup elapses, above.
    m.facing = ang;
    m.suppressAimT = m.type === 'lobber' ? 0.4 : 0.55;
  }

  // --- rendering ------------------------------------------------------------------
  function draw(m, c, g) {
    const p = g.player;
    c.save();
    c.translate(m.x, m.y - (m.hop || 0));

    // spawn-in: rise from a shadow
    if (m.spawnT > 0) {
      const k = 1 - m.spawnT / 0.35;
      c.globalAlpha = k;
      c.scale(k, k);
    }

    // telegraph flash: white-hot ring right before an attack lands
    const tele = m.telegraph > 0 && m.telegraph < 1 ? m.telegraph : 0;

    // damage flash
    const flash = m.flash > 0;

    const eyeA = Math.atan2(p.y - m.y, p.x - m.x);
    const ex = Math.cos(eyeA) * 3, ey = Math.sin(eyeA) * 3;

    switch (m.type) {
      case 'chaser': drawChaser(c, m, flash, ex, ey); break;
      case 'archer': drawArcher(c, m, flash, ex, ey); break;
      case 'gunner': drawGunner(c, m, flash, ex, ey); break;
      case 'lobber': drawLobber(c, m, flash, ex, ey); break;
      case 'tank': drawTank(c, m, flash, ex, ey); break;
      case 'swarmer': case 'add': drawSwarmer(c, m, flash, ex, ey); break;
      case 'wormling': drawWormling(c, m, flash, ex, ey); break;
      case 'glass': drawGlass(c, m, flash, ex, ey); break;
      case 'shielded': drawShielded(c, m, flash, ex, ey); break;
      case 'bomber': drawBomber(c, m, flash, ex, ey); break;
      case 'summoner': drawSummoner(c, m, flash, ex, ey); break;
      case 'mimic': case 'mimicbaby': drawMimicMonster(c, m, flash, ex, ey); break;
      case 'goblin': drawGoblin(c, m, flash, ex, ey); break;
      case 'seeker': drawSeeker(c, m, flash, ex, ey); break;
      case 'miner': drawMiner(c, m, flash, ex, ey); break;
      case 'pulser': drawPulser(c, m, flash, ex, ey); break;
      case 'worm': drawWorm(c, m, flash, ex, ey); break;
    }

    // #110 EMPOWERED aura: a gold pulsing ring while a mob has a big move armed (or a
    // worm is mid-frenzy), so the player reads "this one's about to do something bigger"
    if (m.emp || m.empSpeedT > 0) {
      c.save();
      c.strokeStyle = `rgba(255,210,76,${0.5 + Math.sin(Date.now() / 110) * 0.3})`;
      c.shadowColor = '#ffd24c'; c.shadowBlur = 6;
      c.lineWidth = 2.2;
      c.beginPath(); c.arc(0, 0, m.r + 6, 0, Math.PI * 2); c.stroke();
      c.restore();
    }

    // elite aura: a pulsing ring + faint glow in the affix color
    if (m.elite) {
      c.save();
      c.strokeStyle = m.elite.color;
      c.shadowColor = m.elite.color; c.shadowBlur = 8;
      c.globalAlpha = 0.45 + Math.sin(Date.now() / 200 + m.x) * 0.25;
      c.lineWidth = 2.5;
      c.beginPath(); c.arc(0, 0, m.r + 5, 0, Math.PI * 2); c.stroke();
      c.restore();
    }

    // burn flames
    if (m.burn) {
      c.fillStyle = 'rgba(255,150,50,0.7)';
      for (let i = 0; i < 3; i++) {
        const fx = Math.sin(Date.now() / 90 + i * 2.1) * m.r * 0.5;
        c.beginPath(); c.arc(fx, -m.r - 2 - (i * 2), 2.5, 0, Math.PI * 2); c.fill();
      }
    }

    // telegraph ring
    if (tele) {
      c.strokeStyle = `rgba(255,80,80,${0.4 + Math.sin(Date.now() / 40) * 0.3})`;
      c.lineWidth = 2.5;
      c.beginPath(); c.arc(0, 0, m.r + 6, 0, Math.PI * 2); c.stroke();
    }

    c.restore();

    // hp bar (only when damaged)
    if (m.hp < m.maxHp && !m.dead) {
      const w = m.r * 2.2;
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.fillRect(m.x - w / 2, m.y - m.r - 12, w, 4);
      c.fillStyle = m.hp / m.maxHp > 0.4 ? '#5cd65c' : '#e05555';
      c.fillRect(m.x - w / 2, m.y - m.r - 12, w * Math.max(0, m.hp / m.maxHp), 4);
    }
  }

  function body(c, m, color, flash) {
    c.fillStyle = flash ? '#ffffff' : color;
    c.beginPath(); c.arc(0, 0, m.r, 0, Math.PI * 2); c.fill();
  }
  function eyes(c, ex, ey, spread = 5, r = 2.5, color = '#fff') {
    c.fillStyle = color;
    c.beginPath(); c.arc(-spread + ex, -2 + ey, r, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(spread + ex, -2 + ey, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#111';
    c.beginPath(); c.arc(-spread + ex * 1.3, -2 + ey * 1.3, r * 0.45, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(spread + ex * 1.3, -2 + ey * 1.3, r * 0.45, 0, Math.PI * 2); c.fill();
  }

  function drawChaser(c, m, flash, ex, ey) {
    body(c, m, '#c0392b', flash);
    // horns
    c.fillStyle = flash ? '#fff' : '#7a1f14';
    c.beginPath(); c.moveTo(-m.r * 0.7, -m.r * 0.5); c.lineTo(-m.r * 1.1, -m.r * 1.3); c.lineTo(-m.r * 0.25, -m.r * 0.85); c.fill();
    c.beginPath(); c.moveTo(m.r * 0.7, -m.r * 0.5); c.lineTo(m.r * 1.1, -m.r * 1.3); c.lineTo(m.r * 0.25, -m.r * 0.85); c.fill();
    eyes(c, ex, ey, 5, 2.6, '#ffe08a');
  }
  function drawGoblin(c, m, flash, ex, ey) {
    const bob = Math.sin(m.bob || 0) * 1.6;
    // a bulging gold sack slung on its back (bounces as it sprints)
    c.fillStyle = flash ? '#fff' : '#b8892f';
    c.beginPath(); c.arc(-m.r * 0.75, -m.r * 0.25 + bob, m.r * 0.62, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#7a5a1a'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-m.r * 1.05, -m.r * 0.75 + bob); c.lineTo(-m.r * 0.45, -m.r * 0.75 + bob); c.stroke();
    c.fillStyle = flash ? '#fff' : '#ffe08a';
    c.beginPath(); c.arc(-m.r * 0.7, -m.r * 0.35 + bob, 1.7, 0, Math.PI * 2); c.fill();
    // green body + big pointy ears + greedy gold eyes
    body(c, m, flash ? '#fff' : '#5aa84a', flash);
    c.fillStyle = flash ? '#fff' : '#4a8f3c';
    c.beginPath(); c.moveTo(-m.r * 0.55, -m.r * 0.1); c.lineTo(-m.r * 1.5, -m.r * 0.55); c.lineTo(-m.r * 0.45, -m.r * 0.55); c.fill();
    c.beginPath(); c.moveTo(m.r * 0.55, -m.r * 0.1); c.lineTo(m.r * 1.5, -m.r * 0.55); c.lineTo(m.r * 0.45, -m.r * 0.55); c.fill();
    eyes(c, ex, ey, 4.5, 2.4, '#ffd24c');
  }
  function drawSeeker(c, m, flash, ex, ey) {
    // a floating single-eye orb ringed with slowly-spinning fins; glows while charging
    const t = Date.now() / 400;
    c.save();
    c.fillStyle = flash ? '#fff' : '#7a3d1a';
    for (let i = 0; i < 3; i++) {
      const a = t + i * (Math.PI * 2 / 3);
      c.beginPath(); c.ellipse(Math.cos(a) * m.r * 1.05, Math.sin(a) * m.r * 1.05, 3.5, 1.6, a, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    body(c, m, flash ? '#fff' : '#c46a2c', flash);
    // big single tracking eye
    c.fillStyle = '#1a0f08'; c.beginPath(); c.arc(0, 0, m.r * 0.62, 0, Math.PI * 2); c.fill();
    c.fillStyle = m.state === 'charge' ? '#fff6c0' : '#ff8a3d';
    c.beginPath(); c.arc(ex * 1.4, ey * 1.4, m.r * 0.34, 0, Math.PI * 2); c.fill();
    if (m.state === 'charge') { c.strokeStyle = 'rgba(255,180,80,0.8)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, m.r + 4 + Math.sin(Date.now() / 60) * 2, 0, Math.PI * 2); c.stroke(); }
  }
  function drawWorm(c, m, flash, ex, ey) {
    // c is translated to the head (m.x, m.y); trail points are world coords, so draw
    // them at their offset from the head. Tail-first so the head sits on top.
    const trail = m.trail || [];
    for (let i = Math.min(trail.length - 1, 34); i >= 1; i -= 3) {
      const s = trail[i], k = 1 - i / 38;
      c.fillStyle = flash ? '#fff' : ((i >> 2) & 1 ? '#2f7a45' : '#3f9e5a');
      c.beginPath(); c.arc(s.x - m.x, s.y - m.y, m.r * (0.45 + k * 0.55), 0, Math.PI * 2); c.fill();
    }
    body(c, m, flash ? '#fff' : '#5fd07a', flash);
    // mandibles at the front
    c.strokeStyle = flash ? '#fff' : '#245c33'; c.lineWidth = 2;
    c.save(); c.rotate(m.facing);
    c.beginPath(); c.moveTo(m.r * 0.7, -m.r * 0.5); c.lineTo(m.r * 1.3, -m.r * 0.7); c.stroke();
    c.beginPath(); c.moveTo(m.r * 0.7, m.r * 0.5); c.lineTo(m.r * 1.3, m.r * 0.7); c.stroke();
    c.restore();
    eyes(c, ex, ey, 3.4, 1.9, '#fff');
  }
  function drawLobber(c, m, flash, ex, ey) {
    // #66 a squat mortar-gunner: dark body, an upward tube, and a lit bomb it hoists
    // while winding up (m.state === 'draw')
    body(c, m, flash ? '#fff' : '#6a4a2a', flash);
    c.save(); c.rotate(m.facing);                       // stubby barrel toward the player
    c.fillStyle = flash ? '#fff' : '#3a3f48'; c.fillRect(m.r * 0.2, -4, m.r * 1.05, 8);
    c.restore();
    const lit = m.state === 'draw';
    c.fillStyle = lit ? '#ff7a2c' : '#2a1810';          // the bomb, hoisted overhead
    c.beginPath(); c.arc(0, -m.r - 4, 4.6, 0, Math.PI * 2); c.fill();
    if (lit) { c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(2, -m.r - 8, 2 + Math.random() * 1.6, 0, Math.PI * 2); c.fill(); }
    eyes(c, ex, ey, 4, 2.2, '#ffb060');
  }
  function drawPulser(c, m, flash, ex, ey) {
    // a throbbing violet core wrapped in concentric rings; swells while charging
    const pulse = m.state === 'charge' ? (m.t / 0.85) : (0.5 + Math.sin(Date.now() / 400) * 0.5);
    c.save();
    c.strokeStyle = `rgba(176,107,255,${0.3 + pulse * 0.5})`; c.lineWidth = 2;
    for (const rr of [m.r + 4, m.r + 9]) { c.beginPath(); c.arc(0, 0, rr + pulse * 4, 0, Math.PI * 2); c.stroke(); }
    c.restore();
    body(c, m, flash ? '#fff' : '#7b48b8', flash);
    c.fillStyle = flash ? '#fff' : '#c9a0ff';
    c.beginPath(); c.arc(0, 0, m.r * 0.5 + pulse * 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2a1440'; c.beginPath(); c.arc(0, 0, m.r * 0.28, 0, Math.PI * 2); c.fill();
    eyes(c, ex, ey, 3.5, 2, '#e0c8ff');
  }
  function drawMiner(c, m, flash, ex, ey) {
    // squat armored beetle with mine-spikes ridging its back
    body(c, m, flash ? '#fff' : '#6a5a48', flash);
    c.fillStyle = flash ? '#eee' : '#463b2c';
    c.beginPath(); c.arc(0, 0, m.r * 0.52, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#9a3a24'; c.lineWidth = 2;
    for (const a of [-0.7, 0, 0.7]) { const ang = a - Math.PI / 2; c.beginPath(); c.moveTo(Math.cos(ang) * m.r * 0.9, Math.sin(ang) * m.r * 0.9); c.lineTo(Math.cos(ang) * (m.r + 5), Math.sin(ang) * (m.r + 5)); c.stroke(); }
    eyes(c, ex, ey, 4, 2.2, '#ff8a3d');
  }
  function drawArcher(c, m, flash, ex, ey) {
    body(c, m, '#4a7c42', flash);
    eyes(c, ex, ey, 4, 2.2);
    // bow held toward facing; string draws back during 'draw' state
    c.save(); c.rotate(m.facing);
    c.strokeStyle = '#8a6b3a'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(m.r + 4, 0, 9, -Math.PI / 2.2, Math.PI / 2.2); c.stroke();
    const pull = m.state === 'draw' ? Math.min(1, m.t / 0.6) * 7 : 0;
    c.strokeStyle = '#ddd'; c.lineWidth = 1;
    c.beginPath();
    c.moveTo(m.r + 4 + Math.cos(-Math.PI / 2.2) * 9, Math.sin(-Math.PI / 2.2) * 9);
    c.lineTo(m.r + 4 - pull, 0);
    c.lineTo(m.r + 4 + Math.cos(Math.PI / 2.2) * 9, Math.sin(Math.PI / 2.2) * 9);
    c.stroke();
    if (pull > 0) { c.strokeStyle = '#cfe8b0'; c.lineWidth = 2; c.beginPath(); c.moveTo(m.r + 4 - pull, 0); c.lineTo(m.r + 13 - pull, 0); c.stroke(); }
    c.restore();
  }
  // #114 machine-gunner: a squat steel body with a stubby multi-barrel gun that spins
  // up (spin state) and spits a muzzle flash while bursting.
  function drawGunner(c, m, flash, ex, ey) {
    body(c, m, flash ? '#fff' : '#586b7a', flash);
    // ammo-belt bandolier across the body
    c.strokeStyle = flash ? '#eee' : '#c9a227'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-m.r * 0.7, -m.r * 0.3); c.lineTo(m.r * 0.7, m.r * 0.45); c.stroke();
    eyes(c, ex, ey, 4, 2.2, '#ff9a3d');
    c.save(); c.rotate(m.facing);
    // barrel cluster (3 stubby barrels), spinning while spun-up / firing
    const spin = m.spin || 0;
    c.fillStyle = flash ? '#eee' : '#39434e';
    c.beginPath(); c.roundRect ? c.roundRect(m.r - 2, -6, 16, 12, 3) : c.rect(m.r - 2, -6, 16, 12); c.fill();
    for (let i = 0; i < 3; i++) {
      const off = Math.sin(spin + i * 2.09) * 3.2;
      c.fillStyle = flash ? '#fff' : '#20272e';
      c.fillRect(m.r + 12, off - 1.4, 8, 2.8);
    }
    // muzzle flash during the burst
    if (m.muzzle > 0) {
      c.globalAlpha = Math.min(1, m.muzzle / 0.07);
      c.fillStyle = '#ffe08a';
      c.beginPath(); c.moveTo(m.r + 20, 0); c.lineTo(m.r + 32, -5); c.lineTo(m.r + 28, 0); c.lineTo(m.r + 32, 5); c.closePath(); c.fill();
      c.globalAlpha = 1;
    }
    c.restore();
  }
  function drawTank(c, m, flash, ex, ey) {
    // heavy hexagonal bruiser
    c.fillStyle = flash ? '#fff' : '#5d6d7e';
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 6;
      c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * m.r, Math.sin(a) * m.r);
    }
    c.closePath(); c.fill();
    c.fillStyle = flash ? '#eee' : '#3d4a58';
    c.beginPath(); c.arc(0, 0, m.r * 0.55, 0, Math.PI * 2); c.fill();
    eyes(c, ex, ey, 6, 3, '#ff9a3d');
    // windup: fists rise
    if (m.state === 'windup') {
      const k = m.t / 0.75;
      c.fillStyle = '#8d9aa8';
      c.beginPath(); c.arc(-m.r - 4, -k * 14, 7, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(m.r + 4, -k * 14, 7, 0, Math.PI * 2); c.fill();
    }
  }
  // #80 a little GREEN wormling (a loosed worm segment): rounded body, darker banding,
  // a lighter belly and tiny eyes - visibly a baby worm, not a fuzzy swarmer. It
  // wriggles while it scatters/swarms.
  function drawWormling(c, m, flash, ex, ey) {
    const wr = m.r, wig = Math.sin((m.t || 0) * 14 + m.x) * 0.25;
    c.save(); c.rotate(wig);
    c.fillStyle = flash ? '#fff' : '#5aa84a';                 // green body
    c.beginPath(); c.ellipse(0, 0, wr * 1.1, wr * 0.86, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = flash ? '#dfffcf' : '#3e7a33'; c.lineWidth = 1.4; // segment bands
    for (const bx of [-wr * 0.45, 0, wr * 0.45]) { c.beginPath(); c.moveTo(bx, -wr * 0.7); c.quadraticCurveTo(bx + 2, 0, bx, wr * 0.7); c.stroke(); }
    c.fillStyle = flash ? '#fff' : '#7ac06a';                 // lighter belly
    c.beginPath(); c.ellipse(0, wr * 0.32, wr * 0.72, wr * 0.4, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    eyes(c, ex, ey, 3.4, 1.9, '#eaffd8');
  }
  function drawSwarmer(c, m, flash, ex, ey) {
    const col = m.type === 'add' ? '#57c26b' : '#8e5bb8';
    body(c, m, col, flash);
    // twitchy legs
    c.strokeStyle = flash ? '#fff' : (m.type === 'add' ? '#2e7040' : '#5a3878'); c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.sin(Date.now() / 60 + i) * 0.4;
      c.beginPath(); c.moveTo(Math.cos(a) * m.r * 0.7, Math.sin(a) * m.r * 0.7);
      c.lineTo(Math.cos(a) * (m.r + 5), Math.sin(a) * (m.r + 5)); c.stroke();
    }
    eyes(c, ex, ey, 3, 1.8);
  }
  function drawGlass(c, m, flash, ex, ey) {
    // unmistakable silhouette: glowing magenta diamond (priority target!)
    c.shadowColor = '#ff66dd'; c.shadowBlur = 14;
    c.fillStyle = flash ? '#fff' : '#e84393';
    c.beginPath();
    c.moveTo(0, -m.r * 1.5); c.lineTo(m.r, 0); c.lineTo(0, m.r * 1.5); c.lineTo(-m.r, 0);
    c.closePath(); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(ex, ey - 3, 2.5, 0, Math.PI * 2); c.fill();
    // charging: energy gathers
    if (m.state === 'charge') {
      const k = m.t / 0.55;
      c.strokeStyle = `rgba(255,102,221,${k})`; c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, m.r * 1.8 * (1 - k) + 4, 0, Math.PI * 2); c.stroke();
    }
  }
  function drawShielded(c, m, flash, ex, ey) {
    body(c, m, '#2e8b8b', flash);
    eyes(c, ex, ey, 4, 2.2);
    // tower shield facing the player (or dropped during bash/recover)
    c.save(); c.rotate(m.facing);
    if (m.shieldUp) {
      c.fillStyle = flash ? '#fff' : '#b8c6d0';
      c.fillRect(m.r - 2, -m.r - 4, 6, m.r * 2 + 8);
      c.fillStyle = '#7d8f9b';
      c.fillRect(m.r + 1, -m.r - 4, 2, m.r * 2 + 8);
    } else {
      // shield lowered: visibly held at the side (punish window!)
      c.fillStyle = '#b8c6d0';
      c.save(); c.rotate(1.1); c.fillRect(m.r - 4, m.r * 0.4, 5, m.r * 1.6); c.restore();
    }
    c.restore();
  }
  function drawBomber(c, m, flash, ex, ey) {
    // round bomb body; blinks faster as the fuse burns
    const lit = m.fuse >= 0;
    // #105 DANGER FOOTPRINT: while the fuse burns, show the TRUE 105px blast radius
    // (matches explode()), brightening as detonation nears - the bomber used to have
    // no danger ring at all, only a body blink.
    if (lit) {
      const R = 105, urgency = 1 - Math.min(1, m.fuse / 0.8);
      c.fillStyle = `rgba(255,60,40,${0.05 + 0.12 * urgency})`;
      c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
      c.strokeStyle = `rgba(255,${Math.round(90 - 60 * urgency)},${Math.round(60 - 40 * urgency)},${0.35 + 0.35 * urgency + Math.sin(Date.now() / 45) * 0.15})`;
      c.lineWidth = 2 + 2 * urgency;
      c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke();
    }
    const blink = lit && Math.sin(Date.now() / (30 + m.fuse * 120)) > 0;
    body(c, m, blink ? '#ff5533' : '#d35400', flash);
    eyes(c, ex, ey, 4, 2.2);
    // fuse
    c.strokeStyle = '#7a5230'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(0, -m.r); c.quadraticCurveTo(4, -m.r - 8, 8, -m.r - 10); c.stroke();
    if (lit) {
      c.fillStyle = '#ffe08a';
      c.beginPath(); c.arc(8, -m.r - 10, 3 + Math.random() * 2, 0, Math.PI * 2); c.fill();
    }
  }
  function drawSummoner(c, m, flash, ex, ey) {
    // hooded robe (triangle) + channel ring while summoning
    c.fillStyle = flash ? '#fff' : '#34495e';
    c.beginPath(); c.moveTo(0, -m.r * 1.4); c.lineTo(m.r * 1.1, m.r); c.lineTo(-m.r * 1.1, m.r); c.closePath(); c.fill();
    c.fillStyle = flash ? '#eee' : '#22303f';
    c.beginPath(); c.arc(0, -m.r * 0.55, m.r * 0.55, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#9ef01a';
    c.beginPath(); c.arc(-3 + ex, -m.r * 0.55 + ey, 2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(3 + ex, -m.r * 0.55 + ey, 2, 0, Math.PI * 2); c.fill();
    if (m.state === 'channel') {
      const k = m.t / 1.0;
      c.strokeStyle = `rgba(158,240,26,${0.3 + 0.5 * Math.sin(k * 20)})`; c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, m.r + 10 + k * 8, 0, Math.PI * 2 * k); c.stroke();
    }
  }
  function drawMimicMonster(c, m, flash, ex, ey) {
    const s = m.type === 'mimicbaby' ? 0.65 : 1;
    // chest body with open jaw + teeth
    const jaw = m.state === 'windup' || m.state === 'lunge' ? 10 : 4 + Math.sin(Date.now() / 150) * 2;
    c.fillStyle = flash ? '#fff' : '#7a5230';
    c.fillRect(-16 * s, -6 * s, 32 * s, 14 * s); // lower box
    c.save();
    c.translate(0, -6 * s); c.rotate(-jaw * 0.045);
    c.fillStyle = flash ? '#eee' : '#8d6238';
    c.fillRect(-16 * s, -10 * s, 32 * s, 10 * s); // lid
    c.fillStyle = '#d4af37';
    c.fillRect(-16 * s, -3 * s, 32 * s, 2.5 * s);
    c.restore();
    // teeth
    c.fillStyle = '#f4ecd8';
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(i * 6 * s - 2, -6 * s); c.lineTo(i * 6 * s, -1 * s); c.lineTo(i * 6 * s + 2, -6 * s);
      c.fill();
    }
    // tongue + eyes
    c.fillStyle = '#c0392b';
    c.beginPath(); c.ellipse(0, 2 * s, 6 * s, 3 * s, 0, 0, Math.PI); c.fill();
    c.fillStyle = '#ffd24c';
    c.beginPath(); c.arc(-6 * s + ex, -12 * s + ey, 2.2 * s, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(6 * s + ex, -12 * s + ey, 2.2 * s, 0, Math.PI * 2); c.fill();
  }

  return { make, spawnForRoom, tierFor, BASE, SPAWN_TABLE };
})();
