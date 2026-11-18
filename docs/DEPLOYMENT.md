# Deployment guide index

The Oracle Cloud Always Free + Coolify deployment target is documented as a set of small, manually reviewed steps:

1. [Oracle Cloud account, free-tier limits, VM and network](./ORACLE_CLOUD_SETUP.md)
2. [Ubuntu server and Docker Engine](./UBUNTU_SERVER_SETUP.md)
3. [Coolify installation](./COOLIFY_INSTALLATION.md)
4. [NoteSphere Compose deployment](./NOTESPHERE_DEPLOYMENT.md)
5. [Free DNS and HTTPS](./DOMAIN_AND_HTTPS_SETUP.md)
6. [Environment variables](./ENVIRONMENT_VARIABLES.md)
7. [PostgreSQL backup and restore](./DATABASE_BACKUP_AND_RESTORE.md)
8. [PostgreSQL attachment storage and legacy backfill](./FILE_STORAGE_BACKUP.md)
9. [Security checklist](./SECURITY_CHECKLIST.md)
10. [Troubleshooting](./TROUBLESHOOTING.md)
11. [Architecture and network boundaries](./DEPLOYMENT_ARCHITECTURE.md)

The production stack is `../compose.coolify.yaml`. It does not publish database or backend ports. The API requires a configured single-user login; per-user tenant isolation is not implemented. No OCI resources or external account settings are changed by these instructions.
