# FUSION ABILITIES v2 - the 3-choice model (design map, NOT built)

Status: ALL 30 SHIPPED 2026-07-16 (v2.115-v2.117; mechanics deviations in DECISIONS-LOG.md). Originally: DESIGN LOCKED-IN-SHAPE by Sam 2026-07-16: "two stats govern the selection
of three different potential fusion abilities... each of those fusion abilities to
be diverse, unique, and scalable." This doc is the 30-ability map for the pair
walkthrough (same process as the Q waves). Nothing is code yet.

## The model

- Your first two evolution picks name a STAT PAIR (e.g. MIGHT+VIGOR).
- At the moment R is forged today, you instead get a PICKER: the pair's THREE
  fusion abilities. You choose one. It becomes your R for the run.
- The three options per pair follow one diversity rule so no two feel alike:
  - **STRIKE** - a burst you aim (nova/dash/execute shape)
  - **STANCE** - a timed power window that changes how you fight
  - **TRICK** - utility/economy/survival, the clever pick
- Same-stat doubles (Prime) keep today's behavior: an amplified pure action.
  (Optionally later: a Prime trio per stat. Not in wave 1.)
- Trinomials (see v1 appendix at bottom) stay a FUTURE tier on top of this.

## The scaling law (the Q_TUNE recipe, proven on the Q ranks)

Every fusion has a POWER RANK = statPoints[A] + statPoints[B] - the combined
points in its two governing stats, uncapped, live-updating as you keep leveling.

- Damage channels: base + %-per-rank, PLUS a %-of-target-max-HP rider
  (bosses take the rider at 1/3) - flat numbers outscale, riders never do.
  This is exactly what fixed "the player outscales Q" and it is already tuned.
- Windows/durations/radii: +per-rank with soft caps so stances don't go infinite.
- Economy channels (coin payouts): per-rank with hard caps (PVP-safe).
- The HUD tooltip shows the rank like Q does, so growth is legible to a kid.

## THE 30 - for the walkthrough (3 per pair: Strike / Stance / Trick)

Names reference real things (myth, history, idiom) per the standing rule.

### 1. MIGHT + VIGOR - the Immovable
- **ATLAS** (Strike): ground slam nova; every ally in radius gains a shield
  charge. Scales: damage/rank + %maxHp rider; +radius/rank.
- **AJAX** (Stance): the tower shield, 5s: take half damage, heavy thorns, your
  swings cleave the full arc. Scales: thorns/rank, +duration.
- **ANTAEUS** (Trick): the wrestler the earth healed. Stand still 1s to root:
  fast regen while rooted; leaving the root releases a retaliation burst scaled
  by damage taken while rooted. Scales: regen/rank, burst cap/rank.

### 2. MIGHT + AGILITY - the Tempest
- **TYPHOON** (Strike): dash that drags a whirlwind: damage along the path, burst
  at the exit. Scales: path damage/rank + rider on the exit burst.
- **ACHILLES** (Stance): 5s: +attack & move speed, immune to slows/knockback,
  first hit on each enemy crits. Scales: speed/rank, +duration.
- **PARTHIAN SHOT** (Trick): the horse-archer's retreat. For 6s, moving AWAY from
  enemies auto-fires backward shots and rolling resets your attack cooldown.
  Scales: shot damage/rank, shots-per-second cap.

### 3. MIGHT + ARCANE - the Spellblade
- **EXCALIBUR** (Strike): one colossal blade of light: guaranteed crit, damage
  from BOTH might and spell power. Scales: %maxHp rider/rank (boss ÷3).
- **MJOLNIR** (Stance): 6s: every hit chains lightning to a nearby enemy.
  Scales: chain damage/rank, +1 chain target at rank thresholds.
- **PROMETHEUS** (Trick): steal fire: enemies you hit burn; you gain spell power
  per enemy currently burning. Scales: burn dps/rank, spell power cap/rank.

### 4. MIGHT + FORTUNE - the Kingmaker
- **CROESUS** (Strike): a strike that hits harder the richer you are (Midas
  channel, higher cap) and knocks coins out of survivors. Scales: cap/rank.
- **EL DORADO** (Stance): the gilded city, 6s: kills fountain coins and your
  damage grows for every coin picked up during the window. Scales: per-coin
  bonus/rank, capped.
- **KING'S RANSOM** (Trick): mark one elite or boss: it takes bonus %maxHp
  damage (boss ÷3) and drops double loot on death. Scales: rider/rank,
  cooldown down with rank.

### 5. VIGOR + AGILITY - the Survivor
- **SECOND WIND** (Trick): instant heal + haste window + roll refund. Scales:
  heal %/rank, haste duration/rank.
