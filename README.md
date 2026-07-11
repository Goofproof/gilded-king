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
| Sound effects (all synthesized) | `js/audio.js` | `table` |

### Debug console
Open the browser dev console (F12) and use `dbg`:
`dbg.god()` invincibility · `dbg.give(4)` legendary weapon · `dbg.coins(500)` ·
`dbg.warp('boss')` jump to the boss · `dbg.lvl()` instant level-up ·
`dbg.state()` game state dump.

To wipe your save (essence + upgrades): `localStorage.removeItem('drl_meta')`.
