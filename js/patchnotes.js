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
  const VERSION = 'v2.130';

  const NOTES = [
    {
      v: 'v2.130', title: 'Every weapon looks like itself, Hell gets nine real floors, and fullscreen', date: '2026-07-17',
      sha: '12f67e1',
      items: [
        'Every weapon has its own look now - a Maul, Cleaver, Warhammer and Greataxe are four different weapons on the ground and in your hands, same for every sword, bow, wand and staff (20 models, and each Mythic wears the right one).',
        'The nine circles each got their own ground - monoliths in the Limbo fog, storm-streaks in Lust, mud pools in Gluttony, spilled gold in Greed, the marsh of the Styx, burning tombs, a river of boiling blood, mirror-shard ditches, and crack-webbed ice at the bottom.',
        'Fullscreen is here - press F11 anywhere, or click the new corner button on the title screen and pause menu.',
      ],
    },
    {
      v: 'v2.129', title: 'The raiders are counted', date: '2026-07-17',
      sha: 'ddb876d',
      items: [
        'The title screen now counts the living: X RAIDERS CARRY THE LIGHT - everyone who has played in the last half hour, standing on the shoulders of the 87 founders.',
      ],
    },
    {
      v: 'v2.128', title: 'The flame in the tab', date: '2026-07-16',
      sha: '22e1b1e',
      items: [
        'Barrowlight finally has its own tab icon: a golden flame burning in the dark. Carry your light into the deep - and find your tab at a glance.',
      ],
    },
    {
      v: 'v2.127', title: 'HUD cleanup', date: '2026-07-16',
      sha: '63221b0',
      items: [
        'HUD cleanup: your Q, R and Ultimate buttons now live in the bottom LEFT, right under your weapons - everything about your kit in one corner. The FLOOR 1/3 counter is gone (the Descent still shows its depth, on the right).',
      ],
    },
    {
      v: 'v2.126', title: 'Performance pass 2: the big one', date: '2026-07-16',
      sha: '1ba5318',
      items: [
        'PERFORMANCE PASS 2, THE BIG ONE: every room now paints its walls, floor and scenery ONCE and remembers the picture, instead of redrawing all of it sixty times a second. The minimap remembers itself too.',
        'Measured over 40% faster in the heaviest fights on our test machine - and the gains are BIGGER on slower computers. Same game, same look, way less work per frame.',
      ],
    },
    {
      v: 'v2.125', title: 'Performance pass: smoother on every machine', date: '2026-07-16',
      sha: '7dde122',
      items: [
        'PERFORMANCE PASS: the game runs noticeably smoother, especially on slower computers. Glowing effects are pre-baked instead of computed live, particles have a sane ceiling, and the busiest math got faster.',
        'Nothing looks different - it just runs better. If a room ever felt choppy with lots of effects on screen, try it again.',
      ],
    },
    {
      v: 'v2.124', title: 'Bottomless debt, X to salvage', date: '2026-07-16',
      sha: 'b20d3a5',
      items: [
        'Gambler: the debt has NO FLOOR anymore. Keep pulling on credit and your Jackpots get weaker and weaker until they do nothing at all. The house always collects.',
        'Engineers: turret salvage moved to X - the same key you salvage gear with. E stays for chests and doors.',
      ],
    },
    {
      v: 'v2.123', title: 'The ante, the salvage, and the lightning', date: '2026-07-16',
      sha: '1ded262',
      items: [
        'THE ANTE: every JACKPOT pull now costs 5 gold - and only wins shower it back. The Gambler can fall into DEBT (your gold runs red), and in debt your pulls hit WEAKER. Climb out.',
        'ENGINEERS: press E on a standing turret to SALVAGE it - the charge comes back and the deploy cooldown resets. Reposition freely.',
        'Chain lightning was always working - now you can SEE it: a real jagged bolt leaps between enemies with a ZAP. (It arcs to 2 nearby enemies at 45% damage.)',
      ],
    },
    {
      v: 'v2.122', title: 'The Gambler dresses the part', date: '2026-07-16',
      sha: 'd2b228c',
      items: [
        'Gambler polish: your BANKROLL loads the gun - the more gold you hold, the harder JACKPOT hits (the bonus cap grows with Fortune). Hoard or spend: your call.',
        'Misses now read DUE UP as your odds build, and the Gambler finally dresses the part: black riverboat hat, gold band, lucky coin. No more being mistaken for the Adventurer.',
      ],
    },
    {
      v: 'v2.121', title: 'NEW CLASS: THE GAMBLER', date: '2026-07-16',
      sha: 'a1c872c',
      items: [
        'NEW CLASS: THE GAMBLER. Fortune rules it. You start with a dagger, 40 gold, and +10% coins from kills.',
        'Its Q is JACKPOT: pull the lever, the reels spin over your head, and one strike in four hits TRIPLE and showers gold. Every Fortune point raises your odds.',
        'Gambler milestones: rank 4 - every miss makes the machine DUE (+10% odds until you win). Rank 8 - a jackpot refunds half the cooldown. Rank 12 - a jackpot re-arms Q instantly.',
        'JACKPOT left the fusion forge to become that Q - the Fortune x2 trio gets MOTHER LODE instead: crack the floor, shower gold, and sometimes unearth a weapon.',
      ],
    },
    {
      v: 'v2.120', title: 'The forge gets FUN: bowling with monsters, a real goose, visible stances', date: '2026-07-16',
      sha: '2ff0c83',
      items: [
        'MONSTERS ARE AMMUNITION. Anything you send flying (TREBUCHET, RHINO, ATLAS...) crashes into its friends and hurts BOTH. Line up the shot and go bowling.',
        'The GOLDEN GOOSE is a real bird now. It waddles after you laying gold - but monsters will hunt it. If it dies it bursts into a fortune: protect it, or cash it.',
        'Every stance shows a glowing ring around you with a draining timer - you always know what is on and how long is left. FORT KNOX even orbits your coins as armor (and hits knock a couple loose).',
        'MARATHON at full stride makes you a battering ram - steer INTO the crowd. TAILWIND leaves a wake that speeds up teammates. TROLL BLOOD visibly knits (and says STEMMED when a big hit stops it).',
        'The ORACLE OF DELPHI now prophesies: the best room left on the floor gets a pulsing star on your map. The Oracle names your fortune.',
      ],
    },
    {
      v: 'v2.119', title: 'Excalibur flies, Prometheus burns, the Stone toggles', date: '2026-07-16',
      sha: 'bb6c850',
      items: [
        'EXCALIBUR reforged: for its whole window, every melee swing sends a blade of light flying where you aim. Your sword fights at range now.',
        'PROMETHEUS reforged: it is a FLAMETHROWER. Hold the line and spray a torrent of fire wherever you point - everything it licks keeps burning.',
        "PHILOSOPHER'S STONE reforged: now a TOGGLE. Light it and your gold burns away while ALL your damage is amplified. Press R to snuff it - or go broke and it snuffs itself.",
      ],
    },
    {
      v: 'v2.118', title: 'Prime fusions: pure builds get their own trios', date: '2026-07-16',
      sha: '3a45db1',
      items: [
        'PRIME FUSIONS: pour everything into ONE stat and the forge honors it - same-stat pairs now have their own trios, and pure builds rank up their fusion TWICE as fast.',
        'The Warlord (Might x2): GORDIAN CUT, BERSERK, TREBUCHET. The Colossus (Vigor x2): RHINO, STONEWALL, HYDRA. The Wind (Agility x2): ZEPHYR, TAILWIND, SMOKE BOMB.',
        "The Archmage (Arcane x2): SUPERNOVA, TESLA COIL, EVENT HORIZON. The Tycoon (Fortune x2): JACKPOT, GOLD STANDARD, GOLDEN GOOSE. That's 45 fusions at the forge.",
      ],
    },
    {
      v: 'v2.117', title: 'Fusion wave 3: all ten pairs are at the forge', date: '2026-07-16',
      sha: '6ceef16',
      items: [
        'THE FORGE IS COMPLETE: all ten stat pairs now offer their three fusion powers. The final twelve landed today.',
        "Might+Fortune: CROESUS, EL DORADO, KING'S RANSOM. Arcane+Vigor: ASCLEPIUS, TROLL BLOOD, SANCTUARY. Agility+Fortune: HIGHWAYMAN, LUCKY STREAK, RABBIT'S FOOT. Arcane+Fortune: PHILOSOPHER'S STONE, GOLD RUSH, ORACLE OF DELPHI.",
        'Thirty fusions total, and every one grows with the two stats that made it. Go find your pair.',
      ],
    },
    {
      v: 'v2.116', title: 'Fusion wave 2: the Tempest, the Spellblade and the Phantom', date: '2026-07-16',
      sha: '3d12f20',
      items: [
        'NINE MORE FUSIONS at the forge. Might+Agility: TYPHOON (whirlwind dash), ACHILLES (nothing slows you, first hits crit), PARTHIAN SHOT (fire backward while you retreat).',
        'Might+Arcane: EXCALIBUR (one colossal blade, always crits), MJOLNIR (lightning hammers on a beat), PROMETHEUS (steal fire - burning enemies feed your spells).',
        'Agility+Arcane: HERMES (blink with damaging afterimages), QUICKSILVER (everything flows faster and echoes), MIRAGE (a decoy that draws every eye, then detonates).',
      ],
    },
    {
      v: 'v2.115', title: 'FUSION ABILITIES arrive: forge your R from three named powers', date: '2026-07-16',
      sha: 'af557c2',
      items: [
        'FUSION ABILITIES ARE HERE. Your first two evolutions name a PAIR of stats - and that pair now offers three legendary powers to forge into your R: a STRIKE, a STANCE, and a TRICK. Pick one.',
        'The first nine: ATLAS, AJAX and ANTAEUS (Might+Vigor) - SECOND WIND, MARATHON and HOUDINI (Agility+Vigor) - BLOOD MONEY, FORT KNOX and GOLDEN FLEECE (Fortune+Vigor). More pairs coming.',
        'Fusions never fall behind: every point you put into their two stats makes them stronger, all run long. The card tells you which stats feed it.',
      ],
    },
    {
      v: 'v2.114', title: 'New address: barrowlight', date: '2026-07-16',
      sha: 'e857e8d',
      items: [
        'Barrowlight has a new address: goofproof.github.io/barrowlight - update your bookmarks!',
      ],
    },
    {
      v: 'v2.113', title: 'THE HARPY rules floor 1, and multiplayer never pauses', date: '2026-07-16',
      sha: '9b93799',
      items: [
        'FLOOR 1 HAS A BOSS NOW: THE HARPY. That giant shadow gliding over the forest? It was her the whole time. At the end of the Whispering Forest, she comes down.',
        'The forest shadow is redrawn too - long eagle wings with finger feathers, not a butterfly. You were all right to ask about it.',
        'No more pausing in multiplayer. Open any menu and the world keeps moving - and yes, monsters can still hit you while you read. Pick your moment.',
        'Level ups: press V to open the menu (right next to C - no more reaching for L), press V again to close it and peek your stats. WASD walks the cards, Enter takes the glowing one.',
        'Five new level up cards so every stat has four options: Executioner and Jackal (Might), Nettle (Vigor), Echo (Arcane - your spells can cast twice!), and Clover (Fortune).',
        'Wizards: attack speed no longer makes your wand or staff shoot faster. Instead it recharges your Q, R and Ultimate faster. Your spells, more often.',
      ],
    },
    {
      v: 'v2.112', title: 'The game has a true name: BARROWLIGHT', date: '2026-07-16',
      sha: '40a3930',
      items: [
        'This game has a new name, and its designer chose it: BARROWLIGHT. A barrow is an old word for a grave-mound, so the name means light carried into the grave - which is the whole game: down into the dark, through the very bottom, and back out to the stars. (It also stops the title from spoiling a certain King before you meet him.)',
        'The floor-rule announcements got a proper name too: CONTRAPASSO. It is Dante\'s word for a punishment that mirrors the sin, which is exactly what every floor\'s rules are. The intro card is now short enough to actually read: one line per rule.',
        'And you will never again forget what the floor is doing to you: the active rules stay pinned under the minimap for the entire floor, in their own colors. Dark room? Wind shoving you? Glance at the top right corner - the answer is always there.',
      ],
    },
    {
      v: 'v2.111', title: 'The crown decides the Hunt', date: '2026-07-16',
      sha: 'e65382f',
      items: [
        'The final piece of the Hunt: THE CROWN. A gold crown glyph on your minimap marks the one room the swarm never touches, and THE KING\'S CHAMPION waits there: a gold-clad giant six times tougher than anything else on the floor.',
        'Fell him and THE CROWN IS YOURS: a full heal, permanent rage and speed, and a golden blaze trailing you for the rest of the hunt. But everyone hears it. Your opponent gets the message the instant you take it: fight now or die in the swarm. Taking the crown does not win the hunt. It starts the ending.',
        'One more trick for the patient: when your opponent moves through a room NEXT to yours, you hear it, a whisper at the connecting door. Hunt them by ear.',
        'That completes the overnight PVP build: DUEL for a straight fight, HUNT for the full battle royale. Both live in the host lobby. Go easy on each other. Or do not.',
      ],
    },
    {
      v: 'v2.110', title: 'The Hunt gets teeth', date: '2026-07-16',
      sha: '640ff7e',
      items: [
        'The Hunt has TEETH now. Combat rooms in a hunt spawn monsters again - a little thinner than a normal floor, but real. They are YOUR monsters: your opponent is fighting their own through the walls, and their beasts can never touch you. Every kill feeds only you: your experience, your drops, your build.',
        'The strategy writes itself: fighting makes you stronger but costs health and time while the swarm closes in. Sneak past and stay fresh, or farm up and arrive at the final room a monster yourself. Doors never seal in a hunt, so running away is always allowed. Winning still is not.',
      ],
    },
    {
      v: 'v2.109', title: 'THE GILDED HUNT: last one standing', date: '2026-07-16',
      sha: 'f53d608',
      items: [
        'BATTLE ROYALE IS HERE: flip on HUNT in the host lobby. You and your opponent spawn on opposite ends of a full dungeon floor, and for the first time in co-op you move COMPLETELY alone: your own doors, your own path, no tether. You cannot see each other until you are in the same room. Every chest rolls its own loot for each of you, so gear up fast.',
        'Then THE SWARM comes. After a minute or so, the rooms at the edge of the map start falling, one by one, marked blood-red on your minimap. Stand in a fallen room and it eats you alive. The safe ground shrinks toward the middle until someone has nowhere left to run.',
        'Knock your opponent down anywhere, or let the swarm do it, and you are the HUNT CHAMPION. Then it all resets and you run it back. The hunt has no stairs, no exits and no mercy: it ends one way.',
        'Coming next while you sleep: monsters join the hunt as the third force, and the Gilded King himself takes the field.',
      ],
    },
    {
      v: 'v2.108', title: 'THE DUEL: fight your friend for real', date: '2026-07-16',
      sha: '9c1a6db',
      items: [
        'PVP IS HERE. Flip on DUEL MODE in the host lobby (under friendly fire) and the run becomes a fight: you and your opponent spawn in opposite corners of a sealed arena. No monsters. No stairs. Just the two of you and a 3-2-1 countdown.',
        'Rounds work like a real fighting game: knock your opponent down and the round is yours. Both fighters snap back to their corners at full health, the count starts again, and the first to THREE rounds is the DUEL CHAMPION. Then the score resets and you run it back. Knock each other out in the same breath and it is a DOUBLE KO: the round replays, no point for anyone.',
        'And no, opening your character screen does not make you invincible in a duel. We closed that before anyone could find it.',
        'Pick different classes! Every Q, every rank milestone, every evolution works in the arena, so a max-ARCANE mage versus a wall-slamming warrior is exactly the chaos it sounds like.',
      ],
    },
    {
      v: 'v2.107', title: 'Your loot is YOURS now', date: '2026-07-16',
      sha: 'b85d0dd',
      items: [
        'The big co-op loot change: EVERY PLAYER GETS THEIR OWN DROPS NOW. When a monster, elite, boss or trap chest drops gear in co-op, each player rolls their own separate item. Your teammate literally cannot see your drop, let alone grab it first. Same kill, different loot on each screen. No more racing your partner to the sword.',
        'This applies everywhere gear drops from a kill: regular monsters, elites, mimics, the trap-room chest, boss legendaries (you EACH get one now), and even Circle Warden mythics, which roll against your own collection so you never get a mythic your teammate already had.',
        'Shop, forge and enchanting are unchanged. So is picking up: walk over your item and take it, whenever you like.',
      ],
    },
    {
      v: 'v2.106', title: 'Flashbangs flash now', date: '2026-07-16',
      sha: '6380e51',
      items: [
        'The glass artillery\'s blind is a proper FLASHBANG now. Getting hit by a flash-bolt used to wrap you in darkness, same as Envy\'s shroud. Now the whole screen sears WHITE with a bang and a shake, and your sight bleeds back in over two seconds. Blinded by light, the way a flash should work. Envy keeps its darkness - the two finally look different.',
      ],
    },
    {
      v: 'v2.105', title: 'Descending is a party decision now', date: '2026-07-16',
      sha: '9fc9fb4',
      items: [
        'Going down is a group decision now, same rule as the doors. Every exit to the next floor - the stairs, the portal shortcut, the plunge after a boss, even the nightmare gate - refuses to fire until most of the party is standing together at it. Try to sneak down alone while your teammate is still looting and it just says GATHER THE PARTY TO DESCEND.',
        'No more getting yanked down a floor because someone got excited near the stairs.',
      ],
    },
    {
      v: 'v2.104', title: 'Nobody waits while you choose', date: '2026-07-16',
      sha: '1ac136b',
      items: [
        'The co-op waiting screen is GONE. When your teammate opens an evolution or ultimate choice, you keep playing. No more standing frozen at "waiting for teammate to choose" while they read three cards. They are perfectly safe while choosing (menus block all incoming damage), and their champion wears the CHOOSING tag so you know why they stopped moving.',
        'And if the party heads down the stairs while someone is still mid-choice, the game no longer rips the choice away from them. They finish picking in peace, and the moment they confirm, they ride down to the new floor automatically.',
      ],
    },
    {
      v: 'v2.103', title: 'Door plates stop bouncing the party', date: '2026-07-16',
      sha: '04edec5',
      items: [
        'Another live playtest fix: co-op door plates no longer yank the party through the instant everyone touches one. Standing near the door you just came through could bounce you right back to the last room, over and over. Now a plate has to HOLD the whole party for half a second before the door opens: a gold ring sweeps closed around the plate while it charges, with an OPENING... label so you can step off if you did not mean it.',
      ],
    },
    {
      v: 'v2.102', title: 'Browse first, level up when ready, reroll if unlucky', date: '2026-07-16',
      sha: 'a1969df',
      items: [
        'Two playtest fixes for the new level-up window, both from tonight:',
        'THE REROLL IS BACK. Do not like your three cards? Press R (or click the reroll button) to draw three new ones. Costs 10 gold, and each reroll this run costs 1 gold more than the last, same rules as the old level-up screen.',
        'And the window no longer jumps in your face. Open your character screen with points banked and you can browse your rings and stats in peace - a gold LEVEL UP button waits at the top. Click it (or press L) when you are ready to spend. Esc closes the window and lets you keep browsing, and your three cards WAIT for you exactly as they were. No sneaky free rerolls by closing and reopening, we checked.',
      ],
    },
    {
      v: 'v2.101', title: 'The way down opens for everyone', date: '2026-07-16',
      sha: '662477e',
      items: [
        'Quick co-op fix from tonight\'s playtest: when the floor is cleared, the portal to the stairs now opens on BOTH screens. It was only appearing for the host, leaving the second player staring at an empty room while their partner walked into thin air. If it opens in a room you are not standing in, you get a message telling you where it is.',
        'And thanks to the self-healing system, even if the portal message gets lost in a WiFi blip, it shows up within a few seconds anyway.',
      ],
    },
    {
      v: 'v2.100', title: 'Level up like you mean it', date: '2026-07-16',
      sha: '3567f43',
      items: [
        'Leveling up feels like leveling up now. Press C with points banked and a proper LEVEL UP window pops open right inside your character screen: the sheet dims, three big cards appear, and you pick by clicking or just pressing 1, 2 or 3.',
        'The best part: any card that feeds your CLASS STAT tells you exactly what it does to your Q. It shows the rank you are about to reach, and if that point lands on a rank 4, 8 or 12 milestone, the card glows gold and names the unlock. No more discovering upgrades by accident: you can see "UNLOCKS: Knockback DOUBLES" before you commit the point.',
        'Spare points keep the window open so you can spend a whole streak of level-ups in one visit.',
      ],
    },
    {
      v: 'v2.99', title: 'The VIGOR classes complete the rank system', date: '2026-07-15',
      sha: '9ff7051',
      items: [
        'The final rank batch: VIGOR. Every class in the game now has its full ladder.',
        'PALADIN, Lay on Hands: rank 4 gives the holy shield two charges. Rank 8 makes the cast CLEANSE you: bleeds, slows, blindness, gone. Rank 12: casting at high health wraps the wasted healing around you as a THIRD shield charge. Heal before the fight, not just during it.',
        'CLERIC, Mend: rank 4 heals also CURE poison and bleeding, for you and everyone you touch. Rank 8 consecrates the ground: a glowing circle that keeps healing anyone standing in it, on every player\'s screen. Rank 12 wraps a shield around everyone you heal. Tested properly in co-op: your teammate gets the heal, the cure, the shield and the circle.',
        'DRUID: meet THE OWLBEAR. The third form is back and it is a mage in fur: a hulking feathered beast whose swipes are pure arcane and grow with your ARCANE stat. Rank 4 makes every shift heal you 5%. Rank 8 gives each form a MOVE: the bear ROARS everything into a flinch, the wolf POUNCES, the owlbear unleashes a WING BUFFET. Rank 12 is Primal Mastery: every single shift fires the move, free. The endgame druid is a whirlwind of shapes.',
        'DEATH KNIGHT: Unholy Rune is gone. It only paid off when you were already losing, and that is no way to live. Your new Q is MIASMA: exhale a cloud of rot that poisons everything inside and WITHERS them, sapping a fifth of their damage. Rank 4 is THE BLACK WIND: the cloud walks with you. Rank 8: the rot feeds you, regenerating while enemies decay in your cloud. Rank 12: anything the poison kills RISES as your skeleton warrior for 30 seconds. You are the plague, and the plague keeps what it takes.',
        'That completes the Q rank system: 14 classes, 43 milestones, every one earned by putting points where your class lives.',
      ],
    },
    {
      v: 'v2.98', title: 'The ARCANE classes get their rank rewards', date: '2026-07-15',
      sha: 'd9161a6',
      items: [
        'The biggest rank batch yet: all five ARCANE classes get their rewards. Stack ARCANE and hover your Q.',
        'MAGE, Arcane Nova: rank 4 leaves a slowing field where the nova burst. Rank 8 fires a second aftershock pulse half a beat later, catching everything that survived the first. Rank 12 chills every enemy the nova touches.',
        'SUMMONER: rank 4 gives your elemental an AURA of its element: fire singes, earth slows, poison sickens, lightning zaps. Rank 8 is the headline: TWO elementals at once. Rank 12 makes them explode when they die, one last gift in their element.',
        'MESMER, Mirror Image: rank 4 splits you into FOUR. Rank 8 makes your copies swing when you swing, a room full of you actually fighting. Rank 12: recast while your clones stand and you SWAP PLACES with the farthest one. Plan where your copies walk, then be there.',
        'NECROMANCER, Raise Dead: your army now grows with ARCANE instead of level. One knight to start, two at rank 4, three knights and two archers at rank 8, and at rank 12 THE BONE GOLEM rises: huge, slow, and monsters cannot ignore it.',
        'PYROMANCER, Immolate: rank 4 spreads the fire farther from every burning death. Rank 8 makes you FIREPROOF while your inferno burns, walk through Hell\'s pyres untouched. Rank 12: anything that dies on fire EXPLODES, and the chain reaction is exactly as fun as it sounds.',
        'One more batch to go: VIGOR, with the paladin, cleric, a rebuilt druid, and something rotten for the death knight.',
      ],
    },
    {
      v: 'v2.97', title: 'The AGILITY classes get their rank rewards', date: '2026-07-15',
      sha: '079a282',
      items: [
        'The AGILITY rank rewards are live. Put points into AGILITY and hover your Q.',
        'RANGER, Tumble Volley: the volley is finally REAL. From your very first AGILITY point, tumbling looses 3 arrows at the nearest enemies, at your bow\'s full damage. Rank 4 upgrades it to a complete CIRCLE of twelve arrows. Rank 8 makes them pierce through bodies. Rank 12 gives you TWO tumbles back to back before the cooldown starts.',
        'ROGUE, Eviscerate: rank 4 means a killing blow resets the cooldown instantly, so a wounded room is a chain of executions. Rank 8 is the Shadowstep: cast at an enemy out of reach and you appear BEHIND them as the blade lands. Rank 12: every kill with it turns you invisible for a breath. Kill, disappear, reposition.',
        'ENGINEER, Deploy Turret: rank 4 turret shots slow whatever they hit. Rank 8 turrets inherit your weapon\'s element: fire wand, fire turrets. Rank 12 crowns your oldest turret a TESLA COIL, gold, crackling, and chaining lightning between enemies.',
        'Also fixed in co-op: your teammates can finally SEE your turrets. They were invisible to everyone but you this whole time.',
        'ARCANE is next: four mirror clones that fight back, a second elemental, and the necromancer\'s bone golem.',
      ],
    },
    {
      v: 'v2.96', title: 'The MIGHT classes get their rank rewards', date: '2026-07-15',
      sha: '88920d5',
      items: [
        'The first batch of Q rank rewards is HERE, for the MIGHT classes. Put points into MIGHT and watch your Q icon: the "coming soon" labels for these three classes are now real.',
        'WARRIOR, Shield Bash: rank 4 gives your shield TWO charges. Rank 8 DOUBLES the knockback, and you will feel it. Rank 12 is the Wall Slam: any enemy you smash into a wall takes the whole bash a second time. Start herding them toward the walls.',
        'BARBARIAN, War Shout: rank 4 makes frightened enemies take 15% extra damage, so roar first, swing second. Rank 8 shares your fury: teammates near your shout catch RAGE. Rank 12 is the corner trap: an enemy that flees into a wall and has nowhere left to run just cowers there, stunned, waiting for you.',
        'ADVENTURER, Adrenaline: rank 4 refunds your roll every cast. Rank 8 adds a heal. Rank 12 spreads the whole rush to nearby teammates.',
        'AGILITY classes are next: the ranger\'s volley is about to become very real.',
      ],
    },
    {
      v: 'v2.95', title: 'Your class ability grows with your class stat now', date: '2026-07-15',
      sha: '1bc2c4b',
      items: [
        'Big one for every class: your Q ability has a RANK now, and your rank is simply how many points you have put into your class\'s main stat. A mage\'s ARCANE, a warrior\'s MIGHT, a ranger\'s AGILITY, a cleric\'s VIGOR. Every point makes your Q better at the thing it is FOR: the warrior\'s bash shoves harder, the barbarian\'s roar lasts longer, the mage\'s nova reaches further, heals heal more, dashes go farther, turrets fire faster.',
        'Damage abilities also stopped falling behind on deep floors. Every damaging Q now carves off a percentage of each enemy\'s health on top of its normal damage, so Arcane Nova still takes a real bite out of a floor-25 horror instead of tickling it. Bosses only give up a third of that bonus, so nothing melts the big fights.',
        'Hover your Q icon to see your rank AND the ladder of secret upgrades waiting at ranks 4, 8 and 12. They say "coming soon" because they are: each batch arrives in an upcoming update, and some of them are ridiculous. Start saving your stat points.',
      ],
    },
    {
      v: 'v2.94', title: 'The leaderboard learns your name', date: '2026-07-15',
      sha: '506a958',
      items: [
        'The global leaderboard now shows your character\'s actual NAME. Your name has been going up with every score since the rename update, but the board was quietly chopping it to the first 3 letters, arcade style, so SAMUEL showed up as SAM. Now up to 12 letters of your name make it onto the board. No typing when you die either: if you have a name, your score signs itself.',
        'Old scores that were already saved as 3 letters stay 3 letters. Beat them and take the spot with your full name.',
      ],
    },
    {
      v: 'v2.93', title: 'Friendly fire: the first taste of PVP', date: '2026-07-15',
      sha: '2d41ff0',
      items: [
        'The first step toward player-vs-player is here: FRIENDLY FIRE. On the host lobby screen there is a new toggle under START GAME. Flip it ON and for that whole run your swords, arrows and fireball blasts hurt your teammates just like they hurt monsters, with their armor and dodge-invincibility still protecting them. It works both ways, so watch your aim and watch your back.',
        'Normal co-op is completely unchanged: the toggle starts OFF every time, and with it off nobody can hurt a teammate, same as always.',
        'This is chaos mode for now, but it is also the foundation. The plan on the workbench: a proper battle royale mode where you both spawn in far corners of the dungeon, gear up fast, and the last champion standing takes the crown.',
      ],
    },
    {
      v: 'v2.92', title: 'Co-op runs heal themselves now', date: '2026-07-15',
      sha: '7c76880',
      items: [
        'The big one: important co-op messages can no longer get lost. Before this, if your WiFi hiccuped at the wrong instant, the message saying "we went down a floor" or "your teammate revived you" could vanish into the void and the game had no way to notice. Now every important event is remembered, and the moment your connection comes back, everything you missed is delivered, each thing exactly once, never twice. Kills, revives, floor changes, XP, mimics, trap doors, level-up locks: all of it.',
        'The host now also sends a little "state of the world" report every few seconds: which floor we are on, the alarm level, which rooms are cleared, which traps have sprung. If your copy of the dungeon ever drifts out of step, it quietly snaps back within seconds instead of staying wrong for the rest of the run. If a future bug sneaks in, it now heals itself instead of ruining your game.',
        'Found and fixed a deep connection bug while testing: when the game hung up a dead connection on purpose, the server never said goodbye back, so the reconnect could stall for a very long time. Reconnects after a hiccup are now near-instant.',
        'Kill rewards now find you even if your connection blipped at the exact moment you landed the killing blow.',
      ],
    },
    {
      v: 'v2.91', title: 'Your teammate looks like themselves again, not their weapon', date: '2026-07-15',
      sha: 'fc687e8',
      items: [
        'Fixed the co-op costume mix-up: your teammate\'s body was being painted the color of whatever WEAPON they were holding, so a friend with a golden hammer looked like a golden blob and changed color with every weapon swap. Teammates now wear their true colors: their normal blue, their beast shape if they are a shifted druid, or their evolution robes once their build recolors them. You can even tell what path your teammate evolved down just by looking at them, exactly like on their own screen.',
      ],
    },
    {
      v: 'v2.90', title: 'Co-op: your kills count for YOU, mimics wake for everyone, steadier connections', date: '2026-07-15',
      sha: '87b7328',
      items: [
        'Your kills belong to YOU now. Before this, when the second player landed the killing blow, the HOST got the kill count, the life-steal, the speed boost, the achievement progress and the bonus gold chance. Now whoever actually got the kill gets all of it: kill streaks, Vampiric healing, Momentum speed, Soul Feast, quest progress, everything. Gold drops even check the killer\'s own Looting enchant.',
        'Mimics are a shared surprise now. When one player opens a chest with teeth, the chest snaps open on BOTH screens and the mimic is real for both of you. Before, only the player who opened it saw the monster, and the game quietly deleted their reward a second later. Same fix for trap rooms: the ambush always springs, even if your teammate opened the chest while you were rooms away.',
        'The alarm level (the thing that makes floors angrier and loot richer) finally syncs to the second player. Both of you now see the same danger and get the same loot bonuses.',
        'Fixed a rare mix-up where messages from the PREVIOUS floor could mess with the floor you just arrived on. Every sync message is now stamped with its floor and old ones get thrown away.',
        'Fixed the standoff where both players pressed PLAY AGAIN at the same moment and the game froze with each waiting for the other. Now the game instantly picks one of you to lead and you both drop into the same fresh run.',
        'Door pressure plates now count the players who are actually still playing. A teammate who retired to the menu no longer seals you behind a two-player door alone.',
        'The connection now sends a tiny heartbeat every few seconds. If the line goes quiet (flaky WiFi, sleeping laptop), the game notices in seconds instead of waiting around, hangs up and reconnects on its own.',
      ],
    },
    {
      v: 'v2.89', title: 'Bosses fight the whole party now', date: '2026-07-15',
      sha: 'e0bf9ff',
      items: [
        'HUGE co-op fix: bosses finally fight BOTH players. Before this, the second player could not see a single boss bullet and could not be hit by one either, and every boss only ever chased the host. Now every coin barrage, venom fan, spiral nova and all nine Hell ultimates appear on both screens, bosses pick whoever is closest and commit to the chase, and their lunges, slams and shockwave rings hit anyone standing in the wrong place. Falling boulders and airstrikes show their shadow on both screens too.',
        'Second-player abilities got a deep repair. Heavy-weapon staggers, Chain Lightning and Executioner now actually work when the second player lands them. Inferno, Time Stop, Deep Freeze, War Shout, Caltrops and Midas now really affect the monsters instead of doing nothing. And Vanish makes monsters genuinely lose track of you, whichever player you are.',
        'Fixed a sneaky connection bug where retrying a room code could leave TWO invisible connections running: everything counted twice (double damage, double gold) and you could even see a ghost copy of yourself. One player, one connection, always.',
      ],
    },
    {
      v: 'v2.88', title: 'Better legends, and a way to brag', date: '2026-07-15',
      sha: '8714521',
      items: [
        'The fallen-raider poems got a real rewrite. They are not all Homer anymore: some read like tavern arguments, some like warnings, some like entries in a ledger of the fallen. The five poems on the top-5 board are now guaranteed to each open a different way, and a certain overused word is gone for good.',
        'There is a SHARE THIS FEAT button on every raider card now. Click it and the whole thing (name, class, score, floor, kills, the poem, and a link to the game) is copied, ready to paste to your friends as bragging rights.',
      ],
    },
    {
      v: 'v2.87', title: 'Guest necromancers raise their dead', date: '2026-07-15',
      sha: '8350ec5',
      items: [
        'NECROMANCER fix for co-op. If you played necromancer as the second player, your kills never raised skeletons at all (the game was only checking the host). Now the skeleton rises for whoever actually landed the kill: your kills feed YOUR army, your teammate\'s kills feed theirs. Every skeleton belongs to exactly one player, which also puts an end to the weird minion doubling some of you saw.',
      ],
    },
    {
      v: 'v2.86', title: 'The forge shows its work before you pay', date: '2026-07-15',
      sha: '6860e1a',
      items: [
        'The FORGE and the TAILOR work like the enchant table now. Use one and it lays out THREE finished pieces side by side, with their damage or protection and all their enchantments, before you spend anything. Click the one you want (or press 1, 2 or 3) and only then do you pay the gold and shards. Press Esc to walk away without paying a coin. No more paying first and hoping.',
      ],
    },
    {
      v: 'v2.85', title: 'Mythic armor actually protects + Q grows with your build', date: '2026-07-15',
      sha: 'f33c55b',
      items: [
        'Big fix: MYTHIC ARMOR was secretly giving ZERO damage reduction. A math bug rounded its protection away, so the rarest armor in the game protected worse than common gear. Every mythic now blocks 19 to 28 percent of damage, comfortably above legendary. If you own one, put it back on.',
        'Your Q ability now grows with your CLASS STAT, not just your level. Every point you put into your class\'s main stat makes your Q hit 4 percent harder: a mage\'s ARCANE feeds Arcane Nova, a cleric\'s VIGOR makes Mend heal more, a ranger\'s AGILITY sharpens Tumble Volley, a warrior\'s MIGHT powers Shield Bash. Hover your Q icon to see which stat is yours. Building your class the way it wants to be built finally pays off in your ability too.',
      ],
    },
    {
      v: 'v2.84', title: 'Your name on the board, your face on the sheet', date: '2026-07-15',
      sha: '04b09f7',
      items: [
        'The character sheet finally shows YOUR class in the portrait. It was drawing the plain Adventurer for everyone, no matter who you picked.',
        'High scores belong to YOUR NAME now. Set your name once (press N on the title screen, top-right shows who you are playing as) and every high score lists under it automatically, no more typing a name at the death screen. If you have never set a name, the death screen asks once and remembers it.',
      ],
    },
    {
      v: 'v2.83', title: 'Scrap trinkets for shards', date: '2026-07-15',
      sha: '43d04cf',
      items: [
        'You can now scrap TRINKETS with X, just like weapons and armor. Pressing X on a dropped trinket used to do nothing at all. Now it breaks into salvage shards, and the fancier the trinket, the more shards you get. More fuel for honing and the crafting corner.',
      ],
    },
    {
      v: 'v2.82', title: 'Level up without stopping the fight', date: '2026-07-15',
      sha: 'f5fccaa',
      items: [
        'BIG CHANGE to leveling up: the game does not stop anymore. When you level up, you bank a POINT (you will see a gold message at the bottom of the screen). Open the character menu with C whenever YOU want, and spend your points there: three cards per point, click the one you like, and if you have more points you immediately get three fresh cards for the next one. No more choice screens freezing you mid-fight, and in co-op nobody gets stuck waiting while their teammate reads the options. Evolutions and the ultimate offer still get their own big moment screens.',
        'The trap room\'s chest no longer has a sign over it. A chest that announces itself is bad bait.',
      ],
    },
    {
      v: 'v2.81', title: 'More co-op fixes from tonight\'s playtest', date: '2026-07-15',
      sha: 'b3e0935',
      items: [
        'Three more fixes from tonight\'s co-op session. If a teammate leaves the run, the door plates now count only the players still here, so the rest of you can keep going instead of being locked in a room forever. The cleric\'s Mend finally heals TEAMMATES standing in range, not just the cleric (you will see MENDED pop up when a friend heals you). And when one player haggles with a shopkeeper, the win or the loss now hits BOTH players\' prices and both of you see the result.',
      ],
    },
    {
      v: 'v2.80', title: 'Co-op playtest hotfixes', date: '2026-07-15',
      sha: '2393d80',
      items: [
        'A monster stuck inside a wall where you could not reach it (and it locked the doors forever) now pops itself free automatically.',
        'Co-op fixes from tonight\'s playtest, thank you for the bug reports! The pyromancer\'s fire now shows up on your teammate\'s screen, and a non-host pyro\'s Immolate actually burns things now (before, it secretly did nothing). Mines on the ground are visible to BOTH players. A teammate picking their level-up no longer vanishes from your screen: they stay put with a little CHOOSING tag over their head, so you know why they stopped moving. PLAY AGAIN after a co-op run now starts a fresh run with the whole party together instead of splitting everyone up. And a WiFi hiccup no longer teleports the second player back to the first room.',
      ],
    },
    {
      v: 'v2.79', title: 'Spring cleaning under the hood', date: '2026-07-15',
      sha: '2a10353',
      items: [
        'No new toys in this one, just tidying. We swept out some dead code under the hood and made a few co-op internals more reliable. Everything plays exactly the same, only cleaner on the inside.',
      ],
    },
    {
      v: 'v2.78', title: 'The nine faces of Hell', date: '2026-07-15',
      sha: '915da2d',
      items: [
        'Every boss in Hell finally LOOKS like the legend it is named after. CHARON is a hooded ferryman sweeping a great oar. MINOS the judge sits coiled in his own monstrous tail. CERBERUS is three snapping dog heads on one body, jaws working out of time with each other. PLUTUS is a bloated hoarder with coins embedded in his flesh, muttering to himself. PHLEGYAS burns as he punts his skiff across the Styx. MEDUSA has eight living snakes for hair, and you should not meet her eyes. THE MINOTAUR lowers two huge horns and breathes steam. GERYON has the calm, honest face of a kind man on the body of a winged serpent with a scorpion sting. And LUCIFER himself waits at the bottom, three faces under one crown, frozen to the waist in ice, beating wings that keep the lake frozen forever.',
      ],
    },
    {
      v: 'v2.77', title: 'The shop has a forge now', date: '2026-07-15',
      sha: '457cf58',
      items: [
        'The shop got a CRAFTING CORNER, right next to the enchant table. Stand at the glowing ANVIL and press E to forge a brand new weapon of the same kind you are holding (a bow user forges a bow, a blade user forges a blade). Stand at the MANNEQUIN to have a fresh piece of armor tailored. Crafting costs gold plus salvage shards (press X near dropped gear to break it into shards), and everything you craft is decent quality or better, never junk. Each craft costs a little more than the last, so you cannot just print gear all day.',
      ],
    },
    {
      v: 'v2.76', title: 'Pocket a potion for later', date: '2026-07-15',
      sha: '30b961a',
      items: [
        'You can CARRY A POTION now. Buying one at the shop no longer drinks it on the spot: it goes into a new flask slot in your gear bar (fifth from the left), and you drink it whenever you want with H. Heals 40 health. You can only carry one at a time, so spend it wisely. Monsters also very rarely drop a flask, so keep an eye out for a little red bottle on the ground.',
      ],
    },
    {
      v: 'v2.75', title: 'Wrath smoke + the dungeon fights back', date: '2026-07-15',
      sha: '5b45e5e',
      items: [
        'The TERRACE OF WRATH finally looks like wrath instead of a copy of Envy. Banks of bitter black smoke now drift visibly across the whole room, and monsters loom out of them. Envy stays a clean circle of darkness around you; Wrath is a room full of rolling smoke. Two very different kinds of blind.',
        'The dungeon FIGHTS BACK now. Clear enough rooms on a floor and the alarm goes up: from then on, monsters are not standing around waiting when you walk in. They are already facing your door with weapons up and they come at you almost instantly. Push the alarm even higher and the dungeon starts laying GLUE TRAPS by your door before you even arrive. The message on your screen says it best: THEY KNEW YOU WERE COMING.',
      ],
    },
    {
      v: 'v2.74', title: 'Flash-blind bolts and a shadow over the forest', date: '2026-07-15',
      sha: '880ad3d',
      items: [
        'The GLASS mob (the fragile bright artillery one) learned a dirty trick. When it glows empowered, its scatter shot becomes a white FLASH-BOLT: take a hit and your vision closes down to a small circle around you for two seconds, exactly like the Terrace of Envy darkness. Dodge the bright ones.',
        'Keep an eye on the ground in the Whispering Forest. Every few rooms, the shadow of something ENORMOUS glides across the floor, wings beating slowly. It cannot hurt you. Probably.',
      ],
    },
    {
      v: 'v2.73', title: 'Trap rooms: that chest is bait', date: '2026-07-15',
      sha: '51aea42',
      items: [
        'TRAP ROOMS are in the dungeon now. On the map it looks exactly like a treasure room, and inside there is just one big locked chest sitting alone in the middle. Open it if you dare: the doors slam shut behind you and a nasty ambush pours in, a wave tougher than a normal room. Kill every last one and the doors unseal, and the chest finally gives up its prize: two pieces of quality gear and a pile of gold. Free loot is never free.',
      ],
    },
    {
      v: 'v2.72', title: 'New mob: the snowman', date: '2026-07-15',
      sha: 'd16cb23',
      items: [
        'A SNOWMAN now haunts the deeper floors: three balls of snow, coal eyes, carrot nose. He waddles slowly, but do not let that fool you. He rears back, takes aim, and fires an ICICLE that is the fastest shot any monster has, faster than anything you have dodged before. If it hits, you are FROZEN solid in a block of ice for a moment while everything closes in. The long wind-up is your warning: when the snowman leans back, MOVE.',
      ],
    },
    {
      v: 'v2.71', title: 'New mob: the glue gunner', date: '2026-07-15',
      sha: '78eea63',
      items: [
        'A new GLUE GUNNER mob joins the dungeon: a squat little workman with a fat glue gun. He lobs a slow yellow blob at you, and if it hits, your boots gum up and you move at about half speed for a couple of seconds. Wherever the blob lands it leaves a sticky puddle on the floor for a while, and the glue does not care whose side you are on: monsters that chase you through the puddle get stuck slow too. Bait them into it.',
      ],
    },
    {
      v: 'v2.70', title: 'Softer music, darker darkness, better eulogies', date: '2026-07-15',
      sha: 'd40c5af',
      items: [
        'The title-screen song is quieter now and gently fades in when you arrive and fades out when you start a run, instead of cutting on and off.',
        'On the Terrace of Envy the darkness no longer switches off while you pick a level-up. The blindness holds through every menu, the way a terrace of sewn-shut eyes should.',
        'The fallen-raider cards got three fixes. Every top raider now gets their OWN eulogy poem (no more repeats). If a card has no saved portrait it draws your class portrait instead of an empty circle. And the card now always knows which floor the raider fell on.',
      ],
    },
    {
      v: 'v2.69', title: 'Co-op hardening: floor-stamped room follows', date: '2026-07-15',
      sha: 'f943fb3',
      items: [
        'One more co-op safety fix: right around a floor change, the game could briefly try to pull you toward your teammate\'s OLD room from the previous floor and drop you somewhere crazy. Every follow-your-teammate move now checks you are both on the same floor first.',
      ],
    },
    {
      v: 'v2.68', title: 'Co-op: boss kills no longer eject your teammate', date: '2026-07-15',
      sha: 'a131540',
      items: [
        'Fixed a nasty co-op bug: when your team killed a boss in Hell, the player who was NOT hosting got thrown to the victory and high-score screen in the middle of the run, as if the game had ended, while the host kept playing alone. Now both players celebrate the kill together and both get the portal down to the next circle.',
      ],
    },
    {
      v: 'v2.67', title: 'Co-op: see your teammate\'s army', date: '2026-07-15',
      sha: 'd98400a',
      items: [
        'In co-op you can finally see your teammate\'s whole army. A necromancer friend\'s skeletons, a mesmer\'s mirror clones, hired mercenaries, a summoner\'s elemental and even their pet all show up on your screen now, drawn slightly ghosted so you can tell whose units they are. No more invisible skeleton armies winning fights around you.',
      ],
    },
    {
      v: 'v2.66', title: 'Co-op: reconnect-proof', date: '2026-07-15',
      sha: '6eab0f9',
      items: [
        'Big co-op stability update. If your game crashes or your page reloads mid-run, you can now rejoin with the same room code and land right back in the run with your friend, on the same floor. A short WiFi blip no longer scrambles the game (that was the real cause of duplicated players and empty rooms with no monsters). If you fall way behind your teammate, the game now catches you up to their room even across the map. And if the host truly leaves, you get a clear "host left" message instead of a frozen empty dungeon.',
      ],
    },
    {
      v: 'v2.65', title: 'Co-op: no more phantom mobs locking the room', date: '2026-07-15',
      sha: 'f9f80a4',
      items: [
        'Fixed a big co-op bug. Sometimes one player would see a monster that could not be hurt and would not die, and it kept the doors locked so nobody could leave the room. It happened when the two players were briefly in different rooms and one of them kept seeing the other room\'s monsters like ghosts. Now the game keeps track of which room each monster is really in, so you only ever see the monsters in the room you are actually standing in.',
      ],
    },
    {
      v: 'v2.64', title: 'Character sheet is readable again', date: '2026-07-15',
      sha: '9d7ee83',
      items: [
        'Fixed the character sheet (the screen you open with C). The mini-map in the top corner used to show faintly through the stats on the right side and made the text look like a jumbled mess. The whole screen is solid black now, so every stat is clean and easy to read.',
      ],
    },
    {
      v: 'v2.63', title: 'Portal labels fixed, trinket tooltips added', date: '2026-07-15',
      sha: '18c6351',
      items: [
        'Fixed the two exit portals at the bottom of each Hell floor. Their labels used to run into each other and become impossible to read. Now the normal one just says DESCEND and the red one says NIGHTMARE with a small "harder, richer" note under it, so you can always tell them apart.',
        'You can now hover your mouse over the trinket in your gear slots (the little gem, fourth from the left) to see what it does and read its story, just like your weapons and armor. It no longer shows a price, since you already own it.',
      ],
    },
    {
      v: 'v2.62', title: 'The doppelganger is a real fight now', date: '2026-07-15',
      sha: '2f79e62',
      items: [
        'The DOPPELGANGER that wears your face is a real fight now. It used to pop in one blast and just stand there, so you never actually dueled your shadow. Now it has roughly three times the health, so it survives your opening ultimate and trades blows with you. It comes at you the instant you walk in, and its ranged copy circles and strafes instead of standing still like a target dummy. Beating your twin finally means something.',
      ],
    },
    {
      v: 'v2.61', title: 'Training barracks no longer breaks the game', date: '2026-07-15',
      sha: 'ce2e87f',
      items: [
        'The TRAINING BARRACKS got a big rebalance. Before, every barracks room started its prices back at 30 gold, so anyone rich enough could stack up huge stat boosts on every floor and blow through the whole dungeon. Now the price climbs every single time you train, no matter which barracks you are in, and you can only train 12 times in a whole run. Once you hit the limit the stations read MAXED. The barracks is still a great way to spend gold, but it will not carry you to the end by itself anymore.',
      ],
    },
    {
      v: 'v2.60', title: 'Magic panther: a cloaking cat that bleeds you', date: '2026-07-15',
      sha: '5ba7768',
      items: [
        'A new MAGIC PANTHER prowls the deeper floors. It vanishes into thin air, blinks to your side or behind you, then reappears in a shower of purple sparks to rake you. Its claws leave you BLEEDING, so you keep losing health for a few seconds after it hits. Watch for the faint shimmer to spot where it went.',
      ],
    },
    {
      v: 'v2.59', title: 'Poison Miasma is a real ultimate now', date: '2026-07-15',
      sha: '74be435',
      items: [
        'The POISON MIASMA ultimate is a real heavy-hitter now. It was a weak little cloud; now it does double the damage per second, lasts longer, and covers a much bigger area, so it rots a whole room to death like Meteor, Inferno and Cataclysm do. If you like the poison build, it finally pays off.',
      ],
    },
    {
      v: 'v2.58', title: 'Watch the ceiling: falling stalactites underground', date: '2026-07-15',
      sha: '3afee02',
      items: [
        'The underground floors now have falling stalactites. Every few seconds a rock breaks off the ceiling, and a dark shadow on the ground shows exactly where it is about to land. Get out of the shadow before it drops or it will crush you. It hits harder the deeper you go, so keep one eye on the ceiling.',
      ],
    },
    {
      v: 'v2.57', title: 'The title screen has a theme song', date: '2026-07-15',
      sha: '98745e8',
      items: [
        'The main menu has a theme song now, made just for the game. It starts playing on the title screen as soon as you click or press a key (browsers will not play sound until you do), and it stops the moment you begin a run. You can silence it with the mute button like everything else.',
      ],
    },
    {
      v: 'v2.56', title: 'See your co-op teammates shapeshift', date: '2026-07-15',
      sha: 'b06b7e7',
      items: [
        'In co-op you can now see your teammates shapeshift. When a druid friend turns into a bear or a wolf, everyone sees the beast now, the right size, color and animal head, instead of their normal body.',
      ],
    },
    {
      v: 'v2.55', title: 'Level-ups wait until the fight is over', date: '2026-07-15',
      sha: '0dc86c6',
      items: [
        'Level-up cards, evolution picks and the ultimate choice no longer pop up in the middle of a fight. They now wait politely until you have cleared the room, so a choice screen never freezes you while enemies are still swinging at you. In a safe room like a shop, they still appear right away.',
      ],
    },
    {
      v: 'v2.54', title: 'Type a real name on the leaderboard', date: '2026-07-15',
      sha: 'd8862e2',
      items: [
        'When you get a high score you can now type a real name up to 10 characters long, instead of just three arcade initials. Type your name, use Backspace to fix mistakes, Enter to lock it in. Shorter names are fine too.',
      ],
    },
    {
      v: 'v2.53', title: 'Leaderboard shows each player once', date: '2026-07-15',
      sha: 'ecc1892',
      items: [
        'The leaderboard no longer lists the same player twice. You cannot be both first and second anymore. Everyone shows up once, with their best score only.',
      ],
    },
    {
      v: 'v2.52', title: 'Class fixes: stronger Mesmer clones, a real Necromancer, no more Owl', date: '2026-07-15',
      sha: 'f81f30c',
      items: [
        'Three class fixes from playtesting. The MESMER\'s mirror-image clones were way too weak: they now have more than double the health, move much faster, and hit as hard as you do, so they actually fight for you instead of popping instantly. The NECROMANCER now feels like a real necromancer: on top of Raise Dead, enemies you kill rise back up as skeletons to serve you, so you build an army straight off the battlefield. And the DRUID lost the Owl form, which was just a slower, weaker Wolf. You now shift between two clear opposites: the tanky Bear and the fast, hard-hitting Wolf.',
      ],
    },
    {
      v: 'v2.51', title: 'Every Hell boss now has a signature ultimate', date: '2026-07-14',
      sha: '5cf2ce9',
      items: [
        'Every boss in Hell now has its own special attack that it unleashes the moment the fight starts, and again every 5 seconds, on top of everything else it does. Charon throws up a wall of bolts with one gap to slip through, Cerberus bites in three directions at once, Plutus erupts in rings of cursed gold, the Minotaur gores in a wide charge, and Lucifer freezes the whole room with a giant double ring. Each one is dodgeable, but you have to be paying attention, so the boss fights are never a moment of calm now.',
      ],
    },
    {
      v: 'v2.50', title: 'The bear is a bigger target, and a tougher one', date: '2026-07-14',
      sha: 'f049a61',
      items: [
        'The bear is a bigger target now, and its hide makes up for it.',
      ],
    },
    {
      v: 'v2.49', title: 'See what you shifted into', date: '2026-07-14',
      sha: 'a28fc68',
      items: [
        'You can now see which druid form you are in.',
      ],
    },
    {
      v: 'v2.48', title: 'Class descriptions you can actually read', date: '2026-07-14',
      sha: '56f901d',
      items: [
        'Class descriptions no longer hide behind the side boxes.',
      ],
    },
    {
      v: 'v2.47', title: 'Five new classes and five bloodlines', date: '2026-07-14',
      sha: '711b919',
      items: [
        'Five new classes: Mesmer, Druid, Death Knight, Necromancer and Pyromancer.',
        'Pick your blood: Human, Orc, Elf, Dwarf or Undead, and a class list that scrolls.',
      ],
    },
    {
      v: 'v2.46', title: 'Nine circles, nine bosses', date: '2026-07-14',
      sha: 'd290020',
      items: [
        'Every one of the nine circles of Hell now has its own boss guarding the way down, straight out of Dante. You will face Charon the ferryman, Minos the judge, the three-headed hound Cerberus, Plutus, Phlegyas, Medusa, the Minotaur, Geryon, and finally Lucifer himself frozen at the very bottom. Each one is a real figure from the story, wears the colors of its circle, and gets tougher the deeper you go. Look them up, they are all real.',
      ],
    },
    {
      v: 'v2.45', title: 'The descent is now a real gauntlet', date: '2026-07-14',
      sha: '3d92d1e',
      items: [
        'The descent is a real gauntlet now. The deeper you go into Hell, the tougher the enemies get, and by the frozen lake at the very bottom it is brutal, so reaching the end of the Inferno is a genuine badge of honor only the best will earn. And here is the twist: grinding levels does NOT make it easier. The dungeon watches how high your level is and matches you, so piling on levels just makes the monsters tougher too. The only way to break through is a truly great build, not a big level number. (These numbers are a first pass and will get tuned.)',
      ],
    },
    {
      v: 'v2.44', title: 'Twin portals: brave the Nightmare for a richer haul', date: '2026-07-14',
      sha: 'e375348',
      items: [
        'At the end of every floor on the way down, there are now TWO ways forward. The normal exit takes you to the next floor like always. But a second, glowing red NIGHTMARE portal opens right beside it. Take that one and the next floor is much deadlier (enemies are tankier, hit harder, and more of them are elites), but it pays out a lot more gold and XP. It is a real risk-for-reward choice, and in co-op the whole party follows whoever steps through.',
      ],
    },
    {
      v: 'v2.43', title: 'Mythic trinkets: the legendary fourth slot', date: '2026-07-14',
      sha: 'a92c730',
      items: [
        'There are now MYTHIC TRINKETS, the legendary version of the fourth slot. Six of them, each named after a real myth: Prometheus\' Ember, Aegis of Athena, Vial of Ambrosia, Philosopher\'s Stone, Mjolnir\'s Splinter, and Pandora\'s Locket. Like all trinkets they give one big gift for one real price, just bigger on both ends. You can only find them in the secret mythic shop that shows up every 5 floors, where one now sits next to the mythic weapons and armor.',
      ],
    },
    {
      v: 'v2.42', title: 'Fix black screen when looking at a trinket in a shop', date: '2026-07-14',
      sha: '0894853',
      items: [
        'Fixed a nasty crash: walking up to a trinket for sale (or one dropped on the ground) turned the whole screen black. The little info card that pops up was choking on the price. It shows the price properly now, and the card can never crash the game like that again.',
      ],
    },
    {
      v: 'v2.41', title: 'Eulogy sits beside the portrait and names the place they fell', date: '2026-07-14',
      sha: 'ed6cad6',
      items: [
        'The hero eulogy now shows UNDER the portrait, not instead of it, so you get both the picture and the poem. The card grows to fit so the whole thing always stays inside the box. The poem also names the weapon plainly (no plus-levels or enchant tags) and names the actual place they fell, like the Whispering Forest or the Fraud Circle, instead of just a floor number.',
      ],
    },
    {
      v: 'v2.40', title: 'Fallen raiders get a Homeric eulogy', date: '2026-07-14',
      sha: '27c67ce',
      items: [
        'The top players on the global leaderboard do not have a saved picture, so their card used to have a blank spot where the face goes. Now the game writes each of them their own little poem instead, in the old epic style, like something Homer would read at a hero\'s funeral. It names their class, their best stat, the weapon they carried, the ultimate they unleashed, and the floor they fell on. Every player always gets the same poem, so it is truly theirs.',
      ],
    },
    {
      v: 'v2.39', title: 'Fix the fallen-hero card: no more NaN, fits the box', date: '2026-07-14',
      sha: '05da92f',
      items: [
        'Fixed the fallen-hero card you get when you click a raider. Older scores from before we added some stats were showing "NaN%" in the STATS line, and a fully loaded hero could spill outside the box. Now every stat shows a real number and the whole card fits neatly.',
      ],
    },
    {
      v: 'v2.38', title: 'See a top raider\'s loadout from the main page', date: '2026-07-14',
      sha: '356fadd',
      items: [
        'You can now click any of the top 5 names in the TOP RAIDERS box on the main menu to see exactly what that player was running when they fell, their class, weapons and upgrades. A little magnifier shows which names you can click. Before, you had to open the full high-scores board to peek at a loadout.',
      ],
    },
    {
      v: 'v2.37', title: 'Meet your Shadow: the Doppelganger is now a mini-boss', date: '2026-07-14',
      sha: 'cf0790b',
      items: [
        'The Doppelganger is a real mini-boss now. It used to just be one more enemy in the crowd deep in the dungeon. Now, every so often on the deeper floors, you will find a room with a single shadow of yourself waiting. It wears your face, copies your weapon, has a big pile of health that scales with yours, and fights you one on one. Beat your own shadow for a fat reward. It shows up in the same spot for everyone in co-op.',
      ],
    },
    {
      v: 'v2.36', title: 'Ultimates match your build and shake the whole dungeon', date: '2026-07-14',
      sha: '69b3f32',
      items: [
        'Ultimates got a big upgrade. The three ultimates you get to choose from now lean toward the build you have been making, so if you stacked crit and damage you are far more likely to be offered the huge CATACLYSM blast, while a gold-hungry build sees the MIDAS wave. You can still get any of them, but the choices feel like yours now.',
        'Casting an ultimate is a real event now. The whole screen flashes in the ultimate color, its name slams across the middle in giant letters, and everything shakes, so the whole dungeon knows you just let one loose. In co-op your teammates see the flash too.',
        'Ultimates also hit harder and last longer, with a longer cooldown to match, so each one is a rarer and bigger moment.',
      ],
    },
    {
      v: 'v2.35', title: 'HUD bars are now labeled', date: '2026-07-14',
      sha: 'edfe4ac',
      items: [
        'The bars in the top-left corner now have little labels so you know what they are. The top red bar is your HP (health), the purple one under it is your XP (how close you are to leveling up), and the thin one below that is the ALARM meter. The alarm climbs every time you clear a room, and the higher it gets the tougher the rooms are, but the better the loot.',
      ],
    },
    {
      v: 'v2.34', title: 'Hold E to keep training in the barracks', date: '2026-07-14',
      sha: '421af6c',
      items: [
        'In the training barracks you can now HOLD the E key at a station to keep buying stat boosts over and over, instead of tapping it once per purchase. It stops on its own the moment you run out of gold, so you can dump a big pile of coins fast.',
      ],
    },
    {
      v: 'v2.33', title: 'Meteor is now colossal', date: '2026-07-14',
      sha: 'c2838d4',
      items: [
        'The METEOR ultimate is now colossal. The blast is much wider, the rock plunges from way up high wrapped in fire and trailing embers, and when it lands it throws out a huge shockwave ring and fireball with a heavy screen shake and flying debris. Way more enemies get caught, and it finally feels as big as it sounds.',
      ],
    },
    {
      v: 'v2.32', title: 'Thorns now punish enemies that shoot you from range', date: '2026-07-14',
      sha: '89eb520',
      items: [
        'Thorns armour used to only hurt enemies that walked into you. Now it fights back against archers and gunners too. Take a hit from a shot and the enemy who fired it takes thorns damage right back, even from all the way across the room, with a little green spark so you can see it land.',
      ],
    },
    {
      v: 'v2.31', title: 'Ice floor now builds momentum when you commit to a direction', date: '2026-07-14',
      sha: 'daf3eb6',
      items: [
        'The frozen floor deep in the descent now feels like real ice. Hold one direction and you keep picking up speed like a skater, faster the longer you commit. Change direction and you lose the momentum and have to build it back up, so the trick is to pick a line and ride it.',
      ],
    },
    {
      v: 'v2.30', title: 'Formations spread out so one swing can\'t clear them', date: '2026-07-14',
      sha: '5576933',
      items: [
        'Enemy squads no longer bunch up in a tight line. They fan out in a curved wall now, so one big swing catches a couple of them instead of wiping the whole group at once.',
      ],
    },
    {
      v: 'v2.29', title: 'Chest Vacuum, Sloth, Multishot', date: '2026-07-14',
      sha: '2424718',
      items: [
        'Open a chest and the coins fly straight to you now, along with any loose coins in the room. No more walking over each one.',
        'The Terrace of SLOTH bites harder. Standing still used to chip a tiny fixed amount that meant nothing deep in the run; now it scales with your health, so it is always a real reason to keep moving.',
        'MULTISHOT now works on staffs. It only ever fired the extra shots on wands and bows before, so a multishot staff was throwing a single fireball. Now it throws three.',
      ],
    },
    {
      v: 'v2.28', title: 'Leaderboard Loadouts Clickable', date: '2026-07-14',
      sha: 'ae67d93',
      items: [
        'You can finally click the top scores on the leaderboard to see what they were running. It was there all along, just not clickable. Old scores from before this feature stay blank, but every new run records its loadout.',
      ],
    },
    {
      v: 'v2.27', title: 'Death Fix and Jupiter Balance', date: '2026-07-14',
      sha: 'e68a119',
      items: [
        'Fixed a bad one: you could end up at negative health and keep playing. Now zero health means you actually die, no matter what dealt the blow.',
        'And the Sphere of JUPITER is fairer. It reflects a share of the damage you deal back at you, but cleaving a whole crowd used to reflect thousands at once and kill you instantly. That reflection is now capped, so it is a real cost without being a death sentence.',
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
