#!/usr/bin/env node
// ============================================================================
// announce-test.mjs - fire ONE test post at the Discord webhook, to confirm
// patch-note announcements are wired up.  `npm run announce:test`
//
// The webhook is a SECRET: it is read from the DISCORD_WEBHOOK_URL env var or a
// gitignored root `.env` (DISCORD_WEBHOOK_URL=...). It never lives in the repo.
// This posts a clearly-labelled TEST embed, not a real patch-notes announcement.
// ============================================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function discordWebhook() {
  if (process.env.DISCORD_WEBHOOK_URL) return process.env.DISCORD_WEBHOOK_URL.trim();
  try {
    const env = readFileSync(join(ROOT, '.env'), 'utf8');
    const m = env.match(/^\s*DISCORD_WEBHOOK_URL\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].replace(/^['"]|['"]$/g, '').trim();
  } catch { /* no .env */ }
  return null;
}

const url = discordWebhook();
if (!url) {
  console.error('\n  No DISCORD_WEBHOOK_URL found. Put it in a gitignored .env at the repo root:');
  console.error("      Add-Content -Path .env -Value 'DISCORD_WEBHOOK_URL=<your webhook url>'\n");
  process.exit(1);
}

const payload = {
  username: 'Barrowlight',
  embeds: [{
    title: 'Barrowlight webhook test',
    description: 'If you can see this in the channel, patch-note announcements are wired up correctly. Every ship that cuts a new patch-notes entry will post here automatically.',
    url: 'https://barrowlight.io/',
    color: 0xc9a227,
  }],
};

const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
if (res.ok) {
  console.log('\n  Test post sent (HTTP ' + res.status + '). Check the Discord channel.\n');
} else {
  console.error('\n  Webhook POST failed: HTTP ' + res.status + ' ' + (await res.text().catch(() => '')) + '\n');
  process.exit(1);
}
