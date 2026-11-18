# Ubuntu server setup

These are manual steps for the newly created Oracle Ubuntu VM. Keep your current SSH or OCI Console session open until a second key-based login has succeeded. No commands in this guide delete Docker data.

## 1. Connect over SSH

On your workstation, use the SSH private key selected when creating the VM:

```sh
ssh -i /path/to/private-key ubuntu@YOUR_INSTANCE_PUBLIC_IP
```

On Windows PowerShell, use the corresponding Windows key path. Never paste the private key into this repository or a Coolify variable. If SSH fails, use the OCI Console connection method and check that port 22 is allowed from your current IP in the VCN security list and NSG.

## 2. Check resources and update Ubuntu

```sh
sudo apt-get update
sudo apt-get upgrade -y
sudo reboot
```

Reconnect after the reboot, copy the project to the server, and run:

```sh
chmod +x scripts/*.sh
./scripts/server-prerequisite-check.sh
```

The check is read-only. It reports OS, CPU architecture, CPU/memory, free root disk, and Docker/Compose availability. For the planned A1 server, expect `aarch64`, at least two cores, and enough free disk for images and data. A 50 GB boot disk is an initial minimum, not a promise that it will hold all future attachments and backups.

## 3. Configure firewall rules in OCI

Use the OCI security list or NSG rules in [ORACLE_CLOUD_SETUP.md](./ORACLE_CLOUD_SETUP.md). Restrict SSH to your current public IP. Docker-published ports can bypass ordinary UFW rules; Docker's official [firewall guidance](https://docs.docker.com/engine/network/packet-filtering-firewalls/) specifically warns against relying on UFW alone. Use OCI network rules as the primary ingress boundary and do not publish database or storage ports.

Coolify's self-hosted dashboard uses 8000, 6001 and 6002 for direct-IP access. Restrict those to your IP or avoid public access with an SSH tunnel:

```sh
ssh -N \
  -L 8000:127.0.0.1:8000 \
  -L 6001:127.0.0.1:6001 \
  -L 6002:127.0.0.1:6002 \
  ubuntu@YOUR_INSTANCE_PUBLIC_IP
```

Then open `http://127.0.0.1:8000` on your workstation.

## 4. Install Docker Engine

The repository script uses Docker's official Ubuntu apt repository and does not remove conflicting packages or Docker data:

```sh
./scripts/install-docker-ubuntu.sh
```

If it reports an existing conflicting `docker.io`, `podman-docker`, or Compose package, review it manually before changing the host. Do not run broad cleanup commands. The script prints the installed Docker Engine and Compose versions when complete.

## 5. Confirm reboot persistence

```sh
systemctl is-enabled docker
systemctl is-active docker
docker info --format '{{.Architecture}}'
docker compose version
```

Do not move `/var/lib/docker` or format/attach a volume without a separate backup and mount plan. The production Compose file uses named volumes `notesphere-production-postgres-data` and `notesphere-production-object-data`; the local development Compose volumes are separate.
