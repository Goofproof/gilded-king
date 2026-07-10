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
  const table = {
    swing:    () => { noise(0.09, 0.25, 'bandpass', 900, 2400); },
    heavy:    () => { noise(0.16, 0.4, 'bandpass', 300, 1400); tone('square', 120, 60, 0.01, 0.12, 0.25); },
    hit:      () => { noise(0.06, 0.3, 'highpass', 1000, 3000); tone('square', 220, 90, 0.005, 0.06, 0.2); },
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
    crit:     () => { noise(0.08, 0.35, 'highpass', 2000, 5000); tone('square', 900, 300, 0.005, 0.09, 0.2); },
    burn:     () => { noise(0.12, 0.12, 'bandpass', 1200, 600); },
  };

  return {
    ensure,
    play(name) { if (ctx && !muted && table[name]) table[name](); },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('drl_muted', muted ? '1' : '0'); } catch { }
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
  };
})();
