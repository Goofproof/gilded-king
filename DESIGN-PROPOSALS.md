# Design proposals (for Sam to steer)

These are the remaining backlog items that need a design decision before they can be
built safely. Sam asked not to build ambiguous, systems-level features blind. For each
one below: the open question, a few concrete options with tradeoffs, and my
recommendation. Pick an option (or redirect) and I will build it.

Written 2026-07-12, after the buildable backlog (#13, #20, #47, #48, #49a, #49b) shipped.

---

## #49c - Utility wand spells (teleport / time-freeze)

**The problem.** Damage spells auto-fire on the wand's normal attack. A blink or a
time-freeze cannot: auto-teleporting every 0.46s would be unplayable. So these are
ACTIVE abilities and need a trigger and a cost.

**Options**
1. **Reuse the ability slots (Q/R).** A utility wand grants a spell that binds to a
   currently-open ability key with its own cooldown. Pro: the HUD, tooltips, and
   cooldown UI already exist. Con: competes with the evolution-combo abilities Sam
   already built for Q/R; a magic build would have to choose.
2. **A dedicated cast key (e.g. F) that reads the equipped wand's "spellbook."**
   The wand carries 1 utility spell; press F to cast it, shared cooldown. Pro: keeps
   it separate from the evolution abilities; clean identity for wands. Con: one more
   key to teach; needs its own small HUD badge.
3. **"Utility wand" as a weapon subtype.** Some wands roll as utility (blink/freeze)
   instead of damage; their normal-attack IS the utility cast on a long cooldown,
   and they do little direct damage. Pro: no new key, fits the auto-attack model.
   Con: weird to auto-blink; hard to aim a freeze you did not ask for.

**Recommendation: Option 2** (dedicated cast key F, wand carries one utility spell).
It keeps utility distinct from the evolution abilities, is aimable and intentional,
and is the least likely to regress the existing Q/R system. Proposed first two spells:
- **Blink**: teleport ~180px toward the cursor, i-frames during the hop, ~6s cooldown.
- **Time-freeze**: freeze all monsters in the room for ~1.5s, ~14s cooldown.

Decisions I need from you: (a) key choice, (b) which two spells to ship first,
(c) cooldowns, (d) do utility spells scale with the Magic stat like damage now does.

---

## #46 - Stat-system rework (connected web + drill-down character sheet)

Your sketch: press C, the player goes invisible to mobs and a character sheet opens;
base stats on the main page; each stat is a button that drills into its evolution
paths. You said you want to design the "underlying web" together, so this is the one
I most want your input on before building.

**The open questions**
1. **What are the base stats, and how do they connect?** Today the stats are a flat
   list (dmg, crit, atkspd, hp, speed, roll, regen, coin, magic...). A "web" implies
   relationships (e.g. Magic feeds spell power AND unlocks wand tiers; Crit feeds
   Crit Damage; Attack Speed feeds Frenzy). I can draw the current implicit graph
   first so we are editing something real instead of a blank page.
2. **Drill-down content.** For each stat, what does its page show - the evolution
   thresholds and what each unlocks? A live "you are 3 levels from X" tracker (the
   char sheet already has a NEXT EVOLUTION bar we can expand)? The connected stats?
3. **Invisible-on-open.** Simple to add (a flag that makes monster AI ignore the
   player while the sheet is up). Confirm you want it to also PAUSE incoming
   projectiles/mines, or just stop new aggro.

**Recommendation for sequencing.** Let me first generate a one-page map of the
CURRENT stat graph (what feeds what, where the dead ends are). You react to that,
we settle the web, THEN I build the drill-down UI on top of the existing char sheet.
Building the UI before the graph is settled means rework.

---

## #30 - Base classes + per-level class trees

Big feature, and it overlaps #46 heavily: a class tree IS a constrained view of the
stat web. Building classes before the stat web is settled means redoing them.

**The open questions**
1. **How many classes, and what is their fantasy?** Obvious starting set given the
   current weapons: Warrior (heavy/light melee), Ranger (bow), Mage (wand/staff).
   A 4th (Rogue - crit/speed/roll) is natural. Confirm the roster.
2. **Class = starting kit, or a full per-level tree?** Two very different scopes:
   - LIGHT: a class picks your starting weapon, a stat bias, and one signature perk.
     Small, shippable, low regression risk.
   - HEAVY: each class has its own branching level-up tree replacing the current
     shared UPGRADE_POOL. Large; changes the core progression loop.
3. **Where is the class chosen?** Title screen before a run, or a floor-1 shrine?

**Recommendation: ship LIGHT first** (class = starting kit + stat bias + one perk),
after #46 settles the stat web. It delivers the "pick a class" feel quickly and we
can grow it into per-level trees once the web is locked. Sequence: #46 -> #30 LIGHT
-> (optional) #30 HEAVY trees.
> SHIPPED (#30 LIGHT, 2026-07-12): 5 classes on the home screen (Adventurer,
> Warrior, Ranger, Mage, Rogue), each a starting weapon + stat bias + one perk,
> persisted in meta.selectedClass. The HEAVY per-level class TREES remain the open
> follow-on - say the word and I'll build them on top of the settled stat web.

---

## #43 - Prestige system / dedicated page

You flagged prestige "may earn its own page." The page is the easy part; the SYSTEM
is undesigned. Building a page for an undefined system is premature.

**The open questions**
1. **What does prestige reset, and what does it grant?** Roguelite norm: reset the
   meta hub upgrades for a permanent multiplier (essence gain, starting stats, or a
   new currency tier). Which axis do you want prestige to push?
2. **What is the trigger?** After maxing the hub upgrades (the existing essence sink),
   or after a King kill count, or a floor-depth milestone?
3. **Page vs panel.** Does it need a full screen, or a panel on the existing title
   essence page (which #42 just moved left)?

**Recommendation.** Decide the RESET-and-REWARD rule first (one sentence: "prestige
resets X to grant permanent Y"). Once that exists the page is a small build. I can
draft 2-3 candidate rules if you want a starting point.
> SHIPPED (2026-07-12): Sam's rule - "spend/reset your WHOLE essence account (essence
> + all upgrade ranks) to gain +1 prestige level; the only reward is COSMETIC." Built
> as a home-screen button (two-click confirm, cost 500*(level+1)) and a royal cape on
> the champion that grows richer each prestige level. Purely cosmetic, no gameplay
> power. (My earlier "Crowns from winning + gameplay perks" idea was the wrong model.)

---

## Suggested order once you weigh in
1. **#46 stat web** (unblocks #30). I will first hand you a map of the current graph.
2. **#30 classes** (LIGHT scope) on top of the settled web.
3. **#49c utility spells** (independent of the above; Option 2 unless you redirect).
4. **#43 prestige** once the reset/reward rule is decided.

---

## LAYER 3 - Where the story goes after Hell (2026-07-14)

Layers 1 and 2 shipped in v2.15: the nine circles are nine real places, each with
its own rule, and floor mutators stack on top so the Descent never repeats. That
fixes the "nothing changes after floor 4" wall. It does NOT answer where the STORY
goes, and that is the designer's call, not mine.

**The arc so far.** Act I: the Mimic's trap castle (Forest -> Swamp -> Keep, the
Gilded King). Act II: the Inferno, nine circles, fire down to ice.

**The proposal: Dante already wrote the rest, so use it.** The Divine Comedy does
not end at the bottom of Hell. You climb through the centre of the earth and come
out at the foot of **Mount Purgatory**, and then you go UP - seven terraces, one
per deadly sin. After that, **Paradiso**: nine celestial spheres.

  Act III  PURGATORIO  seven terraces, ASCENDING. The game flips direction.
  Act IV   PARADISO    nine spheres of light. The enemies are angels.

**Why this is the strong option.** The direction flip is a real mechanic, not a
reskin: you stop descending and start CLIMBING, and the score stops being "how deep
did you get" and becomes "how high". It also finally pays off the Toad's running
joke - the princess is in another castle, and the last castle is at the TOP.
It is canonical and googleable, which satisfies the standing rule that names
reference real things.

**What it costs.** This is a real project, not an afternoon: a new art direction
(light, not fire), an ascending floor structure, and enemies that are not just
recoloured demons. The circle/rule/mutator machinery from v2.15 carries straight
over - a terrace is a circle with a different sign, mechanically - so the engine is
already built. It is the CONTENT that is the work.

**The open questions for the designer (the son):**
1. Do we climb at all, or does the Descent just keep going deeper forever?
2. If we climb: does the run continue (one long run, down then up), or is Purgatory
   a separate mode you unlock by reaching the bottom of Hell?
3. What is at the top? Dante's answer is Paradise. Ours could be the Mimic King
   again, waiting, having been the thing you were climbing toward all along.

---

## #12 - DESCENT SCALING off the player (2026-07-14)

**The ask.** "Once the descent starts, each floor should scale with the player's
stats to better match progression."

**What's already there.** Descent floors are NOT flat. `Descent.threat(f)` in
descent.js already scales every descent floor by DEPTH: monster HP is quadratic in
depth (`1 + 0.18d + 0.015d^2`), damage linear, speed and body-count climb, and the
elite chance rises with depth. This was deliberately steepened once already (comment
#126): "the player out-scaled deep floors (a mage was one-shotting the floor-9
boss)", so HP was made quadratic to "keep pace with a compounding build". So depth
is being used AS a proxy for player power, and it has been tuned by feel.

**Why this needs your call, not mine.** The ask is to scale off the player's actual
stats, not just depth. The danger is real and I cannot judge "feel" from a script:
scale too hard and you get a death spiral (the stronger you get, the tougher
everything gets, so upgrades feel worthless and a run that stalls becomes
unwinnable); scale too soft and it does nothing; and because depth ALREADY stands in
for player power, adding a second player-power term risks double-counting and
destabilising the curve that #126 already tuned. This is a systems-level balance
lever, exactly the kind you asked me not to guess at blind.

**Three concrete options (pick one, or redirect):**
1. **Gentle player-level term, capped (recommended).** Multiply threat HP/dmg by a
   small factor of how far the player's level is AHEAD of the floor's "expected"
   level, capped hard (say +/- 25%). If you are over-levelled the floor firms up a
   little; if under-levelled it eases. Self-correcting, hard to death-spiral because
   of the cap. Pro: matches progression without punishing upgrades. Con: needs an
   "expected level per floor" curve to measure against.
2. **Scale off equipped-weapon damage.** Read the player's real DPS (weapon dmg x
   attack speed x crit) and nudge monster HP so fights stay a target length. Pro:
   tracks the thing that actually trivialises floors (a hyper-honed weapon). Con:
   most invasive, can feel unfair ("I upgraded my sword and enemies got tankier"),
   and hardest to tune. This is the death-spiral risk in its purest form.
