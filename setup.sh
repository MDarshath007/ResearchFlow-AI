#!/usr/bin/env bash
# =============================================================================
# ResearchFlow — Automated Environment Setup Script
# =============================================================================
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
#
# What this script does:
#   1. Checks for required tools (Node.js >= 18, npm >= 9)
#   2. Installs all backend dependencies  (server/)
#   3. Installs all frontend dependencies (client/)
#   4. Scaffolds .env files from .env.example if they don't exist yet
#   5. Prints next-step instructions
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════════╗"
echo "║        ResearchFlow — Environment Setup          ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ---------------------------------------------------------------------------
# 1. Prerequisite checks
# ---------------------------------------------------------------------------
info "Checking prerequisites…"

# Node.js
if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Install v18 or higher from https://nodejs.org/"
fi

NODE_VERSION=$(node -e "process.stdout.write(process.versions.node)")
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  error "Node.js v${NODE_VERSION} detected — v18 or higher is required."
fi
success "Node.js v${NODE_VERSION}"

# npm
if ! command -v npm &>/dev/null; then
  error "npm is not installed. It usually ships with Node.js."
fi
NPM_VERSION=$(npm --version)
success "npm v${NPM_VERSION}"

# ---------------------------------------------------------------------------
# 2. Install backend dependencies
# ---------------------------------------------------------------------------
echo ""
info "Installing server/ dependencies…"
(cd server && npm install)
success "server/ dependencies installed."

# ---------------------------------------------------------------------------
# 3. Install frontend dependencies
# ---------------------------------------------------------------------------
echo ""
info "Installing client/ dependencies…"
(cd client && npm install)
success "client/ dependencies installed."

# ---------------------------------------------------------------------------
# 4. Scaffold .env files from examples
# ---------------------------------------------------------------------------
echo ""
info "Setting up environment files…"

if [ ! -f "server/.env" ]; then
  cp server/.env.example server/.env
  warn "server/.env created from .env.example — please fill in your secrets."
else
  success "server/.env already exists — skipping."
fi

if [ ! -f "client/.env" ]; then
  cp client/.env.example client/.env
  warn "client/.env created from .env.example — review values if needed."
else
  success "client/.env already exists — skipping."
fi

# ---------------------------------------------------------------------------
# 5. Done — print next steps
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}✔  Setup complete!${RESET}"
echo ""
echo -e "${BOLD}Next steps:${RESET}"
echo "  1. Edit ${YELLOW}server/.env${RESET} and fill in MONGO_URI, JWT_SECRET, GEMINI_API_KEY."
echo "  2. Start the backend :  cd server && npm run dev   (http://localhost:5000)"
echo "  3. Start the frontend:  cd client && npm run dev   (http://localhost:5173)"
echo ""
echo -e "  Or from the repo root, use:"
echo -e "    ${CYAN}npm run dev:server${RESET}   — starts the Express backend"
echo -e "    ${CYAN}npm run dev:client${RESET}   — starts the Vite dev server"
echo -e "    ${CYAN}npm run build${RESET}         — production bundle (client/dist/)"
echo ""
