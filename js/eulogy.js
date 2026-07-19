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
    return titleCase(nm);
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
    const statEp = signature(r, s);
    const weapon = (s.weapons && s.weapons.length) ? cleanWeapon(s.weapons[0]) : null;
    const ult = s.ult ? titleCase(s.ult) : null;
    const place = floorName(s.floor);
    const kills = num(s.kills, 0);

    const slayer = killerName(s.killer);

    const lines = [];
    // #269 (Sam) a BARD'S TALE, not a Homeric epic: warmer, flowing, sung across the table,
    // and it names the thing that finally caught you. L1 - the bard settling into the story.
    // The board rank walks the list so neighbouring top-5 raiders never open the same way.
    const L1 = [
      `Gather close, and hear of ${name} the ${classEp}.`,
      `Here is a tale worth the telling: ${name}, ${classEp}.`,
      `They still sing of ${name} down in these halls.`,
      `Once, not so long ago, ${name} the ${classEp} went down into the barrow.`,
      `Pour another round, and I will tell you of ${name}.`,
      `You want a story? Then hear of ${name}, ${classEp}.`,
      `There was a ${classEp} named ${name}, and this is how it ended.`,
      `Every door in the dark came to know the name ${name}.`,
      `Some go down for the gold. ${titleCase(String(name).toLowerCase())} went down for the going.`,
      `Listen now: the barrow took ${name}, but it did not come cheap.`,
    ];
    if (s.rank != null && s.rank >= 0 && s.rank < 5) lines.push(L1[(s.rank * 2 + ((r() * 2) | 0)) % L1.length]);
    else lines.push(pick(r, L1));

    // L2 - how they fought: their signature woven with the blade that carried it
    lines.push(weapon
      ? pick(r, [
        `${cap(statEp)} they were, and ${weapon} sang wherever they carried it.`,
        `With ${weapon} in hand they cut a road through the deep, ${statEp} to the last.`,
        `They were ${statEp}, and let ${weapon} answer every door.`,
        `${weapon} never left their grip, for they were ${statEp}.`,
      ])
      : pick(r, [
        `${cap(statEp)} they were, and needed no blade at all.`,
        `They went ${statEp}, and empty-handed still nothing could hold them.`,
        `${cap(statEp)}, they let the dark come to them.`,
      ]));

    // L3 - a deed worth a verse: the ultimate they loosed (skipped if none recorded)
    if (ult) lines.push(pick(r, [
      `When the walls closed in they loosed the ${ult}, and the deep remembers it still.`,
      `More than once the ${ult} bought them one more floor.`,
      `They saved the ${ult} for the worst of it, and the worst of it always came.`,
      `The ${ult} answered when they called it, and whole rooms went quiet.`,
    ]));

    // L4 - the fall: WHO took them, and WHERE. The heart of the bard's tale (#269 Sam).
    if (slayer && place) lines.push(pick(r, [
      `In the end it was ${slayer} that took them, there in the ${place}.`,
      `${cap(slayer)} was waiting in the ${place}, and that is where the song stops.`,
      `${cap(slayer)} caught them at last in the ${place}, and ${name} went quiet.`,
      `No one outlasts every floor: ${slayer} met them in the ${place}, and that was the end.`,
    ]));
    else if (slayer) lines.push(pick(r, [
      `In the end it was ${slayer} that took them, and ${name} went quiet.`,
      `${cap(slayer)} caught them at last, and there the song stops.`,
      `No one outlasts every floor, and ${slayer} was the one who proved it.`,
    ]));
    else if (place) lines.push(pick(r, [
      `The ${place} closed over ${name}, and did not give them back.`,
      `Somewhere in the ${place}, the story stops mid-sentence.`,
      `The ${place} was one door too many, and there ${name} stayed.`,
    ]));
    else lines.push(s.floor != null ? `They fell on floor ${s.floor}, and were still.` : `The long dark took them, as one day it takes us all.`);

    return lines;
  }

  // #208 a plain-text version of the whole feat, for the SHARE button: the headline,
  // the numbers, the poem, and the game link - ready to paste anywhere.
  function shareText(s, gameUrl) {
    if (!s) return '';
    const name = (s.initials || '???').toUpperCase();
    const parts = [
      `${name} the ${titleCase(s.className || 'Adventurer')} - Barrowlight`,
      `Score ${num(s.score, 0)} · Level ${num(s.level, 0)} · Floor ${num(s.floor, 0)} · ${num(s.kills, 0)} kills`,
      '',
      ...forSnap(s),
    ];
    if (gameUrl) parts.push('', 'Beat it: ' + gameUrl);
    return parts.join('\n');
  }

  return { forSnap, shareText };
})();
