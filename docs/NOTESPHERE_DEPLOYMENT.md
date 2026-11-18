# Deploy NoteSphere with Coolify

This repository contains `compose.coolify.yaml` for the production topology. It does not deploy itself, create a domain, or open a firewall. Do not add a public domain until application access is protected: the existing app has no login or user isolation.

## Prerequisites

- Coolify Community Edition installed on the intended Ubuntu host.
- Coolify's `coolify` proxy network present.
- A private Git repository containing this project, or another source Coolify can access. Do not make a repository public to simplify deployment.
- Unique generated database and RustFS credentials entered in Coolify's secret environment-variable UI.
- A backup of any source database and attachments that must be migrated.

## Add the Compose project

1. In Coolify, create a project and production environment.
2. Add the private Git source and select the **Docker Compose** build strategy.
3. Set **Base Directory** to the repository root and **Docker Compose Location** to `compose.coolify.yaml`.
4. Add these required variables in Coolify. Coolify's Compose parser treats `${NAME:?message}` as required. Keep secrets runtime-only and locked where supported:

   - `POSTGRES_DB`
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `APP_DB_USER`
   - `APP_DB_PASSWORD`
   - `MINIO_ROOT_USER`
   - `MINIO_ROOT_PASSWORD`
   - `MINIO_BUCKET`

   Optional: `APP_MAX_ARCHIVE_SIZE` (defaults to `260MB`) and `APP_CORS_ALLOWED_ORIGINS` (leave empty for same-origin access). The Compose file sets service URLs internally; do not enter a public backend URL or publish database/storage ports.

5. Review the parsed services and generated environment entries. Confirm the Coolify route targets `frontend:80`, not `backend`, `postgres`, or `minio`.
6. Deploy from Coolify and inspect each service's deployment/runtime logs and health state. PostgreSQL/backend/frontend expose Docker health checks; the storage initializer's successful completion confirms RustFS API and bucket readiness. Coolify builds both Dockerfiles on the server; first builds can use substantial CPU, RAM, disk and outbound data.
7. Verify container health with `./scripts/verify-deployment.sh`. Coolify labels all app containers with `com.notesphere.stack=production`.

The deployment uses two isolated internal networks: PostgreSQL/RustFS/backend share the data network; frontend/backend share the API network; only frontend also joins Coolify's proxy network. The PostgreSQL and RustFS named volumes have explicit production names and survive normal redeploys. The app uses the existing Flyway migrations with Hibernate `ddl-auto: validate`; the SQL migrations are not changed. On first PostgreSQL initialization, `scripts/initialize-postgres-app-role.sh` creates a separate non-superuser application role; the `POSTGRES_USER` bootstrap administrator is not given to the backend.

## Private-first access

No public hostname is assigned by the Compose file. Keep the Coolify domain unset while the application remains unauthenticated. For private smoke checks, use container health checks and the restricted Coolify dashboard. A publicly routed URL, even with HTTPS, does not authenticate users; anyone who can reach the current app can read, alter, or delete workspace data.

Before adding a public domain, implement application authentication/authorization or obtain separate approval for an appropriate perimeter access-control design. Then follow [DOMAIN_AND_HTTPS_SETUP.md](./DOMAIN_AND_HTTPS_SETUP.md).

## Existing data migration

Production named volumes are intentionally separate from local Compose volumes. Do not point production at local volume names and do not run `docker compose down -v`. Use a PostgreSQL dump and a RustFS object backup from the source environment, restore the database to a new empty database, and restore objects into a new empty bucket before switching the production environment variables. Follow [DATABASE_BACKUP_AND_RESTORE.md](./DATABASE_BACKUP_AND_RESTORE.md) and [FILE_STORAGE_BACKUP.md](./FILE_STORAGE_BACKUP.md). Validate notes and attachments before retiring the source; these scripts do not delete it.

## Manual Compose fallback

If you administer the server directly rather than using Coolify's deployment button, create a protected `.env` on the server from `.env.example`, fill every placeholder, and run:

```sh
chmod +x scripts/*.sh
COOLIFY_ENV_FILE=/path/to/notesphere.env ./scripts/deploy-coolify-compose.sh
```

The script requires the Coolify proxy network and will not expose host ports or configure a domain. The `.env` file is never included in the repository.
