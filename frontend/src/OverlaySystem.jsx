import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';

const OverlayContext = createContext(null);

export function OverlayProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    function dismissOutsideMenu(event) {
      if (!activeMenu) return;
      const roots = [...document.querySelectorAll('[data-menu-root]')]
        .filter((element) => element.dataset.menuId === activeMenu);
      if (!roots.length || !roots.some((element) => element.contains(event.target))) {
        setActiveMenu(null);
      }
    }

    function dismissMenuOnEscape(event) {
      if (event.key === 'Escape' && activeMenu) {
        setActiveMenu(null);
        event.stopPropagation();
      }
    }

    document.addEventListener('pointerdown', dismissOutsideMenu);
    document.addEventListener('keydown', dismissMenuOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutsideMenu);
      document.removeEventListener('keydown', dismissMenuOnEscape);
    };
  }, [activeMenu]);

  const openDialog = useCallback((options) => new Promise((resolve) => {
    setActiveMenu(null);
    const nextDialog = {
      mode: 'confirm',
      title: 'NoteSphere',
      confirmLabel: 'Continue',
      cancelLabel: 'Cancel',
      ...options,
      inputValue: options.value || '',
      resolve,
    };
    dialogRef.current = nextDialog;
    setDialog(nextDialog);
  }), []);

  const closeDialog = useCallback((value) => {
    const current = dialogRef.current;
    if (!current || current.busy) return;
    current.resolve(value);
    dialogRef.current = null;
    setDialog(null);
  }, []);

  const updateDialog = useCallback((changes) => {
    if (changes === null) {
      dialogRef.current = null;
      setDialog(null);
      return;
    }
    if (!dialogRef.current) return;
    const updated = { ...dialogRef.current, ...changes };
    dialogRef.current = updated;
    setDialog(updated);
  }, []);

  const dialogs = useMemo(() => ({
    alert: (options) => openDialog({ ...options, mode: 'alert' }),
    confirm: (options) => openDialog({ ...options, mode: 'confirm' }),
    prompt: (options) => openDialog({ ...options, mode: 'prompt' }),
    custom: (options) => openDialog({ ...options, mode: 'custom' }),
  }), [openDialog]);

  const contextValue = useMemo(() => ({
    dialogs,
    openMenu: setActiveMenu,
    closeMenu: () => setActiveMenu(null),
    activeMenu,
  }), [activeMenu, dialogs]);

  return (
    <OverlayContext.Provider value={contextValue}>
      {children}
      {dialog && typeof document !== 'undefined' && createPortal(
        <ManagedDialog
          dialog={dialog}
          onClose={() => closeDialog(dialog.mode === 'confirm' || dialog.mode === 'alert' ? false : null)}
          onChange={updateDialog}
        />,
        document.body,
      )}
    </OverlayContext.Provider>
  );
}

export function useDialogs() {
  const context = useContext(OverlayContext);
  if (!context) throw new Error('useDialogs must be used within OverlayProvider.');
  return context.dialogs;
}

export function useManagedMenu() {
  const context = useContext(OverlayContext);
  if (!context) throw new Error('useManagedMenu must be used within OverlayProvider.');
  const localId = useId();
  const open = context.activeMenu === localId;
  return {
    open,
    menuProps: { 'data-menu-root': '', 'data-menu-id': localId },
    portalProps: { 'data-menu-root': '', 'data-menu-id': localId },
    toggle: () => context.openMenu(open ? null : localId),
    show: () => context.openMenu(localId),
    close: context.closeMenu,
  };
}

