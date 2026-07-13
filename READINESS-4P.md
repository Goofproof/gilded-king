# 4-Player Co-op Readiness - Dungeon of the Gilded King

Prepared for the live 4-player test (2 first-time players). Based on an ultracode
review (6 dimensions -> adversarial verify -> synthesis, 11 verified findings),
with every fix re-verified against code before landing.

## Verdict: READY (with a short host script)

The netcode is genuinely 4-player capable: the Cloudflare relay
(`server/src/index.js`) and `js/net.js` use an uncapped session/peer set, pure
broadcast, with server-side host migration. The co-op level-up gate uses monotonic
per-peer counters with a 12-second failsafe, so it cannot permanently soft-lock.

The four blockers found by the review are now FIXED and deployed (v-current):

## FIXED before the test (all verified)

- **M1 - tank slam crashed the host frame.** `monsters.js:276` called `.damage()`
  on a target wrapper with no such method, throwing a TypeError that aborted the
  rest of the frame (including the monster broadcast) every slam on floor 3+. Now
  routes through `g.hurtTarget`. Verified live: no throw, slam deals damage.
- **M2 - guests could die on the pause / character sheet.** The damage handler
  did not shield `pause`/`charsheet` despite the code promising "no dying on the
  menu." Both states now shielded.
- **M3 - a mistyped join code silently made you host of an empty room.** The join
  input accepted the confusable letters I/L/O/0/1 that real codes never contain.
  Restricted the input to the real code alphabet, and the join screen now warns
  "no one else here - check the code" when you land alone.
- **M4 - a mid-run disconnect or the host leaving silently froze the world.** There
  was no client reaction to a dropped socket or a host change. Now: if your socket
  drops or the host leaves, the run ends and returns you to the menu with a clear
  message instead of a frozen, unrecoverable world. (Seamless host takeover was
  deliberately NOT attempted - it is too risky to build hours before the test.)

## WATCH during the test (known, accepted, not fixed)

- **Host is a single point of failure.** If the HOST drops, the run ends for
  everyone (by design now - clean message, back to menu). Put the host on the most
  reliable machine / wired connection. Plan to restart the run, not recover it.
- **Late joiner.** START broadcasts once; anyone who joins AFTER the host clicks
  START sits on "waiting for the host." Fix is procedural: confirm all four are in
  the lobby BEFORE pressing START (see host script).
- **Level-ups pause everyone.** XP is shared, so all four level together and the
  world holds until the slowest picks (12s cap, with a "waiting for N teammates"
  banner). Normal, not a crash. Coach the newcomers to pick promptly.
- **Boss targets the host only.** The floor-3 King (and Descent Wardens) chase and
  damage only the host; guests take no boss damage. A correct fix routes the boss
  through the party-target system but is too risky to land pre-test, so it is
  deferred. Tell players so the newcomers do not think they are invincible.
- **4-player difficulty is steep:** enemies get ~3.7x HP and ~2.65x damage at 4
  players (`main.js:1831`). Watch whether it is too punishing for two first-timers;
  it is a one-line tune if so.

## HOST SCRIPT - walk the two newcomers through this (there is no in-game tutorial)

1. **Reading the code:** "It never contains I, L, O, or 0/1 - if you think you
   hear one, it's a different character." (The join screen won't even let them type
   those now.)
2. **Everyone in before START.** Wait until every newcomer's screen shows
   "connected - 4 in lobby." If a count never goes up, they mistyped: hit BACK and
   retry. Do NOT press START until all four are shown.
3. **Controls:** WASD/arrows move, mouse aims, your character AUTO-ATTACKS whatever
   is in range, SPACE dodge-rolls, E interacts, Tab swaps weapons. **Q = your class
   ability, R = your evolved ability, RIGHT-CLICK = your ultimate.**
4. **F toggles auto-attack.** With it OFF you attack manually with LEFT-CLICK
   (aimed at your cursor). A loud orange "AUTO-ATK OFF" shows when it's off - press
   F again to go back to auto.
5. **Level-ups pause the party.** When cards pop, all four level at once and the
   game holds until everyone picks. Pick promptly - the others are waiting.
6. **The King mostly chases the host.** Guests: help the host, watch the shared HP,
   don't assume you're safe.
7. **If your screen freezes:** you probably dropped connection - you'll be returned
   to the menu with a message. Tell the host; re-lobby and restart.

## Not blockers (verified low / handled)

- Auto-attack toggle (F) is loudly telegraphed on the HUD; recovery is the same key.
- The level-up gate cannot hard-lock (monotonic counters + 12s failsafe).
- The relay/worker have no player cap; 4 connections are fine.
