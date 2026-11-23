# NoteSphere

NoteSphere is a notes workspace with a React + TipTap editor, Spring Boot REST API, and PostgreSQL persistence for notes and BYTEA attachment content. Docker Compose runs the complete local stack.


## What is implemented

- Rich-text notes with headings, lists, task checklists, tables, links, highlighting, text styling, and alignment.
- Autosaving notes with word count and save status.
- Nested folders, templates, search, favorites, pinning, archive/restore, and unfiled/recent views.
- A dedicated folder workspace keeps folder hierarchy out of the editor sidebar; the editor breadcrumb shows the complete selected folder path.
- Shared accessible dialogs and managed editor/folder menus close on outside click and Escape.
- A data-backed workspace dashboard with 30-day creation activity, folder/type distributions, and recent, favorite, and pinned notes.
- Individual note and folder ZIP export/import, including editor content, metadata, referenced attachment bytes, and preserved folder hierarchy.
- Explicit conflict choices for imports: override existing content after confirmation, create a uniquely named copy, or cancel.
- Attachment uploads stored as PostgreSQL BYTEA; images and PDFs can be previewed, and other files can be downloaded.
- Single-user Spring Security login with session cookies and CSRF protection for API mutations.
- PostgreSQL schema migrations managed with Flyway.
- Local Docker Compose setup for the frontend, API, and database.
- Backend health endpoint at `/actuator/health`.

## Important scope and security notice

This is a runnable foundation/MVP scaffold, **not a production-ready enterprise product**. The API requires the configured single-user login, but user isolation, workspace permissions, comments, version history, audit trails, malware scanning, automated CI, and production TLS are not implemented. Do not share the login or expose the service without HTTPS and appropriate operational controls.

## Prerequisites

- Docker Desktop (Windows/macOS) or Docker Engine + Compose plugin (Linux)
- For backend development outside Docker: JDK 25 and Maven 3.9+
- Git (optional)
- At least 4 GB free RAM recommended

## Local run with Docker

1. Extract the project and open a terminal in the `NoteSphere` directory.
2. Copy environment template:

   **PowerShell**
   ```powershell
   Copy-Item .env.example .env
   ```
   **macOS/Linux**
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and replace every `CHANGE_ME` value with a unique value before starting. Configure one `APP_AUTH_USERNAME` and an `APP_AUTH_PASSWORD` of at least 12 characters; there is no fallback or master password. The frontend and local development ports bind to loopback only. `APP_MAX_ARCHIVE_SIZE` sets the import and expanded ZIP limit (default `260MB`); `APP_MAX_UPLOAD_SIZE` sets the individual-file limit (default `25MB`). `APP_CORS_ALLOWED_ORIGINS` is only needed when the browser and API use different origins; leave it blank for the same-origin Docker setup.
4. Build and start everything:
   ```bash
   docker compose up --build -d
   ```
5. Check service status:
   ```bash
   docker compose ps
   docker compose logs -f backend
   ```
6. Confirm the services are healthy:
   ```powershell
   Invoke-RestMethod http://localhost:5173/actuator/health
   ```
   Or open the health endpoint in a browser. Then open:
   - Frontend: http://localhost:5173
   - Backend health: http://localhost:8080/actuator/health
   - PostgreSQL: localhost:5432


## Useful Docker commands

```bash
# Stop services but preserve database and attachment volumes
docker compose down

# Rebuild changed images and restart
docker compose up --build -d

# View logs
docker compose logs -f frontend backend postgres

# Check service status
docker compose ps
```

Do not use volume-removal or Docker prune commands on this project; database and attachment volumes contain persistent user data.

## API

- `GET /api/notes` — list notes
- `GET /api/notes/{id}` — retrieve note
- `POST /api/notes` — create note (`{ "title": "...", "content": "..." }`)
- `PUT /api/notes/{id}` — update note
- `PATCH /api/notes/{id}/folder` — move a note (`{ "folderId": "..." }`) or move it to Unfiled (`{ "folderId": null }`)
- `DELETE /api/notes/{id}` — delete note
- `GET /api/folders` — list folders
- `POST /api/folders` — create a folder (`{ "name": "...", "parentFolderId": "..." }`)
- `PUT /api/folders/{id}` — rename or move a folder
- `DELETE /api/folders/{id}` — delete a folder; direct notes become Unfiled and child folders are promoted
- `GET /api/folders/{id}/export` — download the folder subtree as a ZIP
- `POST /api/folders/import/preview` — preview a ZIP (`multipart/form-data`, field `file`) without writing data
- `POST /api/folders/import?strategy=COPY|OVERRIDE` — import a reviewed ZIP as a copy or replace a matching root folder after confirmation
- `GET /api/notes/{id}/export` — download one note and its referenced attachments as a ZIP
- `POST /api/notes/import/preview` — validate and preview a one-note ZIP without writing data
- `POST /api/notes/import?strategy=COPY|OVERRIDE` — import a note as a uniquely named copy or replace the matching note
- `GET /api/dashboard` — live workspace totals and chart data
- `GET /api/auth/csrf` — obtain a CSRF token
- `POST /api/auth/login` — create the single-user session
- `GET /api/auth/session` — verify the current session
- `POST /api/auth/logout` — invalidate the current session
- `POST /api/attachments?noteId=...` — multipart upload, field name `file`, max 25 MB
- `GET /api/attachments/{id}?key=...&fileName=...` — retrieve an uploaded file (legacy `key` remains optional; inline preview is limited to images and PDFs)
- `GET /api/attachments?noteId=...` — list attachment metadata without file bytes
- `DELETE /api/attachments/{id}?noteId=...` — unlink/delete an attachment owned by that note

