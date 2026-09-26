import { useEffect, useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Button, IconButton } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { Modal, Confirm } from '../ui/Modal.jsx';
import { TextField, TextArea, Segmented } from '../ui/Field.jsx';
import { Card, Empty, Img, PageSpinner, Spinner, StatCard } from '../ui/misc.jsx';
import { t, tn, formatCount } from '../lib/i18n.js';
import { useTitle, useLive, useAsync, isDesktop } from '../lib/hooks.js';
import { timeAgo, formatDate, monthShort } from '../lib/format.js';
import { query, setQuery, navigate } from '../lib/router.js';
import { uid } from '../lib/auth.js';
import { toast } from '../lib/toast.js';
import { upload } from '../lib/media.js';
import {
  listenBusiness, canManageBusiness, updateBusiness, deleteBusiness, listServices, saveService, deleteService, listGallery,
  addGalleryPhoto, deleteGalleryPhoto, listOffers, createOffer, deleteOffer, listenBusinessReviews, replyToReview,
  listQuoteRequests, setQuoteStatus, businessAnalytics, businessFollowers,
} from '../data/business.js';
import { listenConversations } from '../data/messages.js';
import { BasicsFields, ContactFields, LookFields, fromBusiness, toPayload, validBasics } from '../features/business/BusinessForm.jsx';
import { Stars } from '../features/places/Stars.jsx';
import { ConversationRow } from '../features/messages/ConversationRow.jsx';
import { Thread } from '../features/messages/Thread.jsx';
import { useUser } from '../features/user/useUser.js';

function FollowerRow({ f }) {
  const u = useUser(f.userId);
  return (
    <div class="mini-row">
      <Avatar src={u?.avatar} name={u?.name || ''} size={28} href={`/u/${f.userId}`} />
      <a href={`/u/${f.userId}`} class="grow ellipsis">{u?.name || t('biz.someoneFollowed')}</a>
      <span class="muted xs">{timeAgo(f.createdAt)}</span>
    </div>
  );
}

function Overview({ biz }) {
  const stats = useAsync(() => businessAnalytics(biz.id, 30), [biz.id]).data;
  const quotes = useAsync(() => listQuoteRequests(biz.id), [biz.id]).data;
  const followers = useAsync(() => businessFollowers(biz.id, 8), [biz.id]).data;
  const sum = (k) => (stats || []).reduce((a, d) => a + d[k], 0);
  const max = Math.max(1, ...(stats || []).map((d) => d.views));
  return (
    <div class="stack">
      <div class="stat-grid">
        <StatCard label={t('biz.followersWord')} value={formatCount(biz.followerCount)} icon="users" tone="#4b6bd6" />
        <StatCard label={t('biz.views30')} value={formatCount(sum('views'))} icon="eye" tone="#2f9e5b" />
        <StatCard label={t('biz.calls30')} value={formatCount(sum('calls'))} icon="phone" tone="#e0662b" />
        <StatCard label={t('biz.rating')} value={biz.rating ? biz.rating.toFixed(1).replace('.', ',') : '—'} icon="star" tone="#f2a51a" />
      </div>
      <Card>
        <div class="card-head"><h2 class="card-title">{t('biz.viewsChart')}</h2><span class="muted small">{t('biz.last30')}</span></div>
        {!stats ? <div class="center-pad"><Spinner /></div> : (
          <div class="bar-chart" role="img" aria-label={t('biz.viewsChart')}>
            {stats.map((d) => (
              <div key={d.day} class="bar-col" title={`${formatDate(d.day, { withYear: false })}: ${d.views}`}>
                <span class="bar" style={{ height: `${(d.views / max) * 100}%` }} />
              </div>
            ))}
          </div>
        )}
        {stats && <div class="bar-axis muted xs"><span>{new Date(stats[0].day).getDate()} {monthShort(stats[0].day)}</span><span>{t('common.today')}</span></div>}
      </Card>
      <div class="manage-2">
        <Card>
          <div class="card-head"><h2 class="card-title">{t('biz.quotes')}</h2><button type="button" class="link" onClick={() => setQuery({ tab: 'quotes' })}>{t('common.seeAll')}</button></div>
          {!quotes ? <Spinner /> : quotes.length ? quotes.slice(0, 4).map((q) => (
            <div key={q.id} class="mini-row"><Icon name="envelope-simple" size={18} class="muted" /><span class="grow ellipsis"><b>{q.name}</b> — {q.message}</span>{q.status === 'new' && <span class="tag tag-brand">{t('biz.quoteNew')}</span>}</div>
          )) : <p class="muted small">{t('biz.noQuotes')}</p>}
        </Card>
        <Card>
          <div class="card-head"><h2 class="card-title">{t('biz.newFollowers')}</h2></div>
          {!followers ? <Spinner /> : followers.length ? followers.map((f) => (
            <FollowerRow key={f.userId} f={f} />
          )) : <p class="muted small">{t('biz.noFollowersYet')}</p>}
        </Card>
      </div>
    </div>
  );
}

