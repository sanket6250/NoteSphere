import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowRight,
  Bold,
  Braces,
  Code2,
  Eye,
  Eraser,
  Highlighter,
  Home,
  ImagePlus,
  Italic,
  LayoutGrid,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  PaintBucket,
  Paintbrush,
  Paperclip,
  Plus,
  Quote,
  Redo2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sigma,
  Smile,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  Undo2,
  X,
} from 'lucide-react';
import { BubbleMenu } from '@tiptap/react';
import { createPortal } from 'react-dom';
import { PortalMenu, useDialogs, useManagedMenu } from './OverlaySystem';
import { applyFormatSnapshot, captureFormatSnapshot } from './formatPainter';
import { changeSelectionCase } from './textCase';
import EditorContextMenu from './EditorContextMenu';
import FindReplaceDialog from './FindReplaceDialog';

const TEXT_COLORS = [
  '#24233a', '#5f5e70', '#a23b3b', '#d44d4d', '#d97706',
  '#21845b', '#147d91', '#3567c8', '#6852c6', '#bd4788',
];

const HIGHLIGHT_COLORS = [
  '#fff0a8', '#ffe0dc', '#ffd6e7', '#eadfff', '#d9e8ff',
  '#d5f3e5', '#d7f3f5', '#f4e3ca', '#e7e8eb',
];

const TEXT_BACKGROUND_COLORS = [
  '#fff7cc', '#ffe8e3', '#fce4ec', '#f0e9ff', '#e5efff',
  '#e2f5eb', '#e1f4f5', '#f8ead8', '#f0f0f2',
];

const BULLET_MARKER_STYLES = [
  { value: 'disc', label: 'Disc bullets' },
  { value: 'circle', label: 'Circle bullets' },
  { value: 'square', label: 'Square bullets' },
];

const ORDERED_MARKER_STYLES = [
  { value: 'decimal', label: '1, 2, 3' },
  { value: 'decimal-leading-zero', label: '01, 02, 03' },
  { value: 'lower-alpha', label: 'a, b, c' },
  { value: 'upper-alpha', label: 'A, B, C' },
  { value: 'lower-roman', label: 'i, ii, iii' },
  { value: 'upper-roman', label: 'I, II, III' },
];

const SPECIAL_CHARACTERS = [
  { character: '©', label: 'copyright' },
  { character: '®', label: 'registered' },
  { character: '™', label: 'trademark' },
  { character: '§', label: 'section' },
  { character: '¶', label: 'paragraph' },
  { character: '†', label: 'dagger' },
  { character: '‡', label: 'double dagger' },
  { character: '•', label: 'bullet' },
  { character: '…', label: 'ellipsis' },
  { character: '→', label: 'right arrow' },
  { character: '←', label: 'left arrow' },
  { character: '↑', label: 'up arrow' },
  { character: '↓', label: 'down arrow' },
  { character: '↔', label: 'left right arrow' },
  { character: '±', label: 'plus minus' },
  { character: '×', label: 'multiplication' },
  { character: '÷', label: 'division' },
  { character: '∞', label: 'infinity' },
  { character: '≠', label: 'not equal' },
  { character: '≤', label: 'less than or equal' },
  { character: '≥', label: 'greater than or equal' },
  { character: '√', label: 'square root' },
  { character: 'π', label: 'pi' },
  { character: 'α', label: 'alpha' },
  { character: 'β', label: 'beta' },
  { character: 'γ', label: 'gamma' },
  { character: 'Δ', label: 'delta' },
  { character: '€', label: 'euro' },
  { character: '£', label: 'pound' },
  { character: '¥', label: 'yen' },
  { character: '₹', label: 'rupee' },
  { character: '●', label: 'black circle' },
  { character: '○', label: 'white circle' },
  { character: '■', label: 'black square' },
  { character: '□', label: 'white square' },
  { character: '◆', label: 'black diamond' },
  { character: '◇', label: 'white diamond' },
  { character: '▲', label: 'black triangle' },
  { character: '△', label: 'white triangle' },
  { character: '★', label: 'black star' },
  { character: '☆', label: 'white star' },
];

const EMOJIS = [
  { emoji: '😀', label: 'grinning face' },
  { emoji: '😂', label: 'face with tears of joy' },
  { emoji: '😊', label: 'smiling face' },
  { emoji: '😍', label: 'heart eyes' },
  { emoji: '🤔', label: 'thinking face' },
  { emoji: '🙏', label: 'folded hands' },
  { emoji: '👍', label: 'thumbs up' },
  { emoji: '👎', label: 'thumbs down' },
  { emoji: '❤️', label: 'red heart' },
  { emoji: '✅', label: 'check mark' },
  { emoji: '⚠️', label: 'warning' },
  { emoji: '📌', label: 'pushpin' },
  { emoji: '📝', label: 'memo' },
  { emoji: '💡', label: 'light bulb' },
  { emoji: '🚀', label: 'rocket' },
  { emoji: '🎉', label: 'party popper' },
  { emoji: '🔥', label: 'fire' },
  { emoji: '✨', label: 'sparkles' },
  { emoji: '📅', label: 'calendar' },
  { emoji: '📎', label: 'paperclip' },
];

