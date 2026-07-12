# Current stat graph (map of what exists today)

Extracted from the live code (js/main.js UPGRADE_POOL, js/evolutions.js TABLE,
js/player.js mod system) on 2026-07-12, as the starting point for the #46 stat-web
rework. This is the REAL current state, not a proposal. Read this, then we edit it
together into the connected web you want.

There is no invented content here. Every number is from the source.

---

## 1. The base stats (level-up picks, the UPGRADE_POOL)

Nine picks. Each level-up offers 3 of them; picking one adds a "stack" of that stat.

| Pick | Stat key | Per-pick effect |
|------|----------|-----------------|
| Tough | hp | +15 max health, heal 15 |
| Brutal | dmg | +10% damage |
| Fleet | spd | +7% move speed |
| Acrobat | roll | -12% roll cooldown |
| Deadly | crit | +6% crit chance |
| Greedy | coin | +20% coins from kills |
| Mending | regen | +0.6 HP/s regen |
| Frenzy | atkspd | +10% attack speed |
| Attunement | magic | +1 Magic (wield stronger wands/staffs; now also +8%/pt spell damage) |

## 2. The evolution ladder (the reward for stacking)

Stack the SAME pick to 3 / 6 / 9 / 12 and you choose 1 of 3 themed evolutions at
that tier (Tier I / II / III / IV). Eight of the nine stats have a full 4-tier tree.

**THE GAP: `magic` (Attunement) has NO evolution tree.** It is the only stat that
stacks with no evolutions behind it. Decision for #46: give Magic its own tree
(spell-power / mana / elemental themes) or fold it into the web differently.
> RESOLVED (#46b, 2026-07-12): Magic now has a full 4-tier ARCANE tree (Spell
> Power / Elemental Reach / Cast Tempo), and the C sheet groups all nine stats into
> the three schools with a clickable per-stat drill-down. This map is now built,
> not just proposed. Remaining open items are the design questions in section 4.

The three branches per stat are thematically distinct sub-paths. Summarized by the
mechanic each branch pushes (full names/numbers in js/evolutions.js):

- **regen (Mending)**: [missing-health healing] / [lifesteal on nearby kills] / [flat regen]. Tier IV can grant a second life (Lazarus Taxon).
- **hp (Tough)**: [damage reduction] / [thorns + retaliation nova] / [+max health %]. Reduce is hard-capped at 60% total in player.damage.
- **dmg (Brutal)**: [conditional damage: wounded/full-hp/boss/low-hp-you] / [flat +damage%] / [hybrids that also grant speed].
- **spd (Fleet)**: [roll speed-burst] / [flat +move%] / [pickup magnet] / [roll i-frames].
- **roll (Acrobat)**: [roll i-frames] / [kills refund roll cd] / [roll-through damage (rollNova)] / [flat -roll cd].
- **crit (Deadly)**: [crit chance] / [crit damage] / [crit heal] / [crit bleed].
- **coin (Greedy)**: [magnet range] / [elite bonus coins] / [Midas: damage per coin held].
- **atkspd (Frenzy)**: [flat +atkspeed%] / [frenzy stacks: hits build atkspeed] / [echo: light-melee double-strike].

## 3. The connective web (where stats already cross into each other)

This is the interesting part for #46. The stats are NOT siloed today. Existing
cross-links, all live in code:

- **dmg -> spd**: Cursorial Hunter (dmg III) grants +14% move speed; Trophic
  Cascade and others hybridize.
- **spd <-> roll**: both feed roll i-frames (phantomStep), roll speed-burst
  (windWake), and roll-through damage (rollNova). These two trees heavily overlap.
- **hp -> offense**: thorns and retaliateNova turn a defense stat into contact
  damage. Crumple Zone (roll I) and Tardigrade (regen II) ALSO grant damage
  reduction, so "reduce" is spread across hp/roll/regen.
- **crit -> regen**: critHeal and critBleed(+heal) make the crit tree a sustain
  tree too.
- **coin -> dmg**: Midas Metacarpals line converts coins-held into flat damage.
  Greedy is secretly a damage stat if you hoard.
- **atkspd -> magic/bow**: attack speed also charges the bow DRAW and the staff
  CAST (js/player.js), so Frenzy speeds up ranged/magic, not just melee.
- **magic -> spell damage** (new this session): Magic now scales wand/staff damage
  +8%/point, and gates which magic weapons you can wield (magicReq).

### Derived systems that read the evolution picks
- **Q ability** = fusion of your FIRST TWO evolutions (js/abilities.js).
- **R ability** = fusion of your 3rd + 4th evolutions.
- **Ultimate** (left-click) = a chosen fusion of Q + R.
So the ORDER you evolve in, not just which, shapes your two active powers. Any
stat-web redesign has to keep feeding this ability-fusion system.

### Visual evolution
Your champion's body parts/colors are driven by your STRONGEST evolution path
(EVO_PAL in player.js: horns=dmg, wings=spd, claws=crit, pauldrons=hp, crown=coin,
halo=regen, blades=atkspd, cape=roll, and magic=violet). Another consumer of the
graph that a redesign must keep fed.

## 4. Open questions for the #46 design session

1. **Magic's missing tree.** Biggest gap. Does Magic get a 4-tier tree like the
   others, and what are its three branches (raw spell power / elemental mastery /
   mana-or-cooldown utility)?
2. **spd vs roll overlap.** They share so many effects (i-frames, windWake,
   rollNova) they read as one stat split in two. Merge, or sharpen the distinction?
   > RESOLVED (2026-07-12): sharpened, not merged. phantomStep (roll i-frames) and
   > rollNova (roll-through damage) are now exclusive to ACROBAT. FLEET became pure
   > movement: raw speed / slipstream (windWake) / a magnet+coin economy line that is
   > its FLOW bridge. The two trees now share zero fx keys.
3. **Hidden damage stats.** hp (thorns/nova) and coin (Midas) quietly deal damage.
   Is that the intended "web," or should the sheet make those cross-links explicit
   so the player can plan them?
4. **What the drill-down page shows.** Given the above, each stat's page could show:
   its 4 tiers, the three branches, AND arrows to the stats it feeds / is fed by.
   The cross-links above are the raw material for those arrows.
5. **Invisible-on-open.** Confirm scope (stop new aggro only, or also freeze
   projectiles/mines while the sheet is up).

When you have reactions to this, I will build the drill-down character sheet on top
of the existing NEXT-EVOLUTION tracker, wiring the cross-link arrows from section 3.
