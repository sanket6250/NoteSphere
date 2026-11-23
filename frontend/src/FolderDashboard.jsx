import React, { useMemo, useRef, useState } from 'react';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Download,
  FileArchive,
  Folder,
  FolderPlus,
  LoaderCircle,
  MoveRight,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DialogFrame, useDialogs } from './OverlaySystem';
import { csrfHeader } from './api';
import { API_BASE_URL } from './apiBaseUrl';

const API = API_BASE_URL;

async function uploadWithProgress(url, file, onProgress) {
  const headers = await csrfHeader();
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', url);
    request.withCredentials = true;
    Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.responseType = 'json';
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => {
      const body = request.response;
      if (request.status >= 200 && request.status < 300) {
        resolve(body);
        return;
      }
      reject(new Error(body?.message || body?.detail || `Import failed (${request.status}).`));
    });
    request.addEventListener('error', () => reject(new Error('The server could not be reached while uploading the archive.')));
    request.addEventListener('abort', () => reject(new Error('The archive upload was cancelled.')));
    const form = new FormData();
    form.append('file', file);
    request.send(form);
  });
}

function FolderBranch({
  folder,
  childrenByParent,
  path,
  aggregateCounts,
  onOpen,
  onCreate,
  onRename,
  onMove,
  onDelete,
  onExport,
}) {
  const [expanded, setExpanded] = useState(true);
  const children = childrenByParent.get(folder.id) || [];
  return (
    <div className="folder-branch">
      <article className="folder-card">
        <button
          type="button"
          className="folder-collapse"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${folder.name}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {children.length ? (expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <span />}
        </button>
        <span className="folder-card-icon"><Folder size={18} /></span>
        <span className="folder-card-main">
          <button type="button" onClick={() => onOpen(folder.id)}>{folder.name}</button>
          <small>{folder.noteCount || 0} notes here · {aggregateCounts.get(folder.id) || 0} including subfolders</small>
        </span>
        <div className="folder-card-actions">
          <button type="button" aria-label={`Add subfolder under ${folder.name}`} title="Create subfolder" onClick={() => onCreate(folder)}><FolderPlus size={15} /></button>
          <button type="button" aria-label={`Move ${folder.name}`} title="Move folder" onClick={() => onMove(folder)}><MoveRight size={15} /></button>
          <button type="button" aria-label={`Rename ${folder.name}`} title="Rename folder" onClick={() => onRename(folder)}><Pencil size={14} /></button>
          <button type="button" aria-label={`Export ${folder.name} as ZIP`} title="Export folder ZIP" onClick={() => onExport(folder)}><Download size={15} /></button>
          <button type="button" aria-label={`Delete ${folder.name}`} title="Delete folder" onClick={() => onDelete(folder)}><Trash2 size={14} /></button>
        </div>
        <span className="folder-depth">{path}</span>
      </article>
      {expanded && children.length > 0 && (
        <div className="folder-children-list">
          {children.map((child) => (
            <FolderBranch
              key={child.id}
              folder={child}
              childrenByParent={childrenByParent}
              path={`${path} / ${child.name}`}
              aggregateCounts={aggregateCounts}
              onOpen={onOpen}
              onCreate={onCreate}
              onRename={onRename}
              onMove={onMove}
              onDelete={onDelete}
              onExport={onExport}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ImportPreview({ preview, file, busy, progress, error, result, onClose, onImport }) {
  if (!preview && !error && !busy) return null;
  return (
    <DialogFrame className="create-dialog archive-dialog" labelId="archive-dialog-title" onClose={onClose} busy={busy}>
        <div className="dialog-heading">
          <div>
            <span className="dialog-eyebrow">FOLDER BACKUP</span>
            <h2 id="archive-dialog-title">{result ? 'Import complete' : 'Review folder import'}</h2>
            <p>{result ? 'Your backup has been restored.' : 'Review the contents and choose how to handle an existing folder.'}</p>
          </div>
          <button type="button" className="dialog-close" disabled={busy} aria-label="Close import preview" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="archive-error" role="alert">{error}</div>}
        {result ? (
          <div className="archive-result" role="status">
            <strong>{result.rootFolderName}</strong>
            <span>{result.foldersCreated} folders · {result.notesImported} notes · {result.attachmentsRestored} attachments restored</span>
          </div>
        ) : preview && (
          <>
            <div className="archive-summary">
              <span><strong>{preview.folderCount}</strong> folders</span>
              <span><strong>{preview.noteCount}</strong> notes</span>
              <span><strong>{preview.attachmentCount}</strong> attachments</span>
            </div>
            <div className="import-preview-tree">
              <strong>{preview.rootFolderName}</strong>
              <ul>
                {preview.folderPaths.filter((path) => path !== preview.rootFolderName).map((path) => (
                  <li key={path}>{path}</li>
                ))}
              </ul>
              {preview.notes.length > 0 && (
                <>
                  <strong>Notes</strong>
                  <ul>{preview.notes.map((note, index) => <li key={`${note.folderPath}-${note.title}-${index}`}>{note.folderPath} / {note.title}</li>)}</ul>
                </>
              )}
            </div>
            {preview.warnings.map((warning) => <p className="import-warning" key={warning}>{warning}</p>)}
            {file && <p className="archive-filename"><FileArchive size={15} /> {file.name}</p>}
          </>
        )}

        {busy && (
          <div className="import-progress" aria-live="polite">
            <div className="progress-track"><span style={{ width: `${Math.max(progress, 4)}%` }} /></div>
            <p><LoaderCircle className="spin" size={13} /> {progress < 100 ? `Uploading archive… ${progress}%` : 'Validating and restoring folders, notes, and attachments…'}</p>
          </div>
        )}
        <div className="dialog-footer">
          <span className="dialog-folder-hint">
            {preview?.conflictFolderId ? 'Choose whether to replace the matching folder or create a copy.' : 'The folder hierarchy, notes, and attachments are preserved.'}
          </span>
          {!result && <button type="button" className="dialog-cancel" disabled={busy} onClick={onClose}>Cancel</button>}
          {!result && preview && (
            preview.conflictFolderId ? (
              <>
                <button type="button" className="dialog-danger" disabled={busy} onClick={() => onImport(file, 'override')}>
                  {busy ? 'Importing…' : 'Override Existing'}
                </button>
                <button type="button" className="dialog-submit" disabled={busy} onClick={() => onImport(file, 'copy')}>
                  {busy ? 'Importing…' : 'Create Copy'}
                </button>
              </>
            ) : (
              <button type="button" className="dialog-submit" disabled={busy} onClick={() => onImport(file, 'copy')}>
                {busy ? 'Importing…' : 'Import folder'}
              </button>
            )
          )}
          {result && <button type="button" className="dialog-submit" onClick={onClose}>Done</button>}
        </div>
    </DialogFrame>
  );
}

export default function FolderDashboard({
  folders,
  onOpenFolder,
  onCreateFolder,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
  onExportFolder,
  onImported,
}) {
  const dialogs = useDialogs();
  const [movingFolder, setMovingFolder] = useState(null);
  const [parentFolderId, setParentFolderId] = useState('');
  const [moveBusy, setMoveBusy] = useState(false);
  const [archiveFile, setArchiveFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [exportingId, setExportingId] = useState(null);
  const importInput = useRef(null);
  const childrenByParent = useMemo(() => {
    const map = new Map();
    folders.forEach((folder) => {
      const parentId = folder.parentFolderId || null;
      map.set(parentId, [...(map.get(parentId) || []), folder]);
    });
    return map;
  }, [folders]);
  const roots = childrenByParent.get(null) || [];
  const folderPaths = useMemo(() => {
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const paths = new Map();
    folders.forEach((folder) => {
      const path = [];
      let current = folder;
      while (current) {
        path.unshift(current.name);
        current = current.parentFolderId ? byId.get(current.parentFolderId) : null;
      }
      paths.set(folder.id, path.join(' / '));
    });
    return paths;
  }, [folders]);
  const aggregateCounts = useMemo(() => {
    const counts = new Map();
    function countSubtree(folder) {
      const count = (folder.noteCount || 0) + (childrenByParent.get(folder.id) || [])
        .reduce((total, child) => total + countSubtree(child), 0);
      counts.set(folder.id, count);
      return count;
    }
    roots.forEach(countSubtree);
    return counts;
  }, [childrenByParent, roots]);
  const descendants = useMemo(() => {
    const result = new Map();
    function collect(folderId) {
      const children = childrenByParent.get(folderId) || [];
      const ids = new Set(children.map((child) => child.id));
      children.forEach((child) => collect(child.id).forEach((id) => ids.add(id)));
      result.set(folderId, ids);
      return ids;
    }
    roots.forEach((folder) => collect(folder.id));
    return result;
  }, [childrenByParent, roots]);
  const moveTargets = movingFolder
    ? folders.filter((folder) => folder.id !== movingFolder.id && !descendants.get(movingFolder.id)?.has(folder.id))
    : [];

  async function createAt(parent) {
    await dialogs.prompt({
      title: parent ? 'Create a subfolder' : 'Create a folder',
      message: parent ? `Add a folder inside “${parent.name}”.` : 'Choose a name for your new folder.',
      label: 'FOLDER NAME',
      confirmLabel: 'Create folder',
      maxLength: 120,
      validate: (value) => value.trim() ? '' : 'Enter a folder name.',
      onConfirm: async (value) => {
        const folder = await onCreateFolder(value.trim(), parent?.id || null);
        if (!folder) throw new Error('The folder could not be created. Review the notification for details.');
        return value.trim();
      },
    });
  }

  async function previewArchive(file) {
    setArchiveFile(file);
    setPreview(null);
    setImportResult(null);
    setImportError('');
    setImportBusy(true);
    setImportProgress(0);
    try {
      const result = await uploadWithProgress(`${API}/api/folders/import/preview`, file, setImportProgress);
      setPreview(result);
      setImportProgress(100);
    } catch (error) {
      setImportError(error.message);
    } finally {
      setImportBusy(false);
    }
  }

  async function importArchive(file, strategy = 'copy') {
    if (!file) return;
    if (strategy === 'override' && !await dialogs.confirm({
      title: 'Replace existing folder?',
      message: `This replaces “${preview?.conflictFolderName || preview?.rootFolderName}” and its current notes and subfolders. This cannot be undone.`,
      confirmLabel: 'Replace folder contents',
      danger: true,
    })) return;
    setImportError('');
    setImportBusy(true);
    setImportProgress(0);
    try {
      const result = await uploadWithProgress(
        `${API}/api/folders/import?strategy=${encodeURIComponent(strategy)}`,
        file,
        setImportProgress,
      );
      setImportResult(result);
      onImported(result);
    } catch (error) {
      setImportError(error.message);
    } finally {
      setImportBusy(false);
    }
  }

  async function exportFolder(folder) {
    setExportingId(folder.id);
    try {
      await onExportFolder(folder);
    } finally {
      setExportingId(null);
    }
  }

  async function submitMove(event) {
    event.preventDefault();
    setMoveBusy(true);
    try {
      const success = await onMoveFolder(movingFolder, parentFolderId || null);
      if (success) setMovingFolder(null);
    } finally {
      setMoveBusy(false);
    }
  }

  function closeImport() {
    if (importBusy) return;
    setArchiveFile(null);
    setPreview(null);
    setImportResult(null);
    setImportError('');
    setImportProgress(0);
  }

  return (
    <section className="folder-workspace">
      <div className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">A PLACE FOR EVERY THOUGHT</span>
          <h1>Your folders</h1>
          <p>Browse, organize, and back up your complete folder hierarchy.</p>
        </div>
        <div className="workspace-actions">
          <button type="button" className="secondary-action" onClick={() => importInput.current?.click()}><Upload size={15} /> Import ZIP</button>
          <button type="button" className="primary-action" onClick={() => createAt(null)}><Plus size={15} /> New folder</button>
        </div>
        <input
          ref={importInput}
          className="visually-hidden"
          type="file"
          accept=".zip,application/zip"
          aria-label="Choose a NoteSphere ZIP backup"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void previewArchive(file);
            event.target.value = '';
          }}
        />
      </div>

      <div className="folder-overview">
        <span><Folder size={16} /> {folders.length} folders</span>
        <span><Archive size={16} /> Each ZIP includes nested folders, notes, metadata, and attached files</span>
      </div>
      {roots.length ? (
        <div className="folder-hierarchy">
          {roots.map((folder) => (
            <FolderBranch
              key={folder.id}
              folder={folder}
              childrenByParent={childrenByParent}
              path={folder.name}
              aggregateCounts={aggregateCounts}
              onOpen={onOpenFolder}
              onCreate={createAt}
              onRename={onRenameFolder}
              onMove={(target) => {
                setMovingFolder(target);
                setParentFolderId(target.parentFolderId || '');
              }}
              onDelete={onDeleteFolder}
              onExport={exportFolder}
            />
          ))}
        </div>
      ) : (
        <div className="folder-empty">
          <FolderPlus size={23} />
          <p>No folders yet. Create one to start organizing your notes.</p>
        </div>
      )}

      {movingFolder && (
        <DialogFrame className="create-dialog folder-move-dialog" labelId="folder-move-title" onClose={() => setMovingFolder(null)} busy={moveBusy}>
          <form onSubmit={submitMove}>
            <div className="dialog-heading">
              <div><span className="dialog-eyebrow">FOLDER ORGANIZATION</span><h2 id="folder-move-title">Move “{movingFolder.name}”</h2><p>Choose a new parent. Its subfolders and notes move with it.</p></div>
              <button type="button" className="dialog-close" disabled={moveBusy} aria-label="Close move dialog" onClick={() => setMovingFolder(null)}><X size={18} /></button>
            </div>
            <label className="dialog-label" htmlFor="folder-parent">NEW PARENT</label>
            <select id="folder-parent" className="dialog-input" disabled={moveBusy} value={parentFolderId} onChange={(event) => setParentFolderId(event.target.value)}>
              <option value="">Workspace root</option>
              {moveTargets.map((folder) => <option key={folder.id} value={folder.id}>{folderPaths.get(folder.id) || folder.name}</option>)}
            </select>
            <div className="dialog-footer">
              <span className="dialog-folder-hint">The folder hierarchy is preserved.</span>
              <button type="button" className="dialog-cancel" disabled={moveBusy} onClick={() => setMovingFolder(null)}>Cancel</button>
              <button type="submit" className="dialog-submit" disabled={moveBusy}>{moveBusy ? <LoaderCircle className="spin" size={14} /> : null}{moveBusy ? 'Moving…' : 'Move folder'}</button>
            </div>
          </form>
        </DialogFrame>
      )}
      <ImportPreview
        preview={preview}
        file={archiveFile}
        busy={importBusy}
        progress={importProgress}
        error={importError}
        result={importResult}
        onClose={closeImport}
        onImport={importArchive}
      />
      {exportingId && <div className="exporting-status" role="status"><LoaderCircle className="spin" size={14} /> Preparing folder backup…</div>}
    </section>
  );
}
