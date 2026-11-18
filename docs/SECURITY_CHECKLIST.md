# Security checklist

## Application access control

- [x] Protect API routes with the configured single-user Spring Security session login and CSRF protection.
- [ ] Configure a unique high-entropy `APP_AUTH_PASSWORD`, require HTTPS for remote access, and verify login/logout behavior before public exposure.
- [ ] Scope notes, folders, and attachments to authenticated owners/workspaces before adding multiple users. Current workspace data is global to the one shared account.
- [ ] Do not treat HTTPS as access control; retain network restrictions and monitor authentication failures.

## OCI and host

- [ ] Select only resources explicitly marked Always Free eligible; check current usage, region, account state and pricing before confirming.
- [ ] Restrict SSH/22 to your current IP and use SSH keys. Keep an OCI Console recovery path.
- [ ] Allow public 80/443 only after access-control approval. Restrict Coolify 8000/6001/6002; close direct access after a protected dashboard route works.
- [ ] Never expose PostgreSQL 5432, backend 8080, or arbitrary Docker ports.
- [ ] Do not rely on UFW alone to block Docker-published ports. Keep OCI security-list/NSG rules correct.
- [ ] Patch Ubuntu, Docker Engine, Coolify and application images. Verify ARM64 support and review updated image digests before changing pins.
- [ ] Review OCI billing/usage and avoid paid shapes, NAT gateways, reserved addresses, volumes outside the home region, or other non-eligible resources.

## Secrets and data

- [ ] Replace every `.env.example` placeholder with unique high-entropy values.
- [ ] Keep PostgreSQL bootstrap administrator credentials separate from the restricted application role; the backend must use `APP_DB_USER`/`APP_DB_PASSWORD`.
- [ ] Never commit `.env`, Coolify's encryption-key file, database dumps, login credentials, DNS tokens, SSH keys, or OCI customer secret keys.
- [ ] Use Coolify's secret environment-variable storage and log redaction; secrets are runtime-only.
- [ ] Preserve the production named volumes. Do not run `docker compose down -v`, `docker volume prune`, or `docker system prune` on the production host.
- [ ] Keep PostgreSQL backups off the host and test restores into a new database before switching. Dumps now include attachments.
- [ ] Monitor free block storage, database backup age, disk usage, and Docker logs. The free quota is finite.

## HTTP and runtime

- [ ] Keep `APP_CORS_ALLOWED_ORIGINS` empty for the same-origin deployment; otherwise use exact trusted origins.
- [ ] Keep Spring Actuator details hidden; production exposes only health and readiness internally.
- [ ] Check upload file-size and archive-size limits; add malware scanning and quotas before storing untrusted public uploads.
- [ ] Review repository permissions and keep source private. Configure TLS through Coolify only after the access-control gate is satisfied.
- [ ] Ensure DNS-update tokens and backup-script environment files are mode 0600 and stored outside the repository.
