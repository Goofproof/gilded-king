# Co-op Netcode Review (ultracode, 2026-07-15)

40-agent review: 4 code dimensions (transport, effect sweep, state machine, determinism),
2 research sweeps, adversarial verification of every finding (verifiers re-read the code
and re-fetched every cited URL; findings the code did not support were rejected).

## The verdict: FIXABLE. The architecture is sound.

All four reviewers independently reached the same conclusion: host-authoritative sim +
dumb Durable Object relay + pinned runHostU authority + 15Hz room-tagged snapshots is
the RIGHT architecture for this game, and it matches the published canon (Gambetta's
client-server model, Fiedler's "state synchronization", Cloudflare's own doom-workers
uses the identical dumb-router shape). No rewrite needed.

The recurring bug family is systemic but has one root: every gameplay effect written
for solo mutates local state, and co-op currently requires a HAND-WRITTEN net path per
effect. There are three sanctioned channels that work (takeHit/forwardHit for damage,
partyTargets/hurtTarget/phit for player harm, snapshots for state) - everything routed
through them is solid. Everything else leaks. The cure is known and standard (below).

## Confirmed findings (adversarially verified), by priority

### P0 - playability blockers
1. **The ENTIRE boss kit is pre-co-op** (boss.js:98 bolt() pushes raw g.projectiles with
   no 'proj' mirror; boss contact/lunge/slam target g.player only; boss AI aims at the
   host exclusively). Guests can neither SEE nor BE HIT by any boss bullet, all 9 descent
   ultimates included. CRITICAL - boss fights are a solo game with a spectator.
2. **net.js connect() double-socket** (net.js:82): connect() doesn't cancel a pending
   reconnect timer and openSocket() abandons the old socket unclosed. A retype-the-code
   join after a hiccup ends with TWO live sockets: every message delivered twice (double
   damage from every forwarded hit, double xp), and the client renders a CLONE OF ITSELF
   from its own echoed 'p'. This is the best explanation yet for "play 1 duped".
3. **Mimic wake is fully local** (main.js:2258): a guest wakes a private mimic the host
   can't see; the guest's reward weapon is deleted ~0.25s later by the host's gearsnap
   reconcile. Duplicate mimics both directions.
4. **Lobbed bombs exist only on the host's screen** (monsters.js:1317 mortar volley,
   empowered-bomber airstrike, Colossus lob via host-local ultFx): guests neither see
   nor take them even when targeted.
5. **Stalactites rolled per-client + double jeopardy** (main.js:4895): each client rolls
   its own Math.random stalactites AND the host's copies phit remote players - guests
   take invisible damage on top of their own local hazard.

### P1 - class/feature correctness for the non-host
6. **forwardHit whitelists opts** (main.js:3931): stagger (heavy interrupt), chain
   lightning, executioner never reach the host from a guest. Any FUTURE status added to
   takeHit silently dies for guests - this is the systemic leak point.
