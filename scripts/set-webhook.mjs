#!/usr/bin/env node
// ============================================================================
// set-webhook.mjs - store the Discord webhook in a gitignored .env and fire a
// test post, in one step.  Run:
//     node scripts/set-webhook.mjs '<your webhook url>'
//
// The URL is the LAST argument on the line on purpose: paste it at the end and
// there is nothing after it to accidentally delete. The value is masked in the
// output, never printed in full, and .env is gitignored (never committed).
// ============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV = join(ROOT, '.env');
const url = (process.argv[2] || '').trim();

if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/\S+/.test(url)) {
  console.error('\n  That does not look like a Discord webhook URL.');
  console.error('  Expected: https://discord.com/api/webhooks/<id>/<token>');
  console.error("  Usage:    node scripts/set-webhook.mjs '<your webhook url>'\n");
  process.exit(1);
}

// upsert the key: drop any existing DISCORD_WEBHOOK_URL line, then add the new one,
// so re-running replaces rather than duplicates.
let lines = existsSync(ENV) ? readFileSync(ENV, 'utf8').split(/\r?\n/) : [];
lines = lines.filter(l => l && !/^\s*DISCORD_WEBHOOK_URL\s*=/.test(l));
lines.push('DISCORD_WEBHOOK_URL=' + url);
writeFileSync(ENV, lines.join('\n') + '\n');

const masked = url.slice(0, 43) + '...' + url.slice(-4);
console.log('\n  Saved DISCORD_WEBHOOK_URL to .env  (' + masked + ')');

const payload = {
  username: 'Barrowlight',
  embeds: [{
    title: 'Barrowlight webhook test',
    description: 'If you can see this in the channel, patch-note announcements are wired up. Every ship that cuts a new patch-notes entry will post here automatically.',
    url: 'https://barrowlight.io/',
    color: 0xc9a227,
  }],
};

try {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  if (res.ok) console.log('  Test post sent (HTTP ' + res.status + '). Check your Discord channel.\n');
  else console.log('  Saved, but the test POST failed (HTTP ' + res.status + '). The webhook may be wrong or deleted.\n');
} catch (e) {
  console.log('  Saved, but the test POST errored (' + e.message + '). Check your connection / the webhook.\n');
}
