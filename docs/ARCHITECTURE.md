# Architecture

## Local container topology

Browser → Nginx-served React frontend → Spring Boot API → PostgreSQL
                                               (notes, folders, attachment metadata and BYTEA content)

Compose services: postgres, backend, frontend.

## Oracle Cloud and Coolify deployment topology

The separate `compose.coolify.yaml` is the production deployment definition. PostgreSQL and the backend have no host-published ports. The frontend alone joins Coolify's proxy network; PostgreSQL remains on an internal data network, and frontend/backend share a separate internal API network. The legacy object-storage volume name is retained so cutover does not remove existing data. See [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md).

Production configuration is in `backend/src/main/resources/application-prod.yml`. Datasource credentials and the single-user login are required at startup. Actuator details are hidden and readiness checks are enabled.

## Current MVP boundaries

- Notes use a single `content` text field; the UI stores TipTap HTML.
- Attachments are stored as PostgreSQL `BYTEA` rows. Metadata is selected separately from file content, and `note_attachments` maintains note associations without exposing bytes in ordinary note responses.
- A single configured Spring Security account protects API routes with a server-side session and CSRF tokens. The application remains single-workspace with no per-user ownership model.
- Flyway migrations preserve the original notes table and add folder and note metadata; Hibernate validates the migrated schema.
- Folders are global in this single-user scaffold. Authentication, ownership, and tenant isolation are not implemented.
- `GET /api/dashboard` derives totals, daily creation history, folder/type distributions, and recent/favorite/pinned lists from persisted notes and folders.
- Folder navigation is presented in a dedicated workspace view rather than duplicated beside the note list. The note editor uses a folder breadcrumb derived from parent links.
- A shared React overlay provider owns accessible dialogs and single-active-menu behavior. Standard prompts, confirmations, and import conflict choices use this manager; specialized content dialogs share the same focus, Escape, and backdrop behavior.
- Folder and individual-note backups stream as ZIP archives containing `manifest.json` and referenced PostgreSQL file bytes. Import preview validates the archive without writes. Copy imports create new IDs and unique names; explicit override imports replace matching content only after user confirmation.
- Imported attachments receive new IDs and rewritten note HTML references; transactionally maintained note associations remove orphaned bytes on note deletion, override, or editor removal.
- The frontend uses same-origin `/api` and `/actuator` routes. Docker Nginx proxies them to Spring Boot; Vite uses `VITE_API_PROXY_TARGET` for local development.

## Spring Boot integration roadmap

1. Introduce users, workspaces, memberships, and ownership relationships; the current single shared account is not per-user authorization.
2. Add upload malware scanning, quotas, audit/version history, rate limits, secure headers, TLS, and observability.
3. Version the editor document schema and plan HTML-to-structured-document migration before changing the stored content format.
4. Add automated migration, API authorization, attachment lifecycle, backup, and restore tests before production deployment.