3. **Leave the depth curve, widen the ELITE pool instead.** Don't touch base
   scaling; instead make elites more common and more varied deep (new affixes:
   Warding, Vampiric, Splitting) so deep floors get more DANGEROUS-INTERESTING
   rather than just bigger numbers. Pro: safest, adds variety not just difficulty,
   no death-spiral. Con: does not literally "scale with your stats" - it scales with
   depth like today, just with more texture.

My lean: option 1 (self-correcting and capped) or option 3 (safest, most fun).
Option 2 is the riskiest and I would not ship it without you watching a playtest.

---

## #13 - TWIN PORTALS: a Nightmare path down the Descent (2026-07-14)

**The ask.** At the end of each descent floor, offer TWO portals: the normal next
floor, and a NIGHTMARE version that is much harder but much more rewarding.

**What's there now.** One `descentPortal` (a single one-way plunge). Taking it does
`g.floorNum++; startFloor()`. In co-op the host broadcasts `{t:'floor', floor,
seed}` so the whole party descends onto the SAME floor built from the shared seed.
A floor's character comes from `Descent.threat(floor)` (difficulty) plus
`Rules.forFloor(floor, seed)` (the circle rule + stacked MUTATORS from rules.js).

**Why this needs your call.** Two design forks I should not guess:
- **The co-op fork (the real blocker).** Today both players land on ONE shared
  floor. With two portals, if player A picks Normal and player B picks Nightmare,
  the shared floor diverges and co-op breaks. Someone has to decide the rule:
  (a) HOST chooses, guests follow; (b) a vote / both-must-stand-on-the-same-portal
  to commit; or (c) the party splits into two instances (a much bigger lift). This
  is a genuine multiplayer-design decision with real UX and code weight.
