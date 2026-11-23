import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignLeft,
  Archive,
  BarChart3,
  Check,
  Clock3,
  Cloud,
  Download,
  FileText,
  Folder,
  Folders,
  LoaderCircle,
  LogOut,
  Menu,
  MoreHorizontal,
  Pin,
  Plus,
  Printer,
  Search,
  Save,
  Star,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import CreateNoteDialog, { getFolderOptions } from './CreateNoteDialog';
import Dashboard from './Dashboard';
import EditorToolbar from './EditorToolbar';
import FolderDashboard from './FolderDashboard';
import NoteImportDialog from './NoteImportDialog';
import { getNoteTemplate, NOTE_TEMPLATES } from './noteTemplates';
import { normalizeAttachmentUrls } from './attachmentUrls';
import { downloadAttachment } from './attachmentDownload';
import { PortalMenu, useDialogs, useManagedMenu } from './OverlaySystem';
import AuthGate from './AuthGate';
import { apiFetch } from './api';
import { exportWordDocument, importDocumentFile } from './documentTransfer';

const API = import.meta.env.VITE_API_BASE_URL || '';
const EMPTY_CONTENT = '<p></p>';
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const COUNTABLE_BLOCK_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'LI', 'BLOCKQUOTE', 'PRE', 'TR', 'TD', 'TH',
]);
const INLINE_IMAGE_TYPES = new Set([
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const LIST_STYLE_TYPES = new Set([
  'disc',
  'circle',
  'square',
  'decimal',
  'decimal-leading-zero',
  'lower-alpha',
  'upper-alpha',
  'lower-roman',
  'upper-roman',
]);

const RichTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => (attributes.fontSize
          ? { style: `font-size: ${attributes.fontSize}` }
          : {}),
      },
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
        renderHTML: (attributes) => (attributes.backgroundColor
          ? { style: `background-color: ${attributes.backgroundColor}` }
          : {}),
      },
      letterSpacing: {
        default: null,
        parseHTML: (element) => element.style.letterSpacing || null,
        renderHTML: (attributes) => (attributes.letterSpacing
          ? { style: `letter-spacing: ${attributes.letterSpacing}` }
          : {}),
      },
    };
  },
});

const ParagraphFormat = TextAlign.extend({
  addGlobalAttributes() {
    return [
      ...(this.parent?.() || []),
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => (attributes.lineHeight
              ? { style: `line-height: ${attributes.lineHeight}` }
              : {}),
          },
          paragraphSpacing: {
            default: null,
            parseHTML: (element) => element.style.marginBottom || null,
            renderHTML: (attributes) => (attributes.paragraphSpacing
              ? { style: `margin-bottom: ${attributes.paragraphSpacing}` }
              : {}),
          },
        },
      },
      {
        types: ['bulletList', 'orderedList'],
        attributes: {
          listStyleType: {
            default: null,
            parseHTML: (element) => {
              const value = element.getAttribute('data-list-style');
              return LIST_STYLE_TYPES.has(value) ? value : null;
            },
            renderHTML: (attributes) => (LIST_STYLE_TYPES.has(attributes.listStyleType)
              ? { 'data-list-style': attributes.listStyleType }
              : {}),
          },
          markerColor: {
            default: null,
            parseHTML: (element) => {
              const value = element.getAttribute('data-marker-color');
              return /^#[\da-f]{6}$/i.test(value || '') ? value : null;
            },
            renderHTML: (attributes) => (/^#[\da-f]{6}$/i.test(attributes.markerColor || '')
              ? {
                'data-marker-color': attributes.markerColor,
                style: `--list-marker-color: ${attributes.markerColor}`,
              }
              : {}),
          },
        },
      },
    ];
  },
});

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function getPlainText(html) {
  return new DOMParser().parseFromString(html || '', 'text/html').body.textContent || '';
}

function getCountableText(html) {
  const document = new DOMParser().parseFromString(html || '', 'text/html');

  function readNode(node) {
    if (node.nodeType === 3) return node.nodeValue || '';
    if (node.nodeType !== 1) return '';
    if (node.tagName === 'BR') return '\n';

    const text = Array.from(node.childNodes, readNode).join('');
    return COUNTABLE_BLOCK_TAGS.has(node.tagName) ? `${text}\n` : text;
  }

  return readNode(document.body).replace(/\n+/g, '\n').replace(/^\n+|\n+$/g, '');
}

function normalizeNote(note) {
  return { ...note, content: normalizeAttachmentUrls(note.content, API) };
}

