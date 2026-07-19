// CO-OP IDENTITY COLOURS (Sam): each player owns a distinct colour so a 2-4 player
// party can tell itself apart at a glance. The colour is a SLOT (rank of the stable uid
// within the sorted party set), NOT a hash - so it must be (a) identical on every screen
// for the same party, and (b) collision-free for realistic party sizes. These guard both.
import { describe, it, expect } from 'vitest';
import { loadGame } from './harness.js';

const { PlayerDef } = loadGame();

// a fake game object shaped like the one partySlotColor reads: clientId + remotePlayers map
const gameWith = (myId, peerUids) => ({
  clientId: myId,
  remotePlayers: new Map(peerUids.map((u, i) => [`peer${i}`, { u }])),
});

describe('co-op identity colours', () => {
  it('every player in a 4-party gets a DISTINCT colour (no birthday collisions)', () => {
    const uids = ['c-me-xyz', 'uidAAAA', 'uidBBBB', 'uidCCCC'];
    const g = gameWith(uids[0], uids.slice(1));
    const cols = uids.map(u => PlayerDef.partySlotColor(g, u));
    expect(new Set(cols).size, `colours collided: ${cols.join(',')}`).toBe(4);
  });

  it('is CONSISTENT across screens - each screen computes the same colour per player', () => {
    const uids = ['aaa', 'mmm', 'zzz'];
    // three players, each sees the OTHER two as peers + itself as clientId
    const screens = uids.map(me => gameWith(me, uids.filter(u => u !== me)));
    // the colour assigned to 'mmm' must be the same on all three screens
    const forMmm = screens.map(g => PlayerDef.partySlotColor(g, 'mmm'));
    expect(new Set(forMmm).size, `mmm got different colours per screen: ${forMmm}`).toBe(1);
    // and every player-colour agrees screen-to-screen
    for (const target of uids) {
      const seen = screens.map(g => PlayerDef.partySlotColor(g, target));
      expect(new Set(seen).size, `${target} inconsistent: ${seen}`).toBe(1);
    }
  });

  it('order-independent: colour depends on the uid SET, not join order', () => {
    const a = gameWith('bob', ['ann', 'cal']);
    const b = gameWith('bob', ['cal', 'ann']); // same set, peers listed in reverse
    expect(PlayerDef.partySlotColor(a, 'bob')).toBe(PlayerDef.partySlotColor(b, 'bob'));
    expect(PlayerDef.partySlotColor(a, 'ann')).toBe(PlayerDef.partySlotColor(b, 'ann'));
  });

  it('falls back safely with no game / unknown uid (never throws)', () => {
    expect(() => PlayerDef.partySlotColor(null, 'x')).not.toThrow();
    const g = gameWith('me', []);
    expect(typeof PlayerDef.partySlotColor(g, 'stranger')).toBe('string');
  });
});
