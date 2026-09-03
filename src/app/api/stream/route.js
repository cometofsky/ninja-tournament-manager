import {
  EVENT_TYPES,
  formatSSE,
  subscribeToTournament,
  getEventsSince,
} from '../../../lib/events.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const url = new URL(request.url);
  const tournamentId = url.searchParams.get('tournamentId');
  let lastEventId = request.headers.get('last-event-id')
    || url.searchParams.get('lastEventId')
    || url.searchParams.get('last-event-id');

  // Normalize literal 'undefined' or 'null' query values and whitespace
  if (lastEventId === 'undefined' || lastEventId === 'null' || !lastEventId?.trim()) {
    lastEventId = null;
  }
  if (lastEventId && lastEventId.length > 128) {
    lastEventId = null;
  }

  // Validate tournamentId length if provided to prevent abuse
  if (tournamentId && tournamentId.length > 128) {
    return new Response(JSON.stringify({ error: 'Invalid tournamentId parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Immediate return if client already aborted request
  if (request.signal?.aborted) {
    return new Response(null, { status: 499, statusText: 'Client Closed Request' });
  }

  let cleanup = null;
  let onAbort = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;
      let heartbeatTimer = null;
      let unsubscribe = null;

      cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        if (onAbort && request.signal) {
          request.signal.removeEventListener('abort', onAbort);
          onAbort = null;
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        try {
          controller.close();
        } catch {}
      };

      const send = (text) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };

      // 1. Initial connection handshake
      const initialMessage = formatSSE({
        event: EVENT_TYPES.CONNECTED,
        data: {
          status: 'connected',
          tournamentId: tournamentId || null,
          timestamp: new Date().toISOString(),
          message: tournamentId
            ? `Connected to tournament stream: ${tournamentId}`
            : 'Connected to global tournament stream',
        },
        retry: 3000,
      });
      send(initialMessage);
      if (isClosed) return;

      // 2. Replay missed events if reconnection Last-Event-ID provided
      if (lastEventId) {
        const missed = getEventsSince(lastEventId, tournamentId);
        for (const evt of missed) {
          if (isClosed) break;
          send(formatSSE({
            event: evt.type,
            id: evt.id,
            data: evt,
          }));
        }
        if (isClosed) return;
      }

      // 3. Heartbeat / Keep-Alive timer (every 15s)
      heartbeatTimer = setInterval(() => {
        send(formatSSE({
          event: EVENT_TYPES.PING,
          data: { timestamp: new Date().toISOString() },
        }));
      }, 15000);
      if (heartbeatTimer.unref) {
        heartbeatTimer.unref();
      }

      // 4. Subscribe to tournament events
      unsubscribe = subscribeToTournament(tournamentId, (event) => {
        send(formatSSE({
          event: event.type,
          id: event.id,
          data: event,
        }));
      });

      if (isClosed) {
        cleanup();
      }
    },
    cancel() {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    },
  });

  // Also clean up when client abort signal fires
  if (request.signal) {
    if (request.signal.aborted) {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    } else {
      onAbort = () => {
        if (cleanup) {
          cleanup();
          cleanup = null;
        }
      };
      request.signal.addEventListener('abort', onAbort, { once: true });
    }
  }

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
