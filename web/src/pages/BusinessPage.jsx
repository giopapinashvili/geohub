import { useEffect, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Button, IconButton } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Menu } from '../ui/Menu.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { Modal } from '../ui/Modal.jsx';
import { TextField, TextArea } from '../ui/Field.jsx';
import { Card, Empty, Img, PageSpinner, Spinner, Verified } from '../ui/misc.jsx';
import { t, tn, formatCount } from '../lib/i18n.js';
import { useTitle, useLive, useAsync } from '../lib/hooks.js';
import { timeAgo, formatDate } from '../lib/format.js';
import { query, setQuery, navigate } from '../lib/router.js';
import { uid, profile, authUser } from '../lib/auth.js';
import { requireLogin, openComposer } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { cityLabel } from '../lib/geo.js';
import {
  listenBusiness, canManageBusiness, isFollowingBusiness, setFollowBusiness, listenBusinessReviews, addBusinessReview,
  deleteBusinessReview, listServices, listGallery, listOffers, sendQuoteRequest, trackBusiness,
} from '../data/business.js';
import { listenTargetPosts, isSaved, setSaved } from '../data/posts.js';
import { report } from '../data/social.js';
import { bizCategory, bizCategoryLabel } from '../features/business/categories.js';
import { readHours, openState, dayLabel } from '../features/business/hours.js';
import { OpenBadge } from '../features/business/BizCard.jsx';
import { Stars, StarInput } from '../features/places/Stars.jsx';
import { PostCard } from '../features/post/PostCard.jsx';
import { Lightbox } from '../features/post/Lightbox.jsx';
import { copyLink } from '../features/post/ShareDialog.jsx';

const ext = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
const igUrl = (v) => (/^https?:/i.test(v) ? v : `https://instagram.com/${v.replace(/^@/, '')}`);
const fbUrl = (v) => (/^https?:/i.test(v) ? v : `https://facebook.com/${v}`);
const waUrl = (v) => `https://wa.me/${v.replace(/[^\d]/g, '')}`;

function QuoteDialog({ biz, services, onClose }) {
  const p = profile.value;
  const [name, setName] = useState(p?.name || '');
  const [email, setEmail] = useState(authUser.value?.email || '');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = name.trim() && /\S+@\S+\.\S+/.test(email) && message.trim().length >= 5;
  const send = async () => {
    setBusy(true);
    try { await sendQuoteRequest(biz, { name, email, phone, message, service }); toast.success(t('biz.quoteSent')); onClose(); }
    catch { toast.error(t('common.error')); }
    setBusy(false);
  };
  return (
    <Modal open onClose={onClose} title={t('biz.requestQuote')} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" icon="paper-plane-right" disabled={!valid} loading={busy} onClick={send}>{t('common.send')}</Button></>}>
      <div class="stack">
        <p class="muted small">{t('biz.quoteHint', { name: biz.name })}</p>
        <div class="form-2">
          <TextField label={t('biz.yourName')} value={name} onInput={(e) => setName(e.currentTarget.value)} maxLength={80} />
          <TextField label={t('biz.phone')} optional={t('common.optional')} type="tel" value={phone} onInput={(e) => setPhone(e.currentTarget.value)} maxLength={30} />
        </div>
        <TextField label={t('biz.email')} type="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} maxLength={80} />
        {services.length > 0 && (
          <div class="chip-row">{services.map((s) => <button key={s.id} type="button" class={`chip${service === s.title ? ' is-active' : ''}`} onClick={() => setService(service === s.title ? '' : s.title)}>{s.title}</button>)}</div>
        )}
        <TextArea label={t('biz.message')} value={message} onInput={(e) => setMessage(e.currentTarget.value)} maxLength={1500} minRows={4} placeholder={t('biz.messagePh')} />
      </div>
    </Modal>
  );
}

