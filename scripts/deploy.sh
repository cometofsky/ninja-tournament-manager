#!/usr/bin/env bash

# ==============================================================================
# Bare-Metal Next.js Deployment Script for VPS
# ==============================================================================
# This script deploys the application directly on the host (VPS) using PM2,
# designed to work alongside other dockerized applications behind a Traefik proxy.
# ==============================================================================

set -euo pipefail

# Color codes for clean output logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0;m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# 1. Prerequisite Checks
log_info "Verifying prerequisites..."

for cmd in git node npm pm2; do
  if ! command -v "$cmd" &> /dev/null; then
    log_error "Required tool '$cmd' is not installed or not in PATH."
    if [ "$cmd" = "pm2" ]; then
      log_info "You can install PM2 globally via: npm install -g pm2"
    fi
    exit 1
  fi
done
log_success "Prerequisites verified successfully."

# Navigate to the repository root (script directory is project/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Load environment variables if present to determine PORT
PORT=3000
if [ -f .env.production ]; then
  log_info "Loading environment from .env.production..."
  # Export variables while ignoring comments
  export $(grep -v '^#' .env.production | xargs)
elif [ -f .env.local ]; then
  log_info "Loading environment from .env.local..."
  export $(grep -v '^#' .env.local | xargs)
elif [ -f .env ]; then
  log_info "Loading environment from .env..."
  export $(grep -v '^#' .env | xargs)
fi

# Ensure PORT is defined (either from environment file or default)
PORT=${PORT:-3000}
log_info "Application will run on port: $PORT"

# 2. Pull latest changes
log_info "Pulling latest updates from git repository..."
git pull --ff-only
log_success "Repository updated successfully."

# 3. Clean installation of dependencies
log_info "Installing dependencies..."
npm ci
log_success "Dependencies installed."

# 4. Build the application for production
log_info "Building Next.js application..."
npm run build
log_success "Application built successfully."

# 5. Process Management (PM2)
log_info "Managing PM2 application instance..."
APP_NAME="tournament-manager"

# Check if application is already registered in PM2
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  log_info "Application '$APP_NAME' is running. Restarting with updated environment..."
  PORT=$PORT pm2 restart "$APP_NAME" --update-env
  log_success "Application restarted."
else
  log_info "Application '$APP_NAME' is not running. Starting new instance..."
  PORT=$PORT pm2 start npm --name "$APP_NAME" --update-env -- start
  log_success "Application started."
fi

# Save PM2 state so it persists across system reboots
pm2 save

echo -e "\n=============================================================================="
log_success "Deployment completed successfully!"
echo -e "=============================================================================="
echo -e "\nTo access this host application via Traefik, choose one of the options below:"
echo -e "\n${YELLOW}Option 1: Lightweight Docker Proxy (Recommended)${NC}"
echo -e "Run this container on your Traefik network (e.g., 'traefik-net'):"
echo -e "------------------------------------------------------------------------------"
echo -e "docker run -d --name ${APP_NAME}-proxy \\"
echo -e "  --network traefik-net \\"
echo -e "  --restart always \\"
echo -e "  --add-host=host.docker.internal:host-gateway \\"
echo -e "  --label \"traefik.enable=true\" \\"
echo -e "  --label \"traefik.http.routers.${APP_NAME}.rule=Host(\`tournament.yourdomain.com\`)\" \\"
echo -e "  --label \"traefik.http.routers.${APP_NAME}.entrypoints=websecure\" \\"
echo -e "  --label \"traefik.http.routers.${APP_NAME}.tls=true\" \\"
echo -e "  --label \"traefik.http.routers.${APP_NAME}.tls.certresolver=myresolver\" \\"
echo -e "  --label \"traefik.http.services.${APP_NAME}.loadbalancer.server.port=${PORT}\" \\"
echo -e "  alpine/socat TCP-LISTEN:${PORT},fork TCP:host.docker.internal:${PORT}"
echo -e "------------------------------------------------------------------------------"

echo -e "\n${YELLOW}Option 2: Traefik File Provider (Dynamic Config)${NC}"
echo -e "Place the following YAML in your Traefik dynamic configuration folder:"
echo -e "------------------------------------------------------------------------------"
echo -e "http:"
echo -e "  routers:"
echo -e "    ${APP_NAME}:"
echo -e "      rule: \"Host(\`tournament.yourdomain.com\`)\""
echo -e "      service: ${APP_NAME}-service"
echo -e "      entryPoints:"
echo -e "        - websecure"
echo -e "      tls:"
echo -e "        certResolver: myresolver"
echo -e ""
echo -e "  services:"
echo -e "    ${APP_NAME}-service:"
echo -e "      loadBalancer:"
echo -e "        servers:"
echo -e "          - url: \"http://172.17.0.1:${PORT}\"  # Host IP address on docker0"
echo -e "------------------------------------------------------------------------------"
echo -e "=============================================================================="
