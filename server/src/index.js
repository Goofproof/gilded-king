// ============================================================================
// Gilded King co-op relay - Cloudflare Worker + Durable Object (Sam, 2026-07-11).
//
// One Durable Object == one lobby, keyed by the room code (idFromName(code)).
// It is a thin WebSocket relay: it tracks who is in the room, designates a HOST
// (the first to join, with migration if the host leaves), and forwards every
// game message to the other members. All game logic stays on the clients; the
// HOST client is authoritative for the shared world (enemies, dungeon, loot).
//
// Message shape (JSON): { t: <type>, ...payload }. The relay stamps `from` (the
// sender's player id) on anything it forwards. Control types the relay itself
// sends: welcome / peer-join / peer-leave / host. Everything else is opaque
// game traffic that it just fans out.
// ============================================================================

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...CORS } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    // health check / friendly root
    if (parts.length === 0) {
      return new Response('Gilded King relay is up. WebSocket -> /room/<CODE>. Leaderboard -> /scores.', {
        headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' },
      });
    }

    // /room/<CODE> -> route to the Durable Object for that lobby
    if (parts[0] === 'room' && parts[1]) {
      const code = parts[1].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      if (!code) return new Response('bad room code', { status: 400 });
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      return stub.fetch(request);
    }

    // /scores -> the single global leaderboard Durable Object (GET top 50, POST a score)
    if (parts[0] === 'scores') {
      const id = env.LEADERBOARD.idFromName('global');
      return env.LEADERBOARD.get(id).fetch(request);
    }

    return new Response('not found', { status: 404 });
  },
};

// #133 THE LOADOUT, on the global board (Sam: "I want to know what the top scorers
// are using to get the top score").
//
// The client builds a full death snapshot including a base64 PNG of the champion, and
// the board used to throw ALL of it away - it rebuilt each entry from initials/score/
// floor/won and nothing else, which is why a global score had no snapshot to open.
//
// We do NOT store the avatar up here. A Durable Object value caps at 128KB and the
// PNG is several KB each; a hundred of them would blow the limit and take the whole
// leaderboard down with it. The avatar stays local. What goes global is the part Sam
// actually asked for: what they were RUNNING. That is a few hundred bytes.
//
// Everything below is attacker-controlled. Cap every string and every array, coerce
// every number, and keep nothing we did not ask for.
const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
const strs = (v, n, len) => Array.isArray(v) ? v.slice(0, n).map(x => str(x, len)).filter(Boolean) : [];
function slimSnap(s) {
  if (!s || typeof s !== 'object') return null;
  const sp = {};
  if (s.statPoints && typeof s.statPoints === 'object') {
    for (const k of ['MIGHT', 'VIGOR', 'AGILITY', 'ARCANE', 'FORTUNE']) {
      const v = s.statPoints[k];
      if (typeof v === 'number' && isFinite(v)) sp[k] = Math.max(0, Math.min(99, v | 0));
    }
  }
  return {
    cls: str(s.cls, 16),          // so the viewer can draw the class crest in place of the portrait
    className: str(s.className, 24),
    level: Math.max(0, Math.min(999, s.level | 0)),
    kills: Math.max(0, Math.min(99999, s.kills | 0)),
    prestige: Math.max(0, Math.min(99, s.prestige | 0)),
    maxHp: Math.max(0, Math.min(99999, s.maxHp | 0)),
    weapons: strs(s.weapons, 2, 64),
    armor: str(s.armor, 64) || null,
    evos: strs(s.evos, 8, 40),
    q: str(s.q, 32) || null,
    r: str(s.r, 32) || null,
    ult: str(s.ult, 32) || null,
    statPoints: sp,
  };
}

