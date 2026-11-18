# Coolify Community Edition installation

Coolify is self-hosted open-source software. Its official installation guide currently recommends at least 2 CPU cores, 2 GB RAM and 10 GB free disk; use a fresh Ubuntu LTS server where possible. Oracle A1 at its full Always Free allowance (2 OCPUs/12 GB) meets the stated minimum, but leaves limited build and workload headroom.

## Before installing

1. Complete [ORACLE_CLOUD_SETUP.md](./ORACLE_CLOUD_SETUP.md) and [UBUNTU_SERVER_SETUP.md](./UBUNTU_SERVER_SETUP.md).
2. Confirm key-based SSH works in a second session.
3. Keep the OCI Console session available. Configure ports 22, 80 and 443 as required, and restrict 8000/6001/6002 to your IP or use an SSH tunnel.
4. Check the official [Coolify self-hosted requirements and installation methods](https://coolify.io/docs/start-with-self-hosted). Do not use a nightly or preview release for this deployment.

## Install from the official source

Coolify's documented automated installer installs packages, Docker (when supported), its service files, SSH configuration and Coolify itself. Review the [official installer source](https://github.com/coollabsio/coolify/blob/v4.x/scripts/install.sh), then run the documented command on the server as root or through `sudo`:

```sh
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

This is a manual server-side action; it has not been run from this workspace. Follow the installer output. Do not install Coolify on the existing local Docker machine as part of this task.

## Secure the first login

1. Open the dashboard using the restricted direct URL or SSH tunnel.
2. Create the first Coolify administrator immediately. The official docs warn that the initial registration window is short; anyone who reaches the open setup page first may become administrator.
3. Confirm **Servers → localhost** is reachable and validated.
4. Save `/data/coolify/source/.env` and other Coolify backup data securely off-server. That environment file contains encryption keys required to recover Coolify's stored secrets.
5. Do not expose ports 8000/6001/6002 globally. After configuring a protected dashboard domain, Coolify documents closing those direct ports; preserve SSH access.

## Proxy and application network

Coolify's self-hosted installation creates a Docker network named `coolify`. The production Compose file attaches **only** the frontend to that network. Configure the `frontend` service as the receiving HTTP service on internal port 80 in Coolify's **Domains** screen. PostgreSQL, RustFS, the bucket initializer and the backend do not join the public proxy network and have no published host ports.

Coolify's firewall reference lists 22, 80 and 443 for the server, and 8000/6001/6002 for direct dashboard access. Keep 22 restricted, and keep direct dashboard ports restricted or closed. Open 80/443 to the Internet only when you have explicitly approved public access and have addressed NoteSphere's missing application authentication.

Official references: [self-hosted installation](https://coolify.io/docs/start-with-self-hosted), [firewall ports](https://coolify.io/docs/core/infrastructure/servers/firewall), and [Docker Compose deployments](https://coolify.io/docs/applications/builds/docker-compose).
