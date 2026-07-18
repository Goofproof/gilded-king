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

  // the left thumb: a floating stick that appears where you put your thumb down
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false };
  const R = 62;         // how far the stick travels before it is "full"

  // the right thumb: the buttons. Laid out along the bottom-right, thumb-reachable.
  const BUTTONS = [
    { key: 'roll',  label: 'ROLL', code: 'Space', x: 792, y: 470, r: 34, col: '#7fd4ff' },
    { key: 'q',     label: 'Q',    code: 'KeyQ',  x: 726, y: 424, r: 27, col: '#ffd24c' },
    { key: 'r',     label: 'R',    code: 'KeyR',  x: 792, y: 396, r: 27, col: '#ff9a4c' },
    { key: 'ult',   label: 'ULT',  code: null,    x: 858, y: 424, r: 30, col: '#ff5a8a' }, // right-click on desktop
    { key: 'use',   label: 'E',    code: 'KeyE',  x: 726, y: 494, r: 24, col: '#6ee7a0' },
    { key: 'swap',  label: 'SWAP', code: 'Tab',   x: 858, y: 494, r: 24, col: '#9fb0c8' },
  ];
  const held = {};   // buttonKey -> touch identifier

  // the PAUSE pip. Drawn in the play HUD, right-edge centre (clear of the top-left
  // health bar, the top-right minimap and the bottom-right button cluster). A tap
  // synthesizes 'Escape', which is exactly how the keyboard opens the pause menu -
  // and in co-op it toggles the menu overlay, same as Escape does there.
  const PAUSE = { x: 930, y: 250, r: 16, downT: 0 };

  // canvas coords from a touch (the canvas is CSS-scaled, so map through the rect)
  function toGame(t) {
    const r = canvas.getBoundingClientRect();
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  }
  const hit = (p, b) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 12; // +12: thumbs are not precise

  function press(b) {
    if (b.key === 'ult') { if (onUlt) onUlt(); return; }
    input.keys.add(b.code); input.just.add(b.code);
  }
  function release(b) { if (b.code) input.keys.delete(b.code); }

  let onUlt = null;

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
    const inPlay = curState === 'play';
    for (const t of e.changedTouches) {
      const p = toGame(t);
      if (!inPlay) {
        clickAt(p);
        // iOS raises the soft keyboard ONLY from a focus() inside the real touch
        // gesture (not a frame later), so name entry is focused right here.
        if (curState === 'initials') focusKeyboard();
        continue;
      }
      // --- in play ---
      let onButton = false;
      for (const b of BUTTONS) {
        if (hit(p, b) && held[b.key] === undefined) { held[b.key] = t.identifier; press(b); onButton = true; break; }
      }
      if (onButton) continue;
      if (hit(p, PAUSE)) { input.just.add('Escape'); PAUSE.downT = 0.18; continue; }
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
      }
    }
    e.preventDefault();
  }

  function end(e) {
    if (!enabled) return;
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) { stick.id = null; stick.active = false; }
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
    if (PAUSE.downT > 0) PAUSE.downT -= 1 / 60;  // brief press flash on the pause pip
    // let go of the phone keyboard the moment we leave the name screen
    if (kbd && curState !== 'initials' && typeof document !== 'undefined' && document.activeElement === kbd) kbd.blur();
    // the analog stick -> input.stick, read by player.js
    if (stick.active) {
      let dx = stick.x - stick.ox, dy = stick.y - stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      const mag = Math.min(1, d / R);
      input.stick = mag > 0.18 ? { x: dx / R, y: dy / R, mag } : null;  // a deadzone, so a resting thumb does not drift
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
    if (!enabled || !g || g.state !== 'play') return;
    c.save();
    // the stick
    if (stick.active) {
      c.globalAlpha = 0.30;
      c.strokeStyle = '#cfe0f0'; c.lineWidth = 2;
      c.beginPath(); c.arc(stick.ox, stick.oy, R, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 0.55;
      let dx = stick.x - stick.ox, dy = stick.y - stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      c.fillStyle = '#cfe0f0';
      c.beginPath(); c.arc(stick.ox + dx, stick.oy + dy, 22, 0, Math.PI * 2); c.fill();
    } else {
      // the resting hint. Sits clear of the weapon/armor slots in the bottom-left
      // corner - the stick itself is FLOATING and appears wherever your thumb lands.
      c.globalAlpha = 0.14;
      c.strokeStyle = '#cfe0f0'; c.lineWidth = 2;
      c.beginPath(); c.arc(126, 372, R, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 0.45; c.fillStyle = '#8fa3bf';
      c.font = '10px monospace'; c.textAlign = 'center';
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
      const down = held[b.key] !== undefined;
      const cd = cool(b);                       // 1 = just used, 0 = ready
      const ready = cd <= 0.001;
      c.globalAlpha = down ? 0.72 : (ready ? 0.34 : 0.16);
      c.fillStyle = b.col;
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
      c.globalAlpha = down ? 1 : (ready ? 0.75 : 0.35);
      c.strokeStyle = b.col; c.lineWidth = 2;
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.stroke();
      if (cd > 0.001) {                          // the cooldown sweep, draining clockwise
        c.globalAlpha = 0.9;
        c.strokeStyle = b.col; c.lineWidth = 3;
        c.beginPath();
        c.arc(b.x, b.y, b.r - 3, -Math.PI / 2, -Math.PI / 2 + (1 - cd) * Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;
      c.fillStyle = ready ? '#0b0e14' : 'rgba(11,14,20,0.5)';
      c.font = `bold ${b.r > 28 ? 12 : 11}px monospace`;
      c.fillText(b.label, b.x, b.y + 4);
    }
    // the PAUSE pip (two bars), so a phone player can stop, end the run to bank the
    // score, or head to the menu - none of which was reachable without a keyboard.
    const down = PAUSE.downT > 0;
    c.globalAlpha = down ? 0.75 : 0.34;
    c.fillStyle = '#9fb0c8';
    c.beginPath(); c.arc(PAUSE.x, PAUSE.y, PAUSE.r, 0, Math.PI * 2); c.fill();
    c.globalAlpha = down ? 1 : 0.7;
    c.strokeStyle = '#9fb0c8'; c.lineWidth = 2;
    c.beginPath(); c.arc(PAUSE.x, PAUSE.y, PAUSE.r, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1; c.fillStyle = '#0b0e14';
    c.fillRect(PAUSE.x - 5, PAUSE.y - 6, 3, 12);
    c.fillRect(PAUSE.x + 2, PAUSE.y - 6, 3, 12);
    c.restore();
  }

  // NAME ENTRY: a phone has no physical keyboard, so the 'initials' screen (high-score
  // name + the title rename) could never be typed - every player saved as 'AAA'. One
  // hidden, focusable <input> raises the native soft keyboard; its typed value flows
  // straight into g.initials.name, and Enter/Escape commit or cancel the same as the
  // desktop keys. The element lives in index.html (id "mkeyb").
  function focusKeyboard() {
    if (!kbd || !curG || !curG.initials) return;
    kbd.maxLength = curG.initials.max || 12;
    kbd.value = curG.initials.name || '';
    try { kbd.focus(); } catch (e) { /* an embed can refuse focus; harmless */ }
  }
  function wireKeyboard() {
    if (typeof document === 'undefined') return;
    kbd = document.getElementById('mkeyb');
    if (!kbd) return;
    kbd.addEventListener('input', () => {
      if (!curG || !curG.initials) return;
      let v = kbd.value;
      if (!curG.renameOnly) v = v.toUpperCase();  // the high-score board is uppercase; a rename keeps its case
      curG.initials.name = v.slice(0, curG.initials.max || 12);
    });
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

  // wire up. `ultFn` fires the ultimate (right-click on desktop).
  function init(cv, inp, ultFn) {
    canvas = cv; input = inp; onUlt = ultFn;
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
