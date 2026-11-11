# Task ledger — tournament_manager_next

The only live record of task status. Scope, dependencies and acceptance for planned tasks live in
[docs/development-plan.md](docs/development-plan.md); this file records who is doing what and the
evidence that it is done.

## How to use this ledger

- Add every task of an accepted plan before executing it; add unplanned work before starting it.
  IDs are stable and never reused: `P<phase>-<nn>` for plan tasks, `DOC-<nnn>` / `OPS-<nnn>` etc.
  for the rest.
- Statuses: Planned, In progress, Blocked, In review, Done. Anything past Planned has an owner.
- Before starting: owner, start date, intended files and the verification approach.
- Blocked: the concrete blocker and the next action. In review: what verification is pending.
- Done: completion date, changed paths, outcome, the exact checks run and their results, and
  remaining limitations. A prose claim without evidence is not Done.
- A withdrawn task keeps its ID and records the decision and any superseding task.
- `node scripts/check-docs.mjs` validates statuses, owners, dated Done evidence and plan parity.

## Tasks

| ID | Task | Status | Owner | Dependencies | Acceptance | Result / evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| FB-001 | Creator-only archive / restore / delete of tournaments (user feedback) | Done | Claude Code | — | Creator archives, restores and deletes; other admins get 403; dashboard hides archived | 2026-11-12 · `src/models/Tournament.js`, `src/lib/auth.js`, `src/lib/clientAuth.js`, `src/app/api/tournaments/route.js`, `src/app/api/tournaments/[id]/route.js`, `src/app/api/tournaments/[id]/archive/route.js`, `src/app/page.jsx`, `src/app/tournaments/[id]/page.jsx` · `npm run dev` on a throwaway Mongo: anon 401, non-creator 403, creator 200, deleted → 404; browser: archive, Archived tab, delete confirm, panel hidden for non-creator · lint/test/build green · deployed `3efee74` 2026-11-12; live archive/delete without a token → 401 |
| FB-002 | Alias host 301 → canonical host so admins keep one login (user feedback) | Done | Claude Code | — | `tournament.rafi.ninja/*` 301s to `tournaments.rafi.ninja/*` | 2026-11-12 · `docker-compose.yml`, `.env.local.example`, VPS `.env` (+`APP_ALIAS_DOMAIN`, backup `.env.bak-20261112`) · local Traefik v3.7 test, then deployed `3efee74` via `scripts/deploy.sh` (healthy); live: alias `/` and `/tournaments/x?y=1` → 301 to canonical with path+query, canonical 200 · ungated: repo has no CI |
