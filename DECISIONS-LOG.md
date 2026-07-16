## 2026-07-16 (perf: ultracode hunt, tier 1 shipped)

24-agent perf hunt (6 lenses, adversarial verify): 14 confirmed findings, 4
rejected. Tier 1 shipped (v2.125), all with the verifiers' risk notes honored:
particle hard cap 600 (drop-oldest, not early-return, so trails never starve);
fps-independent trail emission at 60fps-parity rates (1/60 homing, 1/51 enchant);
projectile glow = pre-baked halo sprite for plain bolts (arrows/spin-coins KEEP
shadowBlur - shape-contoured glow, per verifier); hurt vignette gradient cached,
pulse rides globalAlpha (alpha reset after - the block has no save/restore);
Envy shroud pre-rendered once to a 2W x 2H sprite replaying BOTH original passes
(the 0.97-over-0.97 corner composite preserved); trinket gem baked per color with
blur-bleed padding; projectile hit tests on squared distance with the worm scan
hoisted per frame (w.dead re-checked inside - worms die mid-loop); broadcastMobs
early-out when peers.size 0. Stress bench (same recipe): 1.903 -> 1.393 ms/frame
(-27%) on the dev box; shadowBlur/gradient wins are larger on integrated GPUs.
TIER 2 REMAINS (bigger surgery, the verifiers wrote the traps down): drawRoom
static-layer cache (ambient Fx spawners + door lock state + Date.now obstacles
must stay live), obstacle glow sprite bakes (flamewall deforms - needs transform
animation), minimap offscreen cache, HUD static/dynamic text split, particle
batch-by-color (per-particle alpha problem). Findings archive: the workflow
output file + this log.

## 2026-07-16 (evening tweaks: ante/debt, salvage, chain visual)

1. GAMBLER ANTE (Sam): 5 gold per pull, debt floored at -100, gambler-only.
   Debt inverts the bankroll bonus through the SAME coinScale math (no new
   channel): -100 coins = -50 damage. Symmetric to the benefit at small purses;
   negligible next to the maxHp rider deep down - if debt should BITE late-game,
   the knob is scaling the penalty by rank. Losses no longer shower coins (the
   win's 8/enemy shower is the payout, so the ante economy is a real gamble).
   Debt guard added to PHILOSOPHER'S STONE (negative gold must not transmute
   into a refund). HUD shows debt in red with IN DEBT.
2. ENGINEER SALVAGE (Sam): E on a standing turret scraps it, +1 charge (capped
   at turretMax) and the deploy cooldown resets - repositioning is now free.
3. CHAIN LIGHTNING (Sam: "doesn't work, or needs a visual"): VERIFIED WORKING
   all along (melee + arrows + spells all pass the flag; arcs to 2 within 155px
   at 45% - harness-measured exactly 13.5 off a 30 hit). The gap was the visual:
   7 faint dots. Now a dense jagged bolt with a white core, an impact crack, and
   a ZAP tag over the victim.

## 2026-07-16 (fun batch + GAMBLER class, Sam's picks 1-3 & 5-9 + class redirect)

Sam approved the fun list and redirected #4: JACKPOT became the Q of a new GAMBLER
class (the FORTUNE class the Q walkthrough left open). Shipped: monsters-as-
ammunition (launch-grade knockback crashes into friends, 45% momentum transfer,
no chain cascades), the goose is a REAL killable pet (lays gold, dies into a
fortune - eggs vacuum to the purse, which fooled the first probe), stance aura
rings (t0 stamped lazily at first draw), marathon ram, fort knox orbit + 2-coin
knock-out per hit, tailwind fwake (pheal model), troll blood knit/STEMMED fx,
oracle prophecy star (cleared on floor change along with goose/decoy). GAMBLER:
strike Q with 25% + 1%/rank (cap 50%) TRIPLE; found in verify that the maxHp
rider dwarfed the tripled base on big monsters - wins now triple the rider too
(verified exactly 3.0x). Milestones all live: R4 pity +10%/miss (resets on win),
R8 half-cd refund, R12 instant re-arm. MOTHER LODE (eruption + 20% gear drop)
took JACKPOT's fusion slot. Starting kit: dagger, 40 gold, +10% coins.

## 2026-07-16 (fusion primes) - same-stat doubles get real trios (Sam's ask)