function Inbox({ biz }) {
  const actor = `business_${biz.id}`;
  const [list, setList] = useState(null);
  const [cid, setCid] = useState(null);
  useEffect(() => listenConversations(setList, actor), [biz.id]);
  const desktop = isDesktop();
  if (!list) return <div class="center-pad"><Spinner /></div>;
  if (!list.length) return <Card><Empty icon="chat-circle-dots" title={t('biz.inboxEmpty')} text={t('biz.inboxEmptyText')} /></Card>;
  return (
    <Card class="biz-inbox" pad={false}>
      {(desktop || !cid) && (
        <div class="biz-inbox-list">
          {list.map((c) => <ConversationRow key={c.id} conv={c} actorId={actor} active={c.id === cid} onClick={() => setCid(c.id)} />)}
        </div>
      )}
      {(desktop || cid) && (
        <div class="biz-inbox-thread">
          {cid ? <Thread key={cid} cid={cid} actorId={actor} header={!desktop && <div class="biz-inbox-back"><IconButton icon="arrow-left" label={t('common.back')} onClick={() => setCid(null)} /></div>} />
            : <Empty icon="chat-circle-dots" title={t('messages.selectTitle')} />}
        </div>
      )}
    </Card>
  );
}

function Edit({ biz }) {
  const [f, setF] = useState(() => fromBusiness(biz));
  const [busy, setBusy] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const save = async () => {
    setBusy(true);
    try { await updateBusiness(biz.id, toPayload(f)); toast.success(t('biz.saved')); }
    catch { toast.error(t('common.error')); }
    setBusy(false);
  };
  return (
    <div class="stack">
      <Card><h2 class="card-title manage-h">{t('biz.step.basics')}</h2><BasicsFields f={f} set={set} /></Card>
      <Card><h2 class="card-title manage-h">{t('biz.step.contact')}</h2><ContactFields f={f} set={set} /></Card>
      <Card><h2 class="card-title manage-h">{t('biz.step.look')}</h2><LookFields f={f} set={set} /></Card>
      <div class="sticky-save"><Button variant="primary" icon="check" loading={busy} disabled={!validBasics(f)} onClick={save}>{t('common.save')}</Button></div>
    </div>
  );
}

function ServiceDialog({ service, onClose, onSave }) {
  const [title, setTitle] = useState(service?.title || '');
  const [description, setDescription] = useState(service?.description || '');
  const [price, setPrice] = useState(service?.price || '');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title={t(service?.id ? 'biz.editService' : 'biz.addService')} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" loading={busy} disabled={!title.trim()} onClick={async () => { setBusy(true); await onSave({ ...service, title, description, price }); setBusy(false); }}>{t('common.save')}</Button></>}>
      <div class="stack">
        <TextField label={t('biz.serviceName')} value={title} onInput={(e) => setTitle(e.currentTarget.value)} maxLength={80} />
        <TextField label={t('biz.servicePrice')} optional={t('common.optional')} value={price} onInput={(e) => setPrice(e.currentTarget.value)} maxLength={30} placeholder="25" hint={t('biz.servicePriceHint')} />
        <TextArea label={t('common.description')} optional={t('common.optional')} value={description} onInput={(e) => setDescription(e.currentTarget.value)} maxLength={500} minRows={2} />
      </div>
    </Modal>
  );
}

