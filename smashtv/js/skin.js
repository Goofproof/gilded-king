// ============================================================================
// skin.js - SMASH ARENA TV reskin layer (parody/homage of Williams' Smash TV,
// 1990). Loads before ui.js/main.js. Holds the game-show strings, the Host
// announcer artwork, and the neon-studio backdrop used by the intro + title.
//
// The engine underneath is "Dungeon of the Gilded King" (designed by Sam's son);
// this is a bonus skin, not a replacement. Only cosmetics + the intro cutscene
// change - every mechanic is identical.
// ============================================================================
const Skin = (() => {

  // --- show config (the words on screen) ------------------------------------
  const SHOW = {
    titleTop: 'SMASH',
    titleBig: 'ARENA TV',
    tagline: '~ BIG MONEY! BIG PRIZES! I LOVE IT! ~',
    startLabel: 'ENTER THE ARENA',
    creditsLabel: 'FAME',            // was ESSENCE (meta currency)
    bossName: 'THE HOST',
    bossSub: 'the grand prize was a lie',
    clearText: 'STUDIO CLEARED!',
    // announcer barks, cycled for flavor (also the intro payoff line)
    hostLines: ['BIG MONEY!', 'BIG PRIZES!', 'TOTAL CARNAGE!', "GOOD LUCK!", "I LOVE IT!"],
  };

  // neon palette
  const NEON = { pink: '#ff2d95', cyan: '#00e5ff', gold: '#ffd23f', purple: '#b14bff', lime: '#7CFC00' };

  // --- studio backdrop: dark stage, scanlines, sweeping spotlights ----------
  function drawStudioBg(c, W, H, t) {
    c.fillStyle = '#0a0512';
    c.fillRect(0, 0, W, H);
    // back wall glow
    const g = c.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, W * 0.7);
    g.addColorStop(0, 'rgba(60,10,60,0.55)');
    g.addColorStop(1, 'rgba(10,5,18,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // sweeping spotlights
    for (let i = 0; i < 3; i++) {
      const a = Math.sin(t * 0.7 + i * 2.1) * 0.5;
      const cx = W / 2 + (i - 1) * 230;
      c.save();
      c.globalAlpha = 0.13;
      c.fillStyle = [NEON.cyan, NEON.pink, NEON.gold][i];
      c.beginPath();
      c.moveTo(cx, -20);
      c.lineTo(cx - 120 + a * 240, H + 20);
      c.lineTo(cx + 120 + a * 240, H + 20);
      c.closePath();
      c.fill();
      c.restore();
    }
    // scanlines (CRT)
    c.globalAlpha = 0.06;
    c.fillStyle = '#000';
    for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
    c.globalAlpha = 1;
  }

  // --- THE HOST: a slick, grinning game-show announcer (canvas primitives) --
  // t drives a subtle bob + a mic-raise on demand (talking>0 opens the grin).
  function drawHost(c, x, y, s, t, talking = 0) {
    c.save();
    c.translate(x, y + Math.sin(t * 3) * 3 * s);

    // gold suit torso
    c.fillStyle = '#e0a92e';
    c.beginPath();
    c.moveTo(-34 * s, 90 * s); c.lineTo(-26 * s, 20 * s);
    c.lineTo(26 * s, 20 * s); c.lineTo(34 * s, 90 * s);
    c.closePath(); c.fill();
    // lapels
    c.fillStyle = '#b9861f';
    c.beginPath(); c.moveTo(-4 * s, 22 * s); c.lineTo(-20 * s, 26 * s); c.lineTo(-6 * s, 70 * s); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(4 * s, 22 * s); c.lineTo(20 * s, 26 * s); c.lineTo(6 * s, 70 * s); c.closePath(); c.fill();
    // shirt + bowtie
    c.fillStyle = '#f6f0e0';
    c.beginPath(); c.moveTo(-6 * s, 22 * s); c.lineTo(6 * s, 22 * s); c.lineTo(3 * s, 60 * s); c.lineTo(-3 * s, 60 * s); c.closePath(); c.fill();
    c.fillStyle = NEON.pink;
    c.beginPath(); c.moveTo(0, 26 * s); c.lineTo(-8 * s, 22 * s); c.lineTo(-8 * s, 30 * s); c.closePath();
    c.moveTo(0, 26 * s); c.lineTo(8 * s, 22 * s); c.lineTo(8 * s, 30 * s); c.closePath(); c.fill();

    // neck + head
    c.fillStyle = '#d8a878';
    c.fillRect(-7 * s, 6 * s, 14 * s, 14 * s);
    c.fillStyle = '#e7bd90';
    c.beginPath(); c.ellipse(0, -10 * s, 20 * s, 24 * s, 0, 0, Math.PI * 2); c.fill();
    // slicked black hair
    c.fillStyle = '#141018';
    c.beginPath(); c.arc(0, -20 * s, 20 * s, Math.PI, Math.PI * 2); c.fill();
    c.fillRect(-20 * s, -22 * s, 40 * s, 8 * s);
    c.fillStyle = '#2a2230';
    c.beginPath(); c.ellipse(-8 * s, -26 * s, 8 * s, 4 * s, -0.4, 0, Math.PI * 2); c.fill(); // shine

    // sunglasses
    c.fillStyle = '#0a0a12';
    c.fillRect(-16 * s, -14 * s, 13 * s, 8 * s);
    c.fillRect(3 * s, -14 * s, 13 * s, 8 * s);
    c.fillRect(-4 * s, -12 * s, 8 * s, 2 * s);
    c.fillStyle = NEON.cyan; c.globalAlpha = 0.6;
    c.fillRect(-14 * s, -13 * s, 4 * s, 2 * s);
    c.fillRect(5 * s, -13 * s, 4 * s, 2 * s);
    c.globalAlpha = 1;

    // enormous grin (opens with talking)
    const open = 2 * s + talking * 6 * s;
    c.fillStyle = '#3a1a1a';
    c.beginPath(); c.ellipse(0, 2 * s, 12 * s, open, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    for (let i = -2; i <= 2; i++) c.fillRect(i * 4 * s - 1.5 * s, -1 * s, 3 * s, Math.max(2 * s, open * 0.7));

    // microphone in hand
    c.strokeStyle = '#333'; c.lineWidth = 3 * s;
    c.beginPath(); c.moveTo(22 * s, 60 * s); c.lineTo(30 * s, 20 * s); c.stroke();
    c.fillStyle = '#555';
    c.beginPath(); c.arc(31 * s, 14 * s, 7 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#888';
    c.beginPath(); c.arc(31 * s, 14 * s, 4 * s, 0, Math.PI * 2); c.fill();

    c.restore();
  }

  return { SHOW, NEON, drawStudioBg, drawHost };
})();