function getAttachmentUrl(attachment, inline = false) {
  const params = new URLSearchParams({
    key: attachment.objectKey,
    fileName: attachment.fileName,
  });
  if (inline) params.set('inline', 'true');
  return `${API}/api/attachments/${encodeURIComponent(attachment.id)}?${params}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function NotesphereApp({ onSignOut }) {
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [viewType, setViewType] = useState('all');
  const [viewFolderId, setViewFolderId] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notesReloadKey, setNotesReloadKey] = useState(0);
  const [saveState, setSaveState] = useState('saved');
  const [notice, setNotice] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [noteImportFile, setNoteImportFile] = useState(null);
  const [noteImportPreview, setNoteImportPreview] = useState(null);
  const [noteImportError, setNoteImportError] = useState('');
  const [noteImportBusy, setNoteImportBusy] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [editorZoom, setEditorZoom] = useState(100);
  const dialogs = useDialogs();
  const noteActionsMenu = useManagedMenu();
  const profileMenu = useManagedMenu();
  const noteActionsAnchorRef = useRef(null);
  const profileMenuAnchorRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const noteArchiveInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const activeIdRef = useRef(activeId);
  const dirtyIdsRef = useRef(new Set());
  const versionsRef = useRef(new Map());
  const requestIdsRef = useRef(new Map());
  activeIdRef.current = activeId;

  const markNoteChanged = useCallback((id, update) => {
    dirtyIdsRef.current.add(id);
    versionsRef.current.set(id, (versionsRef.current.get(id) || 0) + 1);
    setNotes((previous) => previous.map((note) => (
      note.id === id ? { ...note, ...update } : note
    )));
    setSaveState('dirty');
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, link: false }),
      Image.configure({ HTMLAttributes: { class: 'note-image' } }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Underline,
      RichTextStyle,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      ParagraphFormat.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: 'Start with an idea, a question, or a plan…' }),
    ],
    content: EMPTY_CONTENT,
    editorProps: {
      attributes: {
        class: 'editor-content',
        'aria-label': 'Note content',
        spellcheck: 'true',
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'x') {
          event.preventDefault();
          editor.commands.toggleStrike();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      const id = activeIdRef.current;
      if (id) markNoteChanged(id, { content: activeEditor.getHTML() });
    },
  });

  useEffect(() => {
    if (!editor) return undefined;

    function handleAttachmentClick(event) {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest('a.attachment-link');
      if (!link || !editor.view.dom.contains(link)) return;

      event.preventDefault();
      event.stopPropagation();
      const fallbackName = new URL(link.href, window.location.href).searchParams.get('fileName')
        || link.textContent?.trim().replace(/^📎\s*/, '').split(' · ')[0]
        || 'attachment';
      void downloadAttachment(link.href, fallbackName, apiFetch)
        .then(() => setNotice({ tone: 'success', message: `${fallbackName} downloaded.` }))
        .catch((error) => setNotice({
          tone: 'error',
          message: error.message || 'The attachment could not be downloaded.',
        }));
    }

    editor.view.dom.addEventListener('click', handleAttachmentClick, true);
    return () => editor.view.dom.removeEventListener('click', handleAttachmentClick, true);
  }, [editor]);

  const current = notes.find((note) => note.id === activeId) || null;
  const activeFolder = folders.find((folder) => folder.id === viewFolderId) || null;
  const foldersById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const currentFolderPath = useMemo(() => {
    const path = [];
    let folder = current?.folderId ? foldersById.get(current.folderId) : null;
    while (folder) {
      path.unshift(folder);
      folder = folder.parentFolderId ? foldersById.get(folder.parentFolderId) : null;
    }
    return path;
  }, [current?.folderId, foldersById]);
  const viewFolderPath = useMemo(() => {
    const path = [];
    let folder = viewFolderId ? foldersById.get(viewFolderId) : null;
    while (folder) {
      path.unshift(folder);
      folder = folder.parentFolderId ? foldersById.get(folder.parentFolderId) : null;
    }
    return path;
  }, [viewFolderId, foldersById]);
  const folderOptions = useMemo(() => getFolderOptions(folders), [folders]);

  const saveNote = useCallback(async (note) => {
    if (!note) return false;

    const version = versionsRef.current.get(note.id) || 0;
    const requestId = (requestIdsRef.current.get(note.id) || 0) + 1;
    requestIdsRef.current.set(note.id, requestId);
    if (activeIdRef.current === note.id) setSaveState('saving');

    try {
      const response = await apiFetch(`${API}/api/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: (note.title || '').trim() || 'Untitled note',
          content: note.content || EMPTY_CONTENT,
          folderId: note.folderId || null,
          noteType: note.noteType || 'blank',
          favorite: Boolean(note.favorite),
          pinned: Boolean(note.pinned),
          archived: Boolean(note.archived),
        }),
      });
      if (!response.ok) {
        throw new Error(`Save failed (${response.status}). Please try again.`);
      }

      const savedNote = await response.json();
      setNotes((previous) => previous.map((item) => (
        item.id === savedNote.id
          ? { ...item, updatedAt: savedNote.updatedAt }
          : item
      )));

      if (
        requestIdsRef.current.get(note.id) === requestId
        && (versionsRef.current.get(note.id) || 0) === version
      ) {
        dirtyIdsRef.current.delete(note.id);
        if (activeIdRef.current === note.id) setSaveState('saved');
      }
      return true;
    } catch (error) {
      if (requestIdsRef.current.get(note.id) === requestId) {
        if (activeIdRef.current === note.id) setSaveState('error');
        setNotice({ tone: 'error', message: error.message || 'The note could not be saved.' });
      }
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadNotes() {
      setLoading(true);
      setLoadError('');
      try {
        const params = new URLSearchParams();
        if (viewType === 'folder' && viewFolderId) params.set('folderId', viewFolderId);
        if (viewType === 'unfiled') params.set('unfiled', 'true');
        if (viewType === 'favorites') params.set('favorites', 'true');
        if (viewType === 'archived') params.set('archived', 'true');
        const query = params.toString();
        const response = await apiFetch(`${API}/api/notes${query ? `?${query}` : ''}`);
        if (!response.ok) throw new Error(`Could not load notes (${response.status}).`);
        const data = await response.json();
        if (cancelled) return;
        setNotes(data.map(normalizeNote));
        setActiveId((selectedId) => (
          selectedId && data.some((note) => note.id === selectedId)
            ? selectedId
            : data[0]?.id || null
        ));
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'Could not connect to the notes service.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadNotes();
    return () => {
      cancelled = true;
    };
  }, [viewType, viewFolderId, notesReloadKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadFolders() {
      try {
        const response = await apiFetch(`${API}/api/folders`);
        if (!response.ok) throw new Error(`Could not load folders (${response.status}).`);
        const data = await response.json();
        if (!cancelled) setFolders(data);
      } catch (error) {
        if (!cancelled) setNotice({ tone: 'error', message: error.message || 'Could not load folders.' });
      }
    }
    loadFolders();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!editor) return;
    const content = normalizeAttachmentUrls(current?.content || EMPTY_CONTENT, API);
    if (editor.getHTML() !== content) editor.commands.setContent(content, false);
  }, [activeId, current?.content, editor]);

  useEffect(() => {
    if (!current || !dirtyIdsRef.current.has(current.id)) return undefined;
    const noteToSave = current;
    const timer = window.setTimeout(() => {
      saveNote(noteToSave);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [
    current?.id,
    current?.title,
    current?.content,
    current?.folderId,
    current?.noteType,
    current?.favorite,
    current?.pinned,
    current?.archived,
    saveNote,
  ]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 5200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const scopedNotes = viewType === 'favorites' ? notes.filter((note) => note.favorite) : notes;
    const visibleNotes = [...scopedNotes].sort((left, right) => (
      Number(Boolean(right.pinned)) - Number(Boolean(left.pinned))
      || new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt)
    ));
    if (viewType === 'recent') visibleNotes.splice(10);
    if (!query) return visibleNotes;
    return visibleNotes.filter((note) => (
      (note.title || '').toLowerCase().includes(query)
      || getPlainText(note.content).toLowerCase().includes(query)
    ));
  }, [notes, search, viewType]);
  const viewTitle = viewType === 'folder' ? activeFolder?.name || 'Folder'
    : ({
      all: 'All notes',
      favorites: 'Favorites',
      recent: 'Recent notes',
      archived: 'Archived',
      unfiled: 'Unfiled notes',
      dashboard: 'Dashboard',
      folders: 'Folders',
    }[viewType] || 'All notes');

  const wordCount = useMemo(() => {
    const text = getCountableText(current?.content).trim();
    return text ? text.split(/\s+/).length : 0;
  }, [current?.content]);
  const characterCount = useMemo(
    () => getCountableText(current?.content).length,
    [current?.content],
  );

  async function refreshFolders() {
    const response = await apiFetch(`${API}/api/folders`);
    if (!response.ok) throw new Error(`Could not load folders (${response.status}).`);
    const data = await response.json();
    setFolders(data);
    return data;
  }

  async function createFolderRequest(name, parentFolderId = null) {
    try {
      const response = await apiFetch(`${API}/api/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentFolderId }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Could not create folder (${response.status}).`);
      }
      const folder = await response.json();
      try {
        await refreshFolders();
      } catch (error) {
        setNotice({ tone: 'error', message: `Folder created, but the folder list could not refresh: ${error.message}` });
        return folder;
      }
      setNotice({ tone: 'success', message: `Folder “${folder.name}” created.` });
      return folder;
    } catch (error) {
      setNotice({ tone: 'error', message: error.message || 'The folder could not be created.' });
      return null;
    }
  }

  async function addFolder(parent = null) {
    await dialogs.prompt({
      title: parent ? 'Create a subfolder' : 'Create a folder',
      message: parent ? `Add a folder inside “${parent.name}”.` : 'Choose a name for your new folder.',
      label: 'FOLDER NAME',
      confirmLabel: 'Create folder',
      maxLength: 120,
      validate: (value) => value.trim() ? '' : 'Enter a folder name.',
      onConfirm: async (value) => {
        const folder = await createFolderRequest(value.trim(), parent?.id || null);
        if (!folder) throw new Error('The folder could not be created. Review the notification for details.');
        return value.trim();
      },
    });
  }

  async function renameFolder(folder) {
    const name = await dialogs.prompt({
      title: 'Rename folder',
      message: 'Choose a new name for this folder.',
      label: 'FOLDER NAME',
      value: folder.name,
      confirmLabel: 'Save name',
      maxLength: 120,
      validate: (value) => value.trim() ? '' : 'Enter a folder name.',
      onConfirm: async (value) => {
        if (value.trim() === folder.name) return value.trim();
        const response = await apiFetch(`${API}/api/folders/${folder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: value.trim(), parentFolderId: folder.parentFolderId }),
        });
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || `Could not rename folder (${response.status}).`);
        }
        try {
          await refreshFolders();
        } catch (error) {
          setNotice({ tone: 'error', message: `Folder renamed, but the folder list could not refresh: ${error.message}` });
          return value.trim();
        }
        setNotice({ tone: 'success', message: 'Folder renamed.' });
        return value.trim();
      },
    });
    if (!name?.trim() || name.trim() === folder.name) return;
  }

  async function moveFolder(folder, parentFolderId) {
    try {
      const response = await apiFetch(`${API}/api/folders/${folder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folder.name, parentFolderId }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Could not move folder (${response.status}).`);
      }
      await refreshFolders();
      setNotice({ tone: 'success', message: `“${folder.name}” moved.` });
      return true;
    } catch (error) {
      setNotice({ tone: 'error', message: error.message || 'The folder could not be moved.' });
      return false;
    }
  }

  async function exportFolder(folder) {
    try {
      const response = await apiFetch(`${API}/api/folders/${folder.id}/export`);
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Could not export folder (${response.status}).`);
      }
      const archive = await response.blob();
      const url = URL.createObjectURL(archive);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folder.name.replace(/[\\/:*?"<>|]/g, '_')}.notesphere.zip`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice({ tone: 'success', message: `“${folder.name}” backup downloaded.` });
    } catch (error) {
      setNotice({ tone: 'error', message: error.message || 'The folder backup could not be downloaded.' });
    }
  }

  async function exportNote(note) {
    if (dirtyIdsRef.current.has(note.id) && !(await saveNote(note))) return;
    try {
      const response = await apiFetch(`${API}/api/notes/${note.id}/export`);
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Could not export note (${response.status}).`);
      }
      const archive = await response.blob();
      const url = URL.createObjectURL(archive);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(note.title || 'Untitled note').replace(/[\\/:*?"<>|]/g, '_')}.notesphere-note.zip`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice({ tone: 'success', message: `“${note.title || 'Untitled note'}” backup downloaded.` });
    } catch (error) {
      setNotice({ tone: 'error', message: error.message || 'The note backup could not be downloaded.' });
    }
  }

  async function exportWord(note) {
    try {
      const content = editor?.getHTML() || note.content || EMPTY_CONTENT;
      const documentBlob = await exportWordDocument(note.title || 'Untitled note', content);
      const url = URL.createObjectURL(documentBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(note.title || 'Untitled note').replace(/[\\/:*?"<>|]/g, '_')}.docx`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice({ tone: 'success', message: 'Word document downloaded.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error.message || 'The Word document could not be exported.' });
    }
  }

  async function importDocument(file) {
    if (!file || !current) return;
    if (file.size > MAX_FILE_SIZE) {
      setNotice({ tone: 'error', message: 'Choose a document smaller than 25 MB.' });
      return;
    }
    const confirmed = await dialogs.confirm({
      title: 'Import document into this note?',
      message: 'The document text will replace this note’s content. Existing attachments will remain. This change will autosave.',
      confirmLabel: 'Replace note content',
      danger: true,
    });
    if (!confirmed) return;
    if (dirtyIdsRef.current.has(current.id) && !(await saveNote(current))) return;

    setUploading(true);
    try {
      const content = await importDocumentFile(file);
      if (!editor || activeIdRef.current !== current.id) {
        throw new Error('The active note changed before the document could be imported. Please try again.');
      }
      editor.commands.setContent(content);
      setNotice({ tone: 'success', message: `${file.name} was imported into the note.` });
    } catch (error) {
      setNotice({ tone: 'error', message: error.message || 'The document could not be imported.' });
    } finally {
      setUploading(false);
    }
  }

  async function previewNoteImport(file) {
    if (!file) return;
    setNoteImportFile(file);
    setNoteImportPreview(null);
    setNoteImportError('');
    setNoteImportBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiFetch(`${API}/api/notes/import/preview`, { method: 'POST', body: formData });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Could not read note backup (${response.status}).`);
      }
      setNoteImportPreview(await response.json());
    } catch (error) {
      setNoteImportError(error.message || 'The note backup could not be read.');
    } finally {
      setNoteImportBusy(false);
    }
  }

  async function importNote(file, strategy) {
    if (!file) return;
    if (current && dirtyIdsRef.current.has(current.id) && !(await saveNote(current))) return;
    if (strategy === 'override' && !await dialogs.confirm({
      title: 'Replace existing note?',
      message: `This replaces “${noteImportPreview?.existingNoteTitle || noteImportPreview?.title}” with the imported content and attachments.`,
      confirmLabel: 'Replace note',
      danger: true,
    })) return;

    setNoteImportError('');
    setNoteImportBusy(true);
    let importCommitted = false;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiFetch(`${API}/api/notes/import?strategy=${encodeURIComponent(strategy)}`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Could not import note (${response.status}).`);
      }
      const result = await response.json();
      importCommitted = true;
      const importedResponse = await apiFetch(`${API}/api/notes/${result.noteId}`);
      if (!importedResponse.ok) throw new Error(`The note was imported but could not be loaded (${importedResponse.status}).`);
      const imported = normalizeNote(await importedResponse.json());
      dirtyIdsRef.current.delete(imported.id);
      requestIdsRef.current.set(imported.id, (requestIdsRef.current.get(imported.id) || 0) + 1);
      setNotes((previous) => [imported, ...previous.filter((note) => note.id !== imported.id)]);
      setActiveId(imported.id);
      setViewType(imported.archived ? 'archived' : imported.folderId ? 'folder' : 'all');
      setViewFolderId(imported.folderId || null);
      setNoteImportFile(null);
      setNoteImportPreview(null);
      setNoteImportError('');
      setNotice({ tone: 'success', message: result.overridden ? 'Note replaced.' : 'Note imported.' });
      void refreshFolders();
    } catch (error) {
      if (importCommitted) {
        setNoteImportFile(null);
        setNoteImportPreview(null);
        setNoteImportError('');
        setNotice({ tone: 'error', message: `The note was imported but could not refresh in the editor: ${error.message}` });
      } else {
        setNoteImportError(error.message || 'The note could not be imported.');
      }
    } finally {
      setNoteImportBusy(false);
    }
  }

  function closeNoteImport() {
    if (noteImportBusy) return;
    setNoteImportFile(null);
    setNoteImportPreview(null);
    setNoteImportError('');
  }

  async function finishFolderImport(result) {
    try {
      await refreshFolders();
      setViewType('folder');
      setViewFolderId(result.rootFolderId);
      setActiveId(null);
      setNotesReloadKey((value) => value + 1);
      setNotice({ tone: 'success', message: `${result.notesImported} notes restored in “${result.rootFolderName}”.` });
    } catch (error) {
      setNotice({ tone: 'error', message: `The import finished, but folders could not refresh: ${error.message}` });
    }
  }

  async function deleteFolder(folder) {
    const descendantIds = new Set([folder.id]);
    let foundChild = true;
    while (foundChild) {
      foundChild = false;
      folders.forEach((item) => {
        if (item.parentFolderId && descendantIds.has(item.parentFolderId) && !descendantIds.has(item.id)) {
          descendantIds.add(item.id);
          foundChild = true;
        }
      });
    }
    const noteCount = folders
      .filter((item) => descendantIds.has(item.id))
      .reduce((count, item) => count + (item.noteCount || 0), 0);
    const confirmed = await dialogs.confirm({
      title: 'Delete folder?',
      message: `Delete “${folder.name}”? ${noteCount} note(s) will be moved to Unfiled and subfolders will be moved up one level.`,
      confirmLabel: 'Delete folder',
      danger: true,
      onConfirm: async () => {
        const response = await apiFetch(`${API}/api/folders/${folder.id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`Could not delete folder (${response.status}).`);
        await refreshFolders();
        if (viewType === 'folder' && viewFolderId === folder.id) {
          setViewType('all');
          setViewFolderId(null);
          setActiveId(null);
        }
        setNotice({ tone: 'success', message: 'Folder deleted; notes were kept in Unfiled.' });
        return true;
      },
    });
    if (!confirmed) return;
  }

  async function selectView(type, folderId = null) {
    if (current && dirtyIdsRef.current.has(current.id) && !(await saveNote(current))) return;
    setActiveId(null);
    setViewType(type);
    setViewFolderId(folderId);
    setSidebarOpen(false);
  }

  async function moveCurrentNote(folderId) {
    if (!current) return;
    if (dirtyIdsRef.current.has(current.id) && !(await saveNote(current))) return;
    try {
      const response = await apiFetch(`${API}/api/notes/${current.id}/folder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: folderId || null }),
      });
      if (!response.ok) throw new Error(`Could not move note (${response.status}).`);
      const updated = normalizeNote(await response.json());
      setNotes((previous) => previous.map((note) => (note.id === updated.id ? updated : note)));
      void refreshFolders();
      if (viewType === 'folder' && viewFolderId !== folderId) setActiveId(null);
      setNotice({ tone: 'success', message: folderId ? 'Note moved to folder.' : 'Note moved to Unfiled.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error.message || 'The note could not be moved.' });
    }
  }

  function toggleFavorite() {
    if (current) markNoteChanged(current.id, { favorite: !current.favorite });
  }

  function togglePinned() {
    if (current) markNoteChanged(current.id, { pinned: !current.pinned });
  }

  async function toggleArchived() {
    if (!current) return;
    if (dirtyIdsRef.current.has(current.id) && !(await saveNote(current))) return;
    const shouldArchive = viewType !== 'archived';
    const body = {
      title: (current.title || '').trim() || 'Untitled note',
      content: current.content || EMPTY_CONTENT,
      folderId: current.folderId || null,
      noteType: current.noteType || 'blank',
      favorite: Boolean(current.favorite),
      pinned: Boolean(current.pinned),
      archived: shouldArchive,
    };
    setSaveState('saving');
    try {
      const response = await apiFetch(`${API}/api/notes/${current.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Could not update note (${response.status}).`);
      const updated = normalizeNote(await response.json());
      dirtyIdsRef.current.delete(current.id);
      setNotes((previous) => shouldArchive
        ? previous.filter((note) => note.id !== current.id)
        : previous.map((note) => (note.id === updated.id ? updated : note)));
      setActiveId(null);
      setSaveState('saved');
      setNotice({ tone: 'success', message: shouldArchive ? 'Note archived.' : 'Note restored from archive.' });
    } catch (error) {
      setSaveState('error');
      setNotice({ tone: 'error', message: error.message || 'The note could not be updated.' });
    }
  }

  const createNote = useCallback(async ({ title, content, noteType, folderId }) => {
    if (uploading) return;
    if (current && dirtyIdsRef.current.has(current.id) && !(await saveNote(current))) return;

    try {
      const response = await apiFetch(`${API}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, noteType, folderId }),
      });
      if (!response.ok) throw new Error(`Could not create note (${response.status}).`);
      const note = await response.json();
      setNotes((previous) => [note, ...previous]);
      setActiveId(note.id);
      setSidebarOpen(false);
      if (folderId) {
        setViewType('folder');
        setViewFolderId(folderId);
      } else if (
        viewType === 'archived' || viewType === 'favorites' || viewType === 'folder'
        || viewType === 'dashboard' || viewType === 'folders'
      ) {
        setViewType('all');
        setViewFolderId(null);
      }
      setSaveState('saved');
      setNotice({ tone: 'success', message: 'A new note is ready.' });
      void refreshFolders();
      return true;
    } catch (error) {
      setNotice({ tone: 'error', message: error.message || 'The note could not be created.' });
      return false;
    }
  }, [current, saveNote, uploading, viewType]);

  const openCreateDialog = useCallback(() => {
    if (!uploading) setShowCreateDialog(true);
  }, [uploading]);

  const openCreateDialogRef = useRef(openCreateDialog);
  openCreateDialogRef.current = openCreateDialog;
  useEffect(() => {
    function handleShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openCreateDialogRef.current();
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  async function selectNote(id) {
    if (current && dirtyIdsRef.current.has(current.id) && !(await saveNote(current))) return;
    setActiveId(id);
    setSaveState(dirtyIdsRef.current.has(id) ? 'dirty' : 'saved');
    setSidebarOpen(false);
    noteActionsMenu.close();
  }

  async function openDashboardNote(note) {
    if (current && dirtyIdsRef.current.has(current.id) && !(await saveNote(current))) return;
    setViewType(note.folderId ? 'folder' : 'all');
    setViewFolderId(note.folderId || null);
    setActiveId(note.id);
    setSidebarOpen(false);
  }

  async function deleteCurrentNote() {
    if (!current) return;
    noteActionsMenu.close();
    if (!await dialogs.confirm({
      title: 'Delete note?',
      message: `Delete “${current.title || 'Untitled note'}”? This cannot be undone.`,
      confirmLabel: 'Delete note',
      danger: true,
      onConfirm: async () => {
        const response = await apiFetch(`${API}/api/notes/${current.id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`Delete failed (${response.status}).`);
        dirtyIdsRef.current.delete(current.id);
        requestIdsRef.current.set(current.id, (requestIdsRef.current.get(current.id) || 0) + 1);
        setNotes((previous) => previous.filter((note) => note.id !== current.id));
        setActiveId(null);
        setSaveState('saved');
        setNotice({ tone: 'success', message: 'Note deleted.' });
        return true;
      },
    })) return;
  }

  async function confirmSignOut() {
    profileMenu.close();
    const confirmed = await dialogs.confirm({
      title: 'Sign out?',
      message: 'Your notes are saved in your workspace. You can sign in again at any time.',
      confirmLabel: 'Sign out',
      danger: true,
    });
    if (confirmed) {
      const result = await onSignOut();
      if (!result) {
        await dialogs.alert({
          title: 'Sign out failed',
          message: 'The server could not end this session. Please try again.',
        });
      }
    }
  }

  async function uploadFile(file, type) {
    if (!file || !current) return;
    if (file.size > MAX_FILE_SIZE) {
      setNotice({ tone: 'error', message: 'Files must be 25 MB or smaller.' });
      return;
    }
    if (type === 'image' && !INLINE_IMAGE_TYPES.has(file.type)) {
      setNotice({ tone: 'error', message: 'Use a PNG, JPEG, GIF, WebP, AVIF, or BMP image.' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('noteId', current.id);
    setUploading(true);

    try {
      const response = await apiFetch(`${API}/api/attachments`, { method: 'POST', body: formData });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Upload failed (${response.status}).`);
      }
      const attachment = await response.json();
      const downloadUrl = getAttachmentUrl(attachment);

      if (type === 'image') {
        const imageUrl = getAttachmentUrl(attachment, true);
        const downloadCard = `<p><a class="attachment-link" href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener noreferrer">📎 Download ${escapeHtml(attachment.fileName)} · ${formatBytes(file.size)}</a></p>`;
        const imageMarkup = `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(attachment.fileName)}" title="${escapeHtml(attachment.fileName)}" class="note-image" />`;
        editor?.chain().focus().insertContent(`${downloadCard}${imageMarkup}`).run();
      } else {
        const previewLink = file.type === 'application/pdf'
          ? ` <a class="attachment-preview-link" href="${escapeHtml(getAttachmentUrl(attachment, true))}" target="_blank" rel="noopener noreferrer">Preview PDF</a>`
          : '';
        const html = `<p><a class="attachment-link" href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener noreferrer">📎 ${escapeHtml(attachment.fileName)} · ${formatBytes(file.size)} · Download</a>${previewLink}</p>`;
        editor?.chain().focus().insertContent(html).run();
      }

      setNotice({
        tone: 'success',
        message: type === 'image' ? 'Image added to your note.' : 'Attachment added to your note.',
      });
    } catch (error) {
      setNotice({ tone: 'error', message: error.message || 'The file could not be uploaded.' });
    } finally {
      setUploading(false);
    }
  }

  function updateTitle(value) {
    if (current) markNoteChanged(current.id, { title: value });
  }

  const saveLabel = {
    dirty: 'Unsaved changes',
    saving: 'Saving…',
    saved: 'All changes saved',
    error: 'Could not save',
  }[saveState];

  return (
    <div className={`app-shell${focusMode ? ' focus-mode' : ''}`}>
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close notes menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Sparkles size={19} strokeWidth={2.2} /></div>
          <div className="brand-copy">
            <strong>NoteSphere</strong>
            <span>Your thinking space</span>
          </div>
          <button className="icon-button sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <button className="new-note-button" disabled={uploading} onClick={openCreateDialog}>
          <Plus size={17} />
          <span>New note</span>
          <kbd>⌘ N</kbd>
        </button>

        <div className="search-box">
          <Search size={16} />
          <input
            aria-label="Search notes"
            placeholder="Search your notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <input
            ref={noteArchiveInputRef}
            className="visually-hidden"
            type="file"
            accept=".zip,application/zip"
            aria-label="Choose a NoteSphere note backup"
            onChange={(event) => {
              void previewNoteImport(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <input
            ref={documentInputRef}
            className="visually-hidden"
            type="file"
            accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-label="Choose a PDF or Word document"
            onChange={(event) => {
              void importDocument(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          {search && (
            <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
          <NoteImportDialog
            file={noteImportFile}
            preview={noteImportPreview}
            busy={noteImportBusy}
            error={noteImportError}
            onClose={closeNoteImport}
            onImport={(strategy) => importNote(noteImportFile, strategy)}
          />
        </div>

        <div className="section-heading"><span>WORKSPACE</span></div>
        <nav className="workspace-nav" aria-label="Note views">
          <button type="button" className={`workspace-nav-item${viewType === 'dashboard' ? ' workspace-nav-active' : ''}`} onClick={() => selectView('dashboard')}>
            <BarChart3 size={16} /><span>Dashboard</span>
          </button>
          <button type="button" className={`workspace-nav-item${viewType === 'folders' ? ' workspace-nav-active' : ''}`} onClick={() => selectView('folders')}>
            <Folders size={16} /><span>Folders</span><small>{folders.length}</small>
          </button>
          <button type="button" className={`workspace-nav-item${viewType === 'all' ? ' workspace-nav-active' : ''}`} onClick={() => selectView('all')}>
            <FileText size={16} /><span>All notes</span><small>{notes.length}</small>
          </button>
          <button type="button" className={`workspace-nav-item${viewType === 'favorites' ? ' workspace-nav-active' : ''}`} onClick={() => selectView('favorites')}>
            <Star size={16} /><span>Favorites</span>
          </button>
          <button type="button" className={`workspace-nav-item${viewType === 'recent' ? ' workspace-nav-active' : ''}`} onClick={() => selectView('recent')}>
            <Clock3 size={16} /><span>Recent</span>
          </button>
          <button type="button" className={`workspace-nav-item${viewType === 'archived' ? ' workspace-nav-active' : ''}`} onClick={() => selectView('archived')}>
            <Archive size={16} /><span>Archived</span>
          </button>
          <button type="button" className={`workspace-nav-item${viewType === 'unfiled' ? ' workspace-nav-active' : ''}`} onClick={() => selectView('unfiled')}>
            <Folder size={16} /><span>Unfiled notes</span>
          </button>
        </nav>

        <div className="section-heading notes-heading">
          <span>{viewTitle.toUpperCase()}</span>
          <span className="note-count">{filteredNotes.length}</span>
        </div>
        <div className="notes-list" aria-label="Your notes">
          {loading && <div className="list-message"><LoaderCircle className="spin" size={16} /> Loading notes…</div>}
          {!loading && loadError && (
            <div className="list-error">
              <span>{loadError}</span>
              <button type="button" onClick={() => window.location.reload()}>Retry</button>
            </div>
          )}
          {!loading && !loadError && filteredNotes.map((note) => {
            const preview = getPlainText(note.content).trim();
            return (
              <button
                type="button"
                key={note.id}
                className={`note-row${activeId === note.id ? ' note-row-active' : ''}`}
                disabled={uploading}
                onClick={() => selectNote(note.id)}
              >
                <span className="note-row-icon"><FileText size={16} /></span>
                <span className="note-row-copy">
                  <span className="note-row-title">{note.title || 'Untitled note'}</span>
                  <span className="note-row-preview">{preview || 'A blank page, ready for an idea'}</span>
                </span>
                {note.pinned && <Pin className="note-row-pin" size={12} />}
                <span className="note-row-date">{formatDate(note.updatedAt || note.createdAt)}</span>
              </button>
            );
          })}
          {!loading && !loadError && filteredNotes.length === 0 && (
            <div className="empty-search">
              <Search size={18} />
              <span>{search ? 'No notes match your search.' : 'No notes in this view yet.'}</span>
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="avatar">S</div>
          <div className="profile-copy">
            <strong>Personal space</strong>
            <span>Private to you</span>
          </div>
          <div className="profile-menu-wrap" {...profileMenu.menuProps}>
            <button
              type="button"
              ref={profileMenuAnchorRef}
              className="icon-button profile-menu-trigger"
              aria-label="Open profile menu"
              aria-expanded={profileMenu.open}
              onClick={profileMenu.toggle}
            >
              <MoreHorizontal size={18} />
            </button>
            <PortalMenu
              anchorRef={profileMenuAnchorRef}
              align="end"
              className="profile-menu"
              label="Profile actions"
              menuProps={profileMenu.portalProps}
              open={profileMenu.open}
              role="menu"
              side="top"
            >
              <button type="button" role="menuitem" onClick={confirmSignOut}>
                <LogOut size={15} /> Sign out
              </button>
            </PortalMenu>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open notes menu" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <button type="button" className="breadcrumb-link" onClick={() => selectView('all')}>My Workspace</button>
              {(current && viewType !== 'dashboard' && viewType !== 'folders'
                ? currentFolderPath
                : viewType === 'folder' ? viewFolderPath : []).map((folder) => (
                <React.Fragment key={folder.id}>
                  <span className="breadcrumb-separator">/</span>
                  <button type="button" className="breadcrumb-link" title={folder.name} onClick={() => selectView('folder', folder.id)}>{folder.name}</button>
                </React.Fragment>
              ))}
              <span className="breadcrumb-separator">/</span>
              <strong className="breadcrumb-current">{current && viewType !== 'dashboard' && viewType !== 'folders' ? current.title || 'Untitled note' : viewTitle}</strong>
            </nav>
          </div>
          <div className={`sync-status sync-${saveState}`} aria-live="polite">
            {saveState === 'saving' ? <LoaderCircle className="spin" size={15} /> : saveState === 'saved' ? <Check size={15} /> : <Cloud size={15} />}
            <span>{saveLabel}</span>
          </div>
        </header>

        <div className={`editor-stage${current ? ' editor-stage-note' : ''}`}>
          {viewType === 'dashboard' ? (
            <Dashboard
              onOpenFolder={(id) => selectView('folder', id)}
              onOpenNote={openDashboardNote}
            />
          ) : viewType === 'folders' ? (
            <FolderDashboard
              folders={folders}
              onOpenFolder={(id) => selectView('folder', id)}
              onCreateFolder={createFolderRequest}
              onRenameFolder={renameFolder}
              onMoveFolder={moveFolder}
              onDeleteFolder={deleteFolder}
              onExportFolder={exportFolder}
              onImported={finishFolderImport}
            />
          ) : current ? (
            <article className="note-document">
              <div className="document-kicker">
                <div className="document-type"><FileText size={15} /><span>{NOTE_TEMPLATES.find((item) => item.id === current.noteType)?.name || 'NOTE'}</span></div>
                <span className="document-dot">·</span>
                <span className="document-date"><Clock3 size={14} /> Edited {formatDate(current.updatedAt || current.createdAt)}</span>
                <span className="document-move">
                  <Folder size={14} />
                  <select
                    aria-label="Move note to folder"
                    value={current.folderId || ''}
                    disabled={uploading}
                    onChange={(event) => moveCurrentNote(event.target.value)}
                  >
                    <option value="">Unfiled</option>
                    {folderOptions.map((folder) => <option key={folder.id} value={folder.id}>{`${'　'.repeat(folder.depth)}${folder.name}`}</option>)}
                  </select>
                </span>
                <div className="document-actions">
                  <button
                    type="button"
                    className={`icon-button favorite-button${current.favorite ? ' is-favorite' : ''}`}
                    title={current.favorite ? 'Remove from favorites' : 'Add to favorites'}
                    aria-label={current.favorite ? 'Remove from favorites' : 'Add to favorites'}
                    aria-pressed={Boolean(current.favorite)}
                    onClick={toggleFavorite}
                  >
                    <Star size={17} fill={current.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    className={`icon-button pin-button${current.pinned ? ' is-pinned' : ''}`}
                    title={current.pinned ? 'Unpin note' : 'Pin note'}
                    aria-label={current.pinned ? 'Unpin note' : 'Pin note'}
                    aria-pressed={Boolean(current.pinned)}
                    onClick={togglePinned}
                  >
                    <Pin size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button archive-button"
                    title={viewType === 'archived' ? 'Restore note' : 'Archive note'}
                    aria-label={viewType === 'archived' ? 'Restore note' : 'Archive note'}
                    onClick={toggleArchived}
                  >
                    <Archive size={16} />
                  </button>
                  <button
                    type="button"
                    className="save-button"
                    disabled={saveState === 'saving' || saveState === 'saved'}
                    onClick={() => saveNote(current)}
                  >
                    {saveState === 'saving' ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}
                    <span>Save</span>
                  </button>
                  <div className="more-menu-wrap" {...noteActionsMenu.menuProps}>
                    <button
                      type="button"
                      ref={noteActionsAnchorRef}
                      className="icon-button more-button"
                      aria-label="More note actions"
                      aria-expanded={noteActionsMenu.open}
                      onClick={noteActionsMenu.toggle}
                    >
                      <MoreHorizontal size={19} />
                    </button>
                    <PortalMenu
                      anchorRef={noteActionsAnchorRef}
                      align="end"
                      className="more-menu"
                      label="More note actions"
                      menuProps={noteActionsMenu.portalProps}
                      open={noteActionsMenu.open}
                      role="menu"
                    >
                        <button type="button" disabled={uploading} onClick={() => {
                          noteActionsMenu.close();
                          void exportNote(current);
                        }}>
                          <Download size={15} /> Export note with attachments
                        </button>
                        <button type="button" disabled={uploading} onClick={() => {
                          noteActionsMenu.close();
                          void exportWord(current);
                        }}>
                          <FileText size={15} /> Export as Word (.docx)
                        </button>
                        <button type="button" disabled={uploading} onClick={() => {
                          noteActionsMenu.close();
                          window.print();
                        }}>
                          <Printer size={15} /> Print / save as PDF
                        </button>
                        <button type="button" disabled={uploading} onClick={() => {
                          noteActionsMenu.close();
                          documentInputRef.current?.click();
                        }}>
                          <Upload size={15} /> Import PDF or Word document
                        </button>
                        <button type="button" disabled={uploading} onClick={() => {
                          noteActionsMenu.close();
                          noteArchiveInputRef.current?.click();
                        }}>
                          <Upload size={15} /> Import note backup
                        </button>
                        <button type="button" className="danger-action" disabled={uploading} onClick={deleteCurrentNote}>
                          <Trash2 size={15} /> Delete note permanently
                        </button>
                    </PortalMenu>
                  </div>
                </div>
              </div>

              <input
                className="title-input"
                aria-label="Note title"
                placeholder="Untitled note"
                value={current.title || ''}
                onChange={(event) => updateTitle(event.target.value)}
                maxLength={200}
              />
              <div className="title-hint">A good title makes ideas easier to find later.</div>

              <section className="writing-surface" aria-label="Rich text editor">
                <EditorToolbar
                  editor={editor}
                  fileInputRef={fileInputRef}
                  imageInputRef={imageInputRef}
                  uploading={uploading}
                  focusMode={focusMode}
                  onToggleFocus={() => setFocusMode((value) => !value)}
                  wordCount={wordCount}
                  characterCount={characterCount}
                  zoom={editorZoom}
                  onZoomChange={setEditorZoom}
                />
                {editor?.isActive('table') && (
                  <div className="table-actions" aria-label="Table editing">
                    <span>Table</span>
                    <button type="button" onClick={() => editor.chain().focus().addRowBefore().run()}>+ Row above</button>
                    <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>+ Row</button>
                    <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()}>+ Column before</button>
                    <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Column</button>
                    <button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>− Row</button>
                    <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>− Column</button>
                    <button type="button" className="table-delete" onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  className="visually-hidden"
                  type="file"
                  aria-label="Choose a file to attach"
                  onChange={(event) => {
                    uploadFile(event.target.files?.[0], 'file');
                    event.target.value = '';
                  }}
                />
                <input
                  ref={imageInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="image/*"
                  aria-label="Choose an image"
                  onChange={(event) => {
                    uploadFile(event.target.files?.[0], 'image');
                    event.target.value = '';
                  }}
                />

                <div className="editor-page" style={{ zoom: `${editorZoom}%`, width: '100%' }}>
                  <EditorContent editor={editor} />
                </div>
                <div className="editor-bottom">
                  <span><AlignLeft size={14} /> {wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                  <span>{characterCount} {characterCount === 1 ? 'character' : 'characters'}</span>
                  <span>Changes save automatically</span>
                </div>
              </section>
            </article>
          ) : (
            <section className="welcome-state">
              <div className="welcome-art">
                <div className="welcome-art-card card-back" />
                <div className="welcome-art-card card-front">
                  <span /><span /><span />
                  <i><Sparkles size={20} /></i>
                </div>
                <div className="welcome-spark spark-one">✦</div>
                <div className="welcome-spark spark-two">✧</div>
              </div>
              <span className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</span>
              <h1>Make room for<br /><em>your next thought.</em></h1>
              <p>Capture the things worth remembering. Shape them into something brilliant.</p>
              <button type="button" className="new-note-button welcome-create" onClick={openCreateDialog}>
                <Plus size={17} /> Create your first note
              </button>
            </section>
          )}
        </div>
      </main>

      {notice && (
        <div className={`toast toast-${notice.tone}`} role="status">
          {notice.tone === 'success' ? <Check size={16} /> : <Cloud size={16} />}
          <span>{notice.message}</span>
          <button type="button" className="toast-dismiss" aria-label="Dismiss notification" onClick={() => setNotice(null)}>
            <X size={15} />
          </button>
        </div>
      )}
      {showCreateDialog && (
        <CreateNoteDialog
          folders={folders}
          defaultFolderId={viewType === 'folder' ? viewFolderId : ''}
          onClose={() => setShowCreateDialog(false)}
          onCreate={createNote}
          onCreateFolder={createFolderRequest}
        />
      )}
    </div>
  );
}

export default function App() {
  return <AuthGate>{({ signOut }) => <NotesphereApp onSignOut={signOut} />}</AuthGate>;
}
