import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { IconButton } from '../../ui/Button.jsx';
import { useBodyLock } from '../../lib/hooks.js';
import { isTopmostModal, useModalFocus } from '../../lib/modalFocus.js';
import { isVideoUrl } from '../../data/normalize.js';
import { img } from '../../lib/media.js';
import { t } from '../../lib/i18n.js';

/** Full-screen media viewer: arrows, swipe, Escape. */
export function Lightbox({ media, index = 0, onClose }) {
  const [i, setI] = useState(index);
  const touch = useRef(null);
  const viewerRef = useRef(null);
  const closeRef = useRef(null);
  useBodyLock(true);
  useModalFocus(viewerRef, closeRef);
  const prev = () => setI((x) => (x - 1 + media.length) % media.length);
  const next = () => setI((x) => (x + 1) % media.length);
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || !isTopmostModal(viewerRef.current)) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (!document.activeElement?.closest('input, textarea, select, video, audio, [contenteditable="true"]')) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [media.length]);
  const url = media[i];
  return createPortal(
    <div ref={viewerRef} tabIndex={-1} class="lightbox" role="dialog" aria-modal="true" aria-label={t('common.photo')}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) (dx > 0 ? prev : next)();
        touch.current = null;
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <IconButton ref={closeRef} icon="x" label={t('common.close')} class="lightbox-close" variant="onmedia" size={44} onClick={onClose} />
      {media.length > 1 && <IconButton icon="caret-left" label={t('common.back')} class="lightbox-prev" variant="onmedia" size={48} onClick={prev} />}
      {isVideoUrl(url)
        ? <video class="lightbox-media" src={url} controls autoPlay playsInline />
        : <img class="lightbox-media" src={img(url, 1800)} alt="" referrerpolicy="no-referrer" />}
      {media.length > 1 && <IconButton icon="caret-right" label={t('common.next')} class="lightbox-next" variant="onmedia" size={48} onClick={next} />}
      {media.length > 1 && <div class="lightbox-count">{i + 1} / {media.length}</div>}
    </div>,
    document.body,
  );
}
