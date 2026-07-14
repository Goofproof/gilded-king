// ============================================================================
// net.js - client networking for co-op (Sam, 2026-07-11). Milestone 1: connect
// to the Cloudflare relay, join/host a lobby by code, track peers + who is host.
//
// This module is pure transport: it knows nothing about the game. main.js wires
// game messages through Net.on(type, fn) / Net.send({t, ...}). The HOST client
// is authoritative for the shared world; Net just tells you whether you're it.
//
// Relay URL: on localhost we talk to `wrangler dev` (http://localhost:8787);
// otherwise the deployed Worker. Override anytime with:
//   localStorage.setItem('drl_mp_url', 'https://gilded-king-mp.<you>.workers.dev')
// ============================================================================
const Net = (() => {
  // deployed Cloudflare Worker (from `npx wrangler deploy`, 2026-07-11)
  const DEPLOYED_URL = 'https://gilded-king-mp.sam-221.workers.dev';

  function relayBase() {
    try { const o = localStorage.getItem('drl_mp_url'); if (o) return o; } catch { }
    const host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8787';
    return DEPLOYED_URL;
  }

  let ws = null;
  let myId = null, hostId = null, roomCode = null;
  let intentional = false, retries = 0, reTimer = null; // auto-reconnect state
  const peers = new Set();
  const handlers = {};        // type -> fn(msg)
  const lifecycle = {};       // 'open'|'close'|'error'|'change' -> fn

  function emit(name, arg) { const f = lifecycle[name]; if (f) f(arg); }

  function wsUrl(code) {
    return relayBase().replace(/^http/, 'ws').replace(/\/$/, '') + '/room/' + code;
  }

  // 4-letter room code, easy to read aloud (no confusable chars)
  function makeCode() {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 4; i++) s += alphabet[(Math.random() * alphabet.length) | 0];
    return s;
  }

  // open (or re-open) the socket to the CURRENT roomCode. On an unintentional close
  // it auto-reconnects to the same room with backoff (up to 6 tries), keeping the
  // client's local game state, so a brief WiFi blip self-heals instead of freezing
  // or kicking the player to the menu.
  function openSocket() {
    ws = new WebSocket(wsUrl(roomCode));
    ws.onopen = () => { retries = 0; emit('open'); };
    ws.onclose = () => {
      emit('close');
      if (!intentional && roomCode && retries < 6) {
        retries++;
        if (reTimer) clearTimeout(reTimer);
        reTimer = setTimeout(() => {
          if (intentional || !roomCode) return;
          myId = null; hostId = null; peers.clear(); // a fresh welcome will repopulate
          openSocket();
        }, Math.min(600 + retries * 600, 4000));
      }
    };
    ws.onerror = e => emit('error', e);
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      switch (m.t) {
        case 'welcome':
          myId = m.id; hostId = m.host;
          (m.peers || []).forEach(p => peers.add(p));
          emit('change');
          break;
        case 'peer-join': peers.add(m.id); emit('change'); break;
        case 'peer-leave': peers.delete(m.id); emit('change'); break;
        case 'host': hostId = m.id; emit('change'); break;
      }
      const h = handlers[m.t];
      if (h) h(m);
    };
  }

  function connect(code) {
    intentional = false; retries = 0;
    roomCode = code.toUpperCase();
    myId = null; hostId = null; peers.clear();
    openSocket();
  }

  return {
    host() { const code = makeCode(); connect(code); return code; },
    join(code) { connect(code); return code; },
    disconnect() { intentional = true; if (reTimer) { clearTimeout(reTimer); reTimer = null; } if (ws) { try { ws.close(); } catch { } ws = null; } peers.clear(); myId = hostId = roomCode = null; },
    send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); },
    on(type, fn) { handlers[type] = fn; },
    // testing only: feed a message through the real handler path, as if it arrived
    // from a peer. Lets the dbg harness exercise co-op receive logic single-client.
    _dispatch(m) { const h = handlers[m.t]; if (h) h(m); },
    onLifecycle(name, fn) { lifecycle[name] = fn; },
    get id() { return myId; },
    get hostId() { return hostId; },
    get isHost() { return myId !== null && myId === hostId; },
    get peers() { return peers; },
    get code() { return roomCode; },
    get playerCount() { return peers.size + (myId ? 1 : 0); },
    get connected() { return !!ws && ws.readyState === 1; },
    relayBase,
  };
})();
