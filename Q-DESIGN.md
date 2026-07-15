# Q-DESIGN: class abilities that never fall off

Agreed with Sam, 2026-07-15 (full walkthrough, every class discussed individually).
Problem: Q abilities outscale by depth - monster HP grows quadratically with floor
(descent.js:35: 1 + 0.18d + 0.015d^2, times tier x5 by floor 5) while Q damage grows
linear-in-level times linear-in-stat from a fixed base. By floor 20 an Arcane Nova is
~450 damage into ~1,500-3,000 HP mobs. Weapons keep pace because gear/evolutions/crit
compound; Q loses by construction.

## The three rules

1. **PERCENT RIDER (damage Qs):** Q damage = flat base (unchanged, preserves floor 1-3
   feel) + X% of each target's max HP. Bosses take the percent at ONE-THIRD rate.
   Self-balancing at every depth; can never one-shot; cooldowns stay the pacing.
   Riders: novas 10% | Execute 18% | dash hits 8% | DoTs (Immolate, Miasma) as %/s
   folded into their dps | turret shots 3% per shot | mesmer clone detonation 10%.
2. **Q RANK = points in your class's RULING STAT** (CLASS_STAT, abilities.js:176-181).
   Every point grows the Q's SIGNATURE quantity (not just damage). One legible rule:
   "your class ability grows with your class stat."
3. **MILESTONE FEATURES at ranks 4 / 8 / 12** - discrete new behaviors. The tooltip
   always shows current rank and the NEXT unlock (anticipation is content).

## The agreed table

### MIGHT
- **WARRIOR - Shield Bash** (95 nova + block-1 shield). Per point: +knockback.
  R4: shield blocks 2 hits. R8: KNOCKBACK DOUBLES (Sam: "a real noticeable change").
  R12: WALL SLAM - enemies knocked into walls take the hit again. (R8 doubling feeds
  R12: twice the shove, twice the slams.)
- **BARBARIAN - War Shout** (fear 5s, r300). Per point: +0.15s fear.
  R4: feared enemies take +15% damage (shout-then-swing combo). R8: allies near you
  gain rage (the co-op milestone). R12: enemies cornered against walls cower (stun
  instead of jitter).
- **ADVENTURER - Adrenaline** (rage+haste buff). Stays MIGHT (Sam). Kept modest so real
  classes feel like upgrades. Per point: +duration. R4: refunds roll. R8: small heal
  on cast. R12: buff extends to allies.
  FUTURE (Sam): a NEW CLASS ruled by FORTUNE - to be designed later (Gambler/Merchant
  space). FORTUNE deliberately rules no class until then.

### AGILITY
- **RANGER - Tumble Volley** (dash 320, i-frames, roll refund, 75 pass-through).
  Per point: +dash distance.
  R1 (Sam): THE VOLLEY BECOMES REAL - 3 arrows at nearest enemies mid-dash, at your
  bow's damage (scales with gear). R4 (Sam): FULL CIRCLE of arrows mid-dash.
  R8: volley arrows pierce. R12: TWO dash charges.
- **ROGUE - Eviscerate** (point-blank guaranteed crit, 150; highest rider 18%).
  Per point: +crit damage on Eviscerate. R4: a kill with it resets the cooldown
  (chain executions; only chains while it kills). R8: SHADOWSTEP - cast at range
  teleports you behind the target first. R12: kills grant 1.5s Vanish.
  Watch item: if deep-floor rogues become untouchable, limit Vanish to first kill/cast.
