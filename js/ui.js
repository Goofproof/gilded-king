// ============================================================================
// ui.js - HUD, minimap + fog of war, title/hub screen, overlays.
// ============================================================================
const UI = (() => {
  const W = 960, H = 540;

  // canonical public home of the game (GitHub Pages) - what the share button copies
  const GAME_URL = 'https://goofproof.github.io/gilded-king/';

  // --- META-PROGRESSION UPGRADES (hub screen; persisted in localStorage) --------
  // Kept deliberately modest so runs live or die on in-run choices.
  // Vitality/Might/Greed are ENDLESS (Sam: essence should never be "maxed out") -
  // past their listed tiers each rank costs more (geometric) and keeps scaling,
  // since the effects are per-rank in the Player constructor. Acrobat/Armory stay
  // capped (their effects can't scale forever).
  const META_UPGRADES = [
    { key: 'vitality', name: 'Vitality',  desc: '+10 starting health',       maxRank: 3, costs: [25, 50, 90], endless: true },
    { key: 'might',    name: 'Might',     desc: '+5% damage',                maxRank: 3, costs: [25, 50, 90], endless: true },
    { key: 'acrobat',  name: 'Acrobat',   desc: '-8% roll cooldown',         maxRank: 2, costs: [30, 60] },
    { key: 'greed',    name: 'Greed',     desc: '+10% coins from kills',     maxRank: 3, costs: [30, 60, 100], endless: true },
    { key: 'armory',   name: 'Armory',    desc: 'Start with an Uncommon weapon', maxRank: 1, costs: [80] },
  ];

  // essence cost of the NEXT rank; null once a capped upgrade is maxed
  function metaCost(u, rank) {
    if (rank < u.costs.length) return u.costs[rank];
    if (!u.endless) return null;
    return Math.round(u.costs[u.costs.length - 1] * Math.pow(1.4, rank - u.costs.length + 1));
  }

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

    // shards (salvage currency) - shown once you have any
    if (p.shards > 0) {
      const sx = hbX + 110, sy = hbY + hbH + 32;
      c.fillStyle = '#7fe8e0';
      c.beginPath(); c.moveTo(sx, sy - 7); c.lineTo(sx + 6, sy + 4); c.lineTo(sx - 6, sy + 4); c.closePath(); c.fill();
      c.font = 'bold 13px monospace'; c.textAlign = 'left';
      c.fillText(`${p.shards}`, sx + 11, sy + 5);
      const w = p.weapon;
      if (w && (w.upLvl || 0) < 5) {
        const cost = 5 + (w.upLvl || 0) * 4;
        c.font = '10px monospace';
        c.fillStyle = p.shards >= cost ? '#7fe8e0' : 'rgba(127,232,224,0.4)';
        c.fillText(`U hone ${cost}◈`, sx + 40, sy + 5);
      }
    }

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
    // active pet companion + its passive
    if (p.pet) {
      c.fillStyle = p.pet.color;
      c.font = 'bold 12px monospace';
      c.fillText(`❤ ${p.pet.name} · ${p.pet.desc}`, hbX, by);
      by += 17;
    }

    // floor tag - "/3" through the Keep, then depth into the Descent
    const inDescent = typeof Descent !== 'undefined' && Descent.isDescent(g.floorNum);
    c.font = 'bold 13px monospace';
    c.fillStyle = inDescent ? '#ff8a3d' : '#8fa3bf';
    c.fillText(inDescent ? `DESCENT · FLOOR ${g.floorNum}` : `FLOOR ${g.floorNum}/3`, hbX, H - 16);

    // weapon slots (bottom-left) - two free slots, any mix - plus the armor slot
    drawWeaponSlot(c, p.weapons.a, 14, H - 106, p.slot === 'a');
    drawWeaponSlot(c, p.weapons.b, 62, H - 106, p.slot === 'b');
    drawArmorSlot(c, p.armor, 110, H - 106);
    c.font = '10px monospace';
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fillText('Tab/RMB swap', 14, H - 112);

    // ability badges (Q / R / Ultimate), bottom-centre; hover shows what each does
    for (const b of abilityBadges(p)) drawAbility(c, b.a, b.key, b.x);

    c.restore();
  }

  // layout of the present ability key-caps, shared by the HUD + the hover tooltip
  function abilityBadges(p) {
    const s = 46, gap = 10, list = [];
    if (p.ability) list.push({ a: p.ability, key: 'Q' });
    if (p.abilityR) list.push({ a: p.abilityR, key: 'R' });
    if (p.abilityUlt) list.push({ a: p.abilityUlt, key: '★' });
    const total = list.length * s + (list.length - 1) * gap;
    let x = W / 2 - total / 2;
    for (const b of list) { b.x = x; b.y = H - s - 12; b.s = s; x += s + gap; }
    return list;
  }

  // one ability key-cap: cooldown sweep + the key letter (Q/R/★ = left-click ult)
  function drawAbility(c, a, key, x) {
    const s = 46, y = H - s - 12;
    const ready = a.cd <= 0;
    const k = a.cdMax > 0 ? Math.max(0, a.cd / a.cdMax) : 0;
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(x, y, s, s);
    if (!ready) { c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(x, y, s, s * k); }
    c.strokeStyle = ready ? a.color : '#4a4f5d';
    c.lineWidth = ready ? 2.5 : 1.5;
    c.strokeRect(x, y, s, s);
    c.textAlign = 'center';
    c.font = 'bold 18px monospace';
    c.fillStyle = ready ? a.color : '#7a8194';
    c.fillText(key, x + s / 2, y + s / 2 + 2);
    if (ready) {
      c.globalAlpha = 0.35 + Math.sin(Date.now() / 300) * 0.2;
      c.strokeStyle = a.color; c.lineWidth = 2;
      c.strokeRect(x - 2, y - 2, s + 4, s + 4);
      c.globalAlpha = 1;
    } else {
      c.font = 'bold 12px monospace'; c.fillStyle = '#cdd4e2';
      c.fillText(Math.ceil(a.cd) + 's', x + s / 2, y + s - 6);
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

  function drawArmorSlot(c, a, x, y) {
    c.save();
    c.globalAlpha = 0.85;
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(x, y, 42, 42);
    c.strokeStyle = a ? a.color : '#444';
    c.lineWidth = 1.5;
    c.strokeRect(x, y, 42, 42);
    if (a) {
      c.translate(x + 21, y + 19);
      c.fillStyle = a.color;
      c.beginPath();
      c.moveTo(0, -11); c.lineTo(9, -6); c.lineTo(9, 3); c.lineTo(0, 12); c.lineTo(-9, 3); c.lineTo(-9, -6);
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(-1.2, -7, 2.4, 14);
      a.enchants.forEach((e, i) => {
        c.fillStyle = e.tier === 3 ? '#ffd24c' : e.tier === 2 ? '#b88aff' : '#7fc79a';
        c.beginPath(); c.arc(-14 + i * 9, 16, 3, 0, Math.PI * 2); c.fill();
      });
    } else {
      c.fillStyle = '#3a3f4d';
      c.font = '9px monospace'; c.textAlign = 'center';
      c.fillText('armor', x + 21, y + 24);
    }
    c.restore();
  }

  // --- EVOLUTION CHOICE (Sam's system: stack a stat to 3/6/9/12) --------------------
  // the ULTIMATE picker: choose 1 of 3 ultimates forged from your Q + R abilities
  function drawUltPick(c, g) {
    const opts = g.ultChoices || [];
    const e = overlayEase(g);
    c.save();
    c.globalAlpha = e;
    c.fillStyle = 'rgba(5,5,12,0.86)'; c.fillRect(0, 0, W, H);
    c.textAlign = 'center';
    c.font = 'bold 24px monospace'; c.fillStyle = '#ff2fb0';
    c.fillText('CHOOSE YOUR ULTIMATE', W / 2, 92);
    c.font = '12px monospace'; c.fillStyle = '#8fa3bf';
    c.fillText('forged from your Q + R · left-click unleashes it in battle', W / 2, 116);
    const cardW = 250, cardH = 210, gap = 22, y = 168;
    const totalW = opts.length * cardW + (opts.length - 1) * gap;
    let cx = (W - totalW) / 2;
    const rects = [];
    opts.forEach((u, i) => {
      const hover = g.hoverChoice === i;
      c.fillStyle = hover ? 'rgba(255,47,176,0.14)' : 'rgba(255,255,255,0.04)';
      c.fillRect(cx, y, cardW, cardH);
      c.strokeStyle = hover ? u.color : '#4a4f5d'; c.lineWidth = hover ? 2.5 : 1.5;
      c.strokeRect(cx, y, cardW, cardH);
      c.textAlign = 'center';
      c.font = 'bold 15px monospace'; c.fillStyle = u.color;
      c.fillText(u.name, cx + cardW / 2, y + 34);
      c.textAlign = 'left';
      c.font = '11px monospace'; c.fillStyle = '#c8d2e0';
      wrapText(c, u.desc, cx + 14, y + 66, cardW - 28, 15);
      c.textAlign = 'center';
      c.font = 'bold 12px monospace'; c.fillStyle = '#cdd4e2';
      c.fillText(`${u.cdMax}s cooldown`, cx + cardW / 2, y + cardH - 16);
      c.font = 'bold 13px monospace'; c.fillStyle = hover ? '#ffd24c' : '#555';
      c.fillText(`[${i + 1}]`, cx + cardW / 2, y + cardH - 36);
      rects.push({ x: cx, y, w: cardW, h: cardH, idx: i });
      cx += cardW + gap;
    });
    c.font = '11px monospace'; c.fillStyle = '#667';
    c.fillText('press 1 / 2 / 3, or click a card', W / 2, H - 34);
    c.restore();
    return rects;
  }

  function drawEvolution(c, g) {
    const ev = g.evoChoices;
    const e = overlayEase(g);
    const dy = (1 - e) * 26;
    c.save();
    c.globalAlpha = e;
    c.translate(0, dy);
    c.fillStyle = 'rgba(10,5,16,0.85)';
    c.fillRect(0, -30, W, H + 60);
    c.textAlign = 'center';
    c.font = 'bold 30px monospace';
    c.fillStyle = '#b88aff';
    c.fillText(`${Evolutions.STAT_NAMES[ev.key]} EVOLUTION ${Evolutions.TIER_LABEL[ev.stacks]}`, W / 2, 118);
    c.font = '13px monospace';
    c.fillStyle = '#8fa3bf';
    c.fillText('your training crystallizes into something stranger - choose', W / 2, 146);

    const n = ev.options.length;
    const cardW = 262, cardH = 190, gap = 20;
    const totalW = n * cardW + (n - 1) * gap;
    const rects = [];
    for (let i = 0; i < n; i++) {
      const opt = ev.options[i];
      const x = (W - totalW) / 2 + i * (cardW + gap), y = 185;
      const hov = g.hoverChoice === i;
      c.fillStyle = hov ? 'rgba(184,138,255,0.14)' : 'rgba(255,255,255,0.05)';
      c.fillRect(x, y, cardW, cardH);
      c.strokeStyle = hov ? '#b88aff' : '#5a4a78';
      c.lineWidth = hov ? 2.5 : 1.5;
      c.strokeRect(x, y, cardW, cardH);
      c.font = 'bold 15px monospace';
      c.fillStyle = '#e8d5ff';
      wrapText(c, opt.name, x + cardW / 2, y + 34, cardW - 24, 19);
      c.font = '12px monospace';
      c.fillStyle = '#9fb0c8';
      wrapText(c, opt.desc, x + cardW / 2, y + 92, cardW - 26, 16);
      c.font = 'bold 13px monospace';
      c.fillStyle = '#5a6478';
      c.fillText(`${i + 1}`, x + cardW / 2, y + cardH - 12);
      rects.push({ x, y: y + dy, w: cardW, h: cardH, idx: i });
    }
    c.font = '11px monospace';
    c.fillStyle = '#667';
    c.fillText('every evolution is a real thing - look them up later', W / 2, 420);
    c.restore();
    return rects;
  }

  // --- MINIMAP + FOG OF WAR (top-right, per the design doc) -----------------------
  function drawMinimap(c, g) {
    const gap = 6, pad = 10;
    const rooms = g.dungeon.rooms.filter(r => r.visited);
    if (!rooms.length) return;
    // bounds of the VISITED map only - fog of war: unvisited rooms don't exist here
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const r of rooms) {
      minX = Math.min(minX, r.gx); maxX = Math.max(maxX, r.gx);
      minY = Math.min(minY, r.gy); maxY = Math.max(maxY, r.gy);
    }
    // adaptive cell: shrink as the explored map grows so the minimap footprint
    // stays capped (~150x105px) instead of ballooning on a big floor (Sam wanted
    // it smaller). Leaves a row above for the level name.
    const cols = maxX - minX + 1, rows = maxY - minY + 1;
    const cell = Math.max(8, Math.min(18, Math.floor(150 / cols) - gap, Math.floor(105 / rows) - gap));
    const mw = cols * (cell + gap);
    const ox = W - pad - mw, oy = pad + 22;

    c.save();
    // level name above the minimap, right-aligned to its edge
    const theme = Dungeon.themeFor(g.floorNum);
    c.textAlign = 'right';
    c.font = 'bold 11px monospace';
    c.fillStyle = '#c9a86a';
    c.fillText(`FL.${g.floorNum} · ${theme.name}`, W - pad, oy - 11);
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
      const colors = { start: '#8899bb', combat: '#4a5468', treasure: '#c9a227', shop: '#d98e3d', boss: '#b03050', stairs: '#3dbf9d', mythicshop: '#ff2fb0' };
      c.fillStyle = colors[r.type] || '#4a5468';
      c.fillRect(x, y, cell, cell);
      if (!r.cleared && (r.type === 'combat' || r.type === 'boss')) {
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(x, y, cell, cell);
      }
      // room-type glyphs, readable at the bigger cell size
      const glyph = { shop: '$', stairs: '↓', treasure: '◆', boss: '!', mythicshop: '✦' }[r.type];
      if (glyph) {
        const gs = Math.max(11, Math.round(cell * 0.66)); // glyph scales with the (now adaptive) cell
        c.font = `bold ${gs}px monospace`; c.textAlign = 'center';
        c.fillStyle = 'rgba(0,0,0,0.65)';
        c.fillText(glyph, x + cell / 2 + 0.5, y + cell / 2 + gs * 0.36 + 0.5);
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.fillText(glyph, x + cell / 2, y + cell / 2 + gs * 0.36);
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
      const name = g.bossIntroName || 'THE MIMIC KING';
      const sub = g.bossIntroSub || 'the dungeon was bait all along';
      c.font = 'bold 44px monospace'; c.textAlign = 'center';
      c.fillStyle = '#1a0a10';
      c.fillText(name, W / 2 + 3, H / 2 - 37);
      c.fillStyle = '#ffd24c';
      c.fillText(name, W / 2, H / 2 - 40);
      c.font = '15px monospace';
      c.fillStyle = '#c88';
      c.fillText(sub, W / 2, H / 2 - 8);
    }
    c.restore();
  }

  // a laurel wreath badge: the mythic-collection accolade on the title screen
  function drawLaurel(c, cx, cy, count, total) {
    const earned = count > 0;
    const col = earned ? '#e8c66a' : '#4f4a3a';
    c.save();
    c.translate(cx, cy);
    // two arcs of leaves forming the open wreath (open at the top)
    for (const R of [32, 25]) {
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI * (0.86 - 0.72 * (k / 10)); // lower arc: upper-left -> bottom -> upper-right
        const x = Math.cos(a) * R, y = Math.sin(a) * R;
        c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2);
        c.fillStyle = col;
        c.beginPath(); c.ellipse(0, 0, R > 28 ? 6 : 4.5, 2.3, 0, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    }
    // little tie at the bottom
    c.fillStyle = col;
    c.beginPath(); c.arc(0, 33, 2.4, 0, Math.PI * 2); c.fill();
    // count in the middle
    c.textAlign = 'center';
    c.font = 'bold 16px monospace';
    c.fillStyle = earned ? '#ffd24c' : '#6a6350';
    c.fillText(`${count}/${total}`, 0, 2);
    c.font = 'bold 8px monospace';
    c.fillStyle = earned ? '#c9a227' : '#5a5340';
    c.fillText('MYTHICS', 0, 15);
    c.restore();
  }

  // --- title / hub -----------------------------------------------------------------
  // returns clickable rects for main.js hit-testing
  // #39: a small distinguishing feature per pet type, drawn around a circle of
  // radius r at (cx,cy). Shared by the stable chips and the in-game pet sprite.
  function drawPetFeature(c, type, cx, cy, r, color) {
    c.save();
    c.fillStyle = color; c.strokeStyle = color; c.lineWidth = Math.max(1, r * 0.12);
    if (type === 'imp') { // a single curved horn
      c.beginPath();
      c.moveTo(cx - r * 0.45, cy - r * 0.7);
      c.quadraticCurveTo(cx - r * 0.1, cy - r * 1.5, cx + r * 0.15, cy - r * 0.75);
      c.closePath(); c.fill();
    } else if (type === 'sprite') { // fairy wings either side
      c.globalAlpha = 0.85;
      c.beginPath(); c.ellipse(cx - r * 1.0, cy - r * 0.1, r * 0.5, r * 0.32, -0.6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(cx + r * 1.0, cy - r * 0.1, r * 0.5, r * 0.32, 0.6, 0, Math.PI * 2); c.fill();
    } else if (type === 'wisp') { // a soft glowing aura
      c.globalAlpha = 0.30; c.beginPath(); c.arc(cx, cy, r * 1.35, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 0.15; c.beginPath(); c.arc(cx, cy, r * 1.6, 0, Math.PI * 2); c.stroke();
    } else if (type === 'mole') { // a dark snout
      c.fillStyle = '#0e1016';
      c.beginPath(); c.ellipse(cx, cy + r * 0.45, r * 0.32, r * 0.22, 0, 0, Math.PI * 2); c.fill();
    } else if (type === 'owl') { // two ear tufts
      c.beginPath(); c.moveTo(cx - r * 0.65, cy - r * 0.55); c.lineTo(cx - r * 0.85, cy - r * 1.25); c.lineTo(cx - r * 0.25, cy - r * 0.7); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(cx + r * 0.65, cy - r * 0.55); c.lineTo(cx + r * 0.85, cy - r * 1.25); c.lineTo(cx + r * 0.25, cy - r * 0.7); c.closePath(); c.fill();
    }
    c.restore();
  }

  function drawTitle(c, g) {
    const meta = g.meta;
    c.save();
    c.fillStyle = '#0d0d16';
    c.fillRect(0, 0, W, H);

    // floating coin particles handled by Fx from main

    c.textAlign = 'center';
    // deliberately NOT the boss's real name - the reveal belongs to the boss intro
    c.font = 'bold 44px monospace';
    c.fillStyle = '#241a08';
    c.fillText('DUNGEON OF THE', W / 2 + 3, 121);
    c.fillStyle = '#ffd24c';
    c.fillText('DUNGEON OF THE', W / 2, 118);
    c.font = 'bold 60px monospace';
    c.fillStyle = '#241a08';
    c.fillText('GILDED KING', W / 2 + 4, 180);
    c.fillStyle = '#e8b52f';
    c.fillText('GILDED KING', W / 2, 176);

    // (controls legend removed to de-crowd the home screen; keys show in-run and on pause)

    // solo + co-op buttons, side by side
    const startR = { x: W / 2 - 212, y: 216, w: 200, h: 46, action: 'start' };
    const coopR  = { x: W / 2 + 12,  y: 216, w: 200, h: 46, action: 'coop' };
    const pulse = Math.sin(Date.now() / 300) * 0.12 + 0.88;
    c.fillStyle = `rgba(212,175,55,${0.15 * pulse})`;
    c.fillRect(startR.x, startR.y, startR.w, startR.h);
    c.strokeStyle = '#ffd24c'; c.lineWidth = 2;
    c.strokeRect(startR.x, startR.y, startR.w, startR.h);
    c.font = 'bold 18px monospace';
    c.fillStyle = '#ffd24c';
    c.fillText('ENTER DUNGEON', startR.x + startR.w / 2, startR.y + 29);
    // co-op button (cyan)
    c.fillStyle = `rgba(127,212,255,${0.12 * pulse})`;
    c.fillRect(coopR.x, coopR.y, coopR.w, coopR.h);
    c.strokeStyle = '#7fd4ff'; c.lineWidth = 2;
    c.strokeRect(coopR.x, coopR.y, coopR.w, coopR.h);
    c.font = 'bold 18px monospace';
    c.fillStyle = '#7fd4ff';
    c.fillText('PLAY ONLINE', coopR.x + coopR.w / 2, coopR.y + 24);
    c.font = '10px monospace'; c.fillStyle = '#5f8ba0';
    c.fillText('co-op with friends', coopR.x + coopR.w / 2, coopR.y + 38);

    const rects = [startR, coopR];

    // --- ESSENCE upgrades: a compact character-sheet panel down the LEFT edge ---
    c.textAlign = 'left';
    c.font = 'bold 15px monospace'; c.fillStyle = '#b88aff';
    c.fillText(`◆ ESSENCE  ${meta.essence}`, 18, 150);
    c.font = '10px monospace'; c.fillStyle = '#667';
    c.fillText('permanent boosts - they survive death', 18, 167);
    const rowW = 246, rowH = 42; // stays left of the centre ENTER DUNGEON button
    let ry = 180;
    for (const u of META_UPGRADES) {
      const rank = meta.ranks[u.key] || 0;
      const cost = metaCost(u, rank);
      const maxed = cost === null;                    // only capped upgrades ever max
      const afford = cost !== null && meta.essence >= cost;
      const past = rank >= u.maxRank;                 // into the endless tiers
      const r = { x: 14, y: ry, w: rowW, h: rowH, action: 'upgrade', key: u.key };
      c.fillStyle = maxed ? 'rgba(184,138,255,0.10)' : afford ? 'rgba(184,138,255,0.06)' : 'rgba(255,255,255,0.02)';
      c.fillRect(r.x, r.y, r.w, r.h);
      c.strokeStyle = maxed ? '#b88aff' : afford ? '#6a5a8a' : '#2c3040';
      c.lineWidth = 1; c.strokeRect(r.x, r.y, r.w, r.h);
      // name + effect (left two lines)
      c.textAlign = 'left';
      c.font = 'bold 12px monospace'; c.fillStyle = maxed ? '#b88aff' : '#dde3ee';
      c.fillText(u.name, r.x + 10, r.y + 17);
      c.font = '10px monospace'; c.fillStyle = '#8fa3bf';
      c.fillText(u.desc, r.x + 10, r.y + 32);
      // cost (top-right) + rank pips / Lv (bottom-right)
      c.textAlign = 'right';
      c.font = 'bold 11px monospace';
      c.fillStyle = maxed ? '#b88aff' : afford ? '#ffd24c' : '#555';
      c.fillText(maxed ? 'MAXED' : `◆ ${cost}`, r.x + rowW - 10, r.y + 17);
      if (past && u.endless) {
        c.font = 'bold 10px monospace'; c.fillStyle = '#b88aff';
        c.fillText(`Lv ${rank}`, r.x + rowW - 10, r.y + 33);
      } else {
        for (let i = 0; i < u.maxRank; i++) {
          c.fillStyle = i < rank ? '#b88aff' : '#2c3040';
          c.beginPath(); c.arc(r.x + rowW - 12 - (u.maxRank - 1 - i) * 11, r.y + 29, 3, 0, Math.PI * 2); c.fill();
        }
      }
      rects.push(r);
      ry += rowH + 6;
    }
    c.textAlign = 'center';

    // --- STABLE: pets you've befriended; pick one to start the next run with ---
    const roster = (typeof Descent !== 'undefined' && Descent.PETS) || [];
    if (roster.length) {
      const unlocked = meta.petsUnlocked || [];
      c.textAlign = 'center';
      c.font = 'bold 12px monospace';
      c.fillStyle = '#8fd0a0';
      c.fillText(`STABLE  ·  ${unlocked.length}/${roster.length}`, W / 2, 24);
      const chip = 28, cgap = 16, r = chip / 2, cyp = 50;
      const rowW = roster.length * chip + (roster.length - 1) * cgap;
      let px = (W - rowW) / 2;
      for (const pet of roster) {
        const has = unlocked.includes(pet.type);
        const sel = has && meta.selectedPet === pet.type;
        const cxp = px + r;
        // its distinguishing feature (horn/wings/glow/...) sits behind the body
        if (has) drawPetFeature(c, pet.type, cxp, cyp, r, pet.color);
        c.beginPath(); c.arc(cxp, cyp, r, 0, Math.PI * 2);
        c.fillStyle = has ? pet.color : '#20242f'; c.fill();
        if (has) { c.fillStyle = '#0e1016'; c.beginPath(); c.arc(cxp - 3, cyp - 2, 2, 0, Math.PI * 2); c.arc(cxp + 3, cyp - 2, 2, 0, Math.PI * 2); c.fill(); }
        else { c.fillStyle = '#3a3f4d'; c.font = 'bold 14px monospace'; c.fillText('?', cxp, cyp + 5); }
        c.lineWidth = sel ? 3 : 1.5;
        c.strokeStyle = sel ? '#ffd24c' : has ? '#5a6478' : '#2c3040';
        c.beginPath(); c.arc(cxp, cyp, r, 0, Math.PI * 2); c.stroke();
        if (has) rects.push({ x: px - 4, y: cyp - r - 6, w: chip + 8, h: chip + 12, action: 'selectPet', key: pet.type });
        px += chip + cgap;
      }
      // name + passive of the chosen pet, dropped clear of the pet circles (#40)
      const chosen = roster.find(pp => pp.type === meta.selectedPet && unlocked.includes(pp.type));
      c.font = '11px monospace';
      c.fillStyle = chosen ? chosen.color : '#667';
      c.fillText(chosen ? `${chosen.name} · ${chosen.desc}  (click to unselect)`
                        : 'befriend pets in the dungeon, then pick one to bring along', W / 2, 82);
    }
    // tagline stays anchored at the very bottom
    c.font = 'italic 12px monospace';
    c.fillStyle = '#8a7340';
    c.fillText('~ the King invites you to glimpse upon his realm ~', W / 2, H - 14);

    // mythic-collection laurel (top-right accolade)
    drawLaurel(c, W - 72, 62, (meta.mythics || []).length, Weapons.MYTHIC_TOTAL);

    // patch-notes button (top-right, under the mythic laurel)
    if (typeof PatchNotes !== 'undefined') {
      const pnR = { x: W - 164, y: 108, w: 150, h: 28, action: 'patchnotes' };
      c.strokeStyle = '#5a6478'; c.lineWidth = 1.5;
      c.strokeRect(pnR.x, pnR.y, pnR.w, pnR.h);
      c.font = 'bold 12px monospace';
      c.fillStyle = '#8fd0ff';
      c.fillText(`◆ PATCH NOTES ${PatchNotes.VERSION}`, pnR.x + pnR.w / 2, pnR.y + 18);
      rects.push(pnR);
    }

    // high-scores button + TOP 5 (right side, below patch notes - the left is essence now)
    const scoresR = { x: W - 164, y: 150, w: 150, h: 28, action: 'scores' };
    c.strokeStyle = '#5a6478'; c.lineWidth = 1.5;
    c.strokeRect(scoresR.x, scoresR.y, scoresR.w, scoresR.h);
    c.font = 'bold 12px monospace';
    c.fillStyle = '#ffd24c';
    c.fillText('★ HIGH SCORES', scoresR.x + scoresR.w / 2, scoresR.y + 19);
    rects.push(scoresR);
    c.textAlign = 'left';
    c.font = 'bold 11px monospace'; c.fillStyle = '#c9a227';
    c.fillText('TOP RAIDERS', W - 162, 200);
    (g.scores || []).slice(0, 5).forEach((s, i) => {
      c.font = '11px monospace';
      c.fillStyle = i === 0 ? '#ffd24c' : '#9fb0c8';
      c.fillText(`${i + 1}. ${s.initials}  ${s.score}${s.won ? ' ♛' : ''}`, W - 162, 218 + i * 16);
    });
    c.textAlign = 'center';

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
    // patch-notes overlay
    if (g.showPatch) drawPatchNotes(c, g);

    c.restore();
    return rects;
  }

  // the changelog overlay: newest version first, scroll not needed (kept short)
  function drawPatchNotes(c, g) {
    const notes = (typeof PatchNotes !== 'undefined' && PatchNotes.NOTES) || [];
    const pw = 600, ph = 476, px = (W - pw) / 2, py = 36;
    c.fillStyle = 'rgba(5,5,12,0.93)';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = '#8fd0ff'; c.lineWidth = 2;
    c.strokeRect(px, py, pw, ph);
    c.textAlign = 'center';
    c.font = 'bold 20px monospace'; c.fillStyle = '#8fd0ff';
    c.fillText('PATCH NOTES', W / 2, py + 30);
    c.textAlign = 'left';
    let y = py + 62;
    for (const rel of notes) {
      if (y > py + ph - 24) break;
      c.font = 'bold 14px monospace'; c.fillStyle = '#ffd24c';
      c.fillText(`${rel.v} - ${rel.title}`, px + 20, y);
      c.font = '11px monospace'; c.fillStyle = '#7a8194';
      c.textAlign = 'right'; c.fillText(rel.date, px + pw - 20, y); c.textAlign = 'left';
      y += 20;
      for (const it of rel.items) {
        if (y > py + ph - 20) break;
        c.fillStyle = '#8fd0ff'; c.font = '11px monospace';
        c.fillText('•', px + 24, y);
        c.fillStyle = '#cdd4e2';
        // wrapText returns the LAST line's baseline (== y when it fits on one line);
        // add a full line height so single- and multi-line items both clear properly
        y = wrapText(c, it, px + 36, y, pw - 60, 15) + 16;
      }
      y += 12;
    }
    c.textAlign = 'center';
    c.font = '11px monospace'; c.fillStyle = '#8fa3bf';
    c.fillText('click anywhere or press Esc to close', W / 2, py + ph - 8);
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
    return yy; // final baseline (callers that don't need it can ignore)
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
    c.fillText('A/D move · SPACE pick · (or click / 1-2-3)', W / 2, 158);

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
    // once-per-level-up reroll
    if (!g.levelRerolled) {
      const rr = { x: W / 2 - 110, y: 385, w: 220, h: 34, reroll: true };
      c.strokeStyle = '#7fd4ff'; c.lineWidth = 1.5;
      c.strokeRect(rr.x, rr.y, rr.w, rr.h);
      c.font = 'bold 13px monospace';
      c.fillStyle = '#7fd4ff';
      c.fillText('↻ REROLL CHOICES (R)', W / 2, rr.y + 22);
      rects.push({ ...rr, y: rr.y + dy });
    } else {
      c.font = '11px monospace';
      c.fillStyle = '#556';
      c.fillText('reroll spent', W / 2, 405);
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
    c.fillText('PAUSED', W / 2, H / 2 - 40);
    c.font = '14px monospace'; c.fillStyle = '#8fa3bf';
    c.fillText('P / Esc to resume · C sheet · M mute', W / 2, H / 2 - 8);
    // quit-to-title button (abandons the run; essence already banked is kept)
    const r = { x: W / 2 - 110, y: H / 2 + 24, w: 220, h: 42, action: 'menu' };
    c.strokeStyle = '#7fd4ff'; c.lineWidth = 2; c.strokeRect(r.x, r.y, r.w, r.h);
    c.font = 'bold 16px monospace'; c.fillStyle = '#7fd4ff';
    c.fillText('MAIN MENU', W / 2, r.y + 27);
    c.restore();
    return [r];
  }

  // --- CO-OP LOBBY -----------------------------------------------------------
  // g.lobby = { mode:'menu'|'host'|'join', entry:'<typed code>', status:'<msg>' }
  function drawLobby(c, g) {
    const lb = g.lobby || {};
    const online = typeof Net !== 'undefined';
    c.save();
    c.fillStyle = '#0d0d16'; c.fillRect(0, 0, W, H);
    c.textAlign = 'center';
    c.font = 'bold 30px monospace'; c.fillStyle = '#7fd4ff';
    c.fillText('PLAY ONLINE', W / 2, 92);
    c.font = '12px monospace'; c.fillStyle = '#8fa3bf';
    c.fillText('co-op dungeon runs with friends', W / 2, 116);
    const rects = [];
    const btn = (x, y, w, h, label, action, col, on = true) => {
      c.fillStyle = on ? `rgba(${col},0.14)` : 'rgba(120,120,130,0.06)';
      c.fillRect(x, y, w, h);
      c.strokeStyle = on ? `rgb(${col})` : '#3a3f4d'; c.lineWidth = 2; c.strokeRect(x, y, w, h);
      c.font = 'bold 16px monospace'; c.fillStyle = on ? `rgb(${col})` : '#555';
      c.fillText(label, x + w / 2, y + h / 2 + 6);
      if (on) rects.push({ x, y, w, h, action });
    };

    if (!online) {
      c.font = '14px monospace'; c.fillStyle = '#e07070';
      c.fillText('networking not loaded', W / 2, 200);
    } else if (lb.mode === 'menu' || !lb.mode) {
      // #29: editable character name (type to edit; shown over you in-game)
      c.font = '12px monospace'; c.fillStyle = '#8fa3bf';
      c.fillText('YOUR NAME  (type to edit)', W / 2, 162);
      const nx = W / 2 - 150, ny = 172, nw = 300, nh = 42;
      c.strokeStyle = '#ffd24c'; c.lineWidth = 2; c.strokeRect(nx, ny, nw, nh);
      const nm = (g.playerName || '');
      c.font = 'bold 20px monospace'; c.fillStyle = nm ? '#e8edf6' : '#667';
      const cur = (Math.floor(Date.now() / 450) % 2) ? '_' : '';
      c.fillText((nm || 'ANON') + (nm ? cur : ''), W / 2, ny + 28);
      btn(W / 2 - 150, 236, 300, 52, 'HOST A GAME', 'lobby-host', '127,212,255');
      btn(W / 2 - 150, 300, 300, 52, 'JOIN A GAME', 'lobby-join', '110,231,160');
    } else if (lb.mode === 'host') {
      c.font = '13px monospace'; c.fillStyle = '#8fa3bf';
      c.fillText('share this code with your friends', W / 2, 180);
      c.font = 'bold 54px monospace'; c.fillStyle = '#ffd24c';
      c.fillText(Net.code || '····', W / 2, 240);
      c.font = '13px monospace'; c.fillStyle = '#cdd4e2';
      c.fillText(`players in lobby: ${Net.playerCount}`, W / 2, 290);
      btn(W / 2 - 130, 320, 260, 50, 'START GAME', 'lobby-start', '127,212,255');
    } else if (lb.mode === 'join') {
      c.font = '13px monospace'; c.fillStyle = '#8fa3bf';
      c.fillText('type your friend\'s 4-letter code', W / 2, 180);
      // 4 code boxes
      const bw = 46, gap = 12, total = 4 * bw + 3 * gap, sx = (W - total) / 2;
      for (let i = 0; i < 4; i++) {
        const x = sx + i * (bw + gap);
        c.strokeStyle = i === (lb.entry || '').length ? '#7fd4ff' : '#5a6478';
        c.lineWidth = 2; c.strokeRect(x, 200, bw, 56);
        c.font = 'bold 32px monospace'; c.fillStyle = '#e8edf6';
        c.fillText((lb.entry || '')[i] || '', x + bw / 2, 240);
      }
      if (Net.connected) {
        c.font = '14px monospace'; c.fillStyle = '#6ee7a0';
        c.fillText(`connected · ${Net.playerCount} in lobby`, W / 2, 300);
        c.fillStyle = '#8fa3bf'; c.font = '13px monospace';
        c.fillText('waiting for the host to start...', W / 2, 324);
      } else {
        c.font = '12px monospace'; c.fillStyle = lb.status ? '#e0b070' : '#667';
        c.fillText(lb.status || 'type the code, then press Enter', W / 2, 300);
      }
    }
    // BACK always available
    btn(14, H - 44, 110, 30, '‹ BACK', 'lobby-back', '143,163,191');
    c.restore();
    return rects;
  }

  // stat colour per evolution path (matches the champion's visual-evolution palette)
  const STAT_COL = {
    hp: '#7fd4ff', dmg: '#e05555', spd: '#7fe0ff', roll: '#b8f0ff',
    crit: '#ff5a7a', coin: '#ffd24c', regen: '#6ee7a0', atkspd: '#ffe08a',
  };

  // CHARACTER SHEET (C): live stats on the left, evolutions taken on the right
  function drawCharSheet(c, g) {
    const p = g.player, e = overlayEase(g);
    c.save();
    c.globalAlpha = e;
    c.fillStyle = 'rgba(5,5,12,0.9)';
    c.fillRect(0, 0, W, H);
    const px = 60, py = 40, pw = W - 120, ph = H - 80;
    c.strokeStyle = '#b88aff'; c.lineWidth = 2;
    c.strokeRect(px, py, pw, ph);
    c.textAlign = 'center';
    c.font = 'bold 22px monospace'; c.fillStyle = '#dde3ee';
    c.fillText('CHARACTER', W / 2, py + 30);

    // ---- left column: derived stats ----
    const pct = v => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';
    const crit = 0.05 + p.stats.crit + p.mod('critCh'); // 0.05 = base crit
    const critDmg = 1.7 + p.mod('critDmg');
    const rollMul = p.stats.rollCdMul * (1 - p.mod('rollCd'));
    const stats = [
      ['Max Health',     Math.round(p.maxHp)],
      ['Damage',         pct(p.stats.dmgMul * (1 + p.mod('dmg')) - 1)],
      ['Attack Speed',   pct(p.stats.atkSpeedMul + p.mod('atkSpd') - 1)],
      ['Move Speed',     pct(p.stats.speedMul + p.mod('spd') - 1)],
      ['Crit Chance',    Math.round(crit * 100) + '%'],
      ['Crit Damage',    '×' + critDmg.toFixed(2)],
      ['Roll Cooldown',  pct(rollMul - 1)],
      ['Damage Reduce',  Math.round(Math.min(0.6, p.mod('reduce')) * 100) + '%'],
      ['Coin Bonus',     pct(p.stats.coinMul + p.mod('coin') - 1)],
      ['Regen',          (p.stats.regen + p.mod('regenFlat')).toFixed(1) + '/s'],
    ];
    if (p.mod('thorns')) stats.push(['Thorns', p.mod('thorns')]);
    let ly = py + 66;
    c.textAlign = 'left';
    c.font = 'bold 13px monospace'; c.fillStyle = '#b88aff';
    c.fillText('STATS', px + 30, ly); ly += 24;
    c.font = '13px monospace';
    for (const [label, val] of stats) {
      c.fillStyle = '#8fa3bf'; c.textAlign = 'left';
      c.fillText(label, px + 30, ly);
      c.fillStyle = '#e8edf6'; c.textAlign = 'right';
      c.fillText(String(val), px + pw / 2 - 40, ly);
      ly += 21;
    }
    // active pet + Q ability under the stats
    ly += 8;
    if (p.pet) { c.textAlign = 'left'; c.fillStyle = p.pet.color; c.font = 'bold 12px monospace';
      c.fillText(`PET  ${p.pet.name} · ${p.pet.desc}`, px + 30, ly); ly += 22; }
    if (p.ability) { c.textAlign = 'left'; c.fillStyle = p.ability.color; c.font = 'bold 12px monospace';
      c.fillText(`Q  ${p.ability.name}`, px + 30, ly); ly += 22; }

    // ---- right column: how close each stat is to its next evolution ----
    // evolutions fire at the 3rd / 6th / 9th / 12th pick of a stat (tiers I-IV)
    const rx = px + pw / 2 + 10;
    let ry = py + 66;
    const THRESH = [3, 6, 9, 12];
    c.textAlign = 'left';
    c.font = 'bold 13px monospace'; c.fillStyle = '#b88aff';
    c.fillText('NEXT EVOLUTION', rx, ry); ry += 22;
    c.font = '11px monospace';
    for (const k of Object.keys(Evolutions.STAT_NAMES)) {
      const n = (p.upgradeStacks && p.upgradeStacks[k]) || 0;
      const next = THRESH.find(t => t > n); // undefined once fully evolved (>=12)
      const col = STAT_COL[k] || '#8fa3bf';
      c.textAlign = 'left'; c.fillStyle = col;
      c.fillText(Evolutions.STAT_NAMES[k], rx, ry);
      // segment bar: progress within the current 3-pick tier toward the next evolution
      const barX = rx + 118, barW = 130, barH = 7, barY = ry - 8;
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(barX, barY, barW, barH);
      const seg = next ? (n - (next - 3)) / 3 : 1;
      c.fillStyle = next ? col : '#ffd24c';
      c.fillRect(barX, barY, barW * Math.max(0, Math.min(1, seg)), barH);
      c.textAlign = 'right'; c.fillStyle = '#cdd4e2';
      c.fillText(next ? `${n}/${next}` : `${n} MAX`, rx + pw / 2 - 40, ry);
      ry += 16;
    }

    // ---- evolutions already taken ----
    ry += 12;
    c.textAlign = 'left';
    c.font = 'bold 13px monospace'; c.fillStyle = '#b88aff';
    c.fillText(`EVOLUTIONS TAKEN (${p.evoTaken.length})`, rx, ry); ry += 20;
    if (!p.evoTaken.length) {
      c.font = 'italic 11px monospace'; c.fillStyle = '#667';
      c.fillText('stack a stat to 3 / 6 / 9 / 12 to evolve', rx, ry);
    } else {
      c.font = '12px monospace';
      for (const ev of p.evoTaken) {
        if (ry > py + ph - 26) break;
        const col = STAT_COL[ev.key] || '#b88aff';
        c.textAlign = 'left'; c.fillStyle = col; c.fillText(ev.tier || '', rx, ry);
        c.fillStyle = '#e8edf6'; c.fillText(ev.name, rx + 28, ry);
        c.fillStyle = '#5a6478'; c.font = '10px monospace';
        c.fillText((Evolutions.STAT_NAMES[ev.key] || ''), rx + 28, ry + 12);
        c.font = '12px monospace';
        ry += 28;
      }
    }

    c.textAlign = 'center';
    c.font = '12px monospace'; c.fillStyle = '#8fa3bf';
    c.fillText('C / Esc to resume', W / 2, py + ph - 12);
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
    const endDescent = typeof Descent !== 'undefined' && Descent.isDescent(g.floorNum);
    if (!won && g.kingSlain) {
      c.font = '15px monospace'; c.fillStyle = '#ff8a3d';
      c.fillText('You slew the King and braved the Descent. Legend.', W / 2, 185);
    }
    c.font = '15px monospace';
    c.fillStyle = '#9fb0c8';
    const lines = [
      endDescent ? `Depth reached      Descent floor ${g.floorNum}` : `Floor reached      ${g.floorNum} / 3`,
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

    const bw = 200, bh = 44, gap = 20, by = 420;
    const r1 = { x: W / 2 - bw - gap / 2, y: by, w: bw, h: bh, action: 'again' };
    const r2 = { x: W / 2 + gap / 2, y: by, w: bw, h: bh, action: 'menu' };
    c.lineWidth = 2;
    c.strokeStyle = '#ffd24c'; c.strokeRect(r1.x, r1.y, r1.w, r1.h);
    c.font = 'bold 17px monospace'; c.fillStyle = '#ffd24c';
    c.fillText('NEW RUN', r1.x + r1.w / 2, r1.y + 28);
    c.strokeStyle = '#7fd4ff'; c.strokeRect(r2.x, r2.y, r2.w, r2.h);
    c.fillStyle = '#7fd4ff'; c.fillText('MAIN MENU', r2.x + r2.w / 2, r2.y + 28);
    c.font = '12px monospace'; c.fillStyle = '#667';
    c.fillText('(Enter) new run · (Esc) main menu to spend essence', W / 2, by + 62);
    c.restore();
    return [{ ...r1, y: r1.y + dy }, { ...r2, y: r2.y + dy }]; // hitboxes track the entrance drift
  }

  return { META_UPGRADES, metaCost, GAME_URL, drawHUD, drawMinimap, drawBossBar, drawBossIntro, drawTitle, drawLobby, drawLevelUp, drawEvolution, drawUltPick, drawPause, drawCharSheet, drawEnd, drawInitials };
})();
