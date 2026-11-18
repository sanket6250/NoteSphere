# RustFS attachment backup and restore

NoteSphere stores attachment bytes in the existing S3-compatible RustFS service, not in PostgreSQL. Production RustFS persists its data in `notesphere-production-object-data`, and the backend reaches it at `http://minio:9000` over a private Docker network. Do not expose its S3 or console ports publicly.

## Back up bucket objects

Run on the Coolify host. The helper uses a pinned AWS CLI image, attaches it to the private storage network, and copies bucket objects to a new local backup directory without `--delete`:

```sh
export DOCKER_NETWORK=notesphere-production-data
export STORAGE_ENDPOINT=http://minio:9000
export S3_ACCESS_KEY=YOUR_RUSTFS_ACCESS_KEY
export S3_SECRET_KEY=YOUR_RUSTFS_SECRET_KEY
export S3_BUCKET=notesphere-files
export BACKUP_DIR=/data/backups/notesphere
install -d -m 700 "$BACKUP_DIR"
chmod +x scripts/backup-files.sh
./scripts/backup-files.sh
```

The resulting `notesphere-files-<UTC timestamp>/objects` directory preserves the object-key layout required by note HTML. These settings are needed only in the protected backup shell; do not save them in the Git checkout.

Copy the result off the VM with [upload-backup-to-oci.sh](../scripts/upload-backup-to-oci.sh) after creating an OCI Object Storage bucket and customer secret keys. Current Always Free Object Storage is limited to 20 GB combined in an Always Free-only account; monitor usage and request limits. OCI is an optional backup destination, not the live attachment store.

## Restore into an empty bucket

Never restore over the active bucket. Select a new bucket name, a verified backup directory and the same RustFS endpoint/credentials:

```sh
export DOCKER_NETWORK=notesphere-production-data
export STORAGE_ENDPOINT=http://minio:9000
export S3_ACCESS_KEY=YOUR_RUSTFS_ACCESS_KEY
export S3_SECRET_KEY=YOUR_RUSTFS_SECRET_KEY
export S3_BUCKET=notesphere-files
export RESTORE_BUCKET=notesphere-files-restore
export RESTORE_DIR=/data/backups/notesphere/notesphere-files-YYYYMMDDTHHMMSSZ
chmod +x scripts/restore-files.sh
./scripts/restore-files.sh
```

The script refuses to restore into the current bucket and checks that the target bucket has no objects before copying. It never uses `--delete` and never removes the source bucket. If the restore is interrupted, inspect the target bucket; do not point the live app at it until object counts and sample attachments have been checked.

When ready for a deliberate cutover, update Coolify's `MINIO_BUCKET` to the restored bucket and redeploy the backend after confirming bucket initialization and access. Keep the original bucket until end-to-end note/attachment verification succeeds. Existing local Compose uses a different volume; do not reuse, rename, or remove that volume as part of deployment.
