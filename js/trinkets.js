// ============================================================================
// trinkets.js - THE FOURTH SLOT (Sam, 2026-07-14).
//
// You carry two weapons and a suit of armour. The fourth slot holds a TRINKET.
//
// A trinket is NOT a second suit of armour. Armour is a bundle of small numbers
// that all point the same way (more defence, more speed, more regen) and it is
// strictly good. If a trinket were the same thing again, the slot would be a
// nothing - you would pick the one with the bigger numbers and stop thinking.
//
// So a trinket is ONE NAMED ARTIFACT with ONE GIFT AND ONE PRICE. That is the same
// language the rest of this game already speaks: the circles torment you, the
// terraces make you carry something, the spheres bless you and charge you for it,
// and the stranger's Pact makes the floor worse in exchange for a mythic. A trinket
// is that idea, in your pocket, for the whole run.
//
// Every name references something REAL (Sam's standing rule): Damocles, Icarus,
// Ouroboros, Midas, Occam, the Antikythera mechanism, Zeno, Newton, Ariadne, Pascal.
// A 12-year-old can google every one of them and find a story.
//
// MECHANICS: most trinkets are built out of mod keys the engine ALREADY sums in
// player.mod() (dmg, spd, reduce, critCh, critDmg, coin, regenFlat, atkSpd, rollCd,
// maxHpPct, thorns...), so they compose with evolutions, armour and pets for free.
// Three of them add a real new behaviour, and those are wired explicitly.
// ============================================================================
const Trinkets = (() => {

  // gift and price. `mods` folds straight into player.mod(); `flag` is a behaviour
  // the engine checks for by name.
  const TRINKETS = [
    {
      key: 'damocles', name: "Damocles' Thread", color: '#ff5a5a', icon: 'sword',
      gift: '+45% damage',
      price: 'but your maximum health is cut by a third',
      lore: 'The sword hangs by a single hair. You swing anyway.',
      mods: { dmg: 0.45, maxHpPct: -0.33 },
    },
    {
      key: 'icarus', name: 'Icarus Feather', color: '#ffd24c', icon: 'feather',
      gift: '+30% move speed',
      price: 'but everything hurts you 15% more',
      lore: 'He was told not to fly so close. He had wings; what else was he going to do?',
      mods: { spd: 0.30, reduce: -0.15 },
    },
    {
      key: 'ouroboros', name: 'Ouroboros Band', color: '#6ee7a0', icon: 'ring',
      gift: 'regenerate 1.4 HP every second, forever',
      price: 'but you deal 15% less damage',
      lore: 'The serpent eating its own tail. It never starves, and it never grows.',
      mods: { regenFlat: 1.4, dmg: -0.15 },
    },
    {
      key: 'midas', name: 'Splinter of Midas', color: '#ffce54', icon: 'coin',
      gift: '+60% gold, and the gold you carry becomes damage',
      price: 'but the weight of it slows you by 12%',
      lore: 'Everything he touched. Including, in the end, his dinner.',
      mods: { coin: 0.60, midasPer: 55, midasCap: 40, spd: -0.12 },
    },
    {
      key: 'occam', name: "Occam's Razor", color: '#cfe0f0', icon: 'razor',
      gift: '+40% attack speed',
      price: 'but each hit lands 12% lighter',
      lore: 'The simplest cut is usually the right one. Make more of them.',
      mods: { atkSpd: 0.40, dmg: -0.12 },
    },
    {
      key: 'antikythera', name: 'Antikythera Gear', color: '#7fd4ff', icon: 'gear',
      gift: 'your Q, R and ultimate recharge 30% faster',
      price: 'but you have 20% less health',
      lore: 'A two-thousand-year-old computer, pulled out of a shipwreck. It still turns.',
      mods: { maxHpPct: -0.20 },
      flag: 'abilityHaste',            // read in castAbility
      abilityCd: 0.30,
    },
    {
      key: 'zeno', name: "Zeno's Arrow", color: '#b06bff', icon: 'arrow',
      gift: 'enemy shots crawl to half speed once they get near you',
      price: 'but you move 10% slower yourself',
      lore: 'To reach you, the arrow must first come half way. And then half again.',
      mods: { spd: -0.10 },
      flag: 'zeno',                    // read in the projectile update
    },
    {
      key: 'newton', name: "Newton's Apple", color: '#ff9a4c', icon: 'apple',
      gift: 'everything is pulled gently toward you (line them up, hit them all)',
      price: 'but they arrive sooner, and hit you 12% harder for it',
      lore: 'It falls because it is told to. So do they.',
      // the gravity flag is the gift; the price is that the whole room ends up in your
      // face, so it hits harder. A real number, not just flavour.
      mods: { critCh: 0.06, reduce: -0.12 },
      flag: 'gravity',                 // read in the monster update
    },
    {
      key: 'ariadne', name: "Ariadne's Thread", color: '#8effc0', icon: 'thread',
      gift: 'the whole floor is on your map from the moment you arrive',
      price: 'but there is no gold in a maze you have already solved (-40% coins)',
      lore: 'She gave Theseus the thread so he could find his way back out.',
      mods: { coin: -0.40 },
      flag: 'revealMap',               // read by the minimap
    },
    {
      key: 'pascal', name: "Pascal's Wager", color: '#e0894a', icon: 'dice',
      gift: '+25% crit chance and crits hit 50% harder',
      price: 'but you have no shield, no second chance, and 25% less health',
      lore: 'Bet everything on it being true. The upside, he argued, is infinite.',
      mods: { critCh: 0.25, critDmg: 0.50, maxHpPct: -0.25 },
      flag: 'noSecondChance',          // blocks Lifeline / Phoenix revives
    },
  ];

  const byKey = k => TRINKETS.find(t => t.key === k) || null;

  // Trinkets are RARE and there is no rarity ladder: a trinket is a trinket. What
  // varies is WHICH one, and they are all meant to be a real decision.
  function rollTrinket(opts) {
    const pool = (opts && opts.exclude)
      ? TRINKETS.filter(t => !opts.exclude.includes(t.key))
      : TRINKETS;
    const src = pool.length ? pool : TRINKETS;
    const t = src[(Math.random() * src.length) | 0];
    return { ...t, isTrinket: true, rarityName: 'Trinket', price: 120 };
  }

  // The one-line summary the HUD and the shop print.
  const displayName = t => (t && t.name) || 'Trinket';

  return { TRINKETS, byKey, rollTrinket, displayName };
})();
