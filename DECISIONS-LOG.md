# Autonomous decisions log (for Sam to review)

Context: Sam stepped away and asked me to implement my recommendations, make my own
calls, and log any decision important enough to normally need his input. This file
records those calls and the reasoning, newest first. None of these block a revert.

---

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
