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
