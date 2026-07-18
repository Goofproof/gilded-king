// ============================================================================
// MOBILE PATCH-DURABILITY GUARD.
//
// The point of this test is NOT to check pixels - it is to make a future patch that
// adds a KEYBOARD-ONLY screen fail CI before it can ship to the son's phone. It works
// by census: every game state that exists in the code must be classified here for how
// a THUMB reaches it. Add a new `g.state = 'foo'` and this test goes red until you
// come back and say how 'foo' is played on a phone.
//
// HOW TO FIX A FAILURE (for the next Claude/Sam):
//   - "unregistered state 'X'": you added a screen. Add X to REACH below with one of:
//       'play'  - the in-play stick + buttons + pause pip (only 'play' itself)
//       'tap'   - a tap lands on a uiRect / card / button (the normal menu path)
//       'auto'  - transient, advances on a timer/gate with no input needed
//     If the new screen can ONLY be advanced by a physical key, that is the bug this
//     guard exists to catch: give it a tap affordance (a uiRect handled off
//     input.mouse.clicked) or, for typed text, wire the hidden <input> the way
//     touch.js does for 'initials'. Do NOT "fix" the test by inventing a new class.
//   - a state you deleted still listed here: remove it from REACH (kept non-fatal).
// ============================================================================
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js');
const read = f => fs.readFileSync(path.join(JS, f), 'utf8');

// The registry. state -> how a phone reaches/advances it. Every value MUST be one of
// VALID below; there is deliberately NO 'keyboard-only' class, so a screen that needs
// a key and nothing else cannot be honestly recorded here - it has to be fixed instead.
const REACH = {
  play:        'play',   // the movement stick, the six thumb buttons, the pause pip
  title:       'tap',    // SOLO PLAY / class+race pickers / loadout - all uiRects
  lobby:       'tap',    // host + back are taps (JOIN code typing is the WAVE-2 item)
  offer:       'tap',    // the stranger's accept/decline uiRects
  levelup:     'tap',    // the three upgrade cards (+ reroll)
  evolution:   'tap',    // the evolution cards
  ultpick:     'tap',    // the ultimate cards
  rpick:       'tap',    // the fusion (R-forge) cards
  enchantpick: 'tap',    // the enchant cards
  craftpick:   'tap',    // the craft cards
  charsheet:   'tap',    // tap / the close rect dismisses it
  initials:    'tap',    // CLAIM IT rect + the hidden <input> soft keyboard (name entry)
  dead:        'tap',    // PLAY AGAIN / MENU (drawEnd uiRects)
  win:         'tap',    // the victory end screen (drawEnd uiRects)
  pause:       'tap',    // RESUME / END RUN / ABANDON, opened by the pause pip
  levelwait:   'auto',   // co-op gate: releases on a timer once the party is ready
  transition:  'auto',   // floor-transition animation, snaps back to play
  bossintro:   'auto',   // the boss banner plays then hands off to play
};
const VALID = new Set(['play', 'tap', 'auto']);

// pull every `g.state (=|==|===|!=|!==) '<literal>'` out of the game source
function statesIn(src) {
  const found = new Set();
  const re = /g\.state\s*(?:===|!==|==|!=|=)\s*'([a-zA-Z]+)'/g;
  let m;
  while ((m = re.exec(src))) found.add(m[1]);
  return found;
}

describe('mobile durability: every game state is reachable by touch', () => {
  const codeStates = new Set([...statesIn(read('main.js')), ...statesIn(read('ui.js'))]);

  it('every state literal in the code is classified in REACH', () => {
    const unregistered = [...codeStates].filter(s => !(s in REACH));
    expect(unregistered, `New game state(s) with no mobile reach path — classify in test/mobile-states.test.js (see the header): ${unregistered.join(', ')}`).toEqual([]);
  });

  it('every classification is a real touch path (no keyboard-only screens)', () => {
    const bad = Object.entries(REACH).filter(([, v]) => !VALID.has(v)).map(([k]) => k);
    expect(bad, `states classified with an invalid/keyboard-only reach: ${bad.join(', ')}`).toEqual([]);
  });

  it('the registry has not gone stale (every REACH entry still exists in code)', () => {
    // non-fatal drift is fine, but a large drift usually means a rename went unmirrored
    const stale = Object.keys(REACH).filter(s => !codeStates.has(s));
    expect(stale, `REACH lists states no longer in the code (remove them): ${stale.join(', ')}`).toEqual([]);
  });
});

describe('mobile durability: the touch root-fix is still in place', () => {
  const touch = read('touch.js');

  it('touch.js still gates the movement stick to play (menu taps stay clicks)', () => {
    // the WAVE-1 fix: start() only arms the stick when curState === 'play'; a refactor
    // that drops this reintroduces the "left half of every menu is dead" bug.
    expect(touch).toMatch(/curState\s*===\s*'play'/);
  });

  it('touch.js routes off-play taps through a click, and syncs curState every frame', () => {
    expect(touch).toMatch(/clickAt\s*\(/);          // the tap->mouse.clicked path exists
    expect(touch).toMatch(/curState\s*=\s*g\s*&&\s*g\.state/); // update() keeps state fresh
  });
});
