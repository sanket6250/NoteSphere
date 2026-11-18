#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="${COMPOSE_FILE:-$project_root/compose.coolify.yaml}"
env_file="${COOLIFY_ENV_FILE:-$project_root/.env}"

if [[ ! -f "$compose_file" ]]; then
  echo "Compose file not found: $compose_file" >&2
  exit 1
fi
if [[ ! -f "$env_file" ]]; then
  echo "Environment file not found: $env_file. Create it from .env.example and set unique secrets." >&2
  exit 1
fi
if grep -Eq 'CHANGE_ME|REPLACE_ME|YOUR_[A-Z_]*_HERE' "$env_file"; then
  echo "The environment file still contains placeholder values." >&2
  exit 1
fi
if ! docker network inspect coolify >/dev/null 2>&1; then
  echo "The Coolify proxy network does not exist. Install Coolify first or deploy this stack through Coolify." >&2
  exit 1
fi

chmod 600 "$env_file"
docker compose --env-file "$env_file" -f "$compose_file" config --quiet
docker compose --env-file "$env_file" -f "$compose_file" up -d --build
echo "Compose deployment requested. This script does not create a public domain or delete volumes."
