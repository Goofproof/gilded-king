// ============================================================================
// eulogy.js - a Homeric eulogy for a fallen raider (Sam, 2026-07-14).
//
// The global leaderboard's top raiders carry no portrait (the avatar PNG is too
// big to store server-side), so the snapshot card had a blank where the face
// goes. Instead we sing them a short epic eulogy, generated from their own run:
// their primary weapon, their signature stat, and the ultimate they wielded.
//
// PROCEDURAL + DETERMINISTIC, on purpose. The card redraws every frame and the
// game has no backend to call an AI, so the verse is built from an epithet
// grammar seeded off the player's own initials + score. Same raider, same poem,
// every time - no flicker, no cost, no network. It just reads as if written for
// them. Returns an array of lines (2-4); drawScoreSnap lays them out.
// ============================================================================
const Eulogy = (() => {

  // FNV-1a hash -> a stable 32-bit seed from the raider's identity.
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // mulberry32: a tiny seeded PRNG so word choices are fixed per raider.
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[(r() * arr.length) | 0];
  const num = (v, d) => (Number.isFinite(+v) ? +v : d);
  const titleCase = w => String(w || '').toLowerCase().replace(/\b\w/g, m => m.toUpperCase());

  // the stored weapon name is a full display name - "Doomcleaver +5 [Sharpness III,
  // Fire Aspect]". #152 (Sam) the verse wants the bare weapon, no hone level or enchants.
  const cleanWeapon = n => String(n || '').replace(/\s*\[[^\]]*\]/g, '').replace(/\s*\+\d+/g, '').trim();

  // #152 the floor's NAME, not "floor 11" - "the Lust Circle", "the Whispering Forest".
  // Dungeon.themeFor dispatches to the right place (castle themes / circles / terraces /
  // spheres). Drop the leading article and any "· DEEPER" tail; the template re-adds "the".
  function floorName(f) {
    if (f == null) return null;
    let nm = null;
    try { if (typeof Dungeon !== 'undefined' && Dungeon.themeFor) nm = Dungeon.themeFor(f).name; } catch (e) { /* fall back to the number */ }
    if (!nm) return null;
    nm = String(nm).split('·')[0].trim().replace(/^THE\s+/i, '');
    // lower-case the little joining words so a place reads "Sphere of Jupiter", not "Of".
    return titleCase(nm).replace(/\B(Of|The|And|To|In|On)\b/g, m => m.toLowerCase());
  }

  // class -> a Homeric epithet pool. Keyed loosely by the class name so heavy
  // melee reads martial, casters read arcane, bows read far-shooting, etc.
  // Epithets follow "the" in the verse, so keep them clean noun/adjective forms
  // (no leading article, no full clause) - e.g. "NAME the bronze-girt".
  function classEpithets(className) {
    const n = String(className || '').toLowerCase();
    // #178 (Sam) pools doubled: with 3 options per slot two raiders collided on whole
    // verses far too often ("poem was the same as a prior poem").
    if (/barbar|warrior|paladin|knight|death/.test(n)) return ['bronze-girt', 'shield-breaker', 'line-stormer', 'iron-hearted', 'wall-of-the-host', 'first-through-the-gate'];
    if (/mage|cleric|summon|sorc|wizard|priest|pyro|necro|mesmer/.test(n)) return ['spell-wrought', 'storm-tongued', 'flame-speaker', 'rune-fingered', 'sky-caller', 'keeper-of-the-old-words'];
    if (/rang|engine|hunt|archer/.test(n)) return ['far-shooter', 'keen-eyed', 'dark-looser', 'string-singer', 'never-missing', 'stalker-of-the-tree-line'];
    if (/rogue|thief|assassin|shadow/.test(n)) return ['shadow-shod', 'swift-knived', 'wall-ghost', 'lock-whisperer', 'unseen-until-too-late', 'silent-stepping'];
    if (/druid/.test(n)) return ['beast-shaped', 'twice-skinned', 'friend-of-fang-and-claw', 'moon-called', 'wild-hearted', 'root-and-antler'];
    return ['wanderer', 'far-travelled', 'deep-roader', 'stranger-to-fear', 'lantern-bearer', 'last-of-the-lightfoot'];
  }

  const cap = w => { const t = String(w || ''); return t.charAt(0).toUpperCase() + t.slice(1); };

  // the raider's SIGNATURE stat: whichever of dmg / speed / crit / coins / magic stood
  // tallest. #269 (Sam) these are now short ADJECTIVE forms (not relative clauses) so they
  // flow anywhere in the ballad - "swift-footed they were", "and swift-footed to the last".
  function signature(r, s) {
    const cands = [
      { v: Math.round((num(s.dmgMul, 1) - 1) * 100), ep: ['mighty-armed', 'heavy-handed', 'strong past mortal measure'] },
      { v: Math.round((num(s.spdMul, 1) - 1) * 100), ep: ['swift-footed', 'quick as a rumor', 'never once cornered'] },
      { v: num(s.crit, 0), ep: ['keen-eyed', 'sharp past reason', 'deadly in a single stroke'] },
      { v: Math.round((num(s.coinMul, 1) - 1) * 100), ep: ['gold-hungry', 'a counter of coin', 'richer than sense'] },
      { v: (num(s.magic, 1) - 1) * 18, ep: ['ember-tongued', 'deep in the old arts', 'wreathed in borrowed fire'] },
    ];
    let best = cands[0];
    for (const c of cands) if (c.v > best.v) best = c;
    return pick(r, best.ep);
  }

  // #269 (Sam) a readable, singable name for the thing that felled the raider, for the fall
  // line. Bosses carry their own name; the common creatures get one here; unknowns go generic.
  const MONSTER_NAMES = {
    chaser: 'a Chaser', swarmer: 'a Swarmer', tank: 'a Juggernaut', archer: 'an Archer',
    bomber: 'a Bomber', worm: 'a burrowing Worm', shielded: 'a Shieldbearer', gluegunner: 'a Glue-Gunner',
    glass: 'a Glass Stalker', seeker: 'a Seeker', miner: 'a Miner', lobber: 'a Lobber', gunner: 'a Gunner',
    mage: 'a Hexer', snowman: 'a Snowman', panther: 'a Panther', pulser: 'a Pulser', summoner: 'a Summoner', add: 'a lesser spawn',
  };
  function killerName(k) {
    if (!k) return null;
    if (k.boss && k.name) return titleCase(String(k.name).replace(/^THE\s+/i, 'The '));
    if (k.name) return titleCase(k.name);
    if (k.type) return MONSTER_NAMES[k.type] || 'something in the dark';
    return null;
  }

  // Build the verse. Every load-bearing detail (weapon, signature stat, ultimate)
  // is drawn from the snapshot; missing fields degrade to a generic heroic line.
  function forSnap(s) {
    if (!s) return [];
    const name = (s.initials || '???').toUpperCase();
    // #178 the board RANK salts the seed; #208 (Sam) the OPENERS are structurally
    // different poems now - a boast, a warning, a ledger entry, a tavern tale - not
    // ten rewordings of the same Homeric invocation.
    const r = rng(hash(name + '|' + (s.score || 0) + '|' + (s.className || '') + '|' + (s.rank != null ? s.rank : '')));
    const classEp = pick(r, classEpithets(s.className));
    const aClass = (/^[aeiou]/i.test(classEp) ? 'an ' : 'a ') + classEp; // "an iron-hearted", "a lock-whisperer"
    const statEp = signature(r, s);
    const weapon = (s.weapons && s.weapons.length) ? cleanWeapon(s.weapons[0]) : null;
    const ult = s.ult ? titleCase(s.ult) : null;
    const place = floorName(s.floor);
    const kills = num(s.kills, 0);

    const slayer = killerName(s.killer);

    const lines = [];
    // #277/#279 (Sam) a rhyming BARD'S TALE with a RANGE OF MOODS - cheeky, fearful,
    // hopeful, fun, and grand-epic - so the Hall of Heroes is not one dirge sung ten times.
    // Two AABB couplets: couplet ONE = who they were + how they fought; couplet TWO = a
    // deed + the fall. The dynamic bits (name, class, weapon, stat, ult, and the FELLTHING
    // that got them) sit MID-line so every line ends on a fixed rhyme word no matter what
    // run built it. Shakespeare-license granted (Sam): bend a word, slant a rhyme, use an
    // "o'er" or an "aye" where it sings better than the strict form.

    // ONE adaptive fragment for whatever ended the run, usable mid-sentence in any couplet:
    // "a Chaser in the Lust Circle" / "a Chaser" / "the Lust Circle" / "the long dark".
    const fellThing = (slayer && place) ? `${slayer} in the ${place}`
      : slayer ? slayer
      : place ? `the ${place}`
      : 'the long dark';

    // Each tone owns a pool of opener couplets (c1) and fall couplets (c2). c1 weaves
    // name/class/weapon/stat; c2 weaves the ultimate + fellThing. All AABB.
    const TONE_POOLS = {
      // CHEEKY - the bard is roasting them, warmly. They had it coming and it is funny.
      cheeky: {
        c1: [
          [`Here lies ${name}, who really should have run;`,
           `${aClass}, sure - but the dark still won.`],
          [`Let's hear it for ${name}, who thought they were tough,`,
           weapon ? `swung the ${weapon} about, but not quite enough.` : `talked a big game, but it wasn't enough.`],
          [`Poor ${name}, so ${statEp}, so bold, so vain,`,
           `who strutted straight down and won't strut again.`],
          [`A moment of silence - then back to the ale -`,
           `for ${name} the ${classEp}, whose luck went stale.`],
        ],
        c2: [
          [ult ? `They flexed the ${ult}, gave a cocky little bow,` : `They blew the crowd a kiss, and boy, and how,`,
           `then ${fellThing} wiped that grin off, right now.`],
          [`They swaggered too far, as the cocky ones do,`,
           `and ${fellThing} sent them home with an I-told-you.`],
          [ult ? `Just one more ${ult}, they said - one more round -` : `Just one more room, they said, safe and sound,`,
           `then ${fellThing} put them flat on the ground.`],
          [`Let that be a lesson, you reckless young fool:`,
           `${fellThing} plays it forever cool.`],
        ],
      },
      // FEARFUL - dread and hush; the deep is a hungry thing. Leans archaic.
      fearful: {
        c1: [
          [`Speak soft the name ${name}, and speak it with dread,`,
           `${aClass} the barrow now counts with its dead.`],
          [`There walked in the deep one ${name} by name,`,
           weapon ? `and the ${weapon} they bore could not smother the flame.` : `and nothing they carried could smother the flame.`],
          [`Cold crept the dark where ${name} did tread,`,
           `${statEp}, aye - yet filled with a nameless dread.`],
          [`Hush now - do you hear it? The under-halls moan`,
           `the name of ${name}, who went down alone.`],
        ],
        c2: [
          [ult ? `They loosed the ${ult}, but the dark only grinned,` : `They prayed for the dawn, but the dawn was thinned,`,
           `and ${fellThing} closed in like a cold black wind.`],
          [`Something waited below where no torch dares go,`,
           `and ${fellThing} was the last thing they'd know.`],
          [ult ? `The ${ult} flared once, then guttered and died,` : `The last of their courage but guttered and died,`,
           `as ${fellThing} drew near, and there would they bide.`],
          [`The deep has a hunger, patient and old,`,
           `and ${fellThing} took ${name} down into the cold.`],
        ],
      },
      // HOPEFUL - they fell, but the light they carried outlasts them.
      hopeful: {
        c1: [
          [`Lift up your heads for ${name}, who tried,`,
           `${aClass} who walked with the light as their guide.`],
          [`Not every tale of the deep ends in gloom:`,
           `${name} the ${classEp} lit up the room.`],
          [`Sing high for ${name}, ${statEp} and true,`,
           weapon ? `who took up the ${weapon} and carried it through.` : `who carried a candle the whole journey through.`],
          [`They say that the barrow takes all that it can,`,
           `but ${name} burned bright as the long night began.`],
        ],
        c2: [
          [ult ? `They spent the last ${ult} to buy others time,` : `They held the line long past reason or rhyme,`,
           `and ${fellThing} could not stop the light in its climb.`],
          [`Yes, ${fellThing} was there at the end of the road,`,
           `but the fire they kindled is a lasting abode.`],
          [`The spark that they carried was a gift to us all,`,
           `and ${fellThing} could not darken that hall.`],
          [`They fell, yes, they fell - but they fell going on,`,
           `and ${fellThing} could not take the light they had drawn.`],
        ],
      },
      // FUN - a rollicking, silly romp. Sound effects welcome.
      fun: {
        c1: [
          [`Oh gather 'round for a rollicking song,`,
           `of ${name} the ${classEp}, who barreled along.`],
          [`Here's to ${name} - what a wonderful mess -`,
           `${statEp}, all grin and a great deal less sense.`],
          [weapon ? `Ka-pow went the ${weapon}, and down went the foes,` : `Ka-pow went their fists, and down went the foes,`,
           `for ${name} the ${classEp}, who struck a fine pose.`],
          [`They cannonballed down through the murk and the muck,`,
           `did ${name} the ${classEp}, on a wave of dumb luck.`],
        ],
        c2: [
          [ult ? `They hollered 'watch THIS!' and let the ${ult} fly,` : `They hollered 'watch THIS!' and gave it a try,`,
           `then ${fellThing} came by and said bye-bye.`],
          [`They juggled the danger, they danced and they spun,`,
           `till ${fellThing} showed up and spoiled the fun.`],
          [ult ? `Boom went the ${ult}, and boom went the hall,` : `Whee down the stairwells, and whomp down the hall,`,
           `then ${fellThing} tripped them, and that was all.`],
          [`What a ride, what a racket, what glorious din -`,
           `till ${fellThing} turned up with a grin.`],
        ],
      },
      // EPIC - the grand elegiac register (the champion's default).
      epic: {
        c1: [
          [`Gather close and hear the tale they tell:`,
           weapon ? `of ${name}, ${statEp}, who bore the ${weapon} well.` : `of ${name}, ${statEp}, who fought the dark and fell.`],
          [`They still sing of ${name} in the under-deep,`,
           weapon ? `who swung the ${weapon} that gave the dark no sleep.` : `whose ${statEp} step the black could never keep.`],
          [`Some go down for gold, and some for fame;`,
           `${name} the ${classEp} went down all the same.`],
          [`Mark the name well, for the barrow does too:`,
           `${name} the ${classEp}, who saw the deep through.`],
        ],
        c2: [
          [ult ? `They loosed the ${ult} when the end drew near,` : `They fought to the last with never a fear,`,
           `till ${fellThing} caught them, and left them here.`],
          [ult ? `The ${ult} bought a floor, and then one more,` : `Floor upon floor they ran up the score,`,
           `till ${fellThing} met them at the final door.`],
          [`They gave the deep more than the deep thought they could,`,
           `till ${fellThing} caught them for good.`],
          [`No name outlasts the whole of the night,`,
           `and ${fellThing} put out that light.`],
        ],
      },
    };

    // TONE choice: the visible top-5 get DISTINCT tones (champion sings epic; the rest
    // spread across the range) so the board always shows the full spread. Everyone else
    // draws a tone off their own seed.
    const TONES = ['cheeky', 'fearful', 'hopeful', 'fun', 'epic'];
    const TOP5 = ['epic', 'hopeful', 'fearful', 'cheeky', 'fun'];
    const tone = (s.rank != null && s.rank >= 0 && s.rank < 5) ? TOP5[s.rank] : pick(r, TONES);
    const pool = TONE_POOLS[tone];

    const c1 = pick(r, pool.c1);
    const c2 = pick(r, pool.c2);
    lines.push(c1[0], c1[1], c2[0], c2[1]);

    return lines;
  }

  // #208 a plain-text version of the whole feat, for the SHARE button: the headline,
  // the numbers, the poem, and the game link - ready to paste anywhere.
  function shareText(s, gameUrl) {
    if (!s) return '';
    const name = (s.initials || '???').toUpperCase();
    const parts = [
      `${name} the ${titleCase(s.className || 'Adventurer')} - Barrowlight`,
      `Fame ${num(s.score, 0)} · Level ${num(s.level, 0)} · Floor ${num(s.floor, 0)} · ${num(s.kills, 0)} kills`,
      '',
      ...forSnap(s),
    ];
    if (gameUrl) parts.push('', 'Beat it: ' + gameUrl);
    return parts.join('\n');
  }

  return { forSnap, shareText };
})();
