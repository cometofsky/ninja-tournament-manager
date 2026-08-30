# tournament_manager_next

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
- `src/app/api/stream/route.js` is a **placeholder** returning `501 Not Implemented` — there is no live SSE/real-time layer yet. `src/app/api/dev/email-preview/route.js` is a dev-only helper. Don't assume either is production behaviour.

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
- **`MONGODB_URI` config trap**: `src/lib/db.js` reads `process.env.MONGODB_URI` and throws if unset. For local dev, set `MONGODB_URI` directly. For the Docker/compose path, **do NOT set `MONGODB_URI`** — `docker-compose.yml` builds it from `MONGO_USER` / `MONGO_PASS` / `MONGO_DB`, and those only take effect on the first (empty-volume) Mongo init (see `.env.local.example`).
- **Reusable auth/db/mail helpers — do not reinvent**: `signToken` / `verifyToken` / `authenticateRequest` / `requireAdmin` (`src/lib/auth.js`; `TOKEN_TTL = '7d'`, dev-only fallback secret when `JWT_SECRET` unset outside production), `connectDB` (`src/lib/db.js`), mailer (`src/lib/mailer.js`).
  <!-- claim: cmd=`grep 'export const TOKEN_TTL' src/lib/auth.js` expect=`export const TOKEN_TTL = '7d';` -->

## Verification — run before declaring any change done
- Typecheck: none configured (JavaScript project, no TypeScript; `checkJs` was tried and rejected — ~700 errors, needs `@types/node` etc.)
- Tests: `npm test`  (`node --test "tests/*.test.mjs"`, Node built-in runner, zero test deps; guards the pure tournament logic in `src/lib/tournament.js`)
- Lint: `npm run lint`  (`next lint`)
- Build: `npm run build`  (`next build`)
- Claims: `npm run check:claims`  (`node scripts/check-doc-claims.js`, repowiki claim anchor gate)

A change is DONE only when the relevant commands pass and their output is shown. If a command can't be run, say so and mark the change UNVERIFIED.

## AI layer (planned)

No AI/LLM code in this repo today. This is a forward design; follow the global 4-pillar standard (`~/.agents/ai-engineering.md`) when implementing — do not restate it here.

**Candidate use-cases** (grounded in this app's real domain — tournaments, matches, standings, name-string players):
- **Natural-language tournament setup** — admin types "8 players, round-robin then knockout the top 2" on `src/app/create/`; the model emits a validated config (`initialFormat`, player list, stage plan) instead of hand-filling the form. Value: removes the biggest setup friction.
- **Match recaps / standings narratives** — turn a tournament's completed matches + `buildGroupStandings` output into a shareable plain-language summary or bracket commentary. Value: viewer engagement without an admin writing it.
- **Player-name normalization assistant** — flag likely typo/duplicate variants of the same name-string player and propose a rename, feeding the existing rename-cascade path (`renameHistory`, `Tournament.js`). Value: fewer split standings from misspelled names.

**Pillar plan (when built):**
- **Prompt** — bind outputs to the *existing* Mongoose enums as the JSON schema: `initialFormat` ∈ {`round-robin`,`group`}, `Stage.type`, `Match.stageType`/`status` (source of truth: `src/models/Tournament.js`). Untrusted input enters at the NL setup box and at player-name strings — validate the parsed object against those enums before it touches a model.
- **Context** — ground on a single tournament document (config + matches + `src/lib/tournament.js` standings) plus the rules prose in `README.md`. One tournament fits easily in context, so no vector store/RAG; keep the rules + schema in a cached system prompt and pass only the live tournament JSON per call.
- **Harness** — put the provider seam in a new `src/lib/ai.js` beside `mailer.js`/`auth.js`, mirroring the mailer's never-raise posture (return a structured failure, never throw into a route handler); it must be `async` and non-blocking. Consume it from a new `src/app/api/**/route.js` handler behind `requireAdmin`. Re-validate every model output against the enums above before any DB write.
- **Loop** — single-shot structured generation is sufficient for setup and recaps. Any output that mutates tournament state (setup config, name renames) is high-stakes — it shifts standings/brackets — so gate it behind an explicit **admin approval step**: the model proposes, the admin confirms, then the existing write path applies it. No autonomous writes.

<!-- repowiki: audited-at cded8118f1b324c2acab8565e5d61732e4a24fdd on 2026-08-30 -->
