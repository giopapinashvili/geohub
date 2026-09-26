import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { signal } from '@preact/signals';

/**
 * Subscribe to a live source while the component is mounted.
 * `subscribe(onData, onError)` must return an unsubscribe function; it is
 * always called on unmount or when `deps` change — the old site leaked
 * listeners, this hook makes that impossible.
 */
export function useLive(subscribe, deps) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
  useEffect(() => {
    if (!subscribe) { setState({ data: undefined, loading: false, error: null }); return undefined; }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    let unsub;
    try {
      unsub = subscribe(
        (data) => alive && setState({ data, loading: false, error: null }),
        (error) => alive && setState({ data: undefined, loading: false, error }),
      );
    } catch (error) {
      setState({ data: undefined, loading: false, error });
    }
    return () => { alive = false; if (typeof unsub === 'function') unsub(); };
  }, deps);
  return state;
}

/** Run an async loader when deps change; stale results are discarded. */
export function useAsync(load, deps) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!load) { setState({ data: undefined, loading: false, error: null }); return undefined; }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(load)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => {
        if (!alive) return;
        console.warn('[useAsync]', error);
        setState({ data: undefined, loading: false, error });
      });
    return () => { alive = false; };
  }, [...deps, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload, setData: (data) => setState((s) => ({ ...s, data })) };
}

/* ── Breakpoints ───────────────────────────────────────────── */
// sm < 768 ≤ md < 1024 ≤ lg < 1280 ≤ xl
function currentBp() {
  const w = typeof window === 'undefined' ? 1280 : window.innerWidth;
  return w < 768 ? 'sm' : w < 1024 ? 'md' : w < 1280 ? 'lg' : 'xl';
}
export const bp = signal(currentBp());
if (typeof window !== 'undefined') {
  let raf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { const b = currentBp(); if (b !== bp.value) bp.value = b; });
  });
}
/** Desktop shell (header + side columns) from 1024px up. */
export const isDesktop = () => bp.value === 'lg' || bp.value === 'xl';

/* ── Small DOM helpers ─────────────────────────────────────── */
export function useClickOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onOutside(e); };
    document.addEventListener('pointerdown', h, true);
    return () => document.removeEventListener('pointerdown', h, true);
  }, [active, onOutside]);
}

export function useEscape(onEscape, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const h = (e) => { if (e.key === 'Escape') onEscape(e); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [active, onEscape]);
}

let lockCount = 0;
export function useBodyLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    if (lockCount++ === 0) {
      const sw = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (sw > 0) document.body.style.paddingRight = sw + 'px';
    }
    return () => {
      if (--lockCount === 0) { document.body.style.overflow = ''; document.body.style.paddingRight = ''; }
    };
  }, [active]);
}

/** Calls `onVisible` when the sentinel element scrolls into view. */
export function useInView(onVisible, { rootMargin = '600px', enabled = true } = {}) {
  const ref = useRef(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    if (!enabled || !ref.current) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) cb.current();
    }, { rootMargin });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [enabled, rootMargin]);
  return ref;
}

export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

/** Current page title; store.js composes it with the unread badge. */
export const pageTitle = signal('');
export function useTitle(title) {
  useEffect(() => { pageTitle.value = title || ''; }, [title]);
}
