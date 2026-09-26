import { useEffect, useRef } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { formatCount } from '../lib/i18n.js';

/**
 * Horizontal tabs. Pass `href` on items for link tabs (navigation), or
 * `onChange` for in-page tabs. Scrolls the active tab into view on phones.
 */
export function Tabs({ items, value, onChange, label, variant = 'line', sticky, class: cls = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current?.querySelector('.is-active');
    if (el && ref.current.scrollWidth > ref.current.clientWidth) {
      el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }, [value]);
  return (
    <div class={`tabs tabs-${variant}${sticky ? ' tabs-sticky' : ''} ${cls}`}>
      <div ref={ref} class="tabs-scroll" role={onChange ? 'tablist' : undefined} aria-label={label}>
        {items.filter((i) => !i.hidden).map((it) => {
          const active = it.value === value;
          const inner = (
            <>
              {it.icon && <Icon name={active && it.iconActive ? it.iconActive : it.icon} size={18} />}
              <span>{it.label}</span>
              {it.count ? <span class="tab-count">{formatCount(it.count)}</span> : null}
            </>
          );
          return it.href ? (
            <a key={it.value} href={it.href} class={`tab${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>{inner}</a>
          ) : (
            <button
              key={it.value}
              type="button"
              role="tab"
              aria-selected={active ? 'true' : 'false'}
              class={`tab${active ? ' is-active' : ''}`}
              onClick={() => onChange(it.value)}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}