- **ENGINEER - Deploy Turret** (charges to 5). DEEP-VIABILITY (Sam: "make sure the
  turrets remain viable deep"): turret shots get the 3% maxHp rider (bosses 1/3),
  verified floor-2 vs floor-25 kill-time in the harness before the number ships.
  Depth over width: cap STAYS 5. Per point: +turret fire rate.
  R4: turret shots slow. R8: turrets inherit your weapon's element.
  R12: oldest turret becomes a TESLA COIL (chains lightning, distinct sprite).
  Build note: fix turrets-invisible-to-teammates (COOP-REVIEW #9) in this wave.

### ARCANE
- **MAGE - Arcane Nova** (130, r205, rider 10%). Per point: +radius.
  R4: leaves a 2s slow field. R8: second smaller pulse 0.5s later. R12: everything
  hit is chilled. (Alt R12 if the son wants flashier: implosion pull before detonation.)
- **SUMMONER - Summon Elemental** (fights until killed, cd starts on death).
  Per point: +elemental HP/dmg. Verify current elemental depth-scaling before setting
  numbers; its hits get rider treatment. R4: element aura (fire burns / earth slows /
  storm zaps nearby). R8: TWO elementals. R12: elementals explode on death (their element).
- **MESMER - Mirror Image** (3 clones 8s, detonate 70; detonation rider 10%).
  Per point: +clone duration. R4: FOUR clones. R8: clones echo your attacks (weak) -
  needs a new co-op sync path, flagged. R12: recast swaps you with a clone (planned blink).
- **NECROMANCER - Raise Dead** - RE-KEYED from player level to ARCANE rank (approved):
  rank 0: 1 knight | R4: 2 knights | R8: 3 knights + 2 archers | R12: + a BONE GOLEM
  (big, slow, taunts). Per point: minion HP/dmg. Consequence accepted: no ARCANE
  investment = one knight forever.
- **PYROMANCER - Immolate** (room burns, 60dps 6s; rider as %/s). Per point: +burn dps.
  R4: bigger spread radius from dying enemies. R8: fire immunity while it burns
  (including Hell floor hazards). R12: burning enemies EXPLODE on death.
  Watch item: R4+R12 cascade on deep floors is the class fantasy - playtest, don't pre-nerf.

### VIGOR
- **PALADIN - Lay on Hands** (heal 30% + block-1 shield). Per point: +1% heal.
  R4: shield blocks 2. R8: cast CLEANSES (burn/bleed/venom/slow). R12: overheal
  becomes temporary armor (tune so pre-shielding doesn't trivialize boss openers).
- **CLERIC - Mend** (40% heal, r240, party-wide). Per point: +1% heal, +radius.
  R4: heals cure poison/bleed on everyone touched. R8: consecrated circle (4s regen
  zone). R12: everyone healed gains a small shield charge.
  **VERIFICATION REQUIRED (Sam): party healing must be proven in the two-tab harness**
  - amount lands on the guest, radius uses right positions, rides the reliable bus,
  and the R4/R12 statuses ride the same 'pheal' message (#197). Becomes a regression test.
- **DRUID - Shapeshift** - SPECIALIZATION FORMS (Sam): each form is a role.
  BEAR = tank (HP, shove force). WOLF = skirmisher (speed, bleed).
  **OWLBEAR** (Sam: replaces the owl) = ARCANE BRUISER - hulking feathered beast,
  swipes deal MAGIC damage, short-range arcane screech. Trades the old owl's
  flying/untouchable escape for magical muscle; if the escape is missed, R8's owlbear
  move can be a wing-buffet hop.
  Per point: forms get statier (bear HP/force, wolf speed/bleed, owlbear magic dmg).
  THREE FORMS TOTAL - Sam cut the fourth-form idea; three is enough.
  R4: shifting heals 5% (rewards form-dancing). R8: each form gains a MOVE (bear roar
  taunt / wolf pounce / owlbear wing buffet). R12: PRIMAL MASTERY - shifting into a
  form instantly performs its R8 move for free (shift-to-bear roars, shift-to-wolf
  pounces, shift-to-owlbear buffets). Endgame druid = a whirlwind of transformations,
  stacking with R4's heal-on-shift.
- **DEATH KNIGHT - MIASMA** (full Q replacement; Sam: Unholy Rune's cheat-death was
  "too tough to land" - unusable skillfully because it only pays off when losing).
  New Q: exhale a lingering rot cloud (~r180, 8s). Enemies inside take poison DoT
  (rider as %/s) and deal 20% LESS damage - rot saps strength. Identity: pyro's room
  burns, mage's slows, DK's WITHERS. Lands on press, no timing.
  Per point: +bonus poison damage (cloud AND weapon venom).
  R4 (Sam): THE BLACK WIND - the miasma follows you as you walk.
  R8: the rot feeds you - regenerate while enemies rot in your cloud.
  R12 (Sam): anything KILLED BY THE POISON rises as a SKELETON WARRIOR fighting for
  you for 30 seconds. Distinct from necro: his army is permanent and deliberate,
  yours is temporary and earned by the plague. Reuses the #207 rise path + _lastHitBy
  poison attribution, so it syncs in co-op from day one.

## Build plan (waves, each its own release + kid-readable patch note)

0. **Framework release:** rank system (rank = ruling-stat points), per-point channels,
   percent riders on all damage Qs + turret/elemental/clone hits, tooltips showing
   rank + next unlock (all milestones VISIBLE before they're built). Numeric harness
   verification at floors 2 / 10 / 25: Q kill-time ratio vs weapon kill-time ratio.
1. **MIGHT wave** (warrior, barbarian, adventurer).
2. **AGILITY wave** (ranger, rogue, engineer + the turret co-op visibility fix).
3. **ARCANE wave** (mage, summoner, mesmer, necromancer, pyromancer).
4. **VIGOR wave** (paladin, cleric + the pheal verification/regression test, druid
   owlbear rework, death knight Miasma replacement - the biggest wave, ship in two
   halves if needed).

Percent-rider numbers, the R4 +15% fear amp, and the DK 20% weaken are first-pass;
tune from family playtests. Watch items are listed inline per class.
