import { useEffect, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { Confirm } from '../ui/Modal.jsx';
import { Card, Empty, Img, PageSpinner } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle, useAsync } from '../lib/hooks.js';
import { formatPrice, timeAgo } from '../lib/format.js';
import { navigate } from '../lib/router.js';
import { uid, isAdmin } from '../lib/auth.js';
import { requireLogin } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { cityLabel } from '../lib/geo.js';
import { getItem, setItemStatus, deleteItem } from '../data/market.js';
import { isSaved, setSaved } from '../data/posts.js';
import { report } from '../data/social.js';
import { useUser } from '../features/user/useUser.js';
import { Lightbox } from '../features/post/Lightbox.jsx';
import { copyLink } from '../features/post/ShareDialog.jsx';

/** Listing page: photos, price, seller, message, save; owner can mark sold or delete. */
export default function MarketItem({ params }) {
  const { data: item, loading, setData } = useAsync(() => getItem(params.id), [params.id]);
  const seller = useUser(item?.sellerId);
  const [i, setI] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [saved, setSavedState] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useTitle(item?.title || t('nav.marketplace'));
  useEffect(() => { if (uid.value) isSaved('item', params.id).then(setSavedState); }, [params.id, uid.value]);
  if (loading) return <PageSpinner />;
  if (!item || item.status === 'deleted') return <Card><Empty icon="tag" title={t('market.notFound')} action={<Button variant="primary" href="/marketplace">{t('nav.marketplace')}</Button>} /></Card>;
  const own = item.sellerId === uid.value;
  const toggleSave = async () => {
    if (!requireLogin('save')) return;
    try { await setSaved('item', item.id, !saved, { title: item.title, image: item.images[0] || '' }); setSavedState(!saved); toast(t(saved ? 'saved.removed' : 'saved.added')); } catch { toast.error(t('common.error')); }
  };
  return (
    <div class="market-item">
      <Card class="market-gallery" pad={false}>
        <button type="button" class="market-main-img" onClick={() => item.images.length && setLightbox(true)}>
          <Img src={item.images[i]} width={1000} alt="" eager />
          {item.status === 'sold' && <span class="item-sold">{t('market.sold')}</span>}
        </button>
        {item.images.length > 1 && <div class="market-thumbs">{item.images.map((src, j) => <button key={src} type="button" class={j === i ? 'is-active' : ''} onClick={() => setI(j)}><Img src={src} width={120} alt="" /></button>)}</div>}
      </Card>
      <div class="market-side">
        <Card>
          <span class="tag tag-neutral">{t(`market.cat.${item.category}`)}{item.condition ? ` · ${t(item.condition === 'new' ? 'market.new_' : 'market.used')}` : ''}</span>
          <h1 class="market-title">{item.title}</h1>
          <p class="market-price">{item.price ? formatPrice(item.price, item.currency) : t(item.category === 'job' ? 'market.negotiable' : 'common.free')}</p>
          <p class="muted small">{[cityLabel(item.city), timeAgo(item.createdAt)].filter(Boolean).join(' · ')}</p>
          <div class="market-actions">
            {own ? (
              <>
                <Button variant="primary" icon={item.status === 'sold' ? 'arrow-clockwise' : 'check-circle'} onClick={() => { const s = item.status === 'sold' ? 'active' : 'sold'; setItemStatus(item.id, s).then(() => setData({ ...item, status: s })).catch(() => toast.error(t('common.error'))); }}>{t(item.status === 'sold' ? 'market.relist' : 'market.markSold')}</Button>
                <Button variant="secondary" icon="trash" onClick={() => setConfirm(true)}>{t('common.delete')}</Button>
              </>
            ) : (
              <Button variant="primary" icon="chat-circle-dots" block onClick={() => { if (requireLogin('message')) navigate(`/messages?with=${item.sellerId}`); }}>{t('market.messageSeller')}</Button>
            )}
            <Button variant={saved ? 'soft' : 'secondary'} icon={saved ? 'bookmark-simple-fill' : 'bookmark-simple'} onClick={toggleSave}>{t(saved ? 'common.saved' : 'post.save')}</Button>
            <Button variant="secondary" icon="share-fat" onClick={() => copyLink(`${location.origin}/marketplace/${item.id}`)}>{t('common.share')}</Button>
            {!own && <Button variant="ghost" icon="flag" onClick={() => { if (requireLogin('report')) report('marketplace', item.id, 'inappropriate').finally(() => toast(t('report.sent'))); }}>{t('common.report')}</Button>}
            {isAdmin.value && !own && <Button variant="ghost" icon="trash" onClick={() => setConfirm(true)}>{t('common.delete')}</Button>}
          </div>
        </Card>
        <Card>
          <h2 class="card-title">{t('market.details')}</h2>
          <p class="place-desc">{item.description || t('place.noDescription')}</p>
        </Card>
        <Card>
          <h2 class="card-title" style={{ marginBottom: 10 }}>{t('market.seller')}</h2>
          <a href={`/u/${item.sellerId}`} class="visitor"><Avatar src={seller?.avatar || item.sellerAvatar} name={seller?.name || item.sellerName} size={48} /><span class="grow bold">{seller?.name || item.sellerName}</span></a>
        </Card>
      </div>
      {lightbox && <Lightbox media={item.images} index={i} onClose={() => setLightbox(false)} />}
      <Confirm open={confirm} danger title={t('market.deleteTitle')} confirmLabel={t('common.delete')} onClose={() => setConfirm(false)}
        onConfirm={() => deleteItem(item.id).then(() => { toast(t('market.deleted')); navigate('/marketplace'); }).catch(() => toast.error(t('common.error')))} />
    </div>
  );
}
