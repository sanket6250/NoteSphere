# Security checklist

## Release blocker: application access control

- [ ] Implement and test authentication and authorization before public Internet exposure.
- [ ] Scope notes, folders, and attachments to authenticated owners/workspaces. Current data is global and unauthenticated; the API supports read, write, import, and delete operations without a login.
- [ ] If application authentication is not yet implemented, keep the deployment private behind a source-IP allowlist or VPN and do not assign a publicly reachable domain. Do not treat HTTPS as access control.

## OCI and host

- [ ] Select only resources explicitly marked Always Free eligible; check current usage, region, account state and pricing before confirming.
- [ ] Restrict SSH/22 to your current IP and use SSH keys. Keep an OCI Console recovery path.
- [ ] Allow public 80/443 only after access-control approval. Restrict Coolify 8000/6001/6002; close direct access after a protected dashboard route works.
- [ ] Never expose PostgreSQL 5432, backend 8080, RustFS 9000/9001, or arbitrary Docker ports.
- [ ] Do not rely on UFW alone to block Docker-published ports. Keep OCI security-list/NSG rules correct.
- [ ] Patch Ubuntu, Docker Engine, Coolify and application images. Verify ARM64 support and review updated image digests before changing pins.
- [ ] Review OCI billing/usage and avoid paid shapes, NAT gateways, reserved addresses, volumes outside the home region, or other non-eligible resources.

## Secrets and data

- [ ] Replace every `.env.example` placeholder with unique high-entropy values.
- [ ] Keep PostgreSQL bootstrap administrator credentials separate from the restricted application role; the backend must use `APP_DB_USER`/`APP_DB_PASSWORD`.
- [ ] Never commit `.env`, Coolify's encryption-key file, database dumps, RustFS credentials, DNS tokens, SSH keys, or OCI customer secret keys.
- [ ] Use Coolify's secret environment-variable storage and log redaction; secrets are runtime-only.
- [ ] Replace the backend's RustFS root credentials with a bucket-restricted service account/policy when supported by the selected RustFS release; the current Compose stack passes root credentials to the backend and bucket initializer.
- [ ] Preserve the production named volumes. Do not run `docker compose down -v`, `docker volume prune`, or `docker system prune` on the production host.
- [ ] Keep PostgreSQL and object-storage backups off the host and test restores into new targets before switching.
- [ ] Monitor free block/object storage, backup age, disk usage, and Docker logs. The free quota is finite.

## HTTP and runtime

- [ ] Keep `APP_CORS_ALLOWED_ORIGINS` empty for the same-origin deployment; otherwise use exact trusted origins.
- [ ] Keep Spring Actuator details hidden; production exposes only health and readiness internally.
- [ ] Check upload file-size and archive-size limits; add malware scanning and quotas before storing untrusted public uploads.
- [ ] Review repository permissions and keep source private. Configure TLS through Coolify only after the access-control gate is satisfied.
- [ ] Ensure DNS-update tokens and backup-script environment files are mode 0600 and stored outside the repository.
