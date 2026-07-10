# Roguelike Dungeon Crawler — Build Spec

Author of the game design: Sam's son (age 12). Build it faithfully to his prompt.
This file = his original prompt (verbatim, below the divider) + pre-agreed
resolutions for the gaps found in review, so the build never has to pause.

## Build environment (already verified working)
- Deliverable: single self-contained HTML file `index.html` in this folder.
- Playtest/verify loop: serve this folder with `python -m http.server 8471`
  (the Chrome extension cannot open file:// URLs, so always use the server),
  then drive http://localhost:8471/ with the claude-in-chrome tools.
  Screenshot + console-read loop confirmed working 2026-07-10.
- `connectivity-test.html` in this folder can be deleted once the game exists.

## Resolutions for the review gaps (build these without asking)
1. **Boss: design it as a surprise (Sam's call, 2026-07-10).** Build a full
   boss worthy of the rest of the spec: large distinct silhouette, its own
   boss-room intro moment (name banner + roar), a boss health bar across the
   top of the screen, and 2-3 clearly telegraphed attacks that each have a
   dodge answer (e.g. a charge you sidestep, a radial projectile burst you
   roll through with i-frames, an add-summon or slam phase below 50% HP that
   changes the rhythm). Keep the boss code well-commented and parameterized:
   the designer (Sam's son) may want to redesign it or add more bosses after
   he plays it, and that should be a retune, not a rewrite.
2. **Floors:** 3 floors per run. Stairs down appear when a floor's rooms are
   cleared. Boss room only on floor 3. Depth scaling = floor number drives
   monster count, toughness, and spawn tables.
3. **Starting loadout & weapon slots:** player always starts with a Common
   light melee. Two weapon slots: one melee, one bow. Toggle with Tab/scroll
   wheel or right-click. Picking up a weapon replaces the one in its slot
   (dropped weapon falls on the floor so the choice is reversible in-room).
4. **Healing:** monsters have a small chance to drop hearts; level-up restores
   a modest chunk of health; shop still sells the healing item.
5. **Sound:** synthesize all SFX with the Web Audio API (no assets): hit,
   pickup, roll whoosh, bow draw/release, mimic reveal sting, level-up,
   door unlock, boss roar. Simple generative/looped ambient tone acceptable.
   Include a mute key (M).
6. **End screens & pause:** death and victory screens with run stats (rooms
   cleared, kills, coins, level reached, floor) and a New Run button. P or Esc
   pauses.
7. **Meta-progression persistence:** localStorage.

Everything else ambiguous: follow the escape-hatch clause in his prompt — make
a sensible call, comment it, keep moving.

---

# ORIGINAL PROMPT (verbatim)

# Build Prompt: Roguelike Dungeon Crawler

Build a complete, playable, top-down roguelike dungeon crawler as a browser game. Implement every system below in full rather than stubbing pieces out. Where a requirement below is ambiguous, make a sensible design call, leave a short comment explaining it, and keep moving.

## Tech & Delivery
- Single self-contained HTML file (HTML/CSS/JS, Canvas rendering) — or a small set of files if cleaner — that runs by opening it in a browser. No build step, no install.
- Fixed internal resolution (e.g. 960×540) scaled to fit the window.
- No hand-drawn art assets are available, so render everything with Canvas primitives — circles, polygons, gradients, simple layered shapes for characters and monsters. Lean on animation, particles, and lighting for visual appeal rather than detailed textures.
- Comment the code so the dungeon generator, loot roller, and enchant tables are easy to retune later.

## Core Loop
A fixed top-down camera follows the player through a procedurally generated dungeon. Clear the monsters in a room to unlock its exits, collect coins and weapon drops, spend coins at the shop, and push toward the boss room. Dying, or beating the boss, ends the run; a new dungeon generates for the next attempt.

## Controls
- Move: WASD / arrow keys
- Attack: mouse click (or a bound key); direction comes from facing or cursor position
- Dodge roll: Space or Shift

## Dodge Roll — make this feel great, it's a headline mechanic
- A short burst of speed in the current facing direction, roughly 0.5–1s cooldown.
- Brief invincibility frames (i-frames) for the duration of the roll.
- Visual polish: squash-and-stretch on the sprite, a fading afterimage/motion-blur trail behind it, a slight rotation through the motion, and a small radial cooldown indicator near the player so the roll → attack rhythm is readable at a glance.

## Procedural Dungeon
- Graph or grid-based generation: 10–20 connected rooms per floor, always including an entrance room, several combat rooms, 1–2 treasure rooms, one shop room, and a boss room gated behind clearing the rest of the floor.
- Give each room type a distinct palette — combat rooms in cold stone tones, treasure rooms with gold accents, the shop warmly lit, the boss room darker and more ominous — so room type is readable at a glance.
- Doors lock during combat and unlock once every monster in the room is dead.
- Monster count and toughness scale with dungeon depth.

## Monsters
At least 8 visually distinct types, worked into the spawn tables by depth so early rooms feel manageable and later ones feel dangerous. Telegraph every attack visually (a windup animation or flash) so it's readable and dodgeable. Suggested roster:

- Chaser — basic melee, walks straight at the player.
- Archer — keeps its distance and backs away if the player closes in; fires arrows on a fixed cadence with a visible draw animation before each shot.
- Tank — slow, heavy melee hits, high health; a good testbed for the heavy weapon's stagger.
- Swarmer — fast, low health, shows up in packs and threatens through numbers rather than individual danger.
- Glass Cannon — very high damage, very low health (dies in 1–2 hits). Dangerous if it lands a hit, trivial if focused first — give it a distinct silhouette/color so players can prioritize it on sight.
- Shielded — blocks damage from the front; the player has to flank it or bait an attack to punish the opening.
- Bomber — rushes the player and detonates in a telegraphed AoE on death or contact; rewards kiting it into other enemies or retreating.
- Summoner — hangs back and periodically spawns 1–2 weak adds; a natural priority target.

## Mimics
Chests in treasure rooms have a small chance of being mimics instead of real loot. Make them visually near-identical to a normal chest, but give them one subtle, learnable tell — a faint shimmer, a slightly off color tint, a tiny idle twitch — so attentive players have a fair shot at spotting one. It should surprise on a first encounter without feeling like a cheap, unavoidable gotcha on repeat runs.
When the player gets close enough or interacts with it, it wakes up (legs/teeth burst out, a quick reveal animation) and attacks in melee. Reward the risk: a mimic should drop noticeably better loot than an average monster when killed.

## Weapons — three required archetypes

| Archetype | Speed | Damage | Hitbox | Feel |
|---|---|---|---|---|
| Heavy melee | Slow | High | Wide AoE arc around the player | Long, telegraphed windup |
| Light melee | Fast | Low per hit | Small, single-target | Rapid, combo-friendly swings |
| Bow | Medium | Medium | Ranged projectile | Draw/fire animation; an optional charged shot is a nice extra |

Optional, only if time allows: a balanced starter sword as a fourth, baseline weapon.

## Rarity & Loot Rolls
Every weapon drop rolls a rarity tier, then rolls its enchant slots against that tier's pool.

Suggested rarity weights (tune to taste): Common 50% · Uncommon 28% · Rare 15% · Epic 6% · Legendary 1%. Color-code them white/green/blue/purple/orange, the standard convention.

Enchant slots by rarity:
- Common: 0 slots
- Uncommon: 1 slot, minor-tier enchants only
- Rare: 1–2 slots
- Epic: 2–3 slots, unlocks the major-tier pool
- Legendary: 3 slots, at least one guaranteed signature-tier enchant

Within a slot roll, weight tiers roughly minor 55% · major 35% · signature 10%. Where it fits (Sharpness-style effects), let an enchant roll at a level (I/II/III), weighting higher levels rarer and gating them to higher-rarity weapons — this mirrors how Minecraft actually handles it.

## Enchantments
Bow pool: Flame (arrows ignite the target, burn damage over time), Piercing (arrow passes through multiple enemies), Power (flat damage up), Punch (knockback on hit), Multishot (fires 2–3 arrows in a spread — signature tier), Infinity (removes the ammo limit if you give bows one, or otherwise treat it as a big fire-rate boost — signature tier).

Melee pool: Fire Aspect (hits ignite the target), Sharpness (flat damage, levels I–III), Knockback, Sweeping Edge (bigger AoE radius — pairs well with the heavy weapon).

Universal: Looting (better coin/drop rate from kills). Feel free to invent one or two original enchants if they improve game feel — just make clear in comments that they're your own additions rather than Minecraft's.

## Coins & Shop
- Monsters and treasure rooms drop coins; keep a running total visible in the HUD.
- The shop room is always safe (no monsters) and sells a small rotating selection of pre-rolled weapons plus a basic healing item, priced by rarity. A "reroll stock for a fee" button is a nice optional touch.

## Progression — Getting Stronger
Two layers, so the player feels stronger both moment-to-moment and across attempts:

In-run leveling (primary): Killing monsters grants XP; treasure rooms and mimics grant bonus XP. On level-up, offer a choice of 2–3 random passive upgrades — small, stackable effects like +max health, +damage, +move speed, shorter roll cooldown, +crit chance, +coin drop rate. This is what should make a single run feel like a steady power climb, and it resets with the run.

Meta-progression (optional, if time allows): A small currency that survives death (a percentage of unspent coins, or a separate "essence" dropped only by tougher enemies) spent at the start/hub screen on permanent, small account-wide boosts — a bit more starting health, a starting weapon unlock, slightly better base drop rates. Keep these modest so runs still live or die on in-run choices, not just how many meta-upgrades are stacked.

## Minimap & Fog of War (top-right corner)
- A small fixed minimap in the top-right of the screen.
- Shows simplified shapes for rooms already visited, connected by lines for known doors, with the player's current room clearly highlighted.
- Anything not yet visited isn't drawn at all — full fog of war — and reveals the instant the player enters that room.

## HUD
Health bar, coin counter, current weapon icon (colored by rarity, with small enchant icons attached), and the minimap.

## Polish Pass
Screen shake on heavy hits, particle bursts on kills and impacts, a brief hit-stop freeze-frame on the heavy weapon's swing, and eased transitions on UI elements.

## Suggested Build Order
1. Canvas setup, game loop, player movement, camera, dodge roll.
2. Dungeon generation, room transitions, minimap + fog of war.
3. Core monster roster (Chaser, Archer, Tank, Swarmer), combat, and the three weapon archetypes.
4. Rarity rolls and the enchant system.
5. Coins and the shop.
6. Remaining monster variants (Glass Cannon, Shielded, Bomber, Summoner) and mimics.
7. In-run leveling/upgrades, plus meta-progression if you get to it.
8. Polish pass, balance, and a playtest pass to catch soft-locks (doors that never unlock, disconnected rooms, etc.).

## Definition of Done
- [ ] Procedural dungeon with multiple room types and different monsters per room
- [ ] At least 8 monster types, including Archer and Glass Cannon, telegraphed and readable
- [ ] Mimic chests that ambush the player, with a fair-but-subtle tell
- [ ] Top-down camera
- [ ] Polished dodge roll with i-frames
- [ ] Working shop that sells rolled weapons for coins
- [ ] Coin system with an HUD counter
- [ ] In-run leveling with passive upgrade choices on level-up
- [ ] (Optional) Meta-progression currency and permanent unlocks between runs
- [ ] Three weapon archetypes: slow AoE melee, fast low-damage melee, bow
- [ ] Rarity-gated enchant rolls on weapons
- [ ] Minecraft-inspired enchants (Flame, Multishot, Fire Aspect, etc.)
- [ ] Top-right minimap showing explored rooms
- [ ] Fog of war hiding unexplored space
