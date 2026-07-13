// ============================================================================
// player.js - movement, the dodge roll (headline mechanic!), weapons, leveling.
// ============================================================================
const PlayerDef = (() => {
  const PF = Dungeon.PF;

  // #30 BASE CLASSES: each is a starting kit + a stat bias + one signature perk.
  // Chosen on the title screen (meta.selectedClass). '' = the classic Adventurer,
  // so returning players lose nothing. The perk (fx) folds into evo -> mod().
  const CLASSES = [
    { id: '',        name: 'Adventurer', color: '#cdd4e2', icon: '?', arch: 'light',
      desc: 'A balanced start. No bias, no perk - pure potential.',
      q: 'Adrenaline',   qDesc: 'A rush of rage and haste - hit harder and faster for a few seconds.' },
    { id: 'warrior', name: 'Warrior',    color: '#e0894a', icon: '⚔', arch: 'heavy',
      desc: 'Starts with a heavy weapon. +20 max HP and takes 8% less damage.', hp: 20, fx: { reduce: 0.08 },
      q: 'Shield Bash',  qDesc: 'A shockwave that knocks enemies back and wraps you in a shield.' },
    { id: 'ranger',  name: 'Ranger',     color: '#6ee7a0', icon: '»', arch: 'bow',
      desc: 'Starts with a bow. +12% move speed and +5% crit chance.', fx: { spd: 0.12, critCh: 0.05 },
      q: 'Tumble Volley', qDesc: 'An evasive roll with i-frames that refunds your dodge.' },
    { id: 'mage',    name: 'Mage',       color: '#b06bff', icon: '✷', arch: 'wand',
      desc: 'Starts with a wand. Magic 3 and +15% spell power.', magic: 3, fx: { spellPower: 0.15 },
      q: 'Arcane Nova',  qDesc: 'A wide burst of arcane force that guts everything around you.' },
    { id: 'rogue',   name: 'Rogue',      color: '#ffd24c', icon: '✦', arch: 'light',
      desc: 'Starts with a dagger. +10% crit and rolls recharge 12% faster.', fx: { critCh: 0.10, rollCd: 0.12 },
      q: 'Eviscerate',   qDesc: 'A point-blank strike that always lands a critical hit.' },
    // #78 new classes
    { id: 'barbarian', name: 'Barbarian', color: '#d6482e', icon: '⚑', arch: 'heavy',
      desc: 'Starts with a heavy weapon. +30 max HP and hits 12% harder.', hp: 30, fx: { dmg: 0.12 },
      q: 'War Shout',    qDesc: 'A terrifying roar - every nearby enemy flees in fear for 5 seconds.' },
    { id: 'paladin',   name: 'Paladin',   color: '#ffe08a', icon: '✚', arch: 'heavy',
      desc: 'Starts with a heavy weapon. +15 HP, takes 6% less damage, regenerates.', hp: 15, fx: { reduce: 0.06, regenFlat: 0.6 },
      q: 'Lay on Hands', qDesc: 'Heal 30% of your health and raise a holy shield that blocks the next hit.' },
    { id: 'cleric',    name: 'Cleric',    color: '#8effc0', icon: '✷', arch: 'wand',
      desc: 'Starts with a wand. Magic 2, +40% healing done.', magic: 2, fx: { healMult: 0.4 },
      q: 'Mend',         qDesc: 'Channel light - heal yourself and every ally near you.' },
    { id: 'engineer',  name: 'Engineer',  color: '#c9a227', icon: '⚙', arch: 'bow',
      desc: 'Starts with a bow. +6% move speed. Deploys auto-turrets.', fx: { spd: 0.06 },
      q: 'Deploy Turret', qDesc: 'Build an auto-turret at your feet. More charges as you level (up to 5); turrets scale with Agility.' },
  ];
  const classById = id => CLASSES.find(k => k.id === (id || '')) || CLASSES[0];

  // #43 the prestige cape, drawn at the current translate origin. Shared by the local
  // player AND remote peers (main.js drawRemotePlayers) so everyone sees each other's
  // capes. Two fold panels + gold trim + collar; waves harder while moving.
  function capeAt(c, r, prestige, moving, seedX) {
    const t = Math.min(6, prestige);
    const now = Date.now();
    const amp = moving ? 11 : 2.5;
    const freq = moving ? 200 : 430;
    const ph = now / freq + (seedX || 0) * 0.05;
    const swayL = Math.sin(ph) * amp;
    const swayR = Math.sin(ph + 1.2) * amp;
    const midW = Math.sin(ph + 0.6) * amp * 0.6;
    const L = r * (2.1 + t * 0.14) + (moving ? r * 0.5 : 0);
    const tw = r * 0.5, bw = r * (1.05 + t * 0.05);
    const dark = t >= 5 ? '#2e0e42' : t >= 3 ? '#431029' : '#4e1226';
    const lite = t >= 5 ? '#4a1c66' : t >= 3 ? '#651a41' : '#72203a';
    c.save();
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(0, -r * 0.2); c.lineTo(-tw, -r * 0.16);
    c.quadraticCurveTo(-bw * 1.12 + swayL, L * 0.5, -bw + swayL, L);
    c.quadraticCurveTo(-bw * 0.42 + midW, L * 0.9, 0, L * 0.86);
    c.closePath(); c.fill();
    c.fillStyle = lite;
    c.beginPath();
    c.moveTo(0, -r * 0.2); c.lineTo(tw, -r * 0.16);
    c.quadraticCurveTo(bw * 1.12 + swayR, L * 0.5, bw + swayR, L);
    c.quadraticCurveTo(bw * 0.42 + midW, L * 0.9, 0, L * 0.86);
    c.closePath(); c.fill();
    c.strokeStyle = '#e8b52f'; c.lineWidth = 1.3 + t * 0.3; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(-tw, -r * 0.16);
    c.quadraticCurveTo(-bw * 1.12 + swayL, L * 0.5, -bw + swayL, L);
    c.quadraticCurveTo(-bw * 0.42 + midW, L * 0.9, 0, L * 0.86);
    c.quadraticCurveTo(bw * 0.42 + midW, L * 0.9, bw + swayR, L);
    c.quadraticCurveTo(bw * 1.12 + swayR, L * 0.5, tw, -r * 0.16);
    c.stroke();
    c.fillStyle = '#ffd24c';
    c.beginPath(); c.ellipse(0, -r * 0.18, tw * 0.9, 2.6 + t * 0.2, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  // a compact weapon silhouette for remote peers, drawn at the origin, aimed at `ang`.
  function peerWeapon(c, arch, color, facing, r) {
    c.save();
    c.rotate(facing || 0);
    c.strokeStyle = color || '#cfe0f0'; c.fillStyle = color || '#cfe0f0'; c.lineCap = 'round';
    if (arch === 'bow') {
      c.lineWidth = 2; c.beginPath(); c.arc(r * 0.5, 0, r * 0.7, -1.1, 1.1); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(r * 0.5 + Math.cos(-1.1) * r * 0.7, Math.sin(-1.1) * r * 0.7); c.lineTo(r * 0.5 + Math.cos(1.1) * r * 0.7, Math.sin(1.1) * r * 0.7); c.stroke();
    } else if (arch === 'wand' || arch === 'staff') {
      c.lineWidth = arch === 'staff' ? 3 : 2;
      c.beginPath(); c.moveTo(r * 0.2, 0); c.lineTo(r * (arch === 'staff' ? 1.3 : 1.0), 0); c.stroke();
      c.beginPath(); c.arc(r * (arch === 'staff' ? 1.35 : 1.05), 0, arch === 'staff' ? 4 : 3, 0, Math.PI * 2); c.fill();
    } else if (arch === 'heavy') {
      c.lineWidth = 4; c.beginPath(); c.moveTo(r * 0.2, 0); c.lineTo(r * 1.15, 0); c.stroke();
    } else { // light
      c.lineWidth = 2.5; c.beginPath(); c.moveTo(r * 0.2, 0); c.lineTo(r * 0.95, 0); c.stroke();
    }
    c.restore();
  }

  // #71 a class portrait for the character-select screen: a little bust wearing the
  // class's signature headgear, so players pick by picture instead of a cryptic glyph.
  // (cx,cy) is the head centre; s is the head radius.
  function drawClassPortrait(c, cls, cx, cy, s) {
    const id = cls.id || '';
    const bodyCol = { '': '#5b6884', warrior: '#a85f34', ranger: '#37905f', mage: '#6b3fa8', rogue: '#b8901f', barbarian: '#9e3b26', paladin: '#c9a94a', cleric: '#3f9e7a', engineer: '#8a6a2a' }[id] || '#5b6884';
    c.save();
    c.translate(cx, cy);
    // shoulders / torso
    c.fillStyle = bodyCol;
    c.beginPath(); c.moveTo(-s * 1.25, s * 1.7); c.quadraticCurveTo(0, s * 0.28, s * 1.25, s * 1.7); c.closePath(); c.fill();
    // head
    c.fillStyle = '#e8d3b0';
    c.beginPath(); c.arc(0, 0, s * 0.74, 0, Math.PI * 2); c.fill();
    // eyes (a cowl hides these behind a shadow instead)
    if (id !== 'rogue') {
      c.fillStyle = '#33507a';
      c.beginPath(); c.arc(-s * 0.26, s * 0.02, s * 0.11, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(s * 0.26, s * 0.02, s * 0.11, 0, Math.PI * 2); c.fill();
    }
    if (id === 'warrior') {
      c.fillStyle = '#8b929c'; c.beginPath(); c.arc(0, -s * 0.12, s * 0.82, Math.PI, 0); c.fill();       // dome
      c.fillStyle = '#aab2bd'; c.beginPath(); c.arc(-s * 0.2, -s * 0.2, s * 0.46, Math.PI, Math.PI * 1.7); c.fill();
      c.fillStyle = '#5c626c'; c.fillRect(-s * 0.82, -s * 0.2, s * 1.64, s * 0.24);                       // brow band
      c.fillStyle = '#c9a227';                                                                            // gold crest
      c.beginPath(); c.moveTo(-s * 0.5, -s * 0.72); c.quadraticCurveTo(0, -s * 1.28, s * 0.5, -s * 0.72);
      c.lineTo(s * 0.3, -s * 0.64); c.quadraticCurveTo(0, -s * 1.04, -s * 0.3, -s * 0.64); c.closePath(); c.fill();
      c.fillStyle = '#7a828d'; c.fillRect(-s * 0.1, -s * 0.16, s * 0.2, s * 0.7);                         // nasal guard
    } else if (id === 'ranger') {
      c.fillStyle = '#2f6b46'; c.beginPath(); c.arc(0, -s * 0.28, s * 0.7, Math.PI * 1.04, -Math.PI * 0.04); c.fill();
      c.fillStyle = '#26543a'; c.beginPath(); c.ellipse(0, -s * 0.26, s * 0.82, s * 0.2, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#8ef0a8'; c.lineWidth = 2.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-s * 0.2, -s * 0.58); c.quadraticCurveTo(-s * 0.95, -s * 1.1, -s * 0.68, -s * 1.55); c.stroke();
    } else if (id === 'mage') {
      c.fillStyle = '#2a1840'; c.beginPath(); c.ellipse(0, -s * 0.18, s * 1.06, s * 0.26, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#4a2d70'; c.beginPath();
      c.moveTo(-s * 0.7, -s * 0.22); c.quadraticCurveTo(-s * 0.3, -s * 1.2, s * 0.5, -s * 1.72);
      c.quadraticCurveTo(-s * 0.05, -s * 0.9, s * 0.72, -s * 0.22); c.closePath(); c.fill();
      c.fillStyle = '#6b48a0'; c.fillRect(-s * 0.6, -s * 0.4, s * 1.2, s * 0.16);
      c.fillStyle = '#ffd24c'; c.beginPath(); c.arc(-s * 0.04, -s * 0.82, s * 0.13, 0, Math.PI * 2); c.fill();
    } else if (id === 'rogue') {
      c.fillStyle = '#221d13'; c.beginPath();
      c.moveTo(-s * 0.92, s * 0.2); c.quadraticCurveTo(-s * 1.02, -s * 0.98, 0, -s * 1.02);
      c.quadraticCurveTo(s * 1.02, -s * 0.98, s * 0.92, s * 0.2);
      c.quadraticCurveTo(s * 0.5, -s * 0.1, 0, -s * 0.16);
      c.quadraticCurveTo(-s * 0.5, -s * 0.1, -s * 0.92, s * 0.2); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(201,162,39,0.6)'; c.lineWidth = 1; c.stroke();
      c.fillStyle = '#ffd24c'; c.globalAlpha = 0.85;                                                      // glinting eyes in the hood
      c.beginPath(); c.arc(-s * 0.24, -s * 0.06, s * 0.09, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(s * 0.24, -s * 0.06, s * 0.09, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    } else if (id === 'barbarian') {
      c.fillStyle = '#5a3a22'; c.beginPath(); c.arc(0, -s * 0.2, s * 0.72, Math.PI, 0); c.fill();          // fur cap
      c.fillStyle = '#e8e0cf';                                                                             // bone horns
      for (const sgn of [-1, 1]) { c.beginPath(); c.moveTo(sgn * s * 0.55, -s * 0.5); c.quadraticCurveTo(sgn * s * 1.2, -s * 0.9, sgn * s * 0.9, -s * 1.4); c.quadraticCurveTo(sgn * s * 0.8, -s * 0.9, sgn * s * 0.38, -s * 0.55); c.closePath(); c.fill(); }
    } else if (id === 'paladin') {
      c.fillStyle = '#c9cdd6'; c.beginPath(); c.arc(0, -s * 0.16, s * 0.8, Math.PI, 0); c.fill();          // helm
      c.fillStyle = '#8a919c'; c.fillRect(-s * 0.1, -s * 0.16, s * 0.2, s * 0.7);                          // nasal
      c.fillStyle = '#ffd24c'; c.beginPath(); c.moveTo(-s * 0.14, -s * 0.9); c.lineTo(0, -s * 1.4); c.lineTo(s * 0.14, -s * 0.9); c.closePath(); c.fill(); // crest
      c.strokeStyle = '#ffe08a'; c.lineWidth = 2; c.globalAlpha = 0.9;                                     // halo
      c.beginPath(); c.ellipse(0, -s * 1.2, s * 0.62, s * 0.2, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    } else if (id === 'cleric') {
      c.fillStyle = '#e8eef0'; c.beginPath();                                                              // white hood
      c.moveTo(-s * 0.9, s * 0.2); c.quadraticCurveTo(-s * 1.0, -s * 0.98, 0, -s * 1.0);
      c.quadraticCurveTo(s * 1.0, -s * 0.98, s * 0.9, s * 0.2);
      c.quadraticCurveTo(s * 0.5, -s * 0.12, 0, -s * 0.18);
      c.quadraticCurveTo(-s * 0.5, -s * 0.12, -s * 0.9, s * 0.2); c.closePath(); c.fill();
      c.fillStyle = '#ffd24c'; c.fillRect(-s * 0.09, -s * 0.92, s * 0.18, s * 0.4); c.fillRect(-s * 0.22, -s * 0.8, s * 0.44, s * 0.15); // gold cross
    } else if (id === 'engineer') {
      c.fillStyle = '#e0a91e'; c.beginPath(); c.arc(0, -s * 0.16, s * 0.8, Math.PI, 0); c.fill();          // yellow hard hat
      c.fillStyle = '#c9931a'; c.fillRect(-s * 0.86, -s * 0.2, s * 1.72, s * 0.12);                        // brim
      c.fillStyle = '#b8841a'; c.fillRect(-s * 0.08, -s * 0.92, s * 0.16, s * 0.5);                        // ridge
      c.fillStyle = '#3a3f48'; c.fillRect(-s * 0.5, s * 0.02, s * 1.0, s * 0.2);                           // goggles strap
      c.fillStyle = '#8fd0ff'; c.beginPath(); c.arc(-s * 0.26, s * 0.12, s * 0.16, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(s * 0.26, s * 0.12, s * 0.16, 0, Math.PI * 2); c.fill(); // goggle lenses
    } else {
      c.fillStyle = '#6a5a44'; c.beginPath(); c.arc(0, -s * 0.34, s * 0.66, Math.PI, 0); c.fill();        // adventurer: simple hair
    }
    c.restore();
  }

  // visual evolution (Sam, 2026-07-11): the champion's look escalates with the
  // stat you've invested in most. accent = aura/crest colour; cloak/body are the
  // recoloured robes that take over at stage 2+. Stage = number of evolutions
  // taken (capped at 4).
  const EVO_PAL = {
    hp:     { accent: '#7fd4ff', cloak: '#243f5a', body: '#3f7fb0' }, // steel - the bulwark
    dmg:    { accent: '#e05555', cloak: '#5a2530', body: '#a04a4f' }, // crimson - the brute
    spd:    { accent: '#7fe0ff', cloak: '#1f4a52', body: '#4ab0b8' }, // cyan - the courier
    roll:   { accent: '#b8f0ff', cloak: '#2a4a58', body: '#5aa0b0' }, // ice - the acrobat
    crit:   { accent: '#ff5a7a', cloak: '#4a1f30', body: '#b0405f' }, // rose - the assassin
    coin:   { accent: '#ffd24c', cloak: '#5a4a1a', body: '#c9a227' }, // gold - the magnate
    regen:  { accent: '#6ee7a0', cloak: '#1f4a34', body: '#4aa870' }, // green - the everliving
    atkspd: { accent: '#ffe08a', cloak: '#5a4a24', body: '#c9a84a' }, // amber - the frenzied
    magic:  { accent: '#b06bff', cloak: '#3a2456', body: '#7b48b8' }, // violet - the arcanist
  };

  // --- PLAYER TUNING ----------------------------------------------------------
  const T = {
    speed: 205,
    maxHp: 100,
    rollSpeed: 430,
    rollDur: 0.26,
    rollCooldown: 0.85,     // headline mechanic: 0.5-1s per the design doc
    rollIframes: 0.30,      // slightly longer than the roll itself (forgiving)
    hurtIframes: 0.7,       // grace period after taking a hit
    critBase: 0.05,
    critMult: 1.7,
  };

  class Player {
    constructor(meta) {
      this.x = PF.x + PF.w / 2; this.y = PF.y + PF.h / 2;
      this.r = 13;
      // meta-progression boosts (from the hub) fold into starting stats
      const mHp = (meta?.ranks?.vitality || 0) * 10;
      this.maxHp = T.maxHp + mHp;
      this.hp = this.maxHp;
      this.coins = 0; this.essenceRun = 0; this.shards = 0;
      this.xp = 0; this.level = 1;
      this.kills = 0; this.roomsCleared = 0;
      // temporary buffs from elite drops: shield absorbs one hit, the others are timed
      this.buffs = { shield: 0, rageT: 0, hasteT: 0 };

      // evolution system: stacks per upgrade key + accumulated fx primitives
      this.upgradeStacks = {};    // per-CARD count (drives body-part visuals)
      this.statPoints = {};       // #stat-redesign: per-BASE-STAT count (drives evolution triggers)
      this.evo = {};              // summed fx (see evolutions.js legend)
      this.evoHistory = [];       // stat keys of evolutions in pick order
      this.evoTaken = [];         // {key,name,tier} of every evolution taken (character sheet)
      this.evoCount = 0;          // total evolutions taken (drives the visual stage)
      this.ability = null;        // the Q ability, forged when the 2nd evolution lands
      this.abilityR = null;       // the R ability, forged from the 3rd + 4th evolutions
      this.abilityUlt = null;     // the chosen ultimate (left-click), forged from Q + R
      this.ultChoices = null;     // 3 ultimate options, offered when the 4th evolution lands
      this.turretCharges = 1;     // #78 Engineer: turret charges (grow with level, up to 5)
      this.turretRecharge = [];   // remaining seconds for each charge that's recharging
      this.turretMaxSeen = 1;     // last max we granted charges for (to add +1 per 5 levels)
      this.lifelineUsed = 0;
      this.frenzy = { s: 0, t: 0 };

      // armor slot
      this.armor = null;          // armor item (weapons.js rollArmor)
      this.armorMods = {};        // derived from the equipped armor
      this.phoenixUsed = false;

      // pet (Descent reward): one at a time, a passive buff folded into mod()
      this.pet = null;
      this.petMods = {};

      // stat multipliers - passive upgrades stack into these
      this.stats = {
        dmgMul: 1 + (meta?.ranks?.might || 0) * 0.05,
        speedMul: 1,
        rollCdMul: 1 - (meta?.ranks?.acrobat || 0) * 0.08,
        crit: 0,
        coinMul: 1 + (meta?.ranks?.greed || 0) * 0.10,
        regen: 0,
        atkSpeedMul: 1,
        magic: 1,   // #16 Magic stat: gates wielding wands/staffs (base 1 = basic magic)
      };

      // #30 class: starting kit + stat bias + one signature perk
      const cls = classById(meta?.selectedClass);
      this.class = cls;
      // Q is your class ability, live from the start of the run (R + ultimate come
      // from your evolutions - see recordEvoPick)
      if (typeof Abilities !== 'undefined') this.ability = Abilities.classAbility(cls.id);
      if (cls.magic) this.stats.magic = cls.magic;
      if (cls.hp) { this.maxHp += cls.hp; this.hp = this.maxHp; }
      if (cls.fx) this.applyEvolution(cls.fx); // the perk folds into evo -> mod()

      // two FREE weapon slots - any mix (two swords is a fine build).
      // Tab / wheel / right-click to swap. Your class sets the starting weapon;
      // a Common (Uncommon with the Armory unlock) of that archetype.
      const startRarity = meta?.ranks?.armory ? 1 : 0;
      this.weapons = {
        a: Weapons.rollWeapon(1, { archetype: cls.arch || 'light', exactRarity: startRarity }),
        b: null,
      };
      this.slot = 'a';

      this.vx = 0; this.vy = 0;
      this.facing = 0;           // aim angle (mouse)
      this.moveAngle = 0;        // last movement direction (roll uses this)
      this.moving = false;

      this.rollT = -1;           // >=0 while rolling
      this.rollCd = 0;
      this.iframes = 0;
      this.ghostTimer = 0;

      this.attackCd = 0;
      this.invisT = 0;           // Vanish ultimate: untargetable window
      this.autoAttack = true;    // #51 toggle with F; when off, hold fire entirely
      this.swing = null;         // {t,dur,windup,fired,arc,range,dir}
      this.drawT = -1;           // bow draw time (>=0 while drawing)
      this.momentumT = 0;        // ORIGINAL enchant: speed burst after kills
      this.flash = 0;
      this.dead = false;
      this.downed = false;  // co-op: dead-but-revivable (the run doesn't end until the party wipes)
    }

    get weapon() { return this.weapons[this.slot] || this.weapons.a || this.weapons.b; }

    xpToNext() { return 18 + (this.level - 1) * 14; } // leveling curve

    // #78 Engineer: max turret charges = 1 at L1, +1 at each of L5/L10/L15/L20, cap 5
    turretMax() { return Math.min(5, 1 + Math.floor(this.level / 5)); }

    // --- evolution / armor helpers ------------------------------------------
    mod(key) { return (this.evo[key] || 0) + (this.armorMods[key] || 0) + (this.petMods[key] || 0); }
    // #16 your Magic stat - base + any from evolutions/armor. Gates wielding wands/staffs.
    magicLevel() { return (this.stats.magic || 0) + this.mod('magic'); }
    canWield(w) { return !w || !w.magicReq || this.magicLevel() >= w.magicReq; }

    // adopt a pet (replaces any current one - only one companion at a time)
    adoptPet(pet) {
      pet.x = this.x - 24; pet.y = this.y - 18; pet.bob = 0;
      this.pet = pet;
      this.petMods = { [pet.key]: pet.val };
    }

    // record which stat an evolution belonged to; the first two intermingle
    // into the Q ability (see abilities.js). Called after applyEvolution.
    recordEvoPick(statKey) {
      this.evoHistory.push(statKey);
      this.evoCount++;
      // Q is the class ability. Your first two EVOLUTIONS forge R - but as a CHOICE of
      // three (#84), opened from applyEvolutionChoice, not auto-built here. The ULTIMATE
      // (right-click) is offered a couple levels after you pick R.
    }

    // the stat you've invested in most - drives the visual evolution's colour
    dominantStat() {
      let best = null, bestN = 0;
      for (const k in this.upgradeStacks) {
        if (this.upgradeStacks[k] > bestN) { bestN = this.upgradeStacks[k]; best = k; }
      }
      return best;
    }

    applyEvolution(fx) {
      for (const k of Object.keys(fx)) {
        const v = fx[k];
        if (k === 'maxHpPct') {
          const gain = Math.round(this.maxHp * v);
          this.maxHp += gain;
          this.hp += gain;
        } else if (k === 'midasPer') {
          this.evo.midasPer = Math.min(this.evo.midasPer || 1e9, v);
        } else if (k === 'frenzyMax') {
          // frenzy cap is a ceiling, not additive: a higher-tier pick RAISES it to
          // its value (so "frenzy stacks to 16" reads true), never sums to a surprise
          this.evo.frenzyMax = Math.max(this.evo.frenzyMax || 0, v);
        } else {
          this.evo[k] = (this.evo[k] || 0) + v;
        }
      }
    }

    equipArmor(a, g) {
      const old = this.armor;
      this.armor = a;
      // derive armor mods fresh each equip (never stack across swaps)
      const m = {};
      m.reduce = a.defense;
      for (const e of a.enchants) {
        if (e.key === 'protection') m.reduce += 0.03 * (e.level || 1);
        if (e.key === 'swiftness') m.spd = (m.spd || 0) + 0.06;
        if (e.key === 'recovery') m.regenFlat = (m.regenFlat || 0) + 0.4;
        if (e.key === 'acrobatics') m.rollCd = (m.rollCd || 0) + 0.08;
        if (e.key === 'fortune') m.coin = (m.coin || 0) + 0.10;
        if (e.key === 'thornmail') m.thorns = (m.thorns || 0) + 8;
        if (e.key === 'bulwark') m.bulwark = 1;
        if (e.key === 'juggernaut') { m.reduce += 0.12; m.dmg = (m.dmg || 0) + 0.10; }
        if (e.key === 'phoenix') m.phoenix = 1;
      }
      this.armorMods = m;
      // Bulwark grants one immediate shield on first equip of THIS item, so armor
      // found on the final floor still does something (per-item gate stops
      // drop/re-equip farming; the per-floor refresh lives in startFloor)
      if (m.bulwark && !a.bulwarkGranted) {
        a.bulwarkGranted = true;
        if (this.buffs.shield < 1) {
          this.buffs.shield = 1;
          Fx.text(this.x, this.y - 40, 'BULWARK', '#7fd4ff', 13);
        }
      }
      if (old) g.dropArmorPickup(old, this.x, this.y + 30);
      Sfx.play('pickup');
      Fx.text(this.x, this.y - 26, Weapons.displayName(a), a.color, 12);
      if (a.mythic && g.recordMythic) g.recordMythic(a);
    }

    // one damage formula for every player attack: melee and arrows both route here
    computeDmg(base, target, g) {
      let dmg = base * this.stats.dmgMul * (1 + this.mod('dmg'));
      if (this.buffs.rageT > 0) dmg *= 1.35;
      if (this.mod('lowHpRage') && this.hp <= this.maxHp * 0.35) dmg *= 1 + this.mod('lowHpRage');
      if (target) {
        if (this.mod('dmgVsWounded') && target.hp <= target.maxHp * 0.3) dmg *= 1 + this.mod('dmgVsWounded');
        if (this.mod('firstStrike') && target.hp >= target.maxHp) dmg *= 1 + this.mod('firstStrike');
        if (this.mod('bossSlayer') && target.isBoss) dmg *= 1 + this.mod('bossSlayer');
      }
      if (this.evo.midasPer) dmg += Math.min(this.evo.midasCap || 0, Math.floor(this.coins / this.evo.midasPer));
      const crit = Math.random() < T.critBase + this.stats.crit + this.mod('critCh');
      if (crit) dmg *= T.critMult + this.mod('critDmg');
      return { dmg, crit };
    }

    // shared post-hit hook: frenzy stacks, crit lifesteal
    onHitLanded(crit, g) {
      if (this.mod('frenzyMax')) {
        this.frenzy.s = Math.min(this.mod('frenzyMax'), this.frenzy.s + 1);
        this.frenzy.t = 3;
      }
      if (crit && this.mod('critHeal')) this.heal(this.mod('critHeal'), true);
    }

    addXp(n, g) {
      this.xp += n;
      while (this.xp >= this.xpToNext()) {
        this.xp -= this.xpToNext();
        this.level++;
        this.hp = Math.min(this.maxHp, this.hp + 15); // level-up heals a chunk
        Sfx.play('levelup');
        Fx.burst(this.x, this.y, ['#ffd24c', '#7fd4ff', '#fff'], 24, { speed: 200, life: 0.8, glow: true });
        g.queueLevelUp();
      }
    }

    swapWeapon() {
      if (this.weapons.a && this.weapons.b) {
        this.slot = this.slot === 'a' ? 'b' : 'a';
        this.drawT = -1;
        this.swing = null; // swap cancels a committed swing (applyMelee reads the live weapon)
        Sfx.play('ui');
      }
    }

    // pickups fill an empty slot first; only when both are full does the new
    // weapon replace the ACTIVE one (which drops behind you, so it's reversible)
    pickupWeapon(w, g) {
      let slot;
      if (!this.weapons.a) slot = 'a';
      else if (!this.weapons.b) slot = 'b';
      else slot = this.slot;
      const old = this.weapons[slot];
      this.weapons[slot] = w;
      this.slot = slot;
      this.drawT = -1;
      this.swing = null;
      if (old) g.dropWeaponPickup(old, this.x, this.y + 30);
      Sfx.play('pickup');
      Fx.text(this.x, this.y - 26, Weapons.displayName(w), w.color, 12);
      if (w.mythic && g.recordMythic) g.recordMythic(w);
      // #16: don't strand the player holding a magic weapon they can't wield when the
      // other slot has a usable one - keep the pickup but stay on the wieldable slot
      if (!this.canWield(this.weapons[this.slot])) {
        const other = this.slot === 'a' ? 'b' : 'a';
        if (this.weapons[other] && this.canWield(this.weapons[other])) this.slot = other;
      }
    }

    damage(dmg, sx, sy, g, src) {
      // winTimer > 0 = boss just died: celebration invulnerability, and it closes
      // the die-after-victory race that double-banked essence
      if (this.iframes > 0 || this.dead || g.state !== 'play' || g.winTimer > 0) return;
      // shield charm eats the whole hit
      if (this.buffs.shield > 0) {
        this.buffs.shield--;
        this.iframes = 0.5;
        Sfx.play('hit');
        Fx.text(this.x, this.y - 26, 'SHIELDED', '#7fd4ff', 14);
        Fx.burst(this.x, this.y, ['#7fd4ff', '#cfe9ff'], 16, { speed: 160, life: 0.4, glow: true });
        return;
      }
      // damage reduction from armor + evolutions (capped so nothing is free)
      const reduce = Math.min(0.6, this.mod('reduce'));
      dmg = dmg * (1 - reduce);
      this.hp -= dmg;
      this.iframes = T.hurtIframes;
      this.flash = 0.25;
      Fx.shake(6, 0.25);
      Sfx.play('hurt');
      Fx.burst(this.x, this.y, '#ff5555', 10, { speed: 150, life: 0.4 });
      // thorns bite back at whoever touched you
      if (src && !src.dead && this.mod('thorns')) {
        src.takeHit(this.mod('thorns'), { sx: this.x, sy: this.y, fromPlayer: true }, g);
      }
      // Bombardier Reflex: retaliation blast
      if (this.mod('retaliateNova')) {
        Fx.burst(this.x, this.y, ['#ff9a3d', '#ffe08a'], 18, { speed: 220, life: 0.4, glow: true });
        for (const m of g.monsters) {
          if (!m.dead && !m.airborne && Math.hypot(m.x - this.x, m.y - this.y) < 130 + m.r) {
            m.takeHit(this.mod('retaliateNova'), { sx: this.x, sy: this.y, knock: 200, fromPlayer: true }, g);
          }
        }
      }
      // knock away from the source
      const a = Math.atan2(this.y - sy, this.x - sx);
      this.vx += Math.cos(a) * 180; this.vy += Math.sin(a) * 180;
      if (this.hp <= 0) {
        // Lazarus Taxon (evolution), then Phoenix Plume (armor): cheat death
        if (this.evo.lifeline > this.lifelineUsed) {
          this.lifelineUsed++;
          this.hp = 1;
          this.iframes = 1.5;
          Sfx.play('levelup');
          Fx.text(this.x, this.y - 34, 'LAZARUS TAXON', '#6ee7a0', 16);
          Fx.burst(this.x, this.y, ['#6ee7a0', '#fff'], 30, { speed: 240, life: 0.8, glow: true });
          return;
        }
        if (this.armorMods.phoenix && !this.phoenixUsed) {
          this.phoenixUsed = true;
          this.hp = Math.round(this.maxHp * 0.3);
          this.iframes = 1.5;
          Sfx.play('levelup');
          Fx.text(this.x, this.y - 34, 'PHOENIX PLUME', '#ff9a3d', 16);
          Fx.burst(this.x, this.y, ['#ff9a3d', '#ffe08a', '#ff4422'], 40, { speed: 280, life: 0.9, glow: true });
          return;
        }
        this.hp = 0; this.dead = true; g.onPlayerDeath();
      }
    }

    heal(n, quiet) {
      // evolution hooks: flat healing boost + Body of Theseus missing-hp scaling
      let amount = n * (1 + this.mod('healMult'));
      if (this.mod('theseus')) {
        const missing = 1 - this.hp / this.maxHp;
        amount *= 1 + this.mod('theseus') * missing;
      }
      amount = Math.round(amount);
      const over = this.hp + amount - this.maxHp;
      this.hp = Math.min(this.maxHp, this.hp + amount);
      // Second Spleen: overheal becomes a shield charm
      if (over > 0 && this.mod('overhealShield') && this.buffs.shield < 1) {
        this.buffs.shield = 1;
        Fx.text(this.x, this.y - 38, 'OVERHEAL SHIELD', '#7fd4ff', 12);
      }
      if (!quiet) {
        Sfx.play('heal');
        Fx.burst(this.x, this.y, '#6ee7a0', 12, { speed: 90, life: 0.6, glow: true });
      }
      Fx.text(this.x, this.y - 24, '+' + amount, '#6ee7a0', quiet ? 11 : 13);
    }

    update(dt, g, input) {
      if (this.dead) return;
      const stats = this.stats;
      this.px = this.x; this.py = this.y; // #81 pre-move position, for anti-tunnel wall resolution

      if (this.iframes > 0) this.iframes -= dt;
      if (this.invisT > 0) this.invisT -= dt; // Vanish ultimate: untargetable window
      if (this.rollCd > 0) this.rollCd -= dt;
      if (this.attackCd > 0) this.attackCd -= dt * (stats.atkSpeedMul + this.mod('atkSpd') + this.frenzy.s * 0.02);
      if (this.flash > 0) this.flash -= dt;
      if (this.momentumT > 0) this.momentumT -= dt;
      if (this.buffs.rageT > 0) this.buffs.rageT -= dt;
      if (this.buffs.hasteT > 0) this.buffs.hasteT -= dt;
      if (this.frenzy.t > 0) { this.frenzy.t -= dt; if (this.frenzy.t <= 0) this.frenzy.s = 0; }
      if (this.ability && this.ability.cd > 0) this.ability.cd -= dt;
      if (this.abilityR && this.abilityR.cd > 0) this.abilityR.cd -= dt;
      if (this.abilityUlt && this.abilityUlt.cd > 0) this.abilityUlt.cd -= dt;
      const totalRegen = stats.regen + this.mod('regenFlat');
      if (totalRegen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + totalRegen * dt);

      // auto-attack is always on (Sam). CURSOR-BASED targeting (#17): if you're
      // aiming the mouse at (or near) an enemy, THAT one is your target - so you can
      // pick off the summoner/healer instead of whatever is closest. If the cursor
      // isn't on anyone, it falls back to the nearest enemy so you never stand idle.
      this.facing = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);
      let cursorTarget = null, cursorBest = 1e9;
      let nearTarget = null, nearBest = 1e9;
      for (const m of g.monsters) {
        if (m.dead || m.spawnT > 0 || m.airborne) continue;
        const dc = Math.hypot(m.x - input.mouse.x, m.y - input.mouse.y);
        if (dc < 100 + m.r && dc < cursorBest) { cursorBest = dc; cursorTarget = m; }
        const dp = Math.hypot(m.x - this.x, m.y - this.y);
        if (dp < nearBest) { nearBest = dp; nearTarget = m; }
      }
      let autoTarget = cursorTarget || nearTarget;
      let autoDist = 1e9;
      // #55 shielder TAUNT: while taunted you're FORCED to face and attack the taunter
      // (it doesn't block other damage - you just can't aim elsewhere for the duration)
      if (g.playerTaunt && g.playerTaunt.t > 0 && g.playerTaunt.src && !g.playerTaunt.src.dead) {
        const ts = g.playerTaunt.src;
        autoTarget = ts; nearTarget = ts; cursorTarget = ts;
        this.facing = Math.atan2(ts.y - this.y, ts.x - this.x);
        autoDist = Math.hypot(ts.x - this.x, ts.y - this.y);
      } else if (this.autoAttack && autoTarget) {
        // #54 only auto-face a target while AUTO-ATTACK is on. With it off you aim purely
        // with the cursor (facing set above), so a manual left-click strikes where you point.
        autoDist = Math.hypot(autoTarget.x - this.x, autoTarget.y - this.y);
        // #47: melee faces the NEAREST enemy (it hits what's adjacent); ranged (bow/
        // wand/staff) faces the cursor pick so you can aim distant targets (#17)
        const wa = this.weapon.archetype;
        const face = (wa === 'heavy' || wa === 'light') ? (nearTarget || autoTarget) : autoTarget;
        this.facing = Math.atan2(face.y - this.y, face.x - this.x);
      }

      // --- movement ---------------------------------------------------------
      let mx = 0, my = 0;
      if (input.key('KeyW') || input.key('ArrowUp')) my -= 1;
      if (input.key('KeyS') || input.key('ArrowDown')) my += 1;
      if (input.key('KeyA') || input.key('ArrowLeft')) mx -= 1;
      if (input.key('KeyD') || input.key('ArrowRight')) mx += 1;
      this.moving = mx !== 0 || my !== 0;
      if (this.moving) {
        const len = Math.hypot(mx, my);
        mx /= len; my /= len;
        this.moveAngle = Math.atan2(my, mx);
      }

      // --- DODGE ROLL: the headline mechanic ----------------------------------
      if (this.rollT >= 0) {
        this.rollT += dt;
        const k = this.rollT / T.rollDur;
        // rollNova evolutions: bowling through enemies hurts them (once per roll each)
        if (this.mod('rollNova')) {
          for (const m of g.monsters) {
            if (m.dead || m.airborne || this.rollHits.has(m)) continue;
            if (Math.hypot(m.x - this.x, m.y - this.y) < m.r + this.r + 6) {
              this.rollHits.add(m);
              m.takeHit(this.mod('rollNova'), { sx: this.x, sy: this.y, knock: 220, fromPlayer: true }, g);
            }
          }
        }
        if (k >= 1) {
          this.rollT = -1;
          // Wind Wake evolutions: speed burst as you come out of the roll
          if (this.mod('windWake')) this.momentumT = Math.max(this.momentumT, this.mod('windWake'));
        } else {
          // burst of speed along the roll direction, eased out
          const sp = T.rollSpeed * (1 - k * 0.45);
          this.x += Math.cos(this.rollAngle) * sp * dt;
          this.y += Math.sin(this.rollAngle) * sp * dt;
          // afterimage trail
          this.ghostTimer -= dt;
          if (this.ghostTimer <= 0) {
            this.ghostTimer = 0.028;
            Fx.ghost({ x: this.x, y: this.y, r: this.r, rot: k * Math.PI * 2, color: '#7fd4ff' });
          }
        }
      } else {
        // normal movement (momentum enchant gives a brief speed burst after kills);
        // cleared rooms grant a traversal boost so backtracking to doors is snappy
        const mom = this.momentumT > 0 ? 1.25 : 1;
        const haste = this.buffs.hasteT > 0 ? 1.30 : 1;
        // cleared-room traversal boost; and a STRONGER one when backtracking far (>3
        // rooms) from the nearest unexplored room, so long treks back are snappy (#34)
        const clear = !g.monsters.some(m => !m.dead);
        const traversal = !clear ? 1 : ((g.backtrackRooms || 0) > 3 ? 1.7 : 1.28);
        const sp = T.speed * (stats.speedMul + this.mod('spd')) * mom * haste * traversal;
        this.x += mx * sp * dt;
        this.y += my * sp * dt;
        // roll trigger
        if ((input.pressed('Space') || input.pressed('ShiftLeft') || input.pressed('ShiftRight')) && this.rollCd <= 0) {
          this.rollT = 0;
          this.rollAngle = this.moving ? this.moveAngle : this.facing;
          this.rollCd = T.rollCooldown * stats.rollCdMul * (1 - Math.min(0.5, this.mod('rollCd')));
          this.rollCdMax = this.rollCd; // HUD arc renders against this (stays right through refunds/mod changes)
          this.iframes = Math.max(this.iframes, T.rollIframes + this.mod('phantomStep'));
          this.rollHits = new Set(); // fresh rollNova targets each roll
          this.drawT = -1; // rolling cancels a bow draw
          Sfx.play('roll');
          Fx.burst(this.x, this.y, '#7fd4ff', 6, { speed: 80, life: 0.3 });
        }
      }

      // hit knockback decay
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.vx *= Math.pow(0.001, dt); this.vy *= Math.pow(0.001, dt);

      // obstacles + pits (both are solid to the player - you can't fall in a pit)
      for (const o of g.room.obstacles) {
        const dx = this.x - o.x, dy = this.y - o.y, d = Math.hypot(dx, dy);
        if (d < o.r + this.r && d > 0) { this.x = o.x + (dx / d) * (o.r + this.r); this.y = o.y + (dy / d) * (o.r + this.r); }
      }
      // #67b solid wall rects that carve the room shape (anti-tunnel via pre-move pos)
      if (g.room.walls) for (const w of g.room.walls) { const q = Dungeon.rectPush(this.x, this.y, this.r, w, this.px, this.py); if (q) { this.x = q.x; this.y = q.y; } }
      // (room-boundary walls/doors are handled by main.js so it can detect room exits)

      // --- attacking -----------------------------------------------------------
      const w = this.weapon;
      // auto-attack: melee swings only when the target is actually in reach;
      // the bow self-draws and releases at a solid (not full) draw
      // pre-swing (Sam): start the swing just before the target reaches range so
      // the hit lands as it arrives - lead by the distance it closes during windup
      // (applyMelee re-checks range at release, so an early swing that whiffs is fine)
      // #47: MELEE hits what's adjacent, so swing at the NEAREST enemy in reach, not a
      // far cursor-picked one (cursor-aim is for ranged). Pre-swing lead only helps when
      // there's a windup for the target to close during; a zero-windup dagger with a flat
      // +10 lead just swung-and-whiffed on fast swarmers (burning its cooldown).
      const meleeTarget = nearTarget || autoTarget;
      const meleeDist = meleeTarget ? Math.hypot(meleeTarget.x - this.x, meleeTarget.y - this.y) : 1e9;
      const lead = w.windup > 0 ? w.windup * ((meleeTarget && meleeTarget.speed) || 0) + 8 : 3;
      const autoMelee = meleeTarget && meleeDist <= w.range + meleeTarget.r + lead;
      if (w.archetype === 'bow') {
        const wantDraw = this.autoAttack && autoTarget && this.rollT < 0;
        if (wantDraw) {
          if (this.drawT < 0 && this.attackCd <= 0) { this.drawT = 0; Sfx.play('bowdraw'); }
          // attack speed charges the DRAW too, not just the between-shots cooldown -
          // otherwise atkspd barely helped bows (the fixed 0.8s draw dominated)
          const asf = stats.atkSpeedMul + this.mod('atkSpd') + this.frenzy.s * 0.02;
          if (this.drawT >= 0) this.drawT += dt * asf;
          if (this.drawT >= 0.72) { // auto-release near full draw
            this.fireBow(g);
            this.drawT = -1;
          }
        } else if (this.drawT >= 0) {
          this.fireBow(g);
          this.drawT = -1;
        }
      } else if (w.archetype === 'wand' || w.archetype === 'staff') {
        // #16 wield gate: you need enough Magic to channel this weapon at all
        if (!this.canWield(w)) {
          this.magicWarnT = (this.magicWarnT || 0) - dt;
          if (this.magicWarnT <= 0) { this.magicWarnT = 1.2; Fx.text(this.x, this.y - 32, `NEEDS MAGIC ${w.magicReq}`, '#b06bff', 12); Sfx.play('error'); }
        } else if (w.archetype === 'wand') {
          // wand: fast auto-fired magic bolts, no draw - rip when a target exists
          if (this.autoAttack && autoTarget && this.attackCd <= 0 && this.rollT < 0) this.fireSpell(g);
        } else {
          // staff: a charged cast (drawT = charge); fires a fireball at full charge
          const wantCast = this.autoAttack && autoTarget && this.rollT < 0;
          if (wantCast) {
            if (this.drawT < 0 && this.attackCd <= 0) { this.drawT = 0; Sfx.play('bowdraw'); }
            const asf = stats.atkSpeedMul + this.mod('atkSpd') + this.frenzy.s * 0.02;
            if (this.drawT >= 0) this.drawT += dt * asf;
            if (this.drawT >= w.windup) { this.fireSpell(g); this.drawT = -1; }
          } else if (this.drawT >= 0) {
            this.drawT = -1; // target left before the cast finished: fizzle
          }
        }
      } else {
        // face the nearest in-reach enemy for the swing (so the arc lands on it)
        if (this.autoAttack && autoMelee && this.attackCd <= 0 && this.rollT < 0) {
          this.facing = Math.atan2(meleeTarget.y - this.y, meleeTarget.x - this.x);
          this.startSwing(g);
        }
      }

      // ongoing swing (heavy applies damage at end of windup)
      if (this.swing) {
        this.swing.t += dt;
        if (!this.swing.fired && this.swing.t >= this.swing.windup) {
          this.swing.fired = true;
          this.applyMelee(g);
        }
        if (this.swing.t >= this.swing.dur) this.swing = null;
      }

      // pet trails just behind and to the side, bobbing
      if (this.pet) {
        const tx = this.x - 26, ty = this.y - 16, k = Math.min(1, dt * 6);
        this.pet.x += (tx - this.pet.x) * k;
        this.pet.y += (ty - this.pet.y) * k;
        this.pet.bob += dt;
      }
    }

    // #S3 manual attack: when auto-attack is OFF, left-click swings/fires the current
    // weapon toward the cursor, respecting its cooldown. Restores the click-to-attack
    // instinct so 'auto off' doesn't turn a player into a pacifist.
    manualAttack(g, mx, my) {
      if (this.dead || this.rollT >= 0 || this.attackCd > 0) return;
      const w = this.weapon; if (!w) return;
      this.facing = Math.atan2(my - this.y, mx - this.x);
      if (w.archetype === 'bow') { this.drawT = 0.72; this.fireBow(g); this.drawT = -1; }
      else if (w.archetype === 'wand' || w.archetype === 'staff') { if (this.canWield(w)) this.fireSpell(g); }
      else this.startSwing(g);
    }

    startSwing(g) {
      const w = this.weapon;
      const windup = w.windup;
      this.swing = {
        t: 0, windup,
        dur: windup + 0.18,
        dir: this.facing,
        arc: w.arc, range: w.range,
        fired: windup === 0 ? false : false,
        side: (this.lastSide = -(this.lastSide || 1)), // light alternates swing side
        heavy: w.archetype === 'heavy',
        fx: Weapons.fxPalette(w), rarIdx: w.rarIdx, // enchant/rarity flair for the sweep
      };
      this.attackCd = w.cooldown;
      if (windup === 0) { this.swing.fired = true; this.applyMelee(g); Sfx.play('swing'); }
      else Sfx.play('swing');
    }

    applyMelee(g) {
      const w = this.weapon, stats = this.stats;
      const dir = this.facing; // heavy re-aims at release: feels responsive
      this.swing.dir = dir;
      // co-op: let the other players SEE this swing (visual only)
      if (g.coop && typeof Net !== 'undefined' && Net.connected) {
        Net.send({ t: 'atk', k: 'm', x: Math.round(this.x), y: Math.round(this.y), d: +dir.toFixed(2), r: Math.round(w.range), a: +w.arc.toFixed(2), c: w.color, ri: w.rarIdx || 0, hv: w.archetype === 'heavy' ? 1 : 0 });
      }
      if (w.archetype === 'heavy') {
        Sfx.play('heavy');
        Fx.hitstop(0.055);      // hit-stop freeze frame on the heavy swing
        Fx.shake(5, 0.18);
      }
      let hitAny = false;
      const swingOnce = (dmgScale) => {
        for (const m of g.monsters) {
          if (m.dead || m.airborne) continue;
          const dx = m.x - this.x, dy = m.y - this.y;
          const d = Math.hypot(dx, dy);
          if (d > w.range + m.r) continue;
          let diff = Math.abs(((Math.atan2(dy, dx) - dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff > w.arc / 2) continue;
          // #83 a wall between you and the target blocks the swing (no hitting through walls)
          if (g.room.walls && g.room.walls.length && Dungeon.segBlocked(this.x, this.y, m.x, m.y, g.room.walls)) continue;
          const { dmg, crit } = this.computeDmg(w.dmg * dmgScale, m, g);
          const landed = m.takeHit(dmg, {
            sx: this.x, sy: this.y,
            knock: (Weapons.has(w, 'knockback') ? 260 : 90) + (w.archetype === 'heavy' ? 160 : 0),
            flame: Weapons.has(w, 'fireaspect') || (crit && this.mod('critBleed') ? this.mod('critBleed') : 0),
            chill: Weapons.has(w, 'frost'), venom: Weapons.has(w, 'venom'), chain: Weapons.has(w, 'chain'),
            stagger: w.stagger,
            execute: !!Weapons.has(w, 'executioner'),
            hitSfx: w.archetype === 'heavy' ? 'hitHeavy' : 'hitLight',
            crit, fromPlayer: true,
          }, g);
          if (landed) { this.onHitLanded(crit, g); hitAny = true; } // blocked hits earn nothing
        }
      };
      swingOnce(1);
      // Echo evolutions: light swings sometimes strike twice (second at half power)
      if (w.archetype === 'light' && this.mod('echo') && Math.random() < this.mod('echo')) {
        swingOnce(0.5);
        Fx.text(this.x, this.y - 34, 'ECHO', '#ff9a3d', 11);
      }
      if (hitAny && w.archetype === 'heavy') Fx.shake(7, 0.22);

      // enchant sparks along the swept arc - more of them the rarer the weapon
      const fx = this.swing.fx || { colors: [w.color], glow: false };
      const n = 6 + w.rarIdx * 3;
      for (let i = 0; i <= n; i++) {
        const a = dir - w.arc / 2 + w.arc * (i / n);
        Fx.burst(this.x + Math.cos(a) * w.range * 0.85, this.y + Math.sin(a) * w.range * 0.85,
          fx.colors, 1, { speed: 55, life: 0.3, glow: fx.glow, size: 2.5 });
      }
    }

    fireBow(g) {
      const w = this.weapon, stats = this.stats;
      const draw = Math.min(1, this.drawT / 0.8); // full power at 0.8s draw
      if (this.drawT < 0.08) { this.attackCd = 0.1; return; } // tap = dry-fire nothing
      const n = Weapons.has(w, 'multishot') ? 3 : 1;
      const spread = 0.14;
      const fx = Weapons.fxPalette(w); // arrows trail their enchant's element
      for (let i = 0; i < n; i++) {
        const a = this.facing + (i - (n - 1) / 2) * spread;
        // computeDmg without a target: per-target bonuses apply via projectile flags
        const { dmg, crit } = this.computeDmg(w.dmg * (0.55 + draw * 0.65), null, g);
        g.projectiles.push({
          trail: fx.colors, glowTrail: fx.glow,
          x: this.x + Math.cos(a) * 16, y: this.y + Math.sin(a) * 16,
          vx: Math.cos(a) * w.projSpeed * (0.65 + draw * 0.5),
          vy: Math.sin(a) * w.projSpeed * (0.65 + draw * 0.5),
          r: 4, dmg,
          from: 'player', color: crit ? '#ffd24c' : '#e8e3d0', life: 1.6,
          pierce: Weapons.has(w, 'piercing') ? 3 : 0,
          knock: Weapons.has(w, 'punch') ? 240 : 60,
          flame: Weapons.has(w, 'flame') || (crit && this.mod('critBleed') ? this.mod('critBleed') : 0),
          chill: Weapons.has(w, 'frost'), venom: Weapons.has(w, 'venom'), chain: Weapons.has(w, 'chain'),
          hitSfx: 'hitArrow',
          crit, arrow: true, hitSet: new Set(),
        });
        // co-op: mirror the arrow to peers as a visual-only projectile
        if (g.coop && typeof Net !== 'undefined' && Net.connected) {
          Net.send({ t: 'atk', k: 'b', x: Math.round(this.x + Math.cos(a) * 16), y: Math.round(this.y + Math.sin(a) * 16),
            vx: Math.round(Math.cos(a) * w.projSpeed * (0.65 + draw * 0.5)), vy: Math.round(Math.sin(a) * w.projSpeed * (0.65 + draw * 0.5)),
            c: (fx.colors && fx.colors[0]) || '#e8e3d0' });
        }
      }
      this.attackCd = w.cooldown;
      Sfx.play('bowfire');
    }

    // #16 MAGIC: wand fires fast bolts; staff fires a slow fireball that bursts on
    // impact (AOE + burn). Both route enchants like a bow (Flame/Multishot/Power...).
    fireSpell(g) {
      const w = this.weapon, a = this.facing;
      const fx = Weapons.fxPalette(w);
      // #49 Magic scaling: spells hit harder the more Magic you have (+8%/point over 1),
      // so investing the stat is the payoff for a magic build (and Attunement earns its slot).
      // #46 the ARCANE Spell-Power branch multiplies on top of that (spellPower fx).
      const magScale = (1 + Math.max(0, this.magicLevel() - 1) * 0.08) * (1 + this.mod('spellPower'));
      const mkProj = (ang, base, extra) => {
        const { dmg, crit } = this.computeDmg(base * magScale, null, g);
        const sp = w.projSpeed;
        const pr = {
          x: this.x + Math.cos(ang) * 16, y: this.y + Math.sin(ang) * 16,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          dmg, from: 'player', crit, hitSet: new Set(),
          trail: fx.colors, glowTrail: fx.glow,
          flame: Weapons.has(w, 'flame'), chill: Weapons.has(w, 'frost'),
          venom: Weapons.has(w, 'venom'), chain: Weapons.has(w, 'chain'),
        };
        Object.assign(pr, extra);
        g.projectiles.push(pr);
        if (g.coop && typeof Net !== 'undefined' && Net.connected) {
          // sp/r let peers render the actual spell (glowing orb) instead of a plain arrow
          Net.send({ t: 'atk', k: 'b', x: Math.round(pr.x), y: Math.round(pr.y), vx: Math.round(pr.vx), vy: Math.round(pr.vy), c: pr.color || (fx.colors && fx.colors[0]) || '#b06bff', sp: pr.spell, r: pr.r });
        }
      };
      if (w.magic === 'fireball') {
        // #49 elemental staff: the charged burst takes on the staff's enchant element.
        // Frost -> a chilling nova, Venom -> a poison bloom, Chain -> a storm burst;
        // a plain staff stays a fireball (and always burns a little).
        let col = '#ff8a3d', elem = 'fire', extra = { flame: 2 };
        if (Weapons.has(w, 'frost'))      { col = '#7fe0ff'; elem = 'ice';    extra = { chill: true }; }
        else if (Weapons.has(w, 'venom')) { col = '#8ef06e'; elem = 'poison'; extra = { venom: true }; }
        else if (Weapons.has(w, 'chain')) { col = '#ffe27a'; elem = 'storm';  extra = { chain: true }; }
        const blast = 64 + this.mod('blastBonus'); // #46 ARCANE Elemental-Reach branch widens the burst
        mkProj(a, w.dmg, Object.assign({ r: 8, color: col, life: 2.0, blast, hitSfx: 'hitHeavy', spell: 'fireball', elem }, extra));
        Fx.shake(3, 0.12); Sfx.play('heavy');
      } else { // wand bolt (Multishot -> a 3-bolt fan)
        const n = Weapons.has(w, 'multishot') ? 3 : 1;
        for (let i = 0; i < n; i++) mkProj(a + (i - (n - 1) / 2) * 0.12, w.dmg, {
          r: 5, color: (fx.colors && fx.colors[0]) || '#b06bff', life: 1.4,
          pierce: Weapons.has(w, 'piercing') ? 2 : 0, knock: Weapons.has(w, 'punch') ? 200 : 40,
          hitSfx: 'hitArrow', spell: 'bolt',
        });
        Sfx.play('bowfire');
      }
      this.attackCd = w.cooldown;
    }

    // --- rendering -----------------------------------------------------------------
    draw(c, g) {
      if (this.dead) {
        if (this.downed) this.drawDowned(c); // co-op: a revivable corpse, not gone
        return;
      }
      if (this.pet) this.drawPet(c);
      c.save();
      c.translate(this.x, this.y);

      // visual evolution state (drives aura, robe recolour, crest, embers)
      const evoStage = Math.min(4, this.evoCount || 0);
      const dom = evoStage > 0 ? this.dominantStat() : null;
      const pal = dom ? EVO_PAL[dom] : null;

      // roll cooldown indicator: small radial arc under the player
      if (this.rollCd > 0) {
        const k = 1 - this.rollCd / (this.rollCdMax || (T.rollCooldown * this.stats.rollCdMul));
        c.strokeStyle = 'rgba(127,212,255,0.5)';
        c.lineWidth = 3;
        c.beginPath(); c.arc(0, this.r + 8, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); c.stroke();
      } else {
        c.fillStyle = 'rgba(127,212,255,0.55)';
        c.beginPath(); c.arc(0, this.r + 8, 3, 0, Math.PI * 2); c.fill();
      }

      // buff auras
      if (this.buffs.shield > 0) {
        c.strokeStyle = `rgba(127,212,255,${0.5 + Math.sin(Date.now() / 200) * 0.25})`;
        c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, this.r + 6, 0, Math.PI * 2); c.stroke();
      }
      if (this.buffs.rageT > 0 && Math.random() < 0.3) {
        Fx.burst(this.x + (Math.random() * 16 - 8), this.y - this.r, ['#e05555', '#ff9a3d'], 1, { speed: 30, life: 0.35, vy: -40 });
      }
      if (this.buffs.hasteT > 0 && this.moving && Math.random() < 0.4) {
        Fx.burst(this.x, this.y + this.r * 0.5, '#ffe08a', 1, { speed: 20, life: 0.3 });
      }
      // fully-evolved champions trail embers in their dominant colour
      if (evoStage >= 4 && pal && Math.random() < 0.28) {
        Fx.burst(this.x + (Math.random() * 20 - 10), this.y - this.r * 0.4, [pal.accent, '#fff'], 1, { speed: 24, life: 0.45, vy: -34, glow: true });
      }

      // i-frame flicker
      if (this.iframes > 0 && this.rollT < 0 && Math.sin(Date.now() / 30) > 0) c.globalAlpha = 0.45;

      // evolution aura: a soft halo that swells with each stage
      if (pal && evoStage >= 1) {
        c.save();
        const rad = this.r + 4 + evoStage * 2.5 + Math.sin(Date.now() / 300) * 1.5;
        c.globalAlpha *= 0.10 + evoStage * 0.05;
        c.fillStyle = pal.accent;
        c.beginPath(); c.arc(0, 0, rad, 0, Math.PI * 2); c.fill();
        c.restore();
      }

      // squash & stretch + spin through the roll
      if (this.rollT >= 0) {
        const k = this.rollT / T.rollDur;
        c.rotate(this.rollAngle + k * Math.PI * 2 * (Math.cos(this.rollAngle) >= 0 ? 1 : -1));
        c.scale(1 + 0.25 * Math.sin(k * Math.PI), 1 - 0.3 * Math.sin(k * Math.PI));
      }

      // the champion grows more imposing as it evolves (visual only; hitbox r unchanged)
      const vs = 1 + 0.05 * Math.max(0, evoStage - 1);
      if (vs !== 1) c.scale(vs, vs);

      // shadow
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.ellipse(0, this.r * 0.85, this.r * 0.9, this.r * 0.35, 0, 0, Math.PI * 2); c.fill();

      // #43 PRESTIGE cape: a royal mantle that grows richer with each prestige level.
      // Purely cosmetic (earned by resetting your essence account). Drawn behind
      // everything so it flows out from under the champion. Distinct from the
      // ACROBAT roll-tail (that one is a small coloured triangle).
      const prestige = (g && g.meta && g.meta.prestige) || 0;
      if (prestige > 0) this.drawPrestigeCape(c, prestige);

      // #22: evolution BODY PARTS grow from the paths you take - wings sit BEHIND
      // the body, so draw them before the cloak
      this.drawEvoParts(c, 'back');

      // cloak - recoloured to the dominant path from stage 2 on
      const cloakCol = this.flash > 0 ? '#ff8080' : (evoStage >= 2 && pal ? pal.cloak : '#2c3e60');
      const bodyCol  = this.flash > 0 ? '#ffb0b0' : (evoStage >= 2 && pal ? pal.body : '#4a6fa5');
      c.fillStyle = cloakCol;
      c.beginPath(); c.arc(0, 2, this.r, 0, Math.PI * 2); c.fill();
      // body
      c.fillStyle = bodyCol;
      c.beginPath(); c.arc(0, -2, this.r * 0.85, 0, Math.PI * 2); c.fill();
      // visor facing aim
      c.save();
      c.rotate(this.rollT >= 0 ? 0 : this.facing);
      c.fillStyle = '#0e1420';
      c.fillRect(this.r * 0.15, -4, this.r * 0.75, 8);
      c.fillStyle = evoStage >= 2 && pal ? pal.accent : '#9ee7ff';
      c.fillRect(this.r * 0.3, -2.5, this.r * 0.5, 5);
      c.restore();

      // #52 class signature look: warrior pauldrons, ranger feather cap, mage hat,
      // rogue cowl. Drawn on the head/shoulders in the FIXED body frame (doesn't spin
      // with aim); evolution parts layer on top.
      this.drawClassFeature(c, evoStage, pal);

      // #22: front body parts (horns / claws / pauldrons / crown / halo) grown
      // from your evolution paths, drawn over the body
      this.drawEvoParts(c, 'front');

      c.restore();

      // weapon rendering (outside the roll transform)
      if (this.rollT < 0) this.drawWeapon(c);

      // #55 TAUNTED indicator - bold blinking red over your head so it reads as a
      // feature (a shielder is forcing your aim), not a bug
      if (g.playerTaunt && g.playerTaunt.t > 0) {
        c.save(); c.textAlign = 'center'; c.font = 'bold 12px monospace';
        c.fillStyle = Math.sin(Date.now() / 110) > 0 ? '#ff2020' : '#ff6060';
        c.fillText('TAUNTED!', this.x, this.y - this.r - 16);
        c.restore();
      }
    }

    // #43 the prestige cape - a draped royal mantle behind the champion, built as
    // two fold panels (a darker left, lighter right) with a scalloped hem, gold trim
    // and a gold collar clasp, so it reads as real cloth instead of a blob. Length,
    // richness and colour deepen with prestige (caps ~tier 6; the number keeps climbing).
    drawPrestigeCape(c, prestige) {
      capeAt(c, this.r, prestige, this.moving, this.x);
    }

    // #52 the class's signature headwear/armor, in the fixed body frame
    drawClassFeature(c) {
      const r = this.r;
      const id = (this.class && this.class.id) || '';
      if (id === 'warrior') {
        // a steel helm: domed skull, raised comb crest, a nasal guard down the face
        c.fillStyle = '#8b929c';                                   // steel dome
        c.beginPath(); c.arc(0, -r * 0.62, r * 0.72, Math.PI, 0); c.fill();
        c.fillStyle = '#aab2bd';                                   // lit top-left highlight
        c.beginPath(); c.arc(-r * 0.16, -r * 0.72, r * 0.42, Math.PI, Math.PI * 1.7); c.fill();
        c.fillStyle = '#5c626c';                                   // brow band
        c.fillRect(-r * 0.72, -r * 0.66, r * 1.44, r * 0.2);
        c.fillStyle = '#c9a227';                                   // gold crest comb
        c.beginPath();
        c.moveTo(-r * 0.5, -r * 1.05); c.quadraticCurveTo(0, -r * 1.5, r * 0.5, -r * 1.05);
        c.lineTo(r * 0.32, -r * 0.98); c.quadraticCurveTo(0, -r * 1.28, -r * 0.32, -r * 0.98);
        c.closePath(); c.fill();
        c.fillStyle = '#7a828d'; c.fillRect(-r * 0.09, -r * 0.66, r * 0.18, r * 0.72); // nasal guard
        c.strokeStyle = '#3f444c'; c.lineWidth = 1.2;
        c.beginPath(); c.arc(0, -r * 0.62, r * 0.72, Math.PI, 0); c.stroke();
        // (legacy pauldron code kept below but disabled via the false guard)
        if (false) for (const s of [-1, 1]) {
          c.save(); c.scale(s, 1);
          c.fillStyle = '#b06a28';
          c.beginPath(); c.ellipse(r * 0.8, 1, r * 0.42, r * 0.3, -0.35, 0, Math.PI * 2); c.fill();
          c.strokeStyle = '#6e3f14'; c.lineWidth = 1.5; c.stroke();
          c.fillStyle = '#ffd24c'; c.beginPath(); c.arc(r * 0.8, 1, 1.6, 0, Math.PI * 2); c.fill();
          c.restore();
        }
      } else if (id === 'ranger') {
        // green cap + a feather sweeping up and back
        c.fillStyle = '#2f6b46';
        c.beginPath(); c.arc(0, -r * 0.72, r * 0.6, Math.PI * 1.04, -Math.PI * 0.04); c.fill();
        c.fillStyle = '#26543a';
        c.beginPath(); c.ellipse(0, -r * 0.7, r * 0.72, r * 0.18, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#8ef0a8'; c.lineWidth = 2.4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-r * 0.2, -r * 1.0); c.quadraticCurveTo(-r * 0.95, -r * 1.5, -r * 0.7, -r * 1.98); c.stroke();
      } else if (id === 'mage') {
        // a full pointed wizard hat: wide brim, tall bent cone, a band and a gold star
        c.fillStyle = '#2a1840';
        c.beginPath(); c.ellipse(0, -r * 0.55, r * 1.05, r * 0.26, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#4a2d70';
        c.beginPath();
        c.moveTo(-r * 0.72, -r * 0.6);
        c.quadraticCurveTo(-r * 0.35, -r * 1.6, r * 0.55, -r * 2.2); // up to a bent tip
        c.quadraticCurveTo(-r * 0.05, -r * 1.25, r * 0.72, -r * 0.6);
        c.closePath(); c.fill();
        c.strokeStyle = '#2a1840'; c.lineWidth = 1; c.stroke();
        c.fillStyle = '#6b48a0'; c.fillRect(-r * 0.6, -r * 0.78, r * 1.2, r * 0.16); // hatband
        c.fillStyle = '#ffd24c'; c.beginPath(); c.arc(-r * 0.05, -r * 1.15, 2.1, 0, Math.PI * 2); c.fill();
      } else if (id === 'rogue') {
        // a dark cowl hooding the head, open at the face, with a faint gold trim
        c.fillStyle = '#221d13';
        c.beginPath();
        c.moveTo(-r * 0.95, r * 0.15);
        c.quadraticCurveTo(-r * 1.05, -r * 1.15, 0, -r * 1.18);
        c.quadraticCurveTo(r * 1.05, -r * 1.15, r * 0.95, r * 0.15);
        c.quadraticCurveTo(r * 0.55, -r * 0.15, 0, -r * 0.2);
        c.quadraticCurveTo(-r * 0.55, -r * 0.15, -r * 0.95, r * 0.15);
        c.closePath(); c.fill();
        c.strokeStyle = 'rgba(201,162,39,0.6)'; c.lineWidth = 1; c.stroke();
      } else if (id === 'barbarian') {
        // a fur cap crowned with two curved bone horns
        c.fillStyle = '#5a3a22';
        c.beginPath(); c.arc(0, -r * 0.55, r * 0.66, Math.PI, 0); c.fill();
        c.fillStyle = '#7a5233';
        c.beginPath(); c.ellipse(0, -r * 0.5, r * 0.72, r * 0.2, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#e8e0cf';
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * r * 0.5, -r * 0.7); c.quadraticCurveTo(s * r * 1.1, -r * 1.1, s * r * 0.8, -r * 1.6); c.quadraticCurveTo(s * r * 0.7, -r * 1.1, s * r * 0.35, -r * 0.75); c.closePath(); c.fill(); }
      } else if (id === 'paladin') {
        // a crested helm with a floating halo
        c.fillStyle = '#c9cdd6';
        c.beginPath(); c.arc(0, -r * 0.5, r * 0.7, Math.PI, 0); c.fill();
        c.fillStyle = '#ffd24c';
        c.beginPath(); c.moveTo(-r * 0.12, -r * 1.0); c.lineTo(0, -r * 1.5); c.lineTo(r * 0.12, -r * 1.0); c.closePath(); c.fill();
        c.strokeStyle = '#ffe08a'; c.lineWidth = 2; c.globalAlpha = 0.9;
        c.beginPath(); c.ellipse(0, -r * 1.35, r * 0.6, r * 0.2, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
      } else if (id === 'cleric') {
        // a white-and-gold hood with a small holy cross
        c.fillStyle = '#e8eef0';
        c.beginPath();
        c.moveTo(-r * 0.9, r * 0.1); c.quadraticCurveTo(-r * 1.0, -r * 1.1, 0, -r * 1.12);
        c.quadraticCurveTo(r * 1.0, -r * 1.1, r * 0.9, r * 0.1);
        c.quadraticCurveTo(r * 0.5, -r * 0.18, 0, -r * 0.22);
        c.quadraticCurveTo(-r * 0.5, -r * 0.18, -r * 0.9, r * 0.1);
        c.closePath(); c.fill();
        c.fillStyle = '#ffd24c';
        c.fillRect(-r * 0.09, -r * 1.05, r * 0.18, r * 0.42); c.fillRect(-r * 0.24, -r * 0.92, r * 0.48, r * 0.16);
      } else if (id === 'engineer') {
        // a yellow hard hat with a brim
        c.fillStyle = '#e0a91e'; c.beginPath(); c.arc(0, -r * 0.5, r * 0.7, Math.PI, 0); c.fill();
        c.fillStyle = '#c9931a'; c.fillRect(-r * 0.78, -r * 0.55, r * 1.56, r * 0.12);
        c.fillStyle = '#b8841a'; c.fillRect(-r * 0.07, -r * 1.15, r * 0.14, r * 0.55);
      }
      // adventurer: no signature look (plain champion)
    }

    // #22: physical evolution features. Each stat you've evolved (>=3 stacks, i.e.
    // at least a tier-I evolution) grows its own body part, sized up with tier - so a
    // Might build sprouts horns, a Swift build gets wings, an assassin grows claws.
    drawEvoParts(c, layer) {
      const r = this.r;
      // #52b harmonize with the class look: mage/ranger/rogue wear headgear, so head
      // evolutions (horns/crown) defer to it (flank/band) instead of piling on top;
      // the warrior already has pauldrons, so its hp evolution spikes THOSE up.
      const cls = (this.class && this.class.id) || '';
      const headHat = cls === 'mage' || cls === 'ranger' || cls === 'rogue';
      for (const k in this.upgradeStacks) {
        const stacks = this.upgradeStacks[k];
        if (stacks < 3) continue;
        const tier = Math.min(4, Math.floor(stacks / 3));   // 1..4
        const g = 0.55 + tier * 0.11;                        // grow with tier
        const col = (EVO_PAL[k] || {}).accent || '#fff';
        if (layer === 'back' && k === 'spd') {               // SWIFT -> wings (compact)
          c.save(); c.globalAlpha = 0.85;
          const wr = 0.75 + g * 0.28;                        // much smaller than before
          for (const s of [-1, 1]) {
            c.save(); c.scale(s, 1); c.fillStyle = col;
            c.beginPath();
            c.moveTo(r * 0.3, -r * 0.25);
            c.quadraticCurveTo(r * (0.95 * wr + 0.4), -r * (0.6 + g * 0.3), r * (1.05 * wr + 0.35), r * 0.2);
            c.quadraticCurveTo(r * 0.7, r * 0.05, r * 0.4, r * 0.28);
            c.closePath(); c.fill();
            c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1;
            c.beginPath(); c.moveTo(r * 0.42, -r * 0.12); c.lineTo(r * (0.95 * wr + 0.3), r * 0.0); c.stroke();
            c.restore();
          }
          c.restore();
        } else if (layer === 'back' && k === 'roll') {       // ACROBAT -> a trailing cape/tail
          c.save(); c.fillStyle = col; c.globalAlpha = 0.7;
          c.beginPath();
          c.moveTo(-r * 0.4, -r * 0.2); c.lineTo(-r * (1.2 + g), r * (0.8 + g));
          c.lineTo(-r * 0.2, r * 0.9); c.closePath(); c.fill();
          c.restore();
        } else if (layer === 'front' && k === 'dmg') {       // MIGHT -> horns
          c.save(); c.fillStyle = col;
          // with headgear the horns emerge lower and splay out to the SIDES so they
          // flank the hat/cowl instead of stabbing through it
          const hy = headHat ? -r * 0.35 : -r * 0.78;
          const hx = headHat ? 0.5 : 0.3;
          for (const s of [-1, 1]) {
            c.save(); c.scale(s, 1);
            c.beginPath();
            c.moveTo(r * hx, hy);
            c.quadraticCurveTo(r * (0.95 + g * 0.4), hy - r * (0.6 + g * 0.4), r * (1.15 + g * 0.3), hy + r * 0.15);
            c.quadraticCurveTo(r * 0.8, hy - r * 0.25, r * (hx + 0.15), hy);
            c.closePath(); c.fill();
            c.restore();
          }
          c.restore();
        } else if (layer === 'front' && k === 'crit') {      // ASSASSIN -> claws
          c.save(); c.strokeStyle = col; c.lineWidth = 1.8; c.lineCap = 'round';
          for (const s of [-1, 1]) {
            c.save(); c.scale(s, 1);
            for (let i = 0; i < 3; i++) {
              const yy = r * 0.15 + i * 3.2;
              c.beginPath(); c.moveTo(r * 0.8, yy); c.lineTo(r * (1.25 + g * 0.3), yy - 2 + i); c.stroke();
            }
            c.restore();
          }
          c.restore();
        } else if (layer === 'front' && k === 'hp') {        // BULWARK -> shoulder plates
          c.save(); c.fillStyle = col;
          if (cls === 'warrior') {
            // upgrade the class pauldrons: spikes rising off the existing shoulder plates
            for (const s of [-1, 1]) {
              c.beginPath();
              c.moveTo(s * r * 0.6, -r * 0.1); c.lineTo(s * r * (0.95 + g * 0.2), -r * (0.7 + g * 0.3)); c.lineTo(s * r * 1.0, -r * 0.05);
              c.closePath(); c.fill();
            }
          } else {
            for (const s of [-1, 1]) {
              c.beginPath(); c.ellipse(s * r * 0.85, -r * 0.1, r * (0.35 + g * 0.1), r * 0.5, s * 0.4, 0, Math.PI * 2); c.fill();
            }
          }
          c.restore();
        } else if (layer === 'front' && k === 'coin') {      // MAGNATE -> a gold crown
          c.save(); c.fillStyle = col;
          if (headHat) {
            // with headgear, the crown becomes a jewelled gold band around the brim
            c.beginPath(); c.ellipse(0, -r * 0.55, r * 0.9, r * 0.2, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#fff6c0';
            for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(i * r * 0.5, -r * 0.6, 1.6, 0, Math.PI * 2); c.fill(); }
          } else {
            const cw = r * 1.1, cy = -r * 0.95;
            c.beginPath(); c.moveTo(-cw / 2, cy);
            for (let i = 0; i <= 4; i++) { const x = -cw / 2 + (cw / 4) * i; c.lineTo(x, cy - (i % 2 ? r * 0.5 : r * 0.15)); c.lineTo(x + cw / 8, cy); }
            c.lineTo(cw / 2, cy + r * 0.18); c.lineTo(-cw / 2, cy + r * 0.18); c.closePath(); c.fill();
          }
          c.restore();
        } else if (layer === 'front' && k === 'regen') {     // EVERLIVING -> a leafy halo
          c.save(); c.strokeStyle = col; c.lineWidth = 1.4; c.globalAlpha = 0.8;
          c.beginPath(); c.arc(0, -r * 0.2, r * (1.15 + g * 0.2), Math.PI * 1.15, Math.PI * 1.85); c.stroke();
          c.fillStyle = col;
          for (let i = 0; i < 3; i++) { const a = Math.PI * (1.25 + i * 0.25); const rr = r * (1.15 + g * 0.2); c.beginPath(); c.ellipse(Math.cos(a) * rr, -r * 0.2 + Math.sin(a) * rr, 2.4, 1.4, a, 0, Math.PI * 2); c.fill(); }
          c.restore();
        } else if (layer === 'front' && k === 'atkspd') {    // FRENZIED -> back blades
          c.save(); c.fillStyle = col; c.globalAlpha = 0.9;
          for (const s of [-1, 1]) {
            c.beginPath(); c.moveTo(s * r * 0.5, -r * 0.5); c.lineTo(s * r * (1.1 + g * 0.3), -r * (1.0 + g * 0.3)); c.lineTo(s * r * 0.75, -r * 0.35); c.closePath(); c.fill();
          }
          c.restore();
        }
      }
    }

    // co-op downed pose: a greyed, slumped body under a pulsing revive ring
    drawDowned(c) {
      c.save();
      c.translate(this.x, this.y);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.ellipse(0, 6, this.r * 1.1, this.r * 0.4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a3f4d';
      c.beginPath(); c.ellipse(0, 2, this.r * 1.1, this.r * 0.7, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#5a6478';
      c.beginPath(); c.arc(this.r * 0.5, 0, this.r * 0.5, 0, Math.PI * 2); c.fill();
      c.restore();
      const t = Date.now() / 300;
      const pr = this.r + 8 + Math.sin(t) * 3;
      c.strokeStyle = `rgba(127,212,255,${0.4 + Math.sin(t) * 0.2})`; c.lineWidth = 2;
      c.beginPath(); c.arc(this.x, this.y, pr, 0, Math.PI * 2); c.stroke();
      c.textAlign = 'center'; c.font = 'bold 10px monospace'; c.fillStyle = '#7fd4ff';
      c.fillText('DOWNED', this.x, this.y - this.r - 10);
    }

    drawPet(c) {
      const p = this.pet;
      const by = Math.sin(p.bob * 4) * 2.5;
      c.save();
      c.translate(p.x, p.y + by);
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(0, 9 - by, 7, 2.5, 0, 0, Math.PI * 2); c.fill();
      c.shadowColor = p.color; c.shadowBlur = 8;
      c.fillStyle = p.color;
      c.beginPath(); c.arc(0, 0, 6, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0;
      if (p.type === 'owl' || p.type === 'sprite') { // little wings
        c.beginPath(); c.ellipse(-7, 0, 3, 5, 0.5, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(7, 0, 3, 5, -0.5, 0, Math.PI * 2); c.fill();
      } else if (p.type === 'imp') {           // horns
        c.beginPath(); c.moveTo(-3, -5); c.lineTo(-5, -9); c.lineTo(-1, -6); c.fill();
        c.beginPath(); c.moveTo(3, -5); c.lineTo(5, -9); c.lineTo(1, -6); c.fill();
      }
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(-2, -1, 1.6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(2, -1, 1.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#111';
      c.beginPath(); c.arc(-2, -1, 0.8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(2, -1, 0.8, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    drawWeapon(c) {
      const w = this.weapon;
      c.save();
      c.translate(this.x, this.y);
      c.rotate(this.facing);
      if (w.archetype === 'bow') {
        const pull = this.drawT >= 0 ? Math.min(1, this.drawT / 0.8) : 0;
        c.strokeStyle = w.color; c.lineWidth = 3;
        c.beginPath(); c.arc(this.r + 7, 0, 11, -Math.PI / 2.1, Math.PI / 2.1); c.stroke();
        c.strokeStyle = '#ccc'; c.lineWidth = 1;
        const tipY = Math.sin(Math.PI / 2.1) * 11;
        c.beginPath();
        c.moveTo(this.r + 7 + Math.cos(-Math.PI / 2.1) * 11, -tipY);
        c.lineTo(this.r + 7 - pull * 8, 0);
        c.lineTo(this.r + 7 + Math.cos(Math.PI / 2.1) * 11, tipY);
        c.stroke();
        if (pull > 0) {
          c.strokeStyle = '#e8e3d0'; c.lineWidth = 2.5;
          c.beginPath(); c.moveTo(this.r + 7 - pull * 8, 0); c.lineTo(this.r + 18 - pull * 8, 0); c.stroke();
          // full-draw sparkle
          if (pull >= 1) { c.fillStyle = '#ffd24c'; c.beginPath(); c.arc(this.r + 19 - pull * 8, 0, 2.5, 0, Math.PI * 2); c.fill(); }
        }
        c.restore();
        return;
      }
      if (w.archetype === 'wand' || w.archetype === 'staff') {
        // #16 a shaft with a glowing tip; the staff's tip swells as it charges a cast
        const isStaff = w.archetype === 'staff';
        const len = this.r + (isStaff ? 22 : 14);
        c.strokeStyle = isStaff ? '#6a5030' : w.color; c.lineWidth = isStaff ? 3 : 2.5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(this.r * 0.4, 0); c.lineTo(len - 4, 0); c.stroke();
        const charge = (isStaff && this.drawT >= 0) ? Math.min(1, this.drawT / w.windup) : 0;
        c.shadowColor = w.color; c.shadowBlur = 6 + charge * 10;
        c.fillStyle = charge > 0.05 ? '#ffd24c' : w.color;
        c.beginPath(); c.arc(len, 0, (isStaff ? 4 : 3) + charge * 3.5, 0, Math.PI * 2); c.fill();
        c.shadowBlur = 0;
        c.restore();
        return;
      }
      c.restore();

      // melee: draw the swing arc while swinging, otherwise blade at rest
      if (this.swing) {
        const s = this.swing;
        const w2 = this.weapon;
        c.save();
        c.translate(this.x, this.y);
        if (!s.fired) {
          // windup: blade raised behind, growing glow (the heavy telegraph);
          // epic+ weapons gather sparks at the blade tip while charging
          const k = s.t / s.windup;
          c.rotate(s.dir - s.arc * 0.7);
          c.strokeStyle = `rgba(255,255,255,${0.25 + k * 0.5})`;
          c.lineWidth = 4;
          c.beginPath(); c.moveTo(this.r, 0); c.lineTo(this.r + w2.range * 0.55, 0); c.stroke();
          if (s.rarIdx >= 2 && Math.random() < 0.5) {
            const tip = s.dir - s.arc * 0.7;
            Fx.burst(this.x + Math.cos(tip) * w2.range * 0.55, this.y + Math.sin(tip) * w2.range * 0.55,
              s.fx.colors, 1, { speed: 25, life: 0.25, glow: s.fx.glow, size: 2 });
          }
        } else {
          // release: arc sweep tinted by rarity, elemental sparks riding the edge
          const k = (s.t - s.windup) / (s.dur - s.windup);
          const a0 = s.dir - s.arc / 2, a1 = s.dir - s.arc / 2 + s.arc * Math.min(1, k * 1.5);
          const grad = c.createRadialGradient(0, 0, this.r, 0, 0, w2.range);
          grad.addColorStop(0, 'rgba(255,255,255,0)');
          grad.addColorStop(0.7, `rgba(255,255,255,${0.35 * (1 - k)})`);
          grad.addColorStop(1, w2.color + '00');
          c.fillStyle = grad;
          c.beginPath();
          c.moveTo(0, 0);
          c.arc(0, 0, w2.range, a0, a1);
          c.closePath(); c.fill();
          // inner white flash + rarity-colored blade edge (thicker as rarity climbs)
          c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
          c.lineWidth = s.heavy ? 5 : 3;
          c.beginPath(); c.arc(0, 0, w2.range * 0.9, a0, a1); c.stroke();
          c.globalAlpha = 0.85 * (1 - k);
          c.strokeStyle = w2.color;
          c.lineWidth = (s.heavy ? 3 : 2) + (s.rarIdx || 0);
          c.beginPath(); c.arc(0, 0, w2.range * 0.99, a0, a1); c.stroke();
          c.globalAlpha = 1;
          // sparks stream off the leading edge of the sweep
          if (s.fx && Math.random() < 0.8) {
            Fx.burst(this.x + Math.cos(a1) * w2.range * 0.95, this.y + Math.sin(a1) * w2.range * 0.95,
              s.fx.colors, 1, { speed: 45, life: 0.28, glow: s.fx.glow, size: 2.2 });
          }
        }
        c.restore();
      } else {
        // #45: a distinct idle weapon MODEL per archetype so you can see what you wield
        const w = this.weapon, L = this.r * 0.6;
        c.save();
        c.translate(this.x, this.y);
        c.rotate(this.facing + 0.7);
        if (w.archetype === 'heavy') {           // AXE: wooden haft + a broad blade head
          c.strokeStyle = '#6a5030'; c.lineWidth = 3; c.lineCap = 'round';
          c.beginPath(); c.moveTo(L - 3, 0); c.lineTo(L + 20, 0); c.stroke();
          c.fillStyle = w.color;
          c.beginPath();
          c.moveTo(L + 11, -2.5);
          c.quadraticCurveTo(L + 25, -10, L + 23, 0);
          c.quadraticCurveTo(L + 25, 10, L + 11, 2.5);
          c.closePath(); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.25)';
          c.beginPath(); c.moveTo(L + 11, -2.5); c.quadraticCurveTo(L + 20, -7, L + 21, -1); c.lineTo(L + 12, -1); c.closePath(); c.fill();
        } else {                                  // SWORD: blade, crossguard, grip, pommel
          c.strokeStyle = '#6a5030'; c.lineWidth = 2.5; c.lineCap = 'round';
          c.beginPath(); c.moveTo(L - 4, 0); c.lineTo(L, 0); c.stroke();       // grip
          c.strokeStyle = w.color; c.lineWidth = 2; c.lineCap = 'butt';
          c.beginPath(); c.moveTo(L, -3.5); c.lineTo(L, 3.5); c.stroke();      // crossguard
          c.lineWidth = 3;
          c.beginPath(); c.moveTo(L, 0); c.lineTo(L + 17, 0); c.stroke();      // blade
          c.fillStyle = w.color;
          c.beginPath(); c.moveTo(L + 17, -2); c.lineTo(L + 22, 0); c.lineTo(L + 17, 2); c.closePath(); c.fill(); // tip
        }
        c.restore();
      }
    }
  }

  return { Player, T, CLASSES, classById, capeAt, peerWeapon, drawClassPortrait };
})();
