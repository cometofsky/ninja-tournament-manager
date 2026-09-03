import { EventEmitter } from 'node:events';

export const EVENT_TYPES = {
  CONNECTED: 'connected',
  PING: 'ping',
  MATCH_UPDATED: 'match:updated',
  MATCH_ABANDONED: 'match:abandoned',
  STAGE_ADVANCED: 'stage:advanced',
  PLAYER_RENAMED: 'player:renamed',
  PLAYER_DISQUALIFIED: 'player:disqualified',
  TIEBREAK_RESOLVED: 'tiebreak:resolved',
  TOURNAMENT_COMPLETED: 'tournament:completed',

  // Backward-compatibility aliases
  MATCH_SCORE: 'match:updated',
  MATCH_ABANDON: 'match:abandoned',
  STAGE_ADVANCE: 'stage:advanced',
  ROSTER_UPDATE: 'player:renamed',
  TOURNAMENT_COMPLETE: 'tournament:completed',
};

const GLOBAL_BUS_KEY = Symbol.for('tournament_manager.eventBus');
const GLOBAL_BUFFER_KEY = Symbol.for('tournament_manager.eventBuffer');
const MAX_BUFFER_SIZE = 100;

if (!globalThis[GLOBAL_BUS_KEY]) {
  const bus = new EventEmitter();
  // Support virtually unlimited spectator connections without warning
  bus.setMaxListeners(0);
  globalThis[GLOBAL_BUS_KEY] = bus;
}

if (!globalThis[GLOBAL_BUFFER_KEY]) {
  globalThis[GLOBAL_BUFFER_KEY] = [];
}

let eventSeq = 0;

function sanitize(data) {
  if (!data) return data;
  if (typeof data.toObject === 'function') {
    return data.toObject();
  }
  return data;
}

/**
 * Safely emit to all listeners on a channel without letting one subscriber's
 * exception interrupt other subscribers or crash the caller.
 */
function safeEmit(bus, channel, eventObj) {
  const listeners = bus.rawListeners(channel);
  for (const listener of listeners) {
    try {
      listener(eventObj);
    } catch (err) {
      console.error(`[EventBus] Error in listener on channel "${channel}":`, err?.message || err);
    }
  }
}

/**
 * Format a Server-Sent Event string per the WHATWG SSE specification.
 */
export function formatSSE({ event, data, id, retry, comment } = {}) {
  if (comment !== undefined && comment !== null) {
    const lines = String(comment).split(/\r?\n/);
    return lines.map(l => `: ${l}`).join('\n') + '\n\n';
  }
  let out = '';
  if (id !== undefined && id !== null) {
    const safeId = String(id).replace(/[\r\n\0]/g, '');
    if (safeId) {
      out += `id: ${safeId}\n`;
    }
  }
  if (event) {
    const safeEvent = String(event).replace(/[\r\n\0]/g, '');
    if (safeEvent) {
      out += `event: ${safeEvent}\n`;
    }
  }
  if (retry !== undefined && retry !== null) {
    const retryMs = Number(retry);
    if (!Number.isNaN(retryMs) && retryMs >= 0) {
      out += `retry: ${Math.floor(retryMs)}\n`;
    }
  }
  if (data !== undefined && data !== null) {
    let raw;
    try {
      raw = typeof data === 'object' ? JSON.stringify(data) : String(data);
    } catch {
      raw = JSON.stringify({ error: 'Serialization failure' });
    }
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      out += `data: ${line}\n`;
    }
  } else if (event) {
    out += 'data: \n';
  }
  out += '\n';
  return out;
}

/**
 * Compare two event IDs chronologically.
 */
