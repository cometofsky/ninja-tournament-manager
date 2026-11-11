# Decision log — tournament_manager_next

One file per decision: `docs/adr/NNNN-short-slug.md`, numbered sequentially (highest + 1).
Never edit an accepted ADR: write a new one that supersedes it, set the old one's status to
`superseded by ADR-NNNN`, and update `PRODUCT.md` / `docs/business.md` in the same commit.
Add one row below per ADR.

Write one only when the choice is hard to reverse, surprising without context, or a real
trade-off (criteria: `~/.agents/skills/grill-with-docs/ADR-FORMAT.md`), or when a product or
business gap had to be asked about.

```md
---
status: proposed        # proposed | accepted | superseded by ADR-NNNN — only a human sets accepted
type: product           # technical | product | business
area: auth, billing     # tags an agent matches against the code it is about to change
date: YYYY-MM-DD
decided-by:             # the person who accepted it; empty while proposed
---
# NNNN. Short title

Context, the decision, and why — 1–3 sentences. Add "Considered options" or "Consequences"
only when they earn their place.
```

## Index

| ADR | Title | Type | Area | Status |
|---|---|---|---|---|
| [0001](0001-creator-only-archive-and-delete.md) | Tournaments can be archived or deleted — by their creator only | product | tournaments, auth, dashboard | proposed |
| [0002](0002-canonical-hostname-redirect.md) | One canonical hostname; the alias 301-redirects to it | technical | deploy, auth, traefik | proposed |
