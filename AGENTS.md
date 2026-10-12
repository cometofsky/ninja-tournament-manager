# tournament_manager_next

## Project context
<!-- project-context:begin — managed by ~/.agents/skills/project-context (scaffold.sh refreshes it).
     Edit the skill's templates/agents-section.md, not this block. Repo-specific rules go below the end marker. -->
The same documentation layout is used in every repo, so any AI tool or person knows where to look.

| Doc | Owns | Read when |
| :--- | :--- | :--- |
| `CONTEXT.md` | Domain glossary — terms to use, synonyms to avoid | Before any change; whenever naming something |
| `PRODUCT.md` | Current product rules: users, flows, must / must not | Changing anything a user sees or does |
| `docs/business.md` | Current business rules (repo-safe) | Touching plans, limits, billing, commitments, audience |
| `docs/architecture.md` | Technical contracts: building blocks, data, runtime, deployment, cross-cutting (incl. AI layer) | Changing structure, data, integrations, deploy, security |
| `docs/adr/INDEX.md` | Decision log; open every ADR whose `area` matches your change | Before any change; before "fixing" something that looks odd |
| `specs/<ID>/product.md` + `tech.md` | One feature: testable behaviour rules + implementation plan | Building or changing that feature |
| `docs/development-plan.md` | Sequencing, scope and acceptance of planned work | Starting planned work; asked "what's next" |
| `TASKS.md` | Live task status and completion evidence — the only status record | Starting or finishing any task |
| `lessons_learned.md` | What broke before and the fix | Before debugging; before repeating a risky operation |
| `docs/wiki/` | Verified per-subsystem pages (repowiki), each stamped with the commit it was checked at | Orienting in an unfamiliar subsystem — narrative, never normative |
| Repo-specific docs (table below) | Everything else this repo keeps | When its "Read when" trigger matches |

**Reading order and the rules for using these docs** — ask on an uncovered product/business gap, ADR
status and supersession, precedence, a repo-safe `docs/business.md`, `node scripts/check-docs.mjs` once per
task — are in `~/.agents/AGENTS.md` → Project context. When the user says "there is a rule / a decision",
look here first.

**Keep docs current in the same change, never later:** new or renamed term → `CONTEXT.md`;
user-visible behaviour → `PRODUCT.md`; commercial rule → `docs/business.md`; stack, data,
integration, deploy or security contract → `docs/architecture.md`; hard-to-reverse or trade-off
choice → ADR (`status: proposed`) + `INDEX.md` row; feature bigger than a fix → `specs/<ID>/product.md`
+ `tech.md` **before** code (copy `specs/_template/`); planned work → `docs/development-plan.md` task +
`TASKS.md` row, updated on start (owner, date, files) and finish (changed paths, checks, limits); procedure → its runbook; error or correction →
`lessons_learned.md`; stale doc seen in passing → fix it or add a `TASKS.md` row; new doc → a
Repo-specific docs row; a standing rule the user states → `PRODUCT.md` / `docs/business.md`,
never only tool memory.
<!-- project-context:end -->

### Repo-specific docs
| Doc | Read when |
| :--- | :--- |
| `docs/archive/` (local only) | Tracing why a past feature was built the way it was — superseded material, e.g. `ORIGINAL_REQUEST.md`, the 2026-09-03 orchestrator brief for the real-time SSE streaming engine (gitignored, local only) |

## Stack
<!-- claim: cmd=`grep '"next":' package.json` expect=`"next": "^14.2.29",` -->
<!-- claim: cmd=`grep '"react":' package.json` expect=`"react": "^18.3.1",` -->
<!-- claim: cmd=`grep '"mongoose":' package.json` expect=`"mongoose": "^8.19.2",` -->
<!-- claim: cmd=`grep '"tailwindcss":' package.json` expect=`"tailwindcss": "^3.4.19"` -->
Next.js 14 (App Router, `src/app/`), React 18, JavaScript (no TypeScript — `jsconfig.json` only), Tailwind CSS 3, MongoDB via Mongoose 8, JWT auth (`jsonwebtoken` + `bcryptjs`), Nodemailer for email. Deployed via Docker (`Dockerfile` + `docker-compose.yml`). Requires **Node >=21** — the `node --test "tests/*.test.mjs"` test glob needs Node 21+ for expansion (local runs Node 22; there is no `.nvmrc`).

