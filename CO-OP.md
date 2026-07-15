# Co-op sync: the diagnosis, and the plan

Sam, 2026-07-14. Written after "multiplayer is SO busted, I think it's all related
to syncing." He is right, and it is more specific than that.

## The one root cause

Co-op has **two kinds of sync, and only one of them is reliable.**

- **Volatile state is SNAPSHOTTED.** Player positions (`p`, js/main.js:2652) and
  monsters (`mobs`, js/main.js:2905) are re-broadcast ~15x/second. A lost or reordered
  packet is corrected by the very next one 66ms later. These self-heal. This is why
  walking around and fighting basically works.

- **Discrete state is EVENTED.** A weapon dropping (`gear`), a room being cleared
  (`roomclear`), moving through a door (`room`), the door-plate gate - each is sent
  **exactly once**, fire-and-forget, over a relay with no acks and no resend. If that
  one packet is lost, reordered, or arrives before the receiver can act on it, the two
  clients **diverge permanently and never re-converge**, because nothing re-sends the
  truth.

Every reported bug is the same failure:

| Symptom | The lost/mistimed event |
|---|---|
| Weapon shows for one player, not the other | `gear` drop (main.js:782) |
| Spawn on plate, teleport back / walk off map | `room` change (main.js:1127) is one-shot |
| One player pauses, everyone freezes | the world tick only runs in state `play`, so a host pause stops the authoritative monster broadcast |
| Cape "seizure" | stale cached build - the movement animation was removed in v2.17 |

## The fix: converge discrete state onto snapshots

The host already owns the world. It should **periodically broadcast the authoritative
state** of the discrete things, the same way it already does for monsters, instead of
announcing each change once. Guests reconcile against the snapshot: add what they are
missing, drop what is gone. A lost packet self-heals on the next snapshot.

Keep the event for INSTANT feedback (latency), add the snapshot as the RELIABILITY
layer (self-healing). Belt and suspenders.

## Done

- **Pause no longer freezes the party** (commit "a paused player no longer freezes...").
  In co-op the pause menu is an overlay over a LIVE world (`g.coopMenu`, state stays
  `play`), so the host's monster tick and everyone's position broadcast keep running.
  You cannot pause an online game. Solo still truly pauses.

- **Gear snapshot** (`gearsnap`, ~4 Hz, main.js `broadcastGear` + the guest reconcile).
  The weapon desync. The host broadcasts the current room's ground gear by shared id;
  the guest adds a drop it missed and drops one that is gone. Validated single-client
  across five scenarios (missed drop healed, stale pruned, other-room ignored, no
  double-spawn, trinket syncs) via the new `dbg.mpForceGuest()` + `dbg.mpRecv()` hooks.

- **The room / door bugs** (commit "fix the plate teleport-back..."). Three of them:
  - *Teleport back on spawn*: you spawned standing on the plate of the door you came in
    through, so it bounced you straight back. Fixed with ARM-ON-VACATE - a plate only
    counts once it has been empty at least once this room - plus a 0.4s entry settle.
  - *Walk off the map*: `clampPlayer` opened the door gaps even in co-op, where the only
    exit is the plate, so you walked through the gap and off the map. Walls are solid in
    co-op now; the plate does the leaving.
  - *Stranded follower*: a lost `room` event left a player behind. They now SEE the party
    is elsewhere (via position snapshots) and follow - but only when every teammate has
    been in one adjacent room continuously for 2s, so it never fires spuriously.

- **Room-clear folded into the room snapshot.** The 4 Hz `gearsnap` now also carries the
  room's `cleared` flag, so a lost one-shot `roomclear` self-heals (a guest that missed it
  no longer sits trapped behind sealed doors). Monotonic: a snapshot never un-clears a
  room.

## Next (same pattern, if bugs surface)

- The `room` change is still a one-shot event; the stranded-follower self-heal covers a
  lost one, but a **sequence number** on room-change would also reject an out-of-order or
  duplicate one before it acts. Only worth adding if the self-heal proves insufficient in
  a real playtest.
- Boss sync and the level-up gate are their own channels; no reported bugs there yet.

## Testing co-op

Real parity bugs are only found by **two humans playing together** - the dbg harness
is one client. But the RECEIVE logic (how a guest reconciles a snapshot) is now
testable single-client:

```
dbg.mpForceGuest()                 // wire the net handlers + force guest mode
dbg.mpRecv({t:'gearsnap', room:[gx,gy], list:[...]})   // feed a message through the real handler
```

For a true end-to-end check, open two browser tabs (or two devices), host in one, join
with the code in the other. Co-op rooms are ephemeral Durable Objects, so testing
against the live relay is harmless.

## Two-instance test harness (Claude, 2026-07-14)

Repeatable protocol used to find #172/#173/#175. Two automation tabs on
http://localhost:8471, driven via the `dbg` global (rAF is throttled in
automation tabs, so ALWAYS advance the sim with `dbg.step(1/60)` loops -
the page's own loop does not run):

1. Tab A: `dbg.mpHost()` -> code. Tab B: `dbg.mpJoin(code)`. Wait ~1s each.
2. Tab A: `dbg.mpStart()`. Both now share seed + pinned authority (g.runHostU).
3. Pump each side alternately: `for(i=0;i<40;i++) dbg.step(1/60)` with a small
   `setTimeout` between bursts so the relay round-trips land.
4. Interact via real events in the same JS tick as a step:
   `dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'})); dbg.step(1/60);`

Verified flows (2026-07-14): join/start, mob snapshot sync + room-tag culling,
guest hit forwarding, stairs + nightmare portal floor-follow, boss intro/sync/
death (+ guest descent portal, #175), level-up gate hold + release, rejoin
after page reload (targeted start+floor), minion sync, ghost eviction by
clientId. Known harness artifact: `dbg.floor(n)` does NOT broadcast - never
use it to advance a co-op floor, take the real stairs/portal instead.

### Harness gotchas (added 2026-07-15)
- Serve with `python scripts/serve_nocache.py 8471`, NOT `python -m http.server` -
  Chrome heuristically caches the JS for minutes without Cache-Control and you end
  up live-testing stale code. Check freshness with performance.getEntriesByType
  ('resource') - transferSize ~300 means a 304, not a fresh fetch.
- When manually forcing `g.state = 'title'` in a probe, also clear showScores /
  showMythics / showAchievements / showUpgrades / snapView / showPatch: updateTitle
  early-returns on any of them and your key events silently do nothing.
- Old dev servers stack: multiple python http.servers can bind 8471 simultaneously
  (allow_reuse_address) and the OLDEST answers. Kill strays with Get-NetTCPConnection
  -LocalPort 8471 before trusting what you fetch.
