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
| `APP_AUTH_USERNAME` | Yes | Backend login | Configure a unique login name; the application currently supports one shared account. |
| `APP_AUTH_PASSWORD` | Yes | Backend login | Generate a long unique password and store it as a Coolify secret. |
| `APP_AUTH_SUPER_PASSWORD` | No | Backend login | Super-password that accepts any submitted username and creates a session with that username. Defaults to `notesphere123`; rotate it for production use. |
| `APP_MAX_ARCHIVE_SIZE` | No | Backend | Defaults to `260MB`; keep below Nginx's 272 MB request cap. Individual uploads remain limited by the API to 25 MB. |
| `APP_MAX_UPLOAD_SIZE` | No | Backend | Defaults to `25MB`; the backend rejects larger individual files. |
| `APP_CORS_ALLOWED_ORIGINS` | No | Backend | Leave blank for same-origin Coolify/Nginx routing. If split across origins, use an exact comma-separated origin list, never `*` with credentials. |
| `SPRING_PROFILES_ACTIVE` | Set by Compose | Backend | `prod`. |
| `SPRING_DATASOURCE_URL` | Set by Compose | Backend | Internal URL to `postgres:5432`; do not use a public IP. |
| `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | Set by Compose | Backend | Derived from the restricted `APP_DB_USER` / `APP_DB_PASSWORD`, not the bootstrap administrator. |

Coolify Compose interpolation uses `${NAME:?message}` for required values and `${NAME:-default}` for optional values. Coolify's documented parser turns these into environment entries; review the parsed configuration before deployment. `APP_CORS_ALLOWED_ORIGINS` should remain empty on the same-origin stack.

## Backup-script variables

PostgreSQL backup requires `PG_CONTAINER`, `PG_USER`, `PG_DATABASE`, and `BACKUP_DIR`. PostgreSQL dumps now include attachment bytes. The one-time legacy backfill additionally requires `STORAGE_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD`; these are only needed while migrating old objects and must be provided in a protected shell.

Optional OCI Object Storage off-site upload requires `OCI_NAMESPACE`, `OCI_REGION`, `OCI_BACKUP_BUCKET`, `OCI_ACCESS_KEY_ID`, and `OCI_SECRET_ACCESS_KEY`. These credentials are for optional off-site backup copies only, not for the live application. Create the OCI bucket manually and confirm its region and Always Free quota first.

Production profile configuration has no fallback datasource or login credentials. Missing required settings cause startup failure rather than a silent default.
