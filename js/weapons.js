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
    // MYTHIC (index 5): weight 0 so it NEVER rolls by chance - only hand-built
    // uniques from the tables below, dropped by Descent bosses or the mythic shop.
    { key: 'mythic',    name: 'Mythic',    color: '#ff2fb0', weight: 0,  slots: [3, 3], maxTier: 3, price: 400 },
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
    { key: 'executioner',name:'Executioner',   pool: 'melee', tier: 3, desc: 'Finishes enemies below 30% health' }, // ORIGINAL - melee needs a signature so legendaries keep their guarantee
    { key: 'sharpness', name: 'Sharpness',     pool: 'melee', tier: 1, leveled: true, desc: '+damage per level' },
    { key: 'knockback', name: 'Knockback',     pool: 'melee', tier: 1, desc: 'Hits knock enemies back' },
    { key: 'sweeping',  name: 'Sweeping Edge', pool: 'melee', tier: 2, desc: 'Bigger swing arc and range' },
    // universal
    { key: 'looting',   name: 'Looting',       pool: 'any',   tier: 1, desc: 'More coins and better drops' },
    { key: 'vampiric',  name: 'Vampiric',      pool: 'any',   tier: 2, desc: 'Kills restore a little health' },   // ORIGINAL
    { key: 'momentum',  name: 'Momentum',      pool: 'any',   tier: 1, desc: 'Brief speed burst after a kill' },  // ORIGINAL
    // elemental (Sam 2026-07-11) - each a distinct on-hit effect
    { key: 'frost',     name: 'Frost',         pool: 'any',   tier: 2, desc: 'Chills enemies: slows them, deep chill freezes' },
    { key: 'chain',     name: 'Chain Lightning',pool: 'any',  tier: 2, desc: 'Strikes arc to nearby enemies' },
    { key: 'venom',     name: 'Venom',         pool: 'any',   tier: 2, desc: 'Poison: heavy damage over time' },
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
    // #16 MAGIC: wand = fast single-target bolts; staff = slow charged fireball (AOE + burn)
    wand:  { dmg: 12, cooldown: 0.30, windup: 0.0,  range: 0,  arc: 0, projSpeed: 470, magic: 'bolt',
             names: ['Wand', 'Scepter', 'Rod', 'Willow Wand'] },
    staff: { dmg: 34, cooldown: 1.05, windup: 0.5,  range: 0,  arc: 0, projSpeed: 300, magic: 'fireball',
             names: ['Staff', 'Stave', 'Runewood Staff', 'Emberstaff'] },
  };
  // legendary prefix must NOT be 'Mythic' (that's the tier ABOVE it) - it read as
  // "Legendary Mythic X" and looked like a mythic. 'Ancient' keeps the flavor.
  const PREFIX = { common: 'Worn', uncommon: 'Sturdy', rare: 'Fine', epic: 'Runed', legendary: 'Ancient' };
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
    // weight-0 rarities (Mythic) are excluded from chance rolls entirely
    const pool = RARITY.filter((r, i) => i >= minIdx && r.weight > 0);
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
    // magic weapons (wand/staff) fling projectiles, so they draw the ranged enchant pool
    const poolKey = (archetype === 'bow' || archetype === 'wand' || archetype === 'staff') ? 'bow' : 'melee';
    const avail = ENCHANTS.filter(e => (e.pool === poolKey || e.pool === 'any') && e.tier <= rar.maxTier);
    const out = [];
    let needSignature = rar.key === 'legendary'; // legendary guarantees >=1 signature enchant
    for (let s = 0; s < nSlots && avail.length; s++) {
      let candidates = null;
      if (needSignature && s === nSlots - 1 && !out.some(e => e.tier === 3)) {
        candidates = avail.filter(e => e.tier === 3 && !out.some(o => o.key === e.key));
      } else {
        // roll the slot's tier at the spec'd 55/35/10 split, then pick from EXACTLY
        // that tier (picking from "up to" the tier diluted signatures to ~2%);
        // fall back to lower tiers only when the rolled tier's pool is exhausted
        const tierRoll = weightedPick(TIER_WEIGHTS.filter(t => t.tier <= rar.maxTier), 'w').tier;
        for (let t = tierRoll; t >= 1 && !(candidates && candidates.length); t--) {
          candidates = avail.filter(e => e.tier === t && !out.some(o => o.key === e.key));
        }
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
  // weighted so melee stays common and magic is a real but rarer find
  const ARCH_ROLL = [['heavy', 24], ['light', 24], ['bow', 20], ['wand', 16], ['staff', 16]];
  function rollWeapon(tier = 1, opts = {}) {
    const archKey = opts.archetype || weightedPick(ARCH_ROLL.map(([k, w]) => ({ k, w })), 'w').k;
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
      magic: arch.magic || null, // wand='bolt' / staff='fireball' drives fireSpell()
      // #16 minimum Magic stat to wield: base wands need 1 (everyone can), deeper/rarer
      // magic weapons demand real investment in the Magic stat
      magicReq: arch.magic ? Math.max(1, Math.round((tier - 1) * 0.7 + rarIdx * 0.45)) : 0,
      enchants,
      price: rar.price + tier * 5,
    };
    applyEnchantStats(w);
    // rarity FEEL bump: higher-tier melee swings reach a little further and wider,
    // so a Mythic maul is visibly (and mechanically) grander than a Worn one
    if (archKey === 'heavy' || archKey === 'light') {
      w.range *= 1 + rarIdx * 0.05;
      w.arc = Math.min(Math.PI * 1.9, w.arc * (1 + rarIdx * 0.04));
    }
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

  // --- ARMOR ------------------------------------------------------------------
  // same rarity table and slot rules as weapons; its own enchant pool.
  // 'Bulwark' and 'Phoenix Plume' are ORIGINAL (not from Minecraft).
  const ARMOR_ENCHANTS = [
    { key: 'protection', name: 'Protection',    tier: 1, leveled: true, desc: '+3% damage reduction per level' },
    { key: 'swiftness',  name: 'Swiftness',     tier: 1, desc: '+6% move speed' },
    { key: 'recovery',   name: 'Recovery',      tier: 1, desc: 'Regenerate +0.4 HP/s' },
    { key: 'acrobatics', name: 'Acrobatics',    tier: 1, desc: '-8% roll cooldown' },
    { key: 'fortune',    name: 'Fortune',       tier: 1, desc: '+10% coins' },
    { key: 'thornmail',  name: 'Thornmail',     tier: 2, desc: 'Contact attackers take 8 damage' },
    { key: 'bulwark',    name: 'Bulwark',       tier: 2, desc: 'A shield charm at the start of each floor' },      // ORIGINAL
    { key: 'juggernaut', name: 'Juggernaut',    tier: 3, desc: '+12% damage reduction, +10% damage' },             // ORIGINAL
    { key: 'phoenix',    name: 'Phoenix Plume', tier: 3, desc: 'Cheat death once per run (revive at 30% HP)' },    // ORIGINAL
  ];
  const ARMOR_NAMES = ['Jerkin', 'Chain Hauberk', 'Scale Cuirass', 'Brigandine', 'Plate Aegis'];

  function rollArmorEnchants(rar) {
    const rarIdx = RARITY.indexOf(rar);
    const nSlots = rar.slots[0] + ((Math.random() * (rar.slots[1] - rar.slots[0] + 1)) | 0);
    const avail = ARMOR_ENCHANTS.filter(e => e.tier <= rar.maxTier);
    const out = [];
    let needSignature = rar.key === 'legendary';
    for (let s = 0; s < nSlots && avail.length; s++) {
      let candidates = null;
      if (needSignature && s === nSlots - 1 && !out.some(e => e.tier === 3)) {
        candidates = avail.filter(e => e.tier === 3 && !out.some(o => o.key === e.key));
      } else {
        const tierRoll = weightedPick(TIER_WEIGHTS.filter(t => t.tier <= rar.maxTier), 'w').tier;
        for (let t = tierRoll; t >= 1 && !(candidates && candidates.length); t--) {
          candidates = avail.filter(e => e.tier === t && !out.some(o => o.key === e.key));
        }
      }
      if (!candidates || !candidates.length) candidates = avail.filter(e => !out.some(o => o.key === e.key));
      if (!candidates.length) break;
      const e = candidates[(Math.random() * candidates.length) | 0];
      const ench = { key: e.key, name: e.name, tier: e.tier, desc: e.desc, level: 0 };
      if (e.leveled) {
        const maxLv = rarIdx >= 3 ? 3 : rarIdx >= 2 ? 2 : 1;
        const roll = Math.random();
        ench.level = roll < 0.55 ? 1 : roll < 0.85 ? Math.min(2, maxLv) : maxLv;
      }
      out.push(ench);
    }
    return out;
  }

  function rollArmor(tier = 1, opts = {}) {
    const rar = rollRarity(opts);
    const rarIdx = RARITY.indexOf(rar);
    const a = {
      isArmor: true,
      rarity: rar.key, rarityName: rar.name, color: rar.color, rarIdx,
      name: `${PREFIX[rar.key]} ${ARMOR_NAMES[(Math.random() * ARMOR_NAMES.length) | 0]}`,
      defense: 0.04 + rarIdx * 0.02 + (tier - 1) * 0.005, // base damage reduction
      enchants: rollArmorEnchants(rar),
      price: rar.price + tier * 5,
    };
    a.price += a.enchants.reduce((s, e) => s + e.tier * 8 + (e.level || 0) * 4, 0);
    return a;
  }

  // --- MYTHICS ----------------------------------------------------------------
  // Hand-built unique items (rarity index 5). They NEVER roll from chance - a
  // Descent boss drops one, or the secret mythic shop sells them. Each has its own
  // colour, signature enchant set (real keys, so the mechanics actually fire), and
  // a flavour line. Collecting one earns a laurel on the title screen.
  const MYTHIC_WEAPONS = [
    { id: 'ragnarok',    name: 'Ragnarok',         archetype: 'heavy', color: '#ff5a2c', dmg: 62, enchants: ['fireaspect', 'executioner', 'knockback'], flavor: 'The end of all things, forged as an axe.' },
    { id: 'worldbreaker',name: 'Worldbreaker',     archetype: 'heavy', color: '#ffb03a', dmg: 66, enchants: ['sharpness', 'knockback', 'sweeping'],      flavor: 'One swing moved a mountain. It never moved back.' },
    { id: 'dawnhammer',  name: 'Dawnhammer',       archetype: 'heavy', color: '#fff2a0', dmg: 58, enchants: ['executioner', 'fireaspect', 'looting'],    flavor: 'It rang once at sunrise and the dark fled.' },
    { id: 'gravetide',   name: 'Grave Tide',       archetype: 'heavy', color: '#4cc9a8', dmg: 60, enchants: ['vampiric', 'sweeping', 'knockback'],       flavor: 'Every soul it takes, it gives back to you.' },
    { id: 'obsidian',    name: 'Obsidian Verdict', archetype: 'heavy', color: '#b06bff', dmg: 64, enchants: ['executioner', 'sharpness', 'fireaspect'],  flavor: 'Judge, jury, and the last thing you hear.' },
    { id: 'doombringer', name: 'Doombringer',      archetype: 'heavy', color: '#e63fff', dmg: 68, enchants: ['executioner', 'fireaspect', 'sharpness'],  flavor: 'It hums the name of everyone it will meet.' },
    { id: 'soulrender',  name: 'Soulrender',       archetype: 'heavy', color: '#8b1a1a', dmg: 64, enchants: ['vampiric', 'executioner', 'sweeping'],     flavor: 'It does not cut flesh. It cuts the thread.' },
    { id: 'whisperfang', name: 'Whisperfang',      archetype: 'light', color: '#7fd4ff', dmg: 26, enchants: ['vampiric', 'momentum', 'sharpness'],       flavor: 'You never hear the blade that drinks you.' },
    { id: 'zephyr',      name: 'Zephyr',           archetype: 'light', color: '#9be8d8', dmg: 24, enchants: ['sweeping', 'momentum', 'knockback'],        flavor: 'Faster than the wind that carries the ash.' },
    { id: 'heartseeker', name: 'Heartseeker',      archetype: 'light', color: '#ff5edb', dmg: 28, enchants: ['executioner', 'vampiric', 'sharpness'],    flavor: 'It knows exactly where you keep your life.' },
    { id: 'emberdance',  name: 'Emberdance',       archetype: 'light', color: '#ff6a2c', dmg: 27, enchants: ['fireaspect', 'momentum', 'sharpness'],      flavor: 'Two blades, one flame, no survivors.' },
    { id: 'kingsbane',   name: 'Kingsbane',        archetype: 'light', color: '#ffd24c', dmg: 30, enchants: ['executioner', 'sharpness', 'looting'],     flavor: 'Forged from a crown that was never earned.' },
    { id: 'serpentkiss', name: "Serpent's Kiss",   archetype: 'light', color: '#4ade80', dmg: 25, enchants: ['fireaspect', 'vampiric', 'momentum'],      flavor: 'A venom that learned to love its host.' },
    { id: 'frostbite',   name: 'Frostbite',        archetype: 'light', color: '#aee7ff', dmg: 26, enchants: ['knockback', 'sharpness', 'momentum'],       flavor: 'Cold enough to still a beating heart mid-swing.' },
    { id: 'stormcaller', name: 'Stormcaller',      archetype: 'bow',   color: '#7fd4ff', dmg: 34, enchants: ['multishot', 'power', 'punch'],              flavor: 'It does not miss. It simply chooses.' },
    { id: 'sunpiercer',  name: 'Sunpiercer',       archetype: 'bow',   color: '#fff2a0', dmg: 36, enchants: ['flame', 'piercing', 'power'],               flavor: 'One arrow, and the horizon caught fire.' },
    { id: 'widowloom',   name: "Widow's Loom",     archetype: 'bow',   color: '#b06bff', dmg: 33, enchants: ['multishot', 'flame', 'looting'],            flavor: 'She weaves arrows from the last breath of the fallen.' },
    { id: 'deadeye',     name: 'Deadeye',          archetype: 'bow',   color: '#ff5a2c', dmg: 38, enchants: ['piercing', 'power', 'punch'],               flavor: 'It has never blinked. Not once.' },
    { id: 'ghostwind',   name: 'Ghostwind',        archetype: 'bow',   color: '#9be8d8', dmg: 35, enchants: ['infinity', 'multishot', 'power'],           flavor: 'The quiver is empty. The arrows keep coming.' },
    { id: 'hellfire',    name: 'Hellfire',         archetype: 'bow',   color: '#ff3a1a', dmg: 37, enchants: ['flame', 'piercing', 'multishot'],           flavor: 'Loosed from the seventh circle, aimed at the eighth.' },
  ];
  const MYTHIC_ARMOR = [
    { id: 'aegisfallen', name: 'Aegis of the Fallen',   color: '#ffd24c', defense: 0.16, enchants: ['juggernaut', 'bulwark'],               flavor: 'The last king who wore it never fell.' },
    { id: 'phoenixmant', name: 'Phoenix Mantle',        color: '#ff6a2c', defense: 0.14, enchants: ['phoenix', 'recovery'],                 flavor: 'Burn it down. It comes back warmer.' },
    { id: 'bulwarketrn', name: 'Bulwark Eternal',       color: '#7fd4ff', defense: 0.18, enchants: ['juggernaut', 'protection'],            flavor: 'A wall that learned to walk.' },
    { id: 'shroudecho',  name: 'Shroud of Echoes',      color: '#b06bff', defense: 0.14, enchants: ['thornmail', 'swiftness'],              flavor: 'Strike it, and hear your own blow return.' },
    { id: 'vestkings',   name: 'Vestment of Kings',     color: '#fff2a0', defense: 0.15, enchants: ['bulwark', 'fortune', 'protection'],    flavor: 'Woven with thread spun from crowns.' },
    { id: 'serpentscale',name: 'Serpentscale',          color: '#4ade80', defense: 0.14, enchants: ['thornmail', 'recovery'],               flavor: 'It bites the hand that strikes it.' },
    { id: 'windwoven',   name: 'Windwoven Cloak',       color: '#9be8d8', defense: 0.12, enchants: ['swiftness', 'acrobatics', 'recovery'], flavor: 'Lighter than a held breath.' },
    { id: 'heartmount',  name: 'Heart of the Mountain', color: '#c0846a', defense: 0.19, enchants: ['juggernaut', 'thornmail'],             flavor: 'Stone that remembers being a heart.' },
    { id: 'gravewarden', name: 'Grave Warden',          color: '#8b1a1a', defense: 0.15, enchants: ['phoenix', 'thornmail'],                flavor: 'It has buried a hundred wearers and outlived them all.' },
    { id: 'radiantbast', name: 'Radiant Bastion',       color: '#e63fff', defense: 0.16, enchants: ['bulwark', 'juggernaut', 'recovery'],   flavor: 'Light given the shape of a shield.' },
  ];
  const MYTHIC_TOTAL = MYTHIC_WEAPONS.length + MYTHIC_ARMOR.length;

  function mythicEnchants(keys, table) {
    return keys.map(k => {
      const d = table.find(e => e.key === k) || { key: k, name: k, tier: 3, desc: '' };
      return { key: d.key, name: d.name, tier: d.tier, desc: d.desc, level: d.leveled ? 3 : 0 };
    });
  }

  function buildMythicWeapon(e, tier = 6) {
    const arch = ARCHETYPES[e.archetype];
    const w = {
      archetype: e.archetype, rarity: 'mythic', rarityName: 'Mythic', color: e.color, rarIdx: 5,
      name: e.name, mythic: true, mythicId: e.id, flavor: e.flavor,
      dmg: e.dmg, cooldown: arch.cooldown, windup: arch.windup,
      range: arch.range, arc: arch.arc, projSpeed: arch.projSpeed || 0, stagger: arch.stagger || 0,
      enchants: mythicEnchants(e.enchants, ENCHANTS),
      price: 400 + tier * 5,
    };
    applyEnchantStats(w);
    if (e.archetype !== 'bow') { w.range *= 1.25; w.arc = Math.min(Math.PI * 1.9, w.arc * 1.2); }
    return w;
  }

  function buildMythicArmor(e, tier = 6) {
    const a = {
      isArmor: true, rarity: 'mythic', rarityName: 'Mythic', color: e.color, rarIdx: 5,
      name: e.name, mythic: true, mythicId: e.id, flavor: e.flavor,
      defense: e.defense, enchants: mythicEnchants(e.enchants, ARMOR_ENCHANTS),
      price: 400 + tier * 5,
    };
    a.price += a.enchants.reduce((s, en) => s + en.tier * 8 + (en.level || 0) * 4, 0);
    return a;
  }

  // roll a random mythic. kind: 'weapon' | 'armor' | undefined (weighted 70/30).
  // opts.exclude = array of mythicIds already owned (avoided if any remain).
  function rollMythic(kind, opts = {}) {
    const k = kind || (Math.random() < 0.7 ? 'weapon' : 'armor');
    const table = k === 'armor' ? MYTHIC_ARMOR : MYTHIC_WEAPONS;
    let pool = table;
    if (opts.exclude && opts.exclude.length) {
      const fresh = table.filter(e => !opts.exclude.includes(e.id));
      if (fresh.length) pool = fresh; // only avoid dupes while new ones remain
    }
    const e = pool[(Math.random() * pool.length) | 0];
    return k === 'armor' ? buildMythicArmor(e, opts.tier || 6) : buildMythicWeapon(e, opts.tier || 6);
  }

  // particle palette for swing/arrow effects, driven by the weapon's enchants -
  // this is what makes a Fire Aspect maul FEEL like a fire maul
  function fxPalette(w) {
    const h = k => w.enchants.some(e => e.key === k);
    if (h('fireaspect') || h('flame')) return { colors: ['#ff8833', '#ffcc44', '#ff4422'], glow: true };
    if (h('vampiric'))                 return { colors: ['#e05555', '#8b1a1a'], glow: true };
    if (h('executioner'))              return { colors: ['#ffd24c', '#fff5d0'], glow: true };
    if (h('multishot') || h('infinity')) return { colors: ['#b88aff', '#e8d5ff'], glow: true };
    if (h('punch') || h('knockback'))  return { colors: ['#7fd4ff', '#cfe9ff'], glow: false };
    if (h('sweeping'))                 return { colors: ['#9be8d8', '#4cc9a8'], glow: false };
    if (h('looting'))                  return { colors: ['#ffd24c', '#b8912f'], glow: false };
    if (h('momentum'))                 return { colors: ['#ffe08a', '#ffffff'], glow: false };
    if (h('sharpness') || h('power'))  return { colors: ['#ffffff', '#c8d2e0'], glow: false };
    return { colors: [w.color], glow: w.rarIdx >= 3 };
  }

  function displayName(w) {
    const en = w.enchants.map(e => e.name + (e.level ? ' ' + ROMAN[e.level] : '')).join(', ');
    return w.name + (w.upLvl ? ` +${w.upLvl}` : '') + (en ? ` [${en}]` : '');
  }

  return { RARITY, ENCHANTS, ARCHETYPES, ARMOR_ENCHANTS, TIER_NAMES, rollWeapon, rollArmor, has, displayName, fxPalette,
           rollMythic, MYTHIC_WEAPONS, MYTHIC_ARMOR, MYTHIC_TOTAL };
})();
