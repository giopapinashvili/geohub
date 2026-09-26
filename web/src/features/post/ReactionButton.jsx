import { useRef, useState } from 'preact/hooks';
import { Icon } from '../../ui/Icon.jsx';
import { REACTIONS, REACTION_EMOJI } from '../../data/posts.js';
import { t } from '../../lib/i18n.js';

const LABEL = { like: 'react.like', love: 'react.love', haha: 'react.haha', wow: 'react.wow', sad: 'react.sad', angry: 'react.angry', clap: 'react.like' };

/**
 * Like button with a reaction picker: hover (desktop) or long-press
 * (touch) opens it; a plain click toggles 👍 or clears the current one.
 */
export function ReactionButton({ value, onChange, compact }) {
  const [picker, setPicker] = useState(false);
  const hoverTimer = useRef(0);
  const pressTimer = useRef(0);
  const longPressed = useRef(false);

  const open = () => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setPicker(true), 450); };
  const close = () => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setPicker(false), 300); };
  const pick = (type) => { setPicker(false); onChange(type === value ? '' : type); };

  return (
    <div class="react-wrap" onMouseEnter={open} onMouseLeave={close}>
      {picker && (
        <div class="react-picker" role="menu" aria-label={t('react.pick')} onMouseEnter={() => clearTimeout(hoverTimer.current)}>
          {REACTIONS.map((r, i) => (
            <button key={r.type} type="button" role="menuitem" class={`react-emoji${value === r.type ? ' is-active' : ''}`} style={{ animationDelay: `${i * 25}ms` }}
              aria-label={t(LABEL[r.type])} title={t(LABEL[r.type])} onClick={() => pick(r.type)}>
              {r.emoji}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        class={`post-action${value ? ` is-reacted react-${value}` : ''}${compact ? ' is-compact' : ''}`}
        aria-pressed={value ? 'true' : 'false'}
        onClick={() => { if (longPressed.current) { longPressed.current = false; return; } onChange(value ? '' : 'like'); }}
        onTouchStart={() => { longPressed.current = false; pressTimer.current = setTimeout(() => { longPressed.current = true; setPicker(true); navigator.vibrate?.(10); }, 420); }}
        onTouchEnd={() => clearTimeout(pressTimer.current)}
        onTouchMove={() => clearTimeout(pressTimer.current)}
        onContextMenu={(e) => { if (longPressed.current) e.preventDefault(); }}
        onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); setPicker(true); } if (e.key === 'Escape') setPicker(false); }}
      >
        {value ? <span class="react-current" aria-hidden="true">{REACTION_EMOJI[value] || '👍'}</span> : <Icon name="thumbs-up" size={20} />}
        <span>{t(value ? LABEL[value] : 'react.like')}</span>
      </button>
    </div>
  );
}
