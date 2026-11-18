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
  Eraser,
  Highlighter,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Paperclip,
  Quote,
  Redo2,
  Search,
  Sigma,
  Smile,
  Strikethrough,
  Subscript,
  Superscript,
  Table2,
  Type,
  Underline,
  Undo2,
} from 'lucide-react';
import { BubbleMenu } from '@tiptap/react';
import { useDialogs, useManagedMenu } from './OverlaySystem';
import FindReplaceDialog from './FindReplaceDialog';

const TEXT_COLORS = [
  '#24233a', '#5f5e70', '#a23b3b', '#d44d4d', '#d97706',
  '#21845b', '#147d91', '#3567c8', '#6852c6', '#bd4788',
];

const HIGHLIGHT_COLORS = [
  '#fff0a8', '#ffe0dc', '#ffd6e7', '#eadfff', '#d9e8ff',
  '#d5f3e5', '#d7f3f5', '#f4e3ca', '#e7e8eb',
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
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      className={`toolbar-button${active ? ' is-active' : ''}`}
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

function ColorPicker({ label, color, value, colors, onChange, onClear, disabled = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const fallbackColor = colors[0];
  const inputValue = /^#[\da-f]{6}$/i.test(value || '') ? value : fallbackColor;

  useEffect(() => {
    if (!open) return undefined;

    function dismissOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
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

  return (
    <div
      ref={rootRef}
      className={`toolbar-color-picker toolbar-color-picker-${color}${open ? ' is-open' : ''}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="toolbar-color-trigger"
        aria-label={label}
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
        ) : color === 'marker' ? <List size={15} /> : <Highlighter size={15} />}
        <span>{label}</span>
        <span className="toolbar-color-current" style={{ backgroundColor: value || fallbackColor }} />
      </button>
      {open && (
        <div className="toolbar-color-popover" role="group" aria-label={`${label} palette`}>
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
            Remove {color === 'text' ? 'text color' : 'highlight'}
          </button>
        </div>
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
}) {
  const dialogs = useDialogs();
  const formattingMenu = useManagedMenu();
  const insertMenu = useManagedMenu();
  const [, setEditorRevision] = useState(0);
  const formattingRootRef = useRef(null);
  const insertRootRef = useRef(null);
  const [formattingOpensUp, setFormattingOpensUp] = useState(false);
  const [insertOpensUp, setInsertOpensUp] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [symbolQuery, setSymbolQuery] = useState('');
  const [emojiQuery, setEmojiQuery] = useState('');

  useEffect(() => {
    if (!editor) return undefined;
    const refreshToolbar = () => setEditorRevision((revision) => revision + 1);
    editor.on('transaction', refreshToolbar);
    return () => editor.off('transaction', refreshToolbar);
  }, [editor]);

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

  useLayoutEffect(() => {
    if (!formattingMenu.open && !insertMenu.open) return undefined;

    function updatePlacement(rootRef, setOpensUp) {
      const root = rootRef.current;
      const panel = root?.querySelector('.toolbar-dropdown-panel');
      if (!root || !panel) return;
      const bounds = root.getBoundingClientRect();
      const spaceBelow = window.innerHeight - bounds.bottom;
      const spaceAbove = bounds.top;
      setOpensUp(panel.scrollHeight > spaceBelow && spaceAbove > spaceBelow);
    }

    function updateMenus() {
      if (formattingMenu.open) updatePlacement(formattingRootRef, setFormattingOpensUp);
      if (insertMenu.open) updatePlacement(insertRootRef, setInsertOpensUp);
    }

    updateMenus();
    window.addEventListener('resize', updateMenus);
    document.addEventListener('scroll', updateMenus, true);
    return () => {
      window.removeEventListener('resize', updateMenus);
      document.removeEventListener('scroll', updateMenus, true);
    };
  }, [formattingMenu.open, insertMenu.open]);

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
    formattingMenu.close();
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
    <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
      <div className="toolbar-row toolbar-row-primary">
        <div className="toolbar-group toolbar-block-style" role="group" aria-label="Text style">
          <select
            aria-label="Text style"
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
        <div className="toolbar-group" role="group" aria-label="Text formatting">
          <ToolbarButton label="Bold" shortcut="Ctrl/Cmd+B" active={editor.isActive('bold')} onClick={command(() => editor.chain().focus().toggleBold())}><Bold size={16} /></ToolbarButton>
          <ToolbarButton label="Italic" shortcut="Ctrl/Cmd+I" active={editor.isActive('italic')} onClick={command(() => editor.chain().focus().toggleItalic())}><Italic size={16} /></ToolbarButton>
          <ToolbarButton label="Underline" shortcut="Ctrl/Cmd+U" active={editor.isActive('underline')} onClick={command(() => editor.chain().focus().toggleUnderline())}><Underline size={16} /></ToolbarButton>
          <ToolbarButton label="Strikethrough" shortcut="Ctrl/Cmd+Shift+X" active={editor.isActive('strike')} onClick={command(() => editor.chain().focus().toggleStrike())}><Strikethrough size={16} /></ToolbarButton>
        </div>
        <span className="toolbar-divider" />
        <div className="toolbar-group" role="group" aria-label="Text alignment">
          <ToolbarButton label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={command(() => editor.chain().focus().setTextAlign('left'))}><AlignLeft size={16} /></ToolbarButton>
          <ToolbarButton label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={command(() => editor.chain().focus().setTextAlign('center'))}><AlignCenter size={16} /></ToolbarButton>
          <ToolbarButton label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={command(() => editor.chain().focus().setTextAlign('right'))}><AlignRight size={16} /></ToolbarButton>
          <ToolbarButton label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={command(() => editor.chain().focus().setTextAlign('justify'))}><AlignJustify size={16} /></ToolbarButton>
        </div>
        <span className="toolbar-spacer" />
        <div className="toolbar-group toolbar-history" role="group" aria-label="History">
          <ToolbarButton label="Undo" shortcut="Ctrl/Cmd+Z" disabled={!editor.can().undo()} onClick={command(() => editor.chain().focus().undo())}><Undo2 size={16} /></ToolbarButton>
          <ToolbarButton label="Redo" shortcut="Ctrl/Cmd+Y" disabled={!editor.can().redo()} onClick={command(() => editor.chain().focus().redo())}><Redo2 size={16} /></ToolbarButton>
        </div>
      </div>

      <div className="toolbar-row toolbar-row-secondary">
        <div className="toolbar-group" role="group" aria-label="Lists and indentation">
          <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={command(() => editor.chain().focus().toggleBulletList())}><List size={17} /></ToolbarButton>
          <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={command(() => editor.chain().focus().toggleOrderedList())}><ListOrdered size={17} /></ToolbarButton>
          <ToolbarButton label="Checklist" active={editor.isActive('taskList')} onClick={command(() => editor.chain().focus().toggleTaskList())}><ListChecks size={17} /></ToolbarButton>
          <ToolbarButton label="Decrease indent" disabled={!listIsActive || !editor.can().liftListItem(listItemType)} onClick={command(() => editor.chain().focus().liftListItem(listItemType))}><ArrowLeft size={16} /></ToolbarButton>
          <ToolbarButton label="Increase indent" disabled={!listIsActive || !editor.can().sinkListItem(listItemType)} onClick={command(() => editor.chain().focus().sinkListItem(listItemType))}><ArrowRight size={16} /></ToolbarButton>
        </div>
        <span className="toolbar-divider" />
        <div className="toolbar-group toolbar-visible-insert" role="group" aria-label="Attachments">
          <button type="button" className="insert-button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? <span className="spin"><Paperclip size={15} /></span> : <Paperclip size={15} />}
            <span>Attach file</span>
          </button>
          <button type="button" className="insert-button" disabled={uploading} onClick={() => imageInputRef.current?.click()}>
            <ImagePlus size={16} /><span>Image</span>
          </button>
        </div>
        <div ref={formattingRootRef} className={`toolbar-dropdown toolbar-formatting-dropdown${formattingMenu.open ? ' is-open' : ''}`} {...formattingMenu.menuProps}>
          <button
            type="button"
            className="toolbar-dropdown-trigger"
            aria-expanded={formattingMenu.open}
            onClick={formattingMenu.toggle}
          >
            <Type size={14} /><span>More formatting</span>
          </button>
          {formattingMenu.open && (
            <div className={`toolbar-dropdown-panel${formattingOpensUp ? ' opens-up' : ''}`} aria-label="More formatting">
              <MenuButton label="Inline code" onClick={() => { formattingMenu.close(); command(() => editor.chain().focus().toggleCode())(); }}><Braces size={15} /></MenuButton>
              <MenuButton label="Code block" onClick={() => { formattingMenu.close(); command(() => editor.chain().focus().toggleCodeBlock())(); }}><Code2 size={15} /></MenuButton>
              <MenuButton label="Block quote" onClick={() => { formattingMenu.close(); command(() => editor.chain().focus().toggleBlockquote())(); }}><Quote size={15} /></MenuButton>
              <MenuButton label="Subscript" onClick={() => { formattingMenu.close(); toggleSubscript(); }}><Subscript size={15} /></MenuButton>
              <MenuButton label="Superscript" onClick={() => { formattingMenu.close(); toggleSuperscript(); }}><Superscript size={15} /></MenuButton>
              <label className="toolbar-font-option">
                <span>Font family</span>
                <select
                  aria-label="Font family"
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
              <label className="toolbar-font-option">
                <span>Font size</span>
                <select
                  aria-label="Font size"
                  value={textStyle.fontSize || ''}
                  onChange={(event) => editor.chain().focus().setMark('textStyle', { fontSize: event.target.value || null }).run()}
                >
                  <option value="">Default</option>
                  <option value="12px">12 px</option>
                  <option value="14px">14 px</option>
                  <option value="16px">16 px</option>
                  <option value="18px">18 px</option>
                  <option value="24px">24 px</option>
                  <option value="32px">32 px</option>
                </select>
              </label>
              <label className="toolbar-font-option">
                <span>Line spacing</span>
                <select
                  aria-label="Line spacing"
                  value={blockAttributes.lineHeight || ''}
                  onChange={(event) => setBlockAttribute('lineHeight', event.target.value)}
                >
                  <option value="">Default</option>
                  <option value="1.15">Compact</option>
                  <option value="1.5">1.5 lines</option>
                  <option value="1.75">1.75 lines</option>
                  <option value="2">Double</option>
                </select>
              </label>
              <label className="toolbar-font-option">
                <span>Paragraph spacing</span>
                <select
                  aria-label="Paragraph spacing"
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
              <label className="toolbar-font-option">
                <span>List marker style</span>
                <select
                  aria-label="List marker style"
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
              <MenuButton label="Select all" onClick={() => { formattingMenu.close(); command(() => editor.chain().focus().selectAll())(); }}>A</MenuButton>
              <MenuButton label="Clear formatting" onClick={clearFormatting}><Eraser size={15} /></MenuButton>
            </div>
          )}
        </div>
        <div ref={insertRootRef} className={`toolbar-dropdown${insertMenu.open ? ' is-open' : ''}`} {...insertMenu.menuProps}>
          <button
            type="button"
            className="toolbar-dropdown-trigger"
            aria-expanded={insertMenu.open}
            onClick={insertMenu.toggle}
          >
            <span>Insert</span>
          </button>
          {insertMenu.open && (
            <div className={`toolbar-dropdown-panel toolbar-insert-panel${insertOpensUp ? ' opens-up' : ''}`} aria-label="Insert">
              <MenuButton label="Insert table" onClick={() => { insertMenu.close(); command(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }))(); }}><Table2 size={15} /></MenuButton>
              <MenuButton label="Horizontal divider" onClick={() => { insertMenu.close(); command(() => editor.chain().focus().setHorizontalRule())(); }}><Minus size={15} /></MenuButton>
              <MenuButton label={editor.isActive('link') ? 'Edit link' : 'Insert link'} onClick={() => { insertMenu.close(); void addLink(); }}><LinkIcon size={15} /></MenuButton>
              {editor.isActive('link') && (
                <MenuButton label="Remove link" onClick={() => { insertMenu.close(); command(() => editor.chain().focus().extendMarkRange('link').unsetLink())(); }}><LinkIcon size={15} /></MenuButton>
              )}
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
            </div>
          )}
        </div>
        <ToolbarButton
          label="Find and replace"
          shortcut="Ctrl/Cmd+F"
          onClick={() => setFindReplaceOpen(true)}
        >
          <Search size={16} />
        </ToolbarButton>
        <ToolbarButton
          label={focusMode ? 'Exit focus mode' : 'Focus mode'}
          active={focusMode}
          onClick={onToggleFocus}
        >
          {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </ToolbarButton>
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
    {findReplaceOpen && (
      <FindReplaceDialog editor={editor} onClose={() => setFindReplaceOpen(false)} />
    )}
    </>
  );
}
