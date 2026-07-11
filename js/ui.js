// ============================================================================
// ui.js - HUD, minimap + fog of war, title/hub screen, overlays.
// ============================================================================
const UI = (() => {
  const W = 960, H = 540;

  // canonical public home of the game (GitHub Pages) - what the share button copies
  const GAME_URL = 'https://goofproof.github.io/gilded-king/';

  // --- META-PROGRESSION UPGRADES (hub screen; persisted in localStorage) --------
  // Kept deliberately modest so runs live or die on in-run choices.
  const META_UPGRADES = [
    { key: 'vitality', name: 'Vitality',  desc: '+10 starting health',       maxRank: 3, costs: [25, 50, 90] },
    { key: 'might',    name: 'Might',     desc: '+5% damage',                maxRank: 3, costs: [25, 50, 90] },
    { key: 'acrobat',  name: 'Acrobat',   desc: '-8% roll cooldown',         maxRank: 2, costs: [30, 60] },
    { key: 'greed',    name: 'Greed',     desc: '+10% coins from kills',     maxRank: 2, costs: [30, 60] },
    { key: 'armory',   name: 'Armory',    desc: 'Start with an Uncommon weapon', maxRank: 1, costs: [80] },
  ];

  // --- HUD -------------------------------------------------------------------
  function drawHUD(c, g) {
    const p = g.player;
    c.save();
    c.font = '12px monospace';
    c.textAlign = 'left';

    // health bar
    const hbX = 14, hbY = 14, hbW = 190, hbH = 17;
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(hbX - 2, hbY - 2, hbW + 4, hbH + 4);
    const hpK = Math.max(0, p.hp / p.maxHp);
    const low = hpK < 0.3;
    c.fillStyle = '#3a0d0d';
    c.fillRect(hbX, hbY, hbW, hbH);
    c.fillStyle = low ? (Math.sin(Date.now() / 150) > 0 ? '#ff4444' : '#cc2222') : '#d64545';
    c.fillRect(hbX, hbY, hbW * hpK, hbH);
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.fillRect(hbX, hbY, hbW * hpK, hbH / 2);
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, hbX + hbW / 2, hbY + 13);

    // xp bar + level
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(hbX - 2, hbY + hbH + 4, hbW + 4, 8);
    c.fillStyle = '#8a6fd1';
    c.fillRect(hbX, hbY + hbH + 6, hbW * Math.min(1, p.xp / p.xpToNext()), 4);
    c.textAlign = 'left';
    c.fillStyle = '#cbb8ff';
    c.fillText(`Lv ${p.level}`, hbX + hbW + 10, hbY + hbH + 11);

    // coins
    c.fillStyle = '#ffd24c';
    c.beginPath(); c.arc(hbX + 8, hbY + hbH + 32, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#b8912f';
    c.beginPath(); c.arc(hbX + 8, hbY + hbH + 32, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd24c';
    c.font = 'bold 14px monospace';
    c.fillText(`${p.coins}`, hbX + 22, hbY + hbH + 37);

    // essence (meta currency), only when carrying any
    if (p.essenceRun > 0 || g.meta.essence > 0) {
      c.fillStyle = '#b88aff';
      c.beginPath();
      const ex = hbX + 8, ey = hbY + hbH + 56;
      c.moveTo(ex, ey - 7); c.lineTo(ex + 6, ey); c.lineTo(ex, ey + 7); c.lineTo(ex - 6, ey);
      c.closePath(); c.fill();
      c.font = '12px monospace';
      c.fillText(`${p.essenceRun} (+${g.meta.essence} banked)`, hbX + 22, ey + 4);
    }

    // active buffs (shield charm / rage / haste) with remaining seconds
    let by = hbY + hbH + 74;
    const buffs = [];
    if (p.buffs.shield > 0) buffs.push({ label: '⛨ shield', color: '#7fd4ff' });
    if (p.buffs.rageT > 0) buffs.push({ label: `↑ rage ${Math.ceil(p.buffs.rageT)}s`, color: '#e05555' });
    if (p.buffs.hasteT > 0) buffs.push({ label: `» haste ${Math.ceil(p.buffs.hasteT)}s`, color: '#ffe08a' });
    c.font = 'bold 12px monospace';
    for (const b of buffs) {
      c.fillStyle = b.color;
      c.fillText(b.label, hbX, by);
      by += 17;
    }

    // floor tag
    c.font = 'bold 13px monospace';
    c.fillStyle = '#8fa3bf';
    c.fillText(`FLOOR ${g.floorNum}/3`, hbX, H - 16);

    // weapon slots (bottom-left) - two free slots, any mix
    drawWeaponSlot(c, p.weapons.a, 14, H - 106, p.slot === 'a');
    drawWeaponSlot(c, p.weapons.b, 62, H - 106, p.slot === 'b');
    c.font = '10px monospace';
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fillText('Tab/RMB swap', 14, H - 112);
    if (g.autoAttack) {
      c.font = 'bold 11px monospace';
      c.fillStyle = '#ffd24c';
      c.fillText('AUTO [F]', 112, H - 78);
    }

    c.restore();
  }

  function drawWeaponSlot(c, w, x, y, active) {
    c.save();
    c.globalAlpha = active ? 1 : 0.55;
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(x, y, 42, 42);
    c.strokeStyle = w ? w.color : '#444';
    c.lineWidth = active ? 2.5 : 1.5;
    c.strokeRect(x, y, 42, 42);
    if (w) {
      c.translate(x + 21, y + 21);
      c.strokeStyle = w.color; c.fillStyle = w.color;
      c.save(); // glyph rotation must not leak into the pip row below
      if (w.archetype === 'bow') {
        c.lineWidth = 2.5;
        c.beginPath(); c.arc(-3, 0, 12, -Math.PI / 2.3, Math.PI / 2.3); c.stroke();
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(-3 + Math.cos(-Math.PI / 2.3) * 12, Math.sin(-Math.PI / 2.3) * 12);
        c.lineTo(-3 + Math.cos(Math.PI / 2.3) * 12, Math.sin(Math.PI / 2.3) * 12); c.stroke();
      } else if (w.archetype === 'heavy') {
        c.rotate(-Math.PI / 4);
        c.fillRect(-3, -16, 6, 22);       // fat blade
        c.fillRect(-8, 6, 16, 4);         // crossguard
      } else {
        c.rotate(-Math.PI / 4);
        c.fillRect(-1.5, -15, 3, 20);
        c.fillRect(-6, 5, 12, 3);
      }
      c.restore();
      // enchant pips: gold=signature, purple=major, grey-green=minor
      w.enchants.forEach((e, i) => {
        c.fillStyle = e.tier === 3 ? '#ffd24c' : e.tier === 2 ? '#b88aff' : '#7fc79a';
        c.beginPath(); c.arc(-14 + i * 9, 16, 3, 0, Math.PI * 2); c.fill();
      });
    }
    c.restore();
  }

  // --- MINIMAP + FOG OF WAR (top-right, per the design doc) -----------------------
  function drawMinimap(c, g) {
    const cell = 27, gap = 6, pad = 10;
    const rooms = g.dungeon.rooms.filter(r => r.visited);
    if (!rooms.length) return;
    // bounds of the VISITED map only - fog of war: unvisited rooms don't exist here
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const r of rooms) {
      minX = Math.min(minX, r.gx); maxX = Math.max(maxX, r.gx);
      minY = Math.min(minY, r.gy); maxY = Math.max(maxY, r.gy);
    }
    const mw = (maxX - minX + 1) * (cell + gap);
    const ox = W - pad - mw, oy = pad + 4;

    c.save();
    c.globalAlpha = 0.92;
    // backdrop
    c.fillStyle = 'rgba(8,8,14,0.65)';
    c.fillRect(ox - 8, oy - 8, mw + 16, (maxY - minY + 1) * (cell + gap) + 16);

    const px = r => ox + (r.gx - minX) * (cell + gap);
    const py = r => oy + (r.gy - minY) * (cell + gap);

    // door connectors (stubs poke toward unvisited neighbors: "known doors")
    c.strokeStyle = '#5a6478'; c.lineWidth = 3;
    for (const r of rooms) {
      for (const dk of Object.keys(r.doors)) {
        const n = r.doors[dk];
        const cx = px(r) + cell / 2, cy = py(r) + cell / 2;
        const [dx, dy] = Dungeon.DIRS[dk];
        c.beginPath();
        c.moveTo(cx + dx * cell / 2, cy + dy * cell / 2);
        if (n.visited) c.lineTo(cx + dx * (cell / 2 + gap), cy + dy * (cell / 2 + gap));
        else c.lineTo(cx + dx * (cell / 2 + 4.5), cy + dy * (cell / 2 + 4.5)); // stub only
        c.stroke();
      }
    }

    // rooms
    for (const r of rooms) {
      const x = px(r), y = py(r);
      const colors = { start: '#8899bb', combat: '#4a5468', treasure: '#c9a227', shop: '#d98e3d', boss: '#b03050', stairs: '#3dbf9d' };
      c.fillStyle = colors[r.type] || '#4a5468';
      c.fillRect(x, y, cell, cell);
      if (!r.cleared && (r.type === 'combat' || r.type === 'boss')) {
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(x, y, cell, cell);
      }
      // room-type glyphs, readable at the bigger cell size
      const glyph = { shop: '$', stairs: '↓', treasure: '◆', boss: '!' }[r.type];
      if (glyph) {
        c.font = 'bold 17px monospace'; c.textAlign = 'center';
        c.fillStyle = 'rgba(0,0,0,0.65)';
        c.fillText(glyph, x + cell / 2 + 0.5, y + cell / 2 + 6.5);
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.fillText(glyph, x + cell / 2, y + cell / 2 + 6);
      }
      if (r === g.room) {
        c.strokeStyle = '#ffffff'; c.lineWidth = 2;
        c.strokeRect(x - 1.5, y - 1.5, cell + 3, cell + 3);
      }
    }
    c.restore();
  }

  // --- BOSS bar + intro ------------------------------------------------------------
  function drawBossBar(c, g) {
    const b = g.boss;
    if (!b || b.dead) return;
    const bw = 420, bx = (W - bw) / 2, by = 18;
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(bx - 3, by - 3, bw + 6, 20);
    c.fillStyle = '#4a0d18';
    c.fillRect(bx, by, bw, 14);
    c.fillStyle = '#c02040';
    c.fillRect(bx, by, bw * Math.max(0, b.hp / b.maxHp), 14);
    c.font = 'bold 12px monospace'; c.textAlign = 'center';
    c.fillStyle = '#ffd24c';
    c.fillText(b.name, W / 2, by + 30);
    c.restore();
  }

  function drawBossIntro(c, g) {
    const t = g.bossIntroT;
    const k = Math.min(1, t / 0.4);
    c.save();
    // letterbox
    c.fillStyle = 'rgba(0,0,0,0.85)';
    c.fillRect(0, 0, W, 62 * k);
    c.fillRect(0, H - 62 * k, W, 62 * k);
    if (t > 0.4) {
      const a = Math.min(1, (t - 0.4) / 0.3);
      c.globalAlpha = a;
      c.font = 'bold 44px monospace'; c.textAlign = 'center';
      c.fillStyle = '#1a0a10';
      c.fillText('THE MIMIC KING', W / 2 + 3, H / 2 - 37);
      c.fillStyle = '#ffd24c';
      c.fillText('THE MIMIC KING', W / 2, H / 2 - 40);
      c.font = '15px monospace';
      c.fillStyle = '#c88';
      c.fillText('the dungeon was bait all along', W / 2, H / 2 - 8);
    }
    c.restore();
  }

  // --- title / hub -----------------------------------------------------------------
  // returns clickable rects for main.js hit-testing
  function drawTitle(c, g) {
    const meta = g.meta;
    c.save();
    c.fillStyle = '#0d0d16';
    c.fillRect(0, 0, W, H);

    // floating coin particles handled by Fx from main

    c.textAlign = 'center';
    // deliberately NOT the boss's real name - the reveal belongs to the boss intro
    c.font = 'bold 46px monospace';
    c.fillStyle = '#241a08';
    c.fillText('DUNGEON OF THE', W / 2 + 3, 103);
    c.fillStyle = '#ffd24c';
    c.fillText('DUNGEON OF THE', W / 2, 100);
    c.font = 'bold 64px monospace';
    c.fillStyle = '#241a08';
    c.fillText('GILDED KING', W / 2 + 4, 168);
    c.fillStyle = '#e8b52f';
    c.fillText('GILDED KING', W / 2, 164);

    c.font = '14px monospace';
    c.fillStyle = '#8fa3bf';
    c.fillText('WASD move · mouse aims · click or J attacks · SPACE rolls · E interact · Tab swap · F auto-attack · M mute', W / 2, 205);

    // start button
    const startR = { x: W / 2 - 130, y: 232, w: 260, h: 46, action: 'start' };
    const pulse = Math.sin(Date.now() / 300) * 0.12 + 0.88;
    c.fillStyle = `rgba(212,175,55,${0.15 * pulse})`;
    c.fillRect(startR.x, startR.y, startR.w, startR.h);
    c.strokeStyle = '#ffd24c'; c.lineWidth = 2;
    c.strokeRect(startR.x, startR.y, startR.w, startR.h);
    c.font = 'bold 20px monospace';
    c.fillStyle = '#ffd24c';
    c.fillText('ENTER THE DUNGEON', W / 2, startR.y + 30);
    c.font = '12px monospace';
    c.fillStyle = '#667';
    c.fillText('(or press Enter)', W / 2, startR.y + 62);

    const rects = [startR];

    // hub: meta upgrades
    c.font = 'bold 14px monospace';
    c.fillStyle = '#b88aff';
    c.fillText(`◆ ESSENCE: ${meta.essence}`, W / 2, 330);
    c.font = '11px monospace';
    c.fillStyle = '#667';
    c.fillText('essence survives death - spend it on permanent boosts', W / 2, 348);

    const cardW = 168, cardH = 108, gap = 12;
    const totalW = META_UPGRADES.length * cardW + (META_UPGRADES.length - 1) * gap;
    let cx = (W - totalW) / 2;
    for (const u of META_UPGRADES) {
      const rank = meta.ranks[u.key] || 0;
      const maxed = rank >= u.maxRank;
      const cost = maxed ? null : u.costs[rank];
      const afford = cost !== null && meta.essence >= cost;
      const r = { x: cx, y: 366, w: cardW, h: cardH, action: 'upgrade', key: u.key };
      c.fillStyle = maxed ? 'rgba(184,138,255,0.10)' : 'rgba(255,255,255,0.04)';
      c.fillRect(r.x, r.y, r.w, r.h);
      c.strokeStyle = maxed ? '#b88aff' : afford ? '#8fa3bf' : '#3a3f4d';
      c.lineWidth = 1.5;
      c.strokeRect(r.x, r.y, r.w, r.h);
      c.font = 'bold 13px monospace';
      c.fillStyle = maxed ? '#b88aff' : '#dde3ee';
      c.fillText(u.name, cx + cardW / 2, 388);
      c.font = '11px monospace';
      c.fillStyle = '#8fa3bf';
      wrapText(c, u.desc, cx + cardW / 2, 406, cardW - 16, 13);
      // rank pips
      for (let i = 0; i < u.maxRank; i++) {
        c.fillStyle = i < rank ? '#b88aff' : '#2c3040';
        c.beginPath(); c.arc(cx + cardW / 2 - (u.maxRank - 1) * 7 + i * 14, 438, 4, 0, Math.PI * 2); c.fill();
      }
      c.font = 'bold 12px monospace';
      c.fillStyle = maxed ? '#b88aff' : afford ? '#ffd24c' : '#555';
      c.fillText(maxed ? 'MAXED' : `◆ ${cost}`, cx + cardW / 2, 462);
      rects.push(r);
      cx += cardW + gap;
    }

    c.font = '11px monospace';
    c.fillStyle = '#445';
    c.fillText('designed by the boss himself · built with Claude', W / 2, H - 14);

    // high-scores button (top-left)
    const scoresR = { x: 14, y: 14, w: 150, h: 30, action: 'scores' };
    c.strokeStyle = '#5a6478'; c.lineWidth = 1.5;
    c.strokeRect(scoresR.x, scoresR.y, scoresR.w, scoresR.h);
    c.font = 'bold 12px monospace';
    c.fillStyle = '#ffd24c';
    c.fillText('★ HIGH SCORES', scoresR.x + scoresR.w / 2, scoresR.y + 19);
    rects.push(scoresR);

    // share button (bottom-right): copies the game's public link
    const shareR = { x: W - 150, y: H - 46, w: 136, h: 30, action: 'share' };
    c.strokeStyle = '#5a6478'; c.lineWidth = 1.5;
    c.strokeRect(shareR.x, shareR.y, shareR.w, shareR.h);
    c.font = 'bold 12px monospace';
    c.fillStyle = '#8fa3bf';
    c.fillText('SHARE THE GAME', shareR.x + shareR.w / 2, shareR.y + 19);
    rects.push(shareR);

    // share toast
    if (g.shareMsg && g.shareMsg.t > 0) {
      c.globalAlpha = Math.min(1, g.shareMsg.t);
      c.font = 'bold 13px monospace';
      c.fillStyle = '#ffd24c';
      c.fillText(g.shareMsg.text, W / 2, H - 60);
      c.globalAlpha = 1;
    }

    // scoreboard overlay
    if (g.showScores) drawScoreboard(c, g);

    c.restore();
    return rects;
  }

  function drawScoreboard(c, g) {
    const scores = g.scores || [];
    const pw = 470, ph = 400, px = (W - pw) / 2, py = 70;
    c.fillStyle = 'rgba(5,5,12,0.92)';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = '#ffd24c'; c.lineWidth = 2;
    c.strokeRect(px, py, pw, ph);
    c.textAlign = 'center';
    c.font = 'bold 26px monospace';
    c.fillStyle = '#ffd24c';
    c.fillText('★ HIGH SCORES ★', W / 2, py + 40);
    c.font = '11px monospace';
    c.fillStyle = '#667';
    c.fillText('essence banked in a single run · ♛ = slew the king', W / 2, py + 60);
    if (!scores.length) {
      c.font = '14px monospace'; c.fillStyle = '#8fa3bf';
      c.fillText('no runs on the board yet - go make history', W / 2, py + 180);
    }
    c.font = 'bold 16px monospace';
    scores.slice(0, 10).forEach((s, i) => {
      const y = py + 95 + i * 29;
      const isNew = g.newScoreRank === i + 1;
      c.fillStyle = isNew ? '#ffd24c' : i === 0 ? '#e8b52f' : '#c8d2e0';
      c.textAlign = 'right';
      c.fillText(`${i + 1}.`, px + 70, y);
      c.textAlign = 'left';
      c.fillText(s.initials, px + 95, y);
      c.textAlign = 'right';
      c.fillText(`${s.score} ◆`, px + 300, y);
      c.textAlign = 'left';
      c.fillStyle = '#8fa3bf';
      c.fillText(`floor ${s.floor}`, px + 330, y);
      if (s.won) { c.fillStyle = '#ffd24c'; c.fillText('♛', px + 420, y); }
    });
    c.textAlign = 'center';
    c.font = '12px monospace'; c.fillStyle = '#667';
    c.fillText('click anywhere or Esc to close', W / 2, py + ph - 14);
  }

  // arcade three-letter initials entry
  function drawInitials(c, g) {
    const ini = g.initials;
    const e = overlayEase(g);
    c.save();
    c.globalAlpha = e;
    c.fillStyle = 'rgba(8,6,2,0.92)';
    c.fillRect(0, 0, W, H);
    c.textAlign = 'center';
    c.font = 'bold 38px monospace';
    c.fillStyle = '#ffd24c';
    c.fillText('NEW HIGH SCORE!', W / 2, 130);
    c.font = 'bold 24px monospace';
    c.fillStyle = '#b88aff';
    c.fillText(`${g.essenceEarned} ◆ essence`, W / 2, 172);
    c.font = '14px monospace';
    c.fillStyle = '#8fa3bf';
    c.fillText('enter your initials', W / 2, 205);

    const rects = [];
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 95, y = 285;
      const active = ini.slot === i;
      // letter box
      c.strokeStyle = active ? '#ffd24c' : '#5a6478';
      c.lineWidth = active ? 3 : 1.5;
      c.strokeRect(x - 34, y - 42, 68, 76);
      c.font = 'bold 52px monospace';
      c.fillStyle = active ? '#fff' : '#c8d2e0';
      c.fillText(String.fromCharCode(ini.letters[i]), x, y + 16);
      // up/down arrows
      const pulse = active ? 0.5 + Math.sin(Date.now() / 250) * 0.3 : 0.35;
      c.fillStyle = `rgba(255,210,76,${pulse})`;
      c.beginPath(); c.moveTo(x, y - 66); c.lineTo(x - 12, y - 50); c.lineTo(x + 12, y - 50); c.fill();
      c.beginPath(); c.moveTo(x, y + 58); c.lineTo(x - 12, y + 42); c.lineTo(x + 12, y + 42); c.fill();
      rects.push({ x: x - 20, y: y - 74, w: 40, h: 28, action: 'up', idx: i });
      rects.push({ x: x - 20, y: y + 38, w: 40, h: 28, action: 'down', idx: i });
    }
    const ok = { x: W / 2 - 90, y: 390, w: 180, h: 40, action: 'ok' };
    c.strokeStyle = '#ffd24c'; c.lineWidth = 2;
    c.strokeRect(ok.x, ok.y, ok.w, ok.h);
    c.font = 'bold 16px monospace'; c.fillStyle = '#ffd24c';
    c.fillText('CLAIM IT', W / 2, ok.y + 26);
    rects.push(ok);
    c.font = '12px monospace'; c.fillStyle = '#667';
    c.fillText('type letters · arrows to adjust · Enter to confirm · Esc to skip', W / 2, 460);
    c.restore();
    return rects;
  }

  function wrapText(c, text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '', yy = y;
    for (const wd of words) {
      const test = line ? line + ' ' + wd : wd;
      if (c.measureText(test).width > maxW) { c.fillText(line, x, yy); line = wd; yy += lh; }
      else line = test;
    }
    if (line) c.fillText(line, x, yy);
  }

  // eased overlay entrance (the spec asks for eased UI transitions)
  function overlayEase(g) {
    const k = Math.min(1, (g.overlayT ?? 1) / 0.28);
    return 1 - Math.pow(1 - k, 3); // easeOutCubic
  }

  // --- level-up choice overlay -------------------------------------------------------
  function drawLevelUp(c, g) {
    const e = overlayEase(g);
    const dy = (1 - e) * 26; // entrance drift; baked into returned hitboxes too
    c.save();
    c.globalAlpha = e;
    c.translate(0, dy); // cards drift up as they fade in
    c.fillStyle = 'rgba(5,5,12,0.78)';
    c.fillRect(0, -30, W, H + 60);
    c.textAlign = 'center';
    c.font = 'bold 30px monospace';
    c.fillStyle = '#ffd24c';
    c.fillText(`LEVEL ${g.player.level}!`, W / 2, 130);
    c.font = '14px monospace';
    c.fillStyle = '#8fa3bf';
    c.fillText('choose an upgrade (click or press 1/2/3)', W / 2, 158);

    const n = g.levelChoices.length;
    const cardW = 210, cardH = 150, gap = 24;
    const totalW = n * cardW + (n - 1) * gap;
    const rects = [];
    for (let i = 0; i < n; i++) {
      const ch = g.levelChoices[i];
      const x = (W - totalW) / 2 + i * (cardW + gap), y = 200;
      const hov = g.hoverChoice === i;
      c.fillStyle = hov ? 'rgba(255,210,76,0.12)' : 'rgba(255,255,255,0.05)';
      c.fillRect(x, y, cardW, cardH);
      c.strokeStyle = hov ? '#ffd24c' : '#5a6478';
      c.lineWidth = hov ? 2.5 : 1.5;
      c.strokeRect(x, y, cardW, cardH);
      c.font = 'bold 30px monospace';
      c.fillStyle = ch.color;
      c.fillText(ch.icon, x + cardW / 2, y + 52);
      c.font = 'bold 14px monospace';
      c.fillStyle = '#fff';
      c.fillText(ch.name, x + cardW / 2, y + 84);
      c.font = '12px monospace';
      c.fillStyle = '#9fb0c8';
      wrapText(c, ch.desc, x + cardW / 2, y + 106, cardW - 20, 15);
      c.font = 'bold 13px monospace';
      c.fillStyle = '#5a6478';
      c.fillText(`${i + 1}`, x + cardW / 2, y + cardH - 10);
      rects.push({ x, y: y + dy, w: cardW, h: cardH, idx: i }); // hitbox tracks the drift
    }
    c.restore();
    return rects;
  }

  // --- pause / death / victory -----------------------------------------------------
  function drawPause(c, g) {
    const e = overlayEase(g);
    c.save();
    c.globalAlpha = e;
    c.fillStyle = 'rgba(5,5,12,0.7)';
    c.fillRect(0, 0, W, H);
    c.textAlign = 'center';
    c.font = 'bold 40px monospace'; c.fillStyle = '#dde3ee';
    c.fillText('PAUSED', W / 2, H / 2 - 20);
    c.font = '14px monospace'; c.fillStyle = '#8fa3bf';
    c.fillText('P / Esc to resume · M to mute', W / 2, H / 2 + 16);
    c.restore();
  }

  function drawEnd(c, g, won) {
    const p = g.player;
    const e = overlayEase(g);
    const dy = (1 - e) * 20;
    c.save();
    c.globalAlpha = e;
    c.translate(0, dy);
    c.fillStyle = won ? 'rgba(20,14,4,0.88)' : 'rgba(12,4,6,0.88)';
    c.fillRect(0, -24, W, H + 48);
    c.textAlign = 'center';
    c.font = 'bold 52px monospace';
    c.fillStyle = won ? '#ffd24c' : '#c02040';
    c.fillText(won ? 'THE HOARD IS YOURS' : 'YOU DIED', W / 2, 150);
    if (won) {
      c.font = '15px monospace'; c.fillStyle = '#c9a227';
      c.fillText('The Mimic King is slain. The gold was real after all.', W / 2, 185);
    }
    c.font = '15px monospace';
    c.fillStyle = '#9fb0c8';
    const lines = [
      `Floor reached      ${g.floorNum} / 3`,
      `Rooms cleared      ${p.roomsCleared}`,
      `Monsters slain     ${p.kills}`,
      `Level reached      ${p.level}`,
      `Coins gathered     ${p.coinsTotal || p.coins}`,
      `Essence earned     ${g.essenceEarned || 0} ◆`,
    ];
    lines.forEach((l, i) => c.fillText(l, W / 2, 240 + i * 26));
    if (g.newScoreRank) {
      c.font = 'bold 16px monospace';
      c.fillStyle = '#ffd24c';
      c.fillText(`★ HIGH SCORE #${g.newScoreRank} ★`, W / 2, 240 + lines.length * 26 + 8);
    }

    const r = { x: W / 2 - 110, y: 420, w: 220, h: 44, action: 'again' };
    c.strokeStyle = '#ffd24c'; c.lineWidth = 2;
    c.strokeRect(r.x, r.y, r.w, r.h);
    c.font = 'bold 17px monospace'; c.fillStyle = '#ffd24c';
    c.fillText('NEW RUN', W / 2, r.y + 28);
    c.font = '12px monospace'; c.fillStyle = '#667';
    c.fillText('(Enter) · Esc for the hub to spend essence', W / 2, r.y + 62);
    c.restore();
    return [{ ...r, y: r.y + dy }]; // hitbox tracks the entrance drift
  }

  return { META_UPGRADES, GAME_URL, drawHUD, drawMinimap, drawBossBar, drawBossIntro, drawTitle, drawLevelUp, drawPause, drawEnd, drawInitials };
})();
