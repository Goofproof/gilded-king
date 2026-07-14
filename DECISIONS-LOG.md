# Autonomous decisions log (for Sam to review)

Context: Sam stepped away and asked me to implement my recommendations, make my own
calls, and log any decision important enough to normally need his input. This file
records those calls and the reasoning, newest first. None of these block a revert.

---

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
