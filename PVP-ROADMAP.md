# PVP Roadmap: The Gilded Hunt

REFRAME (Sam, 2026-07-15): battle royale, not extraction. "Since there is nothing to
extract per se, this is more like a battle royale, fortnite style." This SIMPLIFIES
Phase 2: no extract portals, no stash/satchel economy. Random spawns + gear up +
closing swarm + last champion standing. The convergence engine (swarm + Gilded King
bounty), sound-through-doors, loss-softening (a loss must still bank something) and
gear normalization all carry over unchanged.

Research base (2026-07-15): a 25-agent verified research pass (5 lenses + code inventory,
18 load-bearing claims re-fetched and adversarially verified: 7 CONFIRMED, 11 PARTLY, 0
rejected) plus a dedicated extraction-genre research pass. Sam's chosen direction:
"extraction dungeon delver - players start in random spots, gear up, fight or flee."

## Verdict

PVP is feasible and most of the hard netcode already exists. Player-to-player damage
delivery is live today: hurtTarget() ships {t:'phit'} over the reliable event bus and the
receiver applies it through the full player.damage() path with armor, iframes and thorns
(main.js:3917-3920 -> 3212-3219, net.js:50-120). Target enumeration treats remote players
as damageable entities (partyTargets, main.js:3894-3914). Attack visuals already mirror
both directions (playPeerAttack, main.js:4181-4206) - PVP attaches a hit test to what is
currently visual-only. The relay needs ZERO changes. Lockstep and rollback are off the
table (combat rolls raw Math.random ~197 times across 14 files; only dungeon GENERATION
is seeded, dungeon.js:44-72) and a server-side referee sim is possible on Durable Objects
(CONFIRMED: CPU limits reset per WebSocket message, setInterval prevents hibernation) but
disproportionate for family play. Keep the host in the browser.

## The one big architectural lift for extraction

Today the sim holds ONE room of monsters at a time (g.monsters is replaced on every
enterRoom) and the guest never simulates monsters at all - it renders proxies of the
host's current room. Extraction needs two players in DIFFERENT rooms fighting DIFFERENT
monsters simultaneously. That is the genuinely new work (Phase 3 below). Everything else
is additive.

## Netcode doctrine (from the verified research)

1. **Attacker resolves the hit, victim applies it.** The code already does this in both
   directions (forwardHit guest->monster, hurtTarget host->guest). PVP hits follow the
   same rule: attacker tests against its lerped view of the opponent, ships phit with
   rolled damage. Both players aim at an equally stale ghost through the same relay, so
   player-vs-player latency is SYMMETRIC - nobody gets a referee's edge. Never route PVP
   hits through the host for validation; that would hand the host a full RTT advantage.
2. **Host advantage only persists for host-owned world objects** (boss sweeps, mines,
   AoE) which judge the guest against its 66ms-stale interpolated position. Mitigation:
   pure-PVP spaces stay hazard-free at first; in mixed PVPVE the wobble is accepted (LAN
   RTT makes it tiny) until Phase 3's room-authority split makes each player's own room
   fair by construction.
3. **Menu invulnerability is a PVP exploit.** Incoming phit is dropped while the victim
   is on ANY menu (main.js:3212-3217; player.damage no-ops outside state 'play',
   player.js:1022). Correct for co-op; in PVP "open character sheet = god mode." PVP mode
   must carve this out. He WILL find it.
4. **Proof this grade of netcode ships**: example-.io-game (451 stars) is a playable PVP
   shooter with plain circle-overlap hits, no lag compensation, no prediction (CONFIRMED
   from source). 15Hz snapshots + interpolation are enough at family scale.

## Design pillars (from extraction-genre research)

