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

## Next (same pattern)

- **Room / plate state as a snapshot.** The host should broadcast which room the party
  is in and the plate occupancy, so a lost `room` event cannot strand a guest in the
  wrong room or teleport them back. This is the plate-teleport and walk-off-the-map
  class.
- **Room-clear as part of the room snapshot** rather than a one-shot `roomclear`.
- Consider a tiny **sequence number** on the room-change so an out-of-order `room`
  event is ignored rather than acted on.

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