## Commands — from `package.json` scripts (real, do not invent)
- Install: `npm install`
- Dev: `npm run dev`  (`next dev` — local dev server on :3000)
- Build: `npm run build`  (`next build`)
- Start (prod): `npm run start`  (`next start`)
- Lint: `npm run lint`  (`next lint`)
- Test: `npm test`  (`node --test "tests/*.test.mjs"` — Node built-in runner, no test deps; needs **Node >=21** for the glob)
<!-- claim: cmd=`grep '"test":' package.json` expect=`"test": "node --test \"tests/*.test.mjs\"",` -->
- Claims check: `npm run check:claims` (`node scripts/check-doc-claims.js` — repowiki claim anchor gate)
<!-- claim: cmd=`grep '"check:claims":' package.json` expect=`"check:claims": "node scripts/check-doc-claims.js"` -->
- No separate `install`/typecheck/format scripts exist. Typecheck: `<none configured>` (JS repo, no TypeScript).

## Strict Architecture Rules / Boundaries
- App Router only: routes and API handlers live under `src/app/` (`src/app/api/*` route handlers). Do not create a `pages/` directory.
- All DB access goes through Mongoose models in `src/models/` using the shared connection helper `src/lib/db.js` — never open ad-hoc connections in route handlers.
- Auth/session logic is centralized in `src/lib/auth.js` (server) and `src/lib/clientAuth.js` (client); email goes through `src/lib/mailer.js` (templates in `src/lib/email/`). Reuse these — do not re-implement JWT handling or mail transport inline.
- This is a JavaScript repo: new files are `.js`/`.jsx`, not `.ts`/`.tsx`.
- Generated / vendored dirs — never hand-edit or commit as source: `.next/`, `out/`, `node_modules/` (all in `.gitignore`). `.env*` files are gitignored — never commit secrets.
- `src/app/api/stream/route.js` provides the live Server-Sent Events (SSE) streaming endpoint for real-time tournament and match updates. `src/app/api/dev/email-preview/route.js` is a dev-only helper. Don't assume either is production behaviour.

## Where truth lives
- `README.md` — the high-fidelity domain reference (Next.js 14 routing map, Mongo schemas, Berger round-robin rotation, tiebreak resolution, disqualification impacts, rename cascades, score recalculation). Read it before touching tournament logic.
- `src/lib/tournament.js` — the pure tournament logic (standings, scoring, bracket/round-robin generation); no DB access.
- Deploy is Docker + Traefik on a shared VPS (`Dockerfile` + `docker-compose.yml`), NOT Vercel — there is no `vercel.json` / `maxDuration`.
<!-- claim: cmd=`git ls-files 'vercel.json' | wc -l` expect=`0` -->

## Do not guess — verify before use
Confirm each value against the cited source before using it; do not invent enum members, scores, or config keys.

- **Enums** (`src/models/Tournament.js`, `src/models/User.js`):
  - `Match.status`: `pending` | `completed` | `abandoned` (default `pending`)
  <!-- claim: cmd=`grep 'status: { type: String, enum:.*abandoned' src/models/Tournament.js` expect=`status: { type: String, enum: ['pending', 'completed', 'abandoned'], default: 'pending' },` -->
  - `Match.stageType`: `group` | `round-robin` | `knockout` | `semifinal` | `final` (default `knockout`)
  <!-- claim: cmd=`grep 'stageType: { type: String, enum:' src/models/Tournament.js` expect=`stageType: { type: String, enum: ['group', 'round-robin', 'knockout', 'semifinal', 'final'], default: 'knockout' },` -->
  - `Stage.type`: `round-robin` | `group` | `knockout` (required)
  <!-- claim: cmd=`grep 'type: { type: String, enum:.*round-robin' src/models/Tournament.js` expect=`type: { type: String, enum: ['round-robin', 'group', 'knockout'], required: true },` -->
  - `Stage.status`: `pending` | `active` | `awaiting-next-format` | `completed` (default `pending`)
  <!-- claim: cmd=`grep 'awaiting-next-format' src/models/Tournament.js` expect=`enum: ['pending', 'active', 'awaiting-next-format', 'completed'],` -->
  - `Tournament.initialFormat`: `round-robin` | `group` (required)
  <!-- claim: cmd=`grep 'initialFormat: {' src/models/Tournament.js` expect=`initialFormat: { type: String, enum: ['round-robin', 'group'], required: true },` -->
  - `Tournament.status`: `setup` | `in-progress` | `completed` (default `in-progress`)
  <!-- claim: cmd=`grep 'status: { type: String, enum:.*setup' src/models/Tournament.js` expect=`status: { type: String, enum: ['setup', 'in-progress', 'completed'], default: 'in-progress' },` -->
  - `User.role`: `admin` | `viewer` (default `admin`)
  <!-- claim: cmd=`grep 'role: { type: String, enum:' src/models/User.js` expect=`role: { type: String, enum: ['admin', 'viewer'], default: 'admin' },` -->