function Hours({ raw }) {
  const rows = readHours(raw);
  if (!rows) return null;
  const today = (new Date().getDay() + 6) % 7;
  const st = openState(raw);
  return (
    <div class="biz-hours">
      <div class="row gap-8"><Icon name="clock" size={18} class="muted" /><strong>{t('biz.hours')}</strong>
        {st && <span class={`tag ${st.open ? 'tag-success' : 'tag-neutral'}`}>{st.open ? `${t('biz.openNow')}${st.until ? ` · ${t('biz.until', { time: st.until })}` : ''}` : t('biz.closedNow')}</span>}
      </div>
      <table class="biz-hours-table">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} class={i === today ? 'is-today' : ''}>
              <th scope="row">{dayLabel(i)}</th>
              <td>{r.closed ? <span class="muted">{t('biz.closedDay')}</span> : `${r.open} – ${r.close}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Contact({ biz }) {
  const items = [
    biz.phone && { icon: 'phone', label: biz.phone, href: `tel:${biz.phone.replace(/\s/g, '')}`, track: 'calls' },
    biz.email && { icon: 'envelope-simple', label: biz.email, href: `mailto:${biz.email}` },
    biz.website && { icon: 'globe-simple', label: biz.website.replace(/^https?:\/\//, ''), href: ext(biz.website), ext: true, track: 'clicks' },
    !biz.isOnline && (biz.address || biz.city) && { icon: 'map-pin', label: biz.address && cityLabel(biz.city) && biz.address.includes(cityLabel(biz.city)) ? biz.address : [biz.address, cityLabel(biz.city)].filter(Boolean).join(', '), href: biz.raw?.mapsLink || (biz.lat ? `https://www.google.com/maps/dir/?api=1&destination=${biz.lat},${biz.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${biz.address} ${biz.city}`)}`), ext: true, track: 'directions' },
    biz.socialLinks.instagram && { icon: 'instagram-logo', label: 'Instagram', href: igUrl(biz.socialLinks.instagram), ext: true },
    biz.socialLinks.facebook && { icon: 'facebook-logo', label: 'Facebook', href: fbUrl(biz.socialLinks.facebook), ext: true },
    biz.socialLinks.whatsapp && { icon: 'whatsapp-logo', label: 'WhatsApp', href: waUrl(biz.socialLinks.whatsapp), ext: true },
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <ul class="biz-contact">
      {items.map((it) => (
        <li key={it.icon + it.label}>
          <a href={it.href} target={it.ext ? '_blank' : undefined} rel={it.ext ? 'noopener' : undefined} data-native onClick={() => it.track && trackBusiness(biz.id, it.track)}>
            <span class="biz-contact-ico"><Icon name={it.icon} size={18} /></span><span class="ellipsis">{it.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function Reviews({ biz, manage, compact }) {
  const [list, setList] = useState(null);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => listenBusinessReviews(biz.id, setList), [biz.id]);
  const mine = list?.find((r) => r.userId === uid.value);
  const own = biz.ownerId === uid.value;
  const submit = async () => {
    if (!requireLogin('review') || !rating) return;
    setBusy(true);
    try { await addBusinessReview(biz, rating, text); toast.success(t('place.reviewThanks')); setRating(0); setText(''); }
    catch { toast.error(t('common.error')); }
    setBusy(false);
  };
  const shown = compact ? list?.slice(0, 3) : list;
  return (
    <Card>
      <div class="card-head">
        <h2 class="card-title">{t('place.reviewsTab')}</h2>
        {biz.rating > 0 && <span class="row gap-6"><strong>{biz.rating.toFixed(1).replace('.', ',')}</strong><Stars value={biz.rating} size={15} /><span class="muted small">({formatCount(biz.reviewCount)})</span></span>}
      </div>
      {!compact && !mine && !own && (
        <div class="review-form biz-review-form">
          <strong>{t('biz.rateUs', { name: biz.name })}</strong>
          <StarInput value={rating} onChange={setRating} />
          {rating > 0 && (
            <>
              <TextArea label={t('place.reviewText')} optional={t('common.optional')} value={text} onInput={(e) => setText(e.currentTarget.value)} maxLength={1000} minRows={2} />
              <div class="row gap-8"><Button variant="primary" loading={busy} onClick={submit}>{t('common.publish')}</Button><Button variant="ghost" onClick={() => setRating(0)}>{t('common.cancel')}</Button></div>
            </>
          )}
        </div>
      )}
      {!list ? <div class="center-pad"><Spinner /></div> : !list.length ? <Empty compact icon="star" title={t('place.noReviews')} /> : (
        <div class="review-list">
          {shown.map((r) => (
            <article key={r.id} class="review">
              <Avatar src={r.avatar} name={r.userName} size={40} href={`/u/${r.userId}`} />
              <div class="grow">
                <div class="row gap-8 wrap"><a href={`/u/${r.userId}`} class="bold">{r.userName || t('common.user')}</a><Stars value={r.rating} size={14} /><span class="muted xs">{timeAgo(r.createdAt)}</span></div>
                {r.text && <p class="review-text">{r.text}</p>}
                {r.ownerReply && <div class="owner-reply"><strong class="small">{t('biz.ownerReply', { name: biz.name })}</strong><p class="small">{r.ownerReply}</p></div>}
              </div>
              {(r.userId === uid.value || manage) && (
                <IconButton icon="trash" label={t('common.delete')} size={32} onClick={() => deleteBusinessReview(r).then(() => toast(t('place.reviewDeleted'))).catch(() => toast.error(t('common.error')))} />
              )}
            </article>
          ))}
          {compact && list.length > 3 && <button type="button" class="link" onClick={() => setQuery({ tab: 'reviews' })}>{t('common.seeAll')}</button>}
        </div>
      )}
    </Card>
  );
}

function Services({ services, onQuote, compact }) {
  if (!services.length) return compact ? null : <Card><Empty compact icon="list-checks" title={t('biz.noServices')} /></Card>;
  const shown = compact ? services.slice(0, 4) : services;
  return (
    <Card>
      <div class="card-head"><h2 class="card-title">{t('biz.services')}</h2>{compact && services.length > 4 && <button type="button" class="link" onClick={() => setQuery({ tab: 'services' })}>{t('common.seeAll')}</button>}</div>
      <div class="service-list">
        {shown.map((s) => (
          <div key={s.id} class="service-row">
            <div class="grow"><strong>{s.title}</strong>{s.description && <p class="muted small">{s.description}</p>}</div>
            {s.price && <span class="service-price">{/^\d/.test(s.price) ? `${s.price} ₾` : s.price}</span>}
          </div>
        ))}
      </div>
      {!compact && <Button variant="secondary" icon="paper-plane-right" onClick={onQuote} block>{t('biz.requestQuote')}</Button>}
    </Card>
  );
}

function Photos({ photos, onOpen }) {
  if (!photos.length) return <Card><Empty compact icon="images" title={t('biz.noPhotos')} /></Card>;
  return <Card><div class="place-photo-grid">{photos.map((p, i) => <button key={p.id} type="button" onClick={() => onOpen(i)} aria-label={p.caption || t('place.photo', { n: i + 1 })}><Img src={p.url} width={320} alt="" /></button>)}</div></Card>;
}

function Posts({ biz, manage }) {
  const [posts, setPosts] = useState(null);
  useEffect(() => listenTargetPosts('business', biz.id, setPosts), [biz.id]);
  return (
    <div class="feed">
      {manage && (
        <Card class="composer-card">
          <div class="composer-card-top">
            <Avatar src={biz.logo} name={biz.name} size={40} square />
            <button type="button" class="composer-card-input" onClick={() => openComposer({ asBusiness: { id: biz.id, name: biz.name, logo: biz.logo } })}>{t('biz.postAsPage', { name: biz.name })}</button>
          </div>
        </Card>
      )}
      {!posts ? <div class="center-pad"><Spinner /></div> : posts.length ? posts.map((p) => <PostCard key={p.id} post={p} />)
        : <Card><Empty compact icon="note-pencil" title={t('biz.noPosts')} /></Card>}
    </div>
  );
}

/** Public business page: header, follow / message / call, posts, about, services, reviews, photos. */
export default function BusinessPage({ params }) {
  const { data: biz, loading } = useLive((ok, err) => listenBusiness(params.id, ok, err), [params.id]);
  const manage = useAsync(() => (biz ? canManageBusiness(biz) : Promise.resolve(false)), [biz?.id, uid.value]).data;
  const services = useAsync(() => listServices(params.id), [params.id]).data || [];
  const gallery = useAsync(() => listGallery(params.id), [params.id]).data || [];
  const offers = useAsync(() => listOffers(params.id), [params.id]).data || [];
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [saved, setSavedState] = useState(false);
  const [quote, setQuote] = useState(false);
  const [lightbox, setLightbox] = useState(-1);
  useTitle(biz?.name || t('nav.business'));
  useEffect(() => { if (biz) { setFollowers(biz.followerCount); } }, [biz?.followerCount]);
  useEffect(() => { if (uid.value) { isFollowingBusiness(params.id).then(setFollowing); isSaved('business', params.id).then(setSavedState); } }, [params.id, uid.value]);
  useEffect(() => { if (biz && !manage && manage !== undefined) trackBusiness(biz.id); }, [biz?.id, manage]);
  const tab = query.value.get('tab') || 'home';

  if (loading) return <PageSpinner />;
  if (!biz || biz.status === 'deleted' || biz.raw?.deleted) {
    return <Card><Empty icon="storefront" title={t('biz.notFound')} action={<Button variant="primary" href="/business">{t('nav.business')}</Button>} /></Card>;
  }
  if (biz.status === 'suspended' && !manage) return <Card><Empty icon="prohibit" title={t('biz.suspended')} /></Card>;

  const own = biz.ownerId === uid.value;
  const cat = bizCategory(biz.category);
  const photos = [...(biz.cover ? [{ id: 'cover', url: biz.cover }] : []), ...gallery];
  const toggleFollow = async () => {
    if (!requireLogin('follow')) return;
    const next = !following;
    setFollowing(next); setFollowers((n) => Math.max(0, n + (next ? 1 : -1)));
    try { await setFollowBusiness(biz, next); } catch { setFollowing(!next); setFollowers((n) => n + (next ? -1 : 1)); toast.error(t('common.error')); }
  };
  const toggleSave = async () => {
    if (!requireLogin('save')) return;
    try { await setSaved('business', biz.id, !saved, { title: biz.name, image: biz.logo || biz.cover }); setSavedState(!saved); toast(t(saved ? 'saved.removed' : 'saved.added')); }
    catch { toast.error(t('common.error')); }
  };
  const message = () => { if (requireLogin('message')) navigate(`/messages?business=${biz.id}`); };

  return (
    <div class="biz-page">
      <Card class="biz-head" pad={false}>
        <div class="biz-cover">
          {biz.cover ? <Img src={biz.cover} width={1400} alt="" eager /> : <span class="biz-cover-fallback">{cat?.emoji || '🏪'}</span>}
        </div>
        <div class="biz-head-main">
          <Avatar src={biz.logo} name={biz.name} size={120} square class="biz-logo" />
          <div class="biz-head-text">
            <h1 class="biz-name">{biz.name}{biz.verified && <Verified size={22} />}</h1>
            <p class="biz-sub">
              <span>{cat?.emoji} {bizCategoryLabel(biz.category)}</span>
              <span>{biz.isOnline ? t('biz.online') : cityLabel(biz.city)}</span>
              {biz.priceRange && <span>{biz.priceRange.replace(/\$/g, '₾')}</span>}
            </p>
            <p class="biz-stats">
              {biz.rating > 0 && <span class="place-rating"><Icon name="star-fill" size={15} />{biz.rating.toFixed(1).replace('.', ',')} <span class="muted">({tn('place.reviews', biz.reviewCount)})</span></span>}
              <span><b>{formatCount(followers)}</b> {t('biz.followersWord')}</span>
              <OpenBadge hours={biz.workingHours} />
            </p>
          </div>
        </div>
        <div class="biz-actions">
          {manage ? (
            <>
              <Button variant="primary" icon="gear" href={`/business/${biz.id}/manage`}>{t('biz.manage')}</Button>
              <Button variant="secondary" icon="note-pencil" onClick={() => openComposer({ asBusiness: { id: biz.id, name: biz.name, logo: biz.logo } })}>{t('biz.newPost')}</Button>
            </>
          ) : (
            <>
              <Button variant={following ? 'secondary' : 'primary'} icon={following ? 'check' : 'plus'} onClick={toggleFollow}>{t(following ? 'biz.followingBtn' : 'biz.follow')}</Button>
              {!own && <Button variant="secondary" icon="chat-circle-dots" onClick={message}>{t('profile.message')}</Button>}
            </>
          )}
          {biz.phone && <Button variant="secondary" icon="phone" href={`tel:${biz.phone.replace(/\s/g, '')}`} data-native onClick={() => trackBusiness(biz.id, 'calls')}>{t('biz.call')}</Button>}
          <Menu label={t('common.more')} width={250} items={[
            { icon: saved ? 'bookmark-simple-fill' : 'bookmark-simple', label: t(saved ? 'saved.unsave' : 'post.save'), onClick: toggleSave },
            { icon: 'share-fat', label: t('common.copyLink'), onClick: () => copyLink(`${location.origin}/business/${biz.id}`) },
            { icon: 'paper-plane-right', label: t('biz.requestQuote'), hidden: !!manage, onClick: () => { if (requireLogin('quote')) setQuote(true); } },
            { icon: 'flag', label: t('common.report'), hidden: !!manage, onClick: () => { if (requireLogin('report')) report('business', biz.id, 'inappropriate').finally(() => toast(t('report.sent'))); } },
          ]} trigger={(p) => <IconButton {...p} icon="dots-three" label={t('common.more')} variant="soft" size={40} />} />
        </div>
        <div class="biz-tabs">
          <Tabs value={tab} onChange={(v) => setQuery({ tab: v === 'home' ? null : v })} label={biz.name} items={[
            { value: 'home', label: t('biz.tabHome') },
            { value: 'posts', label: t('biz.tabPosts') },
            { value: 'services', label: t('biz.services'), hidden: !services.length && !manage },
            { value: 'reviews', label: t('place.reviewsTab') },
            { value: 'photos', label: t('biz.photos'), hidden: !photos.length && !manage },
          ]} />
        </div>
      </Card>

      {tab === 'home' && (
        <div class="biz-home">
          <div class="biz-side">
            <Card>
              <h2 class="card-title">{t('biz.about')}</h2>
              {biz.description && <p class="biz-desc">{biz.description}</p>}
              <Contact biz={biz} />
              {biz.createdAt > 0 && <p class="muted small biz-since"><Icon name="calendar-blank" size={14} /> {t('biz.since', { date: formatDate(biz.createdAt) })}</p>}
            </Card>
            {readHours(biz.workingHours) && <Card><Hours raw={biz.workingHours} /></Card>}
            {offers.filter((o) => !o.expired).length > 0 && (
              <Card>
                <h2 class="card-title">{t('biz.offers')}</h2>
                <div class="offer-list">
                  {offers.filter((o) => !o.expired).map((o) => (
                    <div key={o.id} class="offer">
                      <span class="offer-ico"><Icon name="seal-percent" size={22} /></span>
                      <div class="grow"><strong>{o.title}</strong>{o.description && <p class="small text-2">{o.description}</p>}{o.endsAt && <p class="muted xs">{t('biz.validUntil', { date: formatDate(o.endsAt) })}</p>}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
          <div class="biz-mainc">
            <Services services={services} compact onQuote={() => setQuote(true)} />
            <Reviews biz={biz} manage={manage} compact />
            <Posts biz={biz} manage={manage} />
          </div>
        </div>
      )}
      {tab === 'posts' && <Posts biz={biz} manage={manage} />}
      {tab === 'services' && <Services services={services} onQuote={() => { if (requireLogin('quote')) setQuote(true); }} />}
      {tab === 'reviews' && <Reviews biz={biz} manage={manage} />}
      {tab === 'photos' && <Photos photos={photos} onOpen={setLightbox} />}

      {quote && <QuoteDialog biz={biz} services={services} onClose={() => setQuote(false)} />}
      {lightbox >= 0 && <Lightbox media={photos.map((p) => p.url)} index={lightbox} onClose={() => setLightbox(-1)} />}
    </div>
  );
}
