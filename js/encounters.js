// ============================================================================
// encounters.js - RANDOM QUEST ENCOUNTERS (Sam's request, 2026-07-14).
//
// Somebody is standing in a room, and they want something. Walk up, press E, and
// they make you an offer. Accept and you carry an OBJECTIVE for the rest of the
// floor; finish it before you take the stairs and you get paid.
//
// The point is that every one of these is a CHOICE WITH A PRICE, not a free
// handout. The Pact makes the floor genuinely harder in exchange for a mythic. The
// Vow pays well and is void the instant anything touches you. Declining is always
// allowed and always free - the encounter simply leaves.
//
// DETERMINISM: which encounter appears, and where, is rolled inside
// Dungeon.generateFloor() with the SEEDED rng - so a co-op host and guest see the
// same stranger in the same room. Whether you ACCEPT is a live player decision and
// is broadcast like any other action (host-authoritative, same as everything else).
//
// A QUEST:
//   key, name, who      - identity, and who is making the offer
//   pitch               - what they say to you
//   terms               - the deal, in one line, in the player's language
//   reward              - what you get, in one line
//   accept(g)           - fires once, when you take the deal
//   objective(g)        - the live progress line for the HUD
//   done(g)             - true when you have earned it
//   failed(g)           - true when you have blown it (optional)
//   pay(g)              - hand over the reward
// ============================================================================
const Encounters = (() => {

  // ---- reward helpers --------------------------------------------------------
  function giveWeapon(g, opts) {
    const tier = Monsters.tierFor(g.floorNum, (g.room && g.room.dist) || 3);
    const w = Weapons.rollWeapon(tier, opts || {});
    g.pickups.push({ kind: 'weapon', weapon: w, x: g.player.x, y: g.player.y + 40, t: 0 });
    return Weapons.displayName(w);
  }
  // Mythics are hand-authored uniques, NOT a rarity tier - there is a dedicated
  // roller for them, and asking rollWeapon for a rarity above the table just throws.
  // Excludes the ones you already own, exactly like the mythic shop does.
  function giveMythic(g) {
    const tier = Monsters.tierFor(g.floorNum, (g.room && g.room.dist) || 3);
    const item = Weapons.rollMythic(undefined, { exclude: (g.meta && g.meta.mythics) || [], tier });
    if (item.isArmor) g.pickups.push({ kind: 'armorItem', armor: item, x: g.player.x - 40, y: g.player.y + 40, t: 0 });
    else g.pickups.push({ kind: 'weapon', weapon: item, x: g.player.x, y: g.player.y + 40, t: 0 });
    if (g.mythicFanfare) g.mythicFanfare(g.player.x, g.player.y, item); // the full celebration
    return Weapons.displayName(item);
  }
  function giveCoins(g, n) {
    for (let i = 0; i < n; i++) spawnPickupSafe(g, 'coin', g.player.x, g.player.y);
    return `${n} gold`;
  }
  // main.js owns spawnPickup; encounters.js loads before it, so go through g
  function spawnPickupSafe(g, kind, x, y) { if (g.spawnPickup) g.spawnPickup(kind, x, y, true); }

  const QUESTS = [
    // ---------------------------------------------------------------------------
    {
      key: 'pact', name: 'THE PACT', who: 'a hooded figure, patient',
      pitch: 'I can make this floor worse for you. You will be paid for it.',
      terms: 'The floor takes on one more RULE, right now. Clear it anyway.',
      reward: 'A MYTHIC weapon.',
      // reuses the layer-2 mutator engine wholesale: the stranger simply adds one
      // more rule to the floor you are standing on. This is the mutator system made
      // OPT-IN, which is what it was always for.
      accept(g) {
        const pool = Rules.MUTATORS.filter(m => !g.rules.list.some(r => r.key === m.key));
        const pick = pool[(g.questRoll * pool.length) | 0] || pool[0];
        if (!pick) return;
        g.rules.list.push(pick);
        // re-merge the numeric fields so the new rule actually bites immediately
        Rules.remerge(g.rules);
        g.pactRule = pick;
        g.floorRule = { lines: g.rules.list.map(r => ({ name: r.name, desc: r.desc, color: r.color })), t: 5.0 };
      },
      objective: g => `THE PACT: clear the floor under ${g.pactRule ? g.pactRule.name : 'the rule'}`,
      done: g => Dungeon.uncleared(g.dungeon) === 0,
      pay(g) { return giveMythic(g); },
    },
    // ---------------------------------------------------------------------------
    {
      key: 'vow', name: 'THE VOW', who: 'a knight, kneeling, who will not rise',
      pitch: 'I broke my vow on this floor. Keep yours where I could not.',
      terms: 'Clear this floor WITHOUT BEING HIT. One hit and the vow is broken.',
      reward: 'A heavy purse, and a fine weapon.',
      accept(g) { g.vowIntact = true; },
      objective: g => g.vowIntact ? 'THE VOW: unbroken. do not get hit.' : 'THE VOW: BROKEN.',
      done: g => g.vowIntact && Dungeon.uncleared(g.dungeon) === 0,
      failed: g => !g.vowIntact,
      pay(g) { giveCoins(g, 90); return giveWeapon(g, { minRarity: 3, luck: 0.8 }) + ' and 90 gold'; },
    },
    // ---------------------------------------------------------------------------
    {
      key: 'hunt', name: 'THE HUNT', who: 'a hunter, counting on her fingers',
      pitch: 'There is a bounty on this floor, and I am too old to collect it.',
      terms: 'Slay 12 of them before you take the stairs.',
      reward: 'Gold, and something worth carrying.',
      accept(g) { g.huntKills = 0; g.huntTarget = 12; },
      objective: g => `THE HUNT: ${Math.min(g.huntKills || 0, g.huntTarget)} / ${g.huntTarget} slain`,
      done: g => (g.huntKills || 0) >= (g.huntTarget || 12),
      pay(g) { giveCoins(g, 60); return giveWeapon(g, { minRarity: 3, luck: 0.5 }) + ' and 60 gold'; },
    },
    // ---------------------------------------------------------------------------
    {
      key: 'tithe', name: 'THE TITHE', who: 'a beggar with very clean hands',
      pitch: 'Give me what you carry. I will give you back something better.',
      terms: 'Hand over HALF the gold you are carrying, right now.',
      reward: 'A weapon worth more than the gold was.',
      // the only one that resolves instantly - it is a trade, not a quest, and it is
      // here because a floor where you are broke is a floor where gold means nothing
      accept(g) {
        const half = Math.floor(g.player.coins / 2);
        g.player.coins -= half;
        g.titheAmount = half;
      },
      objective: g => 'THE TITHE: paid',
      done: g => true,
      pay(g) {
        const luck = Math.min(1, 0.3 + (g.titheAmount || 0) / 200); // the more you gave, the better it is
        return giveWeapon(g, { minRarity: 3, luck });
      },
    },
  ];

  const byKey = k => QUESTS.find(q => q.key === k);

  // The stranger you meet. Rolled at floor-gen with the SEEDED rng (co-op safe).
  // `roll` is a 0..1 the quest can use for its own choices, also from the seed.
  function make(rnd, floorNum) {
    const q = QUESTS[(rnd() * QUESTS.length) | 0];
    return { key: q.key, taken: false, done: false, paid: false, roll: rnd(),
             x: 0, y: 0, bob: rnd() * 6 };
  }

  return { QUESTS, byKey, make };
})();
