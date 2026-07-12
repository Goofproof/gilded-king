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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    // health check / friendly root
    if (parts.length === 0) {
      return new Response('Gilded King co-op relay is up. Connect a WebSocket to /room/<CODE>.', {
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

    return new Response('not found', { status: 404 });
  },
};

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
