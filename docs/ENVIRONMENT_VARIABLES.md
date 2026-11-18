# Environment variables and secrets

`.env.example` contains placeholders, not usable secrets. The local `.env` is ignored by Git. Never commit a populated `.env`, backup credentials, OCI secret keys, or Coolify's `/data/coolify/source/.env`.

For Coolify, enter runtime values in the Compose resource's Environment Variables page. For the manual fallback, create a server-side environment file with mode `0600`. Do not copy the existing workstation `.env` to a public server without reviewing it and rotating any reusable values.

## Application variables

| Variable | Required | Used by | Guidance |
|---|---:|---|---|
| `POSTGRES_DB` | Yes | PostgreSQL, backend, health check | Database name; defaults are intentionally not embedded in production Compose. |
| `POSTGRES_USER` | Yes | PostgreSQL initialization and health check | Bootstrap administrator role; not used by the running application. |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL initialization and health check | Generate a unique long random administrator secret; do not reuse other credentials. |
| `APP_DB_USER` | Yes | PostgreSQL initialization and backend | Non-superuser application role, created on first database initialization for Flyway and application access; must differ from `POSTGRES_USER`. |
| `APP_DB_PASSWORD` | Yes | PostgreSQL initialization and backend | Generate a separate unique long random application secret. Changing either app-role value does not update an already initialized database; rotate the role inside PostgreSQL before updating Coolify. |
| `MINIO_ROOT_USER` | Yes | RustFS, bucket initializer, backend | Generate a unique storage access key. |
| `MINIO_ROOT_PASSWORD` | Yes | RustFS, bucket initializer, backend | Generate a different unique long secret. |
| `MINIO_BUCKET` | Yes | RustFS initializer, backend | Bucket name such as `notesphere-files`; not a password. |
| `APP_MAX_ARCHIVE_SIZE` | No | Backend | Defaults to `260MB`; keep below Nginx's 272 MB request cap. Individual uploads remain limited by the API to 25 MB. |
| `APP_CORS_ALLOWED_ORIGINS` | No | Backend | Leave blank for same-origin Coolify/Nginx routing. If split across origins, use an exact comma-separated origin list, never `*` with credentials. |
| `SPRING_PROFILES_ACTIVE` | Set by Compose | Backend | `prod`. |
| `SPRING_DATASOURCE_URL` | Set by Compose | Backend | Internal URL to `postgres:5432`; do not use a public IP. |
| `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | Set by Compose | Backend | Derived from the restricted `APP_DB_USER` / `APP_DB_PASSWORD`, not the bootstrap administrator. |
| `S3_ENDPOINT` | Set by Compose | Backend | Internal RustFS endpoint `http://minio:9000`. |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Set by Compose | Backend | Derived from RustFS credentials. |
| `S3_BUCKET` | Set by Compose | Backend | Derived from `MINIO_BUCKET`. |

Coolify Compose interpolation uses `${NAME:?message}` for required values and `${NAME:-default}` for optional values. Coolify's documented parser turns these into environment entries; review the parsed configuration before deployment. `APP_CORS_ALLOWED_ORIGINS` should remain empty on the same-origin stack.

The existing S3 client is configured with the RustFS root access key because this deployment preserves the current storage integration. Treat these credentials as highly privileged and keep the service private; before public production use, replace them with a restricted bucket identity/policy supported by the selected RustFS release.

## Backup-script variables

PostgreSQL backup requires `PG_CONTAINER`, `PG_USER`, `PG_DATABASE`, and `BACKUP_DIR`. File backup requires `DOCKER_NETWORK=notesphere-production-data`, `STORAGE_ENDPOINT=http://minio:9000`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, and `BACKUP_DIR`. Set credentials in a protected interactive shell or a root-owned file outside the repository.

Optional OCI Object Storage off-site upload requires `OCI_NAMESPACE`, `OCI_REGION`, `OCI_BACKUP_BUCKET`, `OCI_ACCESS_KEY_ID`, and `OCI_SECRET_ACCESS_KEY`. These are S3-compatible Customer Secret Keys for OCI Object Storage, not the RustFS credentials. Create the OCI bucket manually and confirm its region and Always Free quota first.

Production profile configuration has no fallback datasource or object-store passwords/keys. Missing required settings cause startup failure rather than a silent default.
