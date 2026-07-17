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
      q: 'Tumble Volley', qDesc: 'An evasive roll you cannot be hit during, and it refunds your dodge.' },
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
    { id: 'summoner',  name: 'Summoner',  color: '#9ad0ff', icon: '❈', arch: 'wand',
      desc: 'Starts with a wand. Magic 2. Commands an elemental.', magic: 2, fx: { spellPower: 0.10 },
      q: 'Summon Elemental', qDesc: 'Summon an elemental matching your weapon (Fire/Lightning/Poison, or Earth). It fights until killed; scales with Arcane.' },
    // #156 five new classes.
    { id: 'mesmer',      name: 'Mesmer',       color: '#c78bff', icon: '❋', arch: 'wand',
      desc: 'Starts with a wand. Magic 2 and +10% move speed. Fights with copies of itself.', magic: 2, fx: { spd: 0.10, spellPower: 0.08 },
      q: 'Mirror Image',  qDesc: 'Split into three copies. Enemies chase them instead of you, and each one detonates when it dies.' },
    { id: 'druid',       name: 'Druid',        color: '#7fd47f', icon: '❦', arch: 'wand',
      desc: 'Starts with a wand. Magic 1, +10 HP. Shifts between two animal forms.', magic: 1, hp: 10, fx: { regenFlat: 0.4 },
      q: 'Shapeshift',    qDesc: 'Cycle Bear (tanky, slow, hits like a truck) and Wolf (fast, frail, bleeds fangs). Shift to suit the room.' },
    { id: 'deathknight', name: 'Death Knight', color: '#8fd6d0', icon: '☨', arch: 'heavy',
      desc: 'Starts with a heavy weapon. +25 HP. Enemies dying near you feed you, and you refuse to die once per cast.', hp: 25, fx: { soulFeast: 3, reduce: 0.05 },
      q: 'Unholy Rune',   qDesc: 'LIFE AFTER DEATH. Carve a rune - the next hit that would kill you leaves you at 1 HP instead, and the room pays for it.' },
    { id: 'necromancer', name: 'Necromancer',  color: '#9ae6a0', icon: '☠', arch: 'wand',
      desc: 'Starts with a wand. Magic 3. Commands a growing army of the dead.', magic: 3, fx: { spellPower: 0.12 },
      q: 'Raise Dead',    qDesc: 'Raise a skeletal knight. As you level the grave gives more: two knights, then three knights and two archers.' },
    { id: 'pyromancer',  name: 'Pyromancer',   color: '#ff8a3d', icon: '✸', arch: 'wand',
      desc: 'Starts with a wand. Magic 3, +18% spell power. Everything you touch catches fire.', magic: 3, fx: { spellPower: 0.18, burnOnHit: 1 },
      q: 'Immolate',      qDesc: 'EVERYTHING MUST BURN. You erupt, and every enemy in the room is set alight - burning spreads from the dying to the living.' },
    // #258 (Sam) the FORTUNE class - the gap the Q walkthrough left open
    { id: 'gambler',     name: 'Gambler',      color: '#ffce54', icon: '⛀', arch: 'light',
      desc: 'Starts with a dagger and 40 gold. +10% coins from kills. FORTUNE rules its Q.', coins: 40, fx: { coin: 0.10 },
      q: 'Jackpot',       qDesc: 'Pull the lever: the reels spin, then the strike lands - one in four hits TRIPLE and showers gold.' },
  ];
  const classById = id => CLASSES.find(k => k.id === (id || '')) || CLASSES[0];

  // #156 RACES: picked alongside the class. A race is a small, always-on stat bias plus a
  // look. Deliberately weaker than a class perk - the class is the build, the race is the
  // flavour that tilts it. Every one has a real trade-off; none is a strict upgrade.
  const RACES = [
    { id: 'human',  name: 'Human',  color: '#e8d3b0', skin: '#e8d3b0',
      desc: 'Adaptable. +10% experience and +5% gold - you learn and earn faster than anyone.',
      fx: { xpMult: 0.10, coin: 0.05 } },
    { id: 'orc',    name: 'Orc',    color: '#6fa84f', skin: '#79ad5c',
      desc: 'Brutal. +15% damage and +15 HP, but 6% slower - you hit like a truck and move like one.',
      fx: { dmg: 0.15, spd: -0.06 }, hp: 15 },
    { id: 'elf',    name: 'Elf',    color: '#bfe6d8', skin: '#f0e2d0',
      desc: 'Quick. +8% crit chance and +10% move speed, but 10 less HP - fast and sharp, not sturdy.',
      fx: { critCh: 0.08, spd: 0.10 }, hp: -10 },
    { id: 'dwarf',  name: 'Dwarf',  color: '#d59a5a', skin: '#dda878',
      desc: 'Stubborn. +25 HP and takes 10% less damage, but 8% slower - very hard to put down.',
      fx: { reduce: 0.10, spd: -0.08 }, hp: 25 },
    { id: 'undead', name: 'Undead', color: '#9fb7a8', skin: '#a9bfae',
      desc: 'Already dead. Every kill knits you back together, but potions do 30% less for you.',
      fx: { healOnKill: 3, healMult: -0.30 } },
  ];
  const raceById = id => RACES.find(r => r.id === (id || '')) || RACES[0];

  // #156 DRUID FORMS. Q cycles them. Each is a REAL trade-off - there is no best form,
  // which is the whole point of the class: you shift to suit the room.
  //   Bear - walks into everything and survives it, but slow.
  //   Wolf - fast and bleeds enemies, but made of paper.
  // #157 Each form carries its OWN LOOK, not just its own numbers. The player must never
  // have to remember which shape they are in: the body recolours, changes size, and grows
  // a head you can name from across the room, and a badge sits on the HUD. Three separate
  // tells, because one is not enough to read in a busy fight.
  //   body/cloak/accent - the two body circles and the visor slit
  //   scale             - the REAL size: it drives both the drawn body AND the hitbox
  //                       (Sam, #157). A bear is a bigger target and genuinely easier to
  //                       hit - and it pays for that with a hide that shrugs damage off.
  //                       The owl is small and correspondingly hard to touch. The size you
  //                       see IS the size you are; nothing here is cosmetic.
  const FORMS = [
    { id: 'bear', name: 'Bear Form', color: '#a8763f', dmgMul: 1.45, spdMul: 0.82, reduce: 0.34,
      body: '#8a5a2b', cloak: '#5d3a19', accent: '#ffcf8a', scale: 1.28, tag: 'BEAR',
      note: 'A big, slow target - but the hide turns almost everything.' },
    { id: 'wolf', name: 'Wolf Form', color: '#c8d0de', dmgMul: 1.25, spdMul: 1.32, reduce: -0.12, bleed: true,
      body: '#98a2b3', cloak: '#5a6172', accent: '#e8f0ff', scale: 0.92, tag: 'WOLF',
      note: 'Fast, lean and bleeding fangs, but every hit hurts you more.' },
    // #158 (Sam) OWL removed - it was just a slower, weaker Wolf.
    // #230 (Q-DESIGN, Sam) THE OWLBEAR takes the third slot: the ARCANE form. A
    // hulking feathered beast whose swipes are magic - its damage feeds on the
    // druid's ARCANE points (computeDmg), bridging druid into caster builds. It
    // trades the old owl's evasion for magical muscle.
    { id: 'owlbear', name: 'Owlbear Form', color: '#c9a86a', dmgMul: 1.1, spdMul: 1.0, reduce: 0.12, arcaneFed: true,
      body: '#8a744a', cloak: '#5d4c2a', accent: '#ffe9b0', scale: 1.15, tag: 'OWLBEAR',
      note: 'Feathers, claws and arcane muscle - swipes grow with ARCANE.' },
  ];
  const formById = id => FORMS.find(f => f.id === id) || null;

  // #157 the ONE place a shift is applied. Both the look and the HITBOX come from the same
  // scale, so what you see is always what you are. Called by main.js castAbility.
  function setForm(p, form) {
    p.form = form || null;
    p.r = Math.round(p.baseR * (form ? form.scale : 1));
  }

  // #157 the animal head, at the head origin, head radius r. Replaces the druid's antlers
  // while shifted - you are wearing the beast, not a circlet.
  function drawFormHead(c, id, r) {
    if (id === 'owlbear') {
      // #230 the owlbear: feather tufts high like horns, huge round amber eyes, a beak
      c.fillStyle = '#5d4c2a';                                   // tufts
      c.beginPath(); c.moveTo(-r * 0.85, -r * 0.5); c.lineTo(-r * 0.55, -r * 1.15); c.lineTo(-r * 0.25, -r * 0.6); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(r * 0.85, -r * 0.5); c.lineTo(r * 0.55, -r * 1.15); c.lineTo(r * 0.25, -r * 0.6); c.closePath(); c.fill();
      c.fillStyle = '#8a744a';                                   // feathered brow
      c.beginPath(); c.ellipse(0, -r * 0.35, r * 0.8, r * 0.45, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#ffcf5a';                                   // the eyes: huge, amber, unblinking
      c.beginPath(); c.arc(-r * 0.34, -r * 0.28, r * 0.26, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(r * 0.34, -r * 0.28, r * 0.26, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#140c05';
      c.beginPath(); c.arc(-r * 0.34, -r * 0.28, r * 0.11, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(r * 0.34, -r * 0.28, r * 0.11, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c9a227';                                   // the beak
      c.beginPath(); c.moveTo(-r * 0.16, 0); c.lineTo(r * 0.16, 0); c.lineTo(0, r * 0.42); c.closePath(); c.fill();
    } else if (id === 'bear') {
      c.fillStyle = '#5d3a19';                                  // two round ears, high and wide
      c.beginPath(); c.arc(-r * 0.72, -r * 0.72, r * 0.36, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(r * 0.72, -r * 0.72, r * 0.36, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#8a5a2b';
      c.beginPath(); c.arc(-r * 0.72, -r * 0.72, r * 0.18, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(r * 0.72, -r * 0.72, r * 0.18, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a2410';                                  // heavy muzzle
      c.beginPath(); c.ellipse(0, r * 0.44, r * 0.44, r * 0.3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#140c05';
      c.beginPath(); c.arc(0, r * 0.32, r * 0.13, 0, Math.PI * 2); c.fill();
    } else if (id === 'wolf') {
      c.fillStyle = '#5a6172';                                  // sharp pricked ears
      c.beginPath(); c.moveTo(-r * 0.82, -r * 0.34); c.lineTo(-r * 0.62, -r * 1.24); c.lineTo(-r * 0.24, -r * 0.56); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(r * 0.82, -r * 0.34); c.lineTo(r * 0.62, -r * 1.24); c.lineTo(r * 0.24, -r * 0.56); c.closePath(); c.fill();
      c.fillStyle = '#98a2b3';                                  // long snout
      c.beginPath(); c.moveTo(-r * 0.3, r * 0.24); c.lineTo(0, r * 1.0); c.lineTo(r * 0.3, r * 0.24); c.closePath(); c.fill();
      c.fillStyle = '#f0f4fa';                                  // bared fangs
      c.beginPath(); c.moveTo(-r * 0.17, r * 0.6); c.lineTo(-r * 0.07, r * 0.94); c.lineTo(r * 0.01, r * 0.6); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(r * 0.17, r * 0.6); c.lineTo(r * 0.07, r * 0.94); c.lineTo(-r * 0.01, r * 0.6); c.closePath(); c.fill();
    } else if (id === 'owl') {
      c.fillStyle = '#8a7c5c';                                  // feather tufts
      c.beginPath(); c.moveTo(-r * 0.7, -r * 0.5); c.lineTo(-r * 0.5, -r * 1.18); c.lineTo(-r * 0.2, -r * 0.62); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(r * 0.7, -r * 0.5); c.lineTo(r * 0.5, -r * 1.18); c.lineTo(r * 0.2, -r * 0.62); c.closePath(); c.fill();
      c.fillStyle = '#fff3c4';                                  // the huge round eyes - the giveaway
      c.beginPath(); c.arc(-r * 0.3, -r * 0.02, r * 0.33, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(r * 0.3, -r * 0.02, r * 0.33, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1408';
      c.beginPath(); c.arc(-r * 0.3, -r * 0.02, r * 0.15, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(r * 0.3, -r * 0.02, r * 0.15, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e8a33d';                                  // beak
      c.beginPath(); c.moveTo(-r * 0.14, r * 0.28); c.lineTo(0, r * 0.68); c.lineTo(r * 0.14, r * 0.28); c.closePath(); c.fill();
    }
  }

  // #43/#117/#119/#129 the prestige cape, drawn at the current translate origin. Shared
  // by the local player AND remote peers (main.js drawRemotePlayers). Two fold panels +
  // gold trim + collar, draped from the shoulders.
  //
  // #129 rework: the cape now SWINGS AS ONE PIECE from the shoulders instead of having
  // its hem deformed. The old version moved the two hem corners and the seam on three
  // independent sine phases (ph, ph+1.1, ph+0.5) while the shoulders stayed pinned, so
  // at speed the panels sheared against each other - one collapsed to a sliver, the
  // other ballooned - and the whole thing wagged. Now:
  //   - the cloth is rigid and the WHOLE shape rotates about the shoulders (swing),
  //     so the panels always keep their width and stay symmetric about their own axis;
  //   - horizontal travel sets the swing, so the cape trails behind you;
  //   - vertical travel only stretches (running away = it streams out longer) or tucks
  //     (running at the camera = it shortens). In this 3/4 view a cape can never flip
  //     up over the head, so we never rotate it there;
  //   - the ripple is ONE coherent travelling wave across the hem (small phase deltas),
  //     so it reads as cloth flapping, not as three points fighting each other.
  // #131 one palette PER PRESTIGE LEVEL, so every single prestige is a different
  // cape and not a two-pixel difference nobody can see. Six of them; past six the
  // colour holds and the chevrons keep counting.
  const PRESTIGE_PAL = [
    { dark: '#4e1226', lite: '#72203a' }, // 1 - crimson
    { dark: '#123a5a', lite: '#1d5c84' }, // 2 - abyssal blue
    { dark: '#1a4a2a', lite: '#246b3c' }, // 3 - deep green
    { dark: '#431029', lite: '#651a41' }, // 4 - wine
    { dark: '#2e0e42', lite: '#4a1c66' }, // 5 - violet
    { dark: '#1a1416', lite: '#2f2226' }, // 6 - obsidian
  ];

  function capeAt(c, r, prestige, moving, seedX, velX, velY) {
    const t = Math.min(6, prestige);
    const now = Date.now();
    // #131 THE MOVEMENT ANIMATION IS OFF (Sam's call, and the right one). Two attempts
    // at making the cape react to travel both read as broken in motion - first it
    // sheared, then it swung. The idle drift always looked good, so the cape now just
    // does that, always: a slow, gentle ripple, whatever you are doing. velX/velY and
    // `moving` are still in the signature (peers send them over the wire) and are
    // deliberately IGNORED. Do not wire them back up without Sam asking.
    const ph = now / 360 + (seedX || 0) * 0.05;
    const amp = 1.4;                                    // the gentle idle ripple, and nothing else
    // ONE travelling wave across the hem: small phase deltas, so the cloth ripples
    // coherently and the two panels never pump against each other
    const hemL = Math.sin(ph) * amp;
    const hemR = Math.sin(ph + 0.38) * amp;
    const hemM = Math.sin(ph + 0.19) * amp * 0.5;
    // #131 PRESTIGE MUST BE VISIBLE. It used to grow the cape by r*0.14 per level -
    // about TWO PIXELS - and only changed colour at levels 3 and 5, so Sam prestiged
    // twice and saw nothing at all. Every level now changes the size AND the colour,
    // and carries a gold chevron so you can literally count your rank off the cape.
    const base = r * (2.0 + t * 0.40);                  // ~5px longer per level, not 1.8
    const L = base;
    const tw = r * 0.5, bw = r * (1.0 + t * 0.14);      // and visibly wider each time
    const sx = hemM * 0.6, sy = L * 0.86;               // the seam - SHARED by both panels
    const dark = PRESTIGE_PAL[Math.max(0, t - 1)] ? PRESTIGE_PAL[Math.max(0, t - 1)].dark : '#4e1226';
    const lite = PRESTIGE_PAL[Math.max(0, t - 1)] ? PRESTIGE_PAL[Math.max(0, t - 1)].lite : '#72203a';
    c.save();
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(0, -r * 0.2); c.lineTo(-tw, -r * 0.16);
    c.quadraticCurveTo(-bw * 1.12 + hemL, L * 0.5, -bw + hemL, L);
    c.quadraticCurveTo(-bw * 0.42 + hemM, L * 0.9, sx, sy);
    c.closePath(); c.fill();
    c.fillStyle = lite;
    c.beginPath();
    c.moveTo(0, -r * 0.2); c.lineTo(tw, -r * 0.16);
    c.quadraticCurveTo(bw * 1.12 + hemR, L * 0.5, bw + hemR, L);
    c.quadraticCurveTo(bw * 0.42 + hemM, L * 0.9, sx, sy);
    c.closePath(); c.fill();
    c.strokeStyle = '#e8b52f'; c.lineWidth = 1.3 + t * 0.3; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(-tw, -r * 0.16);
    c.quadraticCurveTo(-bw * 1.12 + hemL, L * 0.5, -bw + hemL, L);
    c.quadraticCurveTo(-bw * 0.42 + hemM, L * 0.9, sx, sy);
    c.quadraticCurveTo(bw * 0.42 + hemM, L * 0.9, bw + hemR, L);
    c.quadraticCurveTo(bw * 1.12 + hemR, L * 0.5, tw, -r * 0.16);
    c.stroke();
    // #131 PRESTIGE CHEVRONS: one gold chevron down the spine of the cape per prestige
    // level, so the rank is COUNTABLE and every prestige changes the cape whether or
    // not you can tell violet from wine. Rank you can read at a glance, which is the
    // whole point of a prestige cosmetic.
    const chevrons = Math.min(8, prestige);
    if (chevrons > 0) {
      c.strokeStyle = '#ffd24c'; c.lineWidth = 1.6; c.lineCap = 'round'; c.lineJoin = 'round';
      c.shadowColor = '#ffd24c'; c.shadowBlur = 3;
      const top = r * 0.35, span = L * 0.72 - top;
      const gap = span / (chevrons + 0.6);
      const wch = bw * 0.42;
      for (let i = 0; i < chevrons; i++) {
        const cy = top + gap * (i + 0.7);
        c.beginPath();
        c.moveTo(-wch, cy);
        c.lineTo(0, cy + wch * 0.55);
        c.lineTo(wch, cy);
        c.stroke();
      }
      c.shadowBlur = 0;
    }
    c.fillStyle = '#ffd24c';
    c.beginPath(); c.ellipse(0, -r * 0.18, tw * 0.9, 2.6 + t * 0.2, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  // a compact weapon silhouette for remote peers, drawn at the origin, aimed at `ang`.
  // `model` (optional, synced as `wm`) picks the same per-name shape the owner sees;
  // without it we fall back to the old per-archetype stick.
  function peerWeapon(c, arch, color, facing, r, model) {
    c.save();
    c.rotate(facing || 0);
    c.strokeStyle = color || '#cfe0f0'; c.fillStyle = color || '#cfe0f0'; c.lineCap = 'round';
    if (arch === 'bow') {
      const cx = r * 0.5, rad = model === 'shortbow' ? r * 0.55 : model === 'longbow' ? r * 0.95 : r * 0.7;
      c.lineWidth = model === 'shortbow' ? 3 : 2;
      if (model === 'recurve') {
        c.beginPath();
        c.moveTo(cx - 2, -rad); c.quadraticCurveTo(cx + rad * 0.8, -rad * 0.7, cx + rad * 0.55, 0);
        c.quadraticCurveTo(cx + rad * 0.8, rad * 0.7, cx - 2, rad); c.stroke();
      } else if (model === 'longbow') {
        c.beginPath(); c.moveTo(cx, -rad); c.quadraticCurveTo(cx + rad * 0.55, 0, cx, rad); c.stroke();
      } else {
        c.beginPath(); c.arc(cx, 0, rad, -1.1, 1.1); c.stroke();
      }
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1;
      const sx = model === 'recurve' || model === 'longbow' ? cx - (model === 'recurve' ? 2 : 0) : cx + Math.cos(1.1) * rad;
      const sy = model === 'recurve' || model === 'longbow' ? rad : Math.sin(1.1) * rad;
      c.beginPath(); c.moveTo(sx, -sy); c.lineTo(sx, sy); c.stroke();
    } else if (arch === 'wand' || arch === 'staff') {
      const isStaff = arch === 'staff';
      const len = r * (isStaff ? 1.3 : 1.0);
      c.lineWidth = isStaff ? 3 : model === 'rod' ? 3 : 2;
      c.beginPath(); c.moveTo(r * 0.2, 0); c.lineTo(len, 0); c.stroke();
      const tx = len + (isStaff ? 2 : 1.5);
      if (model === 'scepter' || model === 'staff') {       // diamond head
        c.beginPath(); c.moveTo(tx + 4, 0); c.lineTo(tx, 3); c.lineTo(tx - 3, 0); c.lineTo(tx, -3); c.closePath(); c.fill();
      } else if (model === 'rod') {                          // square cap
        c.fillRect(tx - 2.5, -2.5, 5, 5);
      } else if (model === 'stave') {                        // ring head
        c.lineWidth = 2; c.beginPath(); c.arc(tx, 0, 3.5, 0, Math.PI * 2); c.stroke();
      } else if (model === 'runewood') {                     // forked tines
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(tx - 4, 0); c.quadraticCurveTo(tx, -3, tx + 3, -4); c.stroke();
        c.beginPath(); c.moveTo(tx - 4, 0); c.quadraticCurveTo(tx, 3, tx + 3, 4); c.stroke();
        c.beginPath(); c.arc(tx, 0, 2, 0, Math.PI * 2); c.fill();
      } else if (model === 'emberstaff') {                   // flame tip
        c.beginPath(); c.moveTo(tx + 5, 0); c.quadraticCurveTo(tx + 1, 3, tx - 2, 1.8);
        c.quadraticCurveTo(tx - 3, 0, tx - 2, -1.8); c.quadraticCurveTo(tx + 1, -3, tx + 5, 0); c.closePath(); c.fill();
      } else {                                               // wand / willow orb
        c.beginPath(); c.arc(tx, 0, isStaff ? 4 : 3, 0, Math.PI * 2); c.fill();
      }
    } else if (arch === 'heavy') {
      c.lineWidth = 4; c.beginPath(); c.moveTo(r * 0.2, 0); c.lineTo(r * 1.15, 0); c.stroke();
      const hx = r * 1.0;
      if (model === 'cleaver') {
        c.fillRect(hx - 3, -4.5, r * 0.55, 9);
      } else if (model === 'warhammer') {
        c.fillRect(hx - 2, -5.5, 5.5, 5.5);
        c.beginPath(); c.moveTo(hx - 1, 0.5); c.lineTo(hx + 1.5, 5); c.lineTo(hx + 4, 0.5); c.closePath(); c.fill();
      } else if (model === 'maul') {
        c.fillRect(hx - 2, -4.5, 7, 9);
      } else { // greataxe
        c.beginPath(); c.moveTo(hx, -2); c.quadraticCurveTo(hx + 8, -6, hx + 7, 0);
        c.quadraticCurveTo(hx + 8, 6, hx, 2); c.closePath(); c.fill();
      }
    } else { // light
      if (model === 'twinfang') {
        c.lineWidth = 2;
        for (const s of [-1, 1]) {
          c.beginPath(); c.moveTo(r * 0.2, 0); c.quadraticCurveTo(r * 0.6, s * 2, r * 0.9, s * 1.2); c.stroke();
        }
      } else if (model === 'dagger') {
        c.lineWidth = 3; c.beginPath(); c.moveTo(r * 0.2, 0); c.lineTo(r * 0.7, 0); c.stroke();
      } else if (model === 'rapier') {
        c.lineWidth = 1.5; c.beginPath(); c.moveTo(r * 0.2, 0); c.lineTo(r * 1.1, 0); c.stroke();
        c.lineWidth = 1.5; c.beginPath(); c.arc(r * 0.32, 0, 2.5, Math.PI * 0.6, Math.PI * 1.4); c.stroke();
      } else {
        c.lineWidth = 2.5; c.beginPath(); c.moveTo(r * 0.2, 0); c.lineTo(r * 0.95, 0); c.stroke();
      }
    }
    c.restore();
  }

  // #98 the class's signature headgear, drawn at the origin (caller has already
  // translated to the head centre). Module-level so REMOTE players render it too,
  // not just the local body. r is the head radius (13 for peers, this.r locally).
  function classFeature(c, id, r) {
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
    } else if (id === 'ranger') {
      // green cap + a feather sweeping up and back
      c.fillStyle = '#2f6b46';
      c.beginPath(); c.arc(0, -r * 0.72, r * 0.6, Math.PI * 1.04, -Math.PI * 0.04); c.fill();
      c.fillStyle = '#26543a';
      c.beginPath(); c.ellipse(0, -r * 0.7, r * 0.72, r * 0.18, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#8ef0a8'; c.lineWidth = 2.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-r * 0.2, -r * 1.0); c.quadraticCurveTo(-r * 0.95, -r * 1.5, -r * 0.7, -r * 1.98); c.stroke();
    } else if (id === 'gambler') {
      // #259 the riverboat gambler: flat black hat, wide brim, gold band, lucky coin
      c.fillStyle = '#211c14';
      c.beginPath(); c.ellipse(0, -r * 0.6, r * 1.05, r * 0.24, 0, 0, Math.PI * 2); c.fill(); // brim
      c.fillStyle = '#2c2418'; c.fillRect(-r * 0.58, -r * 1.25, r * 1.16, r * 0.68);          // crown
      c.beginPath(); c.ellipse(0, -r * 1.25, r * 0.58, r * 0.15, 0, 0, Math.PI * 2); c.fill(); // flat top
      c.fillStyle = '#ffce54'; c.fillRect(-r * 0.58, -r * 0.78, r * 1.16, r * 0.15);          // gold band
      c.beginPath(); c.arc(r * 0.3, -r * 0.71, r * 0.11, 0, Math.PI * 2); c.fill();           // the lucky coin
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
    } else if (id === 'summoner') {
      // a deep-blue hood + a small floating orb above
      c.fillStyle = '#2a4a70';
      c.beginPath();
      c.moveTo(-r * 0.92, r * 0.12); c.quadraticCurveTo(-r * 1.02, -r * 1.05, 0, -r * 1.08);
      c.quadraticCurveTo(r * 1.02, -r * 1.05, r * 0.92, r * 0.12);
      c.quadraticCurveTo(r * 0.5, -r * 0.15, 0, -r * 0.2);
      c.quadraticCurveTo(-r * 0.5, -r * 0.15, -r * 0.92, r * 0.12); c.closePath(); c.fill();
      c.fillStyle = '#9ad0ff'; c.globalAlpha = 0.5 + Math.sin(Date.now() / 300) * 0.3;
      c.beginPath(); c.arc(0, -r * 1.7, r * 0.28, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    // #156 the five new classes. Each needs a SILHOUETTE you can name at a glance - the
    // picker is read by a 12-year-old, not off a stat table.
    } else if (id === 'mesmer') {
      // a split mask: one half solid, one half shattering off
      c.fillStyle = '#7a4fa8';
      c.beginPath(); c.moveTo(-r * 0.78, -r * 0.5); c.lineTo(0, -r * 0.72); c.lineTo(0, r * 0.28); c.lineTo(-r * 0.7, r * 0.1); c.closePath(); c.fill();
      c.fillStyle = '#c78bff'; c.globalAlpha = 0.55;
      c.beginPath(); c.moveTo(r * 0.78, -r * 0.5); c.lineTo(0, -r * 0.72); c.lineTo(0, r * 0.28); c.lineTo(r * 0.7, r * 0.1); c.closePath(); c.fill();
      c.globalAlpha = 1;
      c.fillStyle = '#e8c8ff';
      c.beginPath(); c.moveTo(r * 0.95, -r * 0.95); c.lineTo(r * 1.35, -r * 0.6); c.lineTo(r * 0.98, -r * 0.45); c.closePath(); c.fill();
    } else if (id === 'druid') {
      c.strokeStyle = '#c9b48a'; c.lineWidth = Math.max(2, r * 0.16); c.lineCap = 'round';
      for (const dir of [-1, 1]) {
        c.beginPath(); c.moveTo(dir * r * 0.4, -r * 0.62);
        c.quadraticCurveTo(dir * r * 0.85, -r * 1.35, dir * r * 0.55, -r * 1.75); c.stroke();
        c.beginPath(); c.moveTo(dir * r * 0.66, -r * 1.12); c.lineTo(dir * r * 1.15, -r * 1.3); c.stroke();
        c.beginPath(); c.moveTo(dir * r * 0.74, -r * 1.45); c.lineTo(dir * r * 1.1, -r * 1.72); c.stroke();
      }
      c.fillStyle = '#3f7a44'; c.fillRect(-r * 0.72, -r * 0.72, r * 1.44, r * 0.2);
    } else if (id === 'deathknight') {
      c.fillStyle = '#2a3f45';
      c.beginPath(); c.arc(0, -r * 0.14, r * 0.8, Math.PI, 0); c.fill();
      c.fillRect(-r * 0.8, -r * 0.2, r * 1.6, r * 0.42);
      c.fillStyle = '#1b2a2e';
      for (const dir of [-1, 1]) {
        c.beginPath(); c.moveTo(dir * r * 0.72, -r * 0.62);
        c.quadraticCurveTo(dir * r * 1.5, -r * 1.05, dir * r * 1.2, -r * 1.6);
        c.quadraticCurveTo(dir * r * 1.1, -r * 1.05, dir * r * 0.6, -r * 0.78);
        c.closePath(); c.fill();
      }
      c.fillStyle = '#8fd6d0';
      c.globalAlpha = 0.75 + Math.sin(Date.now() / 260) * 0.25;
      c.fillRect(-r * 0.5, -r * 0.08, r * 1.0, r * 0.12);
      c.globalAlpha = 1;
    } else if (id === 'necromancer') {
      c.fillStyle = '#26332a';
      c.beginPath();
      c.moveTo(-r * 0.95, r * 0.15); c.quadraticCurveTo(-r * 1.05, -r * 1.1, 0, -r * 1.12);
      c.quadraticCurveTo(r * 1.05, -r * 1.1, r * 0.95, r * 0.15);
      c.quadraticCurveTo(r * 0.5, -r * 0.18, 0, -r * 0.22);
      c.quadraticCurveTo(-r * 0.5, -r * 0.18, -r * 0.95, r * 0.15); c.closePath(); c.fill();
      c.fillStyle = '#cfe6cf';
      for (const dx of [-0.5, 0, 0.5]) {
        c.beginPath();
        c.moveTo(dx * r - r * 0.11, -r * 1.05); c.lineTo(dx * r, -r * 1.55); c.lineTo(dx * r + r * 0.11, -r * 1.05);
        c.closePath(); c.fill();
      }
      c.fillStyle = '#9ae6a0'; c.globalAlpha = 0.6 + Math.sin(Date.now() / 240) * 0.3;
      c.beginPath(); c.arc(-r * 0.24, -r * 0.05, r * 0.1, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(r * 0.24, -r * 0.05, r * 0.1, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    } else if (id === 'pyromancer') {
      c.fillStyle = '#6e2a12';
      c.beginPath();
      c.moveTo(-r * 0.92, r * 0.12); c.quadraticCurveTo(-r * 1.0, -r * 1.0, 0, -r * 1.04);
      c.quadraticCurveTo(r * 1.0, -r * 1.0, r * 0.92, r * 0.12);
      c.quadraticCurveTo(r * 0.5, -r * 0.16, 0, -r * 0.2);
      c.quadraticCurveTo(-r * 0.5, -r * 0.16, -r * 0.92, r * 0.12); c.closePath(); c.fill();
      const fl = 0.85 + Math.sin(Date.now() / 90) * 0.15;
      const FLAMES = [[-0.42, 0.7, '#ff5a2c'], [0, 1.0, '#ff8a3d'], [0.42, 0.66, '#ffd24c']];
      for (const f of FLAMES) {
        c.fillStyle = f[2];
        c.beginPath();
        c.moveTo(f[0] * r - r * 0.2, -r * 0.98);
        c.quadraticCurveTo(f[0] * r, -r * (1.0 + f[1] * fl), f[0] * r + r * 0.2, -r * 0.98);
        c.closePath(); c.fill();
      }
    }
    // adventurer: no signature look (plain champion)
  }

  // #71 a class portrait for the character-select screen: a little bust wearing the
  // #156 the race's face, drawn at the head origin (0,0) with head radius s. Kept small
  // and silhouette-level on purpose: it has to still read under a warrior's full helm.
  // Undead draws its OWN eyes (hollow sockets with a green ember), so the caller skips
  // the normal eyes for it.
  function drawRaceFeature(c, id, s) {
    if (id === 'orc') {
      c.fillStyle = '#f2f0e2';                                    // two tusks, jutting up
      c.beginPath(); c.moveTo(-s * 0.34, s * 0.42); c.lineTo(-s * 0.22, s * 0.16); c.lineTo(-s * 0.14, s * 0.46); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(s * 0.34, s * 0.42); c.lineTo(s * 0.22, s * 0.16); c.lineTo(s * 0.14, s * 0.46); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.18)';                           // heavy brow
      c.fillRect(-s * 0.62, -s * 0.24, s * 1.24, s * 0.14);
    } else if (id === 'elf') {
      c.fillStyle = '#f0e2d0';                                    // long swept ears
      c.beginPath(); c.moveTo(-s * 0.66, -s * 0.04); c.lineTo(-s * 1.22, -s * 0.52); c.lineTo(-s * 0.6, s * 0.2); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(s * 0.66, -s * 0.04); c.lineTo(s * 1.22, -s * 0.52); c.lineTo(s * 0.6, s * 0.2); c.closePath(); c.fill();
    } else if (id === 'dwarf') {
      c.fillStyle = '#b5642e';                                    // the beard: the whole lower face
      c.beginPath(); c.arc(0, s * 0.3, s * 0.72, 0, Math.PI); c.fill();
      c.fillRect(-s * 0.6, s * 0.24, s * 1.2, s * 0.5);
      c.fillStyle = '#c9773d';                                    // braid highlight
      c.fillRect(-s * 0.12, s * 0.42, s * 0.24, s * 0.5);
    } else if (id === 'undead') {
      c.fillStyle = '#1a2220';                                    // hollow sockets
      c.beginPath(); c.arc(-s * 0.26, s * 0.0, s * 0.17, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(s * 0.26, s * 0.0, s * 0.17, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#9ae6a0';                                    // the ember still burning in there
      c.beginPath(); c.arc(-s * 0.26, s * 0.0, s * 0.07, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(s * 0.26, s * 0.0, s * 0.07, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(30,40,36,0.5)'; c.lineWidth = Math.max(1, s * 0.07);
      c.beginPath(); c.moveTo(-s * 0.5, s * 0.42); c.lineTo(s * 0.5, s * 0.42); c.stroke();  // stitched jaw
    }
    // human: no feature. That IS the human - the baseline face.
  }

  // #156 the race picker's portrait: a bare head, no class gear, so the face is the point.
  function drawRacePortrait(c, race, cx, cy, s) {
    c.save();
    c.translate(cx, cy);
    c.fillStyle = '#4a5468';                                       // plain shoulders
    c.beginPath(); c.moveTo(-s * 1.15, s * 1.6); c.quadraticCurveTo(0, s * 0.3, s * 1.15, s * 1.6); c.closePath(); c.fill();
    c.fillStyle = race.skin;
    c.beginPath(); c.arc(0, 0, s * 0.74, 0, Math.PI * 2); c.fill();
    drawRaceFeature(c, race.id, s);
    if (race.id !== 'undead') {                                    // undead draws its own
      c.fillStyle = '#33507a';
      c.beginPath(); c.arc(-s * 0.26, s * 0.02, s * 0.11, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(s * 0.26, s * 0.02, s * 0.11, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  // class's signature headgear, so players pick by picture instead of a cryptic glyph.
  // (cx,cy) is the head centre; s is the head radius.
  // #156 raceId is optional: when given, the portrait wears that race's skin and its
  // feature (tusks / ears / beard / hollow eyes) UNDER the class headgear, so a Dwarf
  // Warrior reads as both at a glance.
  function drawClassPortrait(c, cls, cx, cy, s, raceId) {
    // #202 (Sam) accept the class OBJECT or its id STRING. The character sheet passed
    // the string, `cls.id` came back undefined, and EVERY class drew as the plain
    // Adventurer portrait.
    const id = (typeof cls === 'string') ? cls : (cls && cls.id) || '';
    const bodyCol = { '': '#5b6884', warrior: '#a85f34', ranger: '#37905f', mage: '#6b3fa8', rogue: '#b8901f', barbarian: '#9e3b26', paladin: '#c9a94a', cleric: '#3f9e7a', engineer: '#8a6a2a', summoner: '#3f6fa8',
      mesmer: '#7a4fa8', druid: '#3f7a44', deathknight: '#41707a', necromancer: '#3f7a52', pyromancer: '#a8481f',
      gambler: '#8a6f2a' }[id] || '#5b6884';
    const race = raceById(raceId);
    c.save();
    c.translate(cx, cy);
    // shoulders / torso
    c.fillStyle = bodyCol;
    c.beginPath(); c.moveTo(-s * 1.25, s * 1.7); c.quadraticCurveTo(0, s * 0.28, s * 1.25, s * 1.7); c.closePath(); c.fill();
    // head - in the chosen race's skin
    c.fillStyle = race.skin;
    c.beginPath(); c.arc(0, 0, s * 0.74, 0, Math.PI * 2); c.fill();
    drawRaceFeature(c, race.id, s);
    // eyes (a cowl hides these behind a shadow instead)
    if (id !== 'rogue' && race.id !== 'undead') {
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
    } else if (id === 'gambler') {
      // #259 the riverboat gambler, portrait size
      c.fillStyle = '#211c14';
      c.beginPath(); c.ellipse(0, -s * 0.32, s * 1.12, s * 0.26, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2c2418'; c.fillRect(-s * 0.6, -s * 1.02, s * 1.2, s * 0.72);
      c.beginPath(); c.ellipse(0, -s * 1.02, s * 0.6, s * 0.16, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffce54'; c.fillRect(-s * 0.6, -s * 0.52, s * 1.2, s * 0.16);
      c.beginPath(); c.arc(s * 0.32, -s * 0.44, s * 0.12, 0, Math.PI * 2); c.fill();
    } else if (id === 'rogue') {
      // #95 a full assassin cowl: it wraps the ENTIRE head and face, leaving only a
      // narrow eye-slit. The bottom edge bulges down past the chin so no skin shows.
      c.fillStyle = '#1c1811'; c.beginPath();
      c.moveTo(-s * 0.98, s * 0.55);
      c.quadraticCurveTo(-s * 1.14, -s * 1.02, 0, -s * 1.06);       // up the left, over the crown
      c.quadraticCurveTo(s * 1.14, -s * 1.02, s * 0.98, s * 0.55);  // down the right
      c.quadraticCurveTo(0, s * 1.02, -s * 0.98, s * 0.55);         // bulge DOWN across the chin
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(201,162,39,0.55)'; c.lineWidth = 1; c.stroke();
      // recessed eye-slit (dark band) with glinting eyes - the only opening
      c.fillStyle = '#0c0a06';
      c.beginPath(); c.ellipse(0, -s * 0.04, s * 0.6, s * 0.16, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffd24c'; c.globalAlpha = 0.9;
      c.beginPath(); c.arc(-s * 0.26, -s * 0.04, s * 0.1, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(s * 0.26, -s * 0.04, s * 0.1, 0, Math.PI * 2); c.fill();
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
    } else if (id === 'summoner') {
      c.fillStyle = '#2a4a70'; c.beginPath();                                                             // deep-blue hood
      c.moveTo(-s * 0.9, s * 0.15); c.quadraticCurveTo(-s * 1.0, -s * 1.05, 0, -s * 1.08);
      c.quadraticCurveTo(s * 1.0, -s * 1.05, s * 0.9, s * 0.15);
      c.quadraticCurveTo(s * 0.5, -s * 0.14, 0, -s * 0.2);
      c.quadraticCurveTo(-s * 0.5, -s * 0.14, -s * 0.9, s * 0.15); c.closePath(); c.fill();
      c.fillStyle = '#9ad0ff'; c.globalAlpha = 0.9;                                                       // floating arcane orb
      c.beginPath(); c.arc(0, -s * 1.4, s * 0.24, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = '#cfe9ff'; c.lineWidth = 1; c.beginPath(); c.arc(0, -s * 1.4, s * 0.38, 0, Math.PI * 2); c.stroke();
    // #156 the five new classes - the same silhouettes as the in-game body
    } else if (id === 'mesmer') {
      c.fillStyle = '#7a4fa8';
      c.beginPath(); c.moveTo(-s * 0.78, -s * 0.5); c.lineTo(0, -s * 0.72); c.lineTo(0, s * 0.28); c.lineTo(-s * 0.7, s * 0.1); c.closePath(); c.fill();
      c.fillStyle = '#c78bff'; c.globalAlpha = 0.55;
      c.beginPath(); c.moveTo(s * 0.78, -s * 0.5); c.lineTo(0, -s * 0.72); c.lineTo(0, s * 0.28); c.lineTo(s * 0.7, s * 0.1); c.closePath(); c.fill();
      c.globalAlpha = 1;
      c.fillStyle = '#e8c8ff';
      c.beginPath(); c.moveTo(s * 0.95, -s * 0.95); c.lineTo(s * 1.35, -s * 0.6); c.lineTo(s * 0.98, -s * 0.45); c.closePath(); c.fill();
    } else if (id === 'druid') {
      c.strokeStyle = '#c9b48a'; c.lineWidth = Math.max(1.6, s * 0.15); c.lineCap = 'round';
      for (const dir of [-1, 1]) {
        c.beginPath(); c.moveTo(dir * s * 0.4, -s * 0.62);
        c.quadraticCurveTo(dir * s * 0.85, -s * 1.35, dir * s * 0.55, -s * 1.75); c.stroke();
        c.beginPath(); c.moveTo(dir * s * 0.66, -s * 1.12); c.lineTo(dir * s * 1.15, -s * 1.3); c.stroke();
        c.beginPath(); c.moveTo(dir * s * 0.74, -s * 1.45); c.lineTo(dir * s * 1.1, -s * 1.72); c.stroke();
      }
      c.fillStyle = '#3f7a44'; c.fillRect(-s * 0.72, -s * 0.72, s * 1.44, s * 0.2);
    } else if (id === 'deathknight') {
      c.fillStyle = '#2a3f45';
      c.beginPath(); c.arc(0, -s * 0.14, s * 0.8, Math.PI, 0); c.fill();
      c.fillRect(-s * 0.8, -s * 0.2, s * 1.6, s * 0.42);
      c.fillStyle = '#1b2a2e';
      for (const dir of [-1, 1]) {
        c.beginPath(); c.moveTo(dir * s * 0.72, -s * 0.62);
        c.quadraticCurveTo(dir * s * 1.5, -s * 1.05, dir * s * 1.2, -s * 1.6);
        c.quadraticCurveTo(dir * s * 1.1, -s * 1.05, dir * s * 0.6, -s * 0.78);
        c.closePath(); c.fill();
      }
      c.fillStyle = '#8fd6d0'; c.fillRect(-s * 0.5, -s * 0.08, s * 1.0, s * 0.12);
    } else if (id === 'necromancer') {
      c.fillStyle = '#26332a';
      c.beginPath();
      c.moveTo(-s * 0.95, s * 0.15); c.quadraticCurveTo(-s * 1.05, -s * 1.1, 0, -s * 1.12);
      c.quadraticCurveTo(s * 1.05, -s * 1.1, s * 0.95, s * 0.15);
      c.quadraticCurveTo(s * 0.5, -s * 0.18, 0, -s * 0.22);
      c.quadraticCurveTo(-s * 0.5, -s * 0.18, -s * 0.95, s * 0.15); c.closePath(); c.fill();
      c.fillStyle = '#cfe6cf';
      for (const dx of [-0.5, 0, 0.5]) {
        c.beginPath();
        c.moveTo(dx * s - s * 0.11, -s * 1.05); c.lineTo(dx * s, -s * 1.55); c.lineTo(dx * s + s * 0.11, -s * 1.05);
        c.closePath(); c.fill();
      }
      c.fillStyle = '#9ae6a0';
      c.beginPath(); c.arc(-s * 0.24, -s * 0.05, s * 0.1, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(s * 0.24, -s * 0.05, s * 0.1, 0, Math.PI * 2); c.fill();
    } else if (id === 'pyromancer') {
      c.fillStyle = '#6e2a12';
      c.beginPath();
      c.moveTo(-s * 0.92, s * 0.12); c.quadraticCurveTo(-s * 1.0, -s * 1.0, 0, -s * 1.04);
      c.quadraticCurveTo(s * 1.0, -s * 1.0, s * 0.92, s * 0.12);
      c.quadraticCurveTo(s * 0.5, -s * 0.16, 0, -s * 0.2);
      c.quadraticCurveTo(-s * 0.5, -s * 0.16, -s * 0.92, s * 0.12); c.closePath(); c.fill();
      const FLAMES = [[-0.42, 0.7, '#ff5a2c'], [0, 1.0, '#ff8a3d'], [0.42, 0.66, '#ffd24c']];
      for (const f of FLAMES) {
        c.fillStyle = f[2];
        c.beginPath();
        c.moveTo(f[0] * s - s * 0.2, -s * 0.98);
        c.quadraticCurveTo(f[0] * s, -s * (1.0 + f[1]), f[0] * s + s * 0.2, -s * 0.98);
        c.closePath(); c.fill();
      }
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
      this.baseR = 13;   // #157 the unshifted hitbox; r is derived from it + the form
      // meta-progression boosts (from the hub) fold into starting stats.
      // #104 clamp to rank 3 so a grinder can't exceed the intended cap even on a
      // save that bought extra ranks back when these were endless.
      const mHp = Math.min(3, meta?.ranks?.vitality || 0) * 10;
      this.maxHp = T.maxHp + mHp;
      this.hp = this.maxHp;
      this.coins = 0; this.essenceRun = 0; this.shards = 0;
      this.justiceDue = 0; // #139 accumulated Jupiter-justice recoil, applied capped per frame
      this.bleed = null;   // #166 a damage-over-time (the magic panther's claws)
      this.slowT = 0; this.slowMul = 1; // #179 glued: a movement slow with a timer
      this.blindT = 0; // #182 flash-blinded: a temporary Envy-style vision shroud
      this.potion = false; // #186 (Sam) ONE carried potion - buy it, save it, press H
      this.xp = 0; this.level = 1;
      this.kills = 0; this.roomsCleared = 0;
      // temporary buffs from elite drops: shield absorbs one hit, the others are timed
      this.buffs = { shield: 0, rageT: 0, hasteT: 0, undyingT: 0 }; // #156 undyingT: the death knight's rune
      this.form = null;          // #156 druid: current animal form (null = your own body)
      this.undeadTier = 0;       // #156 necromancer: how much the grave gives back

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
      // #134 THE FOURTH SLOT: a trinket. One gift, one price (trinkets.js).
      this.trinket = null;
      this.trinketMods = {};      // derived from the equipped trinket

      // pet (Descent reward): one at a time, a passive buff folded into mod()
      this.pet = null;
      this.petMods = {};

      // stat multipliers - passive upgrades stack into these
      this.stats = {
        dmgMul: 1 + Math.min(3, meta?.ranks?.might || 0) * 0.05,   // #104 cap at +15%
        speedMul: 1,
        rollCdMul: 1 - (meta?.ranks?.acrobat || 0) * 0.08,
        crit: 0,
        coinMul: 1 + Math.min(3, meta?.ranks?.greed || 0) * 0.10,  // #104 cap at +30%
        regen: 0,
        atkSpeedMul: 1,
        magic: 1 + (meta?.ranks?.arcane || 0),   // #16/#88 Magic stat: gates wands/staffs; the Arcane permanent boost adds +1 per rank
      };

      // #30 class: starting kit + stat bias + one signature perk
      const cls = classById(meta?.selectedClass);
      this.class = cls;
      // Q is your class ability, live from the start of the run (R + ultimate come
      // from your evolutions - see recordEvoPick)
      if (typeof Abilities !== 'undefined') this.ability = Abilities.classAbility(cls.id);
      if (cls.magic) this.stats.magic = cls.magic + (meta?.ranks?.arcane || 0); // #88 Arcane boost stacks on a caster's base Magic
      if (cls.hp) { this.maxHp += cls.hp; this.hp = this.maxHp; }
      if (cls.coins) this.coins += cls.coins; // #258 the Gambler walks in with a bankroll
      if (cls.fx) this.applyEvolution(cls.fx); // the perk folds into evo -> mod()

      // #156 race: a smaller, always-on bias on top of the class, through the same mod()
      // channel. Applied AFTER the class so a race's HP swing lands on the class's total
      // (an Orc Warrior is +20 from the class and +15 from the blood, and both count).
      const race = raceById(meta?.selectedRace);
      this.race = race;
      if (race.hp) { this.maxHp += race.hp; this.hp = this.maxHp; }
      if (race.fx) this.applyEvolution(race.fx);

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
      this.capeWind = { x: 0, y: 0 }; // #117 smoothed travel vector that drives the cape

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
    // #134 the trinket folds into the SAME sum as everything else, so it composes with
    // evolutions, armour and pets for free - and so a trinket's PRICE (a negative mod)
    // can genuinely be dug out of by the rest of your build, which is the whole point.
    mod(key) { return (this.evo[key] || 0) + (this.armorMods[key] || 0) + (this.petMods[key] || 0) + (this.trinketMods[key] || 0); }
    // does the equipped trinket carry this behaviour flag?
    trinketFlag(f) { return !!(this.trinket && this.trinket.flag === f); }
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
    recordEvoPick(statKey, school) {
      this.evoHistory.push(statKey);
      // #252 the evolution's BASE stat (MIGHT/VIGOR/AGILITY/ARCANE/FORTUNE) - the
      // fusion pair is made of THESE, not the fine keys (whose STAT_SCHOOL map
      // predates the 5-stat redesign and still says FLOW)
      this.evoSchools = this.evoSchools || [];
      if (school) this.evoSchools.push(school);
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

    // #134 THE FOURTH SLOT. Swapping a trinket must be perfectly reversible, and the
    // reason is maxHpPct: several trinkets pay for their gift with a slice of your
    // maximum health, and maxHpPct is NOT one of the summed mod keys - the engine
    // applies it once, as a one-shot change to maxHp (see applyEvolution). So if we
    // just re-derived mods on every swap, picking a trinket up and putting it down
    // three times would permanently drain you to nothing.
    //
    // We therefore remember exactly how much health THIS trinket took (trinketHpDelta)
    // and give it all back before applying the next one.
    equipTrinket(t, g) {
      const old = this.trinket;

      // 1. undo the outgoing trinket's health cost, exactly
      const back = this.trinketHpDelta || 0;
      if (back) {
        this.maxHp -= back;                       // back is negative for a cost, so this ADDS it back
        this.hp = Math.min(this.hp - back, this.maxHp);
      }
      this.trinketHpDelta = 0;

      this.trinket = t;
      this.trinketMods = Object.assign({}, t.mods || {});

      // 2. apply the incoming one's health cost, and remember it
      const pct = this.trinketMods.maxHpPct;
      if (pct) {
        delete this.trinketMods.maxHpPct;         // it is a one-shot, not a summed mod
        const delta = Math.round(this.maxHp * pct);
        this.maxHp += delta;
        this.hp += delta;
        this.trinketHpDelta = delta;
      }
      // never let a trinket kill you outright on pickup
      this.maxHp = Math.max(10, this.maxHp);
      this.hp = Math.max(1, Math.min(this.hp, this.maxHp));

      if (old) g.dropTrinketPickup(old, this.x, this.y + 30);
      Sfx.play('upgrade');
      Fx.text(this.x, this.y - 26, t.name, t.color, 13);
      Fx.burst(this.x, this.y, [t.color, '#fff'], 22, { speed: 160, life: 0.7, glow: true });
    }

    // one damage formula for every player attack: melee and arrows both route here
    computeDmg(base, target, g) {
      let dmg = base * this.stats.dmgMul * (1 + this.mod('dmg'));
      if (this.form) {
        // #230 forms get statier with VIGOR (the druid's per-point channel), and the
        // OWLBEAR's swipes additionally feed on ARCANE - it is the mage-based form.
        const vig = (this.statPoints && this.statPoints.VIGOR) || 0;
        dmg *= this.form.dmgMul * (1 + 0.02 * vig);
        if (this.form.arcaneFed) dmg *= 1 + 0.05 * ((this.statPoints && this.statPoints.ARCANE) || 0);
      }
      if (this.buffs.rageT > 0) dmg *= 1.35;
      if (this.mod('lowHpRage') && this.hp <= this.maxHp * 0.35) dmg *= 1 + this.mod('lowHpRage');
      if (target) {
        if (this.mod('dmgVsWounded') && target.hp <= target.maxHp * 0.3) dmg *= 1 + this.mod('dmgVsWounded');
        if (this.mod('firstStrike') && target.hp >= target.maxHp) dmg *= 1 + this.mod('firstStrike');
        if (this.mod('bossSlayer') && target.isBoss) dmg *= 1 + this.mod('bossSlayer');
      }
      if (this.evo.midasPer) dmg += Math.min(this.evo.midasCap || 0, Math.floor(this.coins / this.evo.midasPer));
      let crit = Math.random() < T.critBase + this.stats.crit + this.mod('critCh') + ((this.fstance && this.fstance.critCh) || 0); // #254 LUCKY STREAK
      // #253 ACHILLES: the first hit on each enemy in the window is always a crit
      if (!crit && this.fstance && this.fstance.firstCrit && target && this.fstance.seen && !this.fstance.seen.has(target)) { this.fstance.seen.add(target); crit = true; }
      // #254 LUCKY STREAK: each crit pays a coin and feeds the streak (capped)
      if (crit && this.fstance && this.fstance.critPay) { this.coins += 1; this.fstance.critCh = Math.min(0.5, this.fstance.critCh + 0.01); }
      // #254 EL DORADO: the gold fever - every kill in the window hits harder
      if (this.fstance && this.fstance.dmgStack) dmg *= 1 + this.fstance.dmgStack;
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
      // THE BINDING (Avarice) pays nothing in gold and everything in experience:
      // the penance teaches you, where the coin never did.
      if (g && g.rules && g.rules.xpMul !== 1) n = Math.round(n * g.rules.xpMul);
      const xpBonus = this.mod('xpMult');   // #156 HUMAN: adaptable - you learn faster
      if (xpBonus) n = Math.round(n * (1 + xpBonus));
      this.xp += n;
      while (this.xp >= this.xpToNext()) {
        this.xp -= this.xpToNext();
        this.level++;
        this.hp = Math.min(this.maxHp, this.hp + 15); // level-up heals a chunk
        Sfx.play('levelup');
        Fx.burst(this.x, this.y, ['#ffd24c', '#7fd4ff', '#fff'], 24, { speed: 200, life: 0.8, glow: true });
        if (typeof Ach !== 'undefined') Ach.level(this.level, g); // #86 level milestones
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
      // #240 in a DUEL, menus are not armor: the character sheet and pause still let
      // hits through (otherwise "open charsheet" would be god mode - he WOULD find it)
      const menuVuln = g && (g.duelMode || g.huntMode) && (g.state === 'charsheet' || g.state === 'pause'); // #240/#241
      if (this.iframes > 0 || this.dead || (g.state !== 'play' && !menuVuln) || g.winTimer > 0) return;
      // shield charm eats the whole hit
      if (this.buffs.shield > 0) {
        this.buffs.shield--;
        // #252 GOLDEN FLEECE: the shield MINTS - every hit it eats pays out gold
        if (this.fleeceT > 0 && this.fleeceMint) {
          this.coins += this.fleeceMint;
          Fx.text(this.x, this.y - 42, `+${this.fleeceMint} FLEECE`, '#ffe08a', 12);
        }
        this.iframes = 0.5;
        Sfx.play('hit');
        Fx.text(this.x, this.y - 26, 'SHIELDED', '#7fd4ff', 14);
        Fx.burst(this.x, this.y, ['#7fd4ff', '#cfe9ff'], 16, { speed: 160, life: 0.4, glow: true });
        return;
      }
      // damage reduction from armor + evolutions (capped so nothing is free)
      // #156 the druid's form folds in here: Bear is armoured, Wolf and Owl are not.
      let reduce = Math.min(0.6, this.mod('reduce') + ((this.form && this.form.reduce) || 0));
      // #252 fusion stances stack on top, total capped so nothing is ever free
      if (this.fstance) reduce = Math.min(0.8, reduce + (this.fstance.reduce || 0)
        + (this.fstance.goldArmorCap ? Math.min(this.fstance.goldArmorCap, this.coins / 600) : 0));
      dmg = dmg * (1 - reduce);
      // #252 ANTAEUS: while rooted, the earth remembers what hit you
      if (this.rootT > 0) this.rootStore = Math.min(this.rootCap || 220, (this.rootStore || 0) + dmg);
      // #254 TROLL BLOOD: a truly heavy hit stems the blood for a moment (#257: visibly)
      if (this.fstance && this.fstance.id === 'trollblood' && dmg > this.maxHp * 0.1) {
        this.fstance.stunT = 1.5;
        Fx.text(this.x, this.y - 42, 'STEMMED', '#9aa4b0', 13);
        Fx.burst(this.x, this.y - 10, ['#9aa4b0', '#6e7a70'], 10, { speed: 120, life: 0.4 });
      }
      // #257 FORT KNOX: every blocked hit knocks a couple of coins out of orbit -
      // wealth as armor has a visible, self-balancing price
      if (this.fstance && this.fstance.goldArmorCap && this.coins > 0) {
        this.coins = Math.max(0, this.coins - 2);
        Fx.burst(this.x, this.y - 12, ['#ffd24c', '#ffe08a'], 4, { speed: 140, life: 0.45, glow: true });
      }

      // #156 DEATH KNIGHT - LIFE AFTER DEATH. The rune eats the killing blow: you are
      // left on 1 HP instead of dying, once per cast, and the room pays for it. Checked
      // BEFORE hp is subtracted so it cannot be skipped by an overkill.
      if (this.hp - dmg <= 0 && this.buffs.undyingT > 0) {
        this.buffs.undyingT = 0;
        this.hp = 1;
        this.iframes = Math.max(this.iframes || 0, 1.2);
        if (typeof Fx !== 'undefined') {
          Fx.text(this.x, this.y - 44, 'DEATH OVER EVERYTHING', '#8fd6d0', 17);
          Fx.burst(this.x, this.y, ['#8fd6d0', '#dff7f4', '#2a4a4e'], 46, { speed: 260, life: 0.9, glow: true });
          Fx.shake(14, 0.45);
        }
        if (typeof Sfx !== 'undefined') Sfx.play('hitHeavy');
        this.undyingBlast = true;   // main.js reads this and detonates the room
        return;
      }

      this.hp -= dmg;
      if (typeof Ach !== 'undefined') Ach.damaged(g); // #86 breaks the floor's no-hit streak
      if (g.vowIntact) g.vowIntact = false;           // THE VOW (encounters.js) is broken by one hit
      this.iframes = T.hurtIframes;
      this.flash = 0.25;
      Fx.shake(6, 0.25);
      Sfx.play('hurt');
      Fx.burst(this.x, this.y, '#ff5555', 10, { speed: 150, life: 0.4 });
      // thorns bite back at whoever hit you - #144: a ranged shooter too, not just a
      // melee toucher (src is the projectile's owner). A spark at the source sells the
      // reprisal when the shooter is across the room.
      const _thorns = this.mod('thorns') + ((this.fstance && this.fstance.thorns) || 0); // #252 AJAX
      if (src && !src.dead && _thorns) {
        src.takeHit(_thorns, { sx: this.x, sy: this.y, fromPlayer: true }, g);
        if (Math.hypot(src.x - this.x, src.y - this.y) > this.r + 40) {
          Fx.burst(src.x, src.y, ['#7CFC6B', '#d8ffcf'], 6, { speed: 90, life: 0.3, glow: true, size: 2.4 });
        }
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
      if (this.hp <= 0) this.die(g);
    }

    // #139 the ONE death path, for ANY source that drops hp to 0 - a monster hit, a
    // burning tomb, the Pyres, Jupiter's justice recoil. It used to live only inside
    // damage(), so effects that subtract hp directly (justice) drove hp negative and
    // NEVER died - Sam sat at -3671 HP still playing. Now a per-frame check in update()
    // routes every lethal source through here.
    die(g) {
      if (this.dead || this.hp > 0) return;
      // PASCAL'S WAGER (trinket): no hedge, no Lazarus, no Phoenix - if the bet is
      // wrong it is wrong all the way.
      const noHedge = this.trinketFlag('noSecondChance');
      if (!noHedge && this.evo.lifeline > this.lifelineUsed) {   // Lazarus Taxon
        this.lifelineUsed++;
        this.hp = 1; this.iframes = 1.5;
        Sfx.play('levelup');
        Fx.text(this.x, this.y - 34, 'LAZARUS TAXON', '#6ee7a0', 16);
        Fx.burst(this.x, this.y, ['#6ee7a0', '#fff'], 30, { speed: 240, life: 0.8, glow: true });
        return;
      }
      if (!noHedge && this.armorMods.phoenix && !this.phoenixUsed) { // Phoenix Plume
        this.phoenixUsed = true;
        this.hp = Math.round(this.maxHp * 0.3); this.iframes = 1.5;
        Sfx.play('levelup');
        Fx.text(this.x, this.y - 34, 'PHOENIX PLUME', '#ff9a3d', 16);
        Fx.burst(this.x, this.y, ['#ff9a3d', '#ffe08a', '#ff4422'], 40, { speed: 280, life: 0.9, glow: true });
        return;
      }
      this.hp = 0; this.dead = true; g.onPlayerDeath();
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
      // #247 (Sam) attack speed must NOT make wands/staves shoot faster - a spell's
      // cadence is part of its identity. Casters convert the stat instead: all
      // surplus attack speed recharges Q/R/ult that much faster (see cdTick below).
      const _wArch = this.weapon && this.weapon.archetype;
      const _isCaster = _wArch === 'wand' || _wArch === 'staff';
      const _asf = stats.atkSpeedMul + this.mod('atkSpd') + this.frenzy.s * 0.02 + ((this.fstance && this.fstance.atkSpd) || 0); // #253 ACHILLES/QUICKSILVER
      if (this.attackCd > 0) this.attackCd -= dt * (_isCaster ? 1 : _asf);
      if (this._echoT > 0) { // #250 a pending spell echo fires when the beat lands
        this._echoT -= dt;
        if (this._echoT <= 0 && !this.dead && _isCaster) {
          const savedCd = this.attackCd;
          this._echoing = true; this.fireSpell(g); this._echoing = false;
          this.attackCd = savedCd; // the echo is free - it must not delay the next real cast
        }
      }
      if (this.flash > 0) this.flash -= dt;
      if (this.momentumT > 0) this.momentumT -= dt;
      if (this.buffs.undyingT > 0) this.buffs.undyingT -= dt; // #156
      if (this.buffs.rageT > 0) this.buffs.rageT -= dt;
      if (this.buffs.hasteT > 0) this.buffs.hasteT -= dt;
      // #252 FUSION timers ------------------------------------------------------
      if (this.fleeceT > 0) this.fleeceT -= dt;
      if (this.fstance) {
        const fs = this.fstance; fs.t -= dt;
        if (fs.id === 'marathon') {
          // continuous trickle: heal() rounds per-call (0.2/frame -> 0), so add
          // straight to hp exactly like the stats.regen tick does
          if (this.moving) { fs.ramp = Math.min(6, fs.ramp + dt); this.hp = Math.min(this.maxHp, this.hp + fs.regen * dt); }
          if (fs.ramp >= 6 && !fs.healed) { fs.healed = true; this.heal(this.maxHp * 0.15); Fx.text(this.x, this.y - 44, 'FULL STRIDE', '#7fd4ff', 14); }
          // #257 at full stride you are a battering ram - steer INTO them
          if (fs.ramp >= 6 && g && g.monsters) {
            fs.ramT = (fs.ramT || 0) - dt;
            if (fs.ramT <= 0) for (const m of g.monsters) {
              if (m.dead || m.spawnT > 0) continue;
              if (Math.hypot(m.x - this.x, m.y - this.y) < m.r + this.r + 6) {
                fs.ramT = 0.3;
                m.takeHit(Math.round(10 + fs.regen), { sx: this.x, sy: this.y, knock: 280, fromPlayer: true, hitSfx: 'hitHeavy' }, g);
                Fx.text(m.x, m.y - m.r - 8, 'RAM', '#7fd4ff', 11);
                break;
              }
            }
          }
        }
        if (fs.id === 'mjolnir' && g && g.monsters) { // #253/#255 the storm hammers on a beat
          fs.zapT -= dt;
          if (fs.zapT <= 0) {
            let best = null, bd = 240;
            for (const m of g.monsters) { if (m.dead || m.spawnT > 0) continue; const d = Math.hypot(m.x - this.x, m.y - this.y); if (d < bd) { bd = d; best = m; } }
            if (best) {
              fs.zapT = fs.zapFast ? 0.45 : 0.8; // #255 TESLA COIL crackles faster
              best.takeHit(fs.zap + best.maxHp * 0.02 * (best.isBoss ? 1 / 3 : 1), { sx: this.x, sy: this.y, fromPlayer: true, hitSfx: 'hitArrow' }, g);
              let from = best; const chained = new Set([best]);
              for (let ci = 0; ci < (fs.zapChain || 1); ci++) { // #255 TESLA forks twice
                let chain = null, cd2 = 160;
                for (const m of g.monsters) { if (chained.has(m) || m.dead || m.spawnT > 0) continue; const d = Math.hypot(m.x - from.x, m.y - from.y); if (d < cd2) { cd2 = d; chain = m; } }
                if (!chain) break;
                chain.takeHit(fs.zap * 0.5, { sx: from.x, sy: from.y, fromPlayer: true, hitSfx: 'hitArrow' }, g);
                chained.add(chain); from = chain;
              }
              Fx.burst(best.x, best.y, ['#ffe27a', '#fff'], 10, { speed: 180, life: 0.3, glow: true });
            }
          }
        }
        if (fs.id === 'prometheus' && g) { // #256 the flamethrower: a torrent along your aim
          fs.flameT -= dt;
          if (fs.flameT <= 0) {
            fs.flameT = 0.06;
            const spread = (Math.random() - 0.5) * 0.3;
            const ang = this.facing + spread, sp = 360 + Math.random() * 80;
            g.projectiles.push({ x: this.x + Math.cos(ang) * 16, y: this.y + Math.sin(ang) * 16,
              vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 7, dmg: fs.flameDmg,
              from: 'player', color: Math.random() < 0.5 ? '#ff8a3d' : '#ffcc44', life: 0.45,
              flame: fs.ignite, hitSfx: 'hitArrow', glowTrail: true, trail: ['#ff8a3d', '#ff5a2c'], hitSet: new Set() });
          }
        }
        if (fs.id === 'stone') { // #256 the stone burns gold while it is lit
          fs.drainT += dt;
          if (fs.drainT >= 1 / (fs.drain || 4)) {
            fs.drainT = 0; this.coins--;
            if (this.coins <= 0) { this.coins = 0; this.fstance = null; Fx.text(this.x, this.y - 40, 'OUT OF GOLD', '#c9a86a', 13); }
          }
        }
        if (fs.id === 'tailwind') { // #257 the wake carries the party
          fs.wakeT = (fs.wakeT || 0) - dt;
          if (this.moving && Math.random() < 0.35) Fx.burst(this.x - Math.cos(this.facing) * 14, this.y - Math.sin(this.facing) * 14, ['#7fd4ff', '#cfeeff'], 2, { speed: 60, life: 0.4 });
          if (fs.wakeT <= 0 && g && g.coop && typeof Net !== 'undefined' && Net.connected) {
            fs.wakeT = 1.0;
            for (const [id, rp] of g.remotePlayers) {
              if (rp.downed || !rp.room || !g.room || rp.room[0] !== g.room.gx || rp.room[1] !== g.room.gy) continue;
              if (Math.hypot(rp.x - this.x, rp.y - this.y) < 140) Net.sendR({ t: 'fwake', to: id });
            }
          }
        }
        if (fs.id === 'trollblood') { // #254 heavy regen unless staggered
          if (fs.stunT > 0) fs.stunT -= dt;
          else {
            this.hp = Math.min(this.maxHp, this.hp + fs.regen * dt);
            // #257 legibility: the blood visibly knits
            if (this.hp < this.maxHp && Math.random() < 0.25) Fx.burst(this.x + (Math.random() - 0.5) * 20, this.y + (Math.random() - 0.5) * 20, ['#6ee7a0', '#9effc0'], 1, { speed: 40, life: 0.5 });
          }
        }
        if (fs.id === 'rabbitsfoot') { // #254 charmed feet: free rolls, robbed on the way through
          this.rollCd = 0;
          if (this.rollT >= 0 && g && g.monsters) {
            fs.rolled = fs.rolled || new Set();
            for (const m of g.monsters) {
              if (m.dead || m.spawnT > 0 || fs.rolled.has(m)) continue;
              if (Math.hypot(m.x - this.x, m.y - this.y) < m.r + this.r + 10) {
                fs.rolled.add(m); this.coins += 2;
                m.chillT = Math.max(m.chillT || 0, 1.5); m.chillMul = 0.5;
                Fx.text(m.x, m.y - 16, '+2', '#ffce54', 10);
              }
            }
          }
        }
        if (fs.id === 'parthian' && g && g.monsters) { // #253 arrows fire BEHIND the retreat
          fs.shotT -= dt;
          if (this.moving && fs.shotT <= 0) {
            let best = null, bd = 420;
            for (const m of g.monsters) { if (m.dead || m.spawnT > 0) continue; const d = Math.hypot(m.x - this.x, m.y - this.y); if (d < bd) { bd = d; best = m; } }
            if (best) {
              const mvx = this.x - this.px, mvy = this.y - this.py;
              if (mvx * (best.x - this.x) + mvy * (best.y - this.y) < 0) { // genuinely backing away
                fs.shotT = 0.35;
                const ang = Math.atan2(best.y - this.y, best.x - this.x);
                const dmg = Math.max(1, Math.round(((this.weapon && this.weapon.dmg) || 10) * this.stats.dmgMul));
                g.projectiles.push({ x: this.x, y: this.y, vx: Math.cos(ang) * 520, vy: Math.sin(ang) * 520, r: 4, dmg, from: 'player', color: '#ffd7a0', life: 1.2, hitSfx: 'hitArrow', hitSet: new Set() });
              }
            }
          }
          if (this.rollT >= 0) this.attackCd = 0; // the tumble reloads
        }
        if (fs.t <= 0) this.fstance = null;
      }
      if (this.rootT > 0) {
        this.rootT -= dt;
        this.hp = Math.min(this.maxHp, this.hp + (this.rootRegen || 8) * dt); // continuous - heal() would round to 0
        if (this.rootT <= 0) { // ANTAEUS: the earth pays back what it absorbed
          const burst = Math.round(this.rootStore || 0);
          if (burst > 0 && g && g.monsters) {
            for (const m of g.monsters) {
              if (m.dead || m.airborne || m.spawnT > 0) continue;
              if (Math.hypot(m.x - this.x, m.y - this.y) > 200 + m.r) continue;
              m.takeHit(burst, { sx: this.x, sy: this.y, knock: 260, fromPlayer: true, hitSfx: 'hitHeavy' }, g);
            }
            Fx.text(this.x, this.y - 44, `ANTAEUS ${burst}`, '#a9744f', 14);
          }
          Fx.burst(this.x, this.y, ['#a9744f', '#ffd24c'], 30, { speed: 280, life: 0.6, glow: true });
          this.rootStore = 0;
        }
      }
      if (this._houdini && this.invisT <= 0) { // HOUDINI reappears: a chilling flourish
        this._houdini = false;
        if (g && g.monsters) for (const m of g.monsters) {
          if (m.dead || m.spawnT > 0) continue;
          if (Math.hypot(m.x - this.x, m.y - this.y) < 160) { m.chillT = Math.max(m.chillT || 0, 2); m.chillMul = 0.5; }
        }
        Fx.burst(this.x, this.y, ['#b6c0d0', '#7fd4ff'], 22, { speed: 220, life: 0.5, glow: true });
      }
      if (this.frenzy.t > 0) { this.frenzy.t -= dt; if (this.frenzy.t <= 0) this.frenzy.s = 0; }
      if (this.fireImmuneT > 0) this.fireImmuneT -= dt; // #229 pyro R8
      const _cdTick = dt * (_isCaster ? Math.max(1, _asf) : 1); // #247 caster CDR
      if (this.ability && this.ability.cd > 0) this.ability.cd -= _cdTick;
      if (this.abilityR && this.abilityR.cd > 0) this.abilityR.cd -= _cdTick;
      if (this.abilityUlt && this.abilityUlt.cd > 0) this.abilityUlt.cd -= _cdTick;
      // THE FAST (Gluttony) stops your regeneration dead: nothing on that terrace
      // will feed you, and the health you finish the floor with is the health you had.
      const totalRegen = (g.rules && g.rules.noRegen) ? 0 : stats.regen + this.mod('regenFlat');
      if (totalRegen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + totalRegen * dt);

      // #166 (Sam) BLEED (the magic panther's claws): a short DoT that chips HP away.
      if (this.slowT > 0) this.slowT -= dt; // #179 the glue dries off
      if (this.fstance && this.fstance.noSlow) { this.slowT = 0; this.slowMul = 1; } // #253 ACHILLES shrugs the glue off
      if (this.frozenFxT > 0) this.frozenFxT -= dt; // #180 the ice shell melts
      if (this.blindT > 0) this.blindT -= dt; // #182 sight returns
      if (this.bleed && this.bleed.t > 0) {
        this.bleed.t -= dt; this.bleed.tick -= dt;
        if (this.bleed.tick <= 0) {
          this.bleed.tick = 0.5;
          this.hp -= this.bleed.dps * 0.5;
          if (typeof Fx !== 'undefined') Fx.burst(this.x, this.y, ['#c81e2e', '#ff5a5a'], 3, { speed: 60, life: 0.35 });
        }
        if (this.bleed.t <= 0) this.bleed = null;
      }
      // #139 apply accumulated JUPITER JUSTICE (rules.js), capped per frame. Justice
      // fires once per enemy hit, so a cleave into a crowd used to stack thousands of
      // recoil in a single swing and gib you (Sam, -3671 hp). Cap it to 10% of max HP
      // per frame - a real tax on burst, never an instant death.
      if (this.justiceDue > 0) {
        this.hp -= Math.min(this.justiceDue, this.maxHp * 0.10);
        this.justiceDue = 0;
      }
      // THE death backstop: any source that drops hp to 0 (justice, the Pyres, a DoT)
      // dies here, not only a monster hit inside damage().
      if (this.hp <= 0 && !this.dead) this.die(g);

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
      // MOBILE: the touch stick is analog. Emulating WASD from a thumbstick gives you
      // 8-way movement and feels awful, so the stick overrides the keys outright when
      // it is being held (touch.js).
      if (input.stick) { mx = input.stick.x; my = input.stick.y; }
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
        const haste = (this.buffs.hasteT > 0 ? 1.30 : 1) * (this.form ? this.form.spdMul : 1); // #156 druid form

        // cleared-room traversal boost; and a STRONGER one when backtracking far (>3
        // rooms) from the nearest unexplored room, so long treks back are snappy (#34)
        const clear = !g.monsters.some(m => !m.dead);
        const traversal = !clear ? 1 : ((g.backtrackRooms || 0) > 3 ? 1.7 : 1.28);
        // FLOOR RULES: the Mire slows you; the Ice sets moveMul to 0 and takes over
        // movement entirely in its player() hook below (momentum, no sharp stops).
        const rules = (g.rules || (typeof Rules !== 'undefined' ? Rules.none() : null));
        const ruleMul = rules ? rules.moveMul : 1;
        // MOBILE: mx/my get normalised to a unit vector just above, which throws the
        // thumbstick's MAGNITUDE away and makes a half-pushed stick run at full speed.
        // Fold it back in here, so a gentle push is a walk and a full push is a sprint.
        const stickMag = input.stick ? input.stick.mag : 1;
        const glue = this.slowT > 0 ? (this.slowMul || 1) : 1; // #179 glued feet
        // #252 MARATHON builds stride while moving; ANTAEUS roots you to the spot
        const fBonus = !this.fstance ? 1
          : this.fstance.id === 'marathon' ? 1 + Math.min(0.36, this.fstance.ramp * 0.06)
          : 1 + (this.fstance.spdMul || 0); // #253 ACHILLES
        const sp = T.speed * (stats.speedMul + this.mod('spd')) * mom * haste * traversal * ruleMul * stickMag * glue * fBonus * (this.rootT > 0 ? 0 : 1);
        this.x += mx * sp * dt;
        this.y += my * sp * dt;
        // roll trigger. THE WEIGHT (Pride, on the mountain) takes the dodge away
        // entirely: you go bent double under a stone, and you cannot bend from
        // anything. It is the single most-used button in the game, and losing it
        // changes how you have to fight the whole terrace.
        const noRoll = g.rules && g.rules.noRoll;
        if (noRoll && (input.pressed('Space') || input.pressed('ShiftLeft') || input.pressed('ShiftRight'))) {
          if (typeof Fx !== 'undefined') Fx.text(this.x, this.y - this.r - 16, 'THE WEIGHT', '#d8c39a', 12);
        }
        if (!noRoll && (input.pressed('Space') || input.pressed('ShiftLeft') || input.pressed('ShiftRight')) && this.rollCd <= 0) {
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

      // FLOOR RULES per-frame hook: the Gale shoves you, the Ice slides you, the
      // Pyres burn you for touching cover. Deliberately placed AFTER movement and
      // BEFORE the obstacle/wall resolution below, so a rule can push the player
      // and the walls still stop them (you can slide into a wall on the ice).
      if (g.rules && g.rules.player) g.rules.player(this, dt, g);

      // hit knockback decay
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.vx *= Math.pow(0.001, dt); this.vy *= Math.pow(0.001, dt);

      // #117 cape wind: target the current travel vector (roll >> run >> idle) and
      // ease toward it so the cloth lags and trails like real fabric with inertia
      let tvx = 0, tvy = 0;
      if (this.rollT >= 0) { tvx = Math.cos(this.rollAngle) * T.rollSpeed; tvy = Math.sin(this.rollAngle) * T.rollSpeed; }
      else if (this.moving) { tvx = Math.cos(this.moveAngle) * T.speed; tvy = Math.sin(this.moveAngle) * T.speed; }
      const cwk = Math.min(1, dt * 9);
      this.capeWind.x += (tvx - this.capeWind.x) * cwk;
      this.capeWind.y += (tvy - this.capeWind.y) * cwk;

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
          if (this.drawT >= 0.45) { // #108 auto-release near full draw (was 0.72; the long draw dominated the cycle and gutted bow DPS)
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
      if (w.archetype === 'bow') { this.drawT = 0.45; this.fireBow(g); this.drawT = -1; } // #108 match the faster auto-release
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
        arc: (this.fstance && this.fstance.cleave) ? Math.PI * 2 : w.arc, range: w.range, // #252 AJAX cleaves the full circle
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
            // #156 PYROMANCER: everything you touch catches fire. burnOnHit feeds the
            // SAME flame channel fire-aspect weapons use, so the burn DoT already in
            // monsters.js applies with no new system.
            flame: Weapons.has(w, 'fireaspect') || this.mod('burnOnHit') || (crit && this.mod('critBleed') ? this.mod('critBleed') : 0),
            chill: Weapons.has(w, 'frost'), venom: Weapons.has(w, 'venom'), chain: Weapons.has(w, 'chain'),
            stagger: w.stagger,
            execute: !!Weapons.has(w, 'executioner'),
            hitSfx: w.archetype === 'heavy' ? 'hitHeavy' : 'hitLight',
            crit, fromPlayer: true,
          }, g);
          if (landed) { this.onHitLanded(crit, g); hitAny = true; } // blocked hits earn nothing
        }
        // #224 FRIENDLY FIRE (PVP Phase 0): the same sweep tests teammates. Attacker
        // resolves the hit against its own view; the victim applies it (phit path,
        // with their armor and iframes). Never yourself, never your own clones.
        if (g.friendlyFire && g.coop && g.partyTargets) {
          for (const t of g.partyTargets()) {
            if (!t.isRemote) continue;
            const dx = t.x - this.x, dy = t.y - this.y;
            const d = Math.hypot(dx, dy);
            if (d > w.range + (t.r || 13)) continue;
            const diff = Math.abs(((Math.atan2(dy, dx) - dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            if (diff > w.arc / 2) continue;
            if (g.room.walls && g.room.walls.length && Dungeon.segBlocked(this.x, this.y, t.x, t.y, g.room.walls)) continue;
            const { dmg, crit } = this.computeDmg(w.dmg * dmgScale, null, g);
            g.hurtTarget(t, dmg, this.x, this.y, this);
            this.onHitLanded(crit, g);
            hitAny = true;
          }
        }
      };
      swingOnce(1);
      // #256 EXCALIBUR: the swing itself takes flight - a blade of light carries on
      if (this.fstance && this.fstance.id === 'excalibur' && w.archetype !== 'bow' && w.archetype !== 'wand' && w.archetype !== 'staff') {
        const { dmg: beamDmg, crit: beamCrit } = this.computeDmg(w.dmg * (this.fstance.beamMul || 0.9), null, g);
        g.projectiles.push({ x: this.x + Math.cos(dir) * 18, y: this.y + Math.sin(dir) * 18,
          vx: Math.cos(dir) * 480, vy: Math.sin(dir) * 480, r: 6, dmg: beamDmg,
          from: 'player', color: '#cfeeff', life: 1.4, pierce: 2, knock: 120,
          crit: beamCrit, hitSfx: 'hitArrow', glowTrail: true, trail: ['#cfeeff', '#8fb7ff'], hitSet: new Set() });
        Sfx.play('bowfire');
      }
      if (g.cloneEcho) g.cloneEcho(this, w, 1); // #229 mesmer R8: the copies swing with you
      // Echo evolutions: light swings sometimes strike twice (second at half power)
      const _ec = this.mod('echo') + ((this.fstance && this.fstance.echoBoost) || 0); // #253 QUICKSILVER
      if (w.archetype === 'light' && _ec && Math.random() < _ec) {
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
      const draw = Math.min(1, this.drawT / 0.5); // full power at 0.8s draw
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
      const magScale = (1 + Math.max(0, this.magicLevel() - 1) * 0.08) * (1 + this.mod('spellPower')) * (1 + ((this.fstance && this.fstance.spellPow) || 0)); // #253 PROMETHEUS
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
        // #142 (Sam) Multishot works on the STAFF now, not just the wand - it fired one
        // fireball and ignored the enchant. A multishot staff throws a 3-burst fan.
        const n = Weapons.has(w, 'multishot') ? 3 : 1;
        for (let i = 0; i < n; i++) {
          mkProj(a + (i - (n - 1) / 2) * 0.16, w.dmg, Object.assign({ r: 8, color: col, life: 2.0, blast, hitSfx: 'hitHeavy', spell: 'fireball', elem }, extra));
        }
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
      // #250 ECHO for casters: the nymph repeats your voice - the whole volley
      // re-casts a beat later. Guarded so an echo can never echo itself.
      const _ec2 = this.mod('echo') + ((this.fstance && this.fstance.echoBoost) || 0); // #253 QUICKSILVER
      if (!this._echoing && _ec2 && Math.random() < _ec2) this._echoT = 0.22;
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
      // #157 DRUID FORM: the beast's colours win over the evolution palette - if you are a
      // bear you must LOOK like a bear, not like a tier-3 champion who happens to be brown.
      const F = this.form;
      const cloakCol = this.flash > 0 ? '#ff8080' : (F ? F.cloak : (evoStage >= 2 && pal ? pal.cloak : '#2c3e60'));
      const bodyCol  = this.flash > 0 ? '#ffb0b0' : (F ? F.body  : (evoStage >= 2 && pal ? pal.body  : '#4a6fa5'));
      // (no extra scale here: this.r IS the form's real radius - see setForm)
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
      c.fillStyle = this.form ? this.form.accent : (evoStage >= 2 && pal ? pal.accent : '#9ee7ff');
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

      // #180 (Sam) FROZEN: a pale ice block encases the champion while the snowman's
      // icicle holds you. Drawn last, over everything, so the freeze reads instantly.
      if (this.frozenFxT > 0) {
        const k = Math.min(1, this.frozenFxT / 0.7);
        c.save(); c.translate(this.x, this.y);
        c.globalAlpha = 0.5 * k;
        c.fillStyle = '#bfe6f5';
        c.beginPath(); c.rect(-this.r - 5, -this.r - 8, (this.r + 5) * 2, (this.r + 8) * 2); c.fill();
        c.globalAlpha = 0.85 * k; c.strokeStyle = '#e8f7ff'; c.lineWidth = 1.5;
        c.strokeRect(-this.r - 5, -this.r - 8, (this.r + 5) * 2, (this.r + 8) * 2);
        // a couple of crack lines
        c.beginPath(); c.moveTo(-4, -this.r - 4); c.lineTo(2, 0); c.lineTo(-2, this.r + 2); c.stroke();
        c.restore();
      }
    }

    // #43 the prestige cape - a draped royal mantle behind the champion, built as
    // two fold panels (a darker left, lighter right) with a scalloped hem, gold trim
    // and a gold collar clasp, so it reads as real cloth instead of a blob. Length,
    // richness and colour deepen with prestige (caps ~tier 6; the number keeps climbing).
    drawPrestigeCape(c, prestige) {
      capeAt(c, this.r, prestige, this.moving, this.x, this.capeWind.x, this.capeWind.y);
    }

    // #52 the class's signature headwear/armor, in the fixed body frame.
    // #156 the RACE's face goes on first, so the class helm sits over it.
    drawClassFeature(c) {
      // #157 shifted: the animal head REPLACES the race face and the class antlers. You are
      // the beast now; a bear does not keep its dwarf beard.
      if (this.form) { drawFormHead(c, this.form.id, this.r); return; }
      drawRaceFeature(c, (this.race && this.race.id) || 'human', this.r);
      classFeature(c, (this.class && this.class.id) || '', this.r);
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
      const model = (typeof Weapons !== 'undefined' && Weapons.modelFor) ? Weapons.modelFor(w) : null;
      c.save();
      c.translate(this.x, this.y);
      c.rotate(this.facing);
      if (w.archetype === 'bow') {
        // each bow MODEL has its own limbs; the string/pull/sparkle animation is shared.
        const pull = this.drawT >= 0 ? Math.min(1, this.drawT / 0.5) : 0;
        const cx = this.r + 7;
        let tipX, tipY; // where the string anchors
        c.strokeStyle = w.color;
        if (model === 'shortbow') {          // small, deeply bent, thick limbs
          c.lineWidth = 4;
          c.beginPath(); c.arc(cx - 1, 0, 8, -Math.PI / 1.9, Math.PI / 1.9); c.stroke();
          tipX = cx - 1 + Math.cos(Math.PI / 1.9) * 8; tipY = Math.sin(Math.PI / 1.9) * 8;
        } else if (model === 'longbow') {    // tall, nearly straight stave
          c.lineWidth = 2.5;
          c.beginPath(); c.moveTo(cx - 2, -15); c.quadraticCurveTo(cx + 8, 0, cx - 2, 15); c.stroke();
          c.lineWidth = 4; c.beginPath(); c.moveTo(cx + 2.6, -2.5); c.lineTo(cx + 2.6, 2.5); c.stroke(); // grip wrap
          tipX = cx - 2; tipY = 15;
        } else if (model === 'recurve') {    // limbs that curl back at the tips
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(cx - 3, -13); c.quadraticCurveTo(cx + 9, -9, cx + 6, 0);
          c.quadraticCurveTo(cx + 9, 9, cx - 3, 13);
          c.stroke();
          tipX = cx - 3; tipY = 13;
        } else {                             // huntingbow: the classic arc
          c.lineWidth = 3;
          c.beginPath(); c.arc(cx, 0, 11, -Math.PI / 2.1, Math.PI / 2.1); c.stroke();
          tipX = cx + Math.cos(Math.PI / 2.1) * 11; tipY = Math.sin(Math.PI / 2.1) * 11;
        }
        c.strokeStyle = '#ccc'; c.lineWidth = 1;
        c.beginPath();
        c.moveTo(tipX, -tipY);
        c.lineTo(cx - pull * 8, 0);
        c.lineTo(tipX, tipY);
        c.stroke();
        if (pull > 0) {
          c.strokeStyle = '#e8e3d0'; c.lineWidth = 2.5;
          c.beginPath(); c.moveTo(cx - pull * 8, 0); c.lineTo(cx + 11 - pull * 8, 0); c.stroke();
          // full-draw sparkle
          if (pull >= 1) { c.fillStyle = '#ffd24c'; c.beginPath(); c.arc(cx + 12 - pull * 8, 0, 2.5, 0, Math.PI * 2); c.fill(); }
        }
        c.restore();
        return;
      }
      if (w.archetype === 'wand' || w.archetype === 'staff') {
        // #16 -> per-MODEL heads on a shaft; the staff's tip still swells as it charges
        const isStaff = w.archetype === 'staff';
        const len = this.r + (isStaff ? 22 : 14);
        const charge = (isStaff && this.drawT >= 0) ? Math.min(1, this.drawT / w.windup) : 0;
        const hot = charge > 0.05 ? '#ffd24c' : w.color;
        c.lineCap = 'round';
        // the shaft (willow is a crooked living twig, rod is thick, the rest straight)
        c.strokeStyle = isStaff ? '#6a5030' : w.color;
        c.lineWidth = isStaff ? 3 : model === 'rod' ? 3.5 : 2.5;
        if (model === 'willow') {
          c.beginPath(); c.moveTo(this.r * 0.4, 0); c.quadraticCurveTo(len * 0.55, -3.5, len * 0.75, 1.5); c.quadraticCurveTo(len * 0.88, 3.5, len - 4, 0); c.stroke();
        } else {
          c.beginPath(); c.moveTo(this.r * 0.4, 0); c.lineTo(len - 4, 0); c.stroke();
        }
        c.shadowColor = w.color; c.shadowBlur = 6 + charge * 10;
        c.fillStyle = hot;
        if (model === 'scepter') {           // an orb held in an open crown
          c.strokeStyle = w.color; c.lineWidth = 1.6;
          c.beginPath();
          c.moveTo(len - 4, -2.5); c.lineTo(len + 3, -4.5);
          c.moveTo(len - 4, 2.5); c.lineTo(len + 3, 4.5);
          c.moveTo(len - 4, 0); c.lineTo(len + 5.5, 0);
          c.stroke();
          c.beginPath(); c.arc(len + 1, 0, 3 + charge * 3, 0, Math.PI * 2); c.fill();
        } else if (model === 'rod') {        // banded rod, square crystal cap
          c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(this.r + 3, -2.2); c.lineTo(this.r + 3, 2.2); c.moveTo(this.r + 7, -2.2); c.lineTo(this.r + 7, 2.2); c.stroke();
          const s = 3 + charge * 2.5;
          c.fillRect(len - s * 0.8, -s * 0.75, s * 1.6, s * 1.5);
        } else if (model === 'willow') {     // leaves + a soft budding glow
          c.beginPath(); c.ellipse(len * 0.62, -3.5, 3.4, 1.5, -0.5, 0, Math.PI * 2); c.fill();
          c.beginPath(); c.ellipse(len * 0.82, 3.2, 3, 1.4, 0.5, 0, Math.PI * 2); c.fill();
          c.globalAlpha = 0.8;
          c.beginPath(); c.arc(len, 0, 3 + charge * 3, 0, Math.PI * 2); c.fill();
          c.globalAlpha = 1;
        } else if (model === 'stave') {      // ring head, gem floating in the eye
          c.strokeStyle = w.color; c.lineWidth = 2.5;
          c.beginPath(); c.arc(len, 0, 5, 0, Math.PI * 2); c.stroke();
          c.beginPath(); c.arc(len, 0, 2 + charge * 2.5, 0, Math.PI * 2); c.fill();
        } else if (model === 'runewood') {   // forked tines cradling the light
          c.strokeStyle = '#6a5030'; c.lineWidth = 2.2;
          c.beginPath(); c.moveTo(len - 6, 0); c.quadraticCurveTo(len - 1, -4.5, len + 4, -5.5); c.stroke();
          c.beginPath(); c.moveTo(len - 6, 0); c.quadraticCurveTo(len - 1, 4.5, len + 4, 5.5); c.stroke();
          c.beginPath(); c.arc(len, 0, 2.6 + charge * 3, 0, Math.PI * 2); c.fill();
        } else if (model === 'emberstaff') { // a living flame that leans with the charge
          const fl = 6 + charge * 5;
          c.beginPath();
          c.moveTo(len + fl, 0); c.quadraticCurveTo(len + fl * 0.4, 3.6, len - 2, 2.2);
          c.quadraticCurveTo(len - 3.5, 0, len - 2, -2.2); c.quadraticCurveTo(len + fl * 0.4, -3.6, len + fl, 0);
          c.closePath(); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.65)';
          c.beginPath(); c.arc(len, 0, 1.6 + charge * 1.5, 0, Math.PI * 2); c.fill();
        } else if (model === 'staff') {      // faceted crystal
          const s = 4.5 + charge * 3.5;
          c.beginPath(); c.moveTo(len + s, 0); c.lineTo(len, s * 0.62); c.lineTo(len - s, 0); c.lineTo(len, -s * 0.62); c.closePath(); c.fill();
        } else {                             // wand: the classic glowing orb
          c.beginPath(); c.arc(len, 0, 3 + charge * 3.5, 0, Math.PI * 2); c.fill();
        }
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
        // #45 -> a distinct idle MODEL per weapon (not just per archetype): each melee
        // name in weapons.js has its own held shape, so a Maul never reads as a Cleaver.
        const w = this.weapon, L = this.r * 0.6;
        const m = (typeof Weapons !== 'undefined' && Weapons.modelFor) ? Weapons.modelFor(w) : (w.archetype === 'heavy' ? 'greataxe' : 'shortsword');
        c.save();
        c.translate(this.x, this.y);
        c.rotate(this.facing + 0.7);
        c.lineCap = 'round';
        if (m === 'cleaver') {                    // one slab of butcher steel
          c.strokeStyle = '#6a5030'; c.lineWidth = 3;
          c.beginPath(); c.moveTo(L - 3, 0); c.lineTo(L + 4, 0); c.stroke();               // stub grip
          c.fillStyle = w.color;
          c.fillRect(L + 4, -5.5, 15, 11);                                                  // slab blade
          c.fillStyle = 'rgba(255,255,255,0.3)';
          c.fillRect(L + 4, 2.8, 15, 2.7);                                                  // edge shine
          c.fillStyle = 'rgba(0,0,0,0.5)';
          c.beginPath(); c.arc(L + 15.5, -3, 1.4, 0, Math.PI * 2); c.fill();                // hang-hole
        } else if (m === 'warhammer') {           // block head + back spike
          c.strokeStyle = '#6a5030'; c.lineWidth = 3;
          c.beginPath(); c.moveTo(L - 3, 0); c.lineTo(L + 18, 0); c.stroke();               // haft
          c.fillStyle = w.color;
          c.fillRect(L + 12, -9, 8, 9);                                                     // hammer block
          c.beginPath(); c.moveTo(L + 13, 1); c.lineTo(L + 16.5, 8.5); c.lineTo(L + 19.5, 1); c.closePath(); c.fill(); // spike
          c.fillStyle = 'rgba(255,255,255,0.3)';
          c.fillRect(L + 12, -9, 8, 2.6);                                                   // top shine
        } else if (m === 'maul') {                // a banded sledge block
          c.strokeStyle = '#6a5030'; c.lineWidth = 3;
          c.beginPath(); c.moveTo(L - 3, 0); c.lineTo(L + 16, 0); c.stroke();               // haft
          c.fillStyle = w.color;
          c.beginPath();
          c.moveTo(L + 13, -7); c.lineTo(L + 25, -7); c.quadraticCurveTo(L + 27, 0, L + 25, 7);
          c.lineTo(L + 13, 7); c.quadraticCurveTo(L + 11, 0, L + 13, -7); c.closePath(); c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.4;
          c.beginPath(); c.moveTo(L + 16.5, -7.6); c.lineTo(L + 16.5, 7.6); c.moveTo(L + 21.5, -7.6); c.lineTo(L + 21.5, 7.6); c.stroke(); // iron bands
        } else if (m === 'greataxe') {            // the broad double-curve axe head
          c.strokeStyle = '#6a5030'; c.lineWidth = 3;
          c.beginPath(); c.moveTo(L - 3, 0); c.lineTo(L + 20, 0); c.stroke();               // haft
          c.fillStyle = w.color;
          c.beginPath();
          c.moveTo(L + 11, -2.5); c.quadraticCurveTo(L + 25, -10, L + 23, 0);
          c.quadraticCurveTo(L + 25, 10, L + 11, 2.5); c.closePath(); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.25)';
          c.beginPath(); c.moveTo(L + 11, -2.5); c.quadraticCurveTo(L + 20, -7, L + 21, -1); c.lineTo(L + 12, -1); c.closePath(); c.fill();
        } else if (m === 'dagger') {              // short, broad, all point
          c.strokeStyle = '#6a5030'; c.lineWidth = 2.5;
          c.beginPath(); c.moveTo(L - 4, 0); c.lineTo(L, 0); c.stroke();                    // grip
          c.strokeStyle = w.color; c.lineWidth = 2; c.lineCap = 'butt';
          c.beginPath(); c.moveTo(L, -4); c.lineTo(L, 4); c.stroke();                       // wide guard
          c.fillStyle = w.color;
          c.beginPath(); c.moveTo(L, -3); c.lineTo(L + 12, 0); c.lineTo(L, 3); c.closePath(); c.fill(); // broad point
        } else if (m === 'rapier') {              // a needle behind a bell guard
          c.strokeStyle = '#6a5030'; c.lineWidth = 2.5;
          c.beginPath(); c.moveTo(L - 4, 0); c.lineTo(L, 0); c.stroke();                    // grip
          c.strokeStyle = w.color; c.lineWidth = 1.8;
          c.beginPath(); c.arc(L + 1.5, 0, 3.5, Math.PI * 0.6, Math.PI * 1.4); c.stroke();  // bell sweep
          c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(L + 1.5, 0); c.lineTo(L + 22, 0); c.stroke();             // needle blade
        } else if (m === 'twinfang') {            // two curved fangs held together
          for (const s of [-1, 1]) {
            c.save(); c.rotate(s * 0.22);
            c.strokeStyle = '#6a5030'; c.lineWidth = 2.2;
            c.beginPath(); c.moveTo(L - 3, 0); c.lineTo(L + 1, 0); c.stroke();              // grip
            c.strokeStyle = w.color; c.lineWidth = 2.2;
            c.beginPath(); c.moveTo(L + 1, 0); c.quadraticCurveTo(L + 8, s * 2.5, L + 13, 0); c.stroke(); // curved fang
            c.fillStyle = w.color;
            c.beginPath(); c.moveTo(L + 12, s * 1.2); c.lineTo(L + 16, 0); c.lineTo(L + 12, -s * 1.2); c.closePath(); c.fill();
            c.restore();
          }
        } else {                                  // shortsword: blade, crossguard, grip, pommel
          c.strokeStyle = '#6a5030'; c.lineWidth = 2.5;
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

  // #220 the recolour a TEAMMATE should paint this champion with: the evolution
  // palette takes over the robes at stage 2+, exactly like the owner's own screen.
  function evoPalFor(p) {
    if (Math.min(4, p.evoCount || 0) < 2) return null;
    const dom = p.dominantStat ? p.dominantStat() : null;
    return (dom && EVO_PAL[dom]) || null;
  }

  return { Player, T, CLASSES, classById, RACES, raceById, FORMS, formById, setForm, drawFormHead, capeAt, peerWeapon, classFeature, drawClassPortrait, drawRacePortrait, drawRaceFeature, evoPalFor };
})();
