// ============================================================================
// boss.js - THE MIMIC KING (surprise boss, designed 2026-07-10).
// A giant crowned treasure chest: the dungeon's hoard grew teeth.
// Thematically ties to the mimic system - the whole dungeon was baiting you.
//
// FIGHT SCRIPT (all attacks telegraphed, each with a dodge answer):
//   1. Chomp Lunge  - rears back glinting, then lunges at your position: SIDESTEP.
//   2. Coin Barrage - spins up, sprays two radial waves of coins: ROLL THROUGH (i-frames).
//   3. (below 50%) Royal Slam - leaps offscreen, shadow tracks you, lands with
//      expanding shockwave rings + summons 2 baby mimics: TIME YOUR ROLL through rings.
//   Enrage below 25%: everything comes faster.
//
// All numbers below are tunable; the designer (Sam's son) may redesign this boss -
// keep the phase machine intact and swap the attack parameters/visuals.
// ============================================================================
const Boss = (() => {
  const PF = Dungeon.PF;

  const STATS = {
    hp: 520,           // scaled up by meta difficulty if ever needed
    contactDmg: 16,
    lungeDmg: 22,
    coinDmg: 10,
    slamDmg: 24,
    speed: 60,
    r: 34,
  };

  // the King's original gold-and-brown palette; the Descent recolors him via opts
  const KING_PAL = { body: '#6b4726', lidLo: '#59391c', lid: '#7d5530', trim: '#d4af37', crown: '#ffd24c', jewel: [255, 80, 120] };

  // opts.descent = { anger, pal, name, hpMul, dmgMul } for the recurring Circle
  // Warden; omit opts entirely for the floor-3 Gilded King (unchanged).
  function make(opts) {
    const d = opts && opts.descent;
    const pal = d ? d.pal : KING_PAL;
    const hpMul = d ? d.hpMul : 1;
    const dmgMul = d ? d.dmgMul : 1;
    const hp = Math.round(STATS.hp * hpMul);
    const b = {
      type: 'boss', name: d ? d.name : 'THE MIMIC KING',
      x: PF.x + PF.w / 2, y: PF.y + PF.h * 0.35,
      r: STATS.r, hp, maxHp: hp,
      dmg: Math.round(STATS.contactDmg * dmgMul), xp: 120, coins: [30, 45],
      pal, anger: d ? d.anger : 0, dmgMul, isDescentBoss: !!d,
      facing: 0, state: 'idle', t: 0, telegraph: 0,
      contactCd: 0, burn: null, stagger: 0, flash: 0, kvx: 0, kvy: 0,
      dead: false, spawnT: 0, isBoss: true,
      jaw: 4, hop: 0, crownGlint: 0,
      attackQueue: 0, // rotates attacks so it doesn't repeat one forever
      shadowX: 0, shadowY: 0, // slam landing indicator
      update(dt, g) { update(this, dt, g); },
      draw(c, g) { draw(this, c, g); },
      takeHit(dmg, opts, g) { takeHit(this, dmg, opts, g); },
    };
    return b;
  }

  function phase(b) { return b.hp < b.maxHp * 0.25 ? 3 : b.hp < b.maxHp * 0.5 ? 2 : 1; }
  function speedMul(b) { return phase(b) === 3 ? 1.45 : phase(b) === 2 ? 1.15 : 1; }

  function update(b, dt, g) {
    b.t += dt;
    if (b.contactCd > 0) b.contactCd -= dt;
    if (b.flash > 0) b.flash -= dt;
    b.crownGlint += dt;

    // burn ticks (boss is not immune, just beefy)
    if (b.burn) {
      b.burn.t -= dt; b.burn.tick -= dt;
      if (b.burn.tick <= 0) {
        b.burn.tick = 0.5;
        b.hp -= b.burn.dps * 0.5;
        Fx.burst(b.x, b.y - b.r, ['#ff9944', '#ffcc44'], 3, { speed: 40, life: 0.4, glow: true });
        if (b.hp <= 0 && !b.dead) die(b, g);
      }
      if (b.burn.t <= 0) b.burn = null;
    }
    if (b.dead) return;

    const p = g.player;
    const dist = Math.hypot(p.x - b.x, p.y - b.y);
    const sm = speedMul(b);

    switch (b.state) {
      case 'idle': {
        // heavy hops toward the player, contact damage, picks next attack
        b.hop = Math.abs(Math.sin(b.t * 5)) * 10;
        b.jaw = 4 + Math.sin(b.t * 5) * 2;
        moveToward(b, p.x, p.y, dt, STATS.speed * sm);
        if (b.contactCd <= 0 && dist < b.r + p.r + 2) {
          p.damage(Math.round(STATS.contactDmg * b.dmgMul), b.x, b.y, g, b); // src: thorns bite kings too
          b.contactCd = 0.9;
        }
        const wait = phase(b) === 3 ? 1.1 : 1.8;
        if (b.t > wait) {
          b.t = 0;
          const ph = phase(b);
          // attack rotation: lunge, coins, lunge, (slam if phase>=2)
          const cycle = ph >= 2 ? ['lungeTele', 'coinTele', 'slamTele', 'lungeTele', 'coinTele']
                                : ['lungeTele', 'coinTele'];
          b.state = cycle[b.attackQueue % cycle.length];
          b.attackQueue++;
        }
        break;
      }

      // --- ATTACK 1: CHOMP LUNGE (sidestep it) -------------------------------
      case 'lungeTele': {
        // rears back with a bright gold glint - the "I'm about to bite" tell
        b.jaw = 14;
        b.telegraph = 1;
        b.facing = Math.atan2(p.y - b.y, p.x - b.x);
        if (b.t === dt) Sfx.play('mimic');
        if (b.t >= 0.65 / sm) {
          b.state = 'lunge'; b.t = 0; b.telegraph = 0;
          b.lungeAngle = Math.atan2(p.y - b.y, p.x - b.x); // locked at launch: sidestep wins
          Sfx.play('roar');
        }
        break;
      }
      case 'lunge': {
        b.x += Math.cos(b.lungeAngle) * 480 * dt;
        b.y += Math.sin(b.lungeAngle) * 480 * dt;
        b.jaw = 16;
        Fx.burst(b.x, b.y, '#d4af37', 2, { speed: 60, life: 0.3 });
        if (b.contactCd <= 0 && dist < b.r + p.r + 4) {
          p.damage(Math.round(STATS.lungeDmg * b.dmgMul), b.x, b.y, g, b);
          b.contactCd = 0.9;
        }
        if (b.t >= 0.42) { b.state = 'idle'; b.t = 0; }
        break;
      }

      // --- ATTACK 2: COIN BARRAGE (roll through with i-frames) -----------------
      case 'coinTele': {
        b.jaw = 12;
        b.telegraph = 1;
        b.hop = Math.abs(Math.sin(b.t * 20)) * 6; // rattles like a shaken piggy bank
        if (b.t >= 0.6 / sm) { b.state = 'coinFire'; b.t = 0; b.telegraph = 0; b.wave = 0; }
        break;
      }
      case 'coinFire': {
        if ((b.wave === 0 && b.t > 0.05) || (b.wave === 1 && b.t > 0.45 / sm)) {
          const n = 14, offset = b.wave * (Math.PI / n); // second wave fills the gaps
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + offset;
            g.projectiles.push({
              x: b.x + Math.cos(a) * (b.r + 4), y: b.y + Math.sin(a) * (b.r + 4),
              vx: Math.cos(a) * 240, vy: Math.sin(a) * 240,
              r: 6, dmg: Math.round(STATS.coinDmg * b.dmgMul), from: 'enemy', color: b.pal.crown, life: 3, glow: true, spin: true,
            });
          }
          Sfx.play('coin'); Sfx.play('bowfire');
          b.wave++;
        }
        if (b.wave >= 2 && b.t > 0.9 / sm) { b.state = 'idle'; b.t = 0; }
        break;
      }

      // --- ATTACK 3 (phase 2+): ROYAL SLAM + baby mimics ------------------------
      case 'slamTele': {
        // leaps up out of play; a royal shadow tracks the player - get moving.
        // speed is LATCHED at leap start so the ~0.28s frozen-shadow window
        // (the dodge answer) can't collapse if a burn tick shifts the phase mid-air
        if (!b.airborne) b.slamSm = sm;
        b.telegraph = 1;
        b.airborne = true;
        if (b.t < 1.15 / b.slamSm - 0.28) {
          b.shadowX = b.x + (p.x - b.x) * Math.min(1, b.t * 1.6);
          b.shadowY = b.y + (p.y - b.y) * Math.min(1, b.t * 1.6);
        }
        if (b.t >= 1.15 / b.slamSm) {
          b.state = 'slamLand'; b.t = 0; b.telegraph = 0;
          b.x = b.shadowX; b.y = b.shadowY;
          b.airborne = false;
          clamp(b);
          Fx.shake(12, 0.4); Fx.hitstop(0.06); Sfx.play('explode'); Sfx.play('roar');
          Fx.burst(b.x, b.y, ['#d4af37', '#8d6238', '#fff'], 34, { speed: 300, life: 0.6, glow: true });
          b.rings = [0, -55, -110]; // three expanding shockwave rings (negative = delayed)
          // royal guard: summon babies (cap 4 in the room)
          const babies = g.monsters.filter(x => x.type === 'mimicbaby' && !x.dead).length;
          for (let i = 0; i < Math.min(2, 4 - babies); i++) {
            const a = Math.random() * Math.PI * 2;
            const baby = Monsters.make('mimicbaby', b.x + Math.cos(a) * 70, b.y + Math.sin(a) * 70, 2);
            g.monsters.push(baby);
          }
          if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + p.r + 20) p.damage(Math.round(STATS.slamDmg * b.dmgMul), b.x, b.y, g, b);
        }
        break;
      }
      case 'slamLand': {
        // expanding rings: each hits once at its radius band; roll through them
        let allDone = true;
        b.rings = b.rings.map(r0 => r0 + 320 * dt);
        for (const rr of b.rings) {
          if (rr < 0) { allDone = false; continue; }
          if (rr < 260) allDone = false;
          const pd = Math.hypot(p.x - b.x, p.y - b.y);
          if (Math.abs(pd - rr) < 12 && rr > 20) p.damage(Math.round(10 * b.dmgMul), b.x, b.y, g); // player.damage has i-frames built in
        }
        if (allDone || b.t > 1.4) { b.state = 'idle'; b.t = 0; b.rings = null; }
        break;
      }
    }

    clamp(b);
  }

  function moveToward(b, tx, ty, dt, sp) {
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1;
    b.x += (dx / d) * sp * dt; b.y += (dy / d) * sp * dt;
    b.facing = Math.atan2(dy, dx);
  }
  function clamp(b) {
    b.x = Math.max(PF.x + b.r, Math.min(PF.x + PF.w - b.r, b.x));
    b.y = Math.max(PF.y + b.r, Math.min(PF.y + PF.h - b.r, b.y));
  }

  function takeHit(b, dmg, opts, g) {
    if (b.dead || b.airborne) return false; // can't be hit mid-slam-leap
    if (opts.flame) b.burn = { t: 2.5, dps: 3 + opts.flame * 2, tick: 0.4 };
    b.hp -= dmg;
    b.flash = 0.1;
    Fx.text(b.x + (Math.random() * 30 - 15), b.y - b.r - 10, Math.round(dmg), opts.crit ? '#ffd24c' : '#fff', opts.crit ? 16 : 12);
    Fx.burst(b.x, b.y, '#d4af37', 4, { speed: 100, life: 0.3 });
    Sfx.play(opts.crit ? 'crit' : (opts.hitSfx || 'hit'));
    if (opts.flame) Sfx.play('burn');
    if (b.hp <= 0) die(b, g);
    return true; // hit landed (callers use this to gate on-hit rewards)
  }

  function die(b, g) {
    b.dead = true;
    // coin fountain + guaranteed legendary: the hoard was real after all
    Fx.shake(14, 0.6); Fx.hitstop(0.12); Sfx.play('explode'); Sfx.play('roar');
    Fx.burst(b.x, b.y, ['#ffd24c', '#d4af37', '#fff', '#8d6238'], 80, { speed: 380, life: 1.1, glow: true, grav: 200 });
    g.onKill(b);
  }

  // --- rendering: giant crowned chest -------------------------------------------
  function draw(b, c, g) {
    // slam shadow indicator while airborne
    if (b.airborne) {
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.beginPath(); c.ellipse(b.shadowX, b.shadowY, 40, 18, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = `rgba(255,80,80,${0.5 + Math.sin(Date.now() / 50) * 0.3})`;
      c.lineWidth = 3;
      c.beginPath(); c.ellipse(b.shadowX, b.shadowY, 46, 22, 0, 0, Math.PI * 2); c.stroke();
      return; // the king himself is off-screen
    }

    // shockwave rings
    if (b.rings) {
      for (const rr of b.rings) {
        if (rr <= 0) continue;
        c.strokeStyle = `rgba(212,175,55,${Math.max(0, 1 - rr / 260)})`;
        c.lineWidth = 7;
        c.beginPath(); c.arc(b.x, b.y, rr, 0, Math.PI * 2); c.stroke();
      }
    }

    c.save();
    c.translate(b.x, b.y - b.hop);
    const s = b.r / 17; // chest sprite scale factor (mimic sprite at ~2x)
    const flash = b.flash > 0;

    // body (recolored per Descent palette; the King keeps his gold-and-brown)
    c.fillStyle = flash ? '#fff' : b.pal.body;
    c.fillRect(-17 * s, -6 * s, 34 * s, 15 * s);
    c.fillStyle = flash ? '#eee' : b.pal.lidLo;
    c.fillRect(-17 * s, 6 * s, 34 * s, 3 * s);
    // lid (jaw)
    c.save();
    c.translate(0, -6 * s); c.rotate(-b.jaw * 0.045);
    c.fillStyle = flash ? '#eee' : b.pal.lid;
    c.fillRect(-17 * s, -11 * s, 34 * s, 11 * s);
    c.fillStyle = b.pal.trim;
    c.fillRect(-17 * s, -3.5 * s, 34 * s, 3 * s);
    // CROWN - the royal tell
    c.fillStyle = b.pal.crown;
    c.beginPath();
    c.moveTo(-10 * s, -11 * s);
    c.lineTo(-10 * s, -17 * s); c.lineTo(-6 * s, -13 * s);
    c.lineTo(-2 * s, -18 * s); c.lineTo(2 * s, -13 * s);
    c.lineTo(6 * s, -18 * s); c.lineTo(10 * s, -13 * s);
    c.lineTo(10 * s, -11 * s);
    c.closePath(); c.fill();
    // crown jewel glint
    const gl = Math.sin(b.crownGlint * 3) * 0.5 + 0.5;
    const jw = b.pal.jewel;
    c.fillStyle = `rgba(${jw[0]},${jw[1]},${jw[2]},${0.5 + gl * 0.5})`;
    c.beginPath(); c.arc(0, -14 * s, 2 * s, 0, Math.PI * 2); c.fill();
    c.restore();

    // teeth
    c.fillStyle = '#f4ecd8';
    for (let i = -3; i <= 3; i++) {
      c.beginPath();
      c.moveTo(i * 5 * s - 2 * s, -6 * s); c.lineTo(i * 5 * s, 0); c.lineTo(i * 5 * s + 2 * s, -6 * s);
      c.fill();
    }
    // tongue
    c.fillStyle = '#c0392b';
    c.beginPath(); c.ellipse(0, 3 * s, 8 * s, 4 * s, 0, 0, Math.PI); c.fill();
    // treasure spilling out (his hoard, tinted to his palette)
    c.fillStyle = b.pal.trim;
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + b.crownGlint;
      c.beginPath(); c.arc(Math.sin(a) * 12 * s, 8 * s, 2 * s, 0, Math.PI * 2); c.fill();
    }
    // eyes tracking the player - they burn redder the angrier he is
    const p = g.player;
    const ea = Math.atan2(p.y - b.y, p.x - b.x);
    const rage = Math.min(1, b.anger * 0.3); // 0 for the King, rising each Descent meeting
    c.fillStyle = rage > 0 ? `rgb(255,${Math.round(210 - 190 * rage)},${Math.round(76 - 66 * rage)})` : b.pal.crown;
    c.beginPath(); c.arc(-8 * s + Math.cos(ea) * 2, -14 * s + Math.sin(ea) * 2, 3 * s, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(8 * s + Math.cos(ea) * 2, -14 * s + Math.sin(ea) * 2, 3 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a1f14';
    c.beginPath(); c.arc(-8 * s + Math.cos(ea) * 3.4, -14 * s + Math.sin(ea) * 3.4, 1.4 * s, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(8 * s + Math.cos(ea) * 3.4, -14 * s + Math.sin(ea) * 3.4, 1.4 * s, 0, Math.PI * 2); c.fill();
    // ANGRY EYEBROWS - drawn only in the Descent, steeper the angrier he gets
    if (b.anger > 0) {
      c.strokeStyle = '#7a1f14';
      c.lineWidth = 2.2 * s;
      c.lineCap = 'round';
      const drop = (1.5 + rage * 3) * s; // inner ends dive toward the nose
      c.beginPath();
      c.moveTo(-12 * s, (-18 - rage * 1.5) * s); c.lineTo(-4 * s, -16 * s + drop);
      c.moveTo(12 * s, (-18 - rage * 1.5) * s);  c.lineTo(4 * s, -16 * s + drop);
      c.stroke();
      // seething embers rise off the crown
      if (Math.random() < 0.25 + rage * 0.4) {
        Fx.burst(b.x + (Math.random() * 20 - 10), b.y - b.r - 6, ['#ff5a2c', '#ffcc44', b.pal.crown], 1,
          { speed: 20, life: 0.5, glow: true, vy: -40, size: 2 });
      }
    }

    // telegraph glow
    if (b.telegraph) {
      c.strokeStyle = `rgba(255,80,80,${0.4 + Math.sin(Date.now() / 45) * 0.3})`;
      c.lineWidth = 3;
      c.beginPath(); c.arc(0, 0, b.r + 10, 0, Math.PI * 2); c.stroke();
    }
    if (b.burn) {
      c.fillStyle = 'rgba(255,150,50,0.7)';
      for (let i = 0; i < 4; i++) {
        const fx = Math.sin(Date.now() / 90 + i * 1.8) * b.r * 0.6;
        c.beginPath(); c.arc(fx, -b.r - 3 - i * 2, 3, 0, Math.PI * 2); c.fill();
      }
    }
    c.restore();
  }

  return { make, STATS };
})();
