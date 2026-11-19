import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bold,
  Copy,
  Eraser,
  Italic,
  List,
  Scissors,
  Underline,
  ClipboardPaste,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useDialogs } from './OverlaySystem';

export default function EditorContextMenu({ editor }) {
  const dialogs = useDialogs();
  const menuRef = useRef(null);
  const [menu, setMenu] = useState(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!editor) return undefined;

    function openMenu(event) {
      event.preventDefault();
      const { doc, selection } = editor.state;
      const { from, to } = selection;
      let selectedText = '';
      try {
        if (!selection.empty && from >= 0 && to <= doc.content.size && from < to) {
          selectedText = doc.textBetween(from, to, '\n');
        }
      } catch {
        setMenu(null);
        void dialogs.alert({
          title: 'Selection unavailable',
          message: 'The current text selection could not be read. Please select the text again.',
        });
        return;
      }
      setMenu({
        x: event.clientX,
        y: event.clientY,
        from,
        to,
        doc,
        selectedText,
        hasSelection: Boolean(selectedText),
      });
    }

    editor.view.dom.addEventListener('contextmenu', openMenu);
    return () => editor.view.dom.removeEventListener('contextmenu', openMenu);
  }, [editor]);

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const bounds = menuRef.current.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(menu.x, window.innerWidth - bounds.width - 8)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - bounds.height - 8)),
    });
    menuRef.current.querySelector('button:not(:disabled)')?.focus();
    if (!menuRef.current.contains(document.activeElement)) menuRef.current.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return undefined;

    function dismissOutside(event) {
      if (!menuRef.current?.contains(event.target)) setMenu(null);
    }

    function dismissOnEscape(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenu(null);
      }
    }

    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape, true);
    };
  }, [menu]);

  if (!menu || !editor || menu.doc !== editor.state.doc || typeof document === 'undefined') return null;

  const hasSelection = menu.hasSelection;
  const selectedText = menu.selectedText;
  const run = (command) => {
    const chain = editor.chain().focus().setTextSelection({ from: menu.from, to: menu.to });
    command(chain);
    chain.run();
    setMenu(null);
  };

  async function copySelection(removeAfterCopy = false) {
    if (!hasSelection) return setMenu(null);
    try {
      await navigator.clipboard.writeText(selectedText);
      if (removeAfterCopy) {
        editor.chain().focus()
          .setTextSelection({ from: menu.from, to: menu.to })
          .deleteSelection()
          .run();
      }
      setMenu(null);
    } catch (error) {
      setMenu(null);
      await dialogs.alert({
        title: 'Clipboard unavailable',
        message: error.message || 'The selected text could not be copied.',
      });
    }
  }

  async function pasteText() {
    try {
      const text = await navigator.clipboard.readText();
      editor.chain().focus()
        .setTextSelection({ from: menu.from, to: menu.to })
        .insertContent(text)
        .run();
      setMenu(null);
    } catch (error) {
      setMenu(null);
      await dialogs.alert({
        title: 'Clipboard unavailable',
        message: error.message || 'Clipboard access was denied by your browser.',
      });
    }
  }

  function action(label, icon, callback, disabled = false) {
    return (
      <button
        type="button"
        role="menuitem"
        key={label}
        disabled={disabled}
        onMouseDown={(event) => {
          if (event.button === 0) event.preventDefault();
        }}
        onClick={callback}
      >
        {icon}<span>{label}</span>
      </button>
    );
  }

  return createPortal(
    <div
      ref={menuRef}
      className="editor-context-menu"
      role="menu"
      aria-label="Editor actions"
      tabIndex={-1}
      style={{ left: position.left, top: position.top }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setMenu(null);
        }
      }}
    >
      {action('Cut', <Scissors size={15} />, () => void copySelection(true), !hasSelection)}
      {action('Copy', <Copy size={15} />, () => void copySelection(), !hasSelection)}
      {action('Paste', <ClipboardPaste size={15} />, () => void pasteText())}
      <span className="editor-context-divider" />
      {action('Bold', <Bold size={15} />, () => run((chain) => chain.toggleBold()), !hasSelection)}
      {action('Italic', <Italic size={15} />, () => run((chain) => chain.toggleItalic()), !hasSelection)}
      {action('Underline', <Underline size={15} />, () => run((chain) => chain.toggleUnderline()), !hasSelection)}
      {action('Clear formatting', <Eraser size={15} />, () => run((chain) => chain.unsetAllMarks()), !hasSelection)}
      <span className="editor-context-divider" />
      {action('Select all', <List size={15} />, () => {
        editor.chain().focus().selectAll().run();
        setMenu(null);
      })}
      {action('Undo', <Undo2 size={15} />, () => {
        editor.chain().focus().undo().run();
        setMenu(null);
      }, !editor.can().undo())}
      {action('Redo', <Redo2 size={15} />, () => {
        editor.chain().focus().redo().run();
        setMenu(null);
      }, !editor.can().redo())}
    </div>,
    document.body,
  );
}
