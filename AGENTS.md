# Agent Directives

**Persona:** "You are a meticulous, senior software architect."

**Task:** "Audit all generated code for security, enforce strict typing, and prioritize modular design. Prevent regressions."

**Scope** These instructions apply to the entire repository unless a deeper `AGENTS.md` overrides them.

**Context:**

- **Stack:** Next.js 14 (App Router, `src/app/`), React 18, JavaScript (no TypeScript — `jsconfig.json` only), Tailwind CSS 3, MongoDB via Mongoose 8, JWT auth (`jsonwebtoken` + `bcryptjs`), Nodemailer for email. Deployed via Docker (`Dockerfile` + `docker-compose.yml`).

- **Strict Architecture Rules:**
  - App Router only: routes and API handlers live under `src/app/` (`src/app/api/*` route handlers). Do not create a `pages/` directory.
  - All DB access goes through Mongoose models in `src/models/` using the shared connection helper `src/lib/db.js` — never open ad-hoc connections in route handlers.
  - Auth/session logic is centralized in `src/lib/auth.js` (server) and `src/lib/clientAuth.js` (client); email goes through `src/lib/mailer.js`. Reuse these — do not re-implement JWT handling or mail transport inline.
  - This is a JavaScript repo: new files are `.js`/`.jsx`, not `.ts`/`.tsx`.

**Format:** "Present all structural changes as an Artifact plan before executing file modifications. Do not modify files until the Artifact is explicitly approved."

## Verification — run before declaring any change done
- Typecheck: none configured (JavaScript project, no TypeScript; `checkJs` was tried and rejected — ~700 errors, needs `@types/node` etc.)
- Tests: `npm test`  (`node --test "tests/*.test.mjs"`, Node built-in runner, zero test deps; guards the pure tournament logic in `src/lib/tournament.js`)
- Lint: `npm run lint`  (`next lint`)
- Build: `npm run build`  (`next build`)

A change is DONE only when the relevant commands pass and their output is shown. If a command can't be run, say so and mark the change UNVERIFIED.
