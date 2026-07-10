// ============================================================================
// player.js - movement, the dodge roll (headline mechanic!), weapons, leveling.
// ============================================================================
const PlayerDef = (() => {
  const PF = Dungeon.PF;

  // --- PLAYER TUNING ----------------------------------------------------------
  const T = {
    speed: 205,
    maxHp: 100,
    rollSpeed: 430,
    rollDur: 0.26,
    rollCooldown: 0.85,     // headline mechanic: 0.5-1s per the design doc
    rollIframes: 0.30,      // slightly longer than the roll itself (forgiving)
    hurtIframes: 0.7,       // grace period after taking a hit
    critBase: 0.05,
    critMult: 1.7,
  };

  class Player {
    constructor(meta) {
      this.x = PF.x + PF.w / 2; this.y = PF.y + PF.h / 2;
      this.r = 13;
      // meta-progression boosts (from the hub) fold into starting stats
      const mHp = (meta?.ranks?.vitality || 0) * 10;
      this.maxHp = T.maxHp + mHp;
      this.hp = this.maxHp;
      this.coins = 0; this.essenceRun = 0;
      this.xp = 0; this.level = 1;
      this.kills = 0; this.roomsCleared = 0;

      // stat multipliers - passive upgrades stack into these
      this.stats = {
        dmgMul: 1 + (meta?.ranks?.might || 0) * 0.05,
        speedMul: 1,
        rollCdMul: 1 - (meta?.ranks?.acrobat || 0) * 0.08,
        crit: 0,
        coinMul: 1 + (meta?.ranks?.greed || 0) * 0.10,
        regen: 0,
        atkSpeedMul: 1,
      };

      // weapon slots: one melee + one bow. Tab / wheel / right-click to swap.
      // always start with exactly a Common light melee (Uncommon with the Armory unlock)
      const startRarity = meta?.ranks?.armory ? 1 : 0;
      this.weapons = {
        melee: Weapons.rollWeapon(1, { archetype: 'light', exactRarity: startRarity }),
        bow: null,
      };
      this.slot = 'melee';

      this.vx = 0; this.vy = 0;
      this.facing = 0;           // aim angle (mouse)
      this.moveAngle = 0;        // last movement direction (roll uses this)
      this.moving = false;

      this.rollT = -1;           // >=0 while rolling
      this.rollCd = 0;
      this.iframes = 0;
      this.ghostTimer = 0;

      this.attackCd = 0;
      this.swing = null;         // {t,dur,windup,fired,arc,range,dir}
      this.drawT = -1;           // bow draw time (>=0 while drawing)
      this.momentumT = 0;        // ORIGINAL enchant: speed burst after kills
      this.flash = 0;
      this.dead = false;
    }

    get weapon() { return this.weapons[this.slot] || this.weapons.melee; }

    xpToNext() { return 18 + (this.level - 1) * 14; } // leveling curve

    addXp(n, g) {
      this.xp += n;
      while (this.xp >= this.xpToNext()) {
        this.xp -= this.xpToNext();
        this.level++;
        this.hp = Math.min(this.maxHp, this.hp + 15); // level-up heals a chunk
        Sfx.play('levelup');
        Fx.burst(this.x, this.y, ['#ffd24c', '#7fd4ff', '#fff'], 24, { speed: 200, life: 0.8, glow: true });
        g.queueLevelUp();
      }
    }

    swapWeapon() {
      if (this.weapons.bow && this.weapons.melee) {
        this.slot = this.slot === 'melee' ? 'bow' : 'melee';
        this.drawT = -1;
        Sfx.play('ui');
      }
    }

    // picking up a weapon replaces the one in its slot; old one drops behind you
    pickupWeapon(w, g) {
      const slot = w.archetype === 'bow' ? 'bow' : 'melee';
      const old = this.weapons[slot];
      this.weapons[slot] = w;
      this.slot = slot;
      if (old) g.dropWeaponPickup(old, this.x, this.y + 30);
      Sfx.play('pickup');
      Fx.text(this.x, this.y - 26, Weapons.displayName(w), w.color, 12);
    }

    damage(dmg, sx, sy, g) {
      if (this.iframes > 0 || this.dead || g.state !== 'play') return;
      this.hp -= dmg;
      this.iframes = T.hurtIframes;
      this.flash = 0.25;
      Fx.shake(6, 0.25);
      Sfx.play('hurt');
      Fx.burst(this.x, this.y, '#ff5555', 10, { speed: 150, life: 0.4 });
      // knock away from the source
      const a = Math.atan2(this.y - sy, this.x - sx);
      this.vx += Math.cos(a) * 180; this.vy += Math.sin(a) * 180;
      if (this.hp <= 0) { this.hp = 0; this.dead = true; g.onPlayerDeath(); }
    }

    heal(n) {
      this.hp = Math.min(this.maxHp, this.hp + n);
      Sfx.play('heal');
      Fx.burst(this.x, this.y, '#6ee7a0', 12, { speed: 90, life: 0.6, glow: true });
      Fx.text(this.x, this.y - 24, '+' + n, '#6ee7a0', 13);
    }

    update(dt, g, input) {
      if (this.dead) return;
      const stats = this.stats;

      if (this.iframes > 0) this.iframes -= dt;
      if (this.rollCd > 0) this.rollCd -= dt;
      if (this.attackCd > 0) this.attackCd -= dt * stats.atkSpeedMul;
      if (this.flash > 0) this.flash -= dt;
      if (this.momentumT > 0) this.momentumT -= dt;
      if (stats.regen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + stats.regen * dt);

      // aim at the mouse
      this.facing = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);

      // --- movement ---------------------------------------------------------
      let mx = 0, my = 0;
      if (input.key('KeyW') || input.key('ArrowUp')) my -= 1;
      if (input.key('KeyS') || input.key('ArrowDown')) my += 1;
      if (input.key('KeyA') || input.key('ArrowLeft')) mx -= 1;
      if (input.key('KeyD') || input.key('ArrowRight')) mx += 1;
      this.moving = mx !== 0 || my !== 0;
      if (this.moving) {
        const len = Math.hypot(mx, my);
        mx /= len; my /= len;
        this.moveAngle = Math.atan2(my, mx);
      }

      // --- DODGE ROLL: the headline mechanic ----------------------------------
      if (this.rollT >= 0) {
        this.rollT += dt;
        const k = this.rollT / T.rollDur;
        if (k >= 1) {
          this.rollT = -1;
        } else {
          // burst of speed along the roll direction, eased out
          const sp = T.rollSpeed * (1 - k * 0.45);
          this.x += Math.cos(this.rollAngle) * sp * dt;
          this.y += Math.sin(this.rollAngle) * sp * dt;
          // afterimage trail
          this.ghostTimer -= dt;
          if (this.ghostTimer <= 0) {
            this.ghostTimer = 0.028;
            Fx.ghost({ x: this.x, y: this.y, r: this.r, rot: k * Math.PI * 2, color: '#7fd4ff' });
          }
        }
      } else {
        // normal movement (momentum enchant gives a brief speed burst after kills)
        const mom = this.momentumT > 0 ? 1.25 : 1;
        const sp = T.speed * stats.speedMul * mom;
        this.x += mx * sp * dt;
        this.y += my * sp * dt;
        // roll trigger
        if ((input.pressed('Space') || input.pressed('ShiftLeft') || input.pressed('ShiftRight')) && this.rollCd <= 0) {
          this.rollT = 0;
          this.rollAngle = this.moving ? this.moveAngle : this.facing;
          this.rollCd = T.rollCooldown * stats.rollCdMul;
          this.iframes = Math.max(this.iframes, T.rollIframes);
          this.drawT = -1; // rolling cancels a bow draw
          Sfx.play('roll');
          Fx.burst(this.x, this.y, '#7fd4ff', 6, { speed: 80, life: 0.3 });
        }
      }

      // hit knockback decay
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.vx *= Math.pow(0.001, dt); this.vy *= Math.pow(0.001, dt);

      // obstacles + walls
      for (const o of g.room.obstacles) {
        const dx = this.x - o.x, dy = this.y - o.y, d = Math.hypot(dx, dy);
        if (d < o.r + this.r && d > 0) { this.x = o.x + (dx / d) * (o.r + this.r); this.y = o.y + (dy / d) * (o.r + this.r); }
      }
      // (walls/doors are handled by main.js so it can detect room exits)

      // --- attacking -----------------------------------------------------------
      const w = this.weapon;
      if (w.archetype === 'bow') {
        // hold to draw, release to fire; longer draw = harder arrow
        if (input.mouse.down && this.rollT < 0) {
          if (this.drawT < 0 && this.attackCd <= 0) { this.drawT = 0; Sfx.play('bowdraw'); }
          if (this.drawT >= 0) this.drawT += dt;
        } else if (this.drawT >= 0) {
          this.fireBow(g);
          this.drawT = -1;
        }
      } else {
        if (input.mouse.down && this.attackCd <= 0 && this.rollT < 0) this.startSwing(g);
      }

      // ongoing swing (heavy applies damage at end of windup)
      if (this.swing) {
        this.swing.t += dt;
        if (!this.swing.fired && this.swing.t >= this.swing.windup) {
          this.swing.fired = true;
          this.applyMelee(g);
        }
        if (this.swing.t >= this.swing.dur) this.swing = null;
      }
    }

    startSwing(g) {
      const w = this.weapon;
      const windup = w.windup;
      this.swing = {
        t: 0, windup,
        dur: windup + 0.18,
        dir: this.facing,
        arc: w.arc, range: w.range,
        fired: windup === 0 ? false : false,
        side: (this.lastSide = -(this.lastSide || 1)), // light alternates swing side
        heavy: w.archetype === 'heavy',
      };
      this.attackCd = w.cooldown;
      if (windup === 0) { this.swing.fired = true; this.applyMelee(g); Sfx.play('swing'); }
      else Sfx.play('swing');
    }

    applyMelee(g) {
      const w = this.weapon, stats = this.stats;
      const dir = this.facing; // heavy re-aims at release: feels responsive
      this.swing.dir = dir;
      if (w.archetype === 'heavy') {
        Sfx.play('heavy');
        Fx.hitstop(0.055);      // hit-stop freeze frame on the heavy swing
        Fx.shake(5, 0.18);
      }
      let hitAny = false;
      for (const m of g.monsters) {
        if (m.dead) continue;
        const dx = m.x - this.x, dy = m.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d > w.range + m.r) continue;
        let diff = Math.abs(((Math.atan2(dy, dx) - dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff > w.arc / 2) continue;
        const crit = Math.random() < T.critBase + stats.crit;
        const dmg = w.dmg * stats.dmgMul * (crit ? T.critMult : 1);
        m.takeHit(dmg, {
          sx: this.x, sy: this.y,
          knock: (Weapons.has(w, 'knockback') ? 260 : 90) + (w.archetype === 'heavy' ? 160 : 0),
          flame: Weapons.has(w, 'fireaspect'),
          stagger: w.stagger,
          execute: !!Weapons.has(w, 'executioner'),
          crit, fromPlayer: true,
        }, g);
        hitAny = true;
      }
      if (hitAny && w.archetype === 'heavy') Fx.shake(7, 0.22);
    }

    fireBow(g) {
      const w = this.weapon, stats = this.stats;
      const draw = Math.min(1, this.drawT / 0.8); // full power at 0.8s draw
      if (this.drawT < 0.08) { this.attackCd = 0.1; return; } // tap = dry-fire nothing
      const n = Weapons.has(w, 'multishot') ? 3 : 1;
      const spread = 0.14;
      for (let i = 0; i < n; i++) {
        const a = this.facing + (i - (n - 1) / 2) * spread;
        const crit = Math.random() < T.critBase + stats.crit;
        g.projectiles.push({
          x: this.x + Math.cos(a) * 16, y: this.y + Math.sin(a) * 16,
          vx: Math.cos(a) * w.projSpeed * (0.65 + draw * 0.5),
          vy: Math.sin(a) * w.projSpeed * (0.65 + draw * 0.5),
          r: 4, dmg: w.dmg * stats.dmgMul * (0.55 + draw * 0.65) * (crit ? T.critMult : 1),
          from: 'player', color: crit ? '#ffd24c' : '#e8e3d0', life: 1.6,
          pierce: Weapons.has(w, 'piercing') ? 3 : 0,
          knock: Weapons.has(w, 'punch') ? 240 : 60,
          flame: Weapons.has(w, 'flame'),
          crit, arrow: true, hitSet: new Set(),
        });
      }
      this.attackCd = w.cooldown;
      Sfx.play('bowfire');
    }

    // --- rendering -----------------------------------------------------------------
    draw(c, g) {
      if (this.dead) return;
      c.save();
      c.translate(this.x, this.y);

      // roll cooldown indicator: small radial arc under the player
      if (this.rollCd > 0) {
        const k = 1 - this.rollCd / (T.rollCooldown * this.stats.rollCdMul);
        c.strokeStyle = 'rgba(127,212,255,0.5)';
        c.lineWidth = 3;
        c.beginPath(); c.arc(0, this.r + 8, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); c.stroke();
      } else {
        c.fillStyle = 'rgba(127,212,255,0.55)';
        c.beginPath(); c.arc(0, this.r + 8, 3, 0, Math.PI * 2); c.fill();
      }

      // i-frame flicker
      if (this.iframes > 0 && this.rollT < 0 && Math.sin(Date.now() / 30) > 0) c.globalAlpha = 0.45;

      // squash & stretch + spin through the roll
      if (this.rollT >= 0) {
        const k = this.rollT / T.rollDur;
        c.rotate(this.rollAngle + k * Math.PI * 2 * (Math.cos(this.rollAngle) >= 0 ? 1 : -1));
        c.scale(1 + 0.25 * Math.sin(k * Math.PI), 1 - 0.3 * Math.sin(k * Math.PI));
      }

      // shadow
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.ellipse(0, this.r * 0.85, this.r * 0.9, this.r * 0.35, 0, 0, Math.PI * 2); c.fill();

      // cloak
      c.fillStyle = this.flash > 0 ? '#ff8080' : '#2c3e60';
      c.beginPath(); c.arc(0, 2, this.r, 0, Math.PI * 2); c.fill();
      // body
      c.fillStyle = this.flash > 0 ? '#ffb0b0' : '#4a6fa5';
      c.beginPath(); c.arc(0, -2, this.r * 0.85, 0, Math.PI * 2); c.fill();
      // visor facing aim
      c.save();
      c.rotate(this.rollT >= 0 ? 0 : this.facing);
      c.fillStyle = '#0e1420';
      c.fillRect(this.r * 0.15, -4, this.r * 0.75, 8);
      c.fillStyle = '#9ee7ff';
      c.fillRect(this.r * 0.3, -2.5, this.r * 0.5, 5);
      c.restore();

      c.restore();

      // weapon rendering (outside the roll transform)
      if (this.rollT < 0) this.drawWeapon(c);
    }

    drawWeapon(c) {
      const w = this.weapon;
      c.save();
      c.translate(this.x, this.y);
      c.rotate(this.facing);
      if (w.archetype === 'bow') {
        const pull = this.drawT >= 0 ? Math.min(1, this.drawT / 0.8) : 0;
        c.strokeStyle = w.color; c.lineWidth = 3;
        c.beginPath(); c.arc(this.r + 7, 0, 11, -Math.PI / 2.1, Math.PI / 2.1); c.stroke();
        c.strokeStyle = '#ccc'; c.lineWidth = 1;
        const tipY = Math.sin(Math.PI / 2.1) * 11;
        c.beginPath();
        c.moveTo(this.r + 7 + Math.cos(-Math.PI / 2.1) * 11, -tipY);
        c.lineTo(this.r + 7 - pull * 8, 0);
        c.lineTo(this.r + 7 + Math.cos(Math.PI / 2.1) * 11, tipY);
        c.stroke();
        if (pull > 0) {
          c.strokeStyle = '#e8e3d0'; c.lineWidth = 2.5;
          c.beginPath(); c.moveTo(this.r + 7 - pull * 8, 0); c.lineTo(this.r + 18 - pull * 8, 0); c.stroke();
          // full-draw sparkle
          if (pull >= 1) { c.fillStyle = '#ffd24c'; c.beginPath(); c.arc(this.r + 19 - pull * 8, 0, 2.5, 0, Math.PI * 2); c.fill(); }
        }
        c.restore();
        return;
      }
      c.restore();

      // melee: draw the swing arc while swinging, otherwise blade at rest
      if (this.swing) {
        const s = this.swing;
        const w2 = this.weapon;
        c.save();
        c.translate(this.x, this.y);
        if (!s.fired) {
          // windup: blade raised behind, growing glow (the heavy telegraph)
          const k = s.t / s.windup;
          c.rotate(s.dir - s.arc * 0.7);
          c.strokeStyle = `rgba(255,255,255,${0.25 + k * 0.5})`;
          c.lineWidth = 4;
          c.beginPath(); c.moveTo(this.r, 0); c.lineTo(this.r + w2.range * 0.55, 0); c.stroke();
        } else {
          // release: bright arc sweep
          const k = (s.t - s.windup) / (s.dur - s.windup);
          const a0 = s.dir - s.arc / 2, a1 = s.dir - s.arc / 2 + s.arc * Math.min(1, k * 1.5);
          const grad = c.createRadialGradient(0, 0, this.r, 0, 0, w2.range);
          grad.addColorStop(0, 'rgba(255,255,255,0)');
          grad.addColorStop(0.7, `rgba(255,255,255,${0.35 * (1 - k)})`);
          grad.addColorStop(1, w2.color + '00');
          c.fillStyle = grad;
          c.beginPath();
          c.moveTo(0, 0);
          c.arc(0, 0, w2.range, a0, a1);
          c.closePath(); c.fill();
          c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
          c.lineWidth = s.heavy ? 5 : 3;
          c.beginPath(); c.arc(0, 0, w2.range * 0.9, a0, a1); c.stroke();
        }
        c.restore();
      } else {
        // idle blade at the hip
        c.save();
        c.translate(this.x, this.y);
        c.rotate(this.facing + 0.7);
        c.strokeStyle = this.weapon.color; c.lineWidth = this.weapon.archetype === 'heavy' ? 5 : 3;
        c.beginPath(); c.moveTo(this.r * 0.6, 0);
        c.lineTo(this.r * 0.6 + (this.weapon.archetype === 'heavy' ? 20 : 14), 0); c.stroke();
        c.restore();
      }
    }
  }

  return { Player, T };
})();
