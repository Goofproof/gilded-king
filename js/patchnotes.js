// ============================================================================
// patchnotes.js - the in-game changelog (Sam, 2026-07-11).
//
// AUTO: the title screen shows a "PATCH NOTES" button, and the newest entry
// pops up automatically the first time you load a version you haven't seen
// (tracked in localStorage 'drl_seen_ver'). The newest version is NOTES[0].
//
// DO NOT HAND-EDIT THE VERSION OR UNSHIFT AN ENTRY BY HAND. Run:
//     npm run notes -- --title "Your Headline"
// which reads NOTES[0].sha, turns every commit since it into an item, bumps
// VERSION, and stamps the new entry with the current HEAD. `npm run ship`
// does that plus test + commit + push. A pre-push hook blocks a push that
// changes the game without new notes, so this file can't silently fall behind
// again - by v2.14 it had gone 87 commits stale, an entire era of the game
// (five classes, the leaderboard, accolades, room shapes) shipped unannounced.
//
// `sha` = the HEAD commit that entry shipped at. It is the cursor the generator
// reads; every entry needs one. Items are drafted from commit subjects, so
// write commit subjects a player could read.
// ============================================================================
const PatchNotes = (() => {
  const VERSION = 'v2.27';

  const NOTES = [
    {
      v: 'v2.27', title: 'Death Fix and Jupiter Balance', date: '2026-07-14',
      sha: 'e68a119',
      items: [
        'Negative HP now kills you, and Jupiter\'s justice can\'t one-shot a cleave (Sam).',
      ],
    },
    {
      v: 'v2.26', title: 'Overcharge', date: '2026-07-14',
      sha: '66d57a8',
      items: [
        'SHARDS NEVER RUN OUT OF A USE. Honing your weapon used to stop at 5 and then your shards just piled up with nowhere to go. Now you can keep going past 5 as OVERCHARGE: a smaller boost each time, for a cost that climbs forever. So it is always worth breaking down the loot you leave behind.',
        'The hone prompt is clearer too: it now reads like an action and its price instead of a mystery number.',
      ],
    },
    {
      v: 'v2.25', title: 'Machine Gun Sound', date: '2026-07-14',
      sha: '5cdf7de',
      items: [
        'The machine-gunner enemy finally SOUNDS like a machine gun. It used to fire off the bow twang twelve times a second; now every round is a real percussive crack, with a rising whine as it spins up.',
      ],
    },
    {
      v: 'v2.24', title: 'Enchant Table Moved', date: '2026-07-14',
      sha: 'eebcb3a',
      items: [
        'The enchant table in the shop moved. It used to sit right in the bottom doorway, jammed against the wall; now it lines up with the other stalls where you can actually get to it.',
      ],
    },
    {
      v: 'v2.23', title: 'Co-op: Rooms and Doors', date: '2026-07-14',
      sha: '46d60e5',
      items: [
        'CO-OP: no more getting yanked back to the room you just left. You used to spawn standing on the door-plate and bounce straight back; now the plate you arrived on will not fire until you step off it.',
        'CO-OP: you can no longer walk out through a doorway and off the edge of the map. In co-op the walls are solid and the only way onward is the shared door-plate.',
        'CO-OP: if the game ever leaves one player behind in the wrong room, they now catch up to the party on their own. And a room you have cleared stays cleared for everyone, even if a message got lost, so nobody gets trapped behind sealed doors.',
      ],
    },
    {
      v: 'v2.22', title: 'Co-op: Weapons and Pause', date: '2026-07-14',
      sha: '4ac7b11',
      items: [
        'CO-OP: pausing no longer freezes everyone. When one player opens the menu, the world keeps running for the whole party (you cannot pause an online game). Solo play still pauses like normal.',
        'CO-OP: weapons stop vanishing for one player. Dropped loot now heals itself across the party a few times a second, so a weapon that showed up for one of you but not the other will now show up for both.',
        'More multiplayer fixes are coming. If co-op still looks glitchy, make sure both players have hard-refreshed to the latest version first.',
      ],
    },
    {
      v: 'v2.21', title: 'Your Totals', date: '2026-07-14',
      sha: '0369c5f',
      items: [
        'YOUR TOTALS are back on the character sheet (press C). Down the left side you can now read your real numbers again: total crit chance, crit damage, attack speed, move speed, health regen, damage reduction, spell power and the rest.',
        'Every number is the true in-combat value, with your trinket, evolutions, armour and pet all counted in. What it says is what actually fights.',
      ],
    },
    {
      v: 'v2.20', title: 'The Fourth Slot', date: '2026-07-14',
      sha: 'f0e31d0',
      items: [
        'A FOURTH SLOT, for a TRINKET. You already carry two weapons and armour. Now there is a fourth thing, and it is not more armour.',
        'A trinket is one powerful GIFT with one real PRICE, and you choose whether the trade is worth it. Damocles Thread gives you +45% damage but cuts a third of your health. Pascal Wager gives you huge crits but takes away every second chance. Ariadne Thread maps the whole floor the moment you arrive, but there is no gold left in a maze you have already solved. Ten in all, and every one is a decision.',
        'Find them in the shops. Hover any trinket to read exactly what it gives and what it costs before you commit.',
        'Also: the quest giver finally has an E to interact tooltip, so you know you can talk to them.',
      ],
    },
    {
      v: 'v2.19', title: 'Pause Menu Fix', date: '2026-07-14',
      sha: '837a242',
      items: [
        'The pause menu buttons fit their boxes now. The END RUN label used to run straight out through both sides of its own border.',
        'And ABANDON TO MENU finally tells you what it costs: no score, and you keep only the essence you had already banked.',
        'The global leaderboard is LIVE with loadouts. From now on, every score you post records what you were actually running, and you can click a name to see it.',
      ],
    },
    {
      v: 'v2.18', title: 'The End of the Book', date: '2026-07-14',
      sha: '06421d5',
      items: [
        'THE TOP OF THE MOUNTAIN IS NOT THE END. Climb past the seven terraces and you reach the Earthly Paradise, and then the ground lets go of you and YOU RISE.',
        'NINE HEAVENS. The Moon, Mercury, Venus, the Sun, Mars, Jupiter, Saturn, the Fixed Stars, and the Primum Mobile. Heaven is not another dungeon: it is glass and light and enormous open space, the dust falls UPWARD, and the music finally stops being frightening.',
        'NINE BLESSINGS THAT COST SOMETHING. On VENUS you heal from every hit you land, but you are made of glass. On MARS everything hits harder, including you. On JUPITER the scales are exact: what you deal, you are dealt. On SATURN, standing still is the ONLY thing that will heal you - the exact opposite of the terrace of Sloth, where standing still killed you. Saturn is also completely silent, because in the poem it is.',
        'AND THEN THE EMPYREAN. The end of the book. Toad has been telling you the princess is in another castle since floor 3. At the top of Heaven, there is another castle. The King is waiting in it, gold again, and he has been waiting the whole time. He finally tells you the truth.',
        'A NEW CHARACTER SHEET (press C). Your champion stands in the middle with five rings around him, one per path, and you can count your evolutions off them. One line tells you what you are. One gold line tells you what to take next.',
        'And hover any ring to see EXACTLY what it will offer you - with every option marked STACKS, CAPPED, or DEAD SLOT. If you are carrying a bow, it will now tell you straight out that the spell upgrades would do nothing for you.',
      ],
    },
    {
      v: 'v2.17', title: 'Mobile, Quests and the Climb', date: '2026-07-14',
      sha: '1e8d984',
      items: [
        'IT PLAYS ON YOUR PHONE. A thumbstick on the left, your abilities on the right, and it aims for you. Just open the same link on a phone.',
        'A STRANGER IS WAITING IN THE DUNGEON, and they want something. THE PACT makes the whole floor harder right now, and pays you a MYTHIC if you clear it anyway. THE VOW: clear the floor without being hit even once. THE HUNT: twelve of them, before you take the stairs. THE TITHE: hand over half your gold and get back something better. You can always walk away.',
        'YOUR CAPE now hangs still and drifts gently, instead of thrashing about while you run.',
        'AND EVERY PRESTIGE IS A DIFFERENT CAPE at last: its own colour, longer and wider each time, and a gold CHEVRON for every level so anyone can count your rank at a glance. (Two prestiges used to change it by about two pixels. Sorry.)',
        'The level-up screen now tells you when a stat is FULLY EVOLVED, instead of promising an evolution that was never coming.',
        'The global leaderboard now shows what the top scorers were actually RUNNING - their weapons, armour, evolutions and powers. Go and see how they did it.',
      ],
    },
    {
      v: 'v2.16', title: 'Mount Purgatory', date: '2026-07-14',
      sha: 'c29c1f9',
      items: [
        'YOU BREAK THROUGH THE BOTTOM OF HELL. Past the frozen lake there is no floor left to fall through, so you go THROUGH it. Gravity turns over, you come out on the shore of a mountain under an open sky, and the falling stops.',
        'NOW YOU CLIMB. The HUD stops counting how deep you got and starts counting how HIGH. Seven terraces of Mount Purgatory, cycling forever: Pride, Envy, Wrath, Sloth, Avarice, Gluttony and Lust.',
        'AND THE MOUNTAIN IS NOT HELL. It is stone and dawn and open air, the dust drifts UPWARD, and for the first time in the whole game the music is in a major key.',
        'SEVEN PENANCES, not seven torments. On PRIDE you carry a great stone and cannot dodge-roll at all. On ENVY your eyes are stitched shut and you see only what is near. On WRATH a bank of black smoke hides everything until it is on top of you. On SLOTH, standing still hurts. On AVARICE gold is worth nothing, and pays you in experience instead. On GLUTTONY nothing will feed you: no hearts, no regeneration. And on LUST the walls burn, so there is nowhere to hide but the open middle.',
        'THE SHORE is the one floor in the entire endless run where nothing is hunting you. Stand there a moment. You earned it.',
        'Toad has been telling you the princess is in another castle the whole way down. At the bottom of Hell, he finally tells you the truth.',
      ],
    },
    {
      v: 'v2.15', title: 'The Nine Circles', date: '2026-07-14',
      sha: '4dc7258',
      items: [
        'THE NINE CIRCLES ARE NINE REAL PLACES. The Descent used to be one red room with a different name on the door. Now every circle is somewhere: grey silent Limbo, the violet storm of Lust, the foul mire of Gluttony, the gold of Greed, the blood marsh of Wrath, the burning tombs of Heresy, the boiling river of Violence, the black glass of Fraud.',
        'AND THE BOTTOM OF HELL IS ICE. Eight floors of fire, and then Treachery: a silent frozen lake where you do not walk, you SLIDE. (Dante got there first.)',
        'EVERY CIRCLE PLAYS DIFFERENT, not just looks different. The Gale shoves you sideways all floor. The Mire slows you to a crawl. In the Fury, every monster arrives already enraged. In the Pyres, the tombs BURN - your cover is now the thing hunting you. In the Hoard, gold is doubled and most chests are lying to you.',
        'FLOOR MUTATORS: the deeper you go, the stranger it gets. BLOOD MOON (the dead pay double, and leave no hearts). THE SWARM (twice as many, half as sturdy). VAMPIRIC (they heal themselves - kill them faster). Ten in all, stacking two and three deep past the mid-Descent.',
        'Which means no two runs of the Descent are the same run any more. Floors 4 through 40 are forty different floors.',
      ],
    },
    {
      v: 'v2.14', title: 'Cape, Enemies & The Gilded Dais', date: '2026-07-14',
      sha: '4996f18',
      items: [
        'A ROSTER OF CLASSES: Barbarian, Paladin, Cleric, Engineer (deployable turrets) and Summoner (an elemental matched to your weapon) join the original five.',
        '118 ACCOLADES to unlock, with a title gallery - and a GLOBAL LEADERBOARD on the title screen. Click any fallen hero to see the snapshot of how they died.',
        'NEW ENEMIES: an arcane Mage who kites you, a Doppelganger that copies you, a burst-fire Gunner, a shrapnel Lobber, and a Worm that bursts into wormlings when it dies.',
        'MONSTERS FIGHT AS A UNIT: tanks hold the front, shield-bearers screen their archers, chargers swing wide to flank. The ALARM meter means the longer a floor takes, the harder it pushes back.',
        'REAL ROOMS: walls carve true shapes - donuts, missing corners, bridges - and PITS you have to path around. Monsters can\'t march over them either.',
        'BOSSES OF THE DEEP: the Colossus and the Matriarch wait past the King.',
        'A TRAINING BARRACKS to spend gold on run boosts, and an ENCHANT TABLE in the shops.',
        'STATS REBUILT: five base stats fed by the skills you pick, so your build actually reads. Your R ability is now a choice of three, and ultimates draw from a pool of ten.',
        'THE GILDED DAIS: a whole new home screen, with a live preview of the loadout you\'re about to take in.',
        'YOUR CAPE now hangs from your shoulders and swings behind you as you run and roll, instead of tearing itself apart in motion.',
        'CO-OP: text chat (press Enter), your teammate\'s class and cape render properly, loot stops leaking between players, and a door gate keeps the party together.',
        'Plus a long readability and balance pass: enemy shots are marked as theirs, empowered attacks telegraph, mythics feel mythic again, and the bow is worth carrying.',
      ],
    },
    {
      v: 'v2.13', title: 'Classes, Controls & a Harder Dungeon', date: '2026-07-12',
      sha: '858e726',
      items: [
        'CLASS ABILITIES: Q is now your class\'s signature power from the very start - Warrior Shield Bash, Ranger Tumble Volley, Mage Arcane Nova, Rogue Eviscerate, Adventurer Adrenaline.',
        'Your first two EVOLUTIONS now fuse into your R ability, and your ULTIMATE (class power + evolved power) fires on RIGHT-CLICK.',
        'LEFT-CLICK attacks manually when you turn auto-attack off (F), so you\'re never left unable to fight.',
        'HARDER DUNGEON: deeper floors have far more monsters and much tankier ones, the King has a lot more health, and shield-bearers now guard their ranged allies instead of charging you (but bash if you push up on them).',
      ],
    },
    {
      v: 'v2.12', title: 'Prestige', date: '2026-07-12',
      items: [
        'PRESTIGE: on the home screen, sacrifice your WHOLE essence account - all your banked essence and every upgrade - to rise one prestige level.',
        'The reward is pure bragging rights: a royal CAPE that grows longer, richer, and more gold-trimmed with every prestige level you earn.',
        'The cost climbs each time, so a higher prestige is always a bigger sacrifice. Two clicks to confirm, so you never wipe your account by accident.',
      ],
    },
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
