// touch.js: the MOBILE control layer, tested with synthetic touches and no browser.
// touch.js is DOM-coupled (window/navigator/document/location) and never at LOAD time
// once ?touch=1 forces the controls on (the `forced ||` short-circuits the coarse-pointer
// probe), so we load it via `new Function` with shims - the same trick netbus.test.js
// uses for net.js. Everything here guards the WAVE-1 mobile fixes:
//   - a tap in a MENU state is a click, not the movement stick (SOLO PLAY et al.)
//   - a left-half tap DURING PLAY is the stick, not a click
//   - the six thumb buttons + the pause pip only fire in play (no null-player ULT crash)
//   - the pause pip synthesizes Escape; name entry routes the hidden <input> into the game
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js', 'touch.js'), 'utf8');

// a minimal DOM element that records its event handlers and focus state
function fakeEl() {
  const h = {};
  return {
    value: '', maxLength: 0, focused: false, style: { display: '' },
    addEventListener: (t, fn) => { h[t] = fn; },
    focus() { this.focused = true; if (this._onfocus) this._onfocus(this); },
    blur() { this.focused = false; if (this._onblur) this._onblur(this); },
    fire(t, ev) { if (h[t]) h[t](ev || {}); },
  };
}

function makeMobile({ portrait = false } = {}) {
  const kbd = fakeEl(), rotate = fakeEl();
  const doc = {
    body: { style: {} },
    activeElement: null,
    getElementById: id => (id === 'mkeyb' ? kbd : id === 'rotate' ? rotate : null),
  };
  kbd._onfocus = el => { doc.activeElement = el; };
  kbd._onblur = el => { if (doc.activeElement === el) doc.activeElement = null; };
  const win = {
    innerWidth: portrait ? 400 : 800, innerHeight: portrait ? 800 : 400,
    addEventListener: () => {}, matchMedia: () => ({ matches: false }),
  };
  const nav = { maxTouchPoints: 1 };
  const loc = { search: '?touch=1' };

  const handlers = {};
  const canvas = {
    width: 960, height: 540,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }),
    addEventListener: (t, fn) => { handlers[t] = fn; },
  };

  // in the browser UI is a global const (from ui.js); the sandbox has no globals, so we
  // pass a fake UI as an extra Function arg (touch.js references bare `UI`).
  const scrollCalls = [];
  const UI = { scrollClasses: d => scrollCalls.push(d) };
  const Mobile = new Function('location', 'window', 'navigator', 'document', 'UI', SRC + '\nreturn Mobile;')
    (loc, win, nav, doc, UI);

  const input = { keys: new Set(), just: new Set(), mouse: { x: 0, y: 0, down: false, clicked: false, moved: false }, stick: null };
  let ultCalls = 0, fsCalls = 0;
  Mobile.init(canvas, input, () => { ultCalls++; }, () => { fsCalls++; });

  // the canvas rect is 0,0 -> 960x540, so client coords ARE game coords (toGame is 1:1)
  const ev = touches => ({ changedTouches: touches, preventDefault() {} });
  const T = (x, y, id = 1) => ({ identifier: id, clientX: x, clientY: y });
  return {
    Mobile, input, kbd, rotate, doc,
    ults: () => ultCalls,
    fs: () => fsCalls,
    scrolls: () => scrollCalls,
    frame: g => Mobile.update(g),                       // one pre-input frame at state g
    down: (x, y, id) => handlers.touchstart(ev([T(x, y, id)])),
    move: (x, y, id) => handlers.touchmove(ev([T(x, y, id)])),
    up: (x, y, id) => handlers.touchend(ev([T(x, y, id)])),
    clearFrame: () => { input.just.clear(); input.mouse.clicked = false; input.mouse.moved = false; },
  };
}

describe('mobile: menu taps are clicks, not the stick (the WAVE-1 root fix)', () => {
  it('a left-half tap on the TITLE screen is a click and never arms the stick', () => {
    const m = makeMobile();
    m.frame({ state: 'title' });         // tell start() we are in a menu
    m.down(300, 200);                    // left half (x < 480) - used to be swallowed by the stick
    expect(m.input.mouse.clicked).toBe(true);
    m.frame({ state: 'title' });
    expect(m.input.stick).toBeNull();    // the stick must stay dead in a menu
  });

  it('the leftmost card / SOLO PLAY / PLAY AGAIN geometry (any x<480) taps through', () => {
    for (const st of ['title', 'levelup', 'evolution', 'rpick', 'ultpick', 'dead', 'pause']) {
      const m = makeMobile();
      m.frame({ state: st });
      m.down(90, 250);                   // far left, where the first card / button lives
      expect(m.input.mouse.clicked, `state ${st}`).toBe(true);
    }
  });
});

