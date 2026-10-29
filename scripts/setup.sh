#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../app"
node -e 'if (+process.versions.node.split(".")[0] < 22) { console.error("Node 22+ required, see app/.nvmrc"); process.exit(1) }'
npm ci
npm run validate:customer
npm test
echo "Ready. Run: cd app && npm run dev"
