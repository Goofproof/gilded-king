# Stat Redesign - LOCKED DESIGN (Sam approved, 2026-07-12)

Supersedes the workflow's 3-school proposal. Sam locked FIVE base stats, each fed
by several distinct "skill" cards. Picking any of a stat's cards advances that ONE
stat; at 3/6/9/12 points the stat's evolution opens, drawn from the evolution trees
of the sub-stats it owns. Core ask: three different MIGHT picks in any order forge
the MIGHT evolution - never re-pick the same card. NO coin-magnet (coins auto-vacuum
at room clear, so magnet is a dead stat).

## The 5 base stats and their feeder cards

| Stat | Owns | Feeder cards (key -> effect) |
|---|---|---|
| **MIGHT** | kill fast | dmg (+10% dmg), crit (+6% crit), atkspd (+10% atk speed) |
| **VIGOR** | stay alive | hp (+15 HP), regen (+0.6/s), **bulwark** (+5% dmg reduction) NEW |
| **AGILITY** | nimble/evasion | spd (+7% move), roll (-12% roll cd), **reflexes** (+0.05s roll i-frames) NEW |
| **ARCANE** | spellcasting | magic (+1 Magic), **focus** (+15% spell power) NEW, **resonance** (+25 blast) NEW |
| **FORTUNE** | luck/economy | coin (+20% coins), **bounty** (elites drop +3 coins) NEW, **midas** (+1 dmg per 60 coins held) NEW |

New feeder effects all use engine-consumed fields (verified): reduce (player.js:446),
phantomStep (630), spellPower (857), blastBonus (884), eliteCoins (main.js:486),
midasPer/Cap (player.js:316/372). Applied via p.applyEvolution(card.fx).

## STAT -> evolution trees (in Evolutions.TABLE, unchanged)
- MIGHT -> dmg, crit, atkspd
- VIGOR -> hp, regen
- AGILITY -> spd, roll
- ARCANE -> magic
- FORTUNE -> coin

Evolution menu draws one option per owned tree (so you always see your flavors),
padded to 3. Chosen option carries `statKey` = its origin tree, so recordEvoPick /
R-fusion keep getting valid sub-stat keys (all 64 R shapes preserved).

## Wiring (files)
- **evolutions.js**: added STATS, STAT_TREES, STAT_COLOR, STAT_BLURB, optionsForStat. DONE.
- **main.js**: UPGRADE_POOL -> 15 cards each tagged `stat` (+ `fx` on the 6 new);
  applyUpgrade applies fx-or-switch, increments p.statPoints[stat], pushes
  {stat, stacks} to evoQueue at TIER_LABEL thresholds; evoQueue drain calls
  optionsForStat; applyEvolutionChoice uses opt.statKey.
- **player.js**: init this.statPoints = {} in constructor.
- **ui.js**: drawEvolution header uses stat + STAT_COLOR; drawLevelUp pips show
  statPoints[card.stat] progress + "STAT +1"; CS_SCHOOLS char sheet -> the 5 stats.
- **abilities.js**: add ACTIONS.magic + MODS.magic (fixes pre-existing "undefined"
  R-name bug when a magic evolution forges R).

## Pacing (Sam: ship then tune)
Thresholds stay 3/6/9/12. A focused stat evolves fast (its cards all count). Tune
after a few runs if it snowballs.

## Status
Foundation build in progress. Everything else on the list runs after (walls, worm,
lobber, formations+difficulty, barracks, 5 classes, bosses, R-picker, etc.).
