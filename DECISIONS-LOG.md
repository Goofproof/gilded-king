# Autonomous decisions log (for Sam to review)

Context: Sam stepped away and asked me to implement my recommendations, make my own
calls, and log any decision important enough to normally need his input. This file
records those calls and the reasoning, newest first. None of these block a revert.

---

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
- Co-op mirrors magic shots as a plain arrow visual (cosmetic; damage is correct).
- Attunement is a dead level-up pick with no magic weapon equipped (chicken/egg).

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
- **#13 HUD corners** - vague (which element overlaps). Deferred, not guessed.
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

## #20 reroll + honing - deferred, not guessed (2026-07-12)
- Ambiguous (which reroll, what wording). Did NOT implement blind. Left pending for Sam.

## #13 HUD corners - deferred (2026-07-12)
- Vague (which element overlaps). Left pending for Sam rather than guess.
