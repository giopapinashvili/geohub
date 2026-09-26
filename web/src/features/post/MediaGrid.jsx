import { useState } from 'preact/hooks';
import { Img } from '../../ui/misc.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { isVideoUrl } from '../../data/normalize.js';
import { img, videoPoster } from '../../lib/media.js';
import { Lightbox } from './Lightbox.jsx';
import { t } from '../../lib/i18n.js';

export function VideoPlayer({ src, poster, class: cls = '' }) {
  return (
    <video class={`post-video ${cls}`} src={img(src, 720)} poster={poster || videoPoster(src) || undefined} controls preload="metadata" playsInline>
      <track kind="captions" />
    </video>
  );
}

/** Facebook-style layouts for 1, 2, 3 and 4+ attachments. */
export function MediaGrid({ media, mediaType, alt = '' }) {
  const [open, setOpen] = useState(-1);
  if (!media?.length) return null;
  const items = media.slice(0, 4);
  const extra = media.length - 4;
  if (media.length === 1 && isVideoUrl(media[0], mediaType)) {
    return <div class="media-grid media-1"><VideoPlayer src={media[0]} /></div>;
  }
  return (
    <>
      <div class={`media-grid media-${Math.min(media.length, 4)}`}>
        {items.map((url, i) => (
          <button key={url + i} type="button" class="media-cell" onClick={() => setOpen(i)} aria-label={`${t('common.photo')} ${i + 1}/${media.length}`}>
            {isVideoUrl(url) ? (
              <>
                <Img src={videoPoster(url)} width={600} alt="" />
                <span class="media-play"><Icon name="play-circle-fill" size={56} /></span>
              </>
            ) : (
              <Img src={url} width={media.length === 1 ? 900 : 480} alt={alt} class={media.length === 1 ? 'media-single' : ''} />
            )}
            {i === 3 && extra > 0 && <span class="media-more">+{extra}</span>}
          </button>
        ))}
      </div>
      {open >= 0 && <Lightbox media={media} index={open} onClose={() => setOpen(-1)} />}
    </>
  );
}
