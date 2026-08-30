---
name: create_next_api
description: Best practices and boilerplate for creating a new Next.js App Router API endpoint in tournament-manager-next.
---

# Create Next API Skill

When creating a new API endpoint in `tournament_manager_next`, strictly follow these constraints:

1. **Routing**: Create your handler in `src/app/api/.../route.js`. Use pure JavaScript (no TypeScript).
2. **Database Access**: You MUST use the shared connection helper `src/lib/db.js`. Do not open ad-hoc connections. Import Mongoose models from `src/models/`.
3. **Authentication**: If the route requires admin access or authentication, use `authenticateRequest` and `requireAdmin` from `src/lib/auth.js`.
4. **Data Isolation**: API routes should handle HTTP context and MongoDB fetching. All pure tournament logic MUST remain in `src/lib/tournament.js`.
5. **Verification**: After implementing, run `.agents/tools/run_strict_checks.sh` to ensure it passes linting, pure logic tests, and builds successfully.
