# PostgreSQL attachment storage and legacy backfill

New uploads and attachment metadata are stored in PostgreSQL (`attachments.file_data BYTEA`). PostgreSQL dumps now include the actual file bytes; there is no live MinIO/S3 dependency. Keep the legacy object-storage volume until a migration has been run and verified.

## One-time MinIO/RustFS backfill

Run this before retiring the old storage service. Schedule a maintenance window so notes and uploads do not change during the copy. Take a PostgreSQL dump and a non-destructive object-store backup first. The script reads every bucket object, checks that note references resolve, preserves UUIDs and note references, and never modifies or deletes source objects. It is idempotent and can be safely rerun after an interrupted copy.

The new Flyway migration must be applied before the backfill. For an existing Coolify stack, stop the old backend/frontend for the maintenance window, then use the new source checkout and deployment variables to run Flyway without starting an HTTP server:

```sh
docker compose -f compose.coolify.yaml run --rm \
  -e SPRING_MAIN_WEB_APPLICATION_TYPE=none backend
```

Keep the legacy object-store container and its volume running. Run the backfill utility on the production data network with the old bucket credentials and the current application-database credentials. Install `boto3` and `psycopg[binary]` in the one-shot Python environment; do not install them into the application image:

```sh
export STORAGE_ENDPOINT=http://minio:9000
export S3_ACCESS_KEY=YOUR_LEGACY_ACCESS_KEY
export S3_SECRET_KEY=YOUR_LEGACY_SECRET
export S3_BUCKET=YOUR_LEGACY_BUCKET
export SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/YOUR_DATABASE
export SPRING_DATASOURCE_USERNAME=YOUR_APPLICATION_DATABASE_ROLE
export SPRING_DATASOURCE_PASSWORD=YOUR_APPLICATION_DATABASE_SECRET

docker run --rm --network notesphere-production-data \
  --mount type=bind,src="$PWD/scripts/migrate-minio-to-postgres.py",dst=/migrate.py,readonly \
  -e STORAGE_ENDPOINT -e S3_ACCESS_KEY -e S3_SECRET_KEY -e S3_BUCKET \
  -e SPRING_DATASOURCE_URL -e SPRING_DATASOURCE_USERNAME -e SPRING_DATASOURCE_PASSWORD \
  python:3.13-slim sh -c 'pip install --no-cache-dir boto3 "psycopg[binary]" && python /migrate.py'
```

The default invocation is a dry run. After reviewing its verified object/reference counts, repeat the command with `python /migrate.py --apply`. The database URL must resolve from the container on the private data network. Do not put credentials in the repository or command history; use a protected shell or temporary secret file.

After applying, verify attachment counts and sample binary hashes/round trips through the authenticated application, and retain the original bucket and its volume until the verification and backup restore have succeeded. Only then redeploy the final Compose definition without MinIO. The old named volume is deliberately retained; do not run `docker compose down -v`, prune, or volume deletion commands.

## Ongoing backup and restore

Use [DATABASE_BACKUP_AND_RESTORE.md](./DATABASE_BACKUP_AND_RESTORE.md) for all ongoing attachment backup/restore. Custom-format `pg_dump` backups contain notes, metadata, and attachment BYTEA data together. Keep backups encrypted/off-host and test restoration into a new database before relying on them. Optional OCI Object Storage is only an off-site destination for database backup files, never a live file store.
