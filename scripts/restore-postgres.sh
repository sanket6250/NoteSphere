#!/usr/bin/env bash
set -euo pipefail

: "${PG_CONTAINER:?Set PG_CONTAINER to the running PostgreSQL container name or ID}"
: "${PG_USER:?Set PG_USER to the PostgreSQL role}"
: "${PG_APP_USER:?Set PG_APP_USER to the restricted application role}"
: "${BACKUP_FILE:?Set BACKUP_FILE to a custom-format pg_dump file}"
: "${RESTORE_DB:?Set RESTORE_DB to a new database name}"

if [[ ! -r "$BACKUP_FILE" ]]; then
  echo "Backup file is not readable: $BACKUP_FILE" >&2
  exit 1
fi
if [[ ! "$RESTORE_DB" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]; then
  echo "RESTORE_DB must be a PostgreSQL identifier of at most 63 safe characters." >&2
  exit 1
fi
if ! docker inspect "$PG_CONTAINER" >/dev/null 2>&1; then
  echo "PostgreSQL container not found: $PG_CONTAINER" >&2
  exit 1
fi

docker exec -i "$PG_CONTAINER" pg_restore --list <"$BACKUP_FILE" >/dev/null
existing="$(docker exec "$PG_CONTAINER" psql --username="$PG_USER" --dbname=postgres --tuples-only --no-align \
  --command="SELECT 1 FROM pg_database WHERE datname = '${RESTORE_DB}'")"
if [[ "$existing" == 1 ]]; then
  echo "Database ${RESTORE_DB} already exists. Restore is refused; choose a new empty database name." >&2
  exit 1
fi

docker exec "$PG_CONTAINER" createdb --username="$PG_USER" --owner="$PG_APP_USER" "$RESTORE_DB"
docker exec -i "$PG_CONTAINER" pg_restore --exit-on-error --no-owner --no-acl \
  --username="$PG_USER" --role="$PG_APP_USER" --dbname="$RESTORE_DB" <"$BACKUP_FILE"
printf 'Restored into new database %s. The source database was not changed.\n' "$RESTORE_DB"
echo "If restore failed, the new database may be partial; it has intentionally not been deleted."
