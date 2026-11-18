import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  FileText,
  Lightbulb,
  NotebookPen,
  X,
} from 'lucide-react';
import { getNoteTemplate, NOTE_TEMPLATES } from './noteTemplates';
import { DialogFrame } from './OverlaySystem';

const TEMPLATE_ICONS = {
  blank: FileText,
  meeting: CalendarDays,
  journal: NotebookPen,
  todo: CheckSquare,
  project: BriefcaseBusiness,
  study: BookOpen,
  technical: FileText,
  quick: Lightbulb,
};

export function getFolderOptions(folders, query = '') {
  const childrenByParent = new Map();
  folders.forEach((folder) => {
    const key = folder.parentFolderId || null;
    const children = childrenByParent.get(key) || [];
    children.push(folder);
    childrenByParent.set(key, children);
  });

  const result = [];
  function visit(parentId, depth) {
    (childrenByParent.get(parentId) || []).forEach((folder) => {
      if (!query || folder.name.toLowerCase().includes(query)) {
        result.push({ ...folder, depth });
      }
      visit(folder.id, depth + 1);
    });
  }
  visit(null, 0);
  return result;
}

export default function CreateNoteDialog({
  folders,
  defaultFolderId,
  onClose,
  onCreate,
  onCreateFolder,
}) {
  const [type, setType] = useState('blank');
  const [title, setTitle] = useState(getNoteTemplate('blank').title);
  const [folderId, setFolderId] = useState(defaultFolderId || '');
  const [folderSearch, setFolderSearch] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const foldersById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const folderOptions = useMemo(
    () => getFolderOptions(folders, folderSearch.trim().toLowerCase()),
    [folders, folderSearch],
  );
  const template = getNoteTemplate(type);
  let recentFolderIds = [];
  try {
    recentFolderIds = JSON.parse(window.localStorage.getItem('notesphere.recentFolders') || '[]');
  } catch {
    recentFolderIds = [];
  }
  const recentFolders = recentFolderIds
    .map((id) => foldersById.get(id))
    .filter(Boolean)
    .slice(0, 3);

  function chooseFolder(id) {
    setFolderId(id);
    if (!id) return;
    try {
      const recent = JSON.parse(window.localStorage.getItem('notesphere.recentFolders') || '[]')
        .filter((folderId) => folderId !== id);
      window.localStorage.setItem('notesphere.recentFolders', JSON.stringify([id, ...recent].slice(0, 5)));
    } catch {
      setFolderId(id);
    }
  }

  function chooseTemplate(nextType) {
    const nextTemplate = getNoteTemplate(nextType);
    setType(nextType);
    setTitle(nextTemplate.title);
  }

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const folder = await onCreateFolder(name, folderId || null);
    if (folder) {
      chooseFolder(folder.id);
      setNewFolderName('');
      setShowNewFolder(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const success = await onCreate({
      title: title.trim() || template.title,
      content: template.content,
      noteType: type,
      folderId: folderId || null,
    });
    setSubmitting(false);
    if (success) onClose();
  }

  return (
    <DialogFrame labelId="create-dialog-title" onClose={onClose} busy={submitting}>
        <div className="dialog-heading">
          <div>
            <span className="dialog-eyebrow">A FRESH PAGE</span>
            <h2 id="create-dialog-title">What are we writing?</h2>
            <p>Pick a starting point. You can change anything later.</p>
          </div>
          <button type="button" className="dialog-close" aria-label="Close dialog" disabled={submitting} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="template-grid" role="radiogroup" aria-label="Note template">
          {NOTE_TEMPLATES.map((item) => {
            const Icon = TEMPLATE_ICONS[item.id];
            return (
              <button
                type="button"
                key={item.id}
                className={`template-card${type === item.id ? ' template-card-selected' : ''}`}
                role="radio"
                aria-checked={type === item.id}
                onClick={() => chooseTemplate(item.id)}
              >
                <span className="template-icon"><Icon size={17} /></span>
                <span className="template-name">{item.name}</span>
                <span className="template-description">{item.description}</span>
              </button>
            );
          })}
        </div>

        <form className="create-note-form" onSubmit={submit}>
          <label className="dialog-label" htmlFor="new-note-title">NOTE TITLE</label>
          <input
            id="new-note-title"
            className="dialog-input"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />

          <div className="folder-picker-heading">
            <label className="dialog-label" htmlFor="new-note-folder">SAVE IN</label>
            {folders.length > 0 && (
              <input
                className="folder-picker-search"
                value={folderSearch}
                onChange={(event) => setFolderSearch(event.target.value)}
                placeholder="Find folder"
                aria-label="Search folders"
              />
            )}
          </div>
          <select
            id="new-note-folder"
            className="dialog-input folder-picker"
            value={folderId}
            onChange={(event) => chooseFolder(event.target.value)}
          >
            <option value="">Unfiled notes</option>
            {recentFolders.length > 0 && (
              <optgroup label="Recently used">
                {recentFolders.map((folder) => <option key={`recent-${folder.id}`} value={folder.id}>{folder.name}</option>)}
              </optgroup>
            )}
            <optgroup label="All folders">
              {folderOptions.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {`${'　'.repeat(folder.depth)}${folder.name}`}
                </option>
              ))}
            </optgroup>
            {folderSearch && folderOptions.length === 0 && (
              <option disabled>No matching folders</option>
            )}
          </select>

          {showNewFolder ? (
            <div className="new-folder-inline">
              <input
                className="dialog-input"
                value={newFolderName}
                maxLength={120}
                placeholder={folderId && foldersById.has(folderId) ? 'New subfolder name' : 'New folder name'}
                aria-label="New folder name"
                onChange={(event) => setNewFolderName(event.target.value)}
              />
              <button type="button" className="inline-create-folder" onClick={createFolder}>Add</button>
              <button type="button" className="inline-cancel-folder" aria-label="Cancel new folder" onClick={() => setShowNewFolder(false)}>
                <X size={15} />
              </button>
            </div>
          ) : (
            <button type="button" className="dialog-new-folder" onClick={() => setShowNewFolder(true)}>
              <span>+</span> Create a folder here
            </button>
          )}

          <div className="dialog-footer">
            <span className="dialog-folder-hint">
              {folderId && foldersById.has(folderId)
                ? `Filed in ${foldersById.get(folderId).name}`
                : 'Saved to Unfiled notes'}
            </span>
            <button type="button" className="dialog-cancel" disabled={submitting} onClick={onClose}>Cancel</button>
            <button type="submit" className="dialog-submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create note'}
            </button>
          </div>
        </form>
    </DialogFrame>
  );
}
