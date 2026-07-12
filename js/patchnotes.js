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
  const VERSION = 'v2.3';

  const NOTES = [
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
