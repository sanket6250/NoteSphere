# Architecture

## Local container topology

Browser → Nginx-served React frontend → Spring Boot API → PostgreSQL
                                               ↘ MinIO object storage

Compose services: postgres, minio, minio-init, backend, frontend.

## Oracle Cloud and Coolify deployment topology

The separate `compose.coolify.yaml` is the production deployment definition. PostgreSQL, RustFS, and the backend have no host-published ports. The frontend alone joins Coolify's proxy network; PostgreSQL/RustFS remain on an internal data network, and frontend/backend share a separate internal API network. Named production volumes are distinct from local-development volumes. See [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md).

Production configuration is in `backend/src/main/resources/application-prod.yml`. Required datasource and object-storage credentials have no production fallback values. Actuator details are hidden and readiness checks are enabled.

## Current MVP boundaries

- Notes use a single `content` text field; the UI stores TipTap HTML.
- Attachments are uploaded to MinIO; uploaded images are embedded for inline display and PDFs have a preview link. Attachment references are currently embedded in note HTML rather than represented by a note-owned database entity.
- Flyway migrations preserve the original notes table and add folder and note metadata; Hibernate validates the migrated schema.
- Folders are global in this single-user scaffold. Authentication, ownership, and tenant isolation are not implemented.
- `GET /api/dashboard` derives totals, daily creation history, folder/type distributions, and recent/favorite/pinned lists from persisted notes and folders.
- Folder navigation is presented in a dedicated workspace view rather than duplicated beside the note list. The note editor uses a folder breadcrumb derived from parent links.
- A shared React overlay provider owns accessible dialogs and single-active-menu behavior. Standard prompts, confirmations, and import conflict choices use this manager; specialized content dialogs share the same focus, Escape, and backdrop behavior.
- Folder and individual-note backups stream as ZIP archives containing `manifest.json` and referenced MinIO objects. Import preview validates the archive without writes. Copy imports create new IDs and unique names; explicit override imports replace a matching folder subtree or note only after user confirmation.
- Imported attachment objects receive new storage IDs and note HTML references are rewritten. Replaced note content can leave old, now-unreferenced MinIO objects because attachment ownership is embedded in HTML rather than persisted separately.
- The frontend uses same-origin `/api` and `/actuator` routes. Docker Nginx proxies them to Spring Boot; Vite uses `VITE_API_PROXY_TARGET` for local development.

## Spring Boot integration roadmap

1. Add Spring Security with a selected identity provider and authenticated API requests.
2. Introduce users, workspaces, memberships, and ownership relationships; scope every note, folder, and attachment query to an authorized workspace.
3. Persist attachment metadata and note relationships, then authorize every MinIO/S3 upload, preview, and delete through the API.
4. Version the editor document schema and plan HTML-to-structured-document migration before changing the stored content format.
5. Add upload validation/scanning and quotas, audit/version history, rate limits, secure headers, TLS, and observability.
6. Add automated migration, API authorization, attachment lifecycle, backup, and restore tests before production deployment.
