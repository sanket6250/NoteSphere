import React from 'react';
import { AlertCircle, FileArchive, LoaderCircle, X } from 'lucide-react';
import { DialogFrame } from './OverlaySystem';

export default function NoteImportDialog({
  file,
  preview,
  busy,
  error,
  onClose,
  onImport,
}) {
  if (!file && !error && !busy) return null;

  return (
    <DialogFrame
      className="create-dialog archive-dialog"
      labelId="note-import-title"
      onClose={onClose}
      busy={busy}
    >
      <div className="dialog-heading">
        <div>
          <span className="dialog-eyebrow">NOTE BACKUP</span>
          <h2 id="note-import-title">Import a note</h2>
          <p>Review the note and choose how to handle a matching note already in your workspace.</p>
        </div>
        <button type="button" className="dialog-close" disabled={busy} aria-label="Close note import" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {error && <div className="archive-error" role="alert"><AlertCircle size={15} /> {error}</div>}
      {preview && (
        <>
          <div className="archive-result note-import-summary">
            <strong>{preview.title}</strong>
            <span>
              {preview.noteType} template · {preview.attachmentCount} attachment(s)
              {preview.favorite ? ' · Favorite' : ''}
              {preview.pinned ? ' · Pinned' : ''}
              {preview.archived ? ' · Archived' : ''}
            </span>
            {preview.existingNoteId && (
              <span className="note-import-conflict">Matching note found: {preview.existingNoteTitle}</span>
            )}
          </div>
          {file && <p className="archive-filename"><FileArchive size={15} /> {file.name}</p>}
        </>
      )}
      {busy && (
        <div className="import-progress" aria-live="polite">
          <div className="progress-track"><span style={{ width: '68%' }} /></div>
          <p><LoaderCircle className="spin" size={13} /> Importing note and restoring attachments…</p>
        </div>
      )}

      <div className="dialog-footer">
        <span className="dialog-folder-hint">Cancel leaves your existing notes unchanged.</span>
        <button type="button" className="dialog-cancel" disabled={busy} onClick={onClose}>Cancel</button>
        {preview?.existingNoteId ? (
          <>
            <button type="button" className="dialog-danger" disabled={busy} onClick={() => onImport('override')}>
              Override Existing
            </button>
            <button type="button" className="dialog-submit" disabled={busy} onClick={() => onImport('copy')}>
              Create Copy
            </button>
          </>
        ) : preview && (
          <button type="button" className="dialog-submit" disabled={busy} onClick={() => onImport('copy')}>
            Import note
          </button>
        )}
      </div>
    </DialogFrame>
  );
}
