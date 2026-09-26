import { Img, Verified } from '../../ui/misc.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { t, tn, formatCount } from '../../lib/i18n.js';
import { cityLabel } from '../../lib/geo.js';
import { bizCategory, bizCategoryLabel } from './categories.js';
import { openState } from './hours.js';

export function OpenBadge({ hours }) {
  const s = openState(hours);
  if (!s) return null;
  return <span class={`tag ${s.open ? 'tag-success' : 'tag-neutral'}`}>{s.open ? t('biz.openNow') : t('biz.closedNow')}</span>;
}

/** Directory tile: cover, logo, name, category, city, rating, followers. */
export function BizCard({ biz, action }) {
  const cat = bizCategory(biz.category);
  const where = biz.isOnline ? t('biz.online') : cityLabel(biz.city);
  return (
    <article class="card biz-card">
      <a href={`/business/${biz.id}`} class="biz-card-cover" tabIndex={-1} aria-hidden="true">
        <Img src={biz.cover} width={600} alt="" fallback={<span class="biz-card-cover-fallback">{cat?.emoji || '🏪'}</span>} />
      </a>
      <div class="biz-card-body">
        <Avatar src={biz.logo} name={biz.name} size={56} square class="biz-card-logo" />
        <a href={`/business/${biz.id}`} class="biz-card-name">{biz.name}{biz.verified && <Verified size={15} />}</a>
        <span class="muted small ellipsis">{[bizCategoryLabel(biz.category), where].filter(Boolean).join(' · ')}</span>
        <span class="row gap-8 small wrap biz-card-stats">
          {biz.rating > 0 && <span class="place-rating"><Icon name="star-fill" size={14} />{biz.rating.toFixed(1).replace('.', ',')}<span class="muted">({formatCount(biz.reviewCount)})</span></span>}
          <span class="muted">{tn('biz.followers', biz.followerCount)}</span>
          <OpenBadge hours={biz.workingHours} />
        </span>
        {action && <div class="biz-card-action">{action}</div>}
      </div>
    </article>
  );
}