7. **Guest room-status ults are no-ops** (main.js:2015-2036): inferno, sleep/TIME STOP,
   deep freeze chill, caltrops, fear/War Shout, midas, vanish all mutate local proxies.
   Only Immolate got the forwarding fix (#191). Generalize it: ONE 'ult' event.
8. **onKill procs resolve against the HOST regardless of killer** (main.js:858):
   vampiric, momentum, looting, soulFeast, rollReset, undead heal, kill counters. Only
   the necro rise was routed (#207). _lastHitBy already exists - use it for all.
9. **A guest mesmer's clones never draw aggro** (main.js:3721): partyTargets reads local
   g.mercs only. The class's defining mechanic is host-only. (Same hole: guest turrets
   are invisible to teammates, minionSnapshot omits g.turrets.)
10. **g.alarm pinned at 0 on guests** (main.js:1020): alert-dungeon primed mobs + #185
    pre-set traps never fire for guests; XP/loot alarm bonuses diverge. Carry alarm on
    'roomclear'.
11. **Paradiso rule hooks cross-wire** (monsters.js:997): a guest's forwarded hits give
    the HOST Venus lifesteal / charge the HOST's Jupiter justice. THE PACT (encounters.js:71)
    mutates only the accepting client's rules - one player's floor is harder than the
    other's. Quest lifecycle has no net path at all.
12. **Panther bleed skips remote players** (monsters.js:289 explicit !p.isRemote guard).

### P1 - flow races (verified)
13. **Double enterRoom in the 0.18s transition window** (main.js:4479) can wipe fresh
    spawns and softlock a floor. CRITICAL per the state-machine reviewer.
14. **'floor' arriving mid evolution/ult pick** (main.js:3311) destroys the pick (the
    ultimate permanently) and leaks the level gate.
15. **Co-op RETIRE** (main.js:1210) leaves the retiree counted by door plates - survivor
    sealed (same family as the fixed #196, different exit path).
16. **PLAY AGAIN dual-press race** (main.js:4597): both press within a beat, both pin
    the OTHER as host, nobody simulates, watchdog kicks both at 12s.
17. **Rejoin gate desync** (main.js:3092): the uid ghost-eviction skips dropFromLevelGate,
    so a mid-pick WiFi blip leaves a stale busy counter (the 12s failsafe caps it).
18. **Floor stamps missing on 'mobs'/'gearsnap'/'roomclear'** (#175 only fixed 'room' -
    and its send sites don't even set fl, making that guard dead code, main.js:1450).
    Same-coordinate rooms cross floors cross-apply.
19. **'floor' advance sent during the sender's own reconnect gap is lost** (net.js:93
    fire-and-forget, no queue). Self-heals only via the guest-reconnect path; a HOST-side
    blip during a portal press splits the party until natural convergence. Verifier
    downgraded to medium (guest case self-heals; host case converges through play).
20. **Lost 'gameover' skips the guest's essence banking** (main.js:3790 watchdog path).
21. **No keepalive** (net.js:49): half-open sockets survive until the 12s watchdog.
22. **Pet TYPE uses Math.random inside seeded floor gen** (dungeon.js:378): host and
    guest meet different pets in the same room.
23. **Trap-room ambush fizzles if the host isn't in the room when the chest opens**
    (main.js:3298) - wave never spawns, chest stuck open, no loot.

Minor (verified low): relay forwards client-forged control frames (index.js:208);
haggle sync dropped if the other player hasn't entered the shop yet; solo mimic odds
read seed-0 rules (main.js:407).

## What the industry does (sources verified reachable, claims spot-checked)

The three standard techniques that kill this bug family:

1. **State-tree sync with automatic dirty tracking** (Colyseus's whole reason to exist:
   https://docs.colyseus.io/state , wire spec in @colyseus/schema SPEC.md). Rule of
   thumb from the research: if a thing outlives one snapshot interval, it is NOT an
   event - it is STATE, and it must live in the host-owned snapshot (burn/chill/fear
   timers, alarm, mimic wake, room flags, turrets). Then no effect ever needs its own
   message again. We already do this for monsters/gear - extend the same snapshot to a
   general state tree.
2. **A generic reliable event bus** for the residual true events (hits, one-shot FX,
   floor advance): monotonic per-session sequenceId, receiver high-water-mark dedup,
   send-buffer replayed on reconnect. The shipped spec to copy is Azure Web PubSub's
   reliable subprotocol (https://learn.microsoft.com/en-us/azure/azure-web-pubsub/howto-develop-reliable-clients),
   and PartySocket (cloudflare/partykit) is a drop-in auto-reconnecting BUFFERING
   WebSocket client that fixes net.js's fire-and-forget send on its own.
3. **Scheduled full-state keyframe reconcile** - generalize our gearsnap/roomclear
   self-heals: host emits a full keyframe on join/reconnect, on room transition, and
   every N seconds. Divergence is EXPECTED and healed, never fatal (Fiedler,
   https://gafferongames.com/post/state_synchronization/).

Explicitly rejected by the research: input/lockstep sync (requires bit-perfect
determinism; a vanilla JS 60fps sim across browsers will desync - Fiedler,
"What Every Programmer Needs to Know About Game Networking").

## The study list (three evenings, all repos verified to exist)

1. **cloudflare/workers-chat-demo** (chat.mjs, 1.1k stars) + **cloudflare/doom-workers**
   (router/index.mjs) - our exact infrastructure done by its makers: DO hibernation,
   room lifecycle, rejoin. Compare our server/src/index.js line by line.
2. **vzhou842/example-.io-game** (451 stars, with the victorzhou.com tutorial) - the
   closest teaching-grade version of our shape: authoritative tick loop building
   snapshots (src/server/game.js), client snapshot buffer + render-in-the-past
   interpolation (src/client/state.js).
3. **Colyseus state sync docs + @colyseus/schema SPEC.md** - not to adopt (it wants a
   Node server), but to internalize the state-tree pattern. Plus Gambetta's Fast-Paced
   Multiplayer parts I-III (gabrielgambetta.com) as the conceptual backbone.

Also worth 20 minutes: PartySocket (cloudflare/partykit) as a straight swap for
net.js's raw WebSocket - reconnect + send buffering for free.

## Suggested order of work

- **Phase A (hours, huge payoff):** boss kit sync (route bolt() through the 'proj'
  mirror, boss targets partyTargets, contact/slam hit the party); net.js connect()
  timer fix + close superseded sockets; forwardHit passes ALL opts; ONE generic
  guest-ult forwarding event replacing the per-ult pattern.
- **Phase B:** onKill uses _lastHitBy for all procs; mimic wake host-gated + broadcast;
  ultFx lobs mirrored; alarm on 'roomclear'; floor stamps on mobs/gearsnap/roomclear;
  play-again race guard; retire drops from plates; keepalive ping.
- **Phase C (the platform cure):** periodic full keyframe + reliable event bus (or
  PartySocket first as the cheap 80%). After C, a solo-written effect that misses its
  net path degrades to "heals within a second" instead of "breaks the run".