- **The balance fork.** "Much harder, much more rewarding" is a feel dial: how much
  harder (a threat multiplier? a guaranteed extra mutator? forced elites / an extra
  Warden?) and how much more rewarding (loot rarity x1.5? double gold/essence? a
  guaranteed mythic?). Wrong numbers make Nightmare either a no-brainer or a trap.

**The shippable plan I'd build once you steer it:**
- A `g.nightmare` flag set when you take the right-hand portal, synced in the co-op
  `floor` message (so it is part of the shared floor state, host-authoritative).
- Nightmare modifies the NEXT floor only: `Descent.threat` reads the flag and applies
  a multiplier (start ~1.35x HP/dmg), `Rules.forFloor` force-adds one extra mutator,
  and the elite chance floor is raised. Reward side: a loot-rarity + gold/essence
  multiplier on that floor, and a much higher mythic-drop chance from its Warden.
- Two portal sprites at the floor exit (left = calm blue, right = a violent red rift
  with a "NIGHTMARE - harder, richer" tag). Co-op rule per your answer above.

**The three questions for you:**
1. Co-op rule: host-chooses, party-vote, or split instances?
2. How much harder: threat multiplier value + forced extra mutator, or an extra
   Warden fight?
3. How much richer: the reward multiplier, and is a mythic guaranteed?

