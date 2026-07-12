# Autonomous decisions log (for Sam to review)

Context: Sam stepped away and asked me to implement my recommendations, make my own
calls, and log any decision important enough to normally need his input. This file
records those calls and the reasoning, newest first. None of these block a revert.

---

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