Sam: "add fusions for doubling up, fortune + fortune for example" + "make sure all
these fusions are unique from each other and all have a big impact." 15 Primes
shipped (5 stats x Strike/Stance/Trick). Because fusionRank sums the pair, a pure
build counts its stat TWICE - specialization ranks twice as fast, which is the
Prime's identity. Uniqueness audit ran across all 45; six same-y designs were
punched up BEFORE shipping: GORDIAN CUT is an execute (2x below half HP), RHINO
launches everything it touches (knock 430), SMOKE BOMB leaves a slowing cloud
behind (Houdini chills on reappear instead), TESLA COIL forks twice on a 0.45s
beat (Mjolnir forks once at 0.8s), JACKPOT is a real gamble (25%+0.5%/rank capped
40% to TRIPLE + gold shower), EVENT HORIZON grinds (slow + miasma rot, no heal -
Sanctuary owns healing). Build bug caught: a failed anchor aborted a multi-pair
patch AFTER an earlier file was written - five main.js edits silently lost, found
when the harness showed no miasma; re-applied and verified. Verified numerically:
Prime rank doubling (6 pts = rank 12), goose trickle, Gordian exactly 2.00x,
Tesla 3 targets/beat, jackpot rate within noise of 0.31 at rank 12.

## 2026-07-16 (fusion waves 2+3, unattended /loop) - all 10 pairs live

