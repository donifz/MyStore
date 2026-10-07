#!/usr/bin/env bash
set -euo pipefail
export WEB_ORIGINS="${WEB_ORIGINS:-${RENDER_EXTERNAL_URL:?Set WEB_ORIGINS or RENDER_EXTERNAL_URL}}"
node apps/api/dist/scripts/migrate.js
node apps/api/dist/scripts/bootstrap.js
exec node apps/api/dist/main.js
