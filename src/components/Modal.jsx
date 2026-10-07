import { useEffect, useId, useRef } from 'react';

/**
 * Shared modal.
 *
 * The dialog semantics below are not decoration — without them a keyboard or
 * screen-reader user can tab straight past the overlay into the page behind it,
 * and Escape does nothing.  Specifically:
 *
 *  - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` so the title is
 *    announced as the dialog's name.
 *  - Escape closes, and focus is trapped inside while open.
 *  - Focus moves to the first control on open and returns to whatever opened
 *    the dialog on close, so the tab order does not restart at the top of the
 *    document.
 *
 * `className` is appended to the dialog element so a caller can theme its own
 * dialog (e.g. the partner dialog's brand header) without a `:has()` selector
 * reaching into the shared markup.  It defaults to empty, so the other callers
 * render exactly the same class list they did before.
 *
 * `style` is merged over the size preset for the same reason — the partner
 * dialog passes its brand accent through as custom properties.  It defaults to
 * undefined, so nothing changes for callers that do not pass it.
 */
export function Modal({ isOpen, onClose, title, children, footer, size = 'md', className = '', style }) {
  const dialogRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    // Remember where focus came from so it can be handed back on close.
    restoreFocusRef.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const focusables = () => {
      const node = dialogRef.current;
      if (!node) return [];
      return Array.from(
        node.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);
    };

    // Move focus into the dialog (prefer the first real control).
    const initial = focusables();
    if (initial.length) initial[0].focus();
    else dialogRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      const restore = restoreFocusRef.current;
      if (restore && typeof restore.focus === 'function' && document.contains(restore)) {
        restore.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  const sizeStyles = {
    sm: { maxWidth: '400px' },
    md: { maxWidth: '600px' },
    lg: { maxWidth: '800px' },
    xl: { maxWidth: '1000px' }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className={`modal ${className}`.trim()}
        style={{ ...sizeStyles[size], ...style }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3 className="modal-title" id={titleId}>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
