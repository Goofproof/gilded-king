# FUSION ABILITIES - binomials & trinomials (design map, NOT built)

Status: PROPOSAL for Sam + the designer, 2026-07-16. Asked for as "we need to talk
about Fusion abilities and map out the binomials/trinomials." Nothing here is code
yet - this is the menu to pick from.

## What already exists (verified in js/abilities.js)

The game ALREADY has a binomial fusion and nobody calls it that: the R ability.
Your first evolution pick chooses an ACTION (9 of them: Bulwark/Cleave/Blink/
Vault/Execute/Coin Storm/Bloom/Overclock/Arcane Surge), your second pick chooses
a MODIFIER (9 tags: Aegis/Savage/Swift/Phantom/Lethal/Gilded/Vital/Frenzied/
Arcane) = up to 81 combos, same-stat twice = a "Prime" amplified version. The
ultimate then lets you pick a supercharged Q, supercharged R, or the FUSION
CATACLYSM of both. That machinery (build(), MODS.apply, describe()) is the
foundation - fusions below ride it, no new engine.

The proposal: name and map fusions at the BASE-STAT level (MIGHT / VIGOR /
AGILITY / ARCANE / FORTUNE - the five rings), because that is the language the
game speaks since the stat redesign, and it is the language the Q rank system
already rewards.

## The Binomials - 10 pairs (+5 same-stat Primes already covered)

Every name references a real thing (Sam's rule). Mechanics reuse existing
channels: nova / dash / strike / buff / heal kinds, castShield, rage, haste,
iframes, coinBurst, thorns, echo.

| # | Pair | Name | What it does (sketch) |
|---|------|------|----------------------|
| 1 | MIGHT+VIGOR | ATLAS | Ground slam (big nova) that also grants the party a shield charge. The titan holds; so do you. |
| 2 | MIGHT+AGILITY | TYPHOON | Dash that drags a whirlwind of blades: damage along the path, then a burst at the exit point. |
| 3 | MIGHT+ARCANE | EXCALIBUR | One colossal sword-of-light strike: crits guaranteed, damage scales with both MIGHT and spell power. |
| 4 | MIGHT+FORTUNE | CROESUS | A strike that hits harder the richer you are (Midas channel, higher cap) and knocks coins out of whatever survives. |
| 5 | VIGOR+AGILITY | SECOND WIND | Instant heal + haste window + roll refund. The escape button. |
| 6 | VIGOR+ARCANE | ASCLEPIUS | A healing ward pulse: heals the party in radius, damages enemies in the same ring (the serpent staff cuts both ways). |
| 7 | VIGOR+FORTUNE | GOLDEN FLEECE | A shield that MINTS: every hit the shield eats pays out coins. Tanking becomes an economy. |
| 8 | AGILITY+ARCANE | HERMES | Blink that chains: up to 3 short teleports in 2s, each leaving a damaging afterimage (echo channel). |
| 9 | AGILITY+FORTUNE | RABBIT'S FOOT | For 4s every dodge roll is free (no cd) and every enemy you roll through drops coins. |
| 10 | ARCANE+FORTUNE | PHILOSOPHER'S STONE | Transmute: spend up to N coins, convert to a spell nova at 1 damage per coin (capped). Gold IS mana. |

## The Trinomials - 10 triples (ultimate-tier)

Bigger, longer cooldown, meant to feel like a run-defining identity.

| # | Triple | Name | What it does (sketch) |
|---|--------|------|----------------------|
| 1 | MIGHT+VIGOR+AGILITY | HERACLES | The physical trinity: 6s of rage + haste + damage reduction, melee swings cleave the whole arc. Twelve labors energy. |
| 2 | MIGHT+VIGOR+ARCANE | GOLEM | Stoneform 5s: half damage taken, heavy thorns, then the shell EXPLODES as a nova scaled by damage absorbed. |
| 3 | MIGHT+VIGOR+FORTUNE | GILGAMESH | The king stands: shield charges, rage, and every kill during the window pays double coins + heals. |
| 4 | MIGHT+AGILITY+ARCANE | VALKYRIE | Choose the slain: mark up to 4 enemies, teleport-strike each in sequence, crits all. |
| 5 | MIGHT+AGILITY+FORTUNE | DRAKE | The privateer's raid: dash through enemies, each one hit is robbed (coins) and staggered; damage scales with loot stolen this cast. |
| 6 | MIGHT+ARCANE+FORTUNE | SOLOMON | Wisdom, wealth, power: one giant seal on the floor - enemies inside take %-max-HP damage (the Q-rider channel), coins fountain per kill. |
| 7 | VIGOR+AGILITY+ARCANE | PROTEUS | Shapeless for 4s: untargetable between your own attacks, constant regen, each attack from stealth echoes. |
| 8 | VIGOR+AGILITY+FORTUNE | NINE LIVES | Passive-until-it-isn't: for 8s, lethal damage instead leaves you at 1 HP, refunds your roll, and pays a coin burst. Once per cast. |
| 9 | VIGOR+ARCANE+FORTUNE | AMBROSIA | The feast: party-wide heal over time + spell power + coin rain. The support trinomial. |
| 10 | AGILITY+ARCANE+FORTUNE | WILL-O'-WISP | Become the wisp 5s: massive speed, pass through enemies, each pass-through chills and drops a coin - touch nothing, take nothing. |

## How you EARN them - three options (pick one)

- **A. Ultimate replacement.** When your third-highest base stat crosses a
  threshold (say 6 points), your ultimate offer becomes the matching trinomial
  instead of the generic supercharge. Zero new UI, late-run payoff.
- **B. R evolves in place.** R starts as today's binomial; when a third distinct
  stat completes an evolution tier, R upgrades to the trinomial of your top three
  stats. One button, visible growth arc. (Recommended: it keeps the existing
  first-two-picks moment AND gives evolution #3 a reason to diversify.)
- **C. A fourth slot.** New key (F?) unlocked at prestige 1+. Most work, most
  clutter - listed for completeness, not recommended.

## Open questions for the designers

1. Base-stat pairs (this map) vs today's fine-grained card pairs - keep both?
   Proposal: fine-grained keeps choosing the R FLAVOR, base-stat totals choose
   WHICH named fusion you qualify for.
2. Do trinomials respect the Q rank system's ruling stat (bonus if your class's
   ruling stat is in the triple)?
3. PVP: DRAKE and PHILOSOPHER'S STONE touch coins - fine in co-op, check the
   duel/hunt economy before enabling there.
4. Which 3-4 binomials ship first as the pilot wave? (Suggest: ATLAS, SECOND
   WIND, GOLDEN FLEECE, PHILOSOPHER'S STONE - all four ride existing channels
   end to end.)
