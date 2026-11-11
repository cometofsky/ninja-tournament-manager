---
status: proposed
type: product
area: tournaments, auth, dashboard
date: 2026-11-12
decided-by:
---
# 0001. Tournaments can be archived or deleted — by their creator only

User feedback: there was no way to remove a tournament. The owner chose both: **archive** (hidden
from the dashboard's All/Active/Completed lists, listed under an Archived tab, reversible) and
**permanent delete** (behind an inline confirmation). Both are limited to the admin whose id is the
tournament's `createdBy`, because `/api/auth/register` is open and every new account is an `admin` —
with "any admin" permission a stranger could sign up and delete every tournament.

## Consequences
- Tournaments without a `createdBy` cannot be archived or deleted by anyone through the app.
- Archiving changes visibility only; an archived tournament still opens by URL and can still be edited.
- Other admin actions (scores, rename, disqualify, advance) remain open to any admin.
