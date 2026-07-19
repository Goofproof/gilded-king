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
import { readFileSync } from 'node:fs';
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

if (!out('git', ['status', '--porcelain'])) {
  console.log('\n  No new notes entry this push (changes are accumulating for a bigger update, or nothing unreleased). Pushing code as-is.\n');
} else {
  const ver = readFileSync(join(ROOT, 'js', 'patchnotes.js'), 'utf8').match(/const VERSION = '(v[\d.]+)';/)[1];
  const title = readFileSync(join(ROOT, 'js', 'patchnotes.js'), 'utf8').match(/title: '([^']*)'/)[1];
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
