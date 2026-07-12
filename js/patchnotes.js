// ============================================================================
// patchnotes.js - the in-game changelog (Sam, 2026-07-11).
//
// AUTO: the title screen shows a "PATCH NOTES" button, and the newest entry
// pops up automatically the first time you load a version you haven't seen
// (tracked in localStorage 'drl_seen_ver'). Bump VERSION and unshift a new
// entry at the top whenever something ships - the newest version is always
// NOTES[0].
// ============================================================================
const PatchNotes = (() => {
  const VERSION = 'v2.11';

  const NOTES = [
    {
      v: 'v2.11', title: 'Haggle With the Keeper', date: '2026-07-12',
      items: [
        'HAGGLE: press the shopkeeper (E) to gamble on prices - a coin flip that either drops every price 30% or drives it up 30%.',
        'One attempt per shop, so choose your moment. The mythic shop never haggles.',
      ],
    },
    {
      v: 'v2.10', title: 'Choose Your Class', date: '2026-07-12',
      items: [
        'CLASSES: pick who you are before a run - Warrior, Ranger, Mage, Rogue, or the classic Adventurer.',
        'Each class sets your STARTING WEAPON and a signature perk: the Warrior opens with a heavy weapon, the Ranger a bow, the Mage a wand, the Rogue a dagger.',
        'Warrior: +20 HP and 8% less damage taken. Ranger: +12% speed, +5% crit. Mage: Magic 3 and +15% spell power. Rogue: +10% crit and faster rolls.',
        'Pick your class right on the home screen - it sticks until you change it.',
      ],
    },
    {
      v: 'v2.9', title: 'The Arcane School', date: '2026-07-12',
      items: [
        'MAGIC finally evolves: stack Attunement to 3 / 6 / 9 / 12 and choose from a full ARCANE tree - raw Spell Power, wider Elemental bursts, or faster Cast Tempo.',
        'NEW character sheet (press C): your stats are now grouped into three schools - MIGHT, VIGOR, and FLOW.',
        'CLICK any stat to drill into its full evolution tree and see which paths you\'ve taken and what\'s still ahead.',
        'Each stat shows how it reaches into another school (the "web") - like crit healing you, or hoarded coins turning into damage.',
      ],
    },
    {
      v: 'v2.8', title: 'Magic, Tactics & Reroll', date: '2026-07-12',
      items: [
        'REROLL your level-up: don\'t like the three choices? Reroll them for gold - 10 the first time, a little more each reroll.',
        'Enemies fight like a UNIT now: shield-bearers plant themselves in front of their archers, chargers swing wide to flank you, and the little swarmers guard the ranged pack until you close in.',
        'MAGIC rebalanced: wands hit a bit less on their own, but the Magic stat now powers up every spell you cast, so a real magic build finally pays off.',
        'ELEMENTAL STAFFS: a frost staff chills, a venom staff poisons, a storm staff chains - the burst takes on your staff\'s element instead of always being fire.',
        'Co-op: you can finally SEE a teammate\'s spells fly as glowing bolts and fireballs, not plain arrows.',
      ],
    },
    {
      v: 'v2.7', title: 'Co-op, Fixed Up', date: '2026-07-12',
      items: [
        'LOOT for everyone: weapon and armor drops now reach player 2 and 3 as their own copies to grab and equip.',
        'You can SEE each other fight: a teammate\'s weapon swing now shows its full arc, not just sparks.',
        'SHARED level-ups: when the party levels, everyone waits on the results screen until all of you have chosen.',
        'Frenzy (attack-speed) evolutions now read clearly and their stack caps are honest.',
      ],
    },
    {
      v: 'v2.6', title: 'R Ability + Ultimate', date: '2026-07-12',
      items: [
        'Your 3rd + 4th evolutions now fuse into a second power, bound to R.',
        'ULTIMATE unlocked: when R lands you CHOOSE one of three ultimates - a supercharged Q, a supercharged R, or a screen-shaking FUSION CATACLYSM.',
        'Fire your ultimate with LEFT-CLICK. Long cooldown, huge payoff.',
        'The HUD now shows all three ability badges (Q / R / left-click) with live cooldowns - hover any of them to read what it does.',
      ],
    },
    {
      v: 'v2.5', title: 'CO-OP is here (beta)', date: '2026-07-11',
      items: [
        'PLAY ONLINE: host a game, share the 4-letter code, and raid the dungeon together.',
        'You explore the SAME dungeon and move as a party - walk through a door and everyone comes along.',
        'Fight the same monsters together; enemies are tougher the more of you there are.',
        'Beta: enemies focus the host, loot drops to the host, and the boss fight is rough in co-op - polish is coming.',
      ],
    },
    {
      v: 'v2.4', title: 'Hands-Free Combat', date: '2026-07-11',
      items: [
        'AUTO-ATTACK is now always on - no more clicking. You fight by positioning; your weapon strikes the nearest enemy automatically.',
        'Cleaner home screen: the controls legend is gone and your STABLE sits up top with your trophies.',
      ],
    },
    {
      v: 'v2.3', title: 'Know Your Power', date: '2026-07-11',
      items: [
        'Hover the Q ability badge (bottom-centre) to see exactly what your power does.',
      ],
    },
    {
      v: 'v2.2', title: 'Elements & Endless', date: '2026-07-11',
      items: [
        'ELEMENTAL weapons: Frost chills and can freeze, Chain Lightning arcs to nearby foes, Venom poisons over time.',
        'Hub upgrades are ENDLESS now - Vitality/Might/Greed keep leveling, so essence is never wasted.',
        'Smarter AUTO-ATTACK: it pre-swings so the hit lands right as an enemy reaches you.',
        'Minimap is smaller and now shows the floor name above it.',
        'CHARACTER SHEET: press C to see your live stats and every evolution you\'ve taken.',
        'Hover your equipped weapon or armor to read its full stats.',
      ],
    },
    {
      v: 'v2.1', title: 'Companions & Powers', date: '2026-07-11',
      items: [
        'PETS live in the dungeon now - find one dormant in a room and press E to befriend it.',
        'Extra pets go to your STABLE on the home screen. Pick one to start your next run with.',
        'Pets are loyal forever and cannot die.',
        'MERCENARIES also wait in rooms - press E to hire. They fight for you until they fall.',
        'Q ABILITY: your first two evolutions fuse into one unique power, bound to Q.',
        'EVOLUTIONS hit much harder - every upgrade is a real power spike now.',
        'Your champion visibly TRANSFORMS as you evolve, coloured by your strongest path.',
      ],
    },
    {
      v: 'v2.0', title: 'The Descent & Evolutions', date: '2026-07-10',
      items: [
        'Beat the Gilded King and THE DESCENT opens - endless circles of hell below.',
        'EVOLUTION tree: stack a stat to I/II/III/IV and pick a themed upgrade.',
        'MYTHIC weapons and armor, a secret mythic shop, and title-screen laurels.',
        'Armor slot, shard salvage, weapon honing, and a level-up reroll.',
      ],
    },
  ];

  return { VERSION, NOTES };
})();