function ToolbarButton({
  label,
  shortcut,
  active = false,
  disabled = false,
  className = '',
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      className={`toolbar-button${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => {
        if (event.button === 0) event.preventDefault();
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MenuButton({ label, onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      className="toolbar-menu-action"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(event) => {
        if (event.button === 0) event.preventDefault();
      }}
      onClick={onClick}
    >
      {children}<span>{label}</span>
    </button>
  );
}

function ColorPicker({
  label,
  color,
  value,
  colors,
  onChange,
  onClear,
  clearLabel,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const fallbackColor = colors[0];
  const inputValue = /^#[\da-f]{6}$/i.test(value || '') ? value : fallbackColor;

  useEffect(() => {
    if (!open) return undefined;

    function dismissOutside(event) {
      if (
        !rootRef.current?.contains(event.target)
        && !popoverRef.current?.contains(event.target)
      ) setOpen(false);
    }

    function dismissOnEscape(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }

    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    function updatePosition() {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const popover = popoverRef.current?.getBoundingClientRect();
      if (!anchor || !popover) return;
      const left = Math.max(8, Math.min(anchor.left, window.innerWidth - popover.width - 8));
      const opensUp = window.innerHeight - anchor.bottom < popover.height + 8
        && anchor.top > window.innerHeight - anchor.bottom;
      const top = opensUp
        ? Math.max(8, anchor.top - popover.height - 6)
        : Math.min(window.innerHeight - popover.height - 8, anchor.bottom + 6);
      setPosition({ left, top });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`toolbar-color-picker toolbar-color-picker-${color}${open ? ' is-open' : ''}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        ref={triggerRef}
        className="toolbar-color-trigger"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="true"
        disabled={disabled}
        onMouseDown={(event) => {
          if (event.button === 0) event.preventDefault();
        }}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        {color === 'text' ? (
          <span className="toolbar-text-color-mark" style={{ borderColor: value || '#49485b' }}>A</span>
        ) : color === 'marker' ? <List size={15} />
          : color === 'background' ? <PaintBucket size={15} />
            : <Highlighter size={15} />}
        <span>{label}</span>
        <span className="toolbar-color-current" style={{ backgroundColor: value || fallbackColor }} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className="toolbar-color-popover"
          role="group"
          aria-label={`${label} palette`}
          style={{ left: position.left, top: position.top }}
        >
          <div className="toolbar-color-swatches">
            {colors.map((swatch) => (
              <button
                type="button"
                key={swatch}
                className={`toolbar-color-swatch${value?.toLowerCase() === swatch ? ' is-selected' : ''}`}
                style={{ '--swatch-color': swatch }}
                aria-label={`${label} ${swatch}`}
                aria-pressed={value?.toLowerCase() === swatch}
                title={swatch}
                onMouseDown={(event) => {
                  if (event.button === 0) event.preventDefault();
                }}
                onClick={() => {
                  onChange(swatch);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          <label className="toolbar-custom-color">
            <span>Custom color</span>
            <input
              type="color"
              aria-label={`Custom ${label.toLowerCase()}`}
              value={inputValue}
              disabled={disabled}
              onChange={(event) => {
                onChange(event.target.value);
                setOpen(false);
              }}
            />
          </label>
          <button
            type="button"
            className="toolbar-clear-color"
            disabled={disabled}
            onClick={() => {
              onClear();
              setOpen(false);
            }}
          >
            Remove {clearLabel || (color === 'text' ? 'text color' : 'highlight')}
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default function EditorToolbar({
  editor,
  fileInputRef,
  imageInputRef,
  uploading,
  focusMode,
  onToggleFocus,
  wordCount,
  characterCount,
  zoom,
  onZoomChange,
}) {
  const dialogs = useDialogs();
  const formattingMenu = useManagedMenu();
  const insertMenu = useManagedMenu();
  const [, setEditorRevision] = useState(0);
  const formattingRootRef = useRef(null);
  const insertRootRef = useRef(null);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [symbolQuery, setSymbolQuery] = useState('');
  const [emojiQuery, setEmojiQuery] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [formatPainter, setFormatPainter] = useState(null);
  const [repeatFormatPainter, setRepeatFormatPainter] = useState(false);
  const [tableSize, setTableSize] = useState({ rows: 0, cols: 0 });
  const formatPainterRef = useRef(null);
  const formatPainterApplyingRef = useRef(false);

  useEffect(() => {
    if (!editor) return undefined;
    const refreshToolbar = () => setEditorRevision((revision) => revision + 1);
    editor.on('transaction', refreshToolbar);
    return () => editor.off('transaction', refreshToolbar);
  }, [editor]);

  useEffect(() => {
    if (!editor) return undefined;

    function applyFormatPainter() {
      const painter = formatPainterRef.current;
      const { doc, selection } = editor.state;
      if (!painter || selection.empty || formatPainterApplyingRef.current) return;
      if (selection.from === painter.from && selection.to === painter.to) return;
      if (doc !== painter.doc) {
        formatPainterRef.current = null;
        setFormatPainter(null);
        return;
      }

      formatPainterApplyingRef.current = true;
      if (!repeatFormatPainter) {
        formatPainterRef.current = null;
        setFormatPainter(null);
      }

      try {
        const applied = applyFormatSnapshot(editor, painter, selection);
        if (repeatFormatPainter && applied) {
          formatPainterRef.current = { ...painter, doc: editor.state.doc };
        }
      } finally {
        formatPainterApplyingRef.current = false;
      }
    }

    let frame = null;
    function scheduleFormatPainter(event) {
      if (event.target.closest?.('.toolbar-format-painter')) return;
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        applyFormatPainter();
      });
    }

    function handleEditorKeyUp(event) {
      if (editor.view.dom.contains(event.target)) scheduleFormatPainter(event);
    }

    document.addEventListener('pointerup', scheduleFormatPainter, true);
    document.addEventListener('mouseup', scheduleFormatPainter, true);
    document.addEventListener('keyup', handleEditorKeyUp, true);
    return () => {
      document.removeEventListener('pointerup', scheduleFormatPainter, true);
      document.removeEventListener('mouseup', scheduleFormatPainter, true);
      document.removeEventListener('keyup', handleEditorKeyUp, true);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [editor, repeatFormatPainter]);

  useEffect(() => {
    if (!formatPainter) return undefined;
    function cancelFormatPainter(event) {
      if (event.key === 'Escape') {
        formatPainterRef.current = null;
        setFormatPainter(null);
      }
    }
    document.addEventListener('keydown', cancelFormatPainter, true);
    return () => document.removeEventListener('keydown', cancelFormatPainter, true);
  }, [formatPainter]);

  useEffect(() => {
    if (!editor) return undefined;
    function openFindReplace(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        event.stopPropagation();
        setFindReplaceOpen(true);
      }
    }

    editor.view.dom.addEventListener('keydown', openFindReplace);
    return () => editor.view.dom.removeEventListener('keydown', openFindReplace);
  }, [editor]);

  if (!editor) return null;

  const command = (action) => () => action().run();
  const listItemType = editor.isActive('taskList') ? 'taskItem' : 'listItem';
  const listIsActive = editor.isActive('bulletList')
    || editor.isActive('orderedList')
    || editor.isActive('taskList');
  const styledListType = editor.isActive('orderedList') ? 'orderedList' : 'bulletList';
  const canStyleList = editor.isActive('bulletList') || editor.isActive('orderedList');
  const listMarkerStyles = styledListType === 'orderedList'
    ? ORDERED_MARKER_STYLES
    : BULLET_MARKER_STYLES;
  const listAttributes = canStyleList ? editor.getAttributes(styledListType) : {};
  const listStyleType = listAttributes.listStyleType
    || (styledListType === 'orderedList' ? 'decimal' : 'disc');

  function setBlockAttribute(attribute, value) {
    const blockType = editor.isActive('heading') ? 'heading' : 'paragraph';
    editor.chain().focus().updateAttributes(blockType, { [attribute]: value || null }).run();
  }

  function clearFormatting() {
    editor.chain().focus()
      .unsetAllMarks()
      .clearNodes()
      .updateAttributes('paragraph', {
        textAlign: null,
        lineHeight: null,
        paragraphSpacing: null,
      })
      .run();
  }

  function toggleSubscript() {
    const chain = editor.chain().focus();
    if (!editor.isActive('subscript')) chain.unsetMark('superscript');
    chain.toggleSubscript().run();
  }

  function toggleSuperscript() {
    const chain = editor.chain().focus();
    if (!editor.isActive('superscript')) chain.unsetMark('subscript');
    chain.toggleSuperscript().run();
  }

  async function addLink() {
    const existingHref = editor.getAttributes('link').href || '';
    const url = await dialogs.prompt({
      title: existingHref ? 'Edit link' : 'Insert a link',
      message: 'Enter the web address for the selected text.',
      label: 'LINK URL',
      value: existingHref,
      confirmLabel: existingHref ? 'Update link' : 'Insert link',
      maxLength: 2048,
      validate: (value) => {
        if (!value.trim()) return 'Enter a link URL.';
        try {
          const parsed = new URL(value.trim(), window.location.origin);
          if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return 'Use an http, https, or mailto link.';
        } catch {
          return 'Enter a valid link URL.';
        }
        return '';
      },
    });
    if (url?.trim()) editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }

  function insertSpecialCharacter(character) {
    editor.chain().focus().insertContent(character).run();
    insertMenu.close();
  }

  function startFormatPainter() {
    if (formatPainterRef.current) {
      formatPainterRef.current = null;
      setFormatPainter(null);
      return;
    }

    const { selection } = editor.state;
    if (selection.empty) return;
    const painter = captureFormatSnapshot(editor.state, selection);
    formatPainterRef.current = painter;
    setFormatPainter(painter);
  }

  function changeFontSize(delta) {
    const currentSize = Number.parseInt(editor.getAttributes('textStyle').fontSize || '14px', 10);
    const nextSize = Math.max(8, Math.min(96, currentSize + delta));
    editor.chain().focus().setMark('textStyle', { fontSize: `${nextSize}px` }).run();
  }

  const filteredSymbols = SPECIAL_CHARACTERS.filter((item) => (
    `${item.label} ${item.character}`.toLowerCase().includes(symbolQuery.trim().toLowerCase())
  ));
  const filteredEmojis = EMOJIS.filter((item) => (
    `${item.label} ${item.emoji}`.toLowerCase().includes(emojiQuery.trim().toLowerCase())
  ));

  const activeBlock = editor.isActive('heading') ? 'heading' : 'paragraph';
  const blockAttributes = editor.getAttributes(activeBlock);
  const textStyle = editor.getAttributes('textStyle');
  const highlightStyle = editor.getAttributes('highlight');

  return (
    <>
    <div className={`editor-toolbar editor-toolbar-tab-${activeTab}`} role="toolbar" aria-label="Text formatting">
      <div className="editor-ribbon-tabs" role="tablist" aria-label="Editor tools">
        {[
          ['home', 'Home', Home],
          ['insert', 'Insert', ImagePlus],
          ['layout', 'Layout', LayoutGrid],
          ['review', 'Review', ShieldCheck],
          ['view', 'View', Eye],
        ].map(([tab, label, TabIcon]) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'is-active' : ''}
            key={tab}
            onMouseDown={(event) => {
              if (event.button === 0) event.preventDefault();
            }}
            onClick={() => {
              formattingMenu.close();
              insertMenu.close();
              setActiveTab(tab);
              setMobilePanelOpen(false);
            }}
          >
            <TabIcon size={15} strokeWidth={2.2} />
            {label}
          </button>
        ))}
      </div>
      <div className="mobile-format-toolbar" aria-label="Compact formatting toolbar">
        <ToolbarButton
          label="Bold"
          shortcut="Ctrl/Cmd+B"
          active={editor.isActive('bold')}
          onClick={command(() => editor.chain().focus().toggleBold())}
        >
          <Bold size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          shortcut="Ctrl/Cmd+I"
          active={editor.isActive('italic')}
          onClick={command(() => editor.chain().focus().toggleItalic())}
        >
          <Italic size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          shortcut="Ctrl/Cmd+U"
          active={editor.isActive('underline')}
          onClick={command(() => editor.chain().focus().toggleUnderline())}
        >
          <Underline size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={command(() => editor.chain().focus().toggleBulletList())}
        >
          <List size={18} />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={command(() => editor.chain().focus().toggleOrderedList())}
        >
          <ListOrdered size={18} />
        </ToolbarButton>
        <ToolbarButton label="Undo" disabled={!editor.can().undo()} onClick={command(() => editor.chain().focus().undo())}>
          <Undo2 size={17} />
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={!editor.can().redo()} onClick={command(() => editor.chain().focus().redo())}>
          <Redo2 size={17} />
        </ToolbarButton>
        <button
          type="button"
          className={`mobile-format-toggle${mobilePanelOpen ? ' is-active' : ''}`}
          aria-label={mobilePanelOpen ? 'Close formatting panel' : 'Open formatting panel'}
          aria-expanded={mobilePanelOpen}
          onClick={() => setMobilePanelOpen((open) => !open)}
        >
          {mobilePanelOpen ? <X size={18} /> : <SlidersHorizontal size={18} />}
        </button>
      </div>
      {mobilePanelOpen && (
        <div className="mobile-format-panel" role="dialog" aria-label="Formatting tools">
          <div className="mobile-format-panel-header">
            <div>
              <span>Formatting</span>
              <strong>{activeTab[0].toUpperCase() + activeTab.slice(1)}</strong>
            </div>
            <button type="button" aria-label="Close formatting panel" onClick={() => setMobilePanelOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="mobile-format-grid">
            <label className="mobile-format-color" title="Text color">
              <span>Text color</span>
              <input
                type="color"
                aria-label="Text color"
                value={/^#[\da-f]{6}$/i.test(textStyle.color || '') ? textStyle.color : '#24233a'}
                onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
              />
            </label>
            <label className="mobile-format-color" title="Highlight color">
              <span>Highlight</span>
              <input
                type="color"
                aria-label="Highlight color"
                value={/^#[\da-f]{6}$/i.test(highlightStyle.color || '') ? highlightStyle.color : '#fff0a8'}
                onChange={(event) => editor.chain().focus().setHighlight({ color: event.target.value }).run()}
              />
            </label>
            <ToolbarButton label="Strikethrough" active={editor.isActive('strike')} onClick={command(() => editor.chain().focus().toggleStrike())}><Strikethrough size={18} /></ToolbarButton>
            <ToolbarButton label="Superscript" active={editor.isActive('superscript')} onClick={toggleSuperscript}><Superscript size={18} /></ToolbarButton>
            <ToolbarButton label="Subscript" active={editor.isActive('subscript')} onClick={toggleSubscript}><Subscript size={18} /></ToolbarButton>
            <ToolbarButton label="Format painter" className="toolbar-format-painter" active={Boolean(formatPainter)} disabled={!formatPainter && editor.state.selection.empty} onClick={startFormatPainter}><Paintbrush size={18} /></ToolbarButton>
            <ToolbarButton label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={command(() => editor.chain().focus().setTextAlign('left'))}><AlignLeft size={18} /></ToolbarButton>
            <ToolbarButton label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={command(() => editor.chain().focus().setTextAlign('center'))}><AlignCenter size={18} /></ToolbarButton>
            <ToolbarButton label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={command(() => editor.chain().focus().setTextAlign('right'))}><AlignRight size={18} /></ToolbarButton>
            <ToolbarButton label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={command(() => editor.chain().focus().setTextAlign('justify'))}><AlignJustify size={18} /></ToolbarButton>
            <ToolbarButton label="Insert link" active={editor.isActive('link')} onClick={() => { void addLink(); }}><LinkIcon size={18} /></ToolbarButton>
            <ToolbarButton label="Find and replace" onClick={() => setFindReplaceOpen(true)}><Search size={18} /></ToolbarButton>
            <ToolbarButton label="Clear formatting" onClick={clearFormatting}><Eraser size={18} /></ToolbarButton>
            <ToolbarButton label="Horizontal line" onClick={command(() => editor.chain().focus().setHorizontalRule())}><Minus size={18} /></ToolbarButton>
          </div>
        </div>
      )}
      <div className="toolbar-row toolbar-row-primary">
        <div className="toolbar-group toolbar-group-font toolbar-block-style" role="group" aria-label="Text style">
          <select
            aria-label="Text style"
            title="Text style"
            className="block-style-select"
            value={
              editor.isActive('heading', { level: 1 }) ? 'h1'
                : editor.isActive('heading', { level: 2 }) ? 'h2'
                  : editor.isActive('heading', { level: 3 }) ? 'h3'
                    : editor.isActive('heading', { level: 4 }) ? 'h4'
                      : 'paragraph'
            }
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'paragraph') editor.chain().focus().setParagraph().run();
              else editor.chain().focus().toggleHeading({ level: Number(value.slice(1)) }).run();
            }}
          >
            <option value="paragraph">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
          </select>
        </div>
        <span className="toolbar-divider" />
        <div className="toolbar-group toolbar-group-font toolbar-font-selects" role="group" aria-label="Font family and size">
          <label className="toolbar-select-label">
            <span>Font</span>
            <select
              aria-label="Font family"
              title="Font family"
              value={textStyle.fontFamily || ''}
              onChange={(event) => {
                if (event.target.value) editor.chain().focus().setFontFamily(event.target.value).run();
                else editor.chain().focus().unsetFontFamily().run();
              }}
            >
              <option value="">Default</option>
              <option value="DM Sans">Sans</option>
              <option value="Georgia">Serif</option>
              <option value="ui-monospace">Mono</option>
              <option value="Arial">Arial</option>
              <option value="Verdana">Verdana</option>
            </select>
          </label>
          <label className="toolbar-select-label toolbar-font-size-select">
            <span>Size</span>
            <select
              aria-label="Font size"
              title="Font size"
              value={textStyle.fontSize || ''}
              onChange={(event) => editor.chain().focus().setMark('textStyle', { fontSize: event.target.value || null }).run()}
            >
              <option value="">Default</option>
              <option value="12px">12</option>
              <option value="14px">14</option>
              <option value="16px">16</option>
              <option value="18px">18</option>
              <option value="24px">24</option>
              <option value="32px">32</option>
            </select>
          </label>
        </div>
        <div className="toolbar-group toolbar-group-font" role="group" aria-label="Text formatting">
          <ToolbarButton label="Bold" shortcut="Ctrl/Cmd+B" active={editor.isActive('bold')} onClick={command(() => editor.chain().focus().toggleBold())}><Bold size={16} /></ToolbarButton>
          <ToolbarButton label="Italic" shortcut="Ctrl/Cmd+I" active={editor.isActive('italic')} onClick={command(() => editor.chain().focus().toggleItalic())}><Italic size={16} /></ToolbarButton>
          <ToolbarButton label="Underline" shortcut="Ctrl/Cmd+U" active={editor.isActive('underline')} onClick={command(() => editor.chain().focus().toggleUnderline())}><Underline size={16} /></ToolbarButton>
          <ToolbarButton label="Strikethrough" shortcut="Ctrl/Cmd+Shift+X" active={editor.isActive('strike')} onClick={command(() => editor.chain().focus().toggleStrike())}><Strikethrough size={16} /></ToolbarButton>
          <ToolbarButton label="Subscript" active={editor.isActive('subscript')} onClick={toggleSubscript}><Subscript size={15} /></ToolbarButton>
          <ToolbarButton label="Superscript" active={editor.isActive('superscript')} onClick={toggleSuperscript}><Superscript size={15} /></ToolbarButton>
        </div>
        <span className="toolbar-divider" />
        <div className="toolbar-group toolbar-group-font" role="group" aria-label="Font size and format painter">
          <ToolbarButton label="Decrease font size" onClick={() => changeFontSize(-1)}><Minus size={15} /></ToolbarButton>
          <ToolbarButton label="Increase font size" onClick={() => changeFontSize(1)}><Plus size={15} /></ToolbarButton>
          <ToolbarButton
            label="Format painter"
            className="toolbar-format-painter"
            active={Boolean(formatPainter)}
            disabled={!formatPainter && editor.state.selection.empty}
            onClick={startFormatPainter}
          >
            <Paintbrush size={15} />
          </ToolbarButton>
          <label className="format-painter-repeat" title="Keep the format painter active after each application">
            <input type="checkbox" checked={repeatFormatPainter} onChange={(event) => setRepeatFormatPainter(event.target.checked)} />
            <span>Repeat</span>
          </label>
        </div>
        <div className="toolbar-group toolbar-group-font toolbar-font-colors" role="group" aria-label="Text colors">
          <ColorPicker
            label="Text color"
            color="text"
            value={textStyle.color}
            colors={TEXT_COLORS}
            onChange={(value) => editor.chain().focus().setColor(value).run()}
            onClear={() => editor.chain().focus().unsetColor().run()}
          />
          <ColorPicker
            label="Highlight color"
            color="highlight"
            value={highlightStyle.color}
            colors={HIGHLIGHT_COLORS}
            onChange={(value) => editor.chain().focus().setHighlight({ color: value }).run()}
            onClear={() => editor.chain().focus().unsetHighlight().run()}
          />
          <ColorPicker
            label="Text background"
            color="background"
            value={textStyle.backgroundColor}
            colors={TEXT_BACKGROUND_COLORS}
            clearLabel="text background"
            onChange={(value) => editor.chain().focus().setMark('textStyle', { backgroundColor: value }).run()}
            onClear={() => editor.chain().focus().setMark('textStyle', { backgroundColor: null }).run()}
          />
        </div>
        <span className="toolbar-divider" />
        <div className="toolbar-group toolbar-group-paragraph" role="group" aria-label="Text alignment">
          <ToolbarButton label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={command(() => editor.chain().focus().setTextAlign('left'))}><AlignLeft size={16} /></ToolbarButton>
          <ToolbarButton label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={command(() => editor.chain().focus().setTextAlign('center'))}><AlignCenter size={16} /></ToolbarButton>
          <ToolbarButton label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={command(() => editor.chain().focus().setTextAlign('right'))}><AlignRight size={16} /></ToolbarButton>
          <ToolbarButton label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={command(() => editor.chain().focus().setTextAlign('justify'))}><AlignJustify size={16} /></ToolbarButton>
        </div>
        <span className="toolbar-spacer" />
        <div className="toolbar-group toolbar-group-editing toolbar-history" role="group" aria-label="History">
          <ToolbarButton label="Undo" shortcut="Ctrl/Cmd+Z" disabled={!editor.can().undo()} onClick={command(() => editor.chain().focus().undo())}><Undo2 size={16} /></ToolbarButton>
          <ToolbarButton label="Redo" shortcut="Ctrl/Cmd+Y" disabled={!editor.can().redo()} onClick={command(() => editor.chain().focus().redo())}><Redo2 size={16} /></ToolbarButton>
        </div>
      </div>

      <div className="toolbar-row toolbar-row-secondary">
        <div className="toolbar-group toolbar-group-paragraph toolbar-list-controls" role="group" aria-label="Lists and indentation">
          <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={command(() => editor.chain().focus().toggleBulletList())}><List size={17} /></ToolbarButton>
          <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={command(() => editor.chain().focus().toggleOrderedList())}><ListOrdered size={17} /></ToolbarButton>
          <ToolbarButton label="Checklist" active={editor.isActive('taskList')} onClick={command(() => editor.chain().focus().toggleTaskList())}><ListChecks size={17} /></ToolbarButton>
          <ToolbarButton label="Decrease indent" disabled={!listIsActive || !editor.can().liftListItem(listItemType)} onClick={command(() => editor.chain().focus().liftListItem(listItemType))}><ArrowLeft size={16} /></ToolbarButton>
          <ToolbarButton label="Increase indent" disabled={!listIsActive || !editor.can().sinkListItem(listItemType)} onClick={command(() => editor.chain().focus().sinkListItem(listItemType))}><ArrowRight size={16} /></ToolbarButton>
        </div>
        <span className="toolbar-divider toolbar-list-divider" />
        <div className="toolbar-group toolbar-group-paragraph toolbar-paragraph-spacing" role="group" aria-label="Line and paragraph spacing">
          <label className="toolbar-select-label">
            <span>Line spacing</span>
            <select
              aria-label="Line spacing"
              title="Line spacing"
              value={blockAttributes.lineHeight || ''}
              onChange={(event) => setBlockAttribute('lineHeight', event.target.value)}
            >
              <option value="">Default</option>
              <option value="1.15">1.15</option>
              <option value="1.5">1.5</option>
              <option value="1.75">1.75</option>
              <option value="2">Double</option>
            </select>
          </label>
          <label className="toolbar-select-label">
            <span>Paragraph spacing</span>
            <select
              aria-label="Paragraph spacing"
              title="Paragraph spacing"
              value={blockAttributes.paragraphSpacing || ''}
              onChange={(event) => setBlockAttribute('paragraphSpacing', event.target.value)}
            >
              <option value="">Default</option>
              <option value="0.5em">Compact</option>
              <option value="1em">Normal</option>
              <option value="1.5em">Relaxed</option>
              <option value="2em">Wide</option>
            </select>
          </label>
        </div>
        <div className="toolbar-group toolbar-group-font toolbar-case-clear" role="group" aria-label="Text editing">
          <label className="toolbar-select-label">
            <span>Change case</span>
            <select
              aria-label="Change case"
              title="Change case"
              value=""
              disabled={editor.state.selection.empty}
              onChange={(event) => {
                if (event.target.value) changeSelectionCase(editor, event.target.value);
              }}
            >
              <option value="">Case</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="lowercase">lowercase</option>
              <option value="capitalize">Capitalize Each Word</option>
              <option value="sentence">Sentence case</option>
            </select>
          </label>
          <ToolbarButton label="Clear formatting" onClick={clearFormatting}><Eraser size={15} /></ToolbarButton>
          <ToolbarButton label="Select all" onClick={command(() => editor.chain().focus().selectAll())}>A</ToolbarButton>
        </div>
        <div className="toolbar-group toolbar-visible-insert toolbar-group-insert" role="group" aria-label="Insert files and media">
          <button type="button" className="insert-button" title="Attach file" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? <span className="spin"><Paperclip size={15} /></span> : <Paperclip size={15} />}
            <span>Attach file</span>
          </button>
          <button type="button" className="insert-button" title="Insert image" disabled={uploading} onClick={() => imageInputRef.current?.click()}>
            <ImagePlus size={16} /><span>Image</span>
          </button>
        </div>
        <div className="toolbar-group toolbar-group-insert toolbar-insert-actions" role="group" aria-label="Insert objects">
          <ToolbarButton label="Horizontal divider" onClick={command(() => editor.chain().focus().setHorizontalRule())}><Minus size={15} /></ToolbarButton>
          <ToolbarButton
            label={editor.isActive('link') ? 'Edit link' : 'Insert link'}
            active={editor.isActive('link')}
            onClick={() => { void addLink(); }}
          >
            <LinkIcon size={15} />
          </ToolbarButton>
          {editor.isActive('link') && (
            <ToolbarButton
              label="Remove link"
              onClick={command(() => editor.chain().focus().extendMarkRange('link').unsetLink())}
            >
              <LinkIcon size={15} />
            </ToolbarButton>
          )}
        </div>
        <div className="toolbar-group toolbar-group-editing toolbar-review-tools" role="group" aria-label="Review and search">
          <ToolbarButton
            label="Find and replace"
            shortcut="Ctrl/Cmd+F"
            className="toolbar-find-replace"
            onClick={() => setFindReplaceOpen(true)}
          >
            <Search size={16} />
          </ToolbarButton>
        </div>
        <div className="toolbar-group toolbar-group-editing toolbar-view-tools" role="group" aria-label="View controls">
          <ToolbarButton
            label={focusMode ? 'Exit focus mode' : 'Focus mode'}
            active={focusMode}
            className="toolbar-focus-mode"
            onClick={onToggleFocus}
          >
            {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </ToolbarButton>
          <div className="toolbar-zoom-controls" role="group" aria-label="Editor zoom">
            <ToolbarButton label="Zoom out" disabled={zoom <= 70} onClick={() => onZoomChange(Math.max(70, zoom - 10))}><Minus size={15} /></ToolbarButton>
            <span>{zoom}%</span>
            <ToolbarButton label="Zoom in" disabled={zoom >= 150} onClick={() => onZoomChange(Math.min(150, zoom + 10))}><Plus size={15} /></ToolbarButton>
          </div>
        </div>
        <div className="toolbar-group toolbar-group-editing toolbar-review-stats" aria-label="Document statistics">
          <span>{wordCount} words</span><span>{characterCount} characters</span>
        </div>
        <div ref={formattingRootRef} className={`toolbar-dropdown toolbar-group toolbar-group-font toolbar-advanced-dropdown${formattingMenu.open ? ' is-open' : ''}`} {...formattingMenu.menuProps}>
          <button
            type="button"
            className="toolbar-dropdown-trigger"
            title="Advanced formatting"
            aria-label="Advanced formatting"
            aria-expanded={formattingMenu.open}
            onClick={formattingMenu.toggle}
          >
            <span>Advanced</span>
          </button>
          <PortalMenu
            anchorRef={formattingRootRef}
            align="start"
            className="toolbar-dropdown-panel"
            label="Advanced formatting"
            menuProps={formattingMenu.portalProps}
            open={formattingMenu.open}
            role="group"
          >
              <MenuButton label="Inline code" onClick={() => { formattingMenu.close(); command(() => editor.chain().focus().toggleCode())(); }}><Braces size={15} /></MenuButton>
              <MenuButton label="Code block" onClick={() => { formattingMenu.close(); command(() => editor.chain().focus().toggleCodeBlock())(); }}><Code2 size={15} /></MenuButton>
              <MenuButton label="Block quote" onClick={() => { formattingMenu.close(); command(() => editor.chain().focus().toggleBlockquote())(); }}><Quote size={15} /></MenuButton>
              <label className="toolbar-font-option">
                <span>Character spacing</span>
                <select
                  aria-label="Character spacing"
                  title="Character spacing"
                  value={textStyle.letterSpacing || ''}
                  onChange={(event) => editor.chain().focus()
                    .setMark('textStyle', { letterSpacing: event.target.value || null })
                    .run()}
                >
                  <option value="">Default</option>
                  <option value="0.02em">Slight</option>
                  <option value="0.04em">Moderate</option>
                  <option value="0.08em">Wide</option>
                  <option value="0.12em">Very wide</option>
                </select>
              </label>
              <label className="toolbar-font-option">
                <span>List marker style</span>
                <select
                  aria-label="List marker style"
                  title="List marker style"
                  value={listStyleType}
                  disabled={!canStyleList}
                  onChange={(event) => editor.chain().focus()
                    .updateAttributes(styledListType, { listStyleType: event.target.value })
                    .run()}
                >
                  {listMarkerStyles.map((style) => (
                    <option key={style.value} value={style.value}>{style.label}</option>
                  ))}
                </select>
              </label>
              <ColorPicker
                label="Marker color"
                color="marker"
                value={listAttributes.markerColor}
                colors={TEXT_COLORS}
                disabled={!canStyleList}
                onChange={(value) => editor.chain().focus()
                  .updateAttributes(styledListType, { markerColor: value })
                  .run()}
                onClear={() => editor.chain().focus()
                  .updateAttributes(styledListType, { markerColor: null })
                  .run()}
              />
          </PortalMenu>
        </div>
        <div ref={insertRootRef} className={`toolbar-dropdown toolbar-group toolbar-group-insert toolbar-insert-dropdown${insertMenu.open ? ' is-open' : ''}`} {...insertMenu.menuProps}>
          <button
            type="button"
            className="toolbar-dropdown-trigger"
            title="Insert table"
            aria-label="Insert table"
            aria-expanded={insertMenu.open}
            onClick={insertMenu.toggle}
          >
            <span>Table</span>
          </button>
          <PortalMenu
            anchorRef={insertRootRef}
            align="start"
            className="toolbar-dropdown-panel toolbar-insert-panel"
            label="Insert table and symbols"
            menuProps={insertMenu.portalProps}
            open={insertMenu.open}
            role="group"
          >
              <div className="table-size-picker" role="group" aria-label="Insert table">
                <span>Insert table {tableSize.rows && tableSize.cols ? `${tableSize.rows} × ${tableSize.cols}` : ''}</span>
                <div className="table-size-grid" role="grid" onMouseLeave={() => setTableSize({ rows: 0, cols: 0 })}>
                  {Array.from({ length: 10 }, (_, row) => (
                    <div className="table-size-row" role="row" key={row}>
                      {Array.from({ length: 10 }, (_, column) => {
                        const rows = row + 1;
                        const cols = column + 1;
                        const selected = rows <= tableSize.rows && cols <= tableSize.cols;
                        return (
                          <button
                            type="button"
                            role="gridcell"
                            key={column}
                            aria-label={`${rows} rows by ${cols} columns`}
                            title={`${rows} rows by ${cols} columns`}
                            className={selected ? 'is-selected' : ''}
                            onMouseDown={(event) => {
                              if (event.button === 0) event.preventDefault();
                            }}
                            onMouseEnter={() => setTableSize({ rows, cols })}
                            onFocus={() => setTableSize({ rows, cols })}
                            onClick={() => {
                              insertMenu.close();
                              command(() => editor.chain().focus().insertTable({
                                rows,
                                cols,
                                withHeaderRow: true,
                              }))();
                              setTableSize({ rows: 0, cols: 0 });
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="toolbar-symbol-group" role="group" aria-label="Special characters">
                <span><Sigma size={14} /> Special characters</span>
                <label className="toolbar-symbol-search">
                  <Search size={14} />
                  <input
                    type="search"
                    aria-label="Search special characters"
                    placeholder="Search symbols"
                    value={symbolQuery}
                    onChange={(event) => setSymbolQuery(event.target.value)}
                  />
                </label>
                <div>
                  {filteredSymbols.map(({ character, label }) => (
                    <button
                      type="button"
                      key={character}
                      aria-label={`Insert ${label}`}
                      title={label}
                      onMouseDown={(event) => {
                        if (event.button === 0) event.preventDefault();
                      }}
                      onClick={() => insertSpecialCharacter(character)}
                    >
                      {character}
                    </button>
                  ))}
                  {!filteredSymbols.length && <span className="toolbar-picker-empty">No symbols found</span>}
                </div>
              </div>
              <div className="toolbar-symbol-group toolbar-emoji-group" role="group" aria-label="Emoji">
                <span><Smile size={14} /> Emoji</span>
                <label className="toolbar-symbol-search">
                  <Search size={14} />
                  <input
                    type="search"
                    aria-label="Search emoji"
                    placeholder="Search emoji"
                    value={emojiQuery}
                    onChange={(event) => setEmojiQuery(event.target.value)}
                  />
                </label>
                <div>
                  {filteredEmojis.map(({ emoji, label }) => (
                    <button
                      type="button"
                      key={emoji}
                      aria-label={`Insert ${label}`}
                      title={label}
                      onMouseDown={(event) => {
                        if (event.button === 0) event.preventDefault();
                      }}
                      onClick={() => insertSpecialCharacter(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                  {!filteredEmojis.length && <span className="toolbar-picker-empty">No emoji found</span>}
                </div>
              </div>
          </PortalMenu>
        </div>
      </div>
    </div>
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 120, placement: 'top', maxWidth: 'none' }}
      shouldShow={({ state }) => !state.selection.empty && editor.isEditable}
    >
      <div className="editor-floating-toolbar" role="group" aria-label="Selection formatting">
        <ToolbarButton label="Bold" shortcut="Ctrl/Cmd+B" active={editor.isActive('bold')} onClick={command(() => editor.chain().focus().toggleBold())}><Bold size={15} /></ToolbarButton>
        <ToolbarButton label="Italic" shortcut="Ctrl/Cmd+I" active={editor.isActive('italic')} onClick={command(() => editor.chain().focus().toggleItalic())}><Italic size={15} /></ToolbarButton>
        <ToolbarButton label="Underline" shortcut="Ctrl/Cmd+U" active={editor.isActive('underline')} onClick={command(() => editor.chain().focus().toggleUnderline())}><Underline size={15} /></ToolbarButton>
        <ToolbarButton label="Strikethrough" shortcut="Ctrl/Cmd+Shift+X" active={editor.isActive('strike')} onClick={command(() => editor.chain().focus().toggleStrike())}><Strikethrough size={15} /></ToolbarButton>
        <span className="toolbar-divider" />
        <ToolbarButton label="Subscript" active={editor.isActive('subscript')} onClick={toggleSubscript}><Subscript size={15} /></ToolbarButton>
        <ToolbarButton label="Superscript" active={editor.isActive('superscript')} onClick={toggleSuperscript}><Superscript size={15} /></ToolbarButton>
        <ToolbarButton label={editor.isActive('link') ? 'Edit link' : 'Insert link'} active={editor.isActive('link')} onClick={() => { void addLink(); }}><LinkIcon size={15} /></ToolbarButton>
      </div>
    </BubbleMenu>
    <EditorContextMenu editor={editor} />
    {findReplaceOpen && (
      <FindReplaceDialog editor={editor} onClose={() => setFindReplaceOpen(false)} />
    )}
    </>
  );
}
