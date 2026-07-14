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
  // #88 aligned to the 5 base stats (MIGHT/VIGOR/AGILITY/ARCANE/FORTUNE) so the
  // permanent boosts read as the same system as in-run evolutions. Keys are kept
  // stable (vitality/acrobat/greed) so existing saved ranks + the Player
  // constructor keep working; only the names/colors changed. 'arcane' is new.
  const STAT_TINT = { MIGHT: '#ff6b5c', VIGOR: '#6ee7a0', AGILITY: '#7fd4ff', ARCANE: '#b06bff', FORTUNE: '#ffd24c', '': '#b88aff' };
  const META_UPGRADES = [
    // #104 meta boosts HARD-CAP at rank 3 (no more endless:true) so account grind
    // can't outweigh in-run choices - the applied effect is also clamped in player.js.
    { key: 'might',    stat: 'MIGHT',   name: 'Might',   desc: '+5% damage',                maxRank: 3, costs: [25, 50, 90] },
    { key: 'vitality', stat: 'VIGOR',   name: 'Vigor',   desc: '+10 starting health',       maxRank: 3, costs: [25, 50, 90] },
    { key: 'acrobat',  stat: 'AGILITY', name: 'Agility', desc: '-8% roll cooldown',         maxRank: 2, costs: [30, 60] },
    { key: 'arcane',   stat: 'ARCANE',  name: 'Arcane',  desc: '+1 Magic (stronger spells)', maxRank: 3, costs: [30, 60, 110] },
    { key: 'greed',    stat: 'FORTUNE', name: 'Fortune', desc: '+10% coins from kills',     maxRank: 3, costs: [30, 60, 100] },
    { key: 'armory',   stat: '',        name: 'Armory',  desc: 'Start with an Uncommon weapon', maxRank: 1, costs: [80] },
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
    // #13: the top-left stats panel can hide a mob in the room's corner - fade it,
    // dropping further when a live monster is actually under it
    let hudA = 0.94;
    if (g.monsters && g.monsters.some(m => !m.dead && m.x < 230 && m.y < 115)) hudA = 0.58;
    c.globalAlpha = hudA;
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

    // #77 ALARM meter: rises per room cleared this floor. Higher = tougher rooms but
    // richer loot + XP. A thin bar under the XP bar with a warning count.
    {
      const al = g.alarm || 0, amY = hbY + hbH + 16, amH = 5;
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(hbX - 2, amY - 2, hbW + 4, amH + 4);
      c.fillStyle = '#2a1810'; c.fillRect(hbX, amY, hbW, amH);
      c.fillStyle = al >= 6 ? '#ff3020' : al >= 4 ? '#ff8a3d' : '#ffc64c';
      c.fillRect(hbX, amY, hbW * Math.min(1, al / 8), amH);
      if (al > 0) { c.font = 'bold 9px monospace'; c.fillStyle = al >= 4 ? '#ff8a3d' : '#c9a98a'; c.fillText('⚠ ' + al, hbX + hbW + 10, amY + 6); }
    }

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
    const climbing = typeof Ascent !== 'undefined' && Ascent.isAscent(g.floorNum);
    c.font = 'bold 13px monospace';
    // the tag wears the place's own accent, not a fixed fire orange
    c.fillStyle = inDescent ? (Dungeon.themeFor(g.floorNum).accent || '#ff8a3d') : '#8fa3bf';
    // THE FLIP: past the bottom of Hell you are not falling any more. Depth becomes
    // ALTITUDE and the arrow turns around. (Score is still g.floorNum, untouched, so
    // the leaderboard does not care that the direction changed.)
    const heaven = typeof Paradiso !== 'undefined' && Paradiso.isParadiso(g.floorNum);
    const tag = heaven   ? (Paradiso.inEmpyrean(g.floorNum) ? 'THE EMPYREAN' : `PARADISO ▲ ALTITUDE ${Ascent.altitude(g.floorNum)}`)
              : climbing ? `ASCENT ▲ ALTITUDE ${Ascent.altitude(g.floorNum)}`
              : inDescent ? `DESCENT ▼ FLOOR ${g.floorNum}`
              : `FLOOR ${g.floorNum}/3`;
    c.fillText(tag, hbX, H - 16);

    // AN ACCEPTED QUEST rides above the depth tag for as long as it is live, so you
    // never forget what you agreed to. It is gold while it is winnable.
    if (g.quest && !g.quest.paid && typeof Encounters !== 'undefined') {
      const q = Encounters.byKey(g.quest.key);
      if (q) {
        c.font = 'bold 11px monospace';
        c.fillStyle = '#ffd24c';
        c.fillText(q.objective(g), hbX, H - 32);
      }
    }

    // weapon slots (bottom-left) - two free slots, any mix - plus the armor slot
    drawWeaponSlot(c, p.weapons.a, 14, H - 106, p.slot === 'a');
    drawWeaponSlot(c, p.weapons.b, 62, H - 106, p.slot === 'b');
    drawArmorSlot(c, p.armor, 110, H - 106);
    // MOBILE: there is no Tab, no F and no Q key, and the touch buttons already show
    // the abilities WITH their cooldowns (touch.js). Showing keyboard hints and a
    // second set of ability badges to a phone is just clutter sitting under the
    // player's thumbs.
    const onTouch = typeof Mobile !== 'undefined' && Mobile.enabled;
    if (!onTouch) {
      c.font = '10px monospace';
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.fillText('Tab/RMB swap', 14, H - 112);
      // #51 auto-attack state (subtle when on, loud when off so you know why you're idle)
      c.textAlign = 'left';
      c.fillStyle = p.autoAttack ? 'rgba(126,224,160,0.55)' : '#ff9a3d';
      c.fillText(p.autoAttack ? 'F auto-atk ON' : 'F AUTO-ATK OFF', 110, H - 112);

      // ability badges (Q / R / Ultimate), bottom-centre; hover shows what each does
      for (const b of abilityBadges(p)) drawAbility(c, b.a, b.key, b.x);
    }

    c.restore();
  }

  // layout of the present ability key-caps, shared by the HUD + the hover tooltip
  const ABILITY_S = 34; // #63 smaller badges, tucked bottom-right so they don't cover the south door/stairs
  function abilityBadges(p) {
    const s = ABILITY_S, gap = 8, list = [];
    if (p.ability) list.push({ a: p.ability, key: 'Q' });
    if (p.abilityR) list.push({ a: p.abilityR, key: 'R' });
    if (p.abilityUlt) list.push({ a: p.abilityUlt, key: '★' });
    const total = list.length * s + (list.length - 1) * gap;
    let x = W - total - 14; // bottom-RIGHT corner, out of the play area's centre
    for (const b of list) { b.x = x; b.y = H - s - 12; b.s = s; x += s + gap; }
    return list;
  }

  // one ability key-cap: cooldown sweep + the key letter (Q/R/★ = right-click ult)
  function drawAbility(c, a, key, x) {
    const s = ABILITY_S, y = H - s - 12;
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

  // #70 one unmistakable silhouette per weapon type, so you never mistake a wand for a
  // mace at a glance: bow = strung arc + arrow, sword = slim blade, axe = chunky wedge
  // head, wand = glowing orb + sparkle, staff = tall faceted crystal. Draws at the
  // current origin/scale in the current colour (caller sets translate/scale/fill/stroke).
  // Shared by the HUD slots (here) and the ground-drop glyph (main.js).
  function weaponSilhouette(c, arch) {
    if (arch === 'bow') {
      c.lineWidth = 2.5;
      c.beginPath(); c.arc(-2, 0, 11, -Math.PI / 2.3, Math.PI / 2.3); c.stroke();
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-2 + Math.cos(-Math.PI / 2.3) * 11, Math.sin(-Math.PI / 2.3) * 11);
      c.lineTo(-2 + Math.cos(Math.PI / 2.3) * 11, Math.sin(Math.PI / 2.3) * 11);
      c.stroke();
      c.lineWidth = 1.5; c.beginPath(); c.moveTo(-9, 0); c.lineTo(9, 0); c.stroke(); // nocked arrow
    } else if (arch === 'wand') {
      c.save(); c.rotate(-Math.PI / 6);
      c.lineWidth = 2; c.beginPath(); c.moveTo(-1, 13); c.lineTo(1, -3); c.stroke();
      c.beginPath(); c.arc(2, -8, 5, 0, Math.PI * 2); c.fill();
      const gc = c.fillStyle; c.globalAlpha = 0.5; c.fillStyle = '#fff';
      c.beginPath(); c.arc(0.5, -9.5, 1.8, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; c.fillStyle = gc;
      c.strokeStyle = '#fff'; c.globalAlpha = 0.85; c.lineWidth = 1;
      c.beginPath();
      c.moveTo(2, -16); c.lineTo(2, -12); c.moveTo(2, -4); c.lineTo(2, -1);
      c.moveTo(-4, -8); c.lineTo(-1, -8); c.moveTo(5, -8); c.lineTo(8, -8); c.stroke();
      c.globalAlpha = 1; c.restore();
    } else if (arch === 'staff') {
      c.lineWidth = 3; c.beginPath(); c.moveTo(0, 15); c.lineTo(0, -5); c.stroke();
      c.beginPath(); c.moveTo(0, -17); c.lineTo(5.5, -9); c.lineTo(0, -1); c.lineTo(-5.5, -9); c.closePath(); c.fill();
      const gc = c.fillStyle; c.globalAlpha = 0.5; c.fillStyle = '#fff';
      c.beginPath(); c.moveTo(0, -14); c.lineTo(2.6, -9.5); c.lineTo(0, -5); c.lineTo(-2.6, -9.5); c.closePath(); c.fill();
      c.globalAlpha = 1; c.fillStyle = gc;
    } else if (arch === 'heavy') {
      c.save(); c.rotate(-Math.PI / 4);
      c.fillRect(-1.5, -6, 3, 20);                                                        // haft
      c.beginPath(); c.moveTo(1.5, -14); c.quadraticCurveTo(12, -11, 9.5, -3); c.quadraticCurveTo(4.5, -5, 1.5, -5); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-1.5, -14); c.quadraticCurveTo(-12, -11, -9.5, -3); c.quadraticCurveTo(-4.5, -5, -1.5, -5); c.closePath(); c.fill();
      c.beginPath(); c.arc(0, 9, 2, 0, Math.PI * 2); c.fill();                            // pommel
      c.restore();
    } else {
      c.save(); c.rotate(-Math.PI / 4);
      c.beginPath(); c.moveTo(0, -16); c.lineTo(2, -6); c.lineTo(-2, -6); c.closePath(); c.fill(); // tip
      c.fillRect(-1.5, -8, 3, 12);                                                        // blade
      c.fillRect(-6, 4, 12, 2.5);                                                         // crossguard
      c.fillRect(-1.5, 6.5, 3, 4);                                                        // grip
      c.beginPath(); c.arc(0, 12, 1.8, 0, Math.PI * 2); c.fill();                         // pommel
      c.restore();
    }
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
      weaponSilhouette(c, w.archetype); // #70 same unmistakable silhouette as the ground drop
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
    return drawPickPanel(c, g, g.ultChoices || [], 'CHOOSE YOUR ULTIMATE', 'pick one · RIGHT-CLICK unleashes it in battle', '#ff2fb0');
  }
  // #84 R is now a choice of three, forged from your first two evolutions
  function drawRPick(c, g) {
    return drawPickPanel(c, g, g.rChoices || [], 'FORGE YOUR R ABILITY', 'your first two evolutions fuse - pick one · press R to cast', '#b88aff');
  }
  // shared 3-card picker used by the ultimate + R selection screens
  function drawPickPanel(c, g, opts, title, subtitle, accent) {
    const e = overlayEase(g);
    c.save();
    c.globalAlpha = e;
    c.fillStyle = 'rgba(5,5,12,0.86)'; c.fillRect(0, 0, W, H);
    c.textAlign = 'center';
    c.font = 'bold 24px monospace'; c.fillStyle = accent;
    c.fillText(title, W / 2, 92);
    c.font = '12px monospace'; c.fillStyle = '#8fa3bf';
    c.fillText(subtitle, W / 2, 116);
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
    c.fillStyle = Evolutions.STAT_COLOR[ev.stat] || '#b88aff';
    c.fillText(`${ev.stat} EVOLUTION ${Evolutions.TIER_LABEL[ev.stacks]}`, W / 2, 118);
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
      // which sub-stat lineage this option comes from (e.g. DEADLY within a MIGHT menu)
      if (opt.statKey && Evolutions.STAT_NAMES[opt.statKey]) {
        c.font = '10px monospace'; c.fillStyle = (Evolutions.STAT_COLOR[ev.stat] || '#b88aff') + 'cc';
        c.fillText(Evolutions.STAT_NAMES[opt.statKey], x + cardW / 2, y + 62);
      }
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
    // #13: the minimap/HUD sit over the room's top corners; fade them so mobs lurking
    // behind them stay visible - and fade EXTRA when a live monster is under the map
    let mapAlpha = 0.82;
    if (g.monsters && g.monsters.some(m => !m.dead && m.x > ox - 10 && m.y < oy + rows * (cell + gap) + 10)) mapAlpha = 0.5;
    c.globalAlpha = mapAlpha;
    // #61 live run SCORE (what you'll post to the leaderboard = essence earned so far
    // + 10% of unspent coins), above the floor name so you can track it mid-run
    const p = g.player;
    if (p) {
      const score = (p.essenceRun || 0) + Math.floor((p.coins || 0) * 0.1);
      c.textAlign = 'right';
      c.font = 'bold 13px monospace'; c.fillStyle = '#ffd24c';
      c.fillText(`★ ${score}`, W - pad, oy - 27);
    }
    // level name above the minimap, right-aligned to its edge
    const theme = Dungeon.themeFor(g.floorNum);
    c.textAlign = 'right';
    c.font = 'bold 11px monospace';
    c.fillStyle = '#c9a86a';
    // "Floor 12", not "FL.12" (Sam). On the mountain it is an altitude, not a floor.
    const upHere = (typeof Ascent !== 'undefined' && Ascent.isAscent(g.floorNum))
                || (typeof Paradiso !== 'undefined' && Paradiso.isParadiso(g.floorNum));
    const label = upHere ? `Altitude ${Ascent.altitude(g.floorNum)}` : `Floor ${g.floorNum}`;
    c.fillText(`${label} · ${theme.name}`, W - pad, oy - 11);
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
      const glyph = { shop: '$', stairs: '↓', treasure: '◆', boss: '!', mythicshop: '✦', barracks: '⚔' }[r.type];
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

  // rounded-rect path helper (native roundRect where available, manual arcs otherwise)
  function roundRectPath(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // a laurel wreath badge: the mythic-collection accolade. opts.scale shrinks it for
  // the dock badge; opts.noText suppresses the built-in count/label so the caller can
  // render its own count+caption beside it (matches the other dock badges).
  function drawLaurel(c, cx, cy, count, total, opts) {
    const scale = (opts && opts.scale) || 1;
    const noText = !!(opts && opts.noText);
    const earned = count > 0;
    const col = earned ? '#e8c66a' : '#4f4a3a';
    c.save();
    c.translate(cx, cy);
    c.scale(scale, scale);
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
    if (!noText) {
      c.textAlign = 'center';
      c.font = 'bold 16px monospace';
      c.fillStyle = earned ? '#ffd24c' : '#6a6350';
      c.fillText(`${count}/${total}`, 0, 2);
      c.font = 'bold 8px monospace';
      c.fillStyle = earned ? '#c9a227' : '#5a5340';
      c.fillText('MYTHICS', 0, 15);
    }
    c.restore();
  }

  // --- #86 title dock icon-badges: small canvas glyphs so the six bottom-dock controls
  // (essence, mythics, accolades, scores, patch, share) read as one badge family ------
  function iconCrystal(c, cx, cy, col) { // ESSENCE: a faceted purple diamond cluster
    c.save(); c.translate(cx, cy); c.fillStyle = col;
    const dia = (x, s) => { c.beginPath(); c.moveTo(x, -s); c.lineTo(x + s * 0.7, 0); c.lineTo(x, s); c.lineTo(x - s * 0.7, 0); c.closePath(); c.fill(); };
    c.globalAlpha = 0.7; dia(-7, 5); dia(7, 5); c.globalAlpha = 1; dia(0, 8);
    c.restore();
  }
  function iconTrophy(c, cx, cy, col) { // ACCOLADES: a little cup
    c.save(); c.translate(cx, cy); c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-6, -7); c.lineTo(6, -7); c.lineTo(4, 2); c.lineTo(-4, 2); c.closePath(); c.fill();
    c.beginPath(); c.arc(-6, -5, 3, Math.PI * 0.5, Math.PI * 1.5); c.stroke();
    c.beginPath(); c.arc(6, -5, 3, -Math.PI * 0.5, Math.PI * 0.5); c.stroke();
    c.fillRect(-1.5, 2, 3, 4); c.fillRect(-5, 6, 10, 2);
    c.restore();
  }
  function iconStar(c, cx, cy, col) { // HIGH SCORES: a five-point star
    c.save(); c.translate(cx, cy); c.fillStyle = col; c.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 3.4 : 8; const a = -Math.PI / 2 + i * Math.PI / 5; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.fill(); c.restore();
  }
  function iconScroll(c, cx, cy, col) { // PATCH NOTES: a small scroll with lines
    c.save(); c.translate(cx, cy); c.fillStyle = col;
    c.globalAlpha = 0.85; c.fillRect(-6, -7, 12, 14); c.globalAlpha = 1;
    c.fillStyle = '#0d0d16'; for (let i = -1; i <= 1; i++) c.fillRect(-4, i * 4, 8, 1.4);
    c.restore();
  }
  function iconLink(c, cx, cy, col) { // SHARE: two interlocked links
    c.save(); c.translate(cx, cy); c.strokeStyle = col; c.lineWidth = 2;
    c.beginPath(); c.ellipse(-3, 0, 4.5, 3, -0.6, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(3, 0, 4.5, 3, -0.6, 0, Math.PI * 2); c.stroke();
    c.restore();
  }
  // one shared 124x46 dock cell: faint accent fill + border, an icon, a bold value line
  // and a small-caps caption. `hot` brightens it (e.g. an affordable essence badge).
  function dockBadge(c, rects, x, action, accent, capCol, iconFn, line1, cap, hot) {
    const y = 487, w = 124, h = 46;
    c.fillStyle = accent + (hot ? '24' : '12');   // 8-digit hex alpha
    c.fillRect(x, y, w, h);
    c.strokeStyle = hot ? accent : accent + '99'; c.lineWidth = hot ? 2 : 1;
    c.strokeRect(x, y, w, h);
    iconFn(c, x + 26, y + h / 2, accent);
    c.textAlign = 'left';
    c.font = 'bold 13px monospace'; c.fillStyle = accent;
    c.fillText(line1, x + 48, y + 20);
    c.font = 'bold 9px monospace'; c.fillStyle = capCol;
    c.fillText(cap, x + 48, y + 34);
    rects.push({ x, y, w, h, action });
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

    // faint radial vignette spotlighting the title + play buttons
    {
      const vg = c.createRadialGradient(W / 2, 150, 40, W / 2, 150, 380);
      vg.addColorStop(0, 'rgba(40,40,60,0.5)');
      vg.addColorStop(1, 'rgba(40,40,60,0)');
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
    }

    // floating coin particles handled by Fx from main

    c.textAlign = 'center';
    // TITLE at the very top of the page. deliberately NOT the boss's real name - the
    // reveal belongs to the boss intro
    c.font = 'bold 44px monospace';
    c.fillStyle = '#241a08';
    c.fillText('DUNGEON OF THE', W / 2 + 3, 53);
    c.fillStyle = '#ffd24c';
    c.fillText('DUNGEON OF THE', W / 2, 50);
    c.font = 'bold 60px monospace';
    c.fillStyle = '#241a08';
    c.fillText('GILDED KING', W / 2 + 4, 112);
    c.fillStyle = '#e8b52f';
    c.fillText('GILDED KING', W / 2, 108);
    // tagline directly under the title
    c.font = 'italic 12px monospace'; c.fillStyle = '#8a7340';
    c.fillText('~ the King invites you to glimpse upon his realm ~', W / 2, 132);

    // solo + co-op buttons, side by side
    const startR = { x: W / 2 - 212, y: 152, w: 200, h: 46, action: 'start' };
    const coopR  = { x: W / 2 + 12,  y: 152, w: 200, h: 46, action: 'coop' };
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

    // --- #30 CLASS picker: pick your starting kit for the next run. Redesign: dead-
    // centered on true center (x=480) with slightly wider cards (was pushed right to
    // dodge the old left panel, which is now gone). #78 two-row grid so 10 classes fit.
    const classes = (typeof PlayerDef !== 'undefined' && PlayerDef.CLASSES) || [];
    if (classes.length) {
      const cx0 = W / 2;
      c.textAlign = 'center';
      c.font = 'bold 12px monospace'; c.fillStyle = '#ffd24c';
      c.fillText('CHOOSE YOUR CLASS', cx0, 228);
      // fits between the side panels (loadout right / raiders left)
      const perRow = Math.ceil(classes.length / 2), gap = 8, cw = 100, chh = 54, y0 = 236, rowStride = 60;
      const sel = meta.selectedClass || '';
      classes.forEach((cl, i) => {
        const row = Math.floor(i / perRow), col = i % perRow;
        const rowN = row === 0 ? Math.min(perRow, classes.length) : classes.length - perRow;
        const rowW = rowN * cw + (rowN - 1) * gap;
        const x = cx0 - rowW / 2 + col * (cw + gap), y = y0 + row * rowStride;
        const on = cl.id === sel;
        const r = { x, y, w: cw, h: chh, action: 'selectClass', key: cl.id };
        c.fillStyle = on ? 'rgba(255,210,76,0.12)' : 'rgba(255,255,255,0.02)';
        c.fillRect(r.x, r.y, r.w, r.h);
        c.lineWidth = on ? 2.5 : 1; c.strokeStyle = on ? '#ffd24c' : '#3a4050';
        c.strokeRect(r.x, r.y, r.w, r.h);
        if (PlayerDef.drawClassPortrait) PlayerDef.drawClassPortrait(c, cl, r.x + r.w / 2, r.y + 24, 12);
        c.textAlign = 'center';
        c.font = 'bold 10px monospace'; c.fillStyle = on ? '#ffe9a8' : '#c8d0de';
        c.fillText(cl.name, r.x + r.w / 2, r.y + r.h - 6);
        rects.push(r);
      });
      const gridBottom = y0 + rowStride + chh; // 350
      const chosen = classes.find(cl => cl.id === sel) || classes[0];
      c.textAlign = 'center';
      c.font = '11px monospace'; c.fillStyle = chosen.color;
      c.fillText(chosen.desc, cx0, gridBottom + 14);
      if (chosen.q) {
        c.font = 'bold 11px monospace'; c.fillStyle = '#9ecbff';
        c.fillText('Q ability · ' + chosen.q, cx0, gridBottom + 28);
        c.font = '10px monospace'; c.fillStyle = '#8fa3bf';
        c.fillText(chosen.qDesc, cx0, gridBottom + 40);
      }
    }

    // (ESSENCE/permanent-boosts moved to the bottom dock, below)

    // companions available to BOTH the centered picker and the loadout preview panel
    const roster = (typeof Descent !== 'undefined' && Descent.PETS) || [];
    const unlocked = meta.petsUnlocked || [];

    // --- PICK A COMPANION: the pet picker, moved off the top into the centered spine ---
    if (roster.length) {
      c.textAlign = 'center';
      c.font = 'bold 11px monospace'; c.fillStyle = '#8fd0a0';
      c.fillText(`PICK A COMPANION  ·  ${unlocked.length}/${roster.length}`, W / 2, 406);
      const chip = 24, cgap = 12, r = chip / 2, cyp = 428;
      const rowW = roster.length * chip + (roster.length - 1) * cgap;
      let px = (W - rowW) / 2;
      for (const pet of roster) {
        const has = unlocked.includes(pet.type);
        const sel = has && meta.selectedPet === pet.type;
        const cxp = px + r;
        if (has) drawPetFeature(c, pet.type, cxp, cyp, r, pet.color);
        c.beginPath(); c.arc(cxp, cyp, r, 0, Math.PI * 2);
        c.fillStyle = has ? pet.color : '#20242f'; c.fill();
        if (has) { c.fillStyle = '#0e1016'; c.beginPath(); c.arc(cxp - 3, cyp - 2, 1.8, 0, Math.PI * 2); c.arc(cxp + 3, cyp - 2, 1.8, 0, Math.PI * 2); c.fill(); }
        else { c.fillStyle = '#3a3f4d'; c.font = 'bold 12px monospace'; c.fillText('?', cxp, cyp + 4); }
        c.lineWidth = sel ? 3 : 1.5;
        c.strokeStyle = sel ? '#ffd24c' : has ? '#5a6478' : '#2c3040';
        c.beginPath(); c.arc(cxp, cyp, r, 0, Math.PI * 2); c.stroke();
        if (has) rects.push({ x: px - 4, y: cyp - r - 6, w: chip + 8, h: chip + 12, action: 'selectPet', key: pet.type });
        px += chip + cgap;
      }
    }

    // --- LEFT PANEL: TOP RAIDERS (#118), a framed card mirroring the loadout panel ---
    {
      const px = 16, py = 150, pw = 180, ph = 300, pcx = px + pw / 2;
      roundRectPath(c, px, py, pw, ph, 12);
      c.fillStyle = '#12121e'; c.fill();
      c.strokeStyle = 'rgba(232,181,47,0.18)'; c.lineWidth = 1; c.stroke();
      c.textAlign = 'center';
      c.font = 'bold 12px monospace'; c.fillStyle = '#c9a227';
      c.fillText('TOP RAIDERS', pcx, py + 26);
      c.textAlign = 'left';
      if (!g.scoresReady) {
        c.font = 'italic 11px monospace'; c.fillStyle = '#6a7484';
        c.fillText('loading...', px + 16, py + 58);
      } else {
        (g.scores || []).slice(0, 5).forEach((s, i) => {
          c.font = '11px monospace';
          c.fillStyle = i === 0 ? '#ffd24c' : '#9fb0c8';
          c.fillText(`${i + 1}. ${s.initials}  ${s.score}${s.won ? ' ♛' : ''}`, px + 16, py + 60 + i * 22);
        });
      }
      c.font = 'italic 10px monospace'; c.fillStyle = '#5a6478';
      c.fillText('compete for the crown', px + 16, py + ph - 18);
    }

    // --- RIGHT PANEL: YOUR LOADOUT - a live preview of the class + companion you're
    // about to play, so you see exactly what launches when you ENTER ---
    {
      const px = 764, py = 150, pw = 180, ph = 300, pcx = px + pw / 2;
      roundRectPath(c, px, py, pw, ph, 12);
      c.fillStyle = '#12121e'; c.fill();
      c.strokeStyle = 'rgba(232,181,47,0.18)'; c.lineWidth = 1; c.stroke();
      c.textAlign = 'center';
      c.font = 'bold 12px monospace'; c.fillStyle = '#ffd24c';
      c.fillText('YOUR LOADOUT', pcx, py + 26);
      // selected class portrait + name
      const cls = classes.find(cl => cl.id === (meta.selectedClass || '')) || classes[0];
      if (cls) {
        if (PlayerDef.drawClassPortrait) PlayerDef.drawClassPortrait(c, cls, pcx, py + 70, 20);
        c.font = 'bold 13px monospace'; c.fillStyle = cls.color || '#e8d3b0';
        c.fillText(cls.name, pcx, py + 116);
      }
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(px + 26, py + 136); c.lineTo(px + pw - 26, py + 136); c.stroke();
      // companion: the pet tooltip (name + passive) lives here now. Hovering a chip in
      // PICK A COMPANION previews that pet; otherwise it shows your equipped one.
      const previewType = g.hoverPet || meta.selectedPet;
      const pet = roster.find(pp => pp.type === previewType && unlocked.includes(pp.type));
      const previewing = !!(g.hoverPet && pet && g.hoverPet !== meta.selectedPet);
      c.font = '9px monospace'; c.fillStyle = '#667';
      c.fillText(previewing ? 'PREVIEW' : 'WITH', pcx, py + 150);
      const pcy = py + 186, pr = 16;
      if (pet) {
        drawPetFeature(c, pet.type, pcx, pcy, pr, pet.color);
        c.beginPath(); c.arc(pcx, pcy, pr, 0, Math.PI * 2); c.fillStyle = pet.color; c.fill();
        c.fillStyle = '#0e1016'; c.beginPath(); c.arc(pcx - 4, pcy - 2, 2.4, 0, Math.PI * 2); c.arc(pcx + 4, pcy - 2, 2.4, 0, Math.PI * 2); c.fill();
        c.lineWidth = previewing ? 2 : 1.5; c.strokeStyle = previewing ? '#8fd0a0' : '#5a6478'; c.beginPath(); c.arc(pcx, pcy, pr, 0, Math.PI * 2); c.stroke();
        c.font = 'bold 12px monospace'; c.fillStyle = pet.color;
        c.fillText(pet.name, pcx, pcy + 32);
        // the pet's passive (the restored tooltip)
        c.font = '10px monospace'; c.fillStyle = '#b7c2d4';
        c.fillText(pet.desc || '', pcx, pcy + 48);
        c.font = 'bold 8px monospace'; c.fillStyle = previewing ? '#8fd0a0' : '#5a6478';
        c.fillText(previewing ? 'click to equip' : 'equipped', pcx, pcy + 62);
      } else {
        c.beginPath(); c.arc(pcx, pcy, pr, 0, Math.PI * 2); c.fillStyle = '#20242f'; c.fill();
        c.lineWidth = 1.5; c.strokeStyle = '#2c3040'; c.beginPath(); c.arc(pcx, pcy, pr, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#3a3f4d'; c.font = 'bold 16px monospace'; c.fillText('?', pcx, pcy + 5);
        c.font = '10px monospace'; c.fillStyle = '#667'; c.fillText('no companion', pcx, pcy + 34);
        c.font = 'italic 9px monospace'; c.fillStyle = '#5a6478'; c.fillText('hover a pet to preview', pcx, pcy + 48);
      }
      c.font = 'bold 10px monospace'; c.fillStyle = '#ffd24c';
      c.fillText('▶ ENTER to descend', pcx, py + ph - 16);
    }
    c.textAlign = 'center';

    // --- THE GILDED DAIS: a bottom dock of matched icon-badges. Every secondary control
    // lives here now, so the sides stay clean and the whole screen centers. ---
    c.fillStyle = '#14141f';
    c.fillRect(0, 480, W, 60);
    c.strokeStyle = 'rgba(176,141,87,0.4)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, 480.5); c.lineTo(W, 480.5); c.stroke();

    // ESSENCE (opens the permanent-boosts popup) - purple crystal sibling to the laurel
    const anyAfford = META_UPGRADES.some(u => { const cst = metaCost(u, meta.ranks[u.key] || 0); return cst !== null && meta.essence >= cst; });
    dockBadge(c, rects, 73, 'upgrades', '#b88aff', '#8a78b0', iconCrystal, `${meta.essence}`, 'ESSENCE', anyAfford);
    // MYTHICS (laurel icon, no internal text - rendered beside it)
    const mCount = (meta.mythics || []).length, mTotal = (typeof Weapons !== 'undefined' && Weapons.MYTHIC_TOTAL) || 36;
    dockBadge(c, rects, 211, 'mythics', '#e8c66a', '#c9a227', (cc, ix, iy) => drawLaurel(cc, ix, iy, mCount, mTotal, { scale: 0.42, noText: true }), `${mCount}/${mTotal}`, 'MYTHICS');
    // ACCOLADES
    if (typeof Ach !== 'undefined') {
      dockBadge(c, rects, 349, 'achievements', '#ffd24c', '#c9a227', iconTrophy, `${Ach.earnedCount(g)}/${Ach.total()}`, 'ACCOLADES');
    }
    // HIGH SCORES (opens the full board, which hosts the top-5 too)
    const topScore = (g.scoresReady && g.scores && g.scores[0]) ? `${g.scores[0].score}` : '-';
    dockBadge(c, rects, 487, 'scores', '#ffd24c', '#c9a227', iconStar, topScore, 'HIGH SCORES');
    // PATCH NOTES
    if (typeof PatchNotes !== 'undefined') {
      dockBadge(c, rects, 625, 'patchnotes', '#8fd0ff', '#6fa8c0', iconScroll, `${PatchNotes.VERSION}`, 'PATCH NOTES');
    }
    // SHARE
    dockBadge(c, rects, 763, 'share', '#8fa3bf', '#667', iconLink, 'SHARE', 'the link');

    // share toast (draws just above the dock)
    if (g.shareMsg && g.shareMsg.t > 0) {
      c.globalAlpha = Math.min(1, g.shareMsg.t);
      c.textAlign = 'center';
      c.font = 'bold 13px monospace';
      c.fillStyle = '#ffd24c';
      c.fillText(g.shareMsg.text, W / 2, 470);
      c.globalAlpha = 1;
    }

    // scoreboard overlay (+ #102 death-snapshot popup on top of it)
    if (g.showScores) drawScoreboard(c, g);
    if (g.showScores && g.snapView) drawScoreSnap(c, g);
    // patch-notes overlay
    if (g.showPatch) drawPatchNotes(c, g);
    // #38: mythic collection gallery
    if (g.showMythics) drawMythicGallery(c, g);
    // #86: accolades gallery
    if (g.showAchievements) drawAchievements(c, g);
    // permanent-boosts (essence upgrades) popup
    if (g.showUpgrades) drawUpgrades(c, g);

    c.restore();
    return rects;
  }

  // PERMANENT BOOSTS popup: the essence shop, moved off the title into a modal (like
  // the accolades gallery). Rows are clickable to buy; g.upgradeRects feeds the click
  // handler in updateTitle so a purchase keeps the popup open.
  function drawUpgrades(c, g) {
    const meta = g.meta;
    c.save();
    c.fillStyle = 'rgba(5,6,10,0.94)';
    c.fillRect(0, 0, W, H);
    c.textAlign = 'center';
    c.font = 'bold 26px monospace'; c.fillStyle = '#b88aff';
    c.fillText('PERMANENT BOOSTS', W / 2, 58);
    c.font = '14px monospace'; c.fillStyle = '#c9a227';
    c.fillText(`◆ ${meta.essence} essence`, W / 2, 82);
    c.font = '11px monospace'; c.fillStyle = '#667';
    c.fillText('they survive death · click a boost to buy · Esc or click away to close', W / 2, 100);

    const rects = [];
    const cols = 2, cardW = 340, cardH = 58, gapX = 28, gapY = 12;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const x0 = (W - gridW) / 2, y0 = 124;
    META_UPGRADES.forEach((u, i) => {
      const col = i % cols, row = (i / cols) | 0;
      const x = x0 + col * (cardW + gapX), y = y0 + row * (cardH + gapY);
      const rank = meta.ranks[u.key] || 0;
      const cost = metaCost(u, rank);
      const maxed = cost === null;
      const afford = cost !== null && meta.essence >= cost;
      const past = rank >= u.maxRank;
      const tint = STAT_TINT[u.stat] || '#b88aff';
      c.fillStyle = maxed ? 'rgba(184,138,255,0.12)' : afford ? 'rgba(184,138,255,0.07)' : 'rgba(255,255,255,0.02)';
      c.fillRect(x, y, cardW, cardH);
      c.strokeStyle = maxed ? '#b88aff' : afford ? '#7a68a0' : '#2c3040'; c.lineWidth = afford ? 1.5 : 1;
      c.strokeRect(x, y, cardW, cardH);
      c.fillStyle = tint; c.fillRect(x, y, 4, cardH); // #88 stat-tint accent strip
      c.textAlign = 'left';
      c.font = 'bold 14px monospace'; c.fillStyle = tint;
      c.fillText(u.name, x + 14, y + 22);
      c.font = '11px monospace'; c.fillStyle = '#8fa3bf';
      c.fillText(u.desc, x + 14, y + 40);
      c.textAlign = 'right';
      c.font = 'bold 12px monospace'; c.fillStyle = maxed ? '#b88aff' : afford ? '#ffd24c' : '#556';
      c.fillText(maxed ? 'MAXED' : `◆ ${cost}`, x + cardW - 12, y + 22);
      if (past && u.endless) {
        c.font = 'bold 11px monospace'; c.fillStyle = tint;
        c.fillText(`Lv ${rank}`, x + cardW - 12, y + 42);
      } else {
        for (let k = 0; k < u.maxRank; k++) {
          c.fillStyle = k < rank ? tint : '#2c3040';
          c.beginPath(); c.arc(x + cardW - 14 - (u.maxRank - 1 - k) * 12, y + 40, 3.5, 0, Math.PI * 2); c.fill();
        }
      }
      rects.push({ x, y, w: cardW, h: cardH, action: 'upgrade', key: u.key });
    });

    // prestige bar spanning the grid width, below the cards
    const gridRows = Math.ceil(META_UPGRADES.length / cols);
    const py = y0 + gridRows * (cardH + gapY) + 10;
    const lvl = meta.prestige || 0, pcost = 500 * (lvl + 1);
    const pafford = meta.essence >= pcost, armed = (g.prestigeConfirm || 0) > 0;
    const pr = { x: x0, y: py, w: gridW, h: 50, action: 'prestige' };
    c.fillStyle = armed ? 'rgba(224,85,85,0.16)' : pafford ? 'rgba(232,181,47,0.08)' : 'rgba(255,255,255,0.02)';
    c.fillRect(pr.x, pr.y, pr.w, pr.h);
    c.strokeStyle = armed ? '#e05555' : pafford ? '#e8b52f' : '#2c3040'; c.lineWidth = armed ? 2 : 1;
    c.strokeRect(pr.x, pr.y, pr.w, pr.h);
    c.textAlign = 'left';
    c.font = 'bold 14px monospace'; c.fillStyle = '#e8b52f';
    c.fillText(`♛ PRESTIGE ${lvl}`, pr.x + 14, pr.y + 21);
    c.font = '10px monospace'; c.fillStyle = armed ? '#ff9a9a' : '#8fa3bf';
    c.fillText(armed ? 'CLICK AGAIN: wipes essence, upgrades, mythics, pets' : 'reset your whole account for a grander cape', pr.x + 14, pr.y + 39);
    c.textAlign = 'right';
    c.font = 'bold 11px monospace'; c.fillStyle = pafford ? '#ffd24c' : '#556';
    c.fillText(pafford ? `◆ ${pcost}` : `need ◆ ${pcost}`, pr.x + pr.w - 12, pr.y + 21);
    rects.push(pr);

    g.upgradeRects = rects;
    c.restore();
  }

  // #86 ACCOLADES gallery: a scrollable grid of every feat, earned ones lit gold,
  // locked ones dimmed with their unlock hint. g.achScroll pages the list.
  function drawAchievements(c, g) {
    if (typeof Ach === 'undefined') return;
    c.save();
    c.fillStyle = 'rgba(5,6,10,0.94)';
    c.fillRect(0, 0, W, H);
    const list = Ach.all(), earned = Ach.earnedCount(g), tot = Ach.total();
    c.textAlign = 'center';
    c.font = 'bold 26px monospace'; c.fillStyle = '#ffd24c';
    c.fillText('ACCOLADES', W / 2, 44);
    c.font = '13px monospace'; c.fillStyle = '#8fd0a0';
    c.fillText(`${earned} of ${tot} earned`, W / 2, 66);
    c.font = '11px monospace'; c.fillStyle = '#667';
    c.fillText('scroll / arrows to see more · click or Esc to close', W / 2, 84);

    // two columns of cards, clipped to a scrolling viewport
    const cols = 2, cardW = 440, cardH = 44, gapX = 24, gapY = 8;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const x0 = (W - gridW) / 2, top = 100, bottom = H - 24;
    const rows = Math.ceil(list.length / cols);
    const contentH = rows * (cardH + gapY);
    const viewH = bottom - top;
    const maxScroll = Math.max(0, contentH - viewH);
    g.achScroll = Math.max(0, Math.min(maxScroll, g.achScroll || 0));
    c.beginPath(); c.rect(0, top - 6, W, viewH + 12); c.clip();
    list.forEach((a, i) => {
      const col = i % cols, row = (i / cols) | 0;
      const x = x0 + col * (cardW + gapX);
      const y = top + row * (cardH + gapY) - g.achScroll;
      if (y + cardH < top - 6 || y > bottom + 6) return; // cull off-view
      const done = Ach.isDone(g, a.id);
      c.fillStyle = done ? 'rgba(255,210,76,0.10)' : 'rgba(255,255,255,0.02)';
      c.fillRect(x, y, cardW, cardH);
      c.strokeStyle = done ? '#c9a227' : '#2c3040'; c.lineWidth = 1;
      c.strokeRect(x, y, cardW, cardH);
      // medal
      c.beginPath(); c.arc(x + 22, y + cardH / 2, 12, 0, Math.PI * 2);
      c.fillStyle = done ? '#ffd24c' : '#20242f'; c.fill();
      c.strokeStyle = done ? '#8a6d1f' : '#3a4050'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = done ? '#5a4410' : '#3a4050';
      c.font = 'bold 12px monospace'; c.textAlign = 'center';
      c.fillText(done ? '★' : '?', x + 22, y + cardH / 2 + 4);
      // text
      c.textAlign = 'left';
      c.font = 'bold 13px monospace'; c.fillStyle = done ? '#ffe9a8' : '#6a7284';
      c.fillText(a.name, x + 44, y + 19);
      c.font = '10px monospace'; c.fillStyle = done ? '#b7c2d4' : '#565e70';
      c.fillText(a.desc, x + 44, y + 34);
    });
    c.restore();
  }

  // #89 ENCHANT TABLE popup: pick one of 3 offered enchants + one of the weapon's
  // current enchants to overwrite. Cost scales with the offer's tier/level; each
  // attempt risks a 0.5% shatter (its own drama overlay).
  const ETIER_C = { 1: '#a8b0bf', 2: '#a78bfa', 3: '#fbbf24' };
  const EROMAN = ['', 'I', 'II', 'III'];
  function eCost(of) { return { gold: 40 + 35 * of.tier + 10 * (of.level || 0), shards: 1 + of.tier }; }
  function drawEnchantPick(c, g) {
    const e = g.enchant; if (!e) return [];
    const rects = [];
    const p = g.player, w = p.weapon;
    c.save();
    c.fillStyle = 'rgba(6,6,12,0.9)'; c.fillRect(0, 0, W, H);
    if (e.breakT > 0) { drawEnchantBreak(c, e); c.restore(); return rects; }
    if (!w) { c.restore(); return rects; }

    c.textAlign = 'center';
    c.fillStyle = '#b06bff'; c.font = 'bold 26px monospace';
    c.fillText('ENCHANTING TABLE', W / 2, 54);
    c.font = '12px monospace'; c.fillStyle = '#8fa3bf';
    c.fillText('replace one enchant on your weapon · each attempt risks a 0.5% shatter', W / 2, 76);
    c.font = 'bold 15px monospace'; c.fillStyle = w.color || '#ddd';
    c.fillText(Weapons.displayName(w).split(' [')[0], W / 2, 104);

    const colW = 380, colGap = 56;
    const leftX = W / 2 - colW - colGap / 2, rightX = W / 2 + colGap / 2;
    const y0 = 142, rowH = 50, rowGap = 10;
    const row = (x, i, item, sel, action, extra) => {
      const y = y0 + i * (rowH + rowGap);
      c.fillStyle = sel ? 'rgba(176,107,255,0.16)' : 'rgba(255,255,255,0.03)';
      c.fillRect(x, y, colW, rowH);
      c.strokeStyle = sel ? '#b06bff' : '#3a4050'; c.lineWidth = sel ? 2.5 : 1; c.strokeRect(x, y, colW, rowH);
      c.textAlign = 'left'; c.font = 'bold 13px monospace'; c.fillStyle = ETIER_C[item.tier] || '#ccc';
      c.fillText(item.name + (item.level ? ' ' + EROMAN[item.level] : ''), x + 12, y + 20);
      c.fillStyle = '#9fb0c8'; c.font = '10px monospace';
      c.fillText(item.desc, x + 12, y + 38);
      if (extra) extra(x, y);
      rects.push({ x, y, w: colW, h: rowH, action, idx: i });
    };

    c.textAlign = 'left'; c.font = 'bold 12px monospace'; c.fillStyle = '#c9a227';
    c.fillText('YOUR ENCHANTS · click one to replace', leftX, y0 - 12);
    (w.enchants || []).forEach((en, i) => row(leftX, i, en, e.slotSel === i, 'ench-slot'));

    c.font = 'bold 12px monospace'; c.fillStyle = '#c9a227';
    c.fillText('OFFERED · click one to apply', rightX, y0 - 12);
    e.offers.forEach((of, i) => row(rightX, i, of, e.offerSel === i, 'ench-offer', (x, y) => {
      const cost = eCost(of), afford = p.coins >= cost.gold && p.shards >= cost.shards;
      c.textAlign = 'right'; c.font = 'bold 11px monospace'; c.fillStyle = afford ? '#ffd24c' : '#e05555';
      c.fillText(`${cost.gold}g · ${cost.shards}◈`, x + colW - 12, y + 20);
    }));

    const nRows = Math.max((w.enchants || []).length, e.offers.length);
    const by = y0 + nRows * (rowH + rowGap) + 18;
    const ready = e.offerSel >= 0 && e.slotSel >= 0;
    const cb = { x: W / 2 - 150, y: by, w: 180, h: 40, action: 'ench-confirm' };
    c.fillStyle = ready ? 'rgba(176,107,255,0.2)' : 'rgba(255,255,255,0.03)';
    c.fillRect(cb.x, cb.y, cb.w, cb.h);
    c.strokeStyle = ready ? '#b06bff' : '#3a4050'; c.lineWidth = 2; c.strokeRect(cb.x, cb.y, cb.w, cb.h);
    c.textAlign = 'center'; c.font = 'bold 14px monospace'; c.fillStyle = ready ? '#d9b3ff' : '#556';
    c.fillText('ENCHANT', cb.x + cb.w / 2, cb.y + 25);
    if (ready) rects.push(cb);
    const xb = { x: W / 2 + 40, y: by, w: 110, h: 40, action: 'ench-exit' };
    c.strokeStyle = '#5a6478'; c.lineWidth = 1.5; c.strokeRect(xb.x, xb.y, xb.w, xb.h);
    c.fillStyle = '#8fa3bf'; c.font = 'bold 14px monospace'; c.fillText('LEAVE  (E)', xb.x + xb.w / 2, xb.y + 25);
    rects.push(xb);

    c.font = '12px monospace'; c.fillStyle = '#ffd24c';
    c.fillText(`${p.coins} gold   ·   ${p.shards} shards`, W / 2, by + 60);
    if (e.msg) { c.fillStyle = '#8fd0a0'; c.font = '11px monospace'; c.fillText(e.msg, W / 2, by + 80); }
    c.font = '10px monospace'; c.fillStyle = '#c07070';
    c.fillText('⚠ a 0.5% chance the weapon SHATTERS on any attempt', W / 2, by + 98);
    c.restore();
    return rects;
  }
  function drawEnchantBreak(c, e) {
    c.fillStyle = `rgba(70,0,0,${0.4 * Math.min(1, e.breakT)})`; c.fillRect(0, 0, W, H);
    c.textAlign = 'center';
    const shake = Math.sin(Date.now() / 38) * (e.breakT > 1.6 ? 9 : 2);
    c.save(); c.translate(shake, 0);
    c.font = 'bold 54px monospace';
    c.fillStyle = '#1a0000'; c.fillText('SHATTERED', W / 2 + 3, H / 2 - 6 + 3);
    c.fillStyle = '#ff3b3b'; c.fillText('SHATTERED', W / 2, H / 2 - 6);
    c.font = 'bold 16px monospace'; c.fillStyle = '#ffb0b0';
    c.fillText((e.brokeName || 'Your weapon') + ' broke apart on the table', W / 2, H / 2 + 32);
    c.font = '14px monospace'; c.fillStyle = '#e08a8a';
    c.fillText('A 1-in-200 catastrophe, and it found YOU.', W / 2, H / 2 + 58);
    c.font = 'italic 13px monospace'; c.fillStyle = '#8a5a5a';
    c.fillText('the forge kept your gold. unlucky.', W / 2, H / 2 + 82);
    c.restore();
  }

  // #86 accolade unlock toasts: gold banners that slide in bottom-centre and fade
  function drawToasts(c, g) {
    if (!g.achToasts || !g.achToasts.length) return;
    c.save();
    c.textAlign = 'center';
    let y = H - 90;
    for (const t of g.achToasts) {
      const a = Math.min(1, t.t) * Math.min(1, (4.5 - t.t) * 3 + 1); // fade in/out
      c.globalAlpha = Math.max(0, Math.min(1, a));
      const w = 320, x = W / 2 - w / 2;
      c.fillStyle = 'rgba(20,16,6,0.92)';
      c.fillRect(x, y, w, 40);
      c.strokeStyle = '#ffd24c'; c.lineWidth = 2; c.strokeRect(x, y, w, 40);
      c.fillStyle = '#ffd24c'; c.font = 'bold 13px monospace';
      c.fillText('🏆 ACCOLADE UNLOCKED', W / 2, y + 16);
      c.fillStyle = '#ffe9a8'; c.font = '12px monospace';
      c.fillText(t.name, W / 2, y + 32);
      y -= 48;
    }
    c.restore();
  }

  // #38: the mythic collection - every mythic you've found (revealed) + the rest
  // still locked as "???", so you can see what's left to hunt down.
  function drawMythicGallery(c, g) {
    const found = new Set(g.meta.mythics || []);
    const all = [...Weapons.MYTHIC_WEAPONS, ...Weapons.MYTHIC_ARMOR];
    const pw = 660, ph = 480, px = (W - pw) / 2, py = 30;
    c.fillStyle = 'rgba(5,5,12,0.95)'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#e8c66a'; c.lineWidth = 2; c.strokeRect(px, py, pw, ph);
    c.textAlign = 'center';
    c.font = 'bold 20px monospace'; c.fillStyle = '#ffd24c';
    c.fillText(`MYTHIC COLLECTION   ${found.size} / ${all.length}`, W / 2, py + 28);
    c.font = '11px monospace'; c.fillStyle = '#8fa3bf';
    c.fillText('legendary uniques - won from Descent bosses and the secret shop', W / 2, py + 48);
    const cols = 5, cw = 120, ch = 58, gpx = 6, gpy = 6;
    const gx = px + (pw - (cols * cw + (cols - 1) * gpx)) / 2, gy = py + 66;
    const trunc = (t, maxW) => { let s = t; while (s.length > 3 && c.measureText(s).width > maxW) s = s.slice(0, -1); return s === t ? t : s.slice(0, -1) + '…'; };
    all.forEach((m, i) => {
      const col = i % cols, row = (i / cols) | 0;
      const x = gx + col * (cw + gpx), y = gy + row * (ch + gpy);
      const has = found.has(m.id);
      c.fillStyle = has ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.015)';
      c.fillRect(x, y, cw, ch);
      c.strokeStyle = has ? m.color : '#2c3040'; c.lineWidth = 1.2; c.strokeRect(x, y, cw, ch);
      c.fillStyle = has ? m.color : '#20242f';
      c.beginPath(); c.arc(x + 15, y + 15, 6.5, 0, Math.PI * 2); c.fill();
      c.textAlign = 'left';
      if (has) {
        c.font = 'bold 10px monospace'; c.fillStyle = '#e8edf6';
        c.fillText(trunc(m.name, cw - 30), x + 27, y + 18);
        c.font = 'italic 8px monospace'; c.fillStyle = '#8a8f9e';
        const words = m.flavor.split(' '); let line = '', ly = y + 34;
        for (const w of words) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > cw - 14 && line) { c.fillText(line, x + 8, ly); ly += 10; line = w; if (ly > y + ch - 4) break; } else line = t; }
        if (line && ly <= y + ch - 4) c.fillText(line, x + 8, ly);
      } else {
        c.font = 'bold 11px monospace'; c.fillStyle = '#4a4f5d';
        c.fillText('? ? ?', x + 27, y + 19);
        c.font = '8px monospace'; c.fillStyle = '#3a3f4d';
        c.fillText('undiscovered', x + 8, y + 42);
      }
    });
    c.textAlign = 'center'; c.font = '11px monospace'; c.fillStyle = '#8fa3bf';
    c.fillText('click anywhere or press Esc to close', W / 2, py + ph - 12);
  }

  // the changelog overlay: newest version first, scroll not needed (kept short)
  // count how many lines `text` wraps to at maxW in the current font (measure only)
  function wrapLineCount(c, text, maxW) {
    const words = text.split(' ');
    let line = '', n = 1;
    for (const wd of words) {
      const test = line ? line + ' ' + wd : wd;
      if (c.measureText(test).width > maxW) { n++; line = wd; } else line = test;
    }
    return n;
  }

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

    // #76 the changelog is longer than the panel, so it SCROLLS. The content area is
    // clipped and shifted by g.patchScroll (driven by the wheel + arrow/page keys).
    const top = py + 50, bot = py + ph - 22, viewH = bot - top;
    // measure total content height first so we can clamp the scroll + size a scrollbar
    let contentH = 0;
    for (const rel of notes) {
      contentH += 20; // header row
      c.font = '11px monospace';
      for (const it of rel.items) contentH += (wrapLineCount(c, it, pw - 60) - 1) * 15 + 16;
      contentH += 12; // gap after a release
    }
    const maxScroll = Math.max(0, contentH - viewH);
    g.patchScroll = Math.max(0, Math.min(g.patchScroll || 0, maxScroll));
    const scroll = g.patchScroll;

    c.save();
    c.beginPath(); c.rect(px + 2, top - 4, pw - 4, viewH + 8); c.clip();
    c.textAlign = 'left';
    let y = top + 12 - scroll;
    for (const rel of notes) {
      c.font = 'bold 14px monospace'; c.fillStyle = '#ffd24c';
      c.fillText(`${rel.v} - ${rel.title}`, px + 20, y);
      c.font = '11px monospace'; c.fillStyle = '#7a8194';
      c.textAlign = 'right'; c.fillText(rel.date, px + pw - 20, y); c.textAlign = 'left';
      y += 20;
      for (const it of rel.items) {
        c.fillStyle = '#8fd0ff'; c.font = '11px monospace';
        c.fillText('•', px + 24, y);
        c.fillStyle = '#cdd4e2';
        y = wrapText(c, it, px + 36, y, pw - 60, 15) + 16;
      }
      y += 12;
    }
    c.restore();

    // scrollbar (only when there's overflow)
    if (maxScroll > 0) {
      const trackX = px + pw - 7, trackH = viewH;
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(trackX, top, 4, trackH);
      const thumbH = Math.max(24, trackH * viewH / contentH);
      const thumbY = top + (trackH - thumbH) * (scroll / maxScroll);
      c.fillStyle = '#8fd0ff'; c.fillRect(trackX, thumbY, 4, thumbH);
      // a soft "more below" hint arrow while not at the bottom
      if (scroll < maxScroll - 1) {
        c.textAlign = 'center'; c.fillStyle = '#8fd0ff';
        c.font = 'bold 12px monospace'; c.fillText('▼', W / 2 + 130, py + ph - 8);
      }
    }

    c.textAlign = 'center';
    c.font = '11px monospace'; c.fillStyle = '#8fa3bf';
    c.fillText('scroll for more · click or Esc to close', W / 2, py + ph - 8);
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
    g.scoreRects = []; // #102 rows with a death-snapshot become clickable
    let anyClickable = false;
    scores.slice(0, 10).forEach((s, i) => {
      const y = py + 95 + i * 29;
      const isNew = g.newScoreRank === i + 1;
      const hasSnap = !!(s.snap && s.snap.avatar);
      if (hasSnap) { g.scoreRects.push({ x: px + 80, y: y - 16, w: 200, h: 24, snap: s.snap, initials: s.initials }); anyClickable = true; }
      c.fillStyle = isNew ? '#ffd24c' : i === 0 ? '#e8b52f' : '#c8d2e0';
      c.textAlign = 'right';
      c.fillText(`${i + 1}.`, px + 70, y);
      c.textAlign = 'left';
      c.fillText(s.initials, px + 95, y);
      if (hasSnap) { // underline + magnifier so the name reads as clickable
        const w = c.measureText(s.initials).width;
        c.strokeStyle = 'rgba(255,210,76,0.5)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(px + 95, y + 3); c.lineTo(px + 95 + w, y + 3); c.stroke();
        c.font = '12px monospace'; c.fillStyle = '#8a7340'; c.fillText('🔍', px + 100 + w, y - 1); c.font = 'bold 16px monospace';
      }
      c.textAlign = 'right';
      c.fillStyle = isNew ? '#ffd24c' : i === 0 ? '#e8b52f' : '#c8d2e0';
      c.fillText(`${s.score} ◆`, px + 300, y);
      c.textAlign = 'left';
      c.fillStyle = '#8fa3bf';
      c.fillText(`floor ${s.floor}`, px + 330, y);
      if (s.won) { c.fillStyle = '#ffd24c'; c.fillText('♛', px + 420, y); }
    });
    c.textAlign = 'center';
    c.font = '12px monospace'; c.fillStyle = '#667';
    c.fillText(anyClickable ? 'click an underlined name to see their fallen hero · Esc to close'
                           : 'click anywhere or Esc to close', W / 2, py + ph - 14);
  }

  // #102 DEATH SNAPSHOT: the fallen hero's visage + character sheet, frozen at death.
  function drawScoreSnap(c, g) {
    const s = g.snapView; if (!s) return;
    const pw = 460, ph = 430, px = (W - pw) / 2, py = 55;
    c.fillStyle = 'rgba(4,4,10,0.96)'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#ffd24c'; c.lineWidth = 2; c.strokeRect(px, py, pw, ph);
    c.textAlign = 'center';
    c.font = 'bold 20px monospace'; c.fillStyle = '#ffd24c';
    c.fillText(`${s.initials} · the fallen`, W / 2, py + 32);

    // visage (rendered PNG captured at death), framed
    const av = 110, ax = px + 28, ay = py + 52;
    c.fillStyle = 'rgba(255,255,255,0.03)'; c.fillRect(ax, ay, av, av);
    c.strokeStyle = '#5a6478'; c.lineWidth = 1; c.strokeRect(ax, ay, av, av);
    if (s._img && s._img.complete && s._img.naturalWidth) {
      c.drawImage(s._img, ax + 5, ay + 5, av - 10, av - 10);
    } else {
      // #133 a GLOBAL score carries the loadout but not the portrait: the avatar is a
      // multi-KB PNG and a hundred of them would burst the leaderboard's storage cap,
      // so it stays local. Draw the class crest instead of an empty box.
      c.save();
      c.translate(ax + av / 2, ay + av / 2);
      if (typeof PlayerDef !== 'undefined' && PlayerDef.drawClassPortrait && s.cls) {
        try { PlayerDef.drawClassPortrait(c, s.cls, 30); } catch (e) { /* fall through to the crest */ }
      } else {
        c.strokeStyle = '#5a6478'; c.lineWidth = 2;
        c.beginPath(); c.arc(0, -6, 16, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.moveTo(-18, 14); c.quadraticCurveTo(0, 2, 18, 14); c.stroke();
      }
      c.restore();
      c.textAlign = 'center';
      c.font = '9px monospace'; c.fillStyle = '#5a6478';
      c.fillText('no portrait on the global board', ax + av / 2, ay + av - 6);
      c.textAlign = 'left';
    }

    // headline facts beside the portrait
    c.textAlign = 'left';
    const hx = ax + av + 22; let hy = ay + 20;
    c.font = 'bold 15px monospace'; c.fillStyle = '#e8e3f0';
    c.fillText(`${s.className}${s.prestige ? '  ♛' + s.prestige : ''}`, hx, hy); hy += 22;
    c.font = '13px monospace'; c.fillStyle = '#c8d2e0';
    c.fillText(`Level ${s.level}  ·  fell on floor ${s.floor}`, hx, hy); hy += 20;
    c.fillStyle = '#ffd24c'; c.fillText(`${s.essence} essence banked`, hx, hy); hy += 20;
    c.fillStyle = '#9fb0c8';
    c.fillText(`${s.kills} kills  ·  ${s.coins} gold`, hx, hy); hy += 20;
    c.fillText(`${s.maxHp} max HP`, hx, hy);

    // stat line
    let y = ay + av + 30;
    c.font = 'bold 12px monospace'; c.fillStyle = '#c9a227'; c.fillText('STATS', px + 28, y); y += 18;
    c.font = '12px monospace'; c.fillStyle = '#b7c2d4';
    const dmgPct = Math.round((s.dmgMul - 1) * 100), spdPct = Math.round((s.spdMul - 1) * 100), coinPct = Math.round((s.coinMul - 1) * 100);
    c.fillText(`+${dmgPct}% dmg   +${spdPct}% move   ${s.crit}% crit   +${coinPct}% coins   magic ${s.magic}`, px + 28, y); y += 24;

    // evolutions
    c.font = 'bold 12px monospace'; c.fillStyle = '#b06bff'; c.fillText('EVOLUTIONS', px + 28, y); y += 18;
    c.font = '11px monospace'; c.fillStyle = '#cbb7e6';
    const evoText = (s.evos && s.evos.length) ? s.evos.join(' · ') : 'none taken';
    wrapText(c, evoText, px + 28, y, pw - 56, 15); y += Math.max(15, Math.ceil(evoText.length / 60) * 15) + 12;

    // gear + abilities
    c.font = 'bold 12px monospace'; c.fillStyle = '#8fd0a0'; c.fillText('GEAR & ABILITIES', px + 28, y); y += 18;
    c.font = '11px monospace'; c.fillStyle = '#c8d2e0';
    (s.weapons || []).forEach(w => { c.fillText('⚔ ' + w, px + 28, y); y += 15; });
    if (s.armor) { c.fillText('🛡 ' + s.armor, px + 28, y); y += 15; }
    c.fillStyle = '#9ecbff';
    const ab = [s.q && 'Q: ' + s.q, s.r && 'R: ' + s.r, s.ult && '★: ' + s.ult].filter(Boolean).join('   ');
    if (ab) { c.fillText(ab, px + 28, y); y += 15; }

    c.textAlign = 'center'; c.font = '12px monospace'; c.fillStyle = '#667';
    c.fillText('click or Esc to go back', W / 2, py + ph - 12);
  }

  // simple word-wrap helper (used by the snapshot evolutions line)
  function wrapText(c, text, x, y, maxW, lh) {
    const words = String(text).split(' '); let line = '', yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (c.measureText(test).width > maxW && line) { c.fillText(line, x, yy); line = w; yy += lh; }
      else line = test;
    }
    if (line) c.fillText(line, x, yy);
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
    c.fillText('A/D move · SPACE pick · click / 1-2-3 · C: character', W / 2, 158);

    const n = g.levelChoices.length;
    const cardW = 210, cardH = 172, gap = 24;
    const totalW = n * cardW + (n - 1) * gap;
    const rects = [];
    const stacksOf = k => (g.player.upgradeStacks && g.player.upgradeStacks[k]) || 0;
    for (let i = 0; i < n; i++) {
      const ch = g.levelChoices[i];
      const x = (W - totalW) / 2 + i * (cardW + gap), y = 190;
      const hov = g.hoverChoice === i;
      c.fillStyle = hov ? 'rgba(255,210,76,0.12)' : 'rgba(255,255,255,0.05)';
      c.fillRect(x, y, cardW, cardH);
      c.strokeStyle = hov ? '#ffd24c' : '#5a6478';
      c.lineWidth = hov ? 2.5 : 1.5;
      c.strokeRect(x, y, cardW, cardH);
      // keybind hint tucked in the top-left corner (freed the bottom for evo progress)
      c.textAlign = 'left'; c.font = 'bold 12px monospace'; c.fillStyle = '#5a6478';
      c.fillText(`${i + 1}`, x + 10, y + 18);
      c.textAlign = 'center';
      c.font = 'bold 30px monospace';
      c.fillStyle = ch.color;
      c.fillText(ch.icon, x + cardW / 2, y + 50);
      c.font = 'bold 14px monospace';
      c.fillStyle = '#fff';
      c.fillText(ch.name, x + cardW / 2, y + 80);
      c.font = '12px monospace';
      c.fillStyle = '#9fb0c8';
      wrapText(c, ch.desc, x + cardW / 2, y + 102, cardW - 20, 15);
      // #64/#stat-redesign evolution progress: this card feeds a base STAT; every 3
      // points in that stat (from ANY of its cards) forge a new evolution tier.
      const stat = ch.stat || (typeof Evolutions !== 'undefined' && Evolutions.STAT_SCHOOL[ch.key]);
      if (stat) {
        const scol = (typeof Evolutions !== 'undefined' && Evolutions.STAT_COLOR[stat]) || ch.color;
        const stacks = (g.player.statPoints && g.player.statPoints[stat]) || 0;
        const inTier = stacks % 3, owned = Math.floor(stacks / 3);
        // Evolutions open at 3/6/9/12 and there is no tier V. This card and the
        // character sheet both used to work that out for themselves, in slightly
        // different ways, which is exactly how a maxed stat ended up promising an
        // evolution it could never deliver. The maths now lives in ONE place -
        // Evolutions.progressLine - and both screens read it from there.
        const prog = Evolutions.progressLine(g.player, stat);
        const maxed = !!prog.maxed;
        const evolves = !!prog.evolves;
        // "STAT +1" tag so you see the stat point you're banking
        c.font = 'bold 10px monospace'; c.fillStyle = scol;
        c.fillText(stat + ' +1', x + cardW / 2, y + cardH - 44);
        const py = y + cardH - 30;
        if (maxed) {
          // all four pips lit, in gold: the track is finished. Sits 8px higher than
          // the normal row so the two lines of text below it still fit in the card.
          for (let p = 0; p < 4; p++) {
            c.fillStyle = '#ffd24c';
            c.beginPath(); c.arc(x + cardW / 2 - 24 + p * 16, py - 8, 4.2, 0, Math.PI * 2); c.fill();
          }
        } else {
          for (let p = 0; p < 3; p++) {
            const on = p < inTier;
            c.fillStyle = on ? scol : 'rgba(255,255,255,0.16)';
            c.beginPath(); c.arc(x + cardW / 2 - 16 + p * 16, py, 4.2, 0, Math.PI * 2); c.fill();
            if (!on) { c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 1; c.stroke(); }
          }
        }
        c.font = 'bold 10px monospace';
        if (maxed) {
          c.fillStyle = '#ffd24c';
          c.fillText(`${stat} FULLY EVOLVED · IV`, x + cardW / 2, py + 7);
          c.font = '9px monospace'; c.fillStyle = '#7a8698';
          c.fillText('the point still counts', x + cardW / 2, py + 19);
        } else if (evolves) {
          c.fillStyle = '#ffd24c';
          c.fillText('EVOLVES ON THIS PICK', x + cardW / 2, py + 18);
        } else {
          c.fillStyle = '#7a8698';
          const romans = ['', ' I', ' II', ' III', ' IV'];
          c.fillText(`${inTier}/3 to ${stat} evo${owned > 0 ? ' ·' + romans[Math.min(4, owned)] : ''}`, x + cardW / 2, py + 18);
        }
      }
      rects.push({ x, y: y + dy, w: cardW, h: cardH, idx: i }); // hitbox tracks the drift
    }
    // continuous paid reroll (10g, then +1g each time this run)
    {
      const cost = 10 + (g.rerollCount || 0);
      const afford = g.player && g.player.coins >= cost;
      const deny = (g.rerollDenyT || 0) > 0;
      const rr = { x: W / 2 - 120, y: 392, w: 240, h: 34, reroll: true };
      const col = deny ? '#ff6b6b' : (afford ? '#7fd4ff' : '#556');
      c.strokeStyle = col; c.lineWidth = 1.5;
      c.strokeRect(rr.x, rr.y, rr.w, rr.h);
      c.font = 'bold 13px monospace';
      c.fillStyle = col;
      c.fillText(`↻ REROLL (R) · ${cost}g`, W / 2, rr.y + 22);
      rects.push({ ...rr, y: rr.y + dy });
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
    // #87 END RUN: retire on your terms - banks ALL your essence (carried + coins) and
    // posts your score, then the results screen. The graceful alternative to force-dying.
    const er = { x: W / 2 - 120, y: H / 2 + 20, w: 240, h: 42, action: 'retire' };
    c.fillStyle = 'rgba(255,210,76,0.10)'; c.fillRect(er.x, er.y, er.w, er.h);
    c.strokeStyle = '#ffd24c'; c.lineWidth = 2; c.strokeRect(er.x, er.y, er.w, er.h);
    c.font = 'bold 15px monospace'; c.fillStyle = '#ffd24c';
    c.fillText('END RUN · bank essence + score', W / 2, er.y + 26);
    // abandon to title (only essence already banked at checkpoints is kept; no score)
    const r = { x: W / 2 - 120, y: H / 2 + 72, w: 240, h: 34, action: 'menu' };
    c.strokeStyle = '#6a7688'; c.lineWidth = 1.5; c.strokeRect(r.x, r.y, r.w, r.h);
    c.font = 'bold 13px monospace'; c.fillStyle = '#8fa3bf';
    c.fillText('abandon to menu', W / 2, r.y + 22);
    c.restore();
    return [er, r];
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
        // if you 'joined' but you're the only one here AND you're the host, you typed a
        // code for a room nobody else is in - almost always a mistyped code.
        if (Net.isHost && Net.playerCount <= 1) {
          c.font = 'bold 13px monospace'; c.fillStyle = '#e0b070';
          c.fillText('no one else here - check the code and try again', W / 2, 302);
          c.fillStyle = '#8fa3bf'; c.font = '12px monospace';
          c.fillText('a correct code drops you into your friend\'s lobby', W / 2, 324);
        } else {
          c.font = '14px monospace'; c.fillStyle = '#6ee7a0';
          c.fillText(`connected · ${Net.playerCount} in lobby`, W / 2, 300);
          c.fillStyle = '#8fa3bf'; c.font = '13px monospace';
          c.fillText('waiting for the host to start...', W / 2, 324);
        }
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
    magic: '#b06bff',
  };
  // one-line note on how each stat reaches into another (the "web" bridges)
  const STAT_BRIDGE = {
    dmg: 'Cursorial Hunter also grants move speed  (-> AGILITY)',
    crit: 'crit heal & bleed keep you alive  (-> VIGOR)',
    atkspd: 'also speeds bow draws & staff casts  (-> ranged)',
    hp: 'thorns & retaliation turn defense into damage  (-> MIGHT)',
    regen: 'Tardigrade & Lamprey also cut damage / boost low-HP',
    roll: 'roll-through damage (roll-nova) turns evasion into offense  (-> MIGHT)',
    spd: 'roll wake & slipstream carry your speed  (AGILITY tempo)',
    coin: 'Midas turns hoarded coins into raw damage  (-> MIGHT)',
    magic: 'every spell scales with the Magic stat  (ARCANE)',
  };
  // #stat-redesign: the char sheet groups the evolution sub-stats under the 5 base stats
  const CS_SCHOOLS = [
    ['MIGHT',   ['dmg', 'crit', 'atkspd']],
    ['VIGOR',   ['hp', 'regen']],
    ['AGILITY', ['spd', 'roll']],
    ['ARCANE',  ['magic']],
    ['FORTUNE', ['coin']],
  ];
  // per-stat live derived value shown on its row
  function statValueStr(p, k) {
    const pct = v => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';
    switch (k) {
      case 'hp':     return Math.round(p.maxHp) + ' hp';
      case 'dmg':    return pct(p.stats.dmgMul * (1 + p.mod('dmg')) - 1);
      case 'atkspd': return pct(p.stats.atkSpeedMul + p.mod('atkSpd') - 1);
      case 'spd':    return pct(p.stats.speedMul + p.mod('spd') - 1);
      case 'crit':   return Math.round((0.05 + p.stats.crit + p.mod('critCh')) * 100) + '% crit';
      case 'coin':   return pct(p.stats.coinMul + p.mod('coin') - 1);
      case 'regen':  return (p.stats.regen + p.mod('regenFlat')).toFixed(1) + '/s';
      case 'roll':   return pct(p.stats.rollCdMul * (1 - p.mod('rollCd')) - 1) + ' cd';
      case 'magic':  return 'lv ' + (p.magicLevel ? p.magicLevel() : (p.stats.magic || 0));
    }
    return '';
  }

  // CHARACTER SHEET (C): live stats on the left, evolutions taken on the right
  // ==========================================================================
  // THE PORTRAIT - the character sheet (rebuilt 2026-07-14, from a 4-way design
  // bake-off with a judge panel; "The Portrait" won 24/30 on clarity + usefulness
  // + feasibility).
  //
  // The old sheet was a WALL: nine rows of sub-stats, each with its own progress
  // bar, next to a four-tier drill-down of every evolution in the game, most of
  // which you could not take. It answered a question nobody was asking.
  //
  // A player opens this screen with exactly two questions:
  //     "what am I?"            -> the portrait, the title, and the five rings
  //     "what do I take next?"  -> one gold sentence, and the ring that is nearly full
  //
  // So the default view has ONE picture, ONE title, FIVE rings and ONE sentence, and
  // it deliberately shows nothing else. The nine-row drill-down is still there, but
  // you have to ASK for it: hover a ring, or press 1-5. That is a subtraction, not a
  // rearrangement, and it is the whole design.
  //
  // The right-hand column is what you actually HAVE - your evolutions, your three
  // powers in plain English, your pet, your gear. When you drill into a ring it turns
  // into the exact menu that ring will offer you, with every option stamped STACKS /
  // CAPPED / DEAD SLOT (Evolutions.verdictFor), because a 12-year-old cannot be
  // expected to know that spell power does nothing without a wand.
  // ==========================================================================
  const CS_RING_R = 74;            // the ring radius around the portrait
  const CS_RING_W = 9;             // ring thickness

  // where each of the five rings sits, as an angle around the portrait. Fanned across
  // the top and sides so the labels never collide with the champion's feet.
  const CS_RING_AT = [-Math.PI / 2, -Math.PI / 2 + 1.256, -Math.PI / 2 + 2.513,
                      -Math.PI / 2 + 3.770, -Math.PI / 2 + 5.027];

  // the two-word title: your strongest stat's flavour name + your class.
  // "BRUTAL BARBARIAN". "MENDING PALADIN". It should sound like a boast.
  function csTitle(p) {
    const cls = (p.class && p.class.name) || 'Adventurer';
    let best = null, bestN = -1;
    for (const s of Evolutions.STATS) {
      const n = (p.statPoints && p.statPoints[s]) || 0;
      if (n > bestN) { bestN = n; best = s; }
    }
    if (!bestN) return { text: `THE ${cls.toUpperCase()}`, color: '#e8d5a0', stat: null };
    // the flavour word comes from the strongest SUB-tree inside that stat
    const trees = Evolutions.STAT_TREES[best] || [];
    let word = best, wn = -1;
    for (const k of trees) {
      const n = (p.upgradeStacks && p.upgradeStacks[k]) || 0;
      if (n > wn) { wn = n; word = Evolutions.STAT_NAMES[k] || best; }
    }
    return { text: `${word} ${cls.toUpperCase()}`, color: Evolutions.STAT_COLOR[best], stat: best };
  }

  // the one gold sentence: what to take next, and why.
  function csNextLine(p) {
    let bestStat = null, bestGap = 99;
    for (const s of Evolutions.STATS) {
      const sp = (p.statPoints && p.statPoints[s]) || 0;
      if (Math.floor(sp / 3) >= 4) continue;              // fully evolved, nothing left
      const next = Evolutions.THRESH.find(t => t > sp);
      if (next === undefined) continue;
      const gap = next - sp;
      if (gap < bestGap) { bestGap = gap; bestStat = s; }
    }
    if (!bestStat) return { text: 'EVERY PATH FULLY EVOLVED. There is nothing left to become.', color: '#ffd24c' };
    const col = Evolutions.STAT_COLOR[bestStat];
    if (bestGap === 1) return { text: `${bestStat} · ONE MORE POINT AND IT EVOLVES`, color: '#ffd24c' };
    return { text: `${bestStat} · ${bestGap} more points to your next evolution`, color: col };
  }

  function drawCharSheet(c, g) {
    const p = g.player, e = overlayEase(g);
    const rects = [];
    c.save();
    c.globalAlpha = e;
    c.fillStyle = 'rgba(5,5,12,0.93)';
    c.fillRect(0, 0, W, H);

    // which ring is being inspected (hover, or 1-5). null = the default, quiet view.
    const sel = g.charDetail && Evolutions.STATS.includes(g.charDetail) ? g.charDetail : null;

    // ---------------------------------------------------------------- the title
    const title = csTitle(p);
    c.textAlign = 'center';
    c.font = 'bold 26px monospace';
    c.fillStyle = '#0a0a0a'; c.fillText(title.text, W / 2 - 158 + 2, 52 + 2);
    c.fillStyle = title.color; c.fillText(title.text, W / 2 - 158, 52);
    c.font = '11px monospace'; c.fillStyle = '#7a8698';
    c.fillText(`Level ${p.level}  ·  floor ${g.floorNum}  ·  ${p.kills || 0} slain`, W / 2 - 158, 72);

    // ------------------------------------------------- the portrait and the rings
    const cx = W / 2 - 158, cy = 262;

    // the champion
    if (PlayerDef.drawClassPortrait && p.class) {
      c.save();
      try { PlayerDef.drawClassPortrait(c, p.class.id, cx, cy, 26); } catch (err) { /* never let art kill the sheet */ }
      c.restore();
    }

    // five rings, one per stat. Each fills toward its NEXT evolution, and a full ring
    // that has already popped is drawn solid: you can count your evolutions off it.
    for (let i = 0; i < Evolutions.STATS.length; i++) {
      const stat = Evolutions.STATS[i];
      const sp = (p.statPoints && p.statPoints[stat]) || 0;
      const owned = Math.floor(sp / 3);
      const maxed = owned >= 4;
      const inTier = maxed ? 3 : sp % 3;
      const col = Evolutions.STAT_COLOR[stat];
      const a0 = CS_RING_AT[i] - 0.52, a1 = CS_RING_AT[i] + 0.52;
      const isSel = sel === stat;

      // the empty track
      c.strokeStyle = 'rgba(255,255,255,0.10)';
      c.lineWidth = CS_RING_W; c.lineCap = 'butt';
      c.beginPath(); c.arc(cx, cy, CS_RING_R, a0, a1); c.stroke();
      // the fill: how far through the CURRENT tier
      const frac = maxed ? 1 : inTier / 3;
      if (frac > 0) {
        c.strokeStyle = col;
        c.globalAlpha = e * (isSel ? 1 : 0.85);
        if (isSel) { c.shadowColor = col; c.shadowBlur = 10; }
        c.beginPath(); c.arc(cx, cy, CS_RING_R, a0, a0 + (a1 - a0) * frac); c.stroke();
        c.shadowBlur = 0; c.globalAlpha = e;
      }
      // the pips: one gold dot per evolution ALREADY taken on this stat (max 4)
      for (let k = 0; k < 4; k++) {
        const pa = a0 + (a1 - a0) * ((k + 0.5) / 4);
        const pr = CS_RING_R + CS_RING_W * 0.5 + 7;
        c.fillStyle = k < owned ? '#ffd24c' : 'rgba(255,255,255,0.16)';
        c.beginPath(); c.arc(cx + Math.cos(pa) * pr, cy + Math.sin(pa) * pr, 2.4, 0, Math.PI * 2); c.fill();
      }
      // the label, outside the ring
      const la = (a0 + a1) / 2, lr = CS_RING_R + 30;
      const lx = cx + Math.cos(la) * lr, ly = cy + Math.sin(la) * lr;
      c.textAlign = 'center';
      c.font = `bold ${isSel ? 12 : 11}px monospace`;
      c.fillStyle = isSel ? col : (maxed ? '#ffd24c' : '#8fa3bf');
      c.fillText(`${i + 1} ${stat}`, lx, ly);
      c.font = '9px monospace'; c.fillStyle = '#667';
      c.fillText(maxed ? 'MAX · IV' : `${sp} pts`, lx, ly + 11);

      // the hitbox: a generous box around the label, so a click or a hover selects it
      rects.push({ x: lx - 44, y: ly - 14, w: 88, h: 30, stat });
    }

    // -------------------------------------------------- the one gold sentence
    const nx = csNextLine(p);
    c.textAlign = 'center';
    c.font = 'bold 13px monospace';
    c.fillStyle = nx.color;
    c.fillText(nx.text, cx, 424);
    c.font = '10px monospace'; c.fillStyle = '#7a8698';
    c.fillText('hover a ring (or press 1-5) to see exactly what it will offer you', cx, 444);

    // health / gear, small, under the portrait: the facts you glance at, not study
    c.font = '11px monospace';
    c.fillStyle = '#c8d2e0';
    const wep = (p.weapons && p.weapons[p.slot]) || (p.weapons && p.weapons.a);
    const gear = [
      `${Math.ceil(p.hp)}/${Math.round(p.maxHp)} HP`,
      wep ? wep.name : 'unarmed',
      p.armor ? p.armor.name : 'no armour',
    ].join('   ·   ');
    c.fillText(gear, cx, 472);

    // ============================ THE RIGHT COLUMN ============================
    const rx = W - 330, rw = 300;
    c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(rx - 22, 40); c.lineTo(rx - 22, H - 40); c.stroke();
    c.textAlign = 'left';

    if (!sel) {
      // ---- DEFAULT: what you actually HAVE. Not what you could have. -----------
      let y = 58;
      c.font = 'bold 12px monospace'; c.fillStyle = '#8fa3bf';
      c.fillText('WHAT YOU HAVE', rx, y); y += 22;

      // the three powers, in plain English
      const powers = [
        ['Q', p.ability], ['R', p.abilityR], ['ULT', p.abilityUlt],
      ];
      for (const [key, a] of powers) {
        if (!a) continue;
        c.font = 'bold 11px monospace'; c.fillStyle = a.color || '#ffd24c';
        c.fillText(`${key}  ${a.name}`, rx, y); y += 13;
        if (a.desc) {
          c.font = '10px monospace'; c.fillStyle = '#8b93a3';
          y = wrapText(c, a.desc, rx + 8, y, rw - 16, 12) + 6;
        } else y += 4;
      }
      y += 6;

      // the evolutions you have taken, coloured by the stat that grew them
      c.font = 'bold 12px monospace'; c.fillStyle = '#8fa3bf';
      c.fillText(`EVOLUTIONS  (${(p.evoTaken || []).length})`, rx, y); y += 18;
      const taken = p.evoTaken || [];
      if (!taken.length) {
        c.font = '10px monospace'; c.fillStyle = '#667';
        c.fillText('none yet - stack a stat to 3 points', rx, y); y += 14;
      }
      for (const ev of taken.slice(-9)) {
        const stat = Evolutions.STAT_OF[ev.key] || 'MIGHT';
        c.fillStyle = Evolutions.STAT_COLOR[stat] || '#ffd24c';
        c.font = '11px monospace';
        c.fillText('◆ ' + ev.name, rx, y);
        y += 15;
        if (y > H - 90) break;
      }

      // the pet
      if (p.pet) {
        y += 6;
        c.font = 'bold 12px monospace'; c.fillStyle = '#8fa3bf';
        c.fillText('COMPANION', rx, y); y += 16;
        c.font = '11px monospace'; c.fillStyle = p.pet.color || '#6ee7a0';
        c.fillText(p.pet.name, rx, y); y += 13;
        c.font = '10px monospace'; c.fillStyle = '#8b93a3';
        c.fillText(p.pet.desc || '', rx, y);
      }
    } else {
      // ---- DRILL-DOWN: exactly what THIS ring will offer you, and whether it is
      //      worth anything to you specifically. This is the part that decides picks.
      const col = Evolutions.STAT_COLOR[sel];
      const sp = (p.statPoints && p.statPoints[sel]) || 0;
      const owned = Math.floor(sp / 3);
      const maxed = owned >= 4;
      let y = 58;

      c.font = 'bold 15px monospace'; c.fillStyle = col;
      c.fillText(sel, rx, y); y += 16;
      c.font = 'italic 10px monospace'; c.fillStyle = '#7a8698';
      c.fillText(Evolutions.STAT_BLURB[sel] || '', rx, y); y += 20;

      // the honest offer sentence: which flavours this stat can even roll
      const trees = Evolutions.STAT_TREES[sel] || [];
      const names = trees.map(k => Evolutions.STAT_NAMES[k] || k);
      c.font = '10px monospace'; c.fillStyle = '#8b93a3';
      y = wrapText(c, `It rolls from: ${names.join(', ')}.`, rx, y, rw, 12) + 10;

      if (maxed) {
        c.font = 'bold 12px monospace'; c.fillStyle = '#ffd24c';
        c.fillText('FULLY EVOLVED · IV', rx, y); y += 16;
        c.font = '10px monospace'; c.fillStyle = '#8b93a3';
        y = wrapText(c, 'There are no evolutions left on this path. The stat point still counts, but it will never evolve again.', rx, y, rw, 12);
      } else {
        const nextT = Evolutions.THRESH.find(t => t > sp);
        c.font = 'bold 11px monospace'; c.fillStyle = '#ffd24c';
        c.fillText(`${sp}/${nextT} · ${nextT - sp} more point${nextT - sp === 1 ? '' : 's'} to TIER ${['I', 'II', 'III', 'IV'][owned]}`, rx, y);
        y += 22;

        // every option that tier can offer, with a verdict on each
        const opts = [];
        for (const k of trees) {
          const tier = (Evolutions.TABLE[k] && Evolutions.TABLE[k][nextT]) || [];
          for (const o of tier) opts.push({ ...o, statKey: k });
        }
        c.font = 'bold 10px monospace'; c.fillStyle = '#8fa3bf';
        c.fillText('IT WILL OFFER YOU THREE OF THESE:', rx, y); y += 16;

        for (const o of opts) {
          if (y > H - 64) {
            c.font = 'italic 9px monospace'; c.fillStyle = '#667';
            c.fillText('...and more', rx, y + 4);
            break;
          }
          const v = Evolutions.verdictFor(p, o);
          c.font = 'bold 11px monospace'; c.fillStyle = col;
          c.fillText(o.name, rx, y);
          // the verdict stamp, right-aligned: STACKS / CAPPED / DEAD SLOT
          c.textAlign = 'right';
          c.font = 'bold 9px monospace'; c.fillStyle = v.color;
          c.fillText(v.tag, rx + rw, y);
          c.textAlign = 'left';
          y += 14;
          c.font = '9px monospace'; c.fillStyle = v.tag === 'STACKS' ? '#8b93a3' : v.color;
          y = wrapText(c, v.text, rx + 6, y, rw - 12, 11) + 13;
        }
      }
    }

    // ------------------------------------------------------------------- footer
    c.textAlign = 'center';
    c.font = '10px monospace'; c.fillStyle = '#667';
    c.fillText(sel ? '1-5 or hover another ring  ·  0 back to the portrait  ·  C / Esc to resume'
                   : 'hover a ring or press 1-5  ·  C / Esc to resume', W / 2, H - 16);
    c.restore();
    return rects;
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
    c.fillStyle = won ? '#ffd24c' : (g.retired ? '#8fd0ff' : '#c02040');
    c.fillText(won ? 'THE HOARD IS YOURS' : (g.retired ? 'RUN ENDED' : 'YOU DIED'), W / 2, 150);
    if (!won && g.retired) {
      c.font = '15px monospace'; c.fillStyle = '#7fd4ff';
      c.fillText('You retired with your essence banked.', W / 2, 185);
    }
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

  // THE OFFER (encounters.js): a stranger's terms, the price, and the way out. The
  // "walk away" line is spelled out on purpose - a quest you cannot refuse is not a
  // quest, it is a tax.
  function drawOffer(c, g) {
    const q = Encounters.byKey(g.offer.key);
    if (!q) return;
    const pw = 560, ph = 252, px = (W - pw) / 2, py = (H - ph) / 2;
    c.save();
    c.fillStyle = 'rgba(6,8,12,0.86)'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#161b24'; c.fillRect(px, py, pw, ph);
    c.strokeStyle = '#ffd24c'; c.lineWidth = 2; c.strokeRect(px, py, pw, ph);
    c.textAlign = 'center';
    c.font = 'bold 22px monospace'; c.fillStyle = '#ffd24c';
    c.fillText(q.name, W / 2, py + 38);
    c.font = 'italic 12px monospace'; c.fillStyle = '#7a8698';
    c.fillText(q.who, W / 2, py + 58);
    c.font = '13px monospace'; c.fillStyle = '#cfe0f0';
    wrapText(c, '"' + q.pitch + '"', W / 2, py + 88, pw - 60, 18);
    c.font = 'bold 11px monospace'; c.fillStyle = '#ff9a4c';
    c.fillText('THE DEAL', W / 2, py + 140);
    c.font = '12px monospace'; c.fillStyle = '#e8d5a0';
    wrapText(c, q.terms, W / 2, py + 158, pw - 60, 16);
    c.font = 'bold 11px monospace'; c.fillStyle = '#6ee7a0';
    c.fillText('THE REWARD', W / 2, py + 190);
    c.font = '12px monospace'; c.fillStyle = '#e8d5a0';
    wrapText(c, q.reward, W / 2, py + 208, pw - 60, 16);
    c.font = 'bold 12px monospace'; c.fillStyle = '#9fb0c8';
    c.fillText('E / SPACE  accept          Q / ESC  walk away', W / 2, py + ph - 12);
    c.restore();
  }

  return { META_UPGRADES, metaCost, GAME_URL, drawHUD, drawMinimap, drawBossBar, drawBossIntro, drawTitle, drawLobby, drawLevelUp, drawEvolution, drawUltPick, drawRPick, drawPause, drawCharSheet, drawEnd, drawInitials, abilityBadges, weaponSilhouette, drawToasts, drawEnchantPick, drawScoreSnap, drawOffer };
})();
