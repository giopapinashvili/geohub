import { useState } from 'preact/hooks';
import { initials } from '../lib/format.js';
import { img } from '../lib/media.js';

const TONES = ['#c2305a', '#b8621b', '#1f7a6d', '#6b4fa0', '#8a5a2b', '#2f6f9f', '#7a8b2e', '#a33f86'];
function toneFor(key) {
  let h = 0;
  for (const c of String(key || '')) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

// ui-avatars.com images are generated placeholders from the old site; the
// local initials look better in both themes and cost no request.
function usable(src) {
  return src && typeof src === 'string' && !src.includes('ui-avatars.com') && !src.startsWith('data:image/svg');
}

/**
 * ring: 'story' (unseen stories gradient) | 'seen' | undefined
 * status: 'online' shows a presence dot.
 */
export function Avatar({ src, name = '', size = 40, ring, status, href, class: cls = '', square }) {
  const [broken, setBroken] = useState(false);
  const show = usable(src) && !broken;
  const face = (
    <span
      class={`avatar${square ? ' avatar-square' : ''}${ring ? ` avatar-ring avatar-ring-${ring}` : ''} ${cls}`}
      style={{ width: size, height: size, '--av-tone': toneFor(name), fontSize: Math.max(11, Math.round(size * 0.38)) }}
    >
      {show
        ? <img src={img(src, size)} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onError={() => setBroken(true)} />
        : <span class="avatar-initials" aria-hidden="true">{initials(name)}</span>}
      {status === 'online' && <span class="avatar-status" aria-hidden="true" />}
    </span>
  );
  if (href) return <a href={href} class="avatar-link" aria-label={name}>{face}</a>;
  return face;
}