function Services({ biz }) {
  const { data, reload } = useAsync(() => listServices(biz.id), [biz.id]);
  const [editing, setEditing] = useState(null);
  const save = async (s) => {
    try { await saveService(biz.id, { ...s, order: s.order ?? (data?.length || 0) }); toast.success(t('biz.saved')); setEditing(null); reload(); }
    catch { toast.error(t('common.error')); }
  };
  return (
    <Card>
      <div class="card-head"><h2 class="card-title">{t('biz.services')}</h2><Button variant="primary" size="sm" icon="plus" onClick={() => setEditing({})}>{t('biz.addService')}</Button></div>
      {!data ? <Spinner /> : data.length ? (
        <div class="service-list">
          {data.map((s) => (
            <div key={s.id} class="service-row">
              <div class="grow"><strong>{s.title}</strong>{s.description && <p class="muted small">{s.description}</p>}</div>
              {s.price && <span class="service-price">{/^\d/.test(s.price) ? `${s.price} ₾` : s.price}</span>}
              <IconButton icon="pencil-simple" label={t('common.edit')} size={34} onClick={() => setEditing(s)} />
              <IconButton icon="trash" label={t('common.delete')} size={34} onClick={() => deleteService(biz.id, s.id).then(reload).catch(() => toast.error(t('common.error')))} />
            </div>
          ))}
        </div>
      ) : <Empty compact icon="list-checks" title={t('biz.noServices')} text={t('biz.noServicesText')} />}
      {editing && <ServiceDialog service={editing} onClose={() => setEditing(null)} onSave={save} />}
    </Card>
  );
}

function Photos({ biz }) {
  const { data, reload } = useAsync(() => listGallery(biz.id), [biz.id]);
  const [busy, setBusy] = useState(false);
  const add = async (e) => {
    const files = [...e.currentTarget.files].slice(0, 10);
    e.currentTarget.value = '';
    if (!files.length) return;
    setBusy(true);
    try { for (const f of files) await addGalleryPhoto(biz.id, await upload(f, { folder: 'businesses' })); reload(); }
    catch (err) { toast.error(t(err.code === 'too-large' ? 'upload.tooLarge' : 'common.error')); }
    setBusy(false);
  };
  return (
    <Card>
      <div class="card-head">
        <h2 class="card-title">{t('biz.photos')}</h2>
        <label class="btn btn-primary btn-sm">{busy ? <Spinner size={14} /> : <Icon name="plus" size={16} />}{t('biz.addPhotos')}<input type="file" accept="image/*" multiple hidden onChange={add} /></label>
      </div>
      {!data ? <Spinner /> : data.length ? (
        <div class="manage-photos">
          {data.map((p) => (
            <div key={p.id} class="manage-photo">
              <Img src={p.url} width={320} alt="" />
              <IconButton icon="trash" label={t('common.delete')} size={32} variant="soft" onClick={() => deleteGalleryPhoto(biz.id, p.id).then(reload).catch(() => toast.error(t('common.error')))} />
            </div>
          ))}
        </div>
      ) : <Empty compact icon="images" title={t('biz.noPhotos')} text={t('biz.noPhotosText')} />}
    </Card>
  );
}

function Offers({ biz }) {
  const { data, reload } = useAsync(() => listOffers(biz.id), [biz.id]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try { await createOffer(biz.id, { title, description, startsAt: new Date().toISOString().slice(0, 10), endsAt }); setOpen(false); setTitle(''); setDescription(''); setEndsAt(''); reload(); toast.success(t('biz.offerCreated')); }
    catch { toast.error(t('common.error')); }
    setBusy(false);
  };
  return (
    <Card>
      <div class="card-head"><h2 class="card-title">{t('biz.offers')}</h2><Button variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>{t('biz.addOffer')}</Button></div>
      {!data ? <Spinner /> : data.length ? (
        <div class="offer-list">
          {data.map((o) => (
            <div key={o.id} class={`offer${o.expired ? ' is-expired' : ''}`}>
              <span class="offer-ico"><Icon name="seal-percent" size={22} /></span>
              <div class="grow"><strong>{o.title}</strong>{o.description && <p class="small text-2">{o.description}</p>}<p class="muted xs">{o.endsAt ? t(o.expired ? 'biz.expired' : 'biz.validUntil', { date: formatDate(o.endsAt) }) : t('biz.noEnd')}</p></div>
              <IconButton icon="trash" label={t('common.delete')} size={34} onClick={() => deleteOffer(o.id).then(reload).catch(() => toast.error(t('common.error')))} />
            </div>
          ))}
        </div>
      ) : <Empty compact icon="seal-percent" title={t('biz.noOffers')} text={t('biz.noOffersText')} />}
      <Modal open={open} onClose={() => setOpen(false)} title={t('biz.addOffer')} size="sm"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button variant="primary" loading={busy} disabled={!title.trim()} onClick={create}>{t('common.publish')}</Button></>}>
        <div class="stack">
          <TextField label={t('biz.offerTitle')} value={title} onInput={(e) => setTitle(e.currentTarget.value)} maxLength={80} placeholder={t('biz.offerTitlePh')} />
          <TextArea label={t('common.description')} optional={t('common.optional')} value={description} onInput={(e) => setDescription(e.currentTarget.value)} maxLength={400} minRows={2} />
          <TextField label={t('biz.offerEnds')} optional={t('common.optional')} type="date" value={endsAt} onInput={(e) => setEndsAt(e.currentTarget.value)} min={new Date().toISOString().slice(0, 10)} />
        </div>
      </Modal>
    </Card>
  );
}

