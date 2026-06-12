#!/usr/bin/env bash
# mobile-acp server setup
# Usage:  curl -fsSL https://raw.githubusercontent.com/Rong-Tao/mobile-acp/main/server/install.sh | bash
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/Rong-Tao/mobile-acp/main"
SETUP_DIR="${HOME}/.local/share/mobile-acp-setup"

# ── checks ────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "✗ Node.js not found. Install from https://nodejs.org (v18+)" >&2
  exit 1
fi

node_major=$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')
if [ "$node_major" -lt 18 ]; then
  echo "✗ Node.js 18+ required (found $(node -v))" >&2
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "✗ npm not found (comes with Node.js)" >&2
  exit 1
fi

# ── install ───────────────────────────────────────────────────
mkdir -p "$SETUP_DIR"

echo "Downloading mobile-acp-setup…"
curl -fsSL "${REPO_RAW}/server/setup.mjs" -o "${SETUP_DIR}/setup.mjs"

if [ ! -d "${SETUP_DIR}/node_modules/qrcode" ]; then
  echo '{"type":"module","dependencies":{"qrcode":"^1.5.4"}}' > "${SETUP_DIR}/package.json"
  npm install --prefix "$SETUP_DIR" --silent --no-fund --no-audit
fi

# ── run (stdin from /dev/tty so interactive prompts work) ─────
exec node "${SETUP_DIR}/setup.mjs" </dev/tty
