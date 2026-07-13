// ============================================================================
// audio.js - all sound effects synthesized with the Web Audio API (no assets).
// Sfx.play('name') from anywhere. M toggles mute (persisted in localStorage).
// ============================================================================
const Sfx = (() => {
  let ctx = null, master = null;
  // storage can THROW in sandboxed iframes / all-cookies-blocked profiles -
  // sound preferences just won't persist there
  let muted = false;
  try { muted = localStorage.getItem('drl_muted') === '1'; } catch { }

  function ensure() {
    // AudioContext must be created/resumed after a user gesture; called on first input.
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  // --- tiny synth helpers -------------------------------------------------
  function env(node, t0, a, peak, d, end = 0.0001) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.linearRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(end, t0 + a + d);
  }
  // one oscillator blip: type, start freq, end freq, attack, decay, volume
  function tone(type, f0, f1, a, d, vol, delay = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + a + d);
    env(g, t0, a, vol, d);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + a + d + 0.05);
  }
  // white-noise burst through a filter: for hits, explosions, whooshes
  function noise(dur, vol, filterType, f0, f1, delay = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = filterType;
    fl.frequency.setValueAtTime(f0, t0);
    fl.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t0 + dur);
    const g = ctx.createGain();
    env(g, t0, 0.005, vol, dur);
    src.connect(fl); fl.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // --- the sound table ------------------------------------------------------
  // v() gives every hit a +/-10% pitch wobble so rapid attacks don't machine-gun
  const v = () => 0.9 + Math.random() * 0.2;
  const table = {
    swing:    () => { noise(0.09, 0.25, 'bandpass', 900, 2400); },
    heavy:    () => { noise(0.16, 0.4, 'bandpass', 300, 1400); tone('square', 120, 60, 0.01, 0.12, 0.25); },
    // impact family: the sound tells you WHAT connected
    hit:      () => { const k = v(); noise(0.06, 0.3, 'highpass', 1000 * k, 3000); tone('triangle', 300 * k, 110, 0.005, 0.08, 0.22); }, // generic (enemy-on-enemy, fallback)
    hitLight: () => { const k = v(); noise(0.05, 0.34, 'bandpass', 2600 * k, 900); tone('triangle', 950 * k, 320, 0.004, 0.06, 0.2); }, // crisp slice
    hitHeavy: () => { const k = v();
      tone('sine', 115 * k, 42, 0.005, 0.17, 0.55);              // deep body thud
      noise(0.13, 0.45, 'lowpass', 900 * k, 140);                // meat
      noise(0.04, 0.22, 'highpass', 1900, 3600);                 // bone-crunch snap
    },
    hitArrow: () => { const k = v(); noise(0.045, 0.36, 'highpass', 2300 * k, 700); tone('square', 430 * k, 170, 0.004, 0.07, 0.22); }, // woody thock
    hurt:     () => { tone('sawtooth', 200, 70, 0.01, 0.18, 0.35); noise(0.12, 0.2, 'lowpass', 800, 200); },
    kill:     () => { tone('square', 300, 40, 0.01, 0.2, 0.25); noise(0.15, 0.25, 'lowpass', 1200, 100); },
    coin:     () => { tone('sine', 1100, 1600, 0.005, 0.09, 0.18); tone('sine', 1650, 2200, 0.005, 0.08, 0.12, 0.05); },
    pickup:   () => { tone('triangle', 500, 900, 0.01, 0.12, 0.2); tone('triangle', 750, 1350, 0.01, 0.12, 0.15, 0.06); },
    heal:     () => { tone('sine', 400, 800, 0.02, 0.25, 0.22); tone('sine', 600, 1200, 0.02, 0.25, 0.15, 0.08); },
    roll:     () => { noise(0.14, 0.22, 'bandpass', 500, 2500); },
    bowdraw:  () => { noise(0.18, 0.1, 'bandpass', 300, 900); tone('sine', 150, 260, 0.15, 0.05, 0.06); },
    bowfire:  () => { noise(0.07, 0.3, 'highpass', 1500, 4000); tone('square', 700, 200, 0.005, 0.07, 0.12); },
    door:     () => { tone('square', 90, 55, 0.01, 0.3, 0.3); noise(0.25, 0.15, 'lowpass', 500, 80); },
    unlock:   () => { tone('triangle', 350, 700, 0.01, 0.15, 0.2); tone('triangle', 520, 1050, 0.01, 0.15, 0.16, 0.1); },
    levelup:  () => { [440, 554, 659, 880].forEach((f, i) => tone('triangle', f, f, 0.01, 0.22, 0.2, i * 0.09)); },
    mythic:   () => { // #123 a grand ascending fanfare for a mythic drop
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.01, 0.4, 0.22, i * 0.09));
      tone('sine', 262, 262, 0.03, 1.1, 0.12);            // sustained root under it
      tone('square', 784, 1568, 0.01, 0.5, 0.08, 0.42);   // a bright rising sparkle at the top
    },
    buy:      () => { tone('sine', 900, 1400, 0.005, 0.1, 0.2); tone('sine', 1400, 2000, 0.005, 0.12, 0.15, 0.08); },
    error:    () => { tone('square', 160, 120, 0.01, 0.15, 0.2); },
    explode:  () => { noise(0.4, 0.5, 'lowpass', 2000, 60); tone('square', 90, 30, 0.01, 0.35, 0.3); },
    mimic:    () => { tone('sawtooth', 500, 90, 0.02, 0.35, 0.35); noise(0.3, 0.25, 'bandpass', 400, 1800); },
    roar:     () => { tone('sawtooth', 140, 50, 0.05, 0.7, 0.45); noise(0.7, 0.3, 'lowpass', 900, 100); tone('sawtooth', 95, 40, 0.05, 0.8, 0.3, 0.1); },
    // death touch (Executioner instakill proc): an ominous low toll + a bright
    // metallic ring on top, so a "free kill" reads instantly as something special
    deathtouch: () => {
      tone('sine', 180, 55, 0.005, 0.5, 0.4);                 // deep, sinking toll
      tone('triangle', 1320, 880, 0.004, 0.35, 0.22, 0.02);   // bright bell overtone
      tone('sine', 660, 440, 0.004, 0.3, 0.18, 0.02);         // ringing fifth
      noise(0.14, 0.3, 'highpass', 3000, 6000, 0.01);         // a cold shiver of steel
    },
    stairs:   () => { [300, 240, 190, 150].forEach((f, i) => tone('triangle', f, f * 0.9, 0.01, 0.18, 0.2, i * 0.11)); },
    ui:       () => { tone('sine', 700, 900, 0.005, 0.06, 0.12); },
    upgrade:  () => { [523, 659, 784].forEach((f, i) => tone('sine', f, f, 0.01, 0.2, 0.18, i * 0.07)); },
    crit:     () => { const k = v();
      noise(0.09, 0.4, 'highpass', 2000 * k, 5000);              // bright snap
      tone('square', 900 * k, 300, 0.005, 0.09, 0.22);
      tone('sawtooth', 480 * k, 110, 0.005, 0.14, 0.3);          // falling bite
      tone('sine', 95 * k, 45, 0.005, 0.12, 0.35);               // low weight
    },
    burn:     () => { noise(0.12, 0.12, 'bandpass', 1200, 600); },
  };

  // --- per-floor ambient soundscapes (all synthesized, no assets) --------------
  let amb = { theme: null, nodes: [], timers: [], pending: null };
  function stopAmbient() {
    for (const t of amb.timers) clearTimeout(t);
    amb.timers = [];
    for (const n of amb.nodes) { try { if (n.stop) n.stop(); n.disconnect(); } catch { } }
    amb.nodes = [];
    amb.theme = null;
  }
  function applyAmbient() {
    const theme = amb.pending;
    if (theme === amb.theme || !ctx) return;
    stopAmbient();
    amb.theme = theme;
    if (!theme) return;
    const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(master); amb.nodes.push(bus);
    const noiseBed = (freq, vol) => {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = freq;
      const gn = ctx.createGain(); gn.gain.value = vol;
      src.connect(fl); fl.connect(gn); gn.connect(bus);
      src.start();
      amb.nodes.push(src, fl, gn);
    };
    const drone = (type, f, vol, lp) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp || 400;
      const gn = ctx.createGain(); gn.gain.value = vol;
      o.connect(fl); fl.connect(gn); gn.connect(bus);
      o.start();
      amb.nodes.push(o, fl, gn);
    };
    const every = (minS, maxS, fn) => {
      const loop = () => {
        if (amb.theme !== theme || muted) { if (amb.theme === theme) amb.timers.push(setTimeout(loop, 2000)); return; }
        fn();
        amb.timers.push(setTimeout(loop, (minS + Math.random() * (maxS - minS)) * 1000));
      };
      amb.timers.push(setTimeout(loop, 500 + Math.random() * maxS * 500));
    };
    // MUSIC: fn schedules one phrase of notes (via tone delays) and returns its
    // length in seconds; we re-invoke just before it ends for a continuous loop
    const phraseLoop = (fn) => {
      const loop = () => {
        if (amb.theme !== theme) return;
        let dur = 2;
        if (!muted) dur = fn();
        amb.timers.push(setTimeout(loop, Math.max(400, dur * 1000 - 120)));
      };
      amb.timers.push(setTimeout(loop, 900));
    };
    if (theme === 'forest') {
      noiseBed(300, 0.05); // wind through leaves
      every(2.5, 7, () => { // birdsong: quick rising chirps
        const base = 2100 + Math.random() * 1300;
        const n = 2 + ((Math.random() * 3) | 0);
        for (let i = 0; i < n; i++) tone('sine', base * (0.9 + Math.random() * 0.2), base * 1.18, 0.02, 0.08, 0.05, i * 0.11);
      });
      // APEX PREDATOR: a distant wolf, once or twice a floor
      every(35, 75, () => {
        tone('sine', 340, 520, 0.35, 0.25, 0.055);          // rise
        tone('sine', 500, 240, 0.05, 1.4, 0.05, 0.55);      // long mournful fall
        tone('sine', 470, 230, 0.05, 1.2, 0.028, 0.75);     // packmate echoes, further off
      });
      // MUSIC: sparse folk plucks in D minor pentatonic, wandering like a path
      phraseLoop(() => {
        const scale = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33];
        const step = 0.44;
        let t = 0;
        for (let i = 0; i < 8; i++) {
          if (Math.random() < 0.65) {
            const f = scale[(Math.random() * scale.length) | 0] * (Math.random() < 0.2 ? 0.5 : 1);
            tone('triangle', f, f, 0.01, 0.55, 0.042, t);
          }
          t += step;
        }
        return t;
      });
    } else if (theme === 'swamp') {
      noiseBed(170, 0.055); // thick murk
      drone('sine', 52, 0.035, 300); // something large breathing below
      every(3, 8, () => tone('sine', 240 + Math.random() * 140, 70, 0.02, 0.24, 0.08)); // bloop
      every(5, 12, () => noise(0.5, 0.028, 'bandpass', 4300, 3700)); // insect hiss
      // APEX PREDATOR: a bull hippo bellows from the deep water
      every(30, 65, () => {
        tone('sawtooth', 90, 55, 0.06, 0.8, 0.09);
        noise(0.5, 0.06, 'lowpass', 400, 120);
        tone('sawtooth', 80, 60, 0.04, 0.35, 0.07, 0.9);   // second grunt
        tone('sawtooth', 75, 58, 0.04, 0.3, 0.05, 1.25);   // third, shorter
      });
      // MUSIC: slow doomy bass ostinato with the occasional wrong-feeling note
      phraseLoop(() => {
        const line = [73.42, 87.31, 65.41, 73.42]; // D2 F2 C2 D2
        const noteLen = 1.7;
        line.forEach((f, i) => {
          const wrong = Math.random() < 0.12;
          tone('sine', wrong ? f * 1.414 : f, f * 0.99, 0.08, noteLen * 0.9, 0.055, i * noteLen);
          tone('triangle', f * 1.5, f * 1.5, 0.1, noteLen * 0.5, 0.014, i * noteLen + 0.3); // ghost fifth
        });
        return line.length * noteLen;
      });
    } else if (theme === 'castle') {
      drone('sawtooth', 55, 0.017, 220);   // detuned regal drone
      drone('sawtooth', 55.7, 0.017, 220);
      noiseBed(120, 0.03); // vast cold hall
      every(7, 15, () => tone('sine', 660, 650, 0.5, 1.4, 0.03)); // distant bell
      // APEX PREDATOR: the court is conniving - whispers and a sly, low chuckle
      every(28, 55, () => {
        noise(0.3, 0.035, 'bandpass', 3200, 1800);          // whisper wisp
        noise(0.25, 0.03, 'bandpass', 2600, 1400, 0.4);     // answering whisper
        tone('square', 300, 280, 0.02, 0.09, 0.03, 0.9);    // heh
        tone('square', 260, 240, 0.02, 0.09, 0.03, 1.08);   // heh
        tone('square', 220, 190, 0.02, 0.12, 0.03, 1.26);   // hehh
      });
      // MUSIC: baroque harpsichord arpeggios - Am G F E, the court dances on
      phraseLoop(() => {
        const chords = [
          [220.0, 261.63, 329.63, 440.0],   // Am
          [196.0, 246.94, 293.66, 392.0],   // G
          [174.61, 220.0, 261.63, 349.23],  // F
          [164.81, 207.65, 246.94, 329.63], // E
        ];
        const noteLen = 0.15, perChord = 8;
        let t = 0;
        for (const ch of chords) {
          tone('triangle', ch[0] / 2, ch[0] / 2, 0.02, noteLen * perChord * 0.9, 0.03, t); // bass root
          for (let i = 0; i < perChord; i++) {
            const f = ch[i % 4] * (i >= 4 ? 2 : 1);
            tone('square', f, f, 0.005, 0.14, 0.016, t + i * noteLen);
          }
          t += noteLen * perChord;
        }
        return t;
      });
    } else if (theme === 'inferno') {
      drone('sawtooth', 40, 0.03, 150);   // subterranean magma rumble
      drone('sawtooth', 40.7, 0.02, 150); // detuned, uneasy
      noiseBed(95, 0.05);                  // the roar of the great fire
      every(1.6, 4.5, () => noise(0.4, 0.03, 'bandpass', 2000 + Math.random() * 900, 1300)); // fire crackle
      // APEX PREDATOR: the wails of the damned, somewhere far below
      every(24, 50, () => {
        tone('sawtooth', 230, 90, 0.05, 1.3, 0.05);
        tone('sawtooth', 185, 70, 0.04, 1.1, 0.04, 0.65);
        noise(0.6, 0.04, 'lowpass', 500, 200, 0.3);
      });
      // MUSIC: a grim dirge in low A that no longer just loops one bar. It rotates
      // through several bass phrases and lays a sparse, wandering melody on top from
      // a dark (A phrygian) scale, so the Descent theme keeps evolving (#33).
      const BASS = [
        [110.00, 103.83, 98.00, 92.50],   // original descending
        [110.00, 116.54, 98.00, 87.31],   // dip to a low E
        [98.00, 92.50, 103.83, 110.00],   // climb back to the tonic
        [116.54, 110.00, 98.00, 87.31],   // heavier fall
        [110.00, 98.00, 92.50, 98.00],    // rock between A and F#
      ];
      const MEL = [220.00, 233.08, 261.63, 293.66, 329.63, 349.23, 392.00]; // A phrygian, up an octave
      phraseLoop(() => {
        amb.infPhrase = ((amb.infPhrase || 0) + 1) % BASS.length;
        const line = BASS[amb.infPhrase];
        const noteLen = 1.35;
        let lastMel = -9;
        line.forEach((f, i) => {
          tone('sawtooth', f, f * 0.98, 0.06, noteLen * 0.9, 0.03, i * noteLen);
          tone('triangle', f * 1.5, f * 1.5, 0.08, noteLen * 0.4, 0.012, i * noteLen + 0.2); // ghost fifth
          // sparse wandering melody: a note stepwise-ish from the scale, not every beat
          if (Math.random() < 0.55) {
            let idx = lastMel < 0 ? (Math.random() * MEL.length) | 0 : Math.max(0, Math.min(MEL.length - 1, lastMel + ((Math.random() * 3) | 0) - 1));
            lastMel = idx;
            const mf = MEL[idx];
            tone('sine', mf, mf, 0.04, noteLen * 0.55, 0.018, i * noteLen + 0.5 + Math.random() * 0.35);
          }
        });
        return line.length * noteLen;
      });
      // a slow bell that tolls from the deep every so often, for gravitas
      every(11, 22, () => { tone('sine', 55, 55, 0.02, 3.2, 0.05); tone('sine', 110, 108, 0.02, 2.4, 0.02, 0.05); });
    }
  }

  return {
    ensure,
    play(name) { if (ctx && !muted && table[name]) table[name](); },
    setAmbient(theme) { amb.pending = theme; if (ctx) applyAmbient(); },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('drl_muted', muted ? '1' : '0'); } catch { }
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
  };
})();
