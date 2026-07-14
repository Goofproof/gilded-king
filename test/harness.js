// ============================================================================
// test harness - loads the game's IIFE modules into a Node VM without touching
// the source. The modules assign to top-level `const` globals (Dungeon, Weapons,
// ...), which don't attach to the context object, so we concatenate the files
// into ONE script (shared scope) and append a footer that exposes them.
//
// Only PURE-LOGIC modules are loaded (no DOM). Fx/Sfx/Descent are stubbed since
// the pure modules only touch them at call time, not at load.
// ============================================================================
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const JS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js');

// dependency order: evolutions/abilities are standalone; dungeon before monsters
// (monsters reads Dungeon.PF at load); descent is optional (guarded in source).
// rules.js after descent.js: it reads Descent.FIRST_FLOOR / CIRCLES at call time,
// and dungeon.js consults Rules for the mimic odds, so it must be in the bundle or
// the tests would silently exercise the no-rules fallback path.
const MODULES = ['evolutions.js', 'abilities.js', 'dungeon.js', 'descent.js', 'ascent.js', 'paradiso.js', 'rules.js', 'weapons.js', 'monsters.js', 'encounters.js'];

let cached = null;
export function loadGame() {
  if (cached) return cached;
  const parts = MODULES.map(f => fs.readFileSync(path.join(JS, f), 'utf8'));
  // footer: hoist the module globals onto the context so we can read them out
  parts.push(`globalThis.__game = { Evolutions, Abilities, Dungeon, Descent, Ascent, Paradiso, Rules, Weapons, Monsters, Encounters };`);
  const sandbox = {
    // call-time stubs the pure modules reference but never at load
    Fx: { burst() {}, text() {}, shake() {}, hitstop() {}, ghost() {}, clear() {} },
    Sfx: { play() {}, ensure() {}, setAmbient() {}, toggleMute() {}, get muted() { return false; } },
    Math, JSON, Object, Array, Set, Map, Date, console, isFinite, parseInt, parseFloat,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(parts.join('\n;\n'), sandbox, { filename: 'gilded-king-bundle.js' });
  cached = sandbox.__game;
  return cached;
}
