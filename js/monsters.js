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
  };

  // --- SPAWN TABLE by tier (tier = floor + roomDist/3, see tierFor) ------------
  const SPAWN_TABLE = {
    1: ['chaser', 'chaser', 'swarmer'],
    2: ['chaser', 'swarmer', 'archer', 'bomber'],
    3: ['chaser', 'archer', 'bomber', 'glass', 'tank', 'swarmer'],
    4: ['archer', 'tank', 'glass', 'shielded', 'summoner', 'bomber'],
    5: ['tank', 'glass', 'shielded', 'summoner', 'archer', 'bomber'],
  };
  const COUNT = t => Math.min(8, 2 + t + ((Math.random() * 3) | 0)); // monsters per combat room

  function tierFor(floor, dist) { return Math.max(1, Math.min(5, floor + Math.floor(dist / 3))); }

  // ============================================================================
  // mods (Descent): { hpMul, dmgMul, speedMul, elite } - endless-floor scaling and
  // an optional elite affix. null on the base 3 floors, so those are untouched.
  function make(type, x, y, tier = 1, mods = null) {
    const b = BASE[type];
    const hpMul = 1 + 0.30 * (tier - 1), dmgMul = 1 + 0.15 * (tier - 1);
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

    const p = nearestTarget(m, g), dist = Math.hypot(p.x - m.x, p.y - m.y); // PR-1: chase the closest player

    switch (m.type) {
      case 'chaser':
      case 'mimicbaby':
      case 'add': {
        // telegraphed lunge when close: pause + flash, then dash
        if (m.state === 'idle') {
          moveToward(m, p.x, p.y, dt, m.speed);
          if (dist < 95 && m.t > 0.4) { m.state = 'windup'; m.t = 0; m.lungeAngle = Math.atan2(p.y - m.y, p.x - m.x); }
          tryContactHit(m, g, p);
        } else if (m.state === 'windup') {
          m.telegraph = 0.32 - m.t;
          if (m.t >= 0.32) { m.state = 'lunge'; m.t = 0; Sfx.play('swing'); }
        } else if (m.state === 'lunge') {
          m.x += Math.cos(m.lungeAngle) * m.speed * 3.4 * dt;
          m.y += Math.sin(m.lungeAngle) * m.speed * 3.4 * dt;
          tryContactHit(m, g, p, 1.2);
          if (m.t >= 0.28) { m.state = 'idle'; m.t = 0; }
        }
        break;
      }
      case 'swarmer': {
        // jittery fast chase, threatens through numbers
        const jx = Math.sin(m.t * 9 + m.x) * 40;
        moveToward(m, p.x + jx, p.y + Math.cos(m.t * 7) * 30, dt, m.speed);
        tryContactHit(m, g, p);
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
            fireProjectile(g, m, m.facing, 330, m.dmg, '#cfe8b0', 4);
            Sfx.play('bowfire');
          }
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
            if (dist < 115 + p.r) p.damage(m.dmg, m.x, m.y, g);
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
            fireProjectile(g, m, m.facing, 420, m.dmg, '#ff66dd', 6, { glow: true });
            Sfx.play('crit');
          }
        }
        break;
      }
      case 'shielded': {
        // shield blocks frontal damage; bash leaves it open - flank or bait
        if (m.state === 'idle') {
          m.shieldUp = true;
          moveToward(m, p.x, p.y, dt, m.speed);
          if (dist < 110 && m.t > 1.2) { m.state = 'windup'; m.t = 0; }
          tryContactHit(m, g, p, 0.7);
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
            const n = Math.min(2, 6 - adds); // cap adds so rooms can't flood
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

    // rock collision (simple circle push-out)
    for (const o of g.room.obstacles) {
      const dx = m.x - o.x, dy = m.y - o.y, d = Math.hypot(dx, dy);
      if (d < o.r + m.r && d > 0) { m.x = o.x + (dx / d) * (o.r + m.r); m.y = o.y + (dy / d) * (o.r + m.r); }
    }
    clampToField(m);
  }

  function fireProjectile(g, m, angle, speed, dmg, color, r, opts = {}) {
    const x = m.x + Math.cos(angle) * (m.r + 6), y = m.y + Math.sin(angle) * (m.r + 6);
    const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
    g.projectiles.push({ x, y, vx, vy, r, dmg, from: 'enemy', color, life: 3, glow: opts.glow || false, hitSet: null });
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
    g.onKill(m);
  }

  // --- damage ---------------------------------------------------------------
  function takeHit(m, dmg, opts, g) {
    if (m.dead || m.spawnT > 0) return false;
    // Shielded: blocks hits arriving from its front 120-degree arc while shield is up
    if (m.type === 'shielded' && m.shieldUp && opts.sx !== undefined) {
      const hitAngle = Math.atan2(opts.sy - m.y, opts.sx - m.x);
      let diff = Math.abs(((hitAngle - m.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff < Math.PI / 3) {
        Fx.burst(m.x + Math.cos(hitAngle) * m.r, m.y + Math.sin(hitAngle) * m.r, '#aaddff', 6, { speed: 120, life: 0.3 });
        Fx.text(m.x, m.y - m.r - 8, 'BLOCKED', '#aaddff', 11);
        Sfx.play('hit');
        return false; // blocked hits earn no frenzy stacks or crit lifesteal
      }
    }
    if (opts.knock) {
      const ka = Math.atan2(m.y - opts.sy, m.x - opts.sx);
      const kmul = m.type === 'tank' ? 0.3 : 1;
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

  function applyDamage(m, dmg, g, opts) {
    if (m.dead) return;
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
        m.fuse = m.fuse >= 0 ? Math.min(m.fuse, 0.45) : 0.45;
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
    const out = [];
    const p = g.player;
    for (let i = 0; i < n; i++) {
      const type = table[(Math.random() * table.length) | 0];
      // swarmers arrive as a pack of 2-3 for the price of one slot
      const pack = type === 'swarmer' ? 2 + ((Math.random() * 2) | 0) : 1;
      for (let k = 0; k < pack; k++) {
        let x, y, tries = 0;
        do {
          x = PF.x + 60 + Math.random() * (PF.w - 120);
          y = PF.y + 60 + Math.random() * (PF.h - 120);
          tries++;
        } while (Math.hypot(x - p.x, y - p.y) < 160 && tries < 30);
        let mods = null;
        if (th) {
          mods = { hpMul: th.hp, dmgMul: th.dmg, speedMul: th.speed };
          if (Math.random() < Descent.eliteChance(floor)) mods.elite = Descent.rollAffix();
        }
        out.push(make(type, x, y, tier, mods));
      }
    }
    return out;
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
      case 'tank': drawTank(c, m, flash, ex, ey); break;
      case 'swarmer': case 'add': drawSwarmer(c, m, flash, ex, ey); break;
      case 'glass': drawGlass(c, m, flash, ex, ey); break;
      case 'shielded': drawShielded(c, m, flash, ex, ey); break;
      case 'bomber': drawBomber(c, m, flash, ex, ey); break;
      case 'summoner': drawSummoner(c, m, flash, ex, ey); break;
      case 'mimic': case 'mimicbaby': drawMimicMonster(c, m, flash, ex, ey); break;
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
