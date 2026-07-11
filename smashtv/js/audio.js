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
    buy:      () => { tone('sine', 900, 1400, 0.005, 0.1, 0.2); tone('sine', 1400, 2000, 0.005, 0.12, 0.15, 0.08); },
    error:    () => { tone('square', 160, 120, 0.01, 0.15, 0.2); },
    explode:  () => { noise(0.4, 0.5, 'lowpass', 2000, 60); tone('square', 90, 30, 0.01, 0.35, 0.3); },
    mimic:    () => { tone('sawtooth', 500, 90, 0.02, 0.35, 0.35); noise(0.3, 0.25, 'bandpass', 400, 1800); },
    roar:     () => { tone('sawtooth', 140, 50, 0.05, 0.7, 0.45); noise(0.7, 0.3, 'lowpass', 900, 100); tone('sawtooth', 95, 40, 0.05, 0.8, 0.3, 0.1); },
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
    // --- SMASH ARENA TV: game-show flavor -----------------------------------
    kaching:  () => { // cash register: clack + two bright bells
      noise(0.03, 0.25, 'highpass', 4000, 6000);
      tone('sine', 1568, 1568, 0.005, 0.18, 0.22, 0.02);
      tone('sine', 2093, 2093, 0.005, 0.22, 0.18, 0.09);
    },
    cheer:    () => { // crowd roar swell
      noise(0.7, 0.16, 'bandpass', 700, 2600);
      noise(0.5, 0.08, 'highpass', 3000, 5000, 0.1);
    },
    // announcer barks: rhythmic shouted "syllables" (square+saw), text sells the words
    bark:     () => { [300, 300, 250].forEach((f, i) => { tone('square', f, f * 0.8, 0.02, 0.12, 0.24, i * 0.16); tone('sawtooth', f * 0.5, f * 0.45, 0.02, 0.12, 0.12, i * 0.16); }); },
    barkBig:  () => { [240, 360].forEach((f, i) => { tone('square', f, f * 0.85, 0.02, 0.14, 0.28, i * 0.2); tone('sawtooth', f * 0.5, f * 0.46, 0.02, 0.14, 0.14, i * 0.2); }); },
    barkBuy:  () => { // "I'D BUY THAT FOR A DOL-LAR!" - 7 beats, punchy finish
      const seq = [220, 270, 250, 250, 230, 330, 200];
      seq.forEach((f, i) => {
        const last = i === seq.length - 1;
        tone('square', f, f * (last ? 0.7 : 0.85), 0.02, last ? 0.3 : 0.11, last ? 0.34 : 0.24, i * 0.15);
        tone('sawtooth', f * 0.5, f * 0.45, 0.02, last ? 0.3 : 0.11, last ? 0.18 : 0.12, i * 0.15);
      });
    },
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
    // SMASH ARENA TV: every "floor" is a TV studio - crowd bed + upbeat synth,
    // and the Host heckles you between the action.
    const crowdBed = (vol) => noiseBed(1400, vol); // murmuring audience
    const hostHeckle = (minS, maxS) => every(minS, maxS, () => {
      const bark = [[300, 300, 250], [240, 360], [280, 240, 300, 220]][(Math.random() * 3) | 0];
      bark.forEach((f, i) => { tone('square', f, f * 0.82, 0.02, 0.12, 0.16, i * 0.16); tone('sawtooth', f * 0.5, f * 0.45, 0.02, 0.12, 0.08, i * 0.16); });
    });
    if (theme === 'studioA') {
      crowdBed(0.035);
      every(9, 16, () => noise(0.6, 0.06, 'bandpass', 900, 2400)); // scattered applause
      hostHeckle(22, 45);
      // MUSIC: bright, bouncy game-show synth in C major, four-on-the-floor feel
      phraseLoop(() => {
        const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
        const step = 0.2, bars = 16;
        let t = 0;
        for (let i = 0; i < bars; i++) {
          const f = scale[(Math.random() * scale.length) | 0] * (Math.random() < 0.25 ? 2 : 1);
          tone('square', f, f, 0.005, 0.17, 0.03, t);
          if (i % 4 === 0) { tone('sine', 130.81, 130.81, 0.01, 0.18, 0.06, t); noise(0.05, 0.05, 'lowpass', 200, 80, t); } // kick
          t += step;
        }
        return t;
      });
    } else if (theme === 'dome') {
      crowdBed(0.045);
      drone('sawtooth', 65.41, 0.03, 260); // throbbing bass
      every(6, 12, () => noise(0.7, 0.08, 'bandpass', 700, 2200)); // rowdier crowd
      hostHeckle(16, 34);
      // MUSIC: driving minor synth pulse - the danger ramps up
      phraseLoop(() => {
        const scale = [261.63, 311.13, 349.23, 392.0, 466.16]; // C minor-ish
        const step = 0.16, bars = 16;
        let t = 0;
        for (let i = 0; i < bars; i++) {
          const f = scale[(Math.random() * scale.length) | 0];
          tone('square', f, f, 0.004, 0.13, 0.03, t);
          tone('sine', 65.41, 65.41, 0.01, 0.14, 0.05, t); // pulsing bass on every beat
          if (i % 2 === 0) noise(0.04, 0.06, 'lowpass', 220, 90, t); // kick
          t += step;
        }
        return t;
      });
    } else if (theme === 'stage') {
      crowdBed(0.05);
      every(5, 10, () => Sfx && noise(0.8, 0.1, 'bandpass', 700, 2600)); // huge crowd
      hostHeckle(12, 26);
      // MUSIC: triumphant brassy fanfare loop - the final show
      phraseLoop(() => {
        const line = [392.0, 392.0, 523.25, 659.25, 523.25, 587.33]; // G G C E C D
        const noteLen = 0.34;
        line.forEach((f, i) => {
          tone('sawtooth', f, f, 0.02, noteLen * 0.85, 0.035, i * noteLen);   // brass lead
          tone('sawtooth', f * 0.5, f * 0.5, 0.02, noteLen * 0.85, 0.02, i * noteLen); // octave under
          tone('sine', 130.81, 130.81, 0.01, noteLen * 0.8, 0.05, i * noteLen); // bass
        });
        return line.length * noteLen;
      });
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
