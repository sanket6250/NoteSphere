# PostgreSQL backup and restore

The production PostgreSQL service uses the persistent named volume `notesphere-production-postgres-data`. Normal Compose redeploys and container restarts preserve it. This volume is not a backup; keep independent off-host dumps and periodically test a restore.

## Create a backup

On the Coolify server, identify the production PostgreSQL container without printing its environment:

```sh
docker ps --filter label=com.notesphere.stack=production \
  --filter label=com.notesphere.service=postgres \
  --format '{{.Names}}'
```

Set the connection/backup inputs and run the script:

```sh
export PG_CONTAINER=THE_POSTGRES_CONTAINER_NAME
export PG_USER=YOUR_POSTGRES_BOOTSTRAP_ADMIN_ROLE
export PG_DATABASE=YOUR_DATABASE_NAME
export BACKUP_DIR=/data/backups/notesphere
install -d -m 700 "$BACKUP_DIR"
chmod +x scripts/backup-postgres.sh
./scripts/backup-postgres.sh
```

The script uses `pg_dump` in PostgreSQL's own container to create a custom-format dump, applies restrictive file permissions, writes a new timestamped name, and never overwrites an existing backup. An incomplete `.partial` file is retained for inspection if the dump fails; it is not automatically removed.

For an off-host copy, create a Standard-tier OCI Object Storage bucket in the intended region (within the current Always Free quota), create S3-compatible customer secret keys, then use [upload-backup-to-oci.sh](../scripts/upload-backup-to-oci.sh). It uploads to a new timestamped prefix and does not delete remote objects. Keep the key file outside this repo and protect it.

## Restore to a new database

Restore never drops or overwrites the active database. Choose a new database name and use the exact dump path:

```sh
export PG_CONTAINER=THE_POSTGRES_CONTAINER_NAME
export PG_USER=YOUR_POSTGRES_BOOTSTRAP_ADMIN_ROLE
export PG_APP_USER=YOUR_APPLICATION_DATABASE_ROLE
export BACKUP_FILE=/data/backups/notesphere/notesphere-notesphere-YYYYMMDDTHHMMSSZ.dump
export RESTORE_DB=notesphere_restore_test
chmod +x scripts/restore-postgres.sh
./scripts/restore-postgres.sh
```

The script refuses an existing target database, creates a new database owned by `PG_APP_USER`, then restores objects under that restricted role. `PG_USER` must be the bootstrap administrator and `PG_APP_USER` must already exist in the PostgreSQL cluster. If restore fails, the new database may be partial; the script deliberately does not drop it. Inspect it and choose a different target name for another attempt.

For production cutover, first validate the restored note/folder counts and application behavior. Then update the Coolify `POSTGRES_DB` value and redeploy the backend only. PostgreSQL's `POSTGRES_DB` environment variable does not rename or delete an initialized database. Keep the original database and volume until the restored instance is confirmed. Never use `docker compose down -v` or delete the named volume as a restore method.

## Recovery practice

Keep PostgreSQL and file-storage backups from the same time window. Store at least one encrypted/off-host copy, monitor OCI's current 20 GB free Object Storage limit, and test restore into a new database before relying on backups. Manual retention cleanup must be deliberate; these scripts do not delete old backups.