---

## BOSS RUSH ROOM - a fight-every-boss gauntlet (from a player)

**Where this came from.** A player named BENI sent it through the in-game feedback box
on 2026-07-21: "would be fun to add a boss rush room like the binding of isaac." Passing
it to you because you are the designer - this is a proposal, not something built yet.

**What a boss rush is.** In Binding of Isaac it is an optional room you can choose to
enter; inside, you fight a long line of the game's bosses back to back, and clearing it
pays out big. It is a skill flex and a loot faucet, and it is always OPT-IN, so it never
blocks a normal run.

**Why this one is mostly assembly, not new systems.** Barrowlight already has the hard
part built. Every boss is spun up by `Boss.make(opts)` from a variant (king / colossus /
matriarch) plus a skin and palette [boss.js:40-50], and there is already a deep named
roster to draw from: the nine Inferno guardians, CHARON, MINOS, CERBERUS, PLUTUS,
PHLEGYAS, MEDUSA, THE MINOTAUR, GERYON, LUCIFER [descent.js:162-170], and the climb's
guardians above that (THE ANGEL OF THE GATE, THE MARBLE PENITENT, and so on)
[descent.js:178-183]. Co-op already keeps a boss in sync across players over the `boss`
and `bossDead` net events, so a rush inherits multiplayer for free. So the build is:
a special room, a queue of `Boss.make` calls, and a reward at the end.

**The open questions (your call):**

1. **Where does it live?** Options:
   - (a) A rare special room, like the trap room or the mythic shop - a door you may or
     may not find on a given floor. Fits the roguelike "did you get lucky" feel.
     RECOMMENDED: it is opt-in by nature and reuses the room machinery that exists.
   - (b) An unlockable MODE from the title screen (fight all bosses, no dungeon between).
     A bigger, separate thing; more menu work, and it competes with a normal run.
   - (c) A secret room you earn (e.g. clear a floor with no damage). Cool, but hidden
     features get missed; better once (a) proves the mechanic is fun.

2. **Which bosses, and how many?** Options:
   - The bosses you have ALREADY beaten THIS run, replayed in order (a victory lap;
     scales naturally with how deep you are).
   - A fixed short line of 3-5 named guardians pulled from the roster above.
   - An endless ladder that keeps going until you die, for a high-score lane.
   RECOMMENDED to start: a fixed line of ~3, escalating, so it is beatable and testable.

3. **Do you heal between fights?** Full heal (pure skill check), a small heal (endurance
   matters), or none (brutal)? RECOMMENDED: a small heal + a few seconds of breather
   between bosses, so a good run is rewarded but one mistake is not the end.

4. **What is the reward?** A guaranteed mythic at the end? Loot from every boss? A big
   gold/essence payout? A cosmetic you can only get here? RECOMMENDED: a guaranteed
   high-rarity drop at the end plus each boss's normal loot, so the risk pays.

5. **Difficulty.** Fight each boss at its native strength, or scale them all to your
   current depth so it stays a real threat late? RECOMMENDED: scale to current depth,
   reusing the existing `Descent.threat` curve, so it never turns trivial.

**The name is yours.** BENI called it a "boss rush"; you may want a Barrowlight name that
fits the Divine Comedy frame (something like an arena or a trial). Naming is a designer
call, so I left it open.

**My lean:** ship the smallest fun version first - a rare optional door (1a), a fixed line
of 3 escalating named bosses (2), a small heal between (3), a guaranteed mythic at the end
(4), scaled to depth (5). It reuses `Boss.make` and the existing co-op boss sync, so it is
low-risk, and we can grow it into an endless ladder or a title-screen mode once your son
says it is fun. Say the word and I build that version.

---

## GEAR SETS - collect 3 matching pieces for a bonus (engine ready, needs your set picks)

**Status.** Sam greenlit this (competitive review, 2026-07). The ENGINE is easy and I can
build it; what needs YOU (the designer) is the CONTENT: which items belong to which set,
and what each set does. I did not want to invent that blind, so here is the plan and a
data format - pick the sets and I build it.

**The idea (from Binding of Isaac transformations).** Some items secretly belong to a SET.
Equip all the pieces of one set at once and a named bonus fires - a small always-on power
plus a cosmetic aura (drawn like the prestige cape). Mediocre drops become steps toward a
set, so loot you would have scrapped is suddenly worth keeping.