- **MARATHON** (Stance): 6s: speed ramps every second, regen while moving,
  reaching full ramp releases a burst heal to the party. Scales: ramp/rank.
- **HOUDINI** (Strike... of escapes): vanish 1.2s: untargetable, shed every DoT
  and slow, reappear with i-frames and your next hit staggers. Scales: duration
  and stagger/rank. (The "strike" here is the exit hit - it aims.)

### 6. VIGOR + ARCANE - the Warden
- **ASCLEPIUS** (Strike): the serpent-staff pulse: heals the party in the ring,
  damages every enemy in the same ring. Scales: both ends/rank + rider.
- **TROLL BLOOD** (Stance): folklore regeneration, 8s: constant heavy regen that
  big hits briefly interrupt. Scales: regen/rank, interrupt window shrinks.
- **SANCTUARY** (Trick): consecrate a zone 5s: allies inside heal, enemies
  inside are slowed and take bonus spell damage. Scales: zone radius + slow/rank.

### 7. VIGOR + FORTUNE - the Treasurer
- **BLOOD MONEY** (Strike): nova scaled by your MISSING health; every enemy hit
  pays a coin bounty. Scales: conversion rate/rank, bounty cap.
- **FORT KNOX** (Stance): 6s: armor scales with gold held, immune to knockback.
  Scales: gold-to-armor rate/rank, capped.
- **GOLDEN FLEECE** (Trick): a shield that MINTS - every hit the shield eats
  pays out coins. Scales: charges/rank, payout capped (PVP-safe).

### 8. AGILITY + ARCANE - the Phantom
- **HERMES** (Strike): up to 3 chained blinks in 2s, each leaving a damaging
  afterimage. Scales: afterimage damage/rank, +1 blink at a rank threshold.
- **QUICKSILVER** (Stance): 5s: attacks and spells noticeably faster, echo
  chance doubled. Scales: haste/rank, +duration.
- **MIRAGE** (Trick): drop a decoy that taunts the room while you go briefly
  stealthed; the decoy detonates when it expires. Scales: decoy HP + blast/rank.

### 9. AGILITY + FORTUNE - the Gambler
- **HIGHWAYMAN** (Strike): dash through enemies, robbing coins from each and
  staggering them; damage grows per coin stolen this cast. Scales: steal/rank.
- **LUCKY STREAK** (Stance): 5s: every crit echoes and pays a coin; each kill
  ramps your crit chance for the window. Scales: ramp/rank, echo cap.
- **RABBIT'S FOOT** (Trick): 4s: dodge rolls are free and every enemy you roll
  through drops coins and is chilled. Scales: duration/rank, coin cap.

### 10. ARCANE + FORTUNE - the Alchemist
- **PHILOSOPHER'S STONE** (Strike): transmute - spend up to N held coins into a
  spell nova at damage-per-coin. Gold IS mana. Scales: N/rank, per-coin rate.
- **GOLD RUSH** (Stance): 6s: spell kills pay double coins and every coin picked
  up shaves your Q cooldown. Scales: shave rate/rank, capped.
- **ORACLE OF DELPHI** (Trick): reveal this room and the next on the minimap;
  enemies are MARKED 8s - marked enemies take bonus spell damage from the whole
  party. Scales: mark bonus/rank. (The co-op support pick.)

## Build order (proposed)

- Wave 1: the picker UI (reuses the ultimate's 3-choice screen) + power-rank
  plumbing + pairs 1, 5, 7 (Immovable / Survivor / Treasurer) - twelve... nine
  abilities, all on existing channels.
- Wave 2: pairs 2, 3, 8 (Tempest / Spellblade / Phantom) - needs the backward
  auto-shot, chain-lightning window, decoy entity.
- Wave 3: pairs 4, 6, 9, 10 + Prime pass + co-op sync review (dmg doctrine:
  attacker resolves, victim applies; decoy + marks ride keyframes).
- Each wave: dbg-harness numeric verify + a Sam/designer playtest before the next.

## Open for the walkthrough

1. Bless/rename the 30 (the designer gets veto - his game).
2. STRIKE/STANCE/TRICK as the trio rule: keep, or vary it for some pairs?
3. PVP: coin payouts capped in duel/hunt (listed per-ability above) - confirm.
4. Trinomials stay parked until binomials are proven in play.

---

## Appendix: v1 trinomial map (parked, unchanged)

HERACLES (M+V+A), GOLEM (M+V+Ar), GILGAMESH (M+V+F), VALKYRIE (M+A+Ar),
DRAKE (M+A+F), SOLOMON (M+Ar+F), PROTEUS (V+A+Ar), NINE LIVES (V+A+F),
AMBROSIA (V+Ar+F), WILL-O'-WISP (A+Ar+F). Earn-model options A/B/C from v1
also parked; revisit after the binomial waves ship.
