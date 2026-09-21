# Lessons Learned

## 2026-06-21
- Created a bare-metal deployment script for Next.js applications on VPS hosting.
- Evaluated integration mechanisms between a host-based (bare-metal) service and containerized Traefik proxy.
- Documented two main integration paths:
  1. **Docker Proxy Container**: Running a lightweight container (like `alpine/socat`) on the Traefik network that forwards ports to the host (`host.docker.internal`), allowing normal Traefik container label discovery without changing Traefik's dynamic file configurations.
  2. **Traefik File Provider**: Adding a dynamic YAML configuration routing a rule to the Docker bridge gateway IP (`172.17.0.1`).
- Cleaned up obsolete Vercel configuration files (`vercel.json`) and specific segment configurations (`maxDuration`) when migrating from Vercel to VPS hosting.

## 2026-06-21 — Postgres consolidation on shared VPS (luxotix PG16 → invoice's postgres_server PG17)
- Always back up the *un-backed-up* system first: invoice's `postgres_server` had no backup, so a `pg_dumpall` was the very first action before any change.
- A single-DB `pg_dump -Fc` does NOT carry the login role (roles are cluster-global) — recreate the role with the SAME name as the dump's object owner and DON'T use `--no-owner`, so ownership is preserved and the app (connecting as that role) keeps its grants.
- Match target DB encoding/locale to source (`TEMPLATE template0 ENCODING ... LC_COLLATE ...`); verify with exact per-table row-count diff + a write-path probe as the app role over TCP, not just superuser.
- Don't recreate the un-backed-up container: attach networks with a live edit and reuse the existing shared network (`app_net`) instead of re-networking `postgres_server`. Minimal blast radius for other tenants (invoice + notebook share that server).
- Laravel: the authoritative `DB_HOST` was the compose `environment:` anchor, not the mounted `backend/.env` — container env overrides immutable phpdotenv. Recreate with `--no-deps` after removing the old DB from `depends_on`.
- Regex bug I hit twice: (1) appending to the first `- ` list matched `volumes:` not `networks:` — scope the regex to the service's `networks:` block; (2) `re.sub` with the DOTALL `(?s)` flag made `.*` span newlines and deleted the rest of the file — use `(?m)` only for line-scoped block removal. Always `docker compose config` to validate before applying, and back up the file before each edit.

## 2026-07-09
- Generated comprehensive project documentation at the root `README.md` to serve as a high-fidelity reference for LLMs and developers.
- Explicitly mapped Next.js 14 routing hierarchy, MongoDB model schemas, and complex tournament business rules (Berger rotation, disqualification impacts, tiebreaks, score-recalculation).

## 2026-08-30
- Audited instruction files vs codebase: ratcheted 18 code facts in `AGENTS.md` into executable claim anchors verified by `check-doc-claims.js`.
- Injection guard in `check-doc-claims.js` bans `;` across commands; avoid trailing semicolons inside grep patterns.

## 2026-09-03
- Complete UI/UX modernization with athletic "Pitch & Slate" theme: in Next.js 14 App Router, export `viewport` separately from `metadata`; apply `tabular-nums` for scoreboard alignment; wrap administrative mutations (player rename/disqualification) in collapsible panels to keep match center views focused.
- Built production SSE streaming engine with process-wide EventEmitter pub-sub and ring-buffer reconnect replay; integrated live event broadcasting across all tournament mutation routes (scores, abandonments, stage advancements, roster updates, completions).
- 2026-09-03 · SSE stream leaks on pre-aborted signals, multiline comments missing colons, and naive ring-buffer replay on future lastEventId · Return 499 on pre-abort, prefix each multiline comment line with colon, compare event IDs chronologically in getEventsSince, and broadcast match:score before tournament:complete.
- 2026-09-03 · SSE pubsub listener exceptions crashed broadcaster & route handlers, missing useTournamentStream hook, and non-conforming event names · Wrapped subscriber notification in safeEmit with per-listener try/catch, created dedicated useTournamentStream client hook with backoff reconnect, and aligned event types to canonical spec with aliases.
- 2026-09-03 · useTournamentStream omitted lastEventId replay & open handler, tiebreaks broadcast as player:renamed, and abort listeners lingered · Appended &lastEventId= on reconnect, wired onopen, added canonical tiebreak:resolved event, and detached abort listeners on cleanup.



2026-09-21 · docs/ai-layer-plan.md merged into docs/architecture.md (Cross-cutting → AI layer) + a scheduling note in docs/development-plan.md, file deleted, AGENTS.md `## AI layer` repointed; gitignored ORIGINAL_REQUEST.md moved to docs/archive/ and the folder listed · `node scripts/check-docs.mjs` PASS; check-preserved shows only the expected AGENTS.md pointer/Project-context losses
