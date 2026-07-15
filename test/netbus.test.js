// net.js: the transport layer's guarantees, tested against a SCRIPTED WebSocket
// (no relay needed). Covers the co-op review's transport fixes:
//   #210 a superseded socket is fully retired (no double-dispatch)
//   #219 keepalive pings + silence-triggered reconnect (via forceReopen, #223)
//   #221 reliable bus: sendR buffers while disconnected, replays on welcome,
//        receivers dedup by (busId, seq) so a replay never double-applies
// net.js is browser-coupled (WebSocket/localStorage/location), so it is loaded
// via new Function with shims - the same trick as the live bus_test.mjs harness.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js', 'net.js'), 'utf8');

// a fully scripted stand-in: tests open/close it and inject messages by hand
class FakeWS {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.sent = [];
    this.onopen = null; this.onclose = null; this.onerror = null; this.onmessage = null;
    FakeWS.instances.push(this);
  }
  send(d) { if (this.readyState !== 1) throw new Error('not open'); if (this.blackhole) return; this.sent.push(JSON.parse(d)); }
  close() { if (this.readyState === 3) return; this.readyState = 3; if (this.onclose) this.onclose({ code: 1000 }); }
  // test drivers
  _open() { this.readyState = 1; if (this.onopen) this.onopen(); }
  _recv(obj) { if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) }); }
  // TRUE half-open: readyState stays 1 (we still think it's alive), but everything
  // sent vanishes and nothing arrives. Exactly the WiFi-drop/NAT-timeout case.
  _dieSilently() { this.blackhole = true; }
}

function makeNet() {
  FakeWS.instances = [];
  const f = new Function('WebSocket', 'localStorage', 'location', SRC + '\nreturn Net;');
  return f(FakeWS, { getItem: () => 'http://fake', setItem: () => { } }, { hostname: 'test' });
}

let Net;
beforeEach(() => { vi.useFakeTimers(); Net = makeNet(); });
afterEach(() => { vi.useRealTimers(); });

function connectAndWelcome(id = 'p1', peers = ['p2']) {
  const code = Net.host();
  const ws = FakeWS.instances.at(-1);
  ws._open();
  ws._recv({ t: 'welcome', id, host: id, peers });
  return { code, ws };
}

describe('#221 the reliable event bus', () => {
  it('sendR while connected sends immediately, stamped with busId + seq', () => {
    const { ws } = connectAndWelcome();
    Net.sendR({ t: 'kill', to: 'p2' });
    const m = ws.sent.find(x => x.t === 'kill');
    expect(m).toBeTruthy();
    expect(m._u).toBeTruthy();
    expect(m._s).toBe(1);
  });

  it('an event sent into a half-open pipe is REPLAYED after the keepalive reconnects', () => {
    const { ws } = connectAndWelcome();
    ws._dieSilently();                 // half-open: sends vanish, nothing arrives
    Net.sendR({ t: 'floor', floor: 3 });
    expect(ws.sent.some(x => x.t === 'floor')).toBe(false); // lost in the pipe
    vi.advanceTimersByTime(12100);     // keepalive: silence > 9s with peers -> forceReopen
    const cur = FakeWS.instances.at(-1);
    expect(cur).not.toBe(ws);          // Net opened a NEW socket on its own
    cur._open();
    cur._recv({ t: 'welcome', id: 'p3', host: 'p3', peers: ['p2'] });
    const replayed = cur.sent.find(x => x.t === 'floor');
    expect(replayed).toBeTruthy();     // the lost event was re-delivered
    expect(replayed.floor).toBe(3);
  });

  it('receivers DEDUP a replayed event by (busId, seq): applied exactly once', () => {
    const { ws } = connectAndWelcome();
    const got = [];
    Net.on('bustest', m => got.push(m));
    const evt = { t: 'bustest', _u: 'zpeer', _s: 5 };
    ws._recv(evt);
    ws._recv(evt); // replay duplicate
    expect(got.length).toBe(1);
    // a LATER seq from the same sender still gets through
    ws._recv({ t: 'bustest', _u: 'zpeer', _s: 6 });
    expect(got.length).toBe(2);
    // an OLDER seq (out-of-window replay) is dropped
    ws._recv({ t: 'bustest', _u: 'zpeer', _s: 4 });
    expect(got.length).toBe(2);
  });

  it('joining a NEW room clears the buffer: old-room events never leak in', () => {
    const { ws } = connectAndWelcome();
    ws._dieSilently();
    Net.sendR({ t: 'gameover' });      // buffered, undelivered
    Net.join('ZZZZ');                  // fresh room -> connect() clears the bus
    const ws2 = FakeWS.instances.at(-1);
    ws2._open();
    ws2._recv({ t: 'welcome', id: 'p1', host: 'p1', peers: [] });
    expect(ws2.sent.some(x => x.t === 'gameover')).toBe(false);
  });
});

describe('#219/#223 keepalive', () => {
  it('pings every 4s while connected with peers', () => {
    const { ws } = connectAndWelcome();
    vi.advanceTimersByTime(4100);
    expect(ws.sent.filter(x => x.t === 'ping').length).toBeGreaterThanOrEqual(1);
  });

  it('alone in the room: no silence-close (silence is expected)', () => {
    const { ws } = connectAndWelcome('p1', []); // no peers
    vi.advanceTimersByTime(30000);
    expect(FakeWS.instances.at(-1)).toBe(ws); // never replaced
  });

  it('9s of silence with peers present forces a NEW socket (no close handshake needed)', () => {
    const { ws } = connectAndWelcome();
    vi.advanceTimersByTime(10000); // ticks at 4s and 8s ping; by 12s silence > 9s
    vi.advanceTimersByTime(4000);
    const cur = FakeWS.instances.at(-1);
    expect(cur).not.toBe(ws);       // forceReopen tore down and reopened
    expect(ws.onmessage).toBe(null); // #210 the old socket was fully retired
  });

  it('traffic resets the silence clock: an active pipe is never torn down', () => {
    const { ws } = connectAndWelcome();
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(5000);
      ws._recv({ t: 'ping', from: 'p2' }); // peer traffic every 5s
    }
    expect(FakeWS.instances.at(-1)).toBe(ws);
  });
});

describe('#210 socket retirement', () => {
  it('an intentional disconnect closes the socket and stops the keepalive', () => {
    const { ws } = connectAndWelcome();
    Net.disconnect();
    expect(ws.readyState).toBe(3);
    const count = FakeWS.instances.length;
    vi.advanceTimersByTime(60000);
    expect(FakeWS.instances.length).toBe(count); // no zombie reconnects, no pings
  });
});
