#!/usr/bin/env node
// ============================================================================
// publish.mjs - the whole ship-it sequence in one command.
//
//   npm run ship -- --title "Headline"
//
// 1. npm test            (the suite guards co-op seed determinism)
// 2. generate the patch-notes entry from the commits since the last one
// 3. commit js/patchnotes.js
// 4. push master -> origin/main (GitHub Pages serves that branch at root)
//
// Add --dry to see what would ship without touching anything.
// ============================================================================
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, mkdirSync, copyFileSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// shell:true ONLY for npm (it is npm.cmd on Windows and needs one). Never for node
// or git: with shell:true the args are re-joined WITHOUT quoting, so an argument
// containing spaces - like a patch-notes title, or a commit message - is torn into
// separate tokens. That shipped a patch note titled "The" once.
const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: cmd === 'npm' && process.platform === 'win32' });
const out = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }).trim();

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');

if (out('git', ['status', '--porcelain'])) {
  console.error('\n  Working tree is dirty. Commit your work first - publish only writes the notes commit.\n');
  process.exit(1);
}

console.log('\n=== 1/4  tests ===');
run('npm', ['test']);

console.log('\n=== 2/4  patch notes ===');
run('node', [join(ROOT, 'scripts', 'patchnotes.mjs'), ...argv]);
if (dry) { console.log('\n--dry: stopping before commit.\n'); process.exit(0); }

let newEntry = null;
if (!out('git', ['status', '--porcelain'])) {
  console.log('\n  No new notes entry this push (changes are accumulating for a bigger update, or nothing unreleased). Pushing code as-is.\n');
} else {
  const pn = readFileSync(join(ROOT, 'js', 'patchnotes.js'), 'utf8');
  const ver = pn.match(/const VERSION = '(v[\d.]+)';/)[1];
  const title = pn.match(/title: '([^']*)'/)[1];
  newEntry = { ver, title };
  console.log('\n=== 3/4  commit ===');
  run('git', ['add', 'js/patchnotes.js']);
  run('git', ['commit', '-m', `Patch notes ${ver} - ${title}`]);
}

console.log('\n=== 4/4  push ===');
// A plain fast-forward is the normal case and cannot clobber anyone. Only reach
// for `git push origin master:main --force-with-lease` by hand if history really
// has diverged - don't make force the default here.
run('git', ['push', 'origin', 'master:main']);
console.log('\n  Live in ~1-3 min at https://goofproof.github.io/barrowlight/ (hard-refresh to bust cache).\n');

console.log('=== 5/5  Cloudflare Pages (barrowlight.io) ===');
deployCloudflare();

// A NEW patch-notes entry just published - announce it to the Discord server.
if (newEntry) await announceDiscord(newEntry);

// #329 (Sam) The barrowlight.io Pages project is DIRECT-UPLOAD (not git-connected), so a GitHub
// push does NOT update it - it must be deployed explicitly or the custom domain silently goes
// stale. That hid the Discord button AND a door fix from real players for a whole session. Build
// a clean runtime dir (no node_modules/tests/server) and push it. NEVER fails the ship - GitHub
// Pages is already live by the time this runs. Needs `wrangler` to be logged in (it is, for Sam).
function deployCloudflare() {
  const wrangler = join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const staging = join(ROOT, '.cf-deploy');
  try {
    rmSync(staging, { recursive: true, force: true });
    mkdirSync(staging, { recursive: true });
    for (const f of ['index.html', 'manifest.webmanifest']) copyFileSync(join(ROOT, f), join(staging, f));
    for (const dir of ['js', 'assets', 'music']) cpSync(join(ROOT, dir), join(staging, dir), { recursive: true });
    execFileSync(process.execPath, [wrangler, 'pages', 'deploy', staging, '--project-name', 'barrowlight', '--branch', 'main'], { cwd: ROOT, stdio: 'inherit' });
    console.log('  barrowlight.io updated.');
  } catch (e) {
    console.log(`  Cloudflare deploy skipped/failed (${e.message}). GitHub Pages is already live; refresh barrowlight.io by hand with: npx wrangler pages deploy <dir> --project-name barrowlight --branch main`);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// #328 (Sam) DISCORD ANNOUNCE: post the newest patch-notes entry to the server.
// Fires ONLY when a new entry actually published this run. The webhook is a SECRET
// and never lives in the repo: it is read from the DISCORD_WEBHOOK_URL env var or a
// gitignored root `.env` (DISCORD_WEBHOOK_URL=...). No webhook, or a failed post, is a
// silent NO-OP - the ship already succeeded by the time this runs, so it can't break it.
function discordWebhook() {
  if (process.env.DISCORD_WEBHOOK_URL) return process.env.DISCORD_WEBHOOK_URL.trim();
  try {
    const env = readFileSync(join(ROOT, '.env'), 'utf8');
    const m = env.match(/^\s*DISCORD_WEBHOOK_URL\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].replace(/^['"]|['"]$/g, '').trim();
  } catch { /* no .env - fine */ }
  return null;
}
async function announceDiscord({ ver, title }) {
  const url = discordWebhook();
  if (!url) { console.log('  Discord announce skipped (no DISCORD_WEBHOOK_URL configured - see scripts/publish.mjs header).'); return; }
  const pn = readFileSync(join(ROOT, 'js', 'patchnotes.js'), 'utf8');
  const m = pn.match(/items: \[([\s\S]*?)\n\s*\],/); // NOTES[0] is first, so this is the newest entry
  const items = m ? [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1].replace(/\\'/g, "'")) : [];
  const payload = {
    username: 'Barrowlight',
    embeds: [{
      title: `Barrowlight ${ver} - ${title}`,
      description: (items.map(i => '• ' + i).join('\n') || 'A new update is live.').slice(0, 3900),
      url: 'https://barrowlight.io/',
      color: 0xc9a227, // the game's gold
    }],
  };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) console.log(`  Announced ${ver} to Discord.`);
    else console.log(`  Discord announce failed (HTTP ${res.status}) - the ship still went through fine.`);
  } catch (e) {
    console.log(`  Discord announce error (${e.message}) - the ship still went through fine.`);
  }
}
