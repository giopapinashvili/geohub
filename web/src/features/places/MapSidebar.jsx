import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../lib/i18n.js';
import '../../styles/map-sidebar.css';

const STORAGE_KEY = 'gh.map.sidebar.v1';
const MIN_WIDTH = 320;
const MAX_WIDTH = 760;
const MAP_SPACE = 360;
const COLLAPSE_AT = 120;
const clamp = (width, max) => Math.max(MIN_WIDTH, Math.min(max, Math.round(width)));

function loadPreference() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { width: Number.isFinite(saved?.width) ? clamp(saved.width, MAX_WIDTH) : null, collapsed: saved?.collapsed === true };
  } catch { return { width: null, collapsed: false }; }
}

/** Keep desktop sizing independent from map selection and mounted panel content. */
export function useMapSidebar(pageRef, desktop, expanded) {
  const [preference, setPreference] = useState(loadPreference);
  const [available, setAvailable] = useState(window.innerWidth);
  const [resizing, setResizing] = useState(false);
  const drag = useRef(null);
  const ignoreClick = useRef(false);
  const handleRef = useRef(null);
  const max = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, available - MAP_SPACE));
  const defaultWidth = expanded ? Math.max(400, Math.min(470, available * 0.35)) : 380;
  const width = clamp(preference.width ?? defaultWidth, max);
  const collapsed = preference.collapsed;
  const current = useRef(null);
  current.current = { preference, width, max, collapsed };

  const show = useCallback(() => setPreference((value) => ({ ...value, collapsed: false })), []);
  const toggle = () => setPreference((value) => ({ width: current.current.width, collapsed: !value.collapsed }));
  const setWidth = (value) => setPreference({ width: clamp(value, current.current.max), collapsed: false });

  useEffect(() => {
    if (!desktop || !pageRef.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(pageRef.current);
    return () => observer.disconnect();
  }, [desktop]);

  useEffect(() => {
    if (drag.current) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preference)); } catch { /* Storage can be disabled. */ }
  }, [preference, resizing]);

  useEffect(() => {
    if (!resizing) return undefined;
    document.documentElement.classList.add('is-map-sidebar-resizing');
    return () => document.documentElement.classList.remove('is-map-sidebar-resizing');
  }, [resizing]);

  const finish = (event, cancelled = false) => {
    const gesture = drag.current;
    if (!gesture || (event?.pointerId != null && gesture.pointerId !== event.pointerId)) return;
    drag.current = null;
    if (cancelled) setPreference(gesture.preference);
    if (gesture.moved) ignoreClick.current = true;
    setResizing(false);
    if (gesture.element.hasPointerCapture(gesture.pointerId)) gesture.element.releasePointerCapture(gesture.pointerId);
  };

  useEffect(() => {
    if (!desktop) finish(null, true);
    const cancel = () => finish(null, true);
    const onKey = (event) => {
      if (event.key === 'Escape' && drag.current) { event.preventDefault(); cancel(); }
    };
    window.addEventListener('blur', cancel);
    document.addEventListener('keydown', onKey, true);
    return () => { cancel(); window.removeEventListener('blur', cancel); document.removeEventListener('keydown', onKey, true); };
  }, [desktop]);

  const onPointerDown = (event) => {
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    event.preventDefault();
    event.stopPropagation();
    ignoreClick.current = false;
    const element = event.currentTarget;
    element.focus({ preventScroll: true });
    drag.current = { element, pointerId: event.pointerId, startX: event.clientX, startWidth: collapsed ? 0 : width, restoreWidth: width, preference, moved: false };
    element.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const delta = event.clientX - gesture.startX;
    if (!gesture.moved && Math.abs(delta) < 5) return;
    if (!gesture.moved) { gesture.moved = true; setResizing(true); }
    const next = gesture.startWidth + delta;
    if (next <= COLLAPSE_AT) setPreference({ width: gesture.restoreWidth, collapsed: true });
    else setWidth(next);
  };
  const onClick = (event) => {
    event.stopPropagation();
    if (ignoreClick.current) { ignoreClick.current = false; return; }
    toggle();
  };
  const onKeyDown = (event) => {
    const step = event.shiftKey ? 80 : 24;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'ArrowLeft') {
      if (!collapsed && width <= MIN_WIDTH) setPreference({ width, collapsed: true });
      else if (!collapsed) setWidth(width - step);
    } else if (event.key === 'ArrowRight') setWidth(collapsed ? width : width + step);
    else if (event.key === 'Home') setPreference({ width, collapsed: true });
    else if (event.key === 'End') setWidth(max);
    else if (event.key === 'Enter' && !event.repeat) toggle();
  };
  const onKeyUp = (event) => {
    if (event.key === ' ') { event.preventDefault(); event.stopPropagation(); toggle(); }
  };

  return {
    width, collapsed, resizing, show,
    handleProps: {
      ref: handleRef, onPointerDown, onPointerMove, onPointerUp: (event) => finish(event),
      onPointerCancel: (event) => finish(event, true), onLostPointerCapture: (event) => finish(event, true),
      onClick, onKeyDown, onKeyUp,
      'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': collapsed ? 0 : width,
      'aria-valuetext': collapsed ? t('map.sidebarCollapsed') : t('map.sidebarWidth', { n: width }),
    },
  };
}

export function MapSidebarHandle({ sidebar }) {
  return (
    <div class="map-sidebar-resizer" role="separator" tabIndex={0} aria-orientation="vertical"
      data-testid="map-sidebar-resizer" aria-controls="map-sidebar-content" aria-label={t('map.sidebarSize')}
      aria-describedby="map-sidebar-help" title={t(sidebar.collapsed ? 'map.sidebarShow' : 'map.sidebarHandleHint')} {...sidebar.handleProps}>
      <span class="map-sidebar-handle" aria-hidden="true">
        <span class="map-sidebar-grip"><i /><i /><i /></span>
      </span>
      <span id="map-sidebar-help" class="sr-only">{t('map.sidebarKeyboardHint')}</span>
    </div>
  );
}
