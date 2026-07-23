# Barrowlight build queue (from the 2026-07 competitive review + Sam's direction)

Ordered by fun-per-risk, theme-agnostic and settled first. Reframe (Sam, 2026-07-22):
the fun must NOT depend on knowing Dante. Bias to legible names + show-don't-tell.
Claude is grinding this via /loop. Ship each item, then check it off and log to DECISIONS-LOG.md.

## Buildable now (settled, mostly independent)
- [x] 1. FORTUNE -> loot luck. SHIPPED v2.200 (fortuneLuck() in spawnInstancedGear + chests). FAST-FOLLOW: make the effect visible (char-sheet FORTUNE description says "luckier loot"), currently invisible.
- [x] 2. Ultimate reroll. SHIPPED v2.201. REROLL button + R key, 3 per pick, excludes the current hand, touch-verified. NOTE: the deeper "ultimates don't feel good" is a separate balance/feel pass, still open.
- [ ] 3. Hit-stop on hits, SINGLE PLAYER ONLY. Local-render freeze on crit/kill; never gate updatePlay in co-op (freezes the host sim).
- [ ] 4. Legible "curses". Rare info-subtraction floor mutators: The Blind (pickup labels show ? until grabbed) + a no-minimap curse. Gate HP/minimap hides OFF on touch (reads as a bug on a phone).
- [ ] 5. Cross-status combo detonations. Flame+Frozen=shatter, Venom+Burn, Chain+Frozen. Scope to the 3 flags mobs actually carry; resolve in the host monster sim (like chainArc).
- [ ] 6. Gear sets. Hidden 3-item set bonuses spanning weapon/armor/trinket; small always-on mod + a cape-style aura. Pure per-player, no new RNG.
- [ ] 7. Rest sites. Campfire room (Purgatorio): pick heal OR forge; forge includes an EVOLUTION REROLL (Sam). Extend the encounters.js quest-occupant pattern.
- [ ] 8. Optional prestige-gated bonus doors. Shimmering side-door to a bonus room that only opens if the cape is grand enough. NEVER the main path (would wall new players / kids). Co-op: settle whose cape counts.

## Design-heavy: SPEC for the son, do not guess creative calls
- [ ] 9. Per-floor monster identity. Today all floors reuse the same 8-creature roster reweighted (monsters.js:1589). Highest-leverage legibility win. Needs new monster art/behavior per zone -> son's call.
- [ ] 10. Weapon MERGE (Sam's reshape of #7-review): merge two weapons into a new one with a new attack (gunblade = wand+rapier; magic RPG = staff+wand). Build the engine; son picks pairings/names (techno-magic naming travels).
- [ ] 11. Faction / pick-a-side (Sam's reshape of #8-review): choose an allegiance that changes enemies faced + boons received on the way down. Absorbs the difficulty-ladder idea.
- [ ] 12. Virgil-style narrator. DEMOTED by the reframe (kids skip text). At most a line or two, or fold into a character.
- [ ] 13. Daily seeded run. Needs a run-global seeded PRNG first (~223 Math.random calls today); larger refactor. Deferred.
