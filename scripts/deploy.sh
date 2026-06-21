#!/usr/bin/env bash
# ==============================================================================
# Docker deployment for tournament_manager on the shared Traefik VPS.
# Pattern: Traefik labels (no host port) + bundled Mongo, at tournaments.rafi.ninja.
# Safe on a multi-tenant host: fast-forward pulls only, project-scoped cleanup.
# ==============================================================================
set -euo pipefail

# Run from the project root (this script lives in <root>/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(dirname "$SCRIPT_DIR")"

echo "🚀 Deploying tournament_manager..."

# 1. Require the env file. Compose substitutes ${...} from it (creds, domain,
#    Traefik names) — it is gitignored and must never be committed.
if [ ! -f .env ]; then
  echo "❌ .env not found in project root."
  echo "   Copy .env.local.example -> .env and set at least:"
  echo "   APP_DOMAIN, NEXT_PUBLIC_APP_URL, JWT_SECRET, MONGO_USER, MONGO_PASS"
  exit 1
fi

# 2. Pull latest code — fast-forward only, never reset (shared host safety).
echo "📥 Pulling latest changes (fast-forward only)..."
git pull --ff-only

# 3. Validate the merged config + required vars BEFORE touching containers.
echo "🔎 Validating compose config..."
docker compose config -q

# 4. Build the image and (re)create containers with zero-downtime replace.
echo "🐳 Building image and (re)creating containers..."
docker compose up --build -d --remove-orphans

# 5. Gate on app health so a broken deploy fails here, not as a Traefik 502.
APP_PREFIX_VALUE="$(grep -E '^APP_PREFIX=' .env | cut -d= -f2- | tr -d '"' || true)"
APP_CONTAINER="${APP_PREFIX_VALUE:-tournament}_app"
echo "⏳ Waiting for ${APP_CONTAINER} to become healthy..."
for i in $(seq 1 36); do
  status="$(docker inspect -f '{{ if .State.Health }}{{ .State.Health.Status }}{{ else }}none{{ end }}' "$APP_CONTAINER" 2>/dev/null || echo missing)"
  if [ "$status" = "healthy" ]; then echo "✅ ${APP_CONTAINER} healthy."; break; fi
  if [ "$i" -eq 36 ]; then
    echo "❌ ${APP_CONTAINER} not healthy after timeout (status=${status}). Recent logs:"
    docker compose logs --tail 50 app || true
    exit 1
  fi
  sleep 5
done

# 6. Reclaim space — DANGLING images only. Never -a / container / volume /
#    network prune: those cross project boundaries on this shared VPS.
echo "🧹 Pruning dangling images..."
docker image prune -f

APP_DOMAIN_VALUE="$(grep -E '^APP_DOMAIN=' .env | cut -d= -f2- | tr -d '"' || true)"
echo "✅ Deployment complete."
echo "   URL: https://${APP_DOMAIN_VALUE:-<APP_DOMAIN from .env>}"
docker compose ps
