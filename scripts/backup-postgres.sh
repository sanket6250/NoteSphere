#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${PG_CONTAINER:?Set PG_CONTAINER to the running PostgreSQL container name or ID}"
: "${PG_USER:?Set PG_USER to the PostgreSQL role}"
: "${PG_DATABASE:?Set PG_DATABASE to the database name}"
: "${BACKUP_DIR:?Set BACKUP_DIR to a protected backup directory}"

if ! docker inspect "$PG_CONTAINER" >/dev/null 2>&1; then
  echo "PostgreSQL container not found: $PG_CONTAINER" >&2
  exit 1
fi
mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/notesphere-${PG_DATABASE}-${timestamp}.dump"
partial_file="${backup_file}.partial"
set -o noclobber
docker exec "$PG_CONTAINER" pg_dump --format=custom --no-owner --no-acl \
  --username="$PG_USER" --dbname="$PG_DATABASE" >"$partial_file"
mv "$partial_file" "$backup_file"
printf 'Database backup created: %s\n' "$backup_file"
