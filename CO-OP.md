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