function Reviews({ biz }) {
  const [list, setList] = useState(null);
  const [replying, setReplying] = useState(null);
  const [text, setText] = useState('');
  useEffect(() => listenBusinessReviews(biz.id, setList), [biz.id]);
  const send = async () => {
    try { await replyToReview(replying, text); setReplying(null); setText(''); toast.success(t('biz.replied')); }
    catch { toast.error(t('common.error')); }
  };
  return (
    <Card>
      <h2 class="card-title manage-h">{t('place.reviewsTab')}</h2>
      {!list ? <Spinner /> : list.length ? (
        <div class="review-list">
          {list.map((r) => (
            <article key={r.id} class="review">
              <Avatar src={r.avatar} name={r.userName} size={40} />
              <div class="grow">
                <div class="row gap-8 wrap"><strong>{r.userName}</strong><Stars value={r.rating} size={14} /><span class="muted xs">{timeAgo(r.createdAt)}</span></div>
                {r.text && <p class="review-text">{r.text}</p>}
                {r.ownerReply && replying !== r.id && <div class="owner-reply"><strong class="small">{t('biz.yourReply')}</strong><p class="small">{r.ownerReply}</p></div>}
                {replying === r.id ? (
                  <div class="reply-box">
                    <TextArea label={t('biz.reply')} value={text} onInput={(e) => setText(e.currentTarget.value)} maxLength={600} minRows={2} />
                    <div class="row gap-8"><Button variant="primary" size="sm" disabled={!text.trim()} onClick={send}>{t('common.send')}</Button><Button variant="ghost" size="sm" onClick={() => setReplying(null)}>{t('common.cancel')}</Button></div>
                  </div>
                ) : <button type="button" class="link small" onClick={() => { setReplying(r.id); setText(r.ownerReply || ''); }}>{t(r.ownerReply ? 'biz.editReply' : 'biz.reply')}</button>}
              </div>
            </article>
          ))}
        </div>
      ) : <Empty compact icon="star" title={t('place.noReviews')} />}
    </Card>
  );
}