export function compareEventIds(a, b) {
  if (a === b) return 0;
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const partsA = String(a).split('-');
  const partsB = String(b).split('-');
  const tsA = Number(partsA[0]);
  const tsB = Number(partsB[0]);
  if (!Number.isNaN(tsA) && !Number.isNaN(tsB)) {
    if (tsA !== tsB) return tsA - tsB;
    const seqA = partsA.length > 1 ? Number(partsA[1]) : 0;
    const seqB = partsB.length > 1 ? Number(partsB[1]) : 0;
    if (!Number.isNaN(seqA) && !Number.isNaN(seqB)) {
      return seqA - seqB;
    }
  }
  return String(a).localeCompare(String(b));
}

/**
 * Get recent events after a specific event ID for reconnection replay.
 */
export function getEventsSince(lastEventId, tournamentId = null) {
  const buffer = globalThis[GLOBAL_BUFFER_KEY];
  if (!lastEventId || !buffer.length) return [];
  const idx = buffer.findIndex(e => String(e.id) === String(lastEventId));
  let slice;
  if (idx >= 0) {
    slice = buffer.slice(idx + 1);
  } else {
    const newest = buffer[buffer.length - 1];
    const oldest = buffer[0];
    if (compareEventIds(lastEventId, newest.id) >= 0) {
      slice = [];
    } else if (compareEventIds(lastEventId, oldest.id) < 0) {
      slice = buffer;
    } else {
      const nextIdx = buffer.findIndex(e => compareEventIds(e.id, lastEventId) > 0);
      slice = nextIdx >= 0 ? buffer.slice(nextIdx) : [];
    }
  }
  if (!tournamentId || tournamentId === '*') {
    return slice;
  }
  return slice.filter(e => String(e.tournamentId) === String(tournamentId));
}

/**
 * Broadcast an event to all interested subscribers and record in ring buffer.
 * Safe against listener exceptions and guarantees HTTP response continuity.
 */
export function broadcastEvent(type, payload = {}) {
  try {
    const bus = globalThis[GLOBAL_BUS_KEY];
    const buffer = globalThis[GLOBAL_BUFFER_KEY];

    const now = new Date();
    eventSeq += 1;
    const eventId = `${now.getTime()}-${eventSeq}`;
    const tid = payload.tournamentId ? String(payload.tournamentId) : null;
    const dataPayload = sanitize(payload.data !== undefined ? payload.data : payload);

    const eventObj = {
      id: eventId,
      type,
      tournamentId: tid,
      data: dataPayload,
      tournament: dataPayload?.tournament || null,
      timestamp: payload.timestamp || now.toISOString(),
    };

    // Add to bounded ring buffer
    buffer.push(eventObj);
    if (buffer.length > MAX_BUFFER_SIZE) {
      buffer.shift();
    }

    // Emit safely on tournament-specific channel
    if (tid) {
      safeEmit(bus, `tournament:${tid}`, eventObj);
    }
    // Emit safely on global channels
    safeEmit(bus, 'tournament:*', eventObj);
    safeEmit(bus, 'event:*', eventObj);

    return eventObj;
  } catch (err) {
    console.error('[EventBus] Critical error broadcasting event:', err);
    return null;
  }
}

/**
 * Subscribe to live events for a given tournament (or all tournaments if wildcard).
 * Returns an unsubscribe callback.
 */
export function subscribeToTournament(tournamentId, listener) {
  const bus = globalThis[GLOBAL_BUS_KEY];
  const channel = (!tournamentId || tournamentId === '*')
    ? 'tournament:*'
    : `tournament:${String(tournamentId)}`;

  bus.on(channel, listener);
  return () => {
    bus.off(channel, listener);
  };
}

// ── Specific Broadcast Helpers ───────────────────────────────────────────────

export function broadcastMatchUpdate(tournamentId, matchData, tournamentSnapshot = null) {
  const match = sanitize(matchData);
  const tournament = sanitize(tournamentSnapshot);
  return broadcastEvent(EVENT_TYPES.MATCH_UPDATED, {
    tournamentId,
    data: {
      tournamentId,
      matchNumber: match?.matchNumber,
      playerScores: match ? { [match.player1]: match.player1Score, [match.player2]: match.player2Score } : null,
      player1Score: match?.player1Score,
      player2Score: match?.player2Score,
      winner: match?.winner,
      match,
      standings: match?.standings || tournament?.standings || null,
      tournament,
    },
  });
}
export const broadcastMatchScore = broadcastMatchUpdate;