Waves 2 (v2.116) and 3 shipped unattended; all 30 fusions from FUSION-DESIGN.md
now exist. Calls made without Sam (doc deviations, all logged in the doc's spirit):
1. MJOLNIR is a periodic storm (zaps nearest every 0.8s + one chain) instead of
   on-hit chaining - on-hit would touch every damage site; the beat is one hook.
2. EL DORADO's fever builds per KILL (+3%/kill, cap +30%) not per coin picked -
   the pickup pipeline has no per-item hook worth adding for one stance.
3. GOLD RUSH: kills pay +2 coins and shave 0.5s off Q (not "spell kills pay
   double" - kill attribution to spells vs swings is not tracked).
4. LUCKY STREAK ramps +1% crit per CRIT (cap 50%) rather than per kill.
5. ORACLE OF DELPHI: reveals the whole floor (rooms.visited) + strikes and chills
   the current room, instead of a party-wide damage mark (marks on monsters would
   need takeHit surgery); the co-op share is the SANCTUARY qzone instead.
6. KING'S RANSOM targets the beefiest head (boss > elite > maxHp) and pays 14
   coins + an instanced rare weapon on death.
7. All economy channels hard-capped (transmute 80+4/rank, robbery 2/enemy/dash,
   streak pay 1/crit) - PVP cannot farm them.
8. Verified in the dbg harness at rank 10: transmute spent exactly 120, troll
   regen 20/s and stemmed by >10% maxHp hits, sanctuary spawns both zones, oracle
   reveals every room. Two false alarms during verify were dead-room artifacts.

## 2026-07-16 (fusion wave 1) - FUSION v2 build calls

1. Sam's model ("two stats govern the selection of three fusion abilities") mapped
   onto the EXISTING rpick flow: rOptions() now returns the pair's named trio
   (STRIKE/STANCE/TRICK per FUSION-DESIGN.md) when the base-stat pair is mapped;
   unmapped pairs and same-stat Primes keep the legacy 9x9 grid until waves 2-3.
2. STAT_SCHOOL in evolutions.js is STALE (still maps spd/coin/magic to 'FLOW',
   pre-5-stat-redesign). The fusion pair therefore comes from the BASE stat
   recorded at evolution time (recordEvoPick now takes g.evoChoices.stat);
   a corrected local FUSION_SCHOOL map is only the no-schools fallback. Did NOT
   touch STAT_SCHOOL itself - other code may depend on the old grouping; flagged
   for a later cleanup pass.
3. Scaling = the Q_TUNE recipe verbatim: POWER RANK = summed pair points, per-rank
   channels (pp) + a 6% maxHp rider on damage fusions (boss 1/3), economy channels
   hard-capped (bounty 24/cast, mint 20/hit, charges 6) so PVP cannot farm them.
4. New cast kinds fstance/froot/fvanish/ffleece; effects live in player.js update/
   damage (stances stack reduce on top of the 0.6 armor cap, total capped 0.8).
5. BUG found live: player.heal() rounds per call, so continuous trickles
   (marathon 12/s, antaeus 20/s at 1/60th per frame) rounded to ZERO. Fixed by
   adding straight to hp like the stats.regen tick. Lesson: heal() is for bursts.
6. ATLAS ally-shield rides a new 'fshield' sendR event (mirror of 'pheal':
   sender offers, the owning client applies) - damage-doctrine compliant.
7. All nine verified numerically in the dbg harness at rank 10 (dmg/thorns/heal/
   regen/root-store/burst/mint/gold-armor/vanish-chill within expected values).

## 2026-07-16 (day list) - Calls made while building Sam's morning list

1. CASTER ATTACK SPEED (#247): Sam said wand/staff fire rate should not scale with
   attack speed; "cooldown reduction or charge up increase" instead. Staves have no
   charge mechanic to increase, so I built the CDR reading: while wielding a wand or
   staff, ALL surplus attack speed becomes Q/R/Ultimate recharge rate, point for
   point. Verified numerically both directions in the harness.
2. POOL PARITY (#250): Sam named Fortune and Arcane as underserved. The measured
   skew was actually AGILITY 4 / MIGHT 2 / everything else 3 - so I brought EVERY
   stat to exactly 4 cards (new: Executioner, Jackal / Nettle / Echo / Clover)
   rather than only padding the two he named. Echo needed a small engine addition
   (spells can now repeat; light weapons already could).
3. MENUS ARE NOT ARMOR (#249): "no more pausing in multiplayer" is implemented as
   the world sim running underneath every menu/pick screen in co-op, controls
   idled, damage LIVE (the state swap makes you hittable while reading). Your
   character keeps auto-attacking while you browse - same model as chat. Solo still
   truly pauses.
4. THE HARPY (#251): gentle first boss (matriarch kit, 570 hp, half damage, 8
   essence), forest-flagged so she is neither the King (no victory bonus, no
   firstKing accolade) nor a Warden (no descent essence/mythics). Her portal line
   avoids the Toad and the "Descent yawns" subtitle (floors <3 say "the dungeon
   goes deeper"). The canopy shadow is redrawn as a raptor and is canonically HER.
5. V TOGGLE (#246): first cut opened and closed in the same frame (split branches);
   rebuilt as a single toggle branch. WASD/arrows + Enter/Space/E now drive the
   cards with a white cursor ring (#248).
6. DOOR PLATES (#44 verify): two-client relay test - entry plate parked on for 4+
   sim-seconds never fires (arm-on-vacate); vacate-return-dwell fires exactly once.
   Sam's "constant bounce last night" matches a stale-cache client, not current
   code: everyone should hard-refresh before the next playtest.
7. GAME_URL held at gilded-king until Sam renames the GitHub repo (share links must
   not point at a URL that does not exist yet). Flip + second ship after the rename.

## 2026-07-16 (overnight PVP loop) - Hunt monsters are INSTANCED PER PLAYER, not host-simmed

Sam asked for the finished PVP model by morning. PVP-ROADMAP Phase 3 called the
multi-room host simulation "the big lift"; I did NOT build that. In HUNT mode each
player simulates the monsters of the room they occupy, locally, with zero sync -
the same philosophy as the instanced loot (#239). Rationale: hunters can't see each
other's rooms anyway, so syncing invisible monsters buys nothing; local sim removes
every parity risk overnight; and monsters exist in the hunt as PACING (the third
force that softens you up and slows your looting), not as shared world state.
Consequences accepted: if both hunters share a room, each sees only their OWN
monsters (brief "swinging at air" weirdness during a PVP encounter - the fight
itself takes over quickly); my monsters can never damage the other hunter (guarded
in hurtTarget: src.type identifies a monster). Kills feed only the killer (xp +
instanced drops, no cross-player broadcasts). Co-op adventure mode is untouched -
host-authoritative proxies exactly as before. If real shared-room monster combat is
ever wanted in hunts, the roadmap's room-as-authority split is the upgrade path.

# Autonomous decisions log (for Sam to review)

Context: Sam stepped away and asked me to implement my recommendations, make my own
calls, and log any decision important enough to normally need his input. This file
records those calls and the reasoning, newest first. None of these block a revert.

---

## #155 A NAMED BOSS AT EVERY CIRCLE OF HELL (2026-07-14)
Sam: "add a unique boss to each level of hell. The boss should be associated with the level."

**The calls I made.**
- **Every Hell floor (4-12) is now a boss floor.** Before, a recurring Warden guarded only
  every third floor (6/9/12). Now each of the nine circles ends with its own guardian.
  The ascent/Paradiso Warden cadence (floors 15/18/21/...) and the floor-3 Gilded King are
  untouched, and the Empyrean is still the original King.
- **Nine real Dante guardians.** Charon (Limbo), Minos (Lust), Cerberus (Gluttony), Plutus
  (Greed), Phlegyas (Wrath), Medusa (Heresy), the Minotaur (Violence), Geryon (Fraud),
  Lucifer (Treachery). Every one is a googleable figure from the Inferno, and each wears its
  circle's colours.
- **Reuse the engine, not nine bespoke AIs.** Each guardian maps to one of the three existing
  boss archetypes (king / colossus / matriarch), chosen to fit: charging brutes (Charon,
  Phlegyas, Minotaur) are the colossus; ranged/coiling judges (Minos, Medusa, Geryon) the
  matriarch; the maws (Cerberus, Plutus, Lucifer) the king. Identity (name, lore, palette,
  size) is unique per circle; the moveset is one of the three proven patterns. This is the
  same reuse philosophy as the Warden and the Doppelganger. Determinism: the guardian is
  fixed by the FLOOR (not the old anger counter), so a co-op host and guest meet the same
  boss and it always matches the circle.

**Honest limitation** (easy-ish follow-up if Sam wants it): three of the nine share a
fight pattern with two others (three king-type, three colossus-type, three matriarch-type).
They LOOK and read totally distinct, but Cerberus/Plutus/Lucifer fight alike mechanically,
etc. Giving each a bespoke signature move tied to its circle's rule (Medusa's petrifying
gaze, Geryon's flight, the Minotaur's maze-charge) is a real content project on top of this.

**Pacing note for Sam.** A boss at every Hell floor, stacked on the new descent-scaling wall
and the nightmare portals, makes the Inferno very boss-heavy and hard - which lines up with
the "only the top 5 reach the bottom" goal, but it is a big shift from the old ~3-boss
descent. Worth a playtest to feel whether nine-in-a-row is right or wants thinning.

## #12 DESCENT SCALING - the Inferno as a filter (2026-07-14)
Sam took this off the parked list and, mid-build, gave the real goal: "only the top 5
players will ever get to the end of Dante's Inferno." So this is not a gentle
match-progression tweak; it is a deliberate WALL that filters the leaderboard.

**The design (two levers, one function `progressionScaleMonsters`).**
- **The wall.** Monster HP/damage ramp quadratically toward the bottom of the Inferno
  (floor 12), on TOP of the existing depth curve (#126). On-curve, floor 12 monsters carry
  ~+70% HP / +30% damage from the wall alone (~6-7x base HP once the depth curve is folded
  in). It maxes at floor 12 and stays maxed on the climb beyond, so the frozen lake is a
  genuine gauntlet.
- **The rubber-band (the "scales with the player" half).** The proposal's option 1. Monsters
  scale with how far the player's level is ABOVE the expected level for the floor, capped at
  +90% HP. So GRINDING LEVELS DOES NOT HELP - a level-60 grinder at floor 12 faces ~3.2x
  HP, a level-38 on-curve player ~1.7x. Only a genuinely strong BUILD (real DPS-per-level,
  not raw levels) breaks the wall. Under-level gets a small mercy (-15%). This is what makes
  it a skill/build filter rather than a grind check - exactly Sam's "top 5 only" intent.
- **Why not option 2 (scale off weapon DPS).** Still rejected: it feels unfair ("I upgraded
  my sword and enemies got tankier") and is the purest death-spiral risk. The rubber-band
  gets the same anti-trivialisation effect off LEVEL, which reads as fair.

**The numbers are a first-pass and WILL need Sam's playtest.** They are all in one
`DESCENT_SCALE` knob block. The honest caveat: I cannot calibrate "exactly the top 5 reach
the bottom" from a script - that is a live-telemetry / feel decision. I set it moderate so
players can still progress and Sam can watch WHERE they stall, then raise wallHpBottom /
perLevelHp (harsher) or lower expBase (treats more players as over-levelled, also harsher)
until the leaderboard tops out where he wants. Starting moderate-and-tunable-up beats
starting impossible.

## #13 TWIN PORTALS - the Nightmare path (2026-07-14)
Sam picked this off the parked-proposals list and said "let's do twin portals." The
proposal (DESIGN-PROPOSALS #13) flagged two forks that needed his call; he said build
it, so I made both calls and logged them here for his review.

**The calls I made.**
- **Co-op rule: host-authoritative.** DESIGN-PROPOSALS offered host-chooses / party-vote /
  split-instances. I took HOST-CHOOSES because it is the only one that fits the engine as
  it stands: the floor already advances host-first and the whole party follows a single
  `{t:'floor', floor, seed}` broadcast. I just added a `nm` flag to that message. Whoever
  takes a portal pulls the party, and the nightmare flag rides the shared message so
  everyone lands on the same (nightmare or normal) floor from the same seed. No divergence,
  no split instances. A vote UI would be a real feature on its own; not worth blocking this.
- **How it is offered: ADDITIVE, not a rebuild.** Rather than replacing the descent exit,
  the nightmare portal opens BESIDE the normal one (stairs on a normal floor, the boss-
  plunge on a boss floor). The normal path is byte-for-byte untouched; nightmare is one new
  interactable + one draw. Lowest-risk way to hit "a choice at the end of every descent
  floor."
- **Balance (first-pass, all in one NIGHTMARE knob block in main.js).** Harder: monsters
  +45% HP, +25% damage, +18% chance any body is also an elite. Richer: +70% gold, +40% XP.
  These are deliberately conservative-ish and trivially tunable. I did NOT force an extra
  mutator or an extra Warden (the proposal floated both) - the stat + elite bump is enough
  to make it feel nastier without destabilising the Rules/mutator determinism. If Sam wants
  it swingier, the knobs are one edit.

**What I deliberately left out of v1** (easy follow-ups if Sam wants them): a guaranteed
mythic drop on a nightmare floor; a loot-rarity (luck) boost on kills; a red screen-tint
for the whole nightmare floor (right now it is a banner + the red portal, not a persistent
overlay). Rewards are gold + XP for now, which apply on every floor; essence/mythic
sweeteners can layer on top.

## #11 DOPPELGANGER mini-boss - elevate the existing shade to a seed-placed boss (2026-07-14)
Sam's ask: make the Doppelganger a real occasional mini-boss - a shadow of the player
matching stats/speed/weapon/spells, in the odd room.

**Starting point.** A `doppel` enemy already existed (#128): it morphs into a copy of you
on first sight and fights in your weapon's style (melee lunge / kite-and-shoot). But it was
just another entry in the tier 4/5 random spawn tables - common trash, ~44 HP, easy to
miss among a crowd.

**The calls I made.**
- **It is now a MINI-BOSS, not trash.** Pulled `doppel` out of the random spawn tables
  entirely. It now appears ONLY as a dedicated mini-boss.
- **Occasional + seed-placed.** At floor generation (the SEEDED rng, floor 4 and deeper,
  ~30% of floors) one combat room is flagged as the doppelganger room. Because the flag is
  seed-derived, a co-op host and guest agree the encounter exists; the host actually spawns
  and owns it (spawnForRoom is host-only), and it syncs to guests via the mob snapshot like
  every other monster. Host-authoritative, no desync of game state.
- **A duel, not a mob.** The doppelganger room stages the shadow ALONE - fighting yourself,
  one on one. Thematically right and mechanically clean (one clearable combat body).
- **It mirrors YOU.** At spawn it copies the (host) player's weapon archetype + colour,
  HP scaled off your own max HP (floored and depth-scaled, capped at 1400 so it stays a
  fight not a wall), damage mirrored off your weapon but CLAMPED so a hyper-honed weapon
  can't let it one-shot you, and near-player move speed. It casts its empowered move often
  (the 3-shot / heavy-lunge "spell"). A floating name + HP bar mark it as a boss.

**Known co-op cosmetic gap (not a desync).** The morph VISUAL (which class face/weapon the
shade wears) is captured from the local player and is not in the 15Hz mob snapshot, so a
guest sees a generic shade shape while the host sees the full morph. HP, position, damage
and existence all sync correctly - only the skin differs. Syncing the mirror skin is a cheap
follow-up if Sam wants it; I left it out to avoid bloating every mob snapshot.

## #10 ULTIMATES rework - build-affinity offer + flashy dungeon-wide cast + tuning (2026-07-14)
Sam's ask: ultimates should feel unique to the player's prior picks (build diversity),
the cast should be flashy and "the whole dungeon should know," and the cooldown +
effect should be bigger.

**The fork.** A full per-build ultimate MATRIX (generate a bespoke ultimate parameterized
by Q + R + every evolution) versus a lighter pass: bias the OFFER toward your build,
make the cast a dungeon-wide spectacle, and turn the numbers up. I took the lighter,
shippable path. A bespoke-per-build generator would be a week of tuning and a balance
minefield, and the pool already holds 10 wildly distinct room-scale powers - the problem
was that the 3-of-10 offer was pure random, so a crit-burst build was as likely to be
offered POISON MIASMA as CATACLYSM. Weighting the offer to your build gives the
"unique to my picks" feel without a new balance surface.

**What I built.**
- **Build-weighted offer.** Each ultimate carries affinity tags (dmg/crit/magic/spd/
  roll/regen/hp/coin). `rollUltimates` now scores each ult against your evolution history
  (the stats you stacked) plus your Q and R kinds, and weighted-samples 3 distinct. Your
  build still cannot FORCE a specific ult (every ult keeps a floor weight), so there is
  variety, but the offer leans hard toward what you have been building.
- **Determinism note.** The offer is a LOCAL per-player menu, not shared world state
  (each player levels independently; monster spawns/floor rules are the seed-derived
  parts). So the weighted sample uses Math.random, exactly as the old random offer did -
  it is not a co-op desync vector. The chosen ult is already broadcast in the score snap.
- **Flashy dungeon-wide cast.** Every ultimate now fires a full-screen color flash + a
  big centered ultimate-name banner + heavy shake, on top of each ult's own FX. In co-op
  the cast broadcasts a visual-only 'ultcast' message so the other players' screens flash
  too - "the whole dungeon knows." Visual only, zero sim impact, cannot desync.
- **Tuning.** Cooldowns raised (~14-18s -> ~20-28s) and damage/effect/duration bumped
  across the board, so an ultimate is a rarer, bigger moment.

Numbers are first-pass and tunable. If the offer leans TOO hard (never seeing off-build
options) or the flash is too much, both are one-line dials.

## Layer 3 / PURGATORIO - the calls I made while Sam was asleep (2026-07-14)
Sam handed this off as an overnight /loop and pre-decided the big three: yes we
climb; ONE continuous run (not a separate mode); Purgatorio only tonight, with
"what is at the top" left for his son. Everything below is mine.

- **The turn happens at floor 13, not at a boss.** The nine circles are floors
  4-12. Rather than gate the mountain behind another Warden fight (there is already
  one every 3rd floor), you simply reach the bottom and go THROUGH it. Breaking the
  ice is the beat; it does not need a health bar attached to it.
- **The mountain stays inside `Descent.isDescent()`.** That reads wrong at first
  glance, and it is deliberate: `isDescent()` means "past the King", i.e. the
  endless region, and it gates the threat curve, the elites, the boss cadence and
  the mythic shops. If the mountain fell outside it, all of that would silently
  switch off at floor 13 and the climb would be trivial. What changes up there is
  the SCENERY and the RULES, not the difficulty machinery. Guarded by a test.
- **Score stays `g.floorNum`.** The readout flips from depth to altitude, but the
  number the leaderboard sorts on never changes direction, so nothing downstream
  had to learn about climbing.
- **Terrace rules are penances, not torments.** Hell's rules are done TO you and
  are cruel; each terrace rule is the sin turned into its own cure (Pride takes
  away your dodge roll, Sloth punishes standing still, Avarice makes gold worthless
  and pays in XP instead). This is the line I used to decide what each one does.
- **The shore carries NO rule and NO mutator.** It is the one floor in the entire
  endless region where nothing is hunting you. A mutator there would step on the
  only quiet moment the game has. Guarded by a test.
- **Seven terraces cycle** (Pride ... Lust, then "HIGHER"), same as the circles did,
  so the climb is endless. Paradiso is not built - it is a later night.


## #49 magic increment 2 - shipped 2 of 3 parts, utility deferred (2026-07-12)
- #49a wand DPS balance + Magic scaling: shipped (see the RESOLVED note under the
  magic-audit section below).
- #49b ELEMENTAL STAFFS: shipped. A staff's charged burst now takes on its enchant
  element instead of always being fire - Frost = ice nova (chill), Venom = poison
  bloom, Chain = storm burst, plain = fireball. Color, on-hit status, AND the AOE
  blast all carry the element (the blast used to only spread fire). Verified in-sim:
  a frost staff chills both its direct target and a bystander caught in the blast.
- #49c UTILITY WAND SPELLS (teleport / time-freeze): DEFERRED to Sam. These aren't
  damage - they're active abilities, and auto-firing a blink/freeze on the wand's
  normal attack would be chaos. They need a control decision (dedicated cast key?
  a "utility wand" weapon subtype vs the existing Q/R ability slots? cooldowns?).
  Building that blind risks stepping on the ability system. Wrote a proposal for
  Sam in DESIGN-PROPOSALS.md rather than guess the scheme.

## #48 enemy unit tactics - role mapping (2026-07-12)
Sam's spec named "thorns mobs / chargers / small purples." Mapped to the actual
enemy roster (no "thorns" type exists; closest role match):
- BULWARK = `shielded` (the shield mob). When a ranged ally (archer/glass/seeker/
  pulser/miner/summoner) is alive, it plants itself ~42% of the way from that ally
  toward the player, shield facing the player, screening the shooter. It drops the
  screen and does its normal bash only when the player pushes inside ~95px.
- FLANKER/cavalry = `chaser` (also mimicbaby/add, same case). At >120px it swings to
  a fixed flank side (each rider picks left/right once) instead of a head-on charge,
  then commits straight to lunge once close.
- PICKET = `swarmer` (small purples). While a ranged ally is alive and the player is
  >150px away, the swarm orbits/guards that ally; it peels off to swarm the player
  the moment the player closes.
All three fall back to their original behavior when no ranged ally is in the room.
Verified in-sim (dbg): shielded sits between player and archer; swarmer holds ~46px
picket on the archer then closes on the player (85->37px) when the player nears;
chaser assigns a flank side and curves in; shielded runs idle->windup->bash->recover
once engaged. flankSide/orbit use Math.random, which only runs host-side (monster AI
is host-authoritative), so co-op stays in sync.

## #16 magic audit (reeled in per Sam) + fixes (2026-07-12)
Ran a 5-dimension review workflow on the magic integration; Sam flagged it was
spawning too many agents (a prior "workflow_agent_overrun" is on THE LIST), so I
STOPPED it after the hunt phase and verified the findings myself (no verify swarm).
Fixed the real bugs:
- #47 dagger/swarmer: melee now targets the NEAREST in-reach enemy and faces it
  (cursor-aim is for ranged only); zero-windup weapons no longer swing early and
  whiff. Verified: dagger hits an adjacent swarmer even with the cursor aimed away.
- Staff fireball no longer double-hits its direct target (blast skips the primary).
- Unwieldable magic pickup no longer strands you: pickup stays on the wieldable slot.
- Wand/staff now labelled "Wand/Staff · magic (Magic N)" and get their own HUD /
  dropped-gear glyph (rod + orb), not "Light melee"/sword.
- EVO_PAL now has a 'magic' violet so a magic-heavy build keeps its evolution visuals.
DEFERRED (balance/cosmetic, need Sam's playtest, logged not fixed blindly):
- Wand sustained DPS reads ~3x bow and Multishot compounds it - needs a balance pass.
  RESOLVED (#49, 2026-07-12): wand base cut 12/0.30 -> 11/0.46 (base DPS 40 -> 24,
  now ~1.76x a bow instead of ~3x), and Magic now SCALES spell damage (+8%/point
  over 1) so the old power is only reached by investing the stat. This is a
  measured first-pass nerf, not a gutting - easy to push further after Sam plays.
- Co-op mirrors magic shots as a plain arrow visual (cosmetic; damage is correct).
  RESOLVED (2026-07-12): fireSpell now sends the spell type + radius (sp/r), and a
  peer renders magic shots as a glowing orb + trail (fireball plays the 'heavy'
  cast sound) instead of an arrow; bow arrows still render as arrows. Send path
  verified live (bolt r5 violet, ice-fireball r8 cyan). Receive path is a 3-line
  from:'remote' push mirroring the verified local spell projectile, so it draws as
  a glowing circle; full 2-client visual confirmation not driven in this harness.
- Attunement dead level-up pick with no magic weapon equipped - PARTLY addressed:
  Magic now boosts spell damage, so once you DO hold a wand/staff the stat pays off
  (still worthless with no magic weapon; a true fix is context-gating the offer).

## HOLDING the remaining big/ambiguous items (2026-07-12)
After clearing everything cleanly buildable, I stopped prod-changing work on the
last items rather than build them blind. Reasoning per item (for Sam to steer):
- **#16 Magic system (wands/staffs)** - spec'd, but it means new branches in the
  CORE auto-attack/fire loop (today only heavy/light/bow) + a new stat + ~6 spells.
  A large blind addition there risks regressing well-tested combat. Wants a scoping
  pass: build wand+staff as new archetypes first (fast bolt / slow fireball), then
  layer utility spells (blink, time-freeze) and elemental staffs. Recommend I do
  that increment next session with Sam able to react.
- **#30 Base classes + per-level trees** - big, and it overlaps heavily with #46
  (the stat-web rework). Building classes before the stat web is settled would mean
  redoing them. Sequence after #46.
- **#43 Prestige page** - the prestige SYSTEM isn't designed yet ("may earn its own
  page"). Building a page for an undefined system is premature.
- **#46 Stat-system rework** - Sam explicitly wants to design the connecting "web"
  together (stat relationships, what each drill-down shows, invisible-on-C). Needs
  his design input before build.
- **#13 HUD corners** - DONE (2026-07-12). Interpreted as: the top-left stats panel
  and top-right minimap sit over the room's corners and hide mobs lurking there. Made
  both fade (extra when a live monster is actually under them) so corner mobs stay
  visible. If Sam meant something else by "HUD covers corners," easy to adjust.
- **#20 Reroll + honing wording** - ambiguous (which reroll, what wording). Deferred.

## #27 ROOM SHAPES - obstacle layouts, not a PF refactor (2026-07-12)
- Sam asked for "changing the shape of the rooms." A true non-rectangular play
  field would mean refactoring PF (the fixed rect used for ALL collision, wall
  and door-lane math) - too risky to attempt blind while Sam is away (high chance
  of breaking movement/walls game-wide). Instead I added obstacle LAYOUTS (pillars
  / ring / corners / columns / scatter) that make rooms FEEL like different shapes
  while reusing the existing, collision-safe obstacle system. Seeded so co-op stays
  in sync; every layout guards against sealing a door (verified 0 sealed doors over
  275 rooms). If Sam wants literally non-rect rooms, that's a separate PF refactor.

## #27 enemy variety - design calls (2026-07-12)
- **Spawn rates / stats are first-pass guesses.** New enemies (seeker, miner, pulser,
  worm) got hand-tuned hp/dmg/speed and were slotted into the tier 3-5 spawn tables at
  equal weight with existing types. This will shift the enemy mix on deeper floors.
  Needs a playtest to confirm they're not too common or too punishing.
- **Homing orbs (seeker) desync in co-op.** Projectiles mirror to guests at constant
  velocity, so a guest sees the orb fly straight, not home. Damage still resolves
  locally. Acceptable for now; a proper fix is host-authoritative homing sync. Logged
  as a known co-op imperfection.
- **Mines**: proximity trigger (~42px) + 0.4s fuse per Sam's spec, plus a 7s failsafe
  auto-detonate so un-tripped mines don't linger. Mines don't block room-clear (they
  aren't monsters); the miner does.

## #20 reroll -> continuous PAID (2026-07-12)
- Interpreted "shop reroll: continuous, 10g then +1g each" as the LEVEL-UP reroll
  (the only reroll in-game). Was once-per-level-up and free (gated by g.levelRerolled).
  Now: unlimited, costs 10 gold on the first reroll of a RUN, then +1g each
  subsequent reroll (10, 11, 12...). Counter g.rerollCount is run-persistent (resets
  in newRun), so cost climbs across the whole run, not per level-up. Can't afford ->
  error sound + a brief red flash on the button, no reroll, no charge. Button now
  reads "REROLL (R) Ng" and greys out when you can't afford it.
  Verified in-browser: 100g -> 90 (10g) -> 79 (11g), choices reroll each time;
  at 5g with cost 13 the reroll is denied (coins/counter/choices unchanged, flash on).
- Honing "phrasing": left as-is. The existing copy ("U hone 5", "This weapon is
  fully honed", "Need X shards to hone (have Y)") already reads clearly; churning
  clear text blind wasn't worth a regression. If Sam meant a specific rewording,
  quick to change once he says which string.

## #13 HUD corners - deferred (2026-07-12)
- Vague (which element overlaps). Left pending for Sam rather than guess.
