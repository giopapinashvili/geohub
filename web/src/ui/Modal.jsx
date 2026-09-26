import { createPortal } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';
import { useBodyLock, useEscape } from '../lib/hooks.js';
import { IconButton } from './Button.jsx';
import { t } from '../lib/i18n.js';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useFocusTrap(ref, open) {
  useEffect(() => {
    if (!open || !ref.current) return undefined;
    const prev = document.activeElement;
    const root = ref.current;
    const first = root.querySelector('[autofocus]') || root.querySelector(FOCUSABLE) || root;
    requestAnimationFrame(() => first.focus?.({ preventScroll: true }));
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const items = Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const a = items[0], z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    root.addEventListener('keydown', onKey);
    return () => { root.removeEventListener('keydown', onKey); prev?.focus?.({ preventScroll: true }); };
  }, [open]);
}

/**
 * Dialog: centred card on desktop, bottom sheet on phones.
 * size: sm | md | lg | full
 */
export function Modal({ open, onClose, title, children, footer, size = 'md', noPad, labelledBy, class: cls = '' }) {
  const ref = useRef(null);
  useBodyLock(open);
  useEscape(() => onClose?.(), open);
  useFocusTrap(ref, open);
  if (!open) return null;
  return createPortal(
    <div class="modal-layer" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div
        ref={ref}
        class={`modal modal-${size} ${cls}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || (title ? 'modal-title' : undefined)}
        tabIndex={-1}
      >
        {title !== undefined && (
          <header class="modal-head">
            <h2 id="modal-title" class="modal-title">{title}</h2>
            <IconButton icon="x" label={t('common.close')} onClick={onClose} size={36} variant="soft" />
          </header>
        )}
        <div class={`modal-body${noPad ? ' no-pad' : ''}`}>{children}</div>
        {footer && <footer class="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/** Small confirm dialog; resolves via onConfirm / onClose. */
export function Confirm({ open, onClose, onConfirm, title, text, confirmLabel, danger, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <button type="button" class="btn btn-secondary btn-md" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" class={`btn btn-${danger ? 'danger' : 'primary'} btn-md`} onClick={onConfirm} disabled={loading}>
            {confirmLabel || t('common.confirm')}
          </button>
        </>
      }>
      {text && <p class="text-2">{text}</p>}
    </Modal>
  );
}