export function broadcastMatchAbandon(tournamentId, matchData, tournamentSnapshot = null) {
  const match = sanitize(matchData);
  const tournament = sanitize(tournamentSnapshot);
  return broadcastEvent(EVENT_TYPES.MATCH_ABANDONED, {
    tournamentId,
    data: {
      tournamentId,
      matchNumber: match?.matchNumber,
      status: 'abandoned',
      match,
      standings: match?.standings || tournament?.standings || null,
      tournament,
    },
  });
}
export const broadcastMatchAbandoned = broadcastMatchAbandon;

export function broadcastStageAdvance(tournamentId, stageData, tournamentSnapshot = null) {
  const stage = sanitize(stageData);
  const tournament = sanitize(tournamentSnapshot);
  return broadcastEvent(EVENT_TYPES.STAGE_ADVANCED, {
    tournamentId,
    data: {
      tournamentId,
      ...stage,
      tournament,
    },
  });
}
export const broadcastStageAdvanced = broadcastStageAdvance;

export function broadcastPlayerRenamed(tournamentId, renameData, tournamentSnapshot = null) {
  const payload = sanitize(renameData);
  const tournament = sanitize(tournamentSnapshot);
  return broadcastEvent(EVENT_TYPES.PLAYER_RENAMED, {
    tournamentId,
    data: {
      tournamentId,
      action: 'rename',
      ...payload,
      tournament,
    },
  });
}

export function broadcastPlayerDisqualified(tournamentId, disqualifyData, tournamentSnapshot = null) {
  const payload = sanitize(disqualifyData);
  const tournament = sanitize(tournamentSnapshot);
  return broadcastEvent(EVENT_TYPES.PLAYER_DISQUALIFIED, {
    tournamentId,
    data: {
      tournamentId,
      action: payload?.action || 'disqualify',
      ...payload,
      tournament,
    },
  });
}

export function broadcastTiebreakResolved(tournamentId, tiebreakData, tournamentSnapshot = null) {
  const payload = sanitize(tiebreakData);
  const tournament = sanitize(tournamentSnapshot);
  return broadcastEvent(EVENT_TYPES.TIEBREAK_RESOLVED, {
    tournamentId,
    data: {
      tournamentId,
      action: 'tiebreak',
      ...payload,
      tournament,
    },
  });
}

export function broadcastRosterUpdate(tournamentId, rosterData, tournamentSnapshot = null) {
  if (rosterData?.action === 'disqualify' || rosterData?.action === 'reinstate') {
    return broadcastPlayerDisqualified(tournamentId, rosterData, tournamentSnapshot);
  }
  if (rosterData?.action === 'tiebreak') {
    return broadcastTiebreakResolved(tournamentId, rosterData, tournamentSnapshot);
  }
  return broadcastPlayerRenamed(tournamentId, rosterData, tournamentSnapshot);
}

export function broadcastTournamentComplete(tournamentId, completionData, tournamentSnapshot = null) {
  const payload = sanitize(completionData);
  const tournament = sanitize(tournamentSnapshot);
  return broadcastEvent(EVENT_TYPES.TOURNAMENT_COMPLETED, {
    tournamentId,
    data: {
      tournamentId,
      ...payload,
      tournament,
    },
  });
}
export const broadcastTournamentCompleted = broadcastTournamentComplete;

/**
 * Access underlying event bus (for testing/diagnostics).
 */
export function getEventBus() {
  return globalThis[GLOBAL_BUS_KEY];
}

/**
 * Reset event bus listeners and buffer (for test isolation).
 */
export function resetEventBus() {
  const bus = globalThis[GLOBAL_BUS_KEY];
  bus?.removeAllListeners();
  globalThis[GLOBAL_BUFFER_KEY] = [];
  eventSeq = 0;
}

