# HANDOFF - Dungeon of the Gilded King (for the next Claude session)

Read this + README.md + BUILD-PROMPT.md, then continue where the last session left off.

## What this is
Roguelike dungeon crawler designed by Sam's 12-year-old son, built 2026-07-10 in
one ultracode session. Sam playtested all evening and drove ~20 feature waves.
Currently at v2.0, fully deployed and working. The son is the designer; Sam is
co-designer. Personal/family project - keep it out of the deeproot work repo.

## State: v2.0 (all shipped, tested, committed)
Everything in README.md is implemented and live. Highlights: 8 monsters + mimics,
Mimic King boss (floor 3), 3 themed floors (forest/swamp/keep) with synthesized
music + ambient + apex-predator calls, weapons/armor with rarity+enchants, shard
salvage (X) + weapon honing (U), 96-entry evolution system (stats evolve at
stacks 3/6/9/12; names reference real things - Sam's rule), arcade leaderboard
(localStorage, initials entry), level-up reroll (R), auto-attack (F, persisted),
meta-progression essence, coin vacuum, floor-clear portal, celebration door lock.

## Deploy pipeline (memorize this)
- Local dev: `python -m http.server 8471` in this folder; the claude-in-chrome
  extension CANNOT open file:// URLs. Browsers cache scripts aggressively: after
  edits run `for f of [files]: fetch('js/'+f+'.js',{cache:'reload'})` then reload.
- Test harness: window.dbg in js/main.js - dbg.step(sec) pumps frames
  deterministically (rAF throttles in occluded windows - NEVER trust real-time
  stepping), dbg.warp/give/armor/god/coins/lvl/evo/state. IMPORTANT: dbg.press()
  holds keys forever unless you dbg.release() them (this caused a phantom-drift
  bug once).
- Public URL: https://goofproof.github.io/gilded-king/ (GitHub Pages, account
  Goofproof). Deploy = copy index.html+README.md+js/+dist/ to a temp dir, git
  init, force-push to main with basic auth; token lives in
  C:\Users\sammc\deeproot\.mcp.json (github server env, parse with utf-8-sig).
  NEVER put the token literal in a command line (auto-mode classifier blocks it);
  read it into a shell var at runtime. Pages propagates in ~1-3 min; poll with
  curl for a marker string.
- Single-file build: regex-inline the <script src> tags into dist/GildedKing.html
  (see any recent session transcript; it's a 15-line python snippet).
- Claude Artifact mirror: republish scratchpad/mimic-king-artifact.html - but a
  NEW session must pass url https://claude.ai/code/artifact/9a61365a-c022-4b1e-a01d-0c05c34670c1
  to the Artifact tool to keep the same link.
- Commit locally after every wave (repo-local git identity already set).

## Hard rules learned this session
- SPOILERS: the boss is THE MIMIC KING - that name must never appear on the
  title screen, tab title, filenames, or anything pre-fight. Public-facing name
  is "Dungeon of the Gilded King". The reveal banner in the boss intro is the
  only pre-death place the name lives.
- Evolution names must reference something real (science/history/myth), catchy,
  googleable - Sam's rule. See js/evolutions.js header.
- The tuning tables are documented in README.md - changes go in tables, not
  scattered constants.
- After every substantive wave: run an adversarial review workflow (3-6 finder
  agents + verify-each-finding pattern; ~half of findings get refuted - only fix
  confirmed ones), regression-test each fix live in the browser via dbg, then
  bundle + deploy + artifact + commit.
- localStorage access must be try/catch'd everywhere (artifact iframe throws).
- All sounds are synthesized in js/audio.js; Claude can't hear them - flag that
  Sam's ears are the judge and offer to tune.

## Smash Arena TV reskin (added 2026-07-11)
A full game-show reskin lives in `smashtv/` (its own fork - root Gilded King is
byte-for-byte untouched). Live at https://goofproof.github.io/gilded-king/smashtv/.
Homage to Williams' Smash TV. `smashtv/js/skin.js` holds the show config (SHOW
strings, NEON palette) + the Host announcer artwork + studio backdrop. New game
state 'intro' (click-gated cutscene, the Host shouts "I'D BUY THAT FOR A DOLLAR!").
Cosmetic + intro only - every mechanic identical to the base game. To iterate on
it: edit files under smashtv/, deploy by staging BOTH the root game and smashtv/
into the Pages repo (see the deploy2 staging pattern). Separate artifact URL:
https://claude.ai/code/artifact/61515c37-6d9c-4d75-837f-3ce2c5d25f17
Reskin pass-1 limit: monster/player sprites are recolored by palette but keep
their fantasy shapes - deeper "game-show goon" art is a future pass.

## Open threads (not started)
- Touch/mobile controls (virtual joystick + auto-attack carry) - was recommended,
  never built. The son may only have a tablet at his mom's.
- Shared cross-device leaderboard - needs a small free backend + an account Sam
  would create himself. Current board is per-device by design.
- Floor 3 difficulty: sims put a decent player at ~coin-flip survival. Watch his
  runs; tier-5 monster hp -10% is the one-number soften.
- Gamepad support, pause-menu volume slider - suggested, not built.
- Sam's known essence on this machine was wiped once for a fresh start; scores
  board seeded with test entry SAM:10 - consider wiping drl_scores before the
  son's first session on this machine (localStorage.removeItem('drl_scores')).
