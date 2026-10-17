import { useLayoutEffect } from 'preact/hooks';

const LAYERS = '.modal-layer, .sheet-layer, .popover, .lightbox, .story-viewer';
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], audio[controls], [tabindex], [contenteditable="true"]';
const visible = (element) => element?.isConnected && element.getClientRects().length > 0
  && !element.closest('[hidden], [inert]') && getComputedStyle(element).visibility !== 'hidden';
const itemsIn = (root) => Array.from(root.querySelectorAll(FOCUSABLE)).filter((element) => element.tabIndex >= 0 && visible(element));

function laterLayer(root) {
  return Array.from(document.querySelectorAll(LAYERS)).filter((layer) => layer !== root && !root.contains(layer)
    && (root.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING) && visible(layer)).at(-1);
}

/** Only the front viewer owns its document-level Escape/arrow shortcuts. */
export function isTopmostModal(root) {
  return !!root?.isConnected && !laterLayer(root);
}

/** Viewer focus, with nested portaled menus and shared dialogs kept usable. */
export function useModalFocus(rootRef, initialFocusRef, active = true) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!active || !root) return undefined;
    const previous = document.activeElement;
    const raised = new Map();
    let lastRootFocus = initialFocusRef?.current;

    const scope = () => {
      if (!root.isConnected) return null;
      const next = laterLayer(root);
      if (!next) return root;
      // Shared Modal manages its own focus; menus need a trap above the viewer.
      if (!next.matches('.popover, .sheet-layer')) return null;
      const viewerZ = Number.parseInt(getComputedStyle(root).zIndex, 10) || 0;
      const menuZ = Number.parseInt(getComputedStyle(next).zIndex, 10) || 0;
      if (menuZ <= viewerZ) {
        if (!raised.has(next)) raised.set(next, next.style.zIndex);
        next.style.zIndex = String(viewerZ + 1);
      }
      return next;
    };
    const focusInside = (target, last = false, reset = false) => {
      const items = itemsIn(target);
      const preferred = !reset && target === root && visible(lastRootFocus) && root.contains(lastRootFocus) ? lastRootFocus : null;
      const element = last ? items.at(-1) : preferred || items[0];
      if (!element && !target.hasAttribute('tabindex')) target.tabIndex = -1;
      (element || target).focus({ preventScroll: true });
    };
    const ensureFocus = () => {
      const target = scope();
      if (target && !target.contains(document.activeElement)) focusInside(target);
    };
    const onFocus = (event) => {
      if (root.contains(event.target)) lastRootFocus = event.target;
      const target = scope();
      if (target && !target.contains(event.target)) focusInside(target);
    };
    const onKey = (event) => {
      if (event.key !== 'Tab' || event.defaultPrevented) return;
      const target = scope();
      if (!target) return;
      const items = itemsIn(target);
      const current = document.activeElement;
      if (!items.length || !target.contains(current) || (event.shiftKey ? current === items[0] : current === items.at(-1))) {
        event.preventDefault();
        focusInside(target, event.shiftKey, true);
      }
    };
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('keydown', onKey, true);
    const observer = new MutationObserver(ensureFocus);
    observer.observe(document.body, { childList: true, subtree: true });
    ensureFocus();
    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', onFocus, true);
      document.removeEventListener('keydown', onKey, true);
      raised.forEach((zIndex, element) => { element.style.zIndex = zIndex; });
      if (previous?.isConnected) previous.focus?.({ preventScroll: true });
    };
  }, [rootRef, initialFocusRef, active]);
}
