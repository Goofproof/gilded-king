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
  let lastRecvT = 0, kaTimer = null; // #219 keepalive: detect half-open sockets
  // #221 (co-op review Phase C) the RELIABLE EVENT BUS. send() is fire-and-forget: a
  // message sent during a reconnect gap simply vanishes (a lost 'floor' split the
  // party; a lost 'revive' left a player dead forever). sendR() gives an event three
  // guarantees, with no server changes (the relay stays a dumb pipe):
  //   1. sent-while-disconnected is BUFFERED and delivered after the reconnect
  //   2. everything from the last 30s is REPLAYED after every reconnect (covers
  //      messages that died in flight when the old socket closed)
  //   3. receivers DEDUP by (sender session id, per-session sequence number), so a
  //      replayed duplicate is dropped, never applied twice
  // This is the shape of Azure Web PubSub's reliable subprotocol boiled down to a
  // dumb-relay world: monotonic seq + high-water-mark, replay instead of ack.
  let busSeq = 0;
  let busBuf = [];                                        // [{at, obj}] recent reliable sends
  const busId = 'b' + Math.random().toString(36).slice(2, 10); // this page-session's identity
  let busSeen = {};                                       // sender busId -> highest seq applied
  const BUS_KEEP_MS = 30000, BUS_KEEP_N = 200; // 30s covers the full 6-retry reconnect chain (~17s) with margin

  function busTrim() {
    const cut = Date.now() - BUS_KEEP_MS;
    while (busBuf.length && (busBuf[0].at < cut || busBuf.length > BUS_KEEP_N)) busBuf.shift();
  }

  function sendR(obj) {
    obj._u = busId; obj._s = ++busSeq;
    busBuf.push({ at: Date.now(), obj });
    busTrim();
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }
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
    // #210 (co-op review P0-2) retire any previous socket COMPLETELY. Before this, a
    // superseded socket stayed open and kept dispatching into the shared handlers:
    // two live sessions for one player, every message delivered twice (double damage,
    // double xp) and the client rendering a clone of itself from its own echoed 'p'.
    if (ws) {
      try { ws.onmessage = null; ws.onclose = null; ws.onerror = null; ws.onopen = null; ws.close(); } catch (e) { }
      ws = null;
    }
    ws = new WebSocket(wsUrl(roomCode));
    ws.onopen = () => { retries = 0; lastRecvT = Date.now(); emit('open'); };
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
      lastRecvT = Date.now(); // #219 any traffic proves the pipe is alive
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      // #221 bus dedup: a replayed reliable event we already applied is dropped here,
      // before any game handler can double-apply it
      if (m._u && m._s) {
        if ((busSeen[m._u] || 0) >= m._s) return;
        busSeen[m._u] = m._s;
      }
      switch (m.t) {
        case 'welcome':
          myId = m.id; hostId = m.host;
          (m.peers || []).forEach(p => peers.add(p));
          emit('change');
          // #221 bus replay: re-deliver every recent reliable event (30s window). Peers
          // that already got one drop the duplicate by its sequence number; peers that
          // missed it (it died with the old socket) finally receive it.
          busTrim();
          for (const e of busBuf) { try { ws.send(JSON.stringify(e.obj)); } catch (er) { } }
          break;
        case 'peer-join': peers.add(m.id); emit('change'); break;
        case 'peer-leave': peers.delete(m.id); emit('change'); break;
        case 'host': hostId = m.id; emit('change'); break;
      }
      const h = handlers[m.t];
      if (h) h(m);
    };
  }

  // #219 (co-op review) keepalive. A WiFi drop or NAT timeout can leave the socket
  // HALF-OPEN: readyState still 1, but nothing arrives. Without traffic, nobody
  // notices until the 12s game watchdog. So: ping every 4s (peers ignore unknown
  // types; the relay echoes to the other side, which is itself traffic), and if
  // NOTHING has arrived for 9s while we think we're connected with peers present,
  // close the socket ourselves - that trips onclose and the normal auto-reconnect.
  // #223 tear the socket down LOCALLY and reconnect NOW. ws.close() alone waits for
  // the server's answering close frame - and if that never comes (or comes slowly),
  // the socket hangs in CLOSING and the onclose-driven retry never fires. Our own
  // deliberate closes must never depend on the other end cooperating.
  function forceReopen() {
    if (intentional || !roomCode) return;
    const old = ws;
    ws = null;
    if (old) { try { old.onmessage = null; old.onclose = null; old.onerror = null; old.onopen = null; old.close(); } catch (e) { } }
    emit('close');
    myId = null; hostId = null; peers.clear(); // the fresh welcome repopulates
    openSocket();
  }

  function keepaliveTick() {
    if (intentional || !roomCode) return;
    if (ws && ws.readyState === 1) {
      if (peers.size > 0) {
        try { ws.send(JSON.stringify({ t: 'ping' })) } catch (e) { }
        if (Date.now() - lastRecvT > 9000) {
          forceReopen(); // #223 silent half-open pipe: reconnect NOW, no handshake to wait on
        }
      } else {
        lastRecvT = Date.now(); // alone in the room: silence is expected, don't count it
      }
    }
  }

  function connect(code) {
    intentional = false; retries = 0;
    busBuf = []; busSeen = {}; // #221 a fresh room starts with a clean bus (reconnects skip connect(), keeping the buffer)
    if (!kaTimer) kaTimer = setInterval(keepaliveTick, 4000); // #219
    // #210 a pending auto-reconnect from a PREVIOUS attempt must die here, or it fires
    // seconds later and opens a second parallel session to the room.
    if (reTimer) { clearTimeout(reTimer); reTimer = null; }
    roomCode = code.toUpperCase();
    myId = null; hostId = null; peers.clear();
    openSocket();
  }

  return {
    host() { const code = makeCode(); connect(code); return code; },
    join(code) { connect(code); return code; },
    disconnect() { intentional = true; if (reTimer) { clearTimeout(reTimer); reTimer = null; } if (kaTimer) { clearInterval(kaTimer); kaTimer = null; } if (ws) { try { ws.close(); } catch { } ws = null; } peers.clear(); myId = hostId = roomCode = null; },
    send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); },
    sendR,  // #221 reliable: buffered while disconnected, replayed on reconnect, deduped by receivers
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
