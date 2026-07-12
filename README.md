# Dungeon of the Gilded King

A top-down roguelike dungeon crawler. Designed by the boss himself; built with Claude.

## How to play

**Easiest:** double-click `index.html`. It runs straight off the disk in any browser.

**If the browser complains** (some setups block local scripts), serve it instead:

```
cd dungeon-crawler
python -m http.server 8471
```

then open http://localhost:8471/

### Controls

| Key | Action |
|---|---|
| WASD / arrows | move |
| mouse | aim |
| left click / J | attack (hold to draw the bow) |
| SPACE / Shift | dodge roll (i-frames!) |
| E | open chests, buy, pick up weapons, stairs, portals |
| Tab / right-click / wheel | swap between your two weapon slots (any mix) |
| F | toggle auto-attack (aims and swings at the nearest enemy) |
| X | salvage a dropped weapon/armor into shards |
| U | spend shards to hone your weapon (+8% dmg, 5x max) |
| R | reroll level-up choices (once per level-up) |
| A/D · SPACE | on a level-up/evolution: move the selection and pick it (mouse and 1/2/3 still work) |
| P / Esc | pause |
| M | mute |

Stack the same level-up pick to 3/6/9/12 and it EVOLVES - every evolution is
named after something real (Kleptoplasty, Tachypsychia, Mithridatism...);
google the weird ones. Armor drops with the same rarity rules as weapons.
Each floor has its own music and an apex predator you'll hear but never see.

Three floors, three places: the Whispering Forest, the Sunken Swamp, and the
Gilded Keep - each with its own look and soundscape. Clear a floor and a portal
opens straight to the stairs. High scores (essence banked in a single run) live
on the title screen - arcade rules, three initials, no mercy.

### The run
Clear rooms, collect coins, spend them at the shop, level up and pick upgrades.
Three floors down, the Gilded King is waiting - who or what he is, you'll find
out when the doors seal behind you. Every attack in the game is telegraphed -
if you died, there was a tell you missed. Watch treasure chests closely; some
of them are watching you back.

Essence (purple diamonds) survives death - spend it on the title screen for
permanent boosts.

### The Descent (endless mode)
Slay the Gilded King and the run doesn't end - a portal to **The Descent** opens
("THE PRINCESS IS IN ANOTHER CASTLE!") and you plunge into an endless fall through
the circles of hell. It only gets harder: monster stats climb every floor, **elites**
appear (giant / swift / volatile, marked by a glowing ring), and a recurring boss -
the King, recolored and angrier each time - guards every third floor (a "Circle
Warden"). Each Warden you fell shows a Toad line that gets more twisted the deeper
you go. The run ends when you die; how deep you got is the score.

Deeper rewards:
- **Mythics** - 20 named unique weapons and 10 unique armors, a rarity above
  legendary. They NEVER drop by chance: only a Circle Warden drops one, or the
  **secret mythic shop** that opens every 5th floor sells them. Claim one and you
  earn a **laurel** on the title screen (X of 30 collected, saved forever).
- **Pets** - a Warden may drop a little companion that follows you and grants a
  passive buff (damage, speed, regen, coins, or crit). One at a time.
- **Mercenaries** - a blade or archer sometimes waits at a floor's gate. Hire up
  to two (they cost coins) and they fight alongside you the rest of the run.

The title-screen leaderboard shows the **top 5 raiders** at all times; beat the
top 10 and you enter your initials, arcade-style.

## For the designer: where the tuning knobs live

Every table was built to be retuned. Change numbers, refresh the browser, play.

| What | File | Table |
|---|---|---|
| Rarity weights, enchant slots per rarity | `js/weapons.js` | `RARITY` |
| Enchant list (add your own!) | `js/weapons.js` | `ENCHANTS` |
| Weapon feel (damage, speed, arc, windup) | `js/weapons.js` | `ARCHETYPES` |
| Monster stats | `js/monsters.js` | `BASE` |
| Which monsters appear at which depth | `js/monsters.js` | `SPAWN_TABLE` |
| Rooms per floor, mimic chance, palettes | `js/dungeon.js` | top of file |
| Boss health and attacks | `js/boss.js` | `STATS` + the FIGHT SCRIPT comment |
| Player speed, roll cooldown, i-frames | `js/player.js` | `T` |
| Level-up upgrade pool | `js/main.js` | `UPGRADE_POOL` |
| Meta (hub) upgrades and costs | `js/ui.js` | `META_UPGRADES` |
| The Descent: scaling, elites, boss cadence, circle names, Toad lines, pets, drop rates | `js/descent.js` | top of file |
| Mythic weapons + armor (the 30 uniques) | `js/weapons.js` | `MYTHIC_WEAPONS` / `MYTHIC_ARMOR` |
| Mercenary stats (blade / archer) | `js/main.js` | `MERC_STATS` |
| Seed leaderboard (the 50 starting scores) | `js/main.js` | `SEED_SCORES` |
| Sound effects (all synthesized) | `js/audio.js` | `table` |

### Debug console
Open the browser dev console (F12) and use `dbg`:
`dbg.god()` invincibility · `dbg.give(4)` legendary weapon · `dbg.coins(500)` ·
`dbg.warp('boss')` jump to the boss · `dbg.lvl()` instant level-up ·
`dbg.state()` game state dump.

To wipe your save (essence + upgrades): `localStorage.removeItem('drl_meta')`.
