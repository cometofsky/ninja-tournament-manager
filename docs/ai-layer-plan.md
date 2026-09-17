# AI layer — forward design (nothing is built)

No AI/LLM code exists in this repo. This is a plan, not a rule, so it lives here instead of in
`AGENTS.md`, which loads into every session of every tool. When implementing, follow the global
4-pillar standard (`~/.agents/ai-engineering.md`) — it is not restated here.

**Candidate use-cases** (grounded in this app's real domain — tournaments, matches, standings, name-string players):
- **Natural-language tournament setup** — admin types "8 players, round-robin then knockout the top 2" on `src/app/create/`; the model emits a validated config (`initialFormat`, player list, stage plan) instead of hand-filling the form. Value: removes the biggest setup friction.
- **Match recaps / standings narratives** — turn a tournament's completed matches + `buildGroupStandings` output into a shareable plain-language summary or bracket commentary. Value: viewer engagement without an admin writing it.
- **Player-name normalization assistant** — flag likely typo/duplicate variants of the same name-string player and propose a rename, feeding the existing rename-cascade path (`renameHistory`, `Tournament.js`). Value: fewer split standings from misspelled names.

**Pillar plan (when built):**
- **Prompt** — bind outputs to the *existing* Mongoose enums as the JSON schema: `initialFormat` ∈ {`round-robin`,`group`}, `Stage.type`, `Match.stageType`/`status` (source of truth: `src/models/Tournament.js`). Untrusted input enters at the NL setup box and at player-name strings — validate the parsed object against those enums before it touches a model.
- **Context** — ground on a single tournament document (config + matches + `src/lib/tournament.js` standings) plus the rules prose in `README.md`. One tournament fits easily in context, so no vector store/RAG; keep the rules + schema in a cached system prompt and pass only the live tournament JSON per call.
- **Harness** — put the provider seam in a new `src/lib/ai.js` beside `mailer.js`/`auth.js`, mirroring the mailer's never-raise posture (return a structured failure, never throw into a route handler); it must be `async` and non-blocking. Consume it from a new `src/app/api/**/route.js` handler behind `requireAdmin`. Re-validate every model output against the enums above before any DB write.
- **Loop** — single-shot structured generation is sufficient for setup and recaps. Any output that mutates tournament state (setup config, name renames) is high-stakes — it shifts standings/brackets — so gate it behind an explicit **admin approval step**: the model proposes, the admin confirms, then the existing write path applies it. No autonomous writes.
