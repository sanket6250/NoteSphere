#!/usr/bin/env bash
set -euo pipefail

stack_label="${STACK_LABEL:-production}"
services=(postgres object-storage backend frontend)
failures=0

for service in "${services[@]}"; do
  container_id="$(docker ps -q --filter "label=com.notesphere.stack=${stack_label}" --filter "label=com.notesphere.service=${service}" | head -n 1)"
  if [[ -z "$container_id" ]]; then
    printf 'FAIL: no running container found for %s\n' "$service"
    failures=$((failures + 1))
    continue
  fi

  state="$(docker inspect --format '{{.State.Status}}' "$container_id")"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}not-configured{{end}}' "$container_id")"
  printf '%-14s state=%s health=%s\n' "$service" "$state" "$health"
  if [[ "$state" != running ]]; then
    failures=$((failures + 1))
  elif [[ "$service" != object-storage && "$health" != healthy ]]; then
    failures=$((failures + 1))
  fi
done

initializer_id="$(docker ps -aq --filter "label=com.notesphere.stack=${stack_label}" --filter label=com.notesphere.service=storage-initializer | head -n 1)"
if [[ -z "$initializer_id" ]]; then
  printf 'FAIL: storage bucket initializer container was not found\n'
  failures=$((failures + 1))
else
  initializer_status="$(docker inspect --format '{{.State.Status}} {{.State.ExitCode}}' "$initializer_id")"
  printf 'storage-init   state=%s\n' "$initializer_status"
  if [[ "$initializer_status" != "exited 0" ]]; then
    failures=$((failures + 1))
  fi
fi

if [[ -n "${PUBLIC_URL:-}" ]]; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "PUBLIC_URL was set but curl is not installed." >&2
    failures=$((failures + 1))
  elif ! curl --fail --silent --show-error --max-time 10 "${PUBLIC_URL%/}/health" >/dev/null; then
    printf 'FAIL: frontend health URL did not respond: %s/health\n' "${PUBLIC_URL%/}"
    failures=$((failures + 1))
  else
    printf 'HTTP health check passed: %s/health\n' "${PUBLIC_URL%/}"
  fi
fi

if (( failures > 0 )); then
  printf 'Deployment verification failed (%s issue(s)).\n' "$failures" >&2
  exit 1
fi
echo "Deployment verification passed."
