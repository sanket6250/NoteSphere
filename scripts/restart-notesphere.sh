#!/usr/bin/env bash
set -euo pipefail

stack_label="${STACK_LABEL:-production}"
container_ids=()

for service in backend frontend; do
  container_id="$(docker ps -q --filter "label=com.notesphere.stack=${stack_label}" --filter "label=com.notesphere.service=${service}" | head -n 1)"
  if [[ -z "$container_id" ]]; then
    echo "No running ${service} container found for stack label ${stack_label}." >&2
    exit 1
  fi
  container_ids+=("$container_id")
done

docker restart "${container_ids[@]}"
echo "Application containers restarted. PostgreSQL, object storage, and volumes were not changed."