- **Convergence engine or the mode fails silently.** Two players on a room map may never
  meet; extraction degrades to parallel solo runs. Fixes, layered: (a) THE GILDED KING AS
  THE BOUNTY - killing him is loud, map-announced, and drops the best loot (Hunt:
  Showdown's structure); (b) a closing swarm that consumes perimeter rooms over the match
  (Dark and Darker's Dark Swarm), shrinking safe ground toward shared space; (c) a few
  seeded "gilded" hot-spot rooms so greedy routes cross.
- **Sound through doors is the fight-or-flee information layer.** Combat, chests, doors
  propagate as directional cues to rooms within 2-3 doors ("steel on bone, to the
  north"), attenuated by distance. Loud weapons ring farther than daggers. Hunt-style
  noise traps (bone-litter floors, hanging chains, caged birds) are the highest
  fun-per-line item found: randomized per seed, triggered by movement speed, defusable at
  a time cost.
- **One-use extract portals, late-spawning, interruptible channel.** Dark and Darker's
  rules fit 2-player perfectly: portals spawn after a few minutes (announced), each takes
  ONE player, the channel can be interrupted or stolen. Anti-camp: the portal hums louder
  when the other player is within 2 rooms; always 2+ portal sites.
- **Loss-softening stack (mandatory for a 12-year-old).** (a) The stash: everything
  extracted in previous rounds is untouchable; (b) one "satchel" slot survives death
  (Tarkov secure-container pattern); (c) free baseline kit every round so nobody enters
  naked (Dark and Darker's Squire); (d) quest scraps that bank progress even on death
  (The Cycle: Frontier's key lesson: a failed run must still produce something).
- **Gear normalization per match.** No campaign characters in extraction: both spawn
  fresh and gear up in-match. This dissolves the build-snowball problem structurally
  (Diablo III cancelled Team Deathmatch over exactly this: PVE items as a PVP balance
  surface, CONFIRMED via PCGamesN interview).
- **Flee must be genuinely viable**: closable doors, no cross-room ranged deletion, roll
  disengages. The genre's #1 fun-killer is the stomp; in a family duo that is the
  parent-child gap. Rubber-band via loot: the trailing player finds better gear.
- **Match shape**: ~10 minutes, small map (20-30 rooms for 2 players, extrapolated from
  Dark and Darker's density tuning), monsters carry most moment-to-moment danger, PVP is
  the once-or-twice-per-match climax, not ambient pressure.

## Phases (each shippable and fun alone)

- **Phase 0 - Friendly-fire toggle in co-op (an evening).** The pvp/FF flag + three
  additive hit-test sites: applyMelee sweeps partyTargets and hurtTargets isRemote
  targets in arc (player.js:1460); local projectiles test g.remotePlayers
  (main.js:4897-4927); mode gate so normal co-op stays FF-free. Ship as an opt-in run
  modifier (chaos co-op night). This IS the PVP hit-test code, deployed early.
- **Phase 1 - Duel Room (a weekend).** Hazard-free arena room, mirrored loadouts,
  best-of-5 using the existing downed/wipe machinery as rounds, host announces round end
  (each client owns its own hp, main.js:2095, so ties need one announcer). Close the
  menu-invulnerability hole. Chat trash talk included. Proves the PVP FEEL cheaply.
- **Phase 2 - Extraction-lite: "The Gilded Hunt" v1 (1-2 weekends).** NO monsters, which
  sidesteps the multi-room sim entirely: random far-apart spawns on a shared seed, gear
  up from chests (already per-player local by design, #97), room-follow tether OFF,
  presence masking (opponent visible only in same room; adjacent-room sound cues
  instead), one-use extract portals on a timer, score = extracted value, stash + satchel
  + baseline kit. Already a complete game of nerves: loot greed vs the sound of doors.
- **Phase 3 - Monsters as the third force (the big lift, 1-2 weeks incremental).**
  Multi-room simulation: g.monsters becomes per-room (room.monsters), the host sims all
  OCCUPIED rooms, or cleaner: each player simulates the monsters in the room THEY occupy
  (room = the authority unit; the existing host-auth machinery applies only when sharing
  a room, exactly when it matters). Monster noise feeds the sound layer; fighting is
  loud; third-partying a monster fight through a doorway becomes the signature moment.
- **Phase 4 - The full Hunt (polish passes).** Gilded King as bounty + map-wide kill
  announcement, closing swarm, noise traps, portal-steal channel, anti-camp hum,
  rubber-band loot. Each is a small independent patch note.
- **Someday/maybe:** Crawl-style asymmetric mode (one player IS the dungeon, possessing
  monsters) - maps 1:1 onto host-owned monsters, doubles as a "downed player keeps
  playing" co-op feature. Client-side prediction + lag compensation only if PVP ever
  moves beyond the LAN.

## Lessons to adopt regardless of PVP (ranked by payoff)

1. **Client-side prediction for the guest's own character.** The QuakeWorld model
   (CONFIRMED via Gaffer): guest simulates own movement immediately, host corrects on
   divergence. Biggest "guest feels laggy" fix available; Gambetta's live demo is a
   complete sub-500-line pure-JS reference implementation.
2. **Write down the damage doctrine** (attacker resolves, victim applies; intents not
   outcomes for host-owned things) and make every new effect conform. The co-op bug
   family we just fixed came from not having this on paper.
3. **Divergence report on big keyframe corrections** (Factorio's desync-report pattern):
   when a keyframe correction exceeds a threshold, auto-dump host + guest state + last
   30s of the event bus to a JSON file. Turns "it glitched, Dad" into a diffable artifact.
4. **Opt-in modifier system** as the shipping vehicle for experiments (Risk of Rain 2
   Artifacts pattern): per-run toggles let PVP-adjacent ideas ship inside co-op safely.
5. **Trust the snapshot layer; spend polish on interpolation, not send rate.** 15Hz sits
   next to Colyseus's 20Hz default; the .io reference ships at 30Hz with no compensation.

## Key sources (verified this session unless tagged)

- Gaffer on Games, game networking + deterministic lockstep (CONFIRMED/PARTLY):
  https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/
- Gambetta, Fast-Paced Multiplayer + live prediction demo (PARTLY, caveats logged):
  https://www.gabrielgambetta.com/client-server-game-architecture.html
- example-.io-game 60Hz sim / 30Hz send / plain overlap hits (CONFIRMED from source):
  https://github.com/vzhou842/example-.io-game
- Cloudflare DO docs: use case, CPU limits, setInterval-vs-hibernation (CONFIRMED):
  https://developers.cloudflare.com/durable-objects/platform/limits/
- Diablo III TDM cancellation, Jay Wilson interview (CONFIRMED):
  https://www.pcgamesn.com/diablo/diablo-3-pvp-latest-team-deathmatch-scrapped-and-started-again-duelling-promised-patch-107
- Crawl (Powerhoof) format (CONFIRMED): https://en.wikipedia.org/wiki/Crawl_(video_game)
- Dark and Darker portals/swarm/gear score (fetched): https://progametalk.com/dark-and-darker/escape-portal-guide/ ,
  https://darkanddarker.wiki.spellsandguns.com/Gear_Score
- Hunt: Showdown noise traps (fetched): https://huntshowdown.wiki.gg/wiki/Noise_Traps
- Extraction loss-softening analysis (fetched): https://naavik.co/f2p-mobile/extraction-shooters/ ,
  https://leprestore.com/guides/eft/escape-from-tarkov-insurance-explained/
- netplayjs, rollback without strict determinism (PARTLY): https://github.com/rameshvarun/netplayjs

## Phase 1 implementation spec (drafted 2026-07-15, ready to build)

**The Duel Room, "TRIAL BY COMBAT":** a lobby mode next to the FF toggle. Best-of-5
rounds in a flat hazard-free arena, mirrored loadouts, first to 3 takes the match.

Build order (each step testable in the two-tab harness):
1. **Mode plumbing.** 'duel' rides the 'start' message like ff does (m.duel). startCoop
   sets g.duelMode; newRun in duel mode generates a single arena room (new room type
   'arena': big open rect, no doors, no chests, no monsters, torches for looks).
2. **Mirrored loadouts.** The host's seed rolls ONE weapon+armor kit; both clients
   equip identical copies (seeded roll = same result, or the host ships the kit in
   the start message: `kit: {w: <weapon obj>, a: <armor obj>}` - shipping it is
   simpler and rejoin-safe). Classes stay as picked (class variety is the fun);
   levels/meta bonuses reset to baseline for the match: new Player with meta null.
3. **Menu-invulnerability carve-out (the mandatory exploit fix).** In duel mode the
   'phit' handler applies damage even when the victim is on a menu, EXCEPT during
   the between-rounds banner. Simplest rule: g.duelMode disables pause/charsheet
   freezing entirely (opening menus doesn't stop the sim for you).
4. **Round lifecycle.** Reuse downed as round-loss: when a player goes downed in
   duel mode, do NOT allow revive; host announces {t:'round', winner, score} (sendR);
   both clients show the banner, reset positions to opposite arena corners, restore
   full hp, 3-2-1-FIGHT countdown (inputs locked), next round. First to 3: reuse the
   score-snap flow with a DUEL CHAMPION banner instead of the eulogy.
5. **Scoring/stats.** Track duel W-L per name in localStorage next to high scores;
   a simple lifetime "duel record" line on the title screen feeds the sibling-rivalry
   loop (research: bragging surfaces carry family PVP).

Known traps from the research + code inventory to respect:
- Ties: each client owns its own hp, so simultaneous downs can disagree. The HOST's
  view of round outcome is authoritative (single announcer via sendR), even though
  hits stay attacker-resolved.
- Keep monsters/hazards OUT of the arena (host-owned objects judge the guest against
  its 66ms-stale ghost - unfair in a duel; fine to revisit in Phase 3).
- Rounds must reset cooldowns/ult charge or the loser compounds (comeback-friendly).
- The swarm/objective variants (king-of-the-shrine) are Phase 2 upgrades, not v1.
