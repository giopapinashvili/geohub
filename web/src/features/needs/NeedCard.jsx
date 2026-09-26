import { Avatar } from '../../ui/Avatar.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { t, tn, formatNumber } from '../../lib/i18n.js';
import { timeAgo } from '../../lib/format.js';
import { cityLabel } from '../../lib/geo.js';
import { uid } from '../../lib/auth.js';
import { navigate } from '../../lib/router.js';
import { requireLogin } from '../../lib/store.js';
import { toast } from '../../lib/toast.js';
import { NEED_CATS, needOf, closeNeed } from '../../data/needs.js';

/** One request on the board: what, where, when, budget, and ways to answer. */
export function NeedCard({ post, onClosed, compact }) {
  const n = needOf(post);
  const cat = NEED_CATS.find((c) => c.id === n.category) || NEED_CATS[NEED_CATS.length - 1];
  const own = post.authorId === uid.value;
  return (
    <article class={`need-card${compact ? ' is-compact' : ''}`} style={{ '--tone': cat.tone }}>
      <div class="need-card-top">
        <span class="need-card-ico"><Icon name={cat.icon} size={20} /></span>
        <span class="need-card-cat">{t(`needs.cat.${cat.id}`)}</span>
        <span class="muted xs">{timeAgo(post.createdAt)}</span>
      </div>
      <a href={`/post/${post.id}`} class="need-card-text">{post.text}</a>
      <div class="need-card-meta">
        {n.city && <span><Icon name="map-pin" size={14} />{cityLabel(n.city)}</span>}
        {n.when && <span><Icon name="clock" size={14} />{t(`needs.when.${n.when}`)}</span>}
        {n.budget > 0 && <span class="need-budget"><Icon name="coins" size={14} />{formatNumber(n.budget)} ₾</span>}
      </div>
      <div class="need-card-foot">
        <Avatar src={post.authorAvatar} name={post.authorName} size={28} href={`/u/${post.authorId}`} />
        <span class="grow small ellipsis">{post.authorName}</span>
        <span class="muted xs">{tn('needs.offers', post.commentCount)}</span>
      </div>
      {!compact && (
        <div class="need-card-actions">
          {own ? (
            <>
              <Button size="sm" variant="secondary" href={`/post/${post.id}`}>{t('needs.seeOffers')}</Button>
              <Button size="sm" variant="ghost" icon="check" onClick={() => closeNeed(post.id).then(() => { toast.success(t('needs.closed')); onClosed?.(post.id); }).catch(() => toast.error(t('common.error')))}>{t('needs.resolved')}</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="primary" icon="hand-waving" href={`/post/${post.id}`}>{t('needs.offer')}</Button>
              <Button size="sm" variant="secondary" icon="chat-circle-dots" onClick={() => { if (requireLogin('message')) navigate(`/messages?with=${post.authorId}`); }}>{t('profile.message')}</Button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
