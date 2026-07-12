# Co-op Guest Parity Plan (ultracode audit, 2026-07-11)

Diagnosis: the guest is a spectator with an invincibility bug — anything computed in a
host-only path (onKill, monster/boss AI, explode, checkRoomCleared, useAbility) never
crosses the wire. Fix is additive: new host→guest events + 2 shared primitives.

## Primitives (build first)
- PR-1 party target set + nearestTarget(m,g)  [main.js, monsters.js]
- PR-2 player-damage channel {t:'phit'} (monster AND boss)  [main.js, net]
- PR-3 lazy netId stamping in broadcastMobs (runtime spawns)  [main.js]
- PR-4 extended mob snapshot: state/telegraph/lungeAngle/fuse (telegraphs render free)
- PR-5 grantPartyXp(n) — replace raw addXp on the host

## P1 (ordered, each 2-tab testable)
1 PR-3  2 PR-4  3 PR-1  4 PR-2 (+delete guest local contact-dmg)
5 P1-A AoE loop over party (explode/eliteBlast)
6 P1-B {t:'proj'} enemy projectiles   7 P1-B {t:'boom'} AoE detonations
8 PR-5 + {t:'roomclear'} (vacuum + door unseal)
9 P1-D {t:'drop'} currency mirror + serialized gear
10 P1-D boss/mimic loot + {t:'take'} claim
11 P1-E boss proxy art + {t:'boss'} snapshot + g.boss bar
12 P1-E boss targeting/damage + coin barrage via {t:'proj'}
13 P1-E {t:'bossDead'} + {t:'bossintro'}
14 P1-C downed + {t:'downed'} presence   15 {t:'revive'}   16 {t:'gameover'} on wipe

## P2/P3 (later): chest/shop authority, shared pause, peer visibility (pets/mercs/casts),
## scoreboard, late-join, host migration (recommend clean gameover), reconnect, delta snapshots.

Net messages added: phit proj boom drop take chest shopstock roomclear boss bossintro
bossDead downed revive gameover pause resume cast sync + extended mobs/p fields.
No server changes for P1/P2 (relay is broadcast + host-stamp).
