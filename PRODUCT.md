# Product rules — tournament_manager_next

Current product rules only: what is true **now**. When a rule changes, edit it here in the same
commit as the ADR that changed it, and link the rule to that decision, e.g. `(→ ADR-0003)`.
A rule without an ADR is still valid; write one when the rule is questioned or changed.

## Users and roles

## Core flows

- **Archive / delete a tournament:** the creator opens the tournament and uses the "Archive or
  delete" panel at the bottom. Archive hides it from the dashboard's All / Active / Completed tabs
  and stats; it is listed under the Archived tab and can be restored. Delete is permanent and asks
  for an inline confirmation first. (→ ADR-0001)
- **Admin session:** a login lasts 7 days on the canonical host; the alias host redirects there so
  there is one login. (→ ADR-0002)

## Must / must not
- Only a tournament's creator may archive, restore or delete it — never any other admin. (→ ADR-0001)
