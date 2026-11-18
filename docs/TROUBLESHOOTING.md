# Troubleshooting

## OCI cannot create an A1 VM

`Out of host capacity` means the free shape is unavailable in that availability domain/region at that time. Wait or try another availability domain in the home region. Do not choose a paid shape to bypass the limit. Recheck the Always Free label and cost before retrying.

## SSH timeout or refused

Check the instance public IP, subnet route to the Internet Gateway, OCI security-list/NSG TCP 22 ingress and source CIDR. Keep the source restricted to your current IP. Use the OCI Console connection method if SSH is unavailable. Do not close a working session while editing SSH configuration.

## Coolify dashboard is unreachable

Check Coolify containers and runtime logs. For direct-IP access, allow ports 8000/6001/6002 only from your workstation IP. For an SSH tunnel, keep matching local forwards open. Confirm Coolify's first administrator was created promptly after installation and back up `/data/coolify/source/.env`.

## Compose says the `coolify` network does not exist

Install Coolify first and verify `docker network inspect coolify`. Do not create or rename networks under a running Coolify installation without a backup and change plan; the Compose stack expects the installer-created network.

## `no matching manifest for linux/arm64`

Confirm the VM reports `aarch64` and inspect each image with:

```sh
docker buildx imagetools inspect IMAGE
```

The current Postgres, Nginx and Temurin image manifests were checked for `linux/arm64` while preparing this deployment. A future image update must be checked again. Do not add `platform: linux/amd64` as a workaround on A1; emulation can be slow and may fail.

## Backend is unhealthy or migrations fail

Check `docker logs` for the backend and PostgreSQL. Confirm `SPRING_PROFILES_ACTIVE=prod`, all datasource variables match, PostgreSQL is healthy, and the database volume is writable. Hibernate uses `ddl-auto: validate`; Flyway applies the existing migrations. Do not delete the database volume to clear a migration error.

`/actuator/health/readiness` is checked inside the backend container. Public Nginx only forwards `/actuator/health` and returns 404 for other actuator paths.

The `APP_DB_USER` role is created only when PostgreSQL initializes an empty data volume. Changing `APP_DB_USER` or `APP_DB_PASSWORD` in Coolify later does not change the existing PostgreSQL role; rotate it in PostgreSQL first, then update the matching application secret.

## Login or CSRF errors

Confirm `APP_AUTH_USERNAME` and `APP_AUTH_PASSWORD` are set in Coolify and the frontend uses the same-origin API. Refresh the browser session after changing credentials. The frontend fetches CSRF tokens before mutations; do not disable CSRF protection as a workaround.

## Frontend loads but API calls fail

Confirm Coolify routes the domain to `frontend` internal port 80. The Nginx `backend` hostname resolves only through the private API network; `backend` must remain attached to it. Keep browser calls same-origin and leave CORS blank unless the deployment is intentionally split across origins.

## Let's Encrypt cannot issue a certificate

Check DNS A/AAAA records, Coolify proxy status, and inbound TCP 80/443. HTTP-01 requires public port 80 to reach Coolify. If the app must remain private, do not open it publicly just to issue a certificate; use an approved DNS-01 integration or keep the deployment private until access control is ready.

## Out of disk or memory

Run `df -h`, `free -h`, `docker system df`, and check container logs. The OCI free block quota is finite, and Java/image builds can be memory intensive. Remove only individually reviewed, known-unused images or backup files; never run prune commands or delete named volumes as a general fix.

## Backup or restore errors

Check that the container/network labels and variables point to the intended production stack. PostgreSQL restore requires a new database name and contains the corresponding attachment bytes. The scripts intentionally do not delete partial restore targets or old backups.