Notes can be filtered with `folderId`, `favorites=true`, `archived=true`, `unfiled=true`, and `q` query parameters.


## Local development without Docker for app processes

Compose runs the complete stack in containers. If you prefer running frontend/backend directly on host, start only dependencies:

```bash
docker compose up -d postgres
```

Backend:
```bash
cd backend
mvn spring-boot:run
```
Frontend:
```bash
cd frontend
npm ci
npm run dev
```

The Vite dev server proxies API requests to the configured backend. In PowerShell, set its proxy target before starting Vite:

```powershell
$env:VITE_API_PROXY_TARGET = 'http://127.0.0.1:8080'
npm run dev
```

In Docker, Nginx proxies `/api` and `/actuator` to Spring Boot, so browser requests use same-origin relative URLs. Existing attachment links saved with an absolute host are normalized when notes load.

ZIP backups contain a top-level `manifest.json` and one `attachments/<attachment-id>/<file-name>` entry per referenced attachment, including the actual file bytes. Import validates paths, metadata, size limits, and referenced files before writing records. Copy imports assign new IDs and unique names. Override imports require an explicit confirmation and a matching note ID/title or root-folder name; canceling never sends an import request.

## Build and test

```powershell
docker compose build frontend backend
docker compose up -d postgres minio minio-init
```

With the Compose database running, JDK 25 and Maven 3.9+ installed, run the tests from `backend`. Set the datasource environment variables to the values in `.env` in your current shell; do not commit or paste secrets into scripts:

```powershell
docker compose up -d postgres
$env:SPRING_DATASOURCE_URL = 'jdbc:postgresql://localhost:5432/notesphere'
# Set SPRING_DATASOURCE_USERNAME and SPRING_DATASOURCE_PASSWORD from .env.
$env:APP_AUTH_USERNAME = 'your-local-login'
$env:APP_AUTH_PASSWORD = 'a-local-only-password'
cd backend
mvn -q test
```

The focused archive validation tests can be run with `mvn -q -Dtest=FolderArchiveServiceTest test`.

## Oracle Cloud + Coolify deployment

The production-oriented Compose definition is `compose.coolify.yaml`. It keeps PostgreSQL and the backend off host-published ports, attaches only the frontend to Coolify's proxy, and stores attachments in PostgreSQL. The legacy object-storage volume name is retained for safe migration and is not mounted by the application.

The API requires the configured single-user login; data is not isolated between users because only one shared account is supported. Use a strong password and HTTPS for remote access.

Start with [docs/ORACLE_CLOUD_SETUP.md](docs/ORACLE_CLOUD_SETUP.md), [docs/UBUNTU_SERVER_SETUP.md](docs/UBUNTU_SERVER_SETUP.md), and [docs/COOLIFY_INSTALLATION.md](docs/COOLIFY_INSTALLATION.md). Then follow [docs/NOTESPHERE_DEPLOYMENT.md](docs/NOTESPHERE_DEPLOYMENT.md). All requested deployment, DNS/TLS, environment, backup/restore, security and troubleshooting guides are under `docs/`.

## Project structure

```text
NoteSphere/
├── docker-compose.yml
├── compose.coolify.yaml
├── .env.example
├── README.md
├── scripts/
│   └── migrate-minio-to-postgres.py # One-time, non-destructive legacy backfill
├── docs/
│   ├── ARCHITECTURE.md
│   └── Oracle Cloud, Coolify, backup, security, and troubleshooting guides
├── backend/
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/main/java/com/notesphere/
│       ├── config/      # CORS and application configuration
│       ├── notes/       # Notes, folders, dashboard, and ZIP APIs
│       └── storage/     # PostgreSQL BYTEA attachment API
│   ├── src/main/resources/
│   │   ├── db/migration/ # Existing Flyway schema migrations
│   │   ├── application.yml
│   │   └── application-prod.yml
│   └── src/test/        # Backend tests
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js   # Development API proxy
    └── src/
        ├── App.jsx
        ├── Dashboard.jsx
        ├── FolderDashboard.jsx
        ├── EditorToolbar.jsx
        ├── CreateNoteDialog.jsx
        ├── FolderTree.jsx
        ├── NoteImportDialog.jsx
        ├── OverlaySystem.jsx
        ├── noteTemplates.js
        └── styles.css
```

## Known limitations and next phases

1. User and workspace data model; enforce per-user ownership/authorization on every API.
2. Add upload malware scanning, quotas, audit/version history, and rate limits.
3. Add trash/restore, tags, sharing, comments, and version history.
4. Expand automated API and browser tests; add CI, monitoring, backup, and restore checks.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the current design. The frontend uses plain JavaScript/JSX; no TypeScript is introduced.

## Frontend language

The frontend uses React with plain JavaScript and JSX (not TypeScript). You can edit components in `frontend/src/*.jsx`. Vite handles JSX compilation.
#