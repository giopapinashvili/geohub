import { SECTIONS } from './nav.js';
import { Icon } from '../ui/Icon.jsx';
import { t } from '../lib/i18n.js';

const RAIL = ['home', 'explore', 'business', 'marketplace', 'map', 'events', 'groups', 'video'];

/** Slim desktop rail: icon plus a short label; everything else lives under "more". */
export function LeftNav({ active }) {
  const items = RAIL.map((k) => SECTIONS.find((s) => s.key === k)).filter(Boolean);
  const inRail = RAIL.includes(active);
  return (
    <aside class="leftnav" aria-label={t('nav.sections')}>
      <nav class="rail">
        {items.map((s) => (
          <a key={s.key} href={s.href} class={`rail-item${active === s.key ? ' is-active' : ''}`} aria-current={active === s.key ? 'page' : undefined}>
            <span class="rail-icon"><Icon name={active === s.key && s.key !== 'business' && s.key !== 'video' ? `${s.icon}-fill` : s.icon} size={24} /></span>
            <span class="rail-label">{t(s.label)}</span>
          </a>
        ))}
        <a href="/menu" class={`rail-item${!inRail && active && active !== 'profile' ? ' is-active' : ''}`}>
          <span class="rail-icon"><Icon name="squares-four" size={24} /></span>
          <span class="rail-label">{t('nav.more')}</span>
        </a>
      </nav>
    </aside>
  );
}
