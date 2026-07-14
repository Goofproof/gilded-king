#!/usr/bin/env node
// ============================================================================
// patchnotes.mjs - generate the next in-game patch-notes entry from git.
//
// WHY: the notes kept falling behind. v2.13 shipped and then ~14 more commits
// went live (a whole landing-page redesign, two new enemies, a pile of balance
// work) with no entry, because bumping the version was a manual step you had to
// remember at the exact moment you were done and wanting to push.
//
// HOW: js/patchnotes.js NOTES[0].sha records the commit the newest entry
// shipped at. Everything after it is unreleased. This reads those commits,
// turns each subject into a player-facing item, bumps VERSION, and unshifts the
// new entry stamped with the current HEAD.
//
//   npm run notes -- --title "Headline"    write the entry
//   npm run notes -- --dry                 print it, change nothing
//   npm run notes -- --major               v2.13 -> v3.0 instead of v2.14
//
// A commit is left OUT of the notes if its subject starts with a chore prefix
// (see SKIP) or contains [skip-notes]. Commit subjects become player-facing
// text, so write them for a player: "#128: Doppelganger - a shade that copies
// you" lands well; "refactor spawn table" gets skipped.
// ============================================================================
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'js', 'patchnotes.js');

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();

const argv = process.argv.slice(2);
const flag = n => argv.includes(n);
const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };

// chore commits a player does not care about
const SKIP = /^(patch notes|notes|chore|test|tests|docs?|refactor|wip|merge|revert|bump|ci)\b|\[skip-notes\]/i;
// the files that actually change the GAME (a docs-only commit is not a release)
const GAME = /^(js\/|index\.html|style\.css|assets\/|server\/)/;

const src = readFileSync(FILE, 'utf8');
const EOL = src.includes('\r\n') ? '\r\n' : '\n';

const curVer = src.match(/const VERSION = '(v[\d.]+)';/)?.[1];
const curSha = src.match(/sha: '([0-9a-f]{7,40})'/)?.[1];
if (!curVer) throw new Error('could not read VERSION from js/patchnotes.js');
if (!curSha) throw new Error('NOTES[0] has no `sha` - add sha to the newest entry so I know where to start');

// --- what shipped since the last entry --------------------------------------
const log = git('log', `${curSha}..HEAD`, '--format=%H%x1f%s', '--reverse');
const commits = log ? log.split('\n').map(l => { const [sha, subject] = l.split('\x1f'); return { sha, subject }; }) : [];

const touchesGame = sha =>
  git('show', '--name-only', '--format=', sha).split('\n').some(f => GAME.test(f.trim()));

const items = [];
for (const c of commits) {
  if (SKIP.test(c.subject)) continue;
  if (!touchesGame(c.sha)) continue;
  // strip the issue-tracker prefix: "#128 (part 2): Doppelganger - ..." -> "Doppelganger - ..."
  let s = c.subject.replace(/^#\d+[^:]*:\s*/, '').replace(/^([a-z-]+):\s*/i, m => /^(fix|feat)/i.test(m) ? '' : m);
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?]$/.test(s)) s += '.';
  items.push(s);
}

if (!items.length) {
  console.log(`No unreleased game changes since ${curVer} (${curSha}). Nothing to write.`);
  process.exit(0);
}

// A patch-notes popup is something a 12-year-old reads in ten seconds. If the
// backlog is this big the notes were left to rot (v2.14 caught 86 items across
// 87 commits) - generate it anyway, but say so, because it needs a human edit.
if (items.length > 15) {
  console.warn(`\n  ! ${items.length} items from ${commits.length} commits - too many to read.`);
  console.warn(`  ! Ship the notes more often. Curate this entry down by hand before you push.\n`);
}

// --- the new entry -----------------------------------------------------------
const [maj, min] = curVer.slice(1).split('.').map(Number);
const newVer = flag('--major') ? `v${maj + 1}.0` : `v${maj}.${min + 1}`;
const title = opt('--title') || 'Fixes & Improvements';
const date = new Date().toISOString().slice(0, 10);
const head = git('rev-parse', '--short', 'HEAD');
const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const entry = [
  `    {`,
  `      v: '${newVer}', title: '${esc(title)}', date: '${date}',`,
  `      sha: '${head}',`,
  `      items: [`,
  ...items.map(i => `        '${esc(i)}',`),
  `      ],`,
  `    },`,
].join(EOL);

if (flag('--dry')) {
  console.log(`${curVer} (${curSha}) -> ${newVer} (${head}), ${items.length} item(s):${EOL}`);
  console.log(entry);
  process.exit(0);
}

const out = src
  .replace(/const VERSION = 'v[\d.]+';/, `const VERSION = '${newVer}';`)
  .replace(/(const NOTES = \[\r?\n)/, `$1${entry}${EOL}`);
if (out === src) throw new Error('could not splice the new entry - has js/patchnotes.js changed shape?');
writeFileSync(FILE, out);

console.log(`${curVer} -> ${newVer}  "${title}"  (${items.length} items from ${commits.length} commits)`);
for (const i of items) console.log(`  - ${i}`);
console.log(`${EOL}Edit js/patchnotes.js if any item needs rewording, then commit.`);
