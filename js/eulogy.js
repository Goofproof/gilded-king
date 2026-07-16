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

  // the raider's SIGNATURE stat: whichever of dmg / speed / crit / coins / magic
  // stood tallest. Each carries its own epithet pool. (Percentages compared
  // directly; magic-level scaled up so it can win when it should.)
  function signature(r, s) {
    const cands = [
      { v: Math.round((num(s.dmgMul, 1) - 1) * 100), ep: ['mighty-armed', 'whose blow broke the line', 'strong past mortal measure'] },
      { v: Math.round((num(s.spdMul, 1) - 1) * 100), ep: ['swift-footed', 'fleet as the north wind', 'who outran his own shadow'] },
      { v: num(s.crit, 0), ep: ['keen-eyed', 'whose stroke found every seam', 'the unerring hand'] },
      { v: Math.round((num(s.coinMul, 1) - 1) * 100), ep: ['gold-hungry', 'who counted coin in the dark', 'laden with the dead\'s plunder'] },
      { v: (num(s.magic, 1) - 1) * 18, ep: ['steeped in old sorcery', 'who wore the arts like mail', 'the ember-tongued'] },
    ];
    let best = cands[0];
    for (const c of cands) if (c.v > best.v) best = c;
    return pick(r, best.ep);
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

    const lines = [];
    // L1: ten STRUCTURALLY different ways into the tale (#208). The board rank walks
    // the list so neighbouring raiders on the top-5 never open the same way.
    const L1 = [
      `Sing of ${name} the ${classEp},`,
      `They still argue about ${name} in the taverns,`,
      `The dungeon remembers ${name}, ${classEp},`,
      `${kills > 0 ? kills : 'Uncounted'} monsters learned the name ${name},`,
      `Down where the light gives up, ${name} kept walking,`,
      `No one ordered ${name} to go so deep. ${titleCase(String(name).toLowerCase())} went anyway,`,
      `Write this in the ledger of the fallen: ${name}, ${classEp},`,
      `Ask the walls about ${name} - they are still shaking,`,
      `${name} did not come for the gold. Not only for the gold,`,
      `Some doors should stay shut. ${name} opened every one,`,
    ];
    // Top-5 GUARANTEE: each rank owns a disjoint PAIR of templates (rank 0 -> 0/1,
    // rank 1 -> 2/3, ...), the seed picks within the pair - so the board's five
    // openers can never repeat a structure. Deeper ranks pick freely.
    if (s.rank != null && s.rank >= 0 && s.rank < 5) {
      lines.push(L1[(s.rank * 2 + ((r() * 2) | 0)) % L1.length]);
    } else {
      lines.push(pick(r, L1));
    }
    // L2: the signature stat + the weapon that carried it
    lines.push(weapon
      ? pick(r, [
        `${statEp}, who bore ${weapon}.`, `${statEp}, ${weapon} in hand.`, `who carried ${weapon}, ${statEp}.`,
        `${statEp}, and ${weapon} never left their grip.`, `with ${weapon} raised, ${statEp}.`, `${statEp}, whose ${weapon} the dark learned to fear.`,
      ])
      : pick(r, [`${statEp}, and unafraid.`, `${statEp}, and empty-handed still they went.`, `${statEp}, needing no blade at all.`]));
    // L3: the ultimate they loosed (skipped if none recorded) - no 'vault', ever (#208)
    if (ult) lines.push(pick(r, [
      `who loosed the ${ult} upon the host,`,
      `who spoke the ${ult} and the room went quiet,`,
      `and the ${ult} answered when they called,`,
      `whose ${ult} the deep still remembers,`,
      `and when the ${ult} came down, even the walls flinched,`,
      `who saved the ${ult} for exactly the right moment,`,
    ]));
    // L4: the fall, named by the place it happened
    lines.push(place
      ? pick(r, [
        `Then the ${place} closed over ${name}.`, `The ${place} keeps ${name} now, and does not give back.`,
        `In the ${place} the song of ${name} went out.`, `Even ${name} lay down at last, in the ${place}.`,
        `The ${place} was one door too many.`, `Somewhere in the ${place}, the story stops mid-sentence.`,
      ])
      : (s.floor != null ? `and fell upon floor ${s.floor}, and was still.` : `and passed into the long dark.`));
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
