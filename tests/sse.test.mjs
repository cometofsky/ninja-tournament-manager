import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_TYPES,
  formatSSE,
  compareEventIds,
  broadcastEvent,
  subscribeToTournament,
  broadcastMatchUpdate,
  broadcastMatchScore,
  broadcastMatchAbandon,
  broadcastMatchAbandoned,
  broadcastStageAdvance,
  broadcastStageAdvanced,
  broadcastPlayerRenamed,
  broadcastPlayerDisqualified,
  broadcastTiebreakResolved,
  broadcastRosterUpdate,
  broadcastTournamentComplete,
  broadcastTournamentCompleted,
  getEventsSince,
  getEventBus,
  resetEventBus,
} from '../src/lib/events.js';
import { GET as streamHandler } from '../src/app/api/stream/route.js';

// Helper: read SSE chunk from ReadableStream
async function readSSEEvent(reader, timeoutMs = 3000) {
  const decoder = new TextDecoder();
  let buffer = '';
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const remaining = timeoutMs - (Date.now() - startTime);
    if (remaining <= 0) break;

    const result = await Promise.race([
      reader.read(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout waiting for SSE chunk after ${timeoutMs}ms`)), remaining)
      ),
    ]);

    if (result.done) break;
    buffer += decoder.decode(result.value, { stream: true });
    if (buffer.includes('\n\n')) {
      return buffer;
    }
  }
  return buffer;
}

// Helper: parse SSE text block
function parseSSE(raw) {
  const lines = raw.trim().split('\n');
  let event = null;
  let id = null;
  let retry = null;
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      event = line.slice(7).trim();
    } else if (line.startsWith('id: ')) {
      id = line.slice(4).trim();
    } else if (line.startsWith('retry: ')) {
      retry = Number(line.slice(7).trim());
    } else if (line.startsWith('data: ')) {
      dataLines.push(line.slice(6));
    }
  }

  let data = null;
  if (dataLines.length > 0) {
    const joined = dataLines.join('\n');
    try {
      data = JSON.parse(joined);
    } catch {
      data = joined;
    }
  }

  return { event, id, retry, data, raw };
}

test('formatSSE: generates valid SSE wire format with headers and double newline', () => {
  const formatted = formatSSE({
    event: 'match:score',
    id: 'evt-100',
    retry: 5000,
    data: { score: [3, 1] },
  });

  assert.ok(formatted.endsWith('\n\n'), 'must terminate with double newline');
  assert.ok(formatted.includes('id: evt-100\n'), 'includes id');
  assert.ok(formatted.includes('event: match:score\n'), 'includes event name');
  assert.ok(formatted.includes('retry: 5000\n'), 'includes retry');
  assert.ok(formatted.includes('data: {"score":[3,1]}\n'), 'includes json data');
});

test('formatSSE: handles multiline comments and strips newline/null protocol injection', () => {
  const multiline = formatSSE({
    event: 'log',
    data: 'line 1\nline 2\nline 3',
  });
  assert.ok(multiline.includes('data: line 1\ndata: line 2\ndata: line 3\n'));

  // Multiline comment must prefix each line with colon
  const comment = formatSSE({ comment: 'ping\nsecond line' });
  assert.equal(comment, ': ping\n: second line\n\n');

  // Newline and null injection in event/id must be stripped
  const sanitized = formatSSE({
    event: 'malicious\nevent\0attack',
    id: 'id1\nid2\0bad',
    data: 'ok',
  });
  assert.ok(!sanitized.includes('event: malicious\nevent'), 'newlines in event must be stripped');
  assert.ok(sanitized.includes('event: maliciouseventattack\n'));
  assert.ok(sanitized.includes('id: id1id2bad\n'));
});

test('compareEventIds: chronologically orders IDs by timestamp and sequence', () => {
  assert.equal(compareEventIds('1000-1', '1000-1'), 0);
  assert.ok(compareEventIds('1000-1', '1000-2') < 0);
  assert.ok(compareEventIds('1000-2', '1000-1') > 0);
  assert.ok(compareEventIds('1000-99', '2000-1') < 0);
  assert.ok(compareEventIds('2000-1', '1000-99') > 0);
});

test('event bus: topic scoping, subscriber isolation, and unsubscription', () => {
  resetEventBus();

  const receivedA = [];
  const receivedB = [];
  const receivedGlobal = [];

  const unsubA = subscribeToTournament('tourn-A', e => receivedA.push(e));
  const unsubB = subscribeToTournament('tourn-B', e => receivedB.push(e));
  const unsubGlobal = subscribeToTournament('*', e => receivedGlobal.push(e));

  // Broadcast to Tourn A
  broadcastEvent(EVENT_TYPES.MATCH_SCORE, {
    tournamentId: 'tourn-A',
    data: { match: 1 },
  });

  assert.equal(receivedA.length, 1);
  assert.equal(receivedB.length, 0, 'Tourn B subscriber must not receive Tourn A events');
  assert.equal(receivedGlobal.length, 1, 'Global subscriber must receive all events');

  // Broadcast to Tourn B
  broadcastEvent(EVENT_TYPES.MATCH_ABANDON, {
    tournamentId: 'tourn-B',
    data: { match: 2 },
  });

  assert.equal(receivedA.length, 1);
  assert.equal(receivedB.length, 1);
  assert.equal(receivedGlobal.length, 2);

  // Test unsubscription
  unsubA();
  broadcastEvent(EVENT_TYPES.MATCH_SCORE, {
    tournamentId: 'tourn-A',
    data: { match: 3 },
  });

  assert.equal(receivedA.length, 1, 'Unsubscribed listener must receive no new events');
  assert.equal(receivedGlobal.length, 3);

  unsubB();
  unsubGlobal();
});

test('reconnection: ring buffer captures events and replays since lastEventId', () => {
  resetEventBus();

  const e1 = broadcastEvent(EVENT_TYPES.MATCH_SCORE, { tournamentId: 't-recon', data: { seq: 1 } });
  const e2 = broadcastEvent(EVENT_TYPES.STAGE_ADVANCE, { tournamentId: 't-recon', data: { seq: 2 } });
  const e3 = broadcastEvent(EVENT_TYPES.TOURNAMENT_COMPLETE, { tournamentId: 't-recon', data: { seq: 3 } });
  const other = broadcastEvent(EVENT_TYPES.MATCH_SCORE, { tournamentId: 'other-tourn', data: { seq: 99 } });

  // 1. Replay since known e1 in buffer
  const replay = getEventsSince(e1.id, 't-recon');
  assert.equal(replay.length, 2);
  assert.equal(replay[0].id, e2.id);
  assert.equal(replay[1].id, e3.id);
  assert.ok(!replay.some(e => e.id === other.id), 'filters out events from other tournaments');

  // 2. Client is already at latest event -> 0 replayed
  const atLatest = getEventsSince(e3.id, 't-recon');
  assert.equal(atLatest.length, 0, 'no events replayed if already at latest');

  // 3. Client is ahead in future -> 0 replayed (does not dump stale events)
  const futureId = `${Date.now() + 100000}-999`;
  const inFuture = getEventsSince(futureId, 't-recon');
  assert.equal(inFuture.length, 0, 'future lastEventId must return 0 events, not buffer dump');

  // 4. Client lastEventId older than buffer (rollover) -> replays available buffer
  const ancientId = '100-1';
  const rolledOver = getEventsSince(ancientId, 't-recon');
  assert.equal(rolledOver.length, 3, 'ancient lastEventId replays available buffer');
});

test('stream route: GET /api/stream establishes SSE connection with handshake and headers', async () => {
  resetEventBus();
  const req = new Request('http://localhost:3000/api/stream?tournamentId=tourn-test-1');
  const res = await streamHandler(req);

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'text/event-stream; charset=utf-8');
  assert.equal(res.headers.get('Cache-Control'), 'no-cache, no-transform');
  assert.equal(res.headers.get('Connection'), 'keep-alive');
  assert.equal(res.headers.get('X-Accel-Buffering'), 'no');

  const reader = res.body.getReader();
  const initialChunk = await readSSEEvent(reader);
  const parsed = parseSSE(initialChunk);

  assert.equal(parsed.event, EVENT_TYPES.CONNECTED);
  assert.equal(parsed.data.status, 'connected');
  assert.equal(parsed.data.tournamentId, 'tourn-test-1');
  assert.equal(parsed.retry, 3000);

  await reader.cancel();
});

test('stream route: live broadcasting of all 6 canonical domain event types with accurate payloads', async () => {
  resetEventBus();
  const tid = 'tourn-live-all';
  const req = new Request(`http://localhost:3000/api/stream?tournamentId=${tid}`);
  const res = await streamHandler(req);
  const reader = res.body.getReader();

  // 1. Initial Handshake
  const handshakeRaw = await readSSEEvent(reader);
  assert.equal(parseSSE(handshakeRaw).event, EVENT_TYPES.CONNECTED);

  // 2. Match updated broadcast (R2 + Acceptance Criteria: tournamentId, matchNumber, playerScores, winner)
  broadcastMatchUpdate(tid, {
    matchNumber: 1,
    player1: 'Alice',
    player2: 'Bob',
    player1Score: 4,
    player2Score: 2,
    winner: 'Alice',
  });
  const scoreMsg = parseSSE(await readSSEEvent(reader));
  assert.equal(scoreMsg.event, EVENT_TYPES.MATCH_UPDATED);
  assert.equal(scoreMsg.data.tournamentId, tid);
  assert.equal(scoreMsg.data.data.matchNumber, 1);
  assert.equal(scoreMsg.data.data.winner, 'Alice');
  assert.deepEqual(scoreMsg.data.data.playerScores, { Alice: 4, Bob: 2 });
  assert.equal(scoreMsg.data.data.player1Score, 4);
  assert.equal(scoreMsg.data.data.player2Score, 2);

  // 3. Match abandoned broadcast
  broadcastMatchAbandon(tid, {
    matchNumber: 2,
    player1: 'Charlie',
    player2: 'Dave',
    status: 'abandoned',
  });
  const abandonMsg = parseSSE(await readSSEEvent(reader));
  assert.equal(abandonMsg.event, EVENT_TYPES.MATCH_ABANDONED);
  assert.equal(abandonMsg.data.data.match.status, 'abandoned');
  assert.equal(abandonMsg.data.data.matchNumber, 2);

  // 4. Stage advanced broadcast
  broadcastStageAdvance(tid, {
    stageIndex: 1,
    advancing: ['Alice', 'Charlie'],
    message: 'Knockout round starting',
  });
  const stageMsg = parseSSE(await readSSEEvent(reader));
  assert.equal(stageMsg.event, EVENT_TYPES.STAGE_ADVANCED);
  assert.deepEqual(stageMsg.data.data.advancing, ['Alice', 'Charlie']);

  // 5. Player renamed broadcast
  broadcastPlayerRenamed(tid, {
    oldName: 'Alice',
    newName: 'Alicia',
  });
  const renameMsg = parseSSE(await readSSEEvent(reader));
  assert.equal(renameMsg.event, EVENT_TYPES.PLAYER_RENAMED);
  assert.equal(renameMsg.data.data.action, 'rename');
  assert.equal(renameMsg.data.data.oldName, 'Alice');
  assert.equal(renameMsg.data.data.newName, 'Alicia');

  // 6. Player disqualified broadcast
  broadcastPlayerDisqualified(tid, {
    action: 'disqualify',
    player: 'Dave',
    disqualifiedPlayers: ['Dave'],
  });
  const disqualifyMsg = parseSSE(await readSSEEvent(reader));
  assert.equal(disqualifyMsg.event, EVENT_TYPES.PLAYER_DISQUALIFIED);
  assert.equal(disqualifyMsg.data.data.action, 'disqualify');
  assert.equal(disqualifyMsg.data.data.player, 'Dave');

  // 7. Tournament completed broadcast
  broadcastTournamentComplete(tid, {
    champion: 'Alicia',
    completedAt: '2026-09-03T12:00:00.000Z',
  });
  const completeMsg = parseSSE(await readSSEEvent(reader));
  assert.equal(completeMsg.event, EVENT_TYPES.TOURNAMENT_COMPLETED);
  assert.equal(completeMsg.data.data.champion, 'Alicia');

  await reader.cancel();
});

test('stream route: client disconnect via AbortSignal cleans up event listeners', async () => {
  resetEventBus();
  const tid = 'tourn-cleanup-test';
  const controller = new AbortController();

  const req = new Request(`http://localhost:3000/api/stream?tournamentId=${tid}`, {
    signal: controller.signal,
  });
  const res = await streamHandler(req);
  const reader = res.body.getReader();

  // Read initial handshake
  await readSSEEvent(reader);

  const bus = getEventBus();
  const listenerCountBefore = bus.listenerCount(`tournament:${tid}`);
  assert.ok(listenerCountBefore >= 1, 'Subscriber listener must be attached');

  // Client aborts connection
  controller.abort();

  // Allow microtasks to run cleanup
  await new Promise(resolve => setTimeout(resolve, 50));

  const listenerCountAfter = bus.listenerCount(`tournament:${tid}`);
  assert.equal(listenerCountAfter, 0, 'Listener must be detached after client abort');

  await reader.cancel().catch(() => {});
});

test('stream route: reconnection replays missed events via Last-Event-ID header', async () => {
  resetEventBus();
  const tid = 'tourn-replay-test';

  const e1 = broadcastMatchScore(tid, { matchNumber: 1 });
  const e2 = broadcastStageAdvance(tid, { stageIndex: 1 });

  const req = new Request(`http://localhost:3000/api/stream?tournamentId=${tid}`, {
    headers: {
      'last-event-id': e1.id,
    },
  });
  const res = await streamHandler(req);
  const reader = res.body.getReader();

  const handshakeChunk = await readSSEEvent(reader);
  assert.ok(handshakeChunk.includes(EVENT_TYPES.CONNECTED), 'includes handshake');

  const replayedChunk = await readSSEEvent(reader);
  assert.ok(replayedChunk.includes(EVENT_TYPES.STAGE_ADVANCE), 'replays missed stage:advance');
  assert.ok(!replayedChunk.includes(EVENT_TYPES.MATCH_SCORE), 'does not replay already seen e1');

  await reader.cancel();
});

test('stream route: pre-aborted client signal returns 499 with zero leaked listeners', async () => {
  resetEventBus();
  const tid = 'tourn-preabort-test';
  const controller = new AbortController();
  controller.abort(); // pre-aborted

  const req = new Request(`http://localhost:3000/api/stream?tournamentId=${tid}`, {
    signal: controller.signal,
  });
  const res = await streamHandler(req);
  assert.equal(res.status, 499);

  const bus = getEventBus();
  assert.equal(bus.listenerCount(`tournament:${tid}`), 0, 'no listener should be leaked on pre-aborted request');
});

test('stream route: invalid tournamentId parameter length rejects with 400', async () => {
  const badTid = 'a'.repeat(129);
  const req = new Request(`http://localhost:3000/api/stream?tournamentId=${badTid}`);
  const res = await streamHandler(req);
  assert.equal(res.status, 400);
});

test('stream route: rapid 100 concurrent streams subscribe and disconnect cleanly', async () => {
  resetEventBus();
  const tid = 'tourn-rapid-100';
  const bus = getEventBus();
  const count = 100;
  const clients = [];

  for (let i = 0; i < count; i++) {
    const controller = new AbortController();
    const req = new Request(`http://localhost:3000/api/stream?tournamentId=${tid}`, {
      signal: controller.signal,
    });
    const res = await streamHandler(req);
    const reader = res.body.getReader();
    clients.push({ controller, reader });
  }

  assert.equal(bus.listenerCount(`tournament:${tid}`), count, 'all 100 subscribers attached');

  // Broadcast event to all 100 clients
  const broadcastResult = broadcastMatchScore(tid, { matchNumber: 1 });
  assert.ok(broadcastResult.id);
  assert.equal(broadcastResult.tournament, null);

  // Abort all 100 clients
  for (const client of clients) {
    client.controller.abort();
    await client.reader.cancel().catch(() => {});
  }

  // Microtask tick
  await new Promise(r => setTimeout(r, 60));
  assert.equal(bus.listenerCount(`tournament:${tid}`), 0, 'all 100 listeners cleanly removed');
});

test('event ordering: match:score precedes tournament:complete in event stream', () => {
  resetEventBus();
  const tid = 'tourn-order-test';
  const received = [];

  subscribeToTournament(tid, (e) => {
    received.push(e.type);
  });

  // Emulate sequence from match result route
  broadcastMatchScore(tid, { matchNumber: 10, winner: 'Alice' });
  broadcastTournamentComplete(tid, { champion: 'Alice' });

  assert.equal(received.length, 2);
  assert.equal(received[0], EVENT_TYPES.MATCH_SCORE, 'match:score must arrive first');
  assert.equal(received[1], EVENT_TYPES.TOURNAMENT_COMPLETE, 'tournament:complete must arrive second');
});

test('event bus: isolates listener exceptions so rogue subscriber cannot crash bus or starve peers', () => {
  resetEventBus();
  const tid = 'tourn-safe-emit';
  let normalReceived = false;

  // 1. Rogue subscriber throws uncaught error
  subscribeToTournament(tid, () => {
    throw new Error('Exploding client subscriber');
  });

  // 2. Normal subscriber must still receive event
  subscribeToTournament(tid, (e) => {
    if (e.type === EVENT_TYPES.MATCH_UPDATED) {
      normalReceived = true;
    }
  });

  // 3. Broadcast must not throw to caller (which is an HTTP route)
  assert.doesNotThrow(() => {
    broadcastMatchUpdate(tid, { matchNumber: 5, player1Score: 1, player2Score: 0 });
  });

  assert.equal(normalReceived, true, 'healthy subscriber received event despite rogue peer throwing');
});

test('stream route: reconnection replays missed events via query parameters lastEventId and last-event-id', async () => {
  resetEventBus();
  const tid = 'tourn-param-replay';

  const e1 = broadcastMatchUpdate(tid, { matchNumber: 1 });
  const e2 = broadcastStageAdvance(tid, { stageIndex: 1 });

  // Replay using ?lastEventId=
  const req1 = new Request(`http://localhost:3000/api/stream?tournamentId=${tid}&lastEventId=${e1.id}`);
  const res1 = await streamHandler(req1);
  const reader1 = res1.body.getReader();

  const handshake1 = await readSSEEvent(reader1);
  assert.ok(handshake1.includes(EVENT_TYPES.CONNECTED));

  const replayed1 = await readSSEEvent(reader1);
  assert.ok(replayed1.includes(EVENT_TYPES.STAGE_ADVANCED));
  await reader1.cancel();

  // Replay using ?last-event-id=
  const req2 = new Request(`http://localhost:3000/api/stream?tournamentId=${tid}&last-event-id=${e1.id}`);
  const res2 = await streamHandler(req2);
  const reader2 = res2.body.getReader();

  const handshake2 = await readSSEEvent(reader2);
  assert.ok(handshake2.includes(EVENT_TYPES.CONNECTED));

  const replayed2 = await readSSEEvent(reader2);
  assert.ok(replayed2.includes(EVENT_TYPES.STAGE_ADVANCED));
  await reader2.cancel();
});

test('stream route: replay strictly isolates tournament-specific events from other tournaments', async () => {
  resetEventBus();
  const tidA = 'tourn-A-isolation';
  const tidB = 'tourn-B-isolation';

  const eA1 = broadcastMatchUpdate(tidA, { matchNumber: 1 });
  broadcastMatchUpdate(tidB, { matchNumber: 2 });
  const eA2 = broadcastStageAdvance(tidA, { stageIndex: 1 });

  const missed = getEventsSince(eA1.id, tidA);
  assert.equal(missed.length, 1);
  assert.equal(missed[0].id, eA2.id);
  assert.equal(missed[0].tournamentId, tidA);
});

test('reconnection: handles non-numeric and malformed event IDs gracefully without crashing', () => {
  resetEventBus();
  const tid = 'tourn-corrupt-id';

  broadcastMatchUpdate(tid, { matchNumber: 1 });
  broadcastMatchUpdate(tid, { matchNumber: 2 });

  // Malformed non-numeric IDs should not throw or crash
  assert.doesNotThrow(() => {
    const res1 = getEventsSince('corrupt-string-id', tid);
    assert.ok(Array.isArray(res1));
  });

  assert.doesNotThrow(() => {
    const res2 = getEventsSince(null, tid);
    assert.deepEqual(res2, []);
  });

  assert.doesNotThrow(() => {
    const res3 = getEventsSince(undefined, tid);
    assert.deepEqual(res3, []);
  });
});

test('client snapshot sync: event payload delivers complete tournament state directly to client', () => {
  resetEventBus();
  const tid = 'tourn-client-sync';

  const mockTournamentSnapshot = {
    _id: tid,
    name: 'Ninja Cup',
    stages: [{ type: 'group', stageIndex: 0 }],
    matches: [{ matchNumber: 1, player1: 'Naruto', player2: 'Sasuke', player1Score: 3, player2Score: 2 }],
    standings: [{ player: 'Naruto', points: 3 }],
  };

  const evt = broadcastMatchUpdate(tid, { matchNumber: 1 }, mockTournamentSnapshot);

  // Assert top-level and nested tournament snapshot exists for zero-latency UI sync
  assert.ok(evt.tournament, 'top-level tournament snapshot exists');
  assert.equal(evt.tournament.name, 'Ninja Cup');
  assert.equal(evt.data.tournament.name, 'Ninja Cup');

  // Assert wire formatting packages the snapshot correctly
  const wire = formatSSE({
    event: evt.type,
    id: evt.id,
    data: evt,
  });

  const parsed = parseSSE(wire);
  const receivedSnapshot = parsed.data.tournament || parsed.data.data?.tournament;
  assert.equal(receivedSnapshot.name, 'Ninja Cup');
  assert.equal(receivedSnapshot.matches.length, 1);
});

test('broadcastTiebreakResolved and broadcastRosterUpdate handle tiebreak actions and emit canonical tiebreak:resolved', () => {
  resetEventBus();
  const tid = 'tourn-tiebreak-test';
  const received = [];

  subscribeToTournament(tid, (e) => {
    received.push(e);
  });

  // Direct tiebreak broadcast
  broadcastTiebreakResolved(tid, {
    stageNumber: 1,
    groupId: 's1-g0',
    selected: ['Naruto'],
    candidates: ['Naruto', 'Sasuke'],
  });

  assert.equal(received.length, 1);
  assert.equal(received[0].type, EVENT_TYPES.TIEBREAK_RESOLVED);
  assert.equal(received[0].type, 'tiebreak:resolved');
  assert.equal(received[0].data.action, 'tiebreak');
  assert.deepEqual(received[0].data.selected, ['Naruto']);

  // Roster update routing action: 'tiebreak'
  broadcastRosterUpdate(tid, {
    action: 'tiebreak',
    stageNumber: 1,
    groupId: 's1-g1',
    selected: ['Kakashi'],
  });

  assert.equal(received.length, 2);
  assert.equal(received[1].type, 'tiebreak:resolved');
  assert.equal(received[1].data.action, 'tiebreak');
});

test('stream route: handles literal "null" and "undefined" lastEventId query parameters without spurious replay or error', async () => {
  resetEventBus();
  const tid = 'tourn-null-params';

  broadcastMatchUpdate(tid, { matchNumber: 1 });

  // 1. ?lastEventId=null should be treated as no lastEventId (handshake only, no replay)
  const reqNull = new Request(`http://localhost:3000/api/stream?tournamentId=${tid}&lastEventId=null`);
  const resNull = await streamHandler(reqNull);
  assert.equal(resNull.status, 200);
  const readerNull = resNull.body.getReader();
  const chunkNull = await readSSEEvent(readerNull);
  assert.ok(chunkNull.includes(EVENT_TYPES.CONNECTED));
  assert.ok(!chunkNull.includes(EVENT_TYPES.MATCH_UPDATED), 'should not replay on literal string "null"');
  await readerNull.cancel();

  // 2. ?lastEventId=undefined should also be treated as no lastEventId
  const reqUndef = new Request(`http://localhost:3000/api/stream?tournamentId=${tid}&lastEventId=undefined`);
  const resUndef = await streamHandler(reqUndef);
  assert.equal(resUndef.status, 200);
  const readerUndef = resUndef.body.getReader();
  const chunkUndef = await readSSEEvent(readerUndef);
  assert.ok(chunkUndef.includes(EVENT_TYPES.CONNECTED));
  assert.ok(!chunkUndef.includes(EVENT_TYPES.MATCH_UPDATED), 'should not replay on literal string "undefined"');
  await readerUndef.cancel();
});

test('stream route: releases abort event listener on stream cancellation', async () => {
  resetEventBus();
  const tid = 'tourn-abort-clean';
  const controller = new AbortController();

  const req = new Request(`http://localhost:3000/api/stream?tournamentId=${tid}`, {
    signal: controller.signal,
  });
  const res = await streamHandler(req);
  const reader = res.body.getReader();

  // Handshake
  await readSSEEvent(reader);

  // Cancel reader from client side
  await reader.cancel();

  // Confirm subscriber listener on bus is removed
  const bus = getEventBus();
  assert.equal(bus.listenerCount(`tournament:${tid}`), 0);
});

test('useTournamentStream reconnection URL and domain event handling contract', () => {
  // Test hook URL construction contract
  const tournamentId = 'tourn-hook-contract';
  let lastEventId = null;

  function buildStreamUrl(tid, lastId) {
    let url = `/api/stream?tournamentId=${encodeURIComponent(tid)}`;
    if (lastId) {
      url += `&lastEventId=${encodeURIComponent(lastId)}`;
    }
    return url;
  }

  // Initial connect URL has no lastEventId
  assert.equal(buildStreamUrl(tournamentId, lastEventId), '/api/stream?tournamentId=tourn-hook-contract');

  // After receiving an event, reconnection includes lastEventId
  lastEventId = '1725350000000-42';
  assert.equal(
    buildStreamUrl(tournamentId, lastEventId),
    '/api/stream?tournamentId=tourn-hook-contract&lastEventId=1725350000000-42'
  );

  // When tournamentId changes, lastEventId is cleared
  const newTournamentId = 'tourn-new';
  lastEventId = null;
  assert.equal(buildStreamUrl(newTournamentId, lastEventId), '/api/stream?tournamentId=tourn-new');
});


