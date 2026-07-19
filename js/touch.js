// ============================================================================
// touch.js - MOBILE (Sam, 2026-07-14).
//
// The game is already most of the way to being playable on a phone, and it does not
// know it: AUTO-ATTACK is on by default and it targets for you, so a touch player
// does not need to aim a mouse to fight. What is missing is a way to move, and a way
// to press the six buttons that matter.
//
// DESIGN RULE: this file drives the EXISTING `input` object (the same key Set and
// mouse the desktop game reads) and changes no game logic at all. A synthetic
// 'KeyE' from a thumb is indistinguishable from a real one. The one exception is
// input.stick, an analog movement vector - 8-way key emulation feels terrible on a
// touchscreen, and the player reads the stick when it is present.
//
// AIM: with no mouse, `facing` would be stuck. On touch we aim the player at the
// nearest living monster every frame, so abilities and the ultimate fire at the
// thing you are obviously trying to hit.
//
// Everything is drawn on the SAME canvas in game coordinates (960x540), so the
// controls scale with the game and need no DOM, no CSS, and no layout code.
// ============================================================================
const Mobile = (() => {
  // A phone is a coarse pointer with a touch screen. A laptop with a touchscreen is
  // NOT a phone - it has a mouse and a keyboard - so require BOTH signals.
  //
  // ?touch=1 forces the controls on anywhere. That is how you look at them on a
  // desktop without a phone in your hand, and it is how the dbg harness tests them.
  const forced = /[?&]touch=1/.test(location.search);
  const isTouch = forced || (('ontouchstart' in window || navigator.maxTouchPoints > 0)
                && window.matchMedia('(pointer: coarse)').matches);

  let enabled = false;
  let W = 960, H = 540;
  let canvas = null, input = null;
  // start() fires on a raw touchstart and has no `g`. update()/draw() DO get `g`
  // every frame, so they stash the live state + game here for start() to read. This
  // is what lets a tap KNOW whether it is a menu click or an in-play control.
  let curState = null, curG = null;
  let kbd = null;   // the hidden <input> that raises the phone's soft keyboard (name entry)
  let lastKbd = '';  // its value last frame, to diff into synthetic keystrokes

  // the left thumb: a floating stick that appears where you put your thumb down
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false };
  const R = 62;         // how far the stick travels before it is "full"

  // the right thumb: the buttons. Laid out along the bottom-right, thumb-reachable.
  const BUTTONS = [
    // raised ~26px (Sam: the bottom row sat under the edge of the screen)
    { key: 'roll',  label: 'ROLL', code: 'Space', x: 792, y: 444, r: 34, col: '#7fd4ff' },
    { key: 'q',     label: 'Q',    code: 'KeyQ',  x: 726, y: 398, r: 27, col: '#ffd24c' },
    { key: 'r',     label: 'R',    code: 'KeyR',  x: 792, y: 370, r: 27, col: '#ff9a4c' },
    { key: 'ult',   label: 'ULT',  code: null,    x: 858, y: 398, r: 30, col: '#ff5a8a' }, // right-click on desktop
    { key: 'use',   label: 'E',    code: 'KeyE',  x: 726, y: 468, r: 24, col: '#6ee7a0' },
    { key: 'swap',  label: 'SWAP', code: 'Tab',   x: 858, y: 468, r: 24, col: '#9fb0c8' },
  ];
  const held = {};   // buttonKey -> touch identifier

  // the PAUSE pip. Drawn in the play HUD, right-edge centre (clear of the top-left
  // health bar, the top-right minimap and the bottom-right button cluster). A tap
  // synthesizes 'Escape', which is exactly how the keyboard opens the pause menu -
  // and in co-op it toggles the menu overlay, same as Escape does there.
  const PAUSE = { x: 930, y: 232, r: 16, downT: 0 };
  // the STATS pip (Sam): touch had no way to open the character sheet (desktop uses C).
  // A tap synthesizes 'KeyC', which opens the sheet exactly like the keyboard.
  const SHEET = { x: 930, y: 286, r: 16, downT: 0 };

  // the title CLASS STRIP: a horizontal drag that begins on a class card pages the list,
  // the natural phone gesture (the < > arrows still work for a tap). Tracked by touch id.
  const strip = { id: null, x: 0 };
  const STRIP_STEP = 55;   // horizontal px per one class page

  // CONTROL SCALE (Sam): the stick + buttons are sized in the fixed 960x540 space, so on a
  // BIG display (desktop / a large tablet showing the touch controls) they render huge. Shrink
  // them there; a real phone (small rendered canvas) is left at full, finger-friendly size.
  // Geometry is scaled around the bottom-right corner each frame into b.dx/b.dy/b.dr.
  let ctlS = 1;
  const CAX = 892, CAY = 482;   // the corner the button cluster shrinks toward
  const sr = () => R * ctlS;    // scaled stick travel

  // canvas coords from a touch (the canvas is CSS-scaled, so map through the rect)
  function toGame(t) {
    const r = canvas.getBoundingClientRect();
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  }
  const hit = (p, b) => Math.hypot(p.x - (b.dx != null ? b.dx : b.x), p.y - (b.dy != null ? b.dy : b.y)) <= (b.dr != null ? b.dr : b.r) + 12 * ctlS; // +12: thumbs are not precise

  function press(b) {
    if (b.key === 'ult') { if (onUlt) onUlt(); return; }
    input.keys.add(b.code); input.just.add(b.code);
  }
  function release(b) { if (b.code) input.keys.delete(b.code); }

  let onUlt = null, onFs = null;
  // #270 (Sam) AUTO-FULLSCREEN on a phone: the game arrives as a tiny window inside the
  // browser chrome. The first time you tap into the game we enter fullscreen (which must
  // fire inside the touch gesture), reclaiming the address bar's stolen height. Once per
  // session, ENTER only (never toggles you back out), and a silent no-op where fullscreen
  // is unavailable - notably iPhone Safari, which offers it for <video> alone.
  let autoFsDone = false;
  const fsActive = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

  // does this touch point land on a uiRect carrying the given action? (curG.uiRects
  // is the game's own hit-rect list, refreshed each draw)
  function hitsRect(p, action) {
    const rects = curG && curG.uiRects;
    if (!rects) return false;
    for (const r of rects) {
      if (r.action === action && p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) return true;
    }
    return false;
  }

  function clickAt(p) {
    // a tap = a left mouse click at that point. Menus, the title screen, the level-up
    // cards, the game-over screen and the pause menu ALL dispatch off input.mouse.clicked
    // landing on a uiRect (handled in main.js) - so this is how every menu is tapped.
    input.mouse.x = p.x; input.mouse.y = p.y;
    input.mouse.clicked = true; input.mouse.down = true; input.mouse.moved = true;
  }

  function start(e) {
    if (!enabled) return;
    // THE root rule: the movement stick and the six thumb buttons exist ONLY while
    // playing. Off play (title, cards, game-over, pause, lobby...) every tap is a click,
    // whatever half of the screen it lands in - otherwise the whole LEFT half of every
    // centred menu (SOLO PLAY, the leftmost card, PLAY AGAIN, the race tiles) is dead,
    // because a left-half touch used to arm the invisible stick and never clicked.
    // Menus route taps as clicks. The co-op PAUSE menu is the one 'menu' that keeps
    // state==='play' (the shared world must not freeze for the party), so treat an open
    // coopMenu as not-in-play too, or its buttons are dead and the stick draws over it.
    const inPlay = curState === 'play' && !(curG && curG.coopMenu);
    for (const t of e.changedTouches) {
      const p = toGame(t);
      if (!inPlay) {
        // FULLSCREEN must fire INSIDE the touch gesture: requestFullscreen only works
        // during the browser's transient activation, which a frame-later dispatch misses
        // (the desktop RMB path does the same at main.js). Only where the button actually
        // lives (title / pause / co-op menu) - matches the desktop guard, ignores stale rects.
        const fsHere = curState === 'title' || curState === 'pause' || (curG && curG.coopMenu);
        if (onFs && fsHere && hitsRect(p, 'fullscreen')) { onFs(); continue; }
        // #270 first tap into the game -> go fullscreen (enter only, once). The same tap
        // still routes to whatever menu button it hit, so tapping SOLO PLAY both starts the
        // run and fills the screen. onFs toggles, so guard on fsActive() to never exit here.
        if (onFs && !autoFsDone && curState === 'title' && !fsActive()) { autoFsDone = true; onFs(); }
        clickAt(p);
        // iOS raises the soft keyboard ONLY from a focus() inside the real touch
        // gesture (not a frame later), so any typed field is focused right here.
        if (textState()) focusKeyboard();
        // a touch that lands on a class card can be DRAGGED sideways to page the strip
        // (the tap still selects - selecting a class is a harmless highlight until PLAY).
        if (hitsRect(p, 'selectClass')) { strip.id = t.identifier; strip.x = p.x; }
        continue;
      }
      // --- in play ---
      let onButton = false;
      for (const b of BUTTONS) {
        if (hit(p, b) && held[b.key] === undefined) { held[b.key] = t.identifier; press(b); onButton = true; break; }
      }
      if (onButton) continue;
      if (hit(p, PAUSE)) { input.just.add('Escape'); PAUSE.downT = 0.18; continue; }
      if (hit(p, SHEET)) { input.just.add('KeyC'); SHEET.downT = 0.18; continue; } // open the character sheet
      if (p.x < W * 0.5 && stick.id === null) {     // left half -> the movement stick
        stick.id = t.identifier; stick.active = true;
        stick.ox = p.x; stick.oy = p.y; stick.x = p.x; stick.y = p.y;
      } else {
        // right half, not a button: a click (manual attack when auto-attack is off)
        clickAt(p);
      }
    }
    e.preventDefault();
  }

  function move(e) {
    if (!enabled) return;
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) {
        const p = toGame(t);
        stick.x = p.x; stick.y = p.y;
      } else if (strip.id !== null && t.identifier === strip.id) {
        // drag the class strip: each STRIP_STEP of horizontal travel pages it one class.
        // Dragging LEFT reveals the classes to the right (scrollClasses +1), like a phone list.
        const dx = toGame(t).x - strip.x;
        if (Math.abs(dx) >= STRIP_STEP) {
          if (typeof UI !== 'undefined' && UI.scrollClasses) UI.scrollClasses(dx < 0 ? 1 : -1);
          strip.x += dx < 0 ? -STRIP_STEP : STRIP_STEP;   // consume one page; keep the remainder
        }
      }
    }
    e.preventDefault();
  }

  function end(e) {
    if (!enabled) return;
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) { stick.id = null; stick.active = false; }
      if (t.identifier === strip.id) { strip.id = null; }
      for (const b of BUTTONS) {
        if (held[b.key] === t.identifier) { release(b); delete held[b.key]; }
      }
    }
    input.mouse.down = false;
    e.preventDefault();
  }

  // Called once per frame BEFORE the game reads input.
  function update(g) {
    if (!enabled) return;
    curG = g; curState = g && g.state;          // so start() knows menu-vs-play
    // scale the controls down on a large rendered canvas (desktop); phones stay full-size
    const dispW = (canvas && canvas.getBoundingClientRect) ? (canvas.getBoundingClientRect().width || W) : W;
    ctlS = dispW <= 1000 ? 1 : Math.max(0.55, 1000 / dispW); // phone/tablet full size; desktop shrinks
    for (const b of BUTTONS) { b.dx = CAX + (b.x - CAX) * ctlS; b.dy = CAY + (b.y - CAY) * ctlS; b.dr = b.r * ctlS; }
    for (const pip of [PAUSE, SHEET]) { pip.dx = CAX + (pip.x - CAX) * ctlS; pip.dy = CAY + (pip.y - CAY) * ctlS; pip.dr = pip.r * ctlS; if (pip.downT > 0) pip.downT -= 1 / 60; }
    // let go of the phone keyboard the moment we leave any typed field
    if (kbd && !textState() && typeof document !== 'undefined' && document.activeElement === kbd) kbd.blur();
    // the analog stick -> input.stick, read by player.js
    if (stick.active) {
      const Rs = sr();
      let dx = stick.x - stick.ox, dy = stick.y - stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > Rs) { dx = dx / d * Rs; dy = dy / d * Rs; }
      const mag = Math.min(1, d / Rs);
      input.stick = mag > 0.18 ? { x: dx / Rs, y: dy / Rs, mag } : null;  // a deadzone, so a resting thumb does not drift
    } else {
      input.stick = null;
    }
    // AIM: there is no mouse, so face the nearest living monster. Abilities and the
    // ultimate all fire along `facing`, so this is what makes them usable at all.
    if (g && g.player && g.state === 'play' && g.monsters) {
      let best = null, bd = 1e9;
      for (const m of g.monsters) {
        if (m.dead) continue;
        const d = Math.hypot(m.x - g.player.x, m.y - g.player.y);
        if (d < bd) { bd = d; best = m; }
      }
      if (best) { input.mouse.x = best.x; input.mouse.y = best.y; }
      else if (input.stick) {   // nothing to fight: face where you are walking
        input.mouse.x = g.player.x + input.stick.x * 100;
        input.mouse.y = g.player.y + input.stick.y * 100;
      }
    }
  }

  // Drawn last, over the HUD, in game coordinates - so it scales with everything else.
  function draw(c, g) {
    // hidden during the co-op pause menu (state is still 'play' there) so the stick and
    // buttons do not sit on top of the menu the player is trying to tap.
    if (!enabled || !g || g.state !== 'play' || g.coopMenu) return;
    c.save();
    // the stick (travel + visuals scale with the controls)
    const Rs = sr();
    if (stick.active) {
      c.globalAlpha = 0.30;
      c.strokeStyle = '#cfe0f0'; c.lineWidth = 2;
      c.beginPath(); c.arc(stick.ox, stick.oy, Rs, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 0.55;
      let dx = stick.x - stick.ox, dy = stick.y - stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > Rs) { dx = dx / d * Rs; dy = dy / d * Rs; }
      c.fillStyle = '#cfe0f0';
      c.beginPath(); c.arc(stick.ox + dx, stick.oy + dy, 22 * ctlS, 0, Math.PI * 2); c.fill();
    } else {
      // the resting hint. Sits clear of the weapon/armor slots in the bottom-left
      // corner - the stick itself is FLOATING and appears wherever your thumb lands.
      c.globalAlpha = 0.14;
      c.strokeStyle = '#cfe0f0'; c.lineWidth = 2;
      c.beginPath(); c.arc(126, 372, Rs, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 0.45; c.fillStyle = '#8fa3bf';
      c.font = `${Math.round(10 * ctlS)}px monospace`; c.textAlign = 'center';
      c.fillText('MOVE', 126, 376);
    }
    // the buttons. On touch these REPLACE the desktop ability badges (ui.js hides
    // them), so the cooldown has to live here or the player is flying blind: a button
    // on cooldown is dimmed and wears a shrinking arc, exactly like the badges did.
    const p = g.player;
    const cool = b => {
      if (!p) return 0;
      const a = b.key === 'q' ? p.ability : b.key === 'r' ? p.abilityR : b.key === 'ult' ? p.abilityUlt : null;
      if (a) return a.cdMax > 0 ? Math.max(0, a.cd / a.cdMax) : 0;
      if (b.key === 'roll') return p.rollCdMax > 0 ? Math.max(0, p.rollCd / p.rollCdMax) : 0;
      return 0;
    };
    c.textAlign = 'center';
    for (const b of BUTTONS) {
      const bx = b.dx, by = b.dy, br = b.dr;     // scaled geometry
      const down = held[b.key] !== undefined;
      const cd = cool(b);                       // 1 = just used, 0 = ready
      const ready = cd <= 0.001;
      c.globalAlpha = down ? 0.72 : (ready ? 0.34 : 0.16);
      c.fillStyle = b.col;
      c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill();
      c.globalAlpha = down ? 1 : (ready ? 0.75 : 0.35);
      c.strokeStyle = b.col; c.lineWidth = 2;
      c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.stroke();
      if (cd > 0.001) {                          // the cooldown sweep, draining clockwise
        c.globalAlpha = 0.9;
        c.strokeStyle = b.col; c.lineWidth = 3;
        c.beginPath();
        c.arc(bx, by, br - 3, -Math.PI / 2, -Math.PI / 2 + (1 - cd) * Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;
      c.fillStyle = ready ? '#0b0e14' : 'rgba(11,14,20,0.5)';
      c.font = `bold ${Math.round((b.r > 28 ? 12 : 11) * ctlS)}px monospace`;
      c.fillText(b.label, bx, by + 4 * ctlS);
      // TOOLTIP (Sam): touch can't hover the desktop ability badge, so name Q/R/ULT right on
      // the button - a new player pressing Q now knows it is Brimstone / Discord / whatever.
      if (p && (b.key === 'q' || b.key === 'r' || b.key === 'ult')) {
        const a = b.key === 'q' ? p.ability : b.key === 'r' ? p.abilityR : p.abilityUlt;
        if (a && a.name) {
          c.globalAlpha = 0.8; c.fillStyle = b.col;
          c.font = `bold ${Math.round(9 * ctlS)}px monospace`;
          c.fillText(a.name, bx, by - br - 4 * ctlS);
          c.globalAlpha = 1;
        }
      }
    }
    // the PAUSE pip (two bars), so a phone player can stop, end the run to bank the
    // score, or head to the menu - none of which was reachable without a keyboard.
    const down = PAUSE.downT > 0, px = PAUSE.dx, py = PAUSE.dy, pr = PAUSE.dr;
    c.globalAlpha = down ? 0.75 : 0.34;
    c.fillStyle = '#9fb0c8';
    c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.fill();
    c.globalAlpha = down ? 1 : 0.7;
    c.strokeStyle = '#9fb0c8'; c.lineWidth = 2;
    c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1; c.fillStyle = '#0b0e14';
    c.fillRect(px - 5 * ctlS, py - 6 * ctlS, 3 * ctlS, 12 * ctlS);
    c.fillRect(px + 2 * ctlS, py - 6 * ctlS, 3 * ctlS, 12 * ctlS);
    // the STATS pip ("C") - opens the character sheet
    const sd = SHEET.downT > 0, sx = SHEET.dx, sy = SHEET.dy, sr2 = SHEET.dr;
    c.globalAlpha = sd ? 0.75 : 0.34; c.fillStyle = '#b8a0d8';
    c.beginPath(); c.arc(sx, sy, sr2, 0, Math.PI * 2); c.fill();
    c.globalAlpha = sd ? 1 : 0.7; c.strokeStyle = '#b8a0d8'; c.lineWidth = 2;
    c.beginPath(); c.arc(sx, sy, sr2, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1; c.fillStyle = '#0b0e14';
    c.font = `bold ${Math.round(13 * ctlS)}px monospace`; c.textAlign = 'center';
    c.fillText('C', sx, sy + 5 * ctlS);
    c.restore();
  }

  // TEXT ENTRY: a phone has no physical keyboard, so every typed field was unreachable -
  // the high-score name ('initials'), the title rename, the co-op lobby name, and the
  // 4-char JOIN room code. One hidden, focusable <input> (index.html id "mkeyb") raises
  // the native soft keyboard. Rather than write game state from here, it acts as a pure
  // KEYSTROKE SOURCE: each typed char is turned into the SAME KeyCode the desktop fires
  // (KeyA / Digit3 / Space / Backspace) and pushed into input.just, so the game's own
  // updateInitials + updateLobby handle it - filtering, max-length, saveName and Net.join
  // all reuse one code path, exactly matching desktop (which is uppercase-only too).
  const textState = () => curState === 'initials' ||
    (curState === 'lobby' && curG && curG.lobby && curG.lobby.mode !== 'host');
  function focusKeyboard() {
    if (!kbd) return;
    kbd.value = ''; lastKbd = '';   // a scratch buffer; the drawn field is the game's own state
    try { kbd.focus(); } catch (e) { /* an embed can refuse focus; harmless */ }
  }
  function pumpKbd() {
    // diff the buffer against last frame and synthesize the added/removed keystrokes
    const v = kbd.value, o = lastKbd;
    if (v.length > o.length) {
      for (const ch of v.slice(o.length)) {
        const u = ch.toUpperCase();
        if (u >= 'A' && u <= 'Z') input.just.add('Key' + u);
        else if (u >= '0' && u <= '9') input.just.add('Digit' + u);
        else if (ch === ' ') input.just.add('Space');
      }
    } else if (v.length < o.length) {
      input.just.add('Backspace');
    }
    lastKbd = v;
  }
  function wireKeyboard() {
    if (typeof document === 'undefined') return;
    kbd = document.getElementById('mkeyb');
    if (!kbd) return;
    kbd.addEventListener('input', pumpKbd);
    kbd.addEventListener('keydown', ev => {
      // stop main.js's window keydown listener from ALSO seeing these (double input)
      ev.stopPropagation();
      if (ev.key === 'Enter') { input.just.add('Enter'); kbd.blur(); }
      else if (ev.key === 'Escape') { input.just.add('Escape'); kbd.blur(); }
    });
  }

  // PORTRAIT: the play field is a fixed 16:9, so upright it renders as a thin strip.
  // Show a "rotate your phone" overlay instead of letting the son squint at a sliver.
  // Prompt only - the internal resolution never changes (co-op seed parity).
  function syncOrientation() {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('rotate');
    if (!el) return;
    const portrait = window.innerHeight > window.innerWidth;
    el.style.display = portrait ? 'flex' : 'none';
  }

  // wire up. `ultFn` fires the ultimate (right-click on desktop); `fsFn` toggles
  // fullscreen (must run inside the touch gesture for the browser to honor it).
  function init(cv, inp, ultFn, fsFn) {
    canvas = cv; input = inp; onUlt = ultFn; onFs = fsFn;
    W = cv.width; H = cv.height;
    if (!isTouch) return false;
    enabled = true;
    wireKeyboard();
    // the page must not scroll, zoom, or fire a 300ms synthetic click
    cv.addEventListener('touchstart', start, { passive: false });
    cv.addEventListener('touchmove', move, { passive: false });
    cv.addEventListener('touchend', end, { passive: false });
    cv.addEventListener('touchcancel', end, { passive: false });
    document.body.style.touchAction = 'none';
    document.body.style.userSelect = 'none';
    syncOrientation();
    window.addEventListener('resize', syncOrientation);
    window.addEventListener('orientationchange', syncOrientation);
    return true;
  }

  return { init, update, draw, get enabled() { return enabled; }, get isTouch() { return isTouch; }, BUTTONS };
})();