export function PortalMenu({
  anchorRef,
  align = 'start',
  children,
  className = '',
  label,
  menuProps,
  open,
  role,
  side = 'bottom',
}) {
  const popupRef = useRef(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });

  useLayoutEffect(() => {
    if (!open) return undefined;

    function updatePosition() {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const popup = popupRef.current?.getBoundingClientRect();
      if (!anchor || !popup) return;

      const margin = 8;
      const gap = 6;
      const above = anchor.top - margin;
      const below = window.innerHeight - anchor.bottom - margin;
      const canPlaceAbove = above >= popup.height + gap;
      const canPlaceBelow = below >= popup.height + gap;
      const openAbove = side === 'top'
        ? canPlaceAbove || !canPlaceBelow
        : !canPlaceBelow && canPlaceAbove;
      const left = align === 'end' ? anchor.right - popup.width : anchor.left;
      const top = openAbove ? anchor.top - popup.height - gap : anchor.bottom + gap;
      const maxLeft = Math.max(margin, window.innerWidth - popup.width - margin);
      const maxTop = Math.max(margin, window.innerHeight - popup.height - margin);

      setPosition({
        left: Math.max(margin, Math.min(left, maxLeft)),
        top: Math.max(margin, Math.min(top, maxTop)),
      });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updatePosition);
    if (popupRef.current) resizeObserver?.observe(popupRef.current);
    if (anchorRef.current) resizeObserver?.observe(anchorRef.current);
    return () => {
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
      resizeObserver?.disconnect();
    };
  }, [align, anchorRef, open, side]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      {...menuProps}
      ref={popupRef}
      className={`portal-menu${className ? ` ${className}` : ''}`}
      aria-label={label}
      role={role}
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        right: 'auto',
        bottom: 'auto',
        zIndex: 1600,
        maxWidth: 'calc(100vw - 16px)',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function DialogFrame({
  children,
  className = 'create-dialog',
  labelId,
  label,
  onClose,
  busy = false,
  closeOnBackdrop = true,
}) {
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    const focusTarget = dialogRef.current?.querySelector('[autofocus], input, select, textarea, button');
    (focusTarget || dialogRef.current)?.focus();
    return () => previousFocus.current?.focus?.();
  }, []);

  function handleKeyDown(event) {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )];
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget && !busy) onClose?.();
      }}
    >
      <section
        ref={dialogRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-label={label}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {children}
      </section>
    </div>
  );
}

function ManagedDialog({ dialog, onClose, onChange }) {
  const isPrompt = dialog.mode === 'prompt';
  const isCustom = dialog.mode === 'custom';

  async function runAction(action) {
    if (dialog.busy) return;
    const value = isPrompt ? dialog.inputValue : action?.value;
    const validationError = isPrompt ? dialog.validate?.(dialog.inputValue) : '';
    if (validationError) {
      onChange({ error: validationError });
      return;
    }
    onChange({ busy: true, error: '' });
    try {
      const result = await (action?.onSelect || dialog.onConfirm)?.(value);
      if (result === false) {
        onChange({ busy: false });
        return;
      }
      dialog.resolve(isPrompt ? (result ?? value) : (isCustom ? (result ?? action?.value) : (result ?? true)));
      onChange(null);
    } catch (error) {
      onChange({ busy: false, error: error.message || 'The operation could not be completed.' });
    }
  }

  function update(changes) {
    onChange(changes);
  }

  function submit(event) {
    event.preventDefault();
    void runAction();
  }

  return (
    <DialogFrame
      className="create-dialog managed-dialog"
      labelId="managed-dialog-title"
      onClose={onClose}
      busy={dialog.busy}
    >
      <div className="dialog-heading">
        <div>
          <span className="dialog-eyebrow">NOTESPHERE</span>
          <h2 id="managed-dialog-title">{dialog.title}</h2>
          {dialog.message && <p>{dialog.message}</p>}
        </div>
        <button type="button" className="dialog-close" disabled={dialog.busy} aria-label="Close dialog" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {isCustom ? (
        <div className="managed-dialog-content">{dialog.content}</div>
      ) : isPrompt ? (
        <form onSubmit={submit}>
          {dialog.label && <label className="dialog-label" htmlFor="managed-dialog-input">{dialog.label}</label>}
          <input
            id="managed-dialog-input"
            className="dialog-input"
            value={dialog.inputValue}
            maxLength={dialog.maxLength || 300}
            autoFocus
            onChange={(event) => update({ inputValue: event.target.value, error: '' })}
          />
        </form>
      ) : null}

      {dialog.error && (
        <p className="managed-dialog-error" role="alert">
          <AlertCircle size={15} /> {dialog.error}
        </p>
      )}

      <div className="dialog-footer">
        {dialog.busy && <span className="dialog-loading" role="status"><LoaderCircle className="spin" size={14} /> Working…</span>}
        {isCustom ? (
          dialog.actions?.map((action) => (
            <button
              type="button"
              key={action.value}
              className={action.tone === 'danger' ? 'dialog-danger' : action.primary ? 'dialog-submit' : 'dialog-cancel'}
              disabled={dialog.busy}
              onClick={() => void runAction(action)}
            >
              {dialog.busy && action.primary ? <LoaderCircle className="spin" size={15} /> : null}
              {action.label}
            </button>
          ))
        ) : (
          <>
            {dialog.mode !== 'alert' && (
              <button type="button" className="dialog-cancel" disabled={dialog.busy} onClick={onClose}>
                {dialog.cancelLabel}
              </button>
            )}
            <button
              type="button"
              className={dialog.danger ? 'dialog-danger' : 'dialog-submit'}
              disabled={dialog.busy}
              onClick={() => void runAction()}
            >
              {dialog.busy ? <LoaderCircle className="spin" size={15} /> : null}
              {dialog.confirmLabel}
            </button>
          </>
        )}
      </div>
    </DialogFrame>
  );
}
