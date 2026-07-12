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

---

## Suggested order once you weigh in
1. **#46 stat web** (unblocks #30). I will first hand you a map of the current graph.
2. **#30 classes** (LIGHT scope) on top of the settled web.
3. **#49c utility spells** (independent of the above; Option 2 unless you redirect).
4. **#43 prestige** once the reset/reward rule is decided.