describe('mobile: in-play controls still work', () => {
  it('a left-half drag DURING PLAY moves the analog stick (not a click)', () => {
    const m = makeMobile();
    m.frame({ state: 'play' });
    m.down(300, 300);
    m.move(350, 300);                    // 50px right of the thumb origin
    m.frame({ state: 'play' });
    expect(m.input.stick).not.toBeNull();
    expect(m.input.stick.mag).toBeGreaterThan(0.18);
    expect(m.input.stick.x).toBeGreaterThan(0.5);
    expect(m.input.mouse.clicked).toBe(false);
  });

  it('a thumb button synthesizes its KeyCode; releasing it clears the key', () => {
    const m = makeMobile();
    m.frame({ state: 'play' });
    m.down(726, 398);                    // the Q button
    expect(m.input.keys.has('KeyQ')).toBe(true);
    expect(m.input.just.has('KeyQ')).toBe(true);
    m.up(726, 398);
    expect(m.input.keys.has('KeyQ')).toBe(false);
  });

  it('the ULT button fires the ultimate and adds no key', () => {
    const m = makeMobile();
    m.frame({ state: 'play' });
    m.down(858, 398);                    // the ULT button
    expect(m.ults()).toBe(1);
    expect([...m.input.keys]).toEqual([]);
  });

  it('the pause pip synthesizes Escape (opens the pause menu / co-op overlay)', () => {
    const m = makeMobile();
    m.frame({ state: 'play' });
    m.down(930, 232);                    // the pause pip
    expect(m.input.just.has('Escape')).toBe(true);
  });

  it('a right-half tap in play (not a button) is a click, for manual attack', () => {
    const m = makeMobile();
    m.frame({ state: 'play' });
    m.down(600, 120);                    // right half, clear of buttons + pip
    expect(m.input.mouse.clicked).toBe(true);
  });
});

describe('mobile: the thumb buttons are cold outside play (no null-player ULT crash)', () => {
  it('tapping the ULT hitbox on the TITLE screen does not fire the ult; it just clicks', () => {
    const m = makeMobile();
    m.frame({ state: 'title' });
    m.down(858, 398);                    // exact ULT hitbox, but on the title (g.player is null)
    expect(m.ults()).toBe(0);            // must NOT reach useUltimate -> g.player.abilityUlt
    expect(m.input.mouse.clicked).toBe(true);
  });
});

describe('mobile: soft-keyboard text entry (a pure keystroke source)', () => {
  it('a tap on the initials screen focuses the hidden input and types are synthesized as KeyCodes', () => {
    const m = makeMobile();
    m.frame({ state: 'initials', initials: { name: '', max: 10 } });
    m.down(400, 200);                    // any tap on the name screen
    expect(m.kbd.focused).toBe(true);    // iOS needs focus() inside the gesture
    // the soft keyboard types "sam" -> the game's updateInitials reads these from input.just
    m.kbd.value = 'sam'; m.kbd.fire('input');
    expect([...m.input.just]).toEqual(['KeyS', 'KeyA', 'KeyM']);  // uppercase KeyCodes, like desktop
    // a delete shortens the buffer -> Backspace
    m.clearFrame(); m.kbd.value = 'sa'; m.kbd.fire('input');
    expect(m.input.just.has('Backspace')).toBe(true);
    // Enter commits (same key the desktop handler reads)
    m.kbd.fire('keydown', { key: 'Enter', stopPropagation() {} });
    expect(m.input.just.has('Enter')).toBe(true);
  });

  it('the co-op JOIN screen focuses the keyboard and feeds the room code', () => {
    const m = makeMobile();
    m.frame({ state: 'lobby', lobby: { mode: 'join', entry: '' } });
    m.down(480, 260);
    expect(m.kbd.focused).toBe(true);
    m.kbd.value = 'K7'; m.kbd.fire('input');
    expect([...m.input.just]).toEqual(['KeyK', 'Digit7']); // updateLobby filters + appends these
  });

  it('the keyboard does not focus on the co-op HOST screen (no typing there)', () => {
    const m = makeMobile();
    m.frame({ state: 'lobby', lobby: { mode: 'host' } });
    m.down(480, 260);
    expect(m.kbd.focused).toBe(false);
  });

  it('leaving every typed field blurs the keyboard', () => {
    const m = makeMobile();
    m.frame({ state: 'initials', initials: { name: '', max: 10 } });
    m.down(400, 200);
    expect(m.kbd.focused).toBe(true);
    m.frame({ state: 'title' });         // committed / cancelled -> back to the title
    expect(m.kbd.focused).toBe(false);
  });
});