- **Scoring & standings** (`src/lib/tournament.js`, pure functions): win = **+3** (`buildGroupStandings`, L73), draw = **+1 to each** (L75), abandoned match = **−2 to EACH participant** (L64-66). `sortStandings` orders by points > goal-difference (`goalsFor − goalsAgainst`) > `goalsFor` (L82-85). Group stage advances the **top 2 non-disqualified** players per group (`advCount = 2`, L130). Knockout round names come from `knockoutLabel(n)`: 2=Final, 3-4=Semi-Final, 5-8=Quarter-Final, 9-16=Round of 16 (L89-97).
  <!-- claim: cmd=`grep 's1\.points += 3' src/lib/tournament.js` expect=`if (m.player1Score > m.player2Score) { s1.wins++; s1.points += 3; s2.losses++; }` -->
  <!-- claim: cmd=`grep 's1\.draws++' src/lib/tournament.js` expect=`else { s1.draws++; s1.points++; s2.draws++; s2.points++; }` -->
  <!-- claim: cmd=`grep 's1\.points -= 2' src/lib/tournament.js` expect=`s1.points -= 2; s2.points -= 2;` -->
  <!-- claim: cmd=`grep 'const advCount = 2' src/lib/tournament.js` expect=`const advCount = 2;` -->
- **Players are NAME STRINGS, never ObjectId refs**: `players`, `player1`/`player2`, `winner`, `standings.player`, and `disqualifiedPlayers` are all stored as strings (`Tournament.js` L6-10, 25, 61, 78). This is why `renameHistory` and rename cascades exist (`Tournament.js` L36-41). Do not model players as a separate collection or a ref.
- **`User` has `passwordHash`, not `password`, and no `name` field** (`src/models/User.js`): the
  document is `email` / `passwordHash` / `role` / `resetToken` / `resetTokenExpiry` / `createdAt`.
  Hashes on live data are 60-char bcrypt. Do not add a display-name field on a guess.
  <!-- claim: cmd=`grep -c 'passwordHash: { type: String, required: true }' src/models/User.js` expect=`1` -->
  <!-- claim: cmd=`grep -c 'name: {' src/models/User.js` expect=`0` -->
- **The JWT secret is read lazily, on purpose** (`getSecret()` in `src/lib/auth.js`). A
  module-scope `throw` for a missing `JWT_SECRET` breaks `next build`, because the build imports
  the module without the runtime env. Keep the check inside the function, and keep it
  production-only — the dev fallback secret is what lets the suite and `next dev` run unconfigured.
  <!-- claim: cmd=`grep -c 'function getSecret()' src/lib/auth.js` expect=`1` -->
- **`MONGODB_URI` config trap**: `src/lib/db.js` reads `process.env.MONGODB_URI` and throws if unset. For local dev, set `MONGODB_URI` directly. For the Docker/compose path, **do NOT set `MONGODB_URI`** — `docker-compose.yml` builds it from `MONGO_USER` / `MONGO_PASS` / `MONGO_DB`, and those only take effect on the first (empty-volume) Mongo init (see `.env.local.example`).
- **Reusable auth/db/mail helpers — do not reinvent**: `signToken` / `verifyToken` / `authenticateRequest` / `requireAdmin` (`src/lib/auth.js`; `TOKEN_TTL = '7d'`, dev-only fallback secret when `JWT_SECRET` unset outside production), `connectDB` (`src/lib/db.js`), mailer (`src/lib/mailer.js`).
  <!-- claim: cmd=`grep 'export const TOKEN_TTL' src/lib/auth.js` expect=`export const TOKEN_TTL = '7d';` -->

