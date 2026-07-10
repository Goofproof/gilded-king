// ============================================================================
// fx.js - juice: particles, screen shake, hit-stop, floating text, afterimages.
// ============================================================================
const Fx = (() => {
  const particles = [];   // {x,y,vx,vy,r,color,life,maxLife,grav,glow}
  const texts = [];       // floating damage numbers / notices
  const ghosts = [];      // dodge-roll afterimages: {draw fn snapshot via params}
  let shakeMag = 0, shakeT = 0, shakeDur = 0;
  let hitstopT = 0;

  function burst(x, y, color, n, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed || 120) * (0.3 + Math.random());
      particles.push({
        x, y,
        vx: Math.cos(a) * sp + (opts.vx || 0),
        vy: Math.sin(a) * sp + (opts.vy || 0),
        r: (opts.size || 3) * (0.5 + Math.random()),
        color: Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color,
        life: 0, maxLife: (opts.life || 0.5) * (0.6 + Math.random() * 0.8),
        grav: opts.grav || 0, glow: opts.glow || false, drag: opts.drag ?? 0.92,
      });
    }
  }

  function text(x, y, str, color = '#fff', size = 13) {
    texts.push({ x, y, str, color, size, life: 0, maxLife: 0.8, vy: -55 });
  }

  function ghost(snap) { ghosts.push({ ...snap, life: 0, maxLife: 0.3 }); }

  function shake(mag, dur) {
    if (mag >= shakeMag || shakeT >= shakeDur) { shakeMag = mag; shakeT = 0; shakeDur = dur; }
  }
  function hitstop(dur) { hitstopT = Math.max(hitstopT, dur); }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= p.drag; p.vy *= p.drag;
      p.vy += p.grav * dt;
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.life += dt;
      if (t.life >= t.maxLife) { texts.splice(i, 1); continue; }
      t.y += t.vy * dt; t.vy *= 0.9;
    }
    for (let i = ghosts.length - 1; i >= 0; i--) {
      ghosts[i].life += dt;
      if (ghosts[i].life >= ghosts[i].maxLife) ghosts.splice(i, 1);
    }
    if (shakeT < shakeDur) shakeT += dt;
  }

  // hit-stop is ticked from the main loop so it can freeze entity updates
  function tickHitstop(dt) {
    if (hitstopT > 0) { hitstopT -= dt; return true; }
    return false;
  }

  function getShake() {
    if (shakeT >= shakeDur) return { x: 0, y: 0 };
    const falloff = 1 - shakeT / shakeDur;
    const m = shakeMag * falloff;
    return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
  }

  function drawGhosts(c) {
    for (const g of ghosts) {
      const a = 0.35 * (1 - g.life / g.maxLife);
      c.save();
      c.globalAlpha = a;
      c.translate(g.x, g.y);
      c.rotate(g.rot || 0);
      c.scale(g.sx || 1, g.sy || 1);
      c.fillStyle = g.color || '#7fd4ff';
      c.beginPath(); c.arc(0, 0, g.r || 13, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }

  // pre-rendered glow sprites: per-particle shadowBlur forces a rasterize+blur
  // pass PER FILL, which hitches integrated-GPU laptops exactly on big bursts
  // (boss death = 80 glow particles). drawImage of a cached canvas is ~10x cheaper.
  const glowSprites = {};
  function glowSprite(color) {
    let s = glowSprites[color];
    if (!s) {
      s = document.createElement('canvas');
      s.width = s.height = 32; // 8px core + 8px blur margin, 2x
      const sc = s.getContext('2d');
      sc.shadowColor = color; sc.shadowBlur = 8;
      sc.fillStyle = color;
      sc.beginPath(); sc.arc(16, 16, 8, 0, Math.PI * 2); sc.fill();
      glowSprites[color] = s;
    }
    return s;
  }

  function draw(c) {
    for (const p of particles) {
      const a = 1 - p.life / p.maxLife;
      c.globalAlpha = a;
      const pr = p.r * a;
      if (p.glow) {
        const half = pr * 2;
        c.drawImage(glowSprite(p.color), p.x - half, p.y - half, half * 2, half * 2);
      } else {
        c.fillStyle = p.color;
        c.beginPath(); c.arc(p.x, p.y, pr, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
    for (const t of texts) {
      const a = 1 - t.life / t.maxLife;
      c.globalAlpha = a;
      c.font = `bold ${t.size}px monospace`;
      c.textAlign = 'center';
      c.fillStyle = '#000'; c.fillText(t.str, t.x + 1, t.y + 1);
      c.fillStyle = t.color; c.fillText(t.str, t.x, t.y);
    }
    c.globalAlpha = 1;
  }

  function clear() { particles.length = 0; texts.length = 0; ghosts.length = 0; hitstopT = 0; }

  return { burst, text, ghost, shake, hitstop, update, tickHitstop, getShake, draw, drawGhosts, clear };
})();
