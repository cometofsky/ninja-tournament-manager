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
