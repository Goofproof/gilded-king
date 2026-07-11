# SMASH ARENA TV

A neon game-show reskin of **Dungeon of the Gilded King** — an homage to Williams'
*Smash TV* (1990). Same engine, same mechanics; new coat of paint, a sleazy
announcer, and an intro cutscene.

> The Host struts on: **"BIG MONEY! BIG PRIZES!"** ... **"I'D BUY THAT FOR A DOLLAR!"**

## Play
- Public: https://goofproof.github.io/gilded-king/smashtv/
- Or open `dist/SmashArenaTV.html` (one self-contained file) in any browser.
- Click once to start the intro (so the announcer can shout — audio needs a gesture).

## What changed vs. the Gilded King
Purely cosmetic + one new intro cutscene state. Every mechanic (evolutions,
armor, shards, weapons, leaderboard, the whole run structure) is identical.
- Title, palettes, and text reskinned to a neon TV studio
- 3 "studios" instead of dungeon floors: **Studio A**, **The Pleasure Dome**,
  **The Host's Stage**
- The boss is **THE HOST** ("the grand prize was a lie")
- Announcer barks, cash-register + crowd sounds, game-show music beds
- Currency renamed: coins -> cash ($), essence -> **FAME** (★)

The reskin layer lives in `js/skin.js` (the show config + the Host artwork).
Everything else is the original engine, forked so the Gilded King stays intact.

## Known "reskin pass 1" limits (easy to push further)
- The monster/player sprites are recolored by studio palette but keep their
  original shapes — deeper "game-show goon" art is a future pass.
- Parody name on purpose: this is a homage, not the trademarked "Smash TV".
