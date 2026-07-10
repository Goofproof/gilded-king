// ============================================================================
// weapons.js - weapon archetypes, rarity rolls, enchant tables.
// ALL TUNING TABLES LIVE AT THE TOP OF THIS FILE - tweak numbers freely.
// ============================================================================
const Weapons = (() => {

  // --- RARITY TABLE ---------------------------------------------------------
  // weight: roll weight out of the total (these sum to 100, per the design doc)
  // slots: [min,max] enchant slots. maxTier: highest enchant tier allowed.
  const RARITY = [
    { key: 'common',    name: 'Common',    color: '#e8e8e8', weight: 50, slots: [0, 0], maxTier: 0, price: 15  },
    { key: 'uncommon',  name: 'Uncommon',  color: '#4ade80', weight: 28, slots: [1, 1], maxTier: 1, price: 30  },
    { key: 'rare',      name: 'Rare',      color: '#38bdf8', weight: 15, slots: [1, 2], maxTier: 1, price: 60  },
    { key: 'epic',      name: 'Epic',      color: '#a78bfa', weight: 6,  slots: [2, 3], maxTier: 2, price: 110 },
    { key: 'legendary', name: 'Legendary', color: '#fbbf24', weight: 1,  slots: [3, 3], maxTier: 3, price: 200 },
  ];
  // enchant tier roll weights within a slot: minor 55 / major 35 / signature 10
  const TIER_WEIGHTS = [ { tier: 1, w: 55 }, { tier: 2, w: 35 }, { tier: 3, w: 10 } ];
  const TIER_NAMES = { 1: 'minor', 2: 'major', 3: 'signature' };

  // --- ENCHANT TABLE ----------------------------------------------------------
  // pool: 'melee' | 'bow' | 'any'.  tier: 1 minor, 2 major, 3 signature.
  // leveled: rolls I/II/III (higher levels gated to higher rarity).
  // 'Vampiric' and 'Momentum' are ORIGINAL additions (not from Minecraft).
  const ENCHANTS = [
    // bow pool
    { key: 'flame',     name: 'Flame',         pool: 'bow',   tier: 2, desc: 'Arrows ignite: burn damage over time' },
    { key: 'piercing',  name: 'Piercing',      pool: 'bow',   tier: 2, desc: 'Arrows pass through enemies' },
    { key: 'power',     name: 'Power',         pool: 'bow',   tier: 1, leveled: true, desc: '+damage per level' },
    { key: 'punch',     name: 'Punch',         pool: 'bow',   tier: 1, desc: 'Arrows knock enemies back' },
    { key: 'multishot', name: 'Multishot',     pool: 'bow',   tier: 3, desc: 'Fires 3 arrows in a spread' },
    { key: 'infinity',  name: 'Infinity',      pool: 'bow',   tier: 3, desc: 'Greatly increased fire rate' }, // bows have no ammo, so Infinity = fire rate (allowed by the design doc)
    // melee pool
    { key: 'fireaspect',name: 'Fire Aspect',   pool: 'melee', tier: 2, desc: 'Hits ignite the target' },
    { key: 'sharpness', name: 'Sharpness',     pool: 'melee', tier: 1, leveled: true, desc: '+damage per level' },
    { key: 'knockback', name: 'Knockback',     pool: 'melee', tier: 1, desc: 'Hits knock enemies back' },
    { key: 'sweeping',  name: 'Sweeping Edge', pool: 'melee', tier: 2, desc: 'Bigger swing arc and range' },
    // universal
    { key: 'looting',   name: 'Looting',       pool: 'any',   tier: 1, desc: 'More coins and better drops' },
    { key: 'vampiric',  name: 'Vampiric',      pool: 'any',   tier: 2, desc: 'Kills restore a little health' },   // ORIGINAL
    { key: 'momentum',  name: 'Momentum',      pool: 'any',   tier: 1, desc: 'Brief speed burst after a kill' },  // ORIGINAL
  ];

  // --- ARCHETYPE BASE STATS ---------------------------------------------------
  // dmg scales +10% per rarity step and +8% per dungeon tier (see rollWeapon).
  const ARCHETYPES = {
    heavy: { dmg: 26, cooldown: 0.95, windup: 0.30, range: 82, arc: 2.4, stagger: 0.55,
             names: ['Cleaver', 'Warhammer', 'Greataxe', 'Maul'] },
    light: { dmg: 9,  cooldown: 0.22, windup: 0.0,  range: 54, arc: 1.15, stagger: 0.0,
             names: ['Dagger', 'Shortsword', 'Rapier', 'Twinfang'] },
    bow:   { dmg: 14, cooldown: 0.45, windup: 0.0,  range: 0,  arc: 0, projSpeed: 540,
             names: ['Shortbow', 'Hunting Bow', 'Longbow', 'Recurve'] },
  };
  const PREFIX = { common: 'Worn', uncommon: 'Sturdy', rare: 'Fine', epic: 'Runed', legendary: 'Mythic' };
  const ROMAN = ['', 'I', 'II', 'III'];

  // --- helpers ---------------------------------------------------------------
  function weightedPick(list, wKey) {
    let total = 0; for (const e of list) total += e[wKey];
    let r = Math.random() * total;
    for (const e of list) { r -= e[wKey]; if (r <= 0) return e; }
    return list[list.length - 1];
  }

  function rollRarity(opts = {}) {
    if (opts.exactRarity !== undefined) return RARITY[opts.exactRarity]; // pinned roll (e.g. starting weapon)
    const minIdx = opts.minRarity || 0;
    const pool = RARITY.filter((r, i) => i >= minIdx);
    let pick = weightedPick(pool, 'weight');
    // luck (from Looting / mimic rewards): reroll once, keep the better result
    if (opts.luck && Math.random() < opts.luck) {
      const p2 = weightedPick(pool, 'weight');
      if (RARITY.indexOf(p2) > RARITY.indexOf(pick)) pick = p2;
    }
    return pick;
  }

  function rollEnchants(archetype, rar) {
    const rarIdx = RARITY.indexOf(rar);
    const nSlots = rar.slots[0] + ((Math.random() * (rar.slots[1] - rar.slots[0] + 1)) | 0);
    const poolKey = archetype === 'bow' ? 'bow' : 'melee';
    const avail = ENCHANTS.filter(e => (e.pool === poolKey || e.pool === 'any') && e.tier <= rar.maxTier);
    const out = [];
    let needSignature = rar.key === 'legendary'; // legendary guarantees >=1 signature enchant
    for (let s = 0; s < nSlots && avail.length; s++) {
      let candidates;
      if (needSignature && s === nSlots - 1 && !out.some(e => e.tier === 3)) {
        candidates = avail.filter(e => e.tier === 3 && !out.some(o => o.key === e.key));
      } else {
        // roll the tier for this slot, then pick an enchant of at most that tier
        const tierRoll = weightedPick(TIER_WEIGHTS.filter(t => t.tier <= rar.maxTier), 'w').tier;
        candidates = avail.filter(e => e.tier <= tierRoll && !out.some(o => o.key === e.key));
      }
      if (!candidates.length) candidates = avail.filter(e => !out.some(o => o.key === e.key));
      if (!candidates.length) break;
      const e = candidates[(Math.random() * candidates.length) | 0];
      const ench = { key: e.key, name: e.name, tier: e.tier, desc: e.desc, level: 0 };
      if (e.leveled) {
        // level gating: III only on epic+, II on rare+ (mirrors Minecraft-style gating)
        const maxLv = rarIdx >= 3 ? 3 : rarIdx >= 2 ? 2 : 1;
        const roll = Math.random();
        ench.level = roll < 0.55 ? 1 : roll < 0.85 ? Math.min(2, maxLv) : maxLv;
      }
      out.push(ench);
    }
    return out;
  }

  // main entry: tier = dungeon depth tier (1..6ish), opts {archetype, minRarity, luck}
  function rollWeapon(tier = 1, opts = {}) {
    const archKey = opts.archetype || ['heavy', 'light', 'bow'][(Math.random() * 3) | 0];
    const arch = ARCHETYPES[archKey];
    const rar = rollRarity(opts);
    const rarIdx = RARITY.indexOf(rar);
    const enchants = rollEnchants(archKey, rar);
    const dmgScale = (1 + rarIdx * 0.10) * (1 + (tier - 1) * 0.08);
    const w = {
      archetype: archKey,
      rarity: rar.key, rarityName: rar.name, color: rar.color, rarIdx,
      name: `${PREFIX[rar.key]} ${arch.names[(Math.random() * arch.names.length) | 0]}`,
      dmg: Math.round(arch.dmg * dmgScale),
      cooldown: arch.cooldown, windup: arch.windup,
      range: arch.range, arc: arch.arc, projSpeed: arch.projSpeed || 0,
      stagger: arch.stagger || 0,
      enchants,
      price: rar.price + tier * 5,
    };
    applyEnchantStats(w);
    return w;
  }

  // bake enchant effects that modify flat weapon stats
  function applyEnchantStats(w) {
    const lv = k => { const e = w.enchants.find(e => e.key === k); return e ? (e.level || 1) : 0; };
    if (lv('sharpness')) w.dmg += 3 * lv('sharpness');
    if (lv('power'))     w.dmg += 3 * lv('power');
    if (lv('sweeping')) { w.range *= 1.3; w.arc = Math.min(Math.PI * 1.9, w.arc * 1.35); }
    if (lv('infinity'))  w.cooldown *= 0.6;
    // price bump for enchants
    w.price += w.enchants.reduce((s, e) => s + e.tier * 8 + (e.level || 0) * 4, 0);
  }

  function has(w, key) { const e = w && w.enchants.find(e => e.key === key); return e ? (e.level || 1) : 0; }

  function displayName(w) {
    const en = w.enchants.map(e => e.name + (e.level ? ' ' + ROMAN[e.level] : '')).join(', ');
    return w.name + (en ? ` [${en}]` : '');
  }

  return { RARITY, ENCHANTS, ARCHETYPES, TIER_NAMES, rollWeapon, has, displayName };
})();