describe('mobile: fullscreen fires inside the touch gesture', () => {
  it('tapping the fullscreen rect calls the toggle synchronously and does not also click', () => {
    const m = makeMobile();
    // the game exposes the ⛶ hit-rect in uiRects on the title
    m.frame({ state: 'title', uiRects: [{ action: 'fullscreen', x: 12, y: 12, w: 30, h: 30 }] });
    m.down(27, 27);
    expect(m.fs()).toBe(1);                 // toggled inside the gesture
    expect(m.input.mouse.clicked).toBe(false); // consumed, so the frame loop won't double-toggle
  });

  it('does NOT fire on a screen where fullscreen does not live, even if a stale rect lingers', () => {
    const m = makeMobile();
    // uiRects were never cleared and still hold a fullscreen rect from the title
    m.frame({ state: 'dead', uiRects: [{ action: 'fullscreen', x: 12, y: 12, w: 30, h: 30 }] });
    m.down(27, 27);
    expect(m.fs()).toBe(0);                 // guarded to title/pause/coopMenu, like desktop
    expect(m.input.mouse.clicked).toBe(true); // just a normal menu tap
  });
});

describe('mobile: the co-op pause menu is tappable (it keeps state==="play")', () => {
  it('a left-half tap during coopMenu is a click, not the stick', () => {
    const m = makeMobile();
    m.frame({ state: 'play', coopMenu: true, uiRects: [] });
    m.down(300, 200);                       // left half - would arm the stick in real play
    expect(m.input.mouse.clicked).toBe(true);
    m.frame({ state: 'play', coopMenu: true });
    expect(m.input.stick).toBeNull();
  });

  it('fullscreen works from the co-op menu (fires inside the gesture)', () => {
    const m = makeMobile();
    m.frame({ state: 'play', coopMenu: true, uiRects: [{ action: 'fullscreen', x: 12, y: 12, w: 30, h: 30 }] });
    m.down(27, 27);
    expect(m.fs()).toBe(1);
  });
});

describe('mobile: drag the class strip to page it', () => {
  const titleWithStrip = { state: 'title', uiRects: [{ action: 'selectClass', x: 250, y: 328, w: 90, h: 40 }] };
  it('a horizontal drag beginning on a class card pages the list; the tap still selects', () => {
    const m = makeMobile();
    m.frame(titleWithStrip);
    m.down(295, 348);                    // touchstart on the class card
    expect(m.input.mouse.clicked).toBe(true);   // the tap still selects (harmless highlight)
    m.move(235, 348);                    // drag left 60px (> STRIP_STEP 55) -> page forward
    expect(m.scrolls()).toEqual([1]);
    m.move(175, 348);                    // a further 60px -> another page
    expect(m.scrolls()).toEqual([1, 1]);
    m.up(175, 348);
    m.move(100, 348);                    // after release, dragging does nothing
    expect(m.scrolls()).toEqual([1, 1]);
  });
  it('dragging the other way pages backward', () => {
    const m = makeMobile();
    m.frame(titleWithStrip);
    m.down(295, 348);
    m.move(355, 348);                    // drag right -> page back
    expect(m.scrolls()).toEqual([-1]);
  });
  it('a small wobble under the step threshold does not scroll (still a clean tap)', () => {
    const m = makeMobile();
    m.frame(titleWithStrip);
    m.down(295, 348);
    m.move(310, 348);                    // 15px < 55 -> no page
    expect(m.scrolls()).toEqual([]);
  });
});

describe('mobile: portrait shows the rotate prompt', () => {
  it('the rotate overlay is shown in portrait and hidden in landscape', () => {
    const p = makeMobile({ portrait: true });
    expect(p.rotate.style.display).toBe('flex');
    const l = makeMobile({ portrait: false });
    expect(l.rotate.style.display).toBe('none');
  });
});
