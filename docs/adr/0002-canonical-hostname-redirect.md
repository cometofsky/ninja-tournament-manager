---
status: proposed
type: technical
area: deploy, auth, traefik
date: 2026-11-12
decided-by:
---
# 0002. One canonical hostname; the alias 301-redirects to it

User feedback: "it requires me to login every time". The admin token lives in `localStorage`, which
browsers keep per hostname, and both `tournaments.rafi.ninja` and `tournament.rafi.ninja` served the
app — a login on one is invisible on the other. The owner chose to keep the 7-day session
(`TOKEN_TTL`) and add a Traefik `redirectregex` middleware on the app's router that permanently
redirects `APP_ALIAS_DOMAIN` to `APP_DOMAIN`, path and query kept. The alias stays in `TRAEFIK_RULE` so
the same router and certificate still answer it; an empty `APP_ALIAS_DOMAIN` disables the redirect.

## Consequences
- Admins who only ever logged in on the alias must log in once more on the canonical host.
- The 7-day expiry still applies, so an admin who returns after more than a week logs in again.