function Quotes({ biz }) {
  const { data, reload } = useAsync(() => listQuoteRequests(biz.id), [biz.id]);
  const [filter, setFilter] = useState('all');
  const list = (data || []).filter((q) => filter === 'all' || (filter === 'new' ? q.status === 'new' : q.status !== 'new'));
  return (
    <Card>
      <div class="card-head">
        <h2 class="card-title">{t('biz.quotes')}</h2>
        <Segmented size="sm" value={filter} onChange={setFilter} label={t('biz.quotes')} options={[{ value: 'all', label: t('common.all') }, { value: 'new', label: t('biz.quoteNew') }, { value: 'done', label: t('biz.quoteDone') }]} />
      </div>
      {!data ? <Spinner /> : list.length ? (
        <div class="quote-list">
          {list.map((q) => (
            <article key={q.id} class={`quote${q.status === 'new' ? ' is-new' : ''}`}>
              <div class="row gap-8 wrap"><strong>{q.name}</strong>{q.service && <span class="tag tag-neutral">{q.service}</span>}<span class="muted xs">{timeAgo(q.createdAt)}</span></div>
              <p class="review-text">{q.message}</p>
              <div class="row gap-12 wrap small">
                {q.email && <a href={`mailto:${q.email}`} data-native class="link">{q.email}</a>}
                {q.phone && <a href={`tel:${q.phone}`} data-native class="link">{q.phone}</a>}
                <span class="grow" />
                <Button variant={q.status === 'new' ? 'soft' : 'ghost'} size="sm" icon={q.status === 'new' ? 'check' : 'arrow-u-up-left'}
                  onClick={() => setQuoteStatus(biz.id, q.id, q.status === 'new' ? 'done' : 'new').then(reload).catch(() => toast.error(t('common.error')))}>
                  {t(q.status === 'new' ? 'biz.markDone' : 'biz.markNew')}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : <Empty compact icon="envelope-simple" title={t('biz.noQuotes')} />}
    </Card>
  );
}

function Danger({ biz }) {
  const [open, setOpen] = useState(false);
  if (biz.ownerId !== uid.value) return null;
  return (
    <Card class="danger-card">
      <h2 class="card-title">{t('biz.deletePage')}</h2>
      <p class="muted small">{t('biz.deletePageText')}</p>
      <Button variant="danger" icon="trash" onClick={() => setOpen(true)}>{t('biz.deletePage')}</Button>
      <Confirm open={open} danger title={t('biz.deleteConfirm', { name: biz.name })} confirmLabel={t('common.delete')} onClose={() => setOpen(false)}
        onConfirm={() => deleteBusiness(biz.id).then(() => { toast(t('biz.deleted')); navigate('/business', { replace: true }); }).catch(() => toast.error(t('common.error')))} />
    </Card>
  );
}

/** Page management for owners and page admins. */
export default function BusinessManage({ params }) {
  const { data: biz, loading } = useLive((ok, err) => listenBusiness(params.id, ok, err), [params.id]);
  const allowed = useAsync(() => (biz ? canManageBusiness(biz) : Promise.resolve(null)), [biz?.id, uid.value]).data;
  useTitle(biz ? `${biz.name} — ${t('biz.manage')}` : t('biz.manage'));
  const tab = query.value.get('tab') || 'overview';
  if (loading || (biz && allowed == null)) return <PageSpinner />;
  if (!biz) return <Card><Empty icon="storefront" title={t('biz.notFound')} /></Card>;
  if (!allowed) return <Card><Empty icon="lock" title={t('biz.noAccess')} action={<Button variant="primary" href={`/business/${biz.id}`}>{t('biz.viewPage')}</Button>} /></Card>;

  return (
    <div class="page-pad biz-manage">
      <div class="manage-head">
        <Avatar src={biz.logo} name={biz.name} size={56} square href={`/business/${biz.id}`} />
        <div class="grow">
          <h1 class="page-title">{biz.name}</h1>
          <p class="muted small">{t('biz.manage')} · {tn('biz.followers', biz.followerCount)}</p>
        </div>
        <Button variant="secondary" icon="arrow-square-out" href={`/business/${biz.id}`}>{t('biz.viewPage')}</Button>
      </div>
      <Tabs variant="pill" value={tab} onChange={(v) => setQuery({ tab: v === 'overview' ? null : v })} label={t('biz.manage')} items={[
        { value: 'overview', label: t('biz.overview'), icon: 'chart-bar' },
        { value: 'inbox', label: t('biz.inbox'), icon: 'chat-circle-dots' },
        { value: 'edit', label: t('biz.editPage'), icon: 'pencil-simple' },
        { value: 'services', label: t('biz.services'), icon: 'list-checks' },
        { value: 'photos', label: t('biz.photos'), icon: 'images' },
        { value: 'offers', label: t('biz.offers'), icon: 'seal-percent' },
        { value: 'reviews', label: t('place.reviewsTab'), icon: 'star' },
        { value: 'quotes', label: t('biz.quotes'), icon: 'envelope-simple' },
      ]} />
      <div class="manage-body">
        {tab === 'overview' && <Overview biz={biz} />}
        {tab === 'inbox' && <Inbox biz={biz} />}
        {tab === 'edit' && <><Edit biz={biz} /><Danger biz={biz} /></>}
        {tab === 'services' && <Services biz={biz} />}
        {tab === 'photos' && <Photos biz={biz} />}
        {tab === 'offers' && <Offers biz={biz} />}
        {tab === 'reviews' && <Reviews biz={biz} />}
        {tab === 'quotes' && <Quotes biz={biz} />}
      </div>
    </div>
  );
}