**The one real constraint.** You equip ONE weapon, ONE armor, and ONE trinket at a time,
so a 3-piece set is exactly {a weapon} + {an armor} + {a trinket}. It cannot be three
trinkets. Sets should be built from IDENTIFIABLE items - the named mythic weapons
(`MYTHIC_WEAPONS`, weapons.js:301), named mythic armor (`MYTHIC_ARMOR`, weapons.js:334),
and the 19 named trinkets (trinkets.js). Regular rolled gear has no stable identity to tag.

**What I build (the engine, no creative guessing):**
- A `set` tag on the chosen items (e.g. `set: 'ember'`).
- Detection each frame: if equipped weapon.set === armor.set === trinket.set, the set is
  complete. A new `setMods` bucket added to `player.mod()` (player.js:1137) so the bonus
  composes with everything else; flag-type bonuses (revive, reveal) wire like the existing
  trinket flags.
- A cosmetic aura reusing the cape renderer `capeAt()` (player.js:378).
- "2 of 3" progress via the achievements toast pipeline (achievements.js:211-212), extended
  to show partial progress (today it only toasts binary unlocks).
- Pure function of YOUR OWN equipped items - no new RNG, computed client-side, zero co-op
  sync surface, so it is multiplayer-safe by construction.

**What I need from you - pick 2-3 starter sets. Format per set:**
`{ name, weapon, armor, trinket, bonus, aura-color }`. Some candidate shapes to react to
(rename freely - legible names travel better than deep cuts):
- **The Ember Set** - a fire weapon + fire armor + a fire trinket -> burning enemies take
  extra damage from you (leans into the new SHATTER/COMBUST combos).
- **The Swift Set** - a fast weapon + light armor + a speed trinket -> +move speed and
  dash cooldown.
- **The Miser's Set** - a coin weapon + coin armor + Splinter of Midas trinket -> big
  coin/luck boost (pairs with the new FORTUNE loot-luck).

Tell me the item bindings and the bonus for each, and I build the whole thing. Keep the
bonuses modest (this is a bonus for a lucky loadout, not a required build).

---

## REST SITES + PRESTIGE DOORS - buildable, but they touch co-op generation (build together)

These two are ready to build, but unlike the five features already shipped (FORTUNE luck,
ult reroll, hit-stop, curses, element combos - all co-op-safe by construction), they BOTH
modify dungeon/room generation, which is the co-op-determinism-critical path. Per the
project's own hard-won rule, co-op parity bugs are only reliably caught by two real people
playing together - so these want a live 2-player playtest before shipping, not a solo
autonomous ship. Handing them to you at that gate.

### REST SITES (item 7, Slay-the-Spire campfire)
- **Design:** a rare non-combat room; walk up + E opens a 2-button panel (reuse the offer
  panel, already mobile-proven): REST (heal ~30% max HP) or FORGE (+1 hone on your weapon,
  reusing honeWeapon() main.js:~942 / the U-key path). Both actions are per-player-safe.
- **Placement (the co-op-sensitive part):** the occupant must be placed in generateFloor
  with the SEEDED stream like encounters (dungeon.js:466-476). SAFEST approach: place it via
  a hash of (seed, floorNum) - like rollMutators does - so it does NOT consume from the
  `rnd()` stream and therefore cannot shift the pet/encounter/doppel placements or break the
  pet-determinism test (dungeon.test.js). Verify: `npm test` stays green AND a live co-op run
  shows both players seeing the rest site in the same room.
- **The EVOLUTION REROLL you asked for: deferred as risky.** There is no reroll/unapply code
  for evolutions, and evolutions apply PERMANENT stat mods via apply() - reversing one blind
  can corrupt a build. It needs its own careful design (track each evolution's exact stat
  delta so it can be cleanly undone, then re-offer). Worth doing, but not to be built
  unsupervised. Recommend: ship REST/FORGE first, add the evo-reroll as a focused follow-up.

### PRESTIGE-GATED BONUS DOORS (item 8, your idea - reshaped)
- **Design (per our discussion):** an OPTIONAL shimmering side-door that only opens if your
  cape is grand enough (prestige level >= N), leading to a bonus vault / hard challenge room.
  NEVER the main path down (that would wall new players and kids, and prestige is
  cosmetic-only by your son's ruling - DESIGN-PROPOSALS.md:114).
- **Co-op question to settle first:** whose cape counts? Options: (a) the highest prestige in
  the party opens it for everyone, (b) each player sees their own gated doors. (a) is simpler
  and more generous; (b) needs per-player door state. Pick one before building.
- **Co-op-sensitive part:** the door/room must be placed deterministically (same hash
  approach as rest sites) so peers agree it exists; the OPEN condition (prestige check) is a
  per-player value, so decide the party rule above.
