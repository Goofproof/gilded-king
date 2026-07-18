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

  const Mobile = new Function('location', 'window', 'navigator', 'document', SRC + '\nreturn Mobile;')
    (loc, win, nav, doc);

  const input = { keys: new Set(), just: new Set(), mouse: { x: 0, y: 0, down: false, clicked: false, moved: false }, stick: null };
  let ultCalls = 0;
  Mobile.init(canvas, input, () => { ultCalls++; });

  // the canvas rect is 0,0 -> 960x540, so client coords ARE game coords (toGame is 1:1)
  const ev = touches => ({ changedTouches: touches, preventDefault() {} });
  const T = (x, y, id = 1) => ({ identifier: id, clientX: x, clientY: y });
  return {
    Mobile, input, kbd, rotate, doc,
    ults: () => ultCalls,
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
    m.down(726, 424);                    // the Q button
    expect(m.input.keys.has('KeyQ')).toBe(true);
    expect(m.input.just.has('KeyQ')).toBe(true);
    m.up(726, 424);
    expect(m.input.keys.has('KeyQ')).toBe(false);
  });

  it('the ULT button fires the ultimate and adds no key', () => {
    const m = makeMobile();
    m.frame({ state: 'play' });
    m.down(858, 424);                    // the ULT button
    expect(m.ults()).toBe(1);
    expect([...m.input.keys]).toEqual([]);
  });

  it('the pause pip synthesizes Escape (opens the pause menu / co-op overlay)', () => {
    const m = makeMobile();
    m.frame({ state: 'play' });
    m.down(930, 250);                    // the pause pip
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
    m.down(858, 424);                    // exact ULT hitbox, but on the title (g.player is null)
    expect(m.ults()).toBe(0);            // must NOT reach useUltimate -> g.player.abilityUlt
    expect(m.input.mouse.clicked).toBe(true);
  });
});

describe('mobile: soft-keyboard name entry', () => {
  it('a tap on the initials screen focuses the hidden input and routes typing into the game', () => {
    const m = makeMobile();
    const g = { state: 'initials', initials: { name: '', max: 10 }, renameOnly: false };
    m.frame(g);
    m.down(400, 200);                    // any tap on the name screen
    expect(m.kbd.focused).toBe(true);    // iOS needs focus() inside the gesture
    // the player types "sam" on the soft keyboard -> the <input> value changes
    m.kbd.value = 'sam';
    m.kbd.fire('input');
    expect(g.initials.name).toBe('SAM'); // high-score board is uppercase
    // Enter commits: it synthesizes the same key the desktop handler reads
    m.kbd.fire('keydown', { key: 'Enter', stopPropagation() {} });
    expect(m.input.just.has('Enter')).toBe(true);
  });

  it('a rename keeps its original case (not the uppercase board rule)', () => {
    const m = makeMobile();
    const g = { state: 'initials', initials: { name: '', max: 12 }, renameOnly: true };
    m.frame(g);
    m.down(400, 200);
    m.kbd.value = 'Sam';
    m.kbd.fire('input');
    expect(g.initials.name).toBe('Sam');
  });

  it('leaving the name screen blurs the keyboard', () => {
    const m = makeMobile();
    m.frame({ state: 'initials', initials: { name: '', max: 10 } });
    m.down(400, 200);
    expect(m.kbd.focused).toBe(true);
    m.frame({ state: 'title' });         // committed / cancelled -> back to the title
    expect(m.kbd.focused).toBe(false);
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