// A single Durable Object holds the global top-100 scores in persistent storage.
export class Leaderboard {
  // env, so we can read the ADMIN_KEY secret. Set it with:
  //     npx wrangler secret put ADMIN_KEY -c server/wrangler.toml
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(request) {
    // ---------------------------------------------------------------- ADMIN
    // DELETE /scores, authenticated with the ADMIN_KEY secret in an x-admin-key
    // header. Removes ONE entry by exact (initials, score) match.
    //
    // This exists because I tested the loadout field against production instead of
    // `wrangler dev` and left a junk row on Sam's real board. The obvious fix - a
    // plain unauthenticated purge - would have been a hole anyone on the internet
    // could reach, which is a far worse thing than the row it was cleaning up. So it
    // is gated on a secret that lives only in Cloudflare, and it fails CLOSED: no
    // secret configured means no deletes, ever.
    if (request.method === 'DELETE') {
      const key = this.env && this.env.ADMIN_KEY;
      if (!key) return json({ error: 'no ADMIN_KEY configured - deletes are disabled' }, 503);
      const given = request.headers.get('x-admin-key') || '';
      // constant-time-ish: compare full length, never bail early on first mismatch
      let ok = given.length === key.length;
      for (let i = 0; i < key.length; i++) ok = ok && given.charCodeAt(i) === key.charCodeAt(i);
      if (!ok) return json({ error: 'forbidden' }, 403);

      let b; try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
      const ini = String(b.initials || '').toUpperCase();
      const sc = Math.round(Number(b.score));
      if (!ini || !isFinite(sc)) return json({ error: 'need {initials, score}' }, 400);

      let list = (await this.state.storage.get('scores')) || [];
      const before = list.length;
      list = list.filter(x => !(x.initials === ini && x.score === sc));
      await this.state.storage.put('scores', list);
      return json({ removed: before - list.length, top: list.slice(0, 50) });
    }

    if (request.method === 'POST') {
      let s; try { s = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
      if (!s || typeof s.score !== 'number' || !isFinite(s.score)) return json({ error: 'bad score' }, 400);
      const entry = {
        initials: String(s.initials || 'AAA').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'AAA',
        score: Math.max(0, Math.min(1e9, Math.round(s.score))),
        floor: Math.max(0, Math.min(999, s.floor | 0)),
        won: !!s.won,
        snap: slimSnap(s.snap),   // what they were actually RUNNING
        t: Date.now(),
      };
      let list = (await this.state.storage.get('scores')) || [];
      list.push(entry);
      list.sort((a, b) => b.score - a.score);
      list = list.slice(0, 100);
      await this.state.storage.put('scores', list);
      return json({ ok: true, rank: list.indexOf(entry) + 1, top: list.slice(0, 50) });
    }
    const list = (await this.state.storage.get('scores')) || [];
    return json({ top: list.slice(0, 50) });
  }
}

export class Room {
  constructor(state, env) {
    this.state = state;
    this.sessions = new Map(); // ws -> { id }
    this.hostId = null;
    this.nextId = 1;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected a websocket upgrade', { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.accept(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  accept(ws) {
    ws.accept();
    const id = 'p' + (this.nextId++);
    const firstIn = this.hostId === null;
    if (firstIn) this.hostId = id;
    this.sessions.set(ws, { id });

    // greet the newcomer: who they are, whether they host, and the current roster
    const peers = [];
    for (const s of this.sessions.values()) if (s.id !== id) peers.push(s.id);
    this.sendTo(ws, { t: 'welcome', id, isHost: id === this.hostId, host: this.hostId, peers });

    // announce them to everyone already here
    this.broadcast({ t: 'peer-join', id }, ws);

    ws.addEventListener('message', ev => {
      let msg;
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      msg.from = id;                 // stamp the sender; clients trust this, not self-reported ids
      this.broadcast(msg, ws);       // fan out to the other members
    });

    const bye = () => this.onClose(ws);
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);
  }

  onClose(ws) {
    const s = this.sessions.get(ws);
    if (!s) return;
    this.sessions.delete(ws);
    this.broadcast({ t: 'peer-leave', id: s.id });

    // host migration: promote the next remaining member if the host dropped
    if (this.hostId === s.id) {
      const next = this.sessions.values().next().value;
      this.hostId = next ? next.id : null;
      if (this.hostId) this.broadcast({ t: 'host', id: this.hostId });
    }
  }

  sendTo(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch { /* socket already gone */ }
  }

  broadcast(obj, except) {
    const data = JSON.stringify(obj);
    for (const ws of this.sessions.keys()) {
      if (ws === except) continue;
      try { ws.send(data); } catch { /* drop dead sockets silently */ }
    }
  }
}
