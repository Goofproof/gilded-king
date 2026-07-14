// ============================================================================
// boss.js - THE DUNGEON'S CHAMPIONS. Three distinct boss archetypes share one
// phase machine (25%/50% HP gates, enrage speed) but fight NOTHING alike:
//
//   'king'     THE MIMIC KING  - a crowned treasure chest (floor 3, and the
//              first Descent boss). Chomp lunge / coin barrage / royal slam.
//   'colossus' THE COLOSSUS    - a slow stone brute. Ground-pound shockwave
//              rings / boulder volley (arcing bombs) / phase-2 line CHARGE.
//   'matriarch' THE MATRIARCH  - a ranged venom spider that kites. Venom fan /
//              summons a brood of adds / phase-2 spiral nova of poison shots.
//
// Every attack is telegraphed with a dodge answer (design rule). Deeper Descent
// boss floors rotate the archetype (see descent.bossConfig), so no two Wardens
// fight the same. All numbers are tunable; keep the phase machine intact.
// ============================================================================
const Boss = (() => {
  const PF = Dungeon.PF;

  // per-archetype base stats. hp/dmg get multiplied by depth in the Descent.
  const STATS = {
    king:     { hp: 2200, contactDmg: 16, lungeDmg: 22, coinDmg: 10, slamDmg: 24, speed: 60, r: 34 },
    colossus: { hp: 2600, contactDmg: 20, poundDmg: 22, boulderDmg: 18, chargeDmg: 26, speed: 46, r: 40 },
    matriarch:{ hp: 1900, contactDmg: 14, venomDmg: 11, novaDmg: 13, speed: 70, r: 30 },
  };

  // default palettes. Descent recolors override these via opts.descent.pal.
  // Every palette exposes body/lidLo/lid/trim/crown/jewel so any recolor works
  // on any archetype (draws read the same field names).
  const KING_PAL     = { body: '#6b4726', lidLo: '#59391c', lid: '#7d5530', trim: '#d4af37', crown: '#ffd24c', jewel: [255, 80, 120] };
  const COLOSSUS_PAL = { body: '#5b616b', lidLo: '#3c424b', lid: '#6d747f', trim: '#8fb7ff', crown: '#bcd8ff', jewel: [120, 200, 255] };
  const MATRIARCH_PAL= { body: '#3d2450', lidLo: '#281634', lid: '#4e2f66', trim: '#5cff8a', crown: '#9bff6a', jewel: [180, 255, 90] };
  const DEFAULT_PAL = { king: KING_PAL, colossus: COLOSSUS_PAL, matriarch: MATRIARCH_PAL };

  // opts.descent = { anger, pal, name, hpMul, dmgMul, variant } for the recurring
  // Wardens; omit opts entirely for the floor-3 Gilded King (unchanged).
  function make(opts) {
    const d = opts && opts.descent;
    const variant = (opts && opts.variant) || (d && d.variant) || 'king';
    const st = STATS[variant] || STATS.king;
    const pal = d && d.pal ? d.pal : DEFAULT_PAL[variant];
    const hpMul = d ? d.hpMul : 1;
    const dmgMul = d ? d.dmgMul : 1;
    const hp = Math.round(st.hp * hpMul);
    const b = {
      type: 'boss', variant,
      name: d ? d.name : 'THE MIMIC KING',
      x: PF.x + PF.w / 2, y: PF.y + PF.h * 0.35,
      r: st.r, hp, maxHp: hp, st,
      dmg: Math.round(st.contactDmg * dmgMul), xp: 120, coins: [30, 45],
      pal, anger: d ? d.anger : 0, dmgMul, isDescentBoss: !!d,
      facing: 0, state: 'idle', t: 0, telegraph: 0,
      contactCd: 0, burn: null, stagger: 0, flash: 0, kvx: 0, kvy: 0,
      dead: false, spawnT: 0, isBoss: true,
      jaw: 4, hop: 0, crownGlint: 0,
      attackQueue: 0, // rotates attacks so it doesn't repeat one forever
      // #156 (Sam) each Hell guardian has a signature ULTIMATE, cast right at the start of
      // the fight and every 5s after, ON TOP of its normal attacks. ultKind comes from the
      // circle's config (descent.js); non-Hell bosses have none.
      ultKind: d ? d.ult : null, ultCd: 0.35,
      shadowX: 0, shadowY: 0, // slam landing indicator
      volley: 0, wobble: 0,   // colossus boulder count / matriarch leg animation
      update(dt, g) { update(this, dt, g); },
      draw(c, g) { draw(this, c, g); },
      takeHit(dmg, opts, g) { takeHit(this, dmg, opts, g); },
    };
    return b;
  }

  function phase(b) { return b.hp < b.maxHp * 0.25 ? 3 : b.hp < b.maxHp * 0.5 ? 2 : 1; }
  function speedMul(b) { return phase(b) === 3 ? 1.45 : phase(b) === 2 ? 1.15 : 1; }

  // which attacks each archetype cycles through, by phase (>=2 unlocks the big one)
  function attackCycle(b) {
    const ph = phase(b);
    if (b.variant === 'colossus') {
      return ph >= 2 ? ['poundTele', 'boulderTele', 'chargeTele', 'boulderTele']
                     : ['poundTele', 'boulderTele'];
    }
    if (b.variant === 'matriarch') {
      return ph >= 2 ? ['fanTele', 'novaTele', 'broodTele', 'fanTele']
                     : ['fanTele', 'broodTele'];
    }
    return ph >= 2 ? ['lungeTele', 'coinTele', 'slamTele', 'lungeTele', 'coinTele']
                   : ['lungeTele', 'coinTele'];
  }

  // #156 (Sam) SIGNATURE ULTIMATES - one per Hell guardian, each a distinct, dodgeable
  // projectile pattern in the circle's colour. Fired on a 5s clock ON TOP of the normal
  // attacks, so a boss fight is never idle. All spawn 'enemy' bolts into g.projectiles
  // exactly like the coin barrage, so nothing new is wired outside this file.
  const ULT_NAME = {
    crossing: 'THE CROSSING', judgment: 'JUDGMENT', triplebite: 'THREE JAWS', goldstorm: 'THE HOARD',
    wrath: 'WRATH', gaze: 'THE GAZE', gore: 'THE CHARGE', deceit: 'DECEIT', cocytus: 'COCYTUS',
  };
  function bolt(g, x, y, ang, speed, dmg, color, o) {
    o = o || {};
    g.projectiles.push({
      x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      r: o.r || 6, dmg, from: 'enemy', color, life: o.life || 3.4, glow: o.glow !== false, spin: o.spin,
    });
  }
  function castUlt(b, g) {
    const p = g.player;
    const dmg = Math.max(6, Math.round((b.st.contactDmg || 16) * b.dmgMul * 0.9));
    const col = b.pal.crown, toP = Math.atan2(p.y - b.y, p.x - b.x);
    const ox = b.x + Math.cos(toP) * (b.r + 6), oy = b.y + Math.sin(toP) * (b.r + 6);
    const ring = (n, speed, off, o) => { for (let i = 0; i < n; i++) bolt(g, b.x + Math.cos(i / n * 6.283) * (b.r + 6), b.y + Math.sin(i / n * 6.283) * (b.r + 6), (i / n) * 6.283 + (off || 0), speed, dmg, col, o); };
    // universal ULTIMATE tell so the player reads it coming
    Fx.shake(7, 0.4); Sfx.play('roar');
    Fx.text(b.x, b.y - b.r - 22, ULT_NAME[b.ultKind] || 'ULTIMATE', b.pal.trim, 15);
    Fx.burst(b.x, b.y, [b.pal.trim, col, '#fff'], 26, { speed: 210, life: 0.5, glow: true });
    switch (b.ultKind) {
      case 'triplebite': // Cerberus: three fanned bites at you
        for (let h = -1; h <= 1; h++) { const base = toP + h * 0.5; for (let i = -2; i <= 2; i++) bolt(g, ox, oy, base + i * 0.12, 300, dmg, col); }
        break;
      case 'goldstorm': // Plutus: two full rings of cursed coin
        ring(18, 200, 0, { spin: true }); ring(18, 260, Math.PI / 18, { spin: true });
        break;
      case 'judgment': // Minos: a rotating spiral, offset by his coil
        for (let i = 0; i < 28; i++) bolt(g, ox, oy, (i / 28) * 6.283 + b.t * 3, 230, dmg, col);
        break;
      case 'gaze': // Medusa: a dense radial stare, alternating speeds
        for (let i = 0; i < 32; i++) bolt(g, b.x, b.y, (i / 32) * 6.283, 170 + (i % 2) * 90, dmg, col, { r: 7 });
        break;
      case 'gore': // the Minotaur: a wide, fast goring cone
        for (let i = -4; i <= 4; i++) bolt(g, ox, oy, toP + i * 0.14, 430, dmg, col, { r: 7 });
        break;
      case 'deceit': // Geryon: an erratic spread, no two bolts the same speed
        for (let i = -5; i <= 5; i++) bolt(g, ox, oy, toP + i * 0.16, 190 + ((i * 53) % 3 + 3) % 3 * 120, dmg, col);
        break;
      case 'wrath': // Phlegyas: a fast, dense ring of temple-fire
        ring(24, 300, 0, { r: 7, life: 2.9 });
        break;
      case 'crossing': { // Charon: a wall of slow bolts sweeping down, one gap to slip through
        const cols = 12, gap = 2 + (b.attackQueue % (cols - 4));
        for (let i = 0; i < cols; i++) { if (i === gap || i === gap + 1) continue; const x = PF.x + 30 + i * ((PF.w - 60) / (cols - 1)); bolt(g, x, PF.y + 18, Math.PI / 2, 150, dmg, col, { r: 8, life: 4.2 }); }
        break; }
      case 'cocytus': // Lucifer: a colossal double ring, the frozen blast at the bottom of Hell
        ring(26, 210, 0, { r: 8, spin: true }); ring(26, 285, Math.PI / 26, { r: 8, spin: true });
        Fx.shake(12, 0.6);
        break;
    }
  }

  function update(b, dt, g) {
    b.t += dt;
    if (b.contactCd > 0) b.contactCd -= dt;
    if (b.flash > 0) b.flash -= dt;
    b.crownGlint += dt;
    b.wobble += dt;

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

    // #156 the signature ULTIMATE: fires ~immediately on the first update (fight start),
    // then every 5s, independent of the normal attack state machine.
    if (b.ultKind && b.spawnT <= 0) {
      b.ultCd -= dt;
      if (b.ultCd <= 0) { castUlt(b, g); b.ultCd = 5; }
    }

    const p = g.player;
    const dist = Math.hypot(p.x - b.x, p.y - b.y);
    const sm = speedMul(b);

    switch (b.state) {
      case 'idle': {
        idleMove(b, p, dt, sm, g);
        if (b.contactCd <= 0 && dist < b.r + p.r + 2) {
          p.damage(Math.round(b.st.contactDmg * b.dmgMul), b.x, b.y, g, b); // src: thorns bite bosses too
          b.contactCd = 0.9;
        }
        const wait = phase(b) === 3 ? 1.1 : 1.8;
        if (b.t > wait) {
          b.t = 0;
          const cycle = attackCycle(b);
          b.state = cycle[b.attackQueue % cycle.length];
          b.attackQueue++;
        }
        break;
      }

      // ======================= MIMIC KING ===================================
      // --- ATTACK 1: CHOMP LUNGE (sidestep it) -------------------------------
      case 'lungeTele': {
        b.jaw = 14; b.telegraph = 1;
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
          p.damage(Math.round(b.st.lungeDmg * b.dmgMul), b.x, b.y, g, b);
          b.contactCd = 0.9;
        }
        if (b.t >= 0.42) { b.state = 'idle'; b.t = 0; }
        break;
      }
      // --- ATTACK 2: COIN BARRAGE (roll through with i-frames) -----------------
      case 'coinTele': {
        b.jaw = 12; b.telegraph = 1;
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
              r: 6, dmg: Math.round(b.st.coinDmg * b.dmgMul), from: 'enemy', color: b.pal.crown, life: 3, glow: true, spin: true,
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
        if (!b.airborne) b.slamSm = sm;
        b.telegraph = 1; b.airborne = true;
        if (b.t < 1.15 / b.slamSm - 0.28) {
          b.shadowX = b.x + (p.x - b.x) * Math.min(1, b.t * 1.6);
          b.shadowY = b.y + (p.y - b.y) * Math.min(1, b.t * 1.6);
        }
        if (b.t >= 1.15 / b.slamSm) {
          b.state = 'slamLand'; b.t = 0; b.telegraph = 0;
          b.x = b.shadowX; b.y = b.shadowY; b.airborne = false;
          clamp(b);
          Fx.shake(12, 0.4); Fx.hitstop(0.06); Sfx.play('explode'); Sfx.play('roar');
          Fx.burst(b.x, b.y, ['#d4af37', '#8d6238', '#fff'], 34, { speed: 300, life: 0.6, glow: true });
          b.rings = [0, -55, -110];
          const babies = g.monsters.filter(x => x.type === 'mimicbaby' && !x.dead).length;
          for (let i = 0; i < Math.min(2, 4 - babies); i++) {
            const a = Math.random() * Math.PI * 2;
            g.monsters.push(Monsters.make('mimicbaby', b.x + Math.cos(a) * 70, b.y + Math.sin(a) * 70, 2));
          }
          if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + p.r + 20) p.damage(Math.round(b.st.slamDmg * b.dmgMul), b.x, b.y, g, b);
        }
        break;
      }
      case 'slamLand': { ringStep(b, p, dt, g, Math.round(10 * b.dmgMul)); break; }

      // ======================= COLOSSUS =====================================
      // --- GROUND POUND: raises both fists, slams, three shockwave rings -------
      case 'poundTele': {
        b.telegraph = 1;
        b.hop = Math.max(0, 18 - b.t * 22); // rears up then holds
        if (b.t >= 0.85 / sm) {
          b.state = 'pound'; b.t = 0; b.telegraph = 0;
          Fx.shake(13, 0.4); Fx.hitstop(0.06); Sfx.play('explode');
          Fx.burst(b.x, b.y, [b.pal.trim, '#fff', b.pal.lidLo], 30, { speed: 260, life: 0.55, glow: true });
          b.rings = [0, -60, -120];
          if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + p.r + 18) p.damage(Math.round(b.st.poundDmg * b.dmgMul), b.x, b.y, g, b);
        }
        break;
      }
      case 'pound': { ringStep(b, p, dt, g, Math.round(b.st.poundDmg * 0.5 * b.dmgMul)); break; }

      // --- BOULDER VOLLEY: lobs 3 arcing rocks at where you stand -------------
      case 'boulderTele': {
        b.telegraph = 1; b.wobble += dt * 3;
        if (b.t >= 0.55 / sm) { b.state = 'boulder'; b.t = 0; b.telegraph = 0; b.volley = 0; b.nextLob = 0; }
        break;
      }
      case 'boulder': {
        if (b.volley < 3 && b.t >= b.nextLob) {
          b.nextLob = b.t + 0.32;
          b.volley++;
          Sfx.play('bowfire');
          g.ultFx.push({
            type: 'lob', sx: b.x, sy: b.y - 20,
            x: p.x + (Math.random() * 40 - 20), y: p.y + (Math.random() * 40 - 20),
            t: 0, delay: 0.9, dmg: Math.round(b.st.boulderDmg * b.dmgMul), radius: 48,
          });
        }
        if (b.volley >= 3 && b.t > 0.5) { b.state = 'idle'; b.t = 0; }
        break;
      }

      // --- CHARGE (phase 2+): telegraphs a line, then dashes across the room ---
      case 'chargeTele': {
        b.telegraph = 1;
        b.facing = Math.atan2(p.y - b.y, p.x - b.x);
        if (b.t >= 0.7 / sm) {
          b.state = 'charge'; b.t = 0; b.telegraph = 0;
          b.chargeAngle = Math.atan2(p.y - b.y, p.x - b.x); // locked: dodge perpendicular
          Sfx.play('roar'); Fx.shake(5, 0.2);
        }
        break;
      }
      case 'charge': {
        b.x += Math.cos(b.chargeAngle) * 560 * dt;
        b.y += Math.sin(b.chargeAngle) * 560 * dt;
        Fx.burst(b.x, b.y + b.r * 0.5, [b.pal.lidLo, '#8a8a8a'], 2, { speed: 50, life: 0.4 });
        if (b.contactCd <= 0 && dist < b.r + p.r + 6) {
          p.damage(Math.round(b.st.chargeDmg * b.dmgMul), b.x, b.y, g, b);
          b.contactCd = 0.9;
        }
        // stop at a wall or after the dash duration
        const atWall = b.x <= PF.x + b.r || b.x >= PF.x + PF.w - b.r || b.y <= PF.y + b.r || b.y >= PF.y + PF.h - b.r;
        if (b.t >= 0.6 || atWall) {
          if (atWall) { Fx.shake(9, 0.3); Sfx.play('explode'); }
          b.state = 'idle'; b.t = 0;
        }
        clamp(b);
        break;
      }

      // ======================= MATRIARCH ====================================
      // --- VENOM FAN: two spread volleys of poison bolts toward you -----------
      case 'fanTele': {
        b.telegraph = 1;
        b.facing = Math.atan2(p.y - b.y, p.x - b.x);
        if (b.t >= 0.5 / sm) { b.state = 'fan'; b.t = 0; b.telegraph = 0; b.wave = 0; }
        break;
      }
      case 'fan': {
        if ((b.wave === 0 && b.t > 0.02) || (b.wave === 1 && b.t > 0.35 / sm)) {
          const base = Math.atan2(p.y - b.y, p.x - b.x);
          const n = 5, spread = 0.68;
          for (let i = 0; i < n; i++) {
            const a = base + (i / (n - 1) - 0.5) * spread;
            g.projectiles.push({
              x: b.x + Math.cos(a) * (b.r + 4), y: b.y + Math.sin(a) * (b.r + 4),
              vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
              r: 6, dmg: Math.round(b.st.venomDmg * b.dmgMul), from: 'enemy', color: b.pal.crown, life: 3, glow: true,
            });
          }
          Sfx.play('bowfire');
          b.wave++;
        }
        if (b.wave >= 2 && b.t > 0.6 / sm) { b.state = 'idle'; b.t = 0; }
        break;
      }

      // --- BROOD: hatches a cluster of skittering adds around her ------------
      case 'broodTele': {
        b.telegraph = 1;
        b.hop = Math.abs(Math.sin(b.t * 16)) * 5; // clutches, abdomen pulsing
        if (b.t >= 0.7 / sm) {
          b.state = 'idle'; b.t = 0; b.telegraph = 0;
          Sfx.play('mimic');
          const adds = g.monsters.filter(x => (x.type === 'swarmer' || x.type === 'add') && !x.dead).length;
          const room = Math.max(0, 6 - adds);
          const spawnN = Math.min(3, room);
          for (let i = 0; i < spawnN; i++) {
            const a = Math.random() * Math.PI * 2, rr = b.r + 24 + Math.random() * 20;
            const add = Monsters.make('swarmer', b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr, Math.min(4, 2 + (phase(b) - 1)));
            g.monsters.push(add);
            Fx.burst(add.x, add.y, [b.pal.trim, b.pal.crown], 8, { speed: 120, life: 0.4, glow: true });
          }
        }
        break;
      }

      // --- SPIRAL NOVA (phase 2+): a rotating spray of venom, walk the gaps ---
      case 'novaTele': {
        b.telegraph = 1;
        b.hop = Math.abs(Math.sin(b.t * 22)) * 6;
        if (b.t >= 0.7 / sm) { b.state = 'nova'; b.t = 0; b.telegraph = 0; b.spiral = 0; b.nextArm = 0; }
        break;
      }
      case 'nova': {
        if (b.spiral < 10 && b.t >= b.nextArm) {
          b.nextArm = b.t + 0.09;
          const arms = 3;
          const base = b.spiral * 0.55; // rotates each pulse -> spiral pattern
          for (let i = 0; i < arms; i++) {
            const a = base + (i / arms) * Math.PI * 2;
            g.projectiles.push({
              x: b.x + Math.cos(a) * (b.r + 4), y: b.y + Math.sin(a) * (b.r + 4),
              vx: Math.cos(a) * 210, vy: Math.sin(a) * 210,
              r: 6, dmg: Math.round(b.st.novaDmg * b.dmgMul), from: 'enemy', color: b.pal.crown, life: 3.2, glow: true,
            });
          }
          if (b.spiral % 3 === 0) Sfx.play('coin');
          b.spiral++;
        }
        if (b.spiral >= 10 && b.t > 0.5) { b.state = 'idle'; b.t = 0; }
        break;
      }
    }

    clamp(b);
  }

  // --- shared movement per-archetype idle -------------------------------------
  function idleMove(b, p, dt, sm, g) {
    if (b.variant === 'matriarch') {
      // kites: holds a mid-range gap, sidling around the player
      const d = Math.hypot(p.x - b.x, p.y - b.y) || 1;
      const want = 230;
      const ang = Math.atan2(p.y - b.y, p.x - b.x);
      const strafe = ang + Math.PI / 2;
      let vx = 0, vy = 0;
      if (d < want - 30) { vx -= Math.cos(ang); vy -= Math.sin(ang); }      // too close: back off
      else if (d > want + 60) { vx += Math.cos(ang); vy += Math.sin(ang); } // too far: close in
      vx += Math.cos(strafe) * 0.6; vy += Math.sin(strafe) * 0.6;           // constant circling
      const m = Math.hypot(vx, vy) || 1;
      b.x += (vx / m) * b.st.speed * sm * dt;
      b.y += (vy / m) * b.st.speed * sm * dt;
      b.facing = ang;
      b.wobble += dt * 4;
      return;
    }
    // king + colossus: heavy hops straight at the player
    b.hop = Math.abs(Math.sin(b.t * (b.variant === 'colossus' ? 3.5 : 5))) * (b.variant === 'colossus' ? 7 : 10);
    b.jaw = 4 + Math.sin(b.t * 5) * 2;
    moveToward(b, p.x, p.y, dt, b.st.speed * sm);
  }

  // expanding shockwave rings (King slam + Colossus pound share this)
  function ringStep(b, p, dt, g, ringDmg) {
    if (!b.rings) { b.state = 'idle'; b.t = 0; return; }
    let allDone = true;
    b.rings = b.rings.map(r0 => r0 + 320 * dt);
    for (const rr of b.rings) {
      if (rr < 0) { allDone = false; continue; }
      if (rr < 260) allDone = false;
      const pd = Math.hypot(p.x - b.x, p.y - b.y);
      if (Math.abs(pd - rr) < 12 && rr > 20) p.damage(ringDmg, b.x, b.y, g); // player.damage has i-frames
    }
    if (allDone || b.t > 1.4) { b.state = 'idle'; b.t = 0; b.rings = null; }
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
    if (typeof Ach !== 'undefined') Ach.hit(dmg, !!opts.crit, g); // #86 biggest hit / crit
    b.hp -= dmg;
    b.flash = 0.1;
    Fx.text(b.x + (Math.random() * 30 - 15), b.y - b.r - 10, Math.round(dmg), opts.crit ? '#ffd24c' : '#fff', opts.crit ? 16 : 12);
    Fx.burst(b.x, b.y, b.pal.trim, 4, { speed: 100, life: 0.3 });
    Sfx.play(opts.crit ? 'crit' : (opts.hitSfx || 'hit'));
    if (opts.flame) Sfx.play('burn');
    if (b.hp <= 0) die(b, g);
    return true; // hit landed (callers use this to gate on-hit rewards)
  }

  function die(b, g) {
    b.dead = true;
    Fx.shake(14, 0.6); Fx.hitstop(0.12); Sfx.play('explode'); Sfx.play('roar');
    const jw = b.pal.jewel;
    Fx.burst(b.x, b.y, [b.pal.crown, b.pal.trim, '#fff', `rgb(${jw[0]},${jw[1]},${jw[2]})`], 80, { speed: 380, life: 1.1, glow: true, grav: 200 });
    g.onKill(b);
  }

  // ============================================================================
  // RENDERING - dispatch to the archetype's own sprite. Shared bits (airborne
  // shadow, shockwave rings, telegraph glow, burn flames) wrap the body.
  function draw(b, c, g) {
    // slam shadow indicator while airborne (King only)
    if (b.airborne) {
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.beginPath(); c.ellipse(b.shadowX, b.shadowY, 40, 18, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = `rgba(255,80,80,${0.5 + Math.sin(Date.now() / 50) * 0.3})`;
      c.lineWidth = 3;
      c.beginPath(); c.ellipse(b.shadowX, b.shadowY, 46, 22, 0, 0, Math.PI * 2); c.stroke();
      return;
    }
    // shockwave rings (king slam / colossus pound), tinted to the boss
    if (b.rings) {
      const rc = b.pal.trim;
      for (const rr of b.rings) {
        if (rr <= 0) continue;
        c.strokeStyle = hexA(rc, Math.max(0, 1 - rr / 260));
        c.lineWidth = 7;
        c.beginPath(); c.arc(b.x, b.y, rr, 0, Math.PI * 2); c.stroke();
      }
    }

    c.save();
    c.translate(b.x, b.y - b.hop);
    if (b.variant === 'colossus') drawColossus(b, c, g);
    else if (b.variant === 'matriarch') drawMatriarch(b, c, g);
    else drawKing(b, c, g);

    // telegraph glow (shared)
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

  // rgba() from a #rrggbb hex + alpha
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // --- MIMIC KING: giant crowned chest -----------------------------------------
  function drawKing(b, c, g) {
    const s = b.r / 17;
    const flash = b.flash > 0;
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
    // CROWN
    c.fillStyle = b.pal.crown;
    c.beginPath();
    c.moveTo(-10 * s, -11 * s);
    c.lineTo(-10 * s, -17 * s); c.lineTo(-6 * s, -13 * s);
    c.lineTo(-2 * s, -18 * s); c.lineTo(2 * s, -13 * s);
    c.lineTo(6 * s, -18 * s); c.lineTo(10 * s, -13 * s);
    c.lineTo(10 * s, -11 * s);
    c.closePath(); c.fill();
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
    c.fillStyle = '#c0392b';
    c.beginPath(); c.ellipse(0, 3 * s, 8 * s, 4 * s, 0, 0, Math.PI); c.fill();
    c.fillStyle = b.pal.trim;
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + b.crownGlint;
      c.beginPath(); c.arc(Math.sin(a) * 12 * s, 8 * s, 2 * s, 0, Math.PI * 2); c.fill();
    }
    drawTrackingEyes(b, c, g, -8 * s, -14 * s, 8 * s, -14 * s, 3 * s);
  }

  // --- COLOSSUS: hulking stone golem with glowing cracks -----------------------
  function drawColossus(b, c, g) {
    const s = b.r / 20;
    const flash = b.flash > 0;
    const body = flash ? '#fff' : b.pal.body;
    const dark = flash ? '#ddd' : b.pal.lidLo;
    const glow = b.pal.trim;
    const pulse = 0.55 + 0.45 * Math.sin(b.crownGlint * 2.4);
    // legs / base
    c.fillStyle = dark;
    c.fillRect(-15 * s, 10 * s, 10 * s, 12 * s);
    c.fillRect(5 * s, 10 * s, 10 * s, 12 * s);
    // torso (blocky hexagon)
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(-16 * s, -8 * s); c.lineTo(-20 * s, 6 * s); c.lineTo(-12 * s, 14 * s);
    c.lineTo(12 * s, 14 * s); c.lineTo(20 * s, 6 * s); c.lineTo(16 * s, -8 * s);
    c.closePath(); c.fill();
    // shoulders (big pauldron slabs)
    c.fillStyle = dark;
    c.fillRect(-26 * s, -10 * s, 10 * s, 12 * s);
    c.fillRect(16 * s, -10 * s, 10 * s, 12 * s);
    // arms as fists resting low
    c.fillStyle = body;
    c.beginPath(); c.arc(-22 * s, 8 * s, 6 * s, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(22 * s, 8 * s, 6 * s, 0, Math.PI * 2); c.fill();
    // glowing cracks across the chest
    c.strokeStyle = hexA(glow, 0.4 + 0.5 * pulse);
    c.lineWidth = 2.2 * s;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-8 * s, -6 * s); c.lineTo(-2 * s, 2 * s); c.lineTo(-6 * s, 10 * s);
    c.moveTo(6 * s, -4 * s); c.lineTo(2 * s, 3 * s); c.lineTo(8 * s, 9 * s);
    c.stroke();
    // molten core
    c.fillStyle = hexA(b.pal.crown, 0.35 + 0.4 * pulse);
    c.beginPath(); c.arc(0, 2 * s, 4 * s, 0, Math.PI * 2); c.fill();
    // small blocky head
    c.fillStyle = body;
    c.fillRect(-8 * s, -20 * s, 16 * s, 12 * s);
    drawTrackingEyes(b, c, g, -4 * s, -14 * s, 4 * s, -14 * s, 2.4 * s);
    // rune band on the brow
    c.strokeStyle = hexA(glow, 0.5 + 0.4 * pulse); c.lineWidth = 1.6 * s;
    c.beginPath(); c.moveTo(-7 * s, -18 * s); c.lineTo(7 * s, -18 * s); c.stroke();
  }

  // --- MATRIARCH: bulbous venom spider ----------------------------------------
  function drawMatriarch(b, c, g) {
    const s = b.r / 15;
    const flash = b.flash > 0;
    const body = flash ? '#fff' : b.pal.body;
    const belly = flash ? '#eee' : b.pal.lid;
    const legc = b.pal.trim;
    const pulse = 0.5 + 0.5 * Math.sin(b.crownGlint * 3);
    // eight legs, animated skitter
    c.strokeStyle = legc; c.lineWidth = 2.4 * s; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const bend = Math.sin(b.wobble * 2 + i) * 0.25;
      for (const side of [-1, 1]) {
        const baseA = side * (0.5 + i * 0.34);
        const kx = Math.cos(baseA + bend) * 22 * s, ky = Math.sin(baseA + bend) * 12 * s + 2 * s;
        const fx = Math.cos(baseA + bend) * 34 * s, fy = Math.sin(baseA + bend) * 20 * s + 6 * s;
        c.beginPath();
        c.moveTo(side * 4 * s, 0); c.lineTo(kx, ky - 6 * s); c.lineTo(fx, fy);
        c.stroke();
      }
    }
    // abdomen (big teardrop) with venom sac glow
    c.fillStyle = body;
    c.beginPath(); c.ellipse(0, 6 * s, 15 * s, 17 * s, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = hexA(b.pal.crown, 0.3 + 0.4 * pulse);
    c.beginPath(); c.ellipse(0, 9 * s, 7 * s, 9 * s, 0, 0, Math.PI * 2); c.fill();
    // hourglass mark
    c.fillStyle = belly;
    c.beginPath();
    c.moveTo(-4 * s, 2 * s); c.lineTo(4 * s, 2 * s); c.lineTo(-3 * s, 12 * s); c.lineTo(3 * s, 12 * s);
    c.closePath(); c.fill();
    // cephalothorax (front body)
    c.fillStyle = belly;
    c.beginPath(); c.ellipse(0, -8 * s, 10 * s, 9 * s, 0, 0, Math.PI * 2); c.fill();
    // fangs
    c.fillStyle = legc;
    c.beginPath(); c.moveTo(-3 * s, -3 * s); c.lineTo(-1 * s, 3 * s); c.lineTo(-4 * s, -1 * s); c.fill();
    c.beginPath(); c.moveTo(3 * s, -3 * s); c.lineTo(1 * s, 3 * s); c.lineTo(4 * s, -1 * s); c.fill();
    // cluster of eyes (four small + two tracking)
    const jw = b.pal.jewel;
    c.fillStyle = `rgb(${jw[0]},${jw[1]},${jw[2]})`;
    for (const [ex, ey] of [[-5, -12], [-2, -13], [2, -13], [5, -12]]) {
      c.beginPath(); c.arc(ex * s, ey * s, 1.4 * s, 0, Math.PI * 2); c.fill();
    }
    drawTrackingEyes(b, c, g, -4 * s, -9 * s, 4 * s, -9 * s, 2.6 * s);
  }

  // two eyes that track the player; reddening with anger (shared by all bosses)
  function drawTrackingEyes(b, c, g, lx, ly, rx, ry, r) {
    const p = g.player;
    const ea = Math.atan2(p.y - b.y, p.x - b.x);
    const rage = Math.min(1, b.anger * 0.3);
    const jw = b.pal.jewel;
    c.fillStyle = rage > 0
      ? `rgb(255,${Math.round(210 - 190 * rage)},${Math.round(76 - 66 * rage)})`
      : `rgb(${jw[0]},${jw[1]},${jw[2]})`;
    c.beginPath(); c.arc(lx + Math.cos(ea) * 2, ly + Math.sin(ea) * 2, r, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(rx + Math.cos(ea) * 2, ry + Math.sin(ea) * 2, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a1f14';
    c.beginPath(); c.arc(lx + Math.cos(ea) * (r * 0.5 + 1), ly + Math.sin(ea) * (r * 0.5 + 1), r * 0.47, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(rx + Math.cos(ea) * (r * 0.5 + 1), ry + Math.sin(ea) * (r * 0.5 + 1), r * 0.47, 0, Math.PI * 2); c.fill();
    // angry brows in the Descent
    if (b.anger > 0) {
      c.strokeStyle = '#7a1f14'; c.lineWidth = 2; c.lineCap = 'round';
      const drop = 1.5 + rage * 3;
      c.beginPath();
      c.moveTo(lx - 4, ly - 5 - rage * 1.5); c.lineTo(lx + 3, ly - 3 + drop);
      c.moveTo(rx + 4, ry - 5 - rage * 1.5); c.lineTo(rx - 3, ry - 3 + drop);
      c.stroke();
      if (Math.random() < 0.2 + rage * 0.35) {
        Fx.burst(b.x + (Math.random() * 20 - 10), b.y - b.r - 6, ['#ff5a2c', '#ffcc44', b.pal.crown], 1,
          { speed: 20, life: 0.5, glow: true, vy: -40, size: 2 });
      }
    }
  }

  return { make, STATS };
})();