## Verification — run before declaring any change done
- Typecheck: none configured (JavaScript project, no TypeScript; `checkJs` was tried and rejected — ~700 errors, needs `@types/node` etc.)
- Tests: `npm test`  (`node --test "tests/*.test.mjs"`, Node built-in runner, zero test deps; guards the pure tournament logic in `src/lib/tournament.js`)
- Lint: `npm run lint`  (`next lint`)
- Build: `npm run build`  (`next build`)
- Claims: `npm run check:claims`  (`node scripts/check-doc-claims.js`, repowiki claim anchor gate)

**What this gate cannot see.** `npm test` touches no database and no network — it exercises the
pure logic in `src/lib/tournament.js` and the SSE helpers, nothing else. No test covers a route
handler, a Mongoose write, an email, or a rendered page, and there is no typecheck to catch a
renamed field. If your change alters what a user sees or what gets written, run `npm run dev`
against a real `MONGODB_URI`, exercise the flow, and say what you saw — or mark it UNVERIFIED.

## Running system

**Deploy is the user's call, and pushing is too** — the rule is `~/.agents/AGENTS.md` → DevOps.
`scripts/deploy.sh` is a real deploy; never run it to "see it working", use `npm run dev`.

Live at **https://tournaments.rafi.ninja** (and `tournament.rafi.ninja`, one LE cert, both SANs).
MEASURED 2026-06-22; nothing has re-checked since, so re-verify before relying on it.
- **Host `raafii@204.168.225.250`**, checkout `/srv/apps/tournament_manager`. A shared
  multi-tenant VPS — luxotix, invoice, rafi_ninja, notebook_ninja and a shared Postgres live on
  the same box. An action scoped to "this app" can take a neighbour down.
- Edge is **one shared Traefik v3.7.5** at root-owned `/opt/traefik`: external network `traefik`,
  entrypoint `websecure`, ACME resolver `le`, global HTTP→HTTPS redirect. This app publishes **no
  host port** — it is reached through Traefik labels only, and needs `traefik.docker.network`
  because it sits on two networks. Router base name `tournament` does not collide.
- Mongo is **bundled and internal-only** (`mongod --auth`, named volume `mongo_data`); this app
  does not touch the shared Postgres. `MONGO_USER`/`MONGO_PASS` apply on **first init only**, i.e.
  an empty volume — changing them later does nothing.
- Compose declares a top-level `name: ${APP_PREFIX:-tournament}` and pinned `container_name`s, so
  the stack is isolated even from a bare `docker compose up`. Keep it that way.
  <!-- claim: cmd=`grep -c '^name: ' docker-compose.yml` expect=`1` -->
- Health route is `/api/health` → `{"ok":true}`; `scripts/deploy.sh` gates on it.
  <!-- claim: cmd=`git ls-files 'src/app/api/health/route.js' | wc -l` expect=`1` -->
- Known open item: SMTP is blank in the VPS `.env`, so password-reset email does not send there.

Ops history that is not a rule (Atlas decommission, the Postgres consolidation on this box) is in
the session memory notes, not here.

## AI layer
No AI/LLM code exists here. The forward design (use-cases + 4-pillar plan) is
[docs/architecture.md → AI layer](docs/architecture.md#ai-layer) (scheduling:
[docs/development-plan.md → AI layer](docs/development-plan.md#ai-layer-not-scheduled)); the standard it
follows is `~/.agents/ai-engineering.md`.

## Knowledge graph (graphify)
`graphify-out/` exists here and is gitignored and regenerable (`graphify update .`). Prefer
`graphify query "<question>"` over grep for a codebase question, and re-run `graphify update .`
after editing code. The rest — what it is, never committing it, never asking for an API key — is
`~/.agents/AGENTS.md` → Global skills.
<!-- claim: cmd=`grep -c 'graphify-out' .gitignore` expect=`1` -->

<!-- repowiki: audited-at cded8118f1b324c2acab8565e5d61732e4a24fdd on 2026-08-30 -->
