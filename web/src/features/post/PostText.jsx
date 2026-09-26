import { useState } from 'preact/hooks';
import { t } from '../../lib/i18n.js';

const TOKEN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|(#[\p{L}\p{N}_]{2,50})|(@[a-z0-9_.]{3,24})/giu;

/** Plain text with links, #hashtags and @mentions turned into anchors. */
export function RichText({ text }) {
  const parts = [];
  let last = 0;
  String(text || '').replace(TOKEN, (m, url, tag, mention, offset) => {
    if (offset > last) parts.push(text.slice(last, offset));
    if (url) parts.push(<a key={offset} href={url} target="_blank" rel="noopener noreferrer nofollow ugc" class="link">{url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}{url.length > 60 ? '…' : ''}</a>);
    else if (tag) parts.push(<a key={offset} href={`/search?q=${encodeURIComponent(tag)}`} class="link">{tag}</a>);
    else parts.push(<a key={offset} href={`/u/${mention.slice(1)}`} class="link">{mention}</a>);
    last = offset + m.length;
    return m;
  });
  if (last < String(text || '').length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Post body with "see more" after ~400 characters or 7 lines. */
export function PostText({ text, big, limit = 400 }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const lines = text.split('\n');
  const long = text.length > limit || lines.length > 7;
  const shown = !long || open ? text : (lines.length > 7 ? lines.slice(0, 6).join('\n') : text.slice(0, limit).replace(/\s+\S*$/, ''));
  return (
    <div class={`post-text${big ? ' is-big' : ''}`}>
      <RichText text={shown} />
      {long && !open && <>… <button type="button" class="see-more" onClick={() => setOpen(true)}>{t('common.seeMore')}</button></>}
    </div>
  );
}
