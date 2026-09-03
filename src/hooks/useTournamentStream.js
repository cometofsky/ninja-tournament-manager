'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom React hook for live Server-Sent Events tournament streaming.
 * Handles automatic reconnect with exponential backoff, connection state feedback,
 * and typed event dispatching to eliminate unnecessary HTTP round-trips.
 *
 * @param {string} tournamentId - The tournament ID to subscribe to.
 * @param {object} [options]
 * @param {function} [options.onTournamentUpdate] - Invoked with updated tournament snapshot.
 * @param {function} [options.onEvent] - Invoked with every parsed event.
 * @param {function} [options.onMatchUpdate] - Invoked on match:updated or match:score.
 * @param {function} [options.onMatchAbandon] - Invoked on match:abandoned or match:abandon.
 * @param {function} [options.onStageAdvance] - Invoked on stage:advanced or stage:advance.
 * @param {function} [options.onRosterUpdate] - Invoked on player rename, disqualify, or roster update.
 * @param {function} [options.onTiebreakResolved] - Invoked on tiebreak:resolved.
 * @param {function} [options.onTournamentComplete] - Invoked on tournament:completed.
 * @param {boolean} [options.enabled=true] - Whether the stream subscription is active.
 * @param {number} [options.fallbackPollInterval=30000] - Periodic fallback poll ms (0 to disable).
 */
export function useTournamentStream(tournamentId, options = {}) {
  const {
    onTournamentUpdate,
    onEvent,
    onMatchUpdate,
    onMatchAbandon,
    onStageAdvance,
    onRosterUpdate,
    onTiebreakResolved,
    onTournamentComplete,
    enabled = true,
    fallbackPollInterval = 30000,
  } = options;

  const [status, setStatus] = useState('connecting'); // 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
  const [lastEvent, setLastEvent] = useState(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [error, setError] = useState(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const eventSourceRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const lastEventIdRef = useRef(null);
  const previousTournamentIdRef = useRef(tournamentId);

  // Reset lastEventId if tournament ID changes
  if (previousTournamentIdRef.current !== tournamentId) {
    previousTournamentIdRef.current = tournamentId;
    lastEventIdRef.current = null;
    reconnectAttemptsRef.current = 0;
  }

  const connect = useCallback(() => {
    if (!enabled || !tournamentId || typeof window === 'undefined') {
      setStatus('disconnected');
      return;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      let url = `/api/stream?tournamentId=${encodeURIComponent(tournamentId)}`;
      if (lastEventIdRef.current) {
        url += `&lastEventId=${encodeURIComponent(lastEventIdRef.current)}`;
      }
      const es = new EventSource(url);
      eventSourceRef.current = es;

      const markConnected = () => {
        setStatus('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;
        setReconnectCount(0);
      };

      es.onopen = markConnected;

      es.addEventListener('connected', () => {
        markConnected();
      });

      es.addEventListener('ping', () => {
        markConnected();
      });

      const handleIncomingEvent = (e) => {
        markConnected();
        let parsed = null;
        if (e && e.data) {
          try {
            parsed = JSON.parse(e.data);
          } catch {
            parsed = { raw: e.data };
          }
        }

        // Track lastEventId for reconnection replay
        const eventId = e?.lastEventId || parsed?.id || parsed?.data?.id;
        if (eventId) {
          lastEventIdRef.current = eventId;
        }

        setLastEvent({
          type: e.type,
          data: parsed,
          id: eventId || null,
          timestamp: new Date().toISOString(),
        });

        // Trigger snapshot update if tournament document is present
        const snapshot = parsed?.tournament || parsed?.data?.tournament;
        if (snapshot && typeof snapshot === 'object' && snapshot.stages && snapshot.matches) {
          optionsRef.current.onTournamentUpdate?.(snapshot);
        }

        // Domain-specific callbacks
        if (e.type === 'match:updated' || e.type === 'match:score') {
          optionsRef.current.onMatchUpdate?.(parsed);
        } else if (e.type === 'match:abandoned' || e.type === 'match:abandon') {
          if (optionsRef.current.onMatchAbandon) {
            optionsRef.current.onMatchAbandon(parsed);
          } else {
            optionsRef.current.onMatchUpdate?.(parsed);
          }
        } else if (e.type === 'stage:advanced' || e.type === 'stage:advance') {
          optionsRef.current.onStageAdvance?.(parsed);
        } else if (
          e.type === 'player:renamed' ||
          e.type === 'player:disqualified' ||
          e.type === 'roster:update'
        ) {
          optionsRef.current.onRosterUpdate?.(parsed);
        } else if (e.type === 'tiebreak:resolved') {
          if (optionsRef.current.onTiebreakResolved) {
            optionsRef.current.onTiebreakResolved(parsed);
          } else {
            optionsRef.current.onRosterUpdate?.(parsed);
          }
        } else if (e.type === 'tournament:completed' || e.type === 'tournament:complete') {
          optionsRef.current.onTournamentComplete?.(parsed);
        }

        optionsRef.current.onEvent?.(parsed, e);
      };

      // Subscribe to all canonical and legacy event types
      const eventTypes = [
        'match:updated',
        'match:score',
        'match:abandoned',
        'match:abandon',
        'stage:advanced',
        'stage:advance',
        'player:renamed',
        'player:disqualified',
        'roster:update',
        'tiebreak:resolved',
        'tournament:completed',
        'tournament:complete',
      ];

      for (const type of eventTypes) {
        es.addEventListener(type, handleIncomingEvent);
      }

      es.onmessage = handleIncomingEvent;

      es.onerror = (err) => {
        setStatus('reconnecting');
        setError(err);

        // Native EventSource auto-reconnects, but on hard drops or closed state,
        // we enforce controlled exponential backoff reconnection.
        if (es.readyState === EventSource.CLOSED || es.readyState === 2) {
          es.close();
          eventSourceRef.current = null;

          const nextAttempt = reconnectAttemptsRef.current + 1;
          reconnectAttemptsRef.current = nextAttempt;
          setReconnectCount(nextAttempt);

          // Exponential backoff capped at 15s + random jitter (0-500ms)
          const delay = Math.min(1000 * Math.pow(1.5, nextAttempt), 15000) + Math.random() * 500;
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };
    } catch (err) {
      setStatus('reconnecting');
      setError(err);
      const nextAttempt = reconnectAttemptsRef.current + 1;
      reconnectAttemptsRef.current = nextAttempt;
      setReconnectCount(nextAttempt);
      const delay = Math.min(1000 * Math.pow(1.5, nextAttempt), 15000);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(connect, delay);
    }
  }, [enabled, tournamentId]);

  useEffect(() => {
    connect();

    // Fallback periodic sync in case network or proxy permanently blocks SSE
    if (fallbackPollInterval > 0) {
      fallbackTimerRef.current = setInterval(() => {
        optionsRef.current.onEvent?.(null, { type: 'poll' });
      }, fallbackPollInterval);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      setStatus('disconnected');
    };
  }, [connect, fallbackPollInterval]);

  return {
    status,
    isConnected: status === 'connected',
    isReconnecting: status === 'reconnecting',
    isDisconnected: status === 'disconnected',
    isConnecting: status === 'connecting',
    lastEvent,
    error,
    reconnectCount,
    reconnect: connect,
  };
}

export default useTournamentStream;
