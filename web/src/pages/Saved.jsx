import { useEffect, useState } from 'preact/hooks';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { Card, Empty, Img, Spinner, Chip } from '../ui/misc.jsx';
import { IconButton } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { timeAgo, truncate } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { listenSaved, setSaved } from '../data/posts.js';
import { normPost, normPlace, normBiz, normVideo, normEvent, normItem, normGroup } from '../data/normalize.js';

const TYPES = {
  post: { col: 'posts', norm: normPost, icon: 'note-pencil', label: 'saved.posts', view: (x) => ({ title: truncate(x.text || x.authorName, 90), sub: x.authorName, image: x.media[0] || x.authorAvatar, href: `/post/${x.id}` }) },
  place: { col: 'places', norm: normPlace, icon: 'map-pin', label: 'saved.places', view: (x) => ({ title: x.name, sub: x.city, image: x.image, href: `/place/${x.id}` }) },
  business: { col: 'businesses', norm: normBiz, icon: 'storefront', label: 'saved.businesses', view: (x) => ({ title: x.name, sub: x.category, image: x.logo || x.cover, href: `/business/${x.id}` }) },
  video: { col: 'videos', norm: normVideo, icon: 'monitor-play', label: 'saved.videos', view: (x) => ({ title: x.title, sub: x.channelName, image: x.thumbnail, href: `/watch/${x.id}` }) },
  event: { col: 'events', norm: normEvent, icon: 'calendar-blank', label: 'saved.events', view: (x) => ({ title: x.title, sub: x.city, image: x.image, href: `/events/${x.id}` }) },
  item: { col: 'marketplace', norm: normItem, icon: 'tag', label: 'saved.items', view: (x) => ({ title: x.title, sub: x.city, image: x.images[0], href: `/marketplace/${x.id}` }) },
  group: { col: 'groups', norm: normGroup, icon: 'users-three', label: 'saved.groups', view: (x) => ({ title: x.name, sub: '', image: x.cover, href: `/groups/${x.id}` }) },
};

async function resolve(entry) {
  const def = TYPES[entry.type] || TYPES.post;
  const s = await getDoc(doc(db, def.col, entry.itemId)).catch(() => null);
  if (!s?.exists()) return { ...entry, gone: true, view: { title: t('saved.gone'), sub: '', image: '', href: null } };
  return { ...entry, view: def.view(def.norm(s.id, s.data())) };
}

export default function Saved() {
  useTitle(t('nav.saved'));
  const [entries, setEntries] = useState(null);
  const [items, setItems] = useState(null);
  const [type, setType] = useState('all');
  useEffect(() => listenSaved(setEntries), []);
  useEffect(() => {
    if (!entries) return;
    let alive = true;
    Promise.all(entries.slice(0, 100).map(resolve)).then((r) => alive && setItems(r));
    return () => { alive = false; };
  }, [entries]);
  const types = [...new Set((entries || []).map((e) => e.type))].filter((x) => TYPES[x]);
  const shown = (items || []).filter((i) => type === 'all' || i.type === type);
  return (
    <div class="page-pad">
      <div class="page-head"><h1 class="page-title">{t('nav.saved')}</h1></div>
      {types.length > 1 && (
        <div class="chip-row">
          <Chip active={type === 'all'} onClick={() => setType('all')}>{t('common.all')}</Chip>
          {types.map((k) => <Chip key={k} active={type === k} icon={TYPES[k].icon} onClick={() => setType(k)}>{t(TYPES[k].label)}</Chip>)}
        </div>
      )}
      <Card>
        {items === null && <div class="center-pad"><Spinner /></div>}
        {items && !shown.length && <Empty icon="bookmark-simple" title={t('saved.emptyTitle')} text={t('saved.emptyText')} />}
        <div class="saved-list">
          {shown.map((i) => (
            <div key={`${i.type}:${i.itemId}`} class={`saved-row${i.gone ? ' is-gone' : ''}`}>
              <a href={i.view.href || '#'} class="saved-thumb">{i.view.image ? <Img src={i.view.image} width={120} alt="" /> : <span class="img-fallback"><Icon name={TYPES[i.type]?.icon || 'bookmark-simple'} size={28} /></span>}</a>
              <a href={i.view.href || '#'} class="saved-text">
                <strong>{i.view.title}</strong>
                <span class="muted small"><Icon name={TYPES[i.type]?.icon || 'bookmark-simple'} size={14} /> {t(TYPES[i.type]?.label || 'saved.posts')}{i.view.sub ? ` · ${i.view.sub}` : ''}{i.createdAt ? ` · ${timeAgo(i.createdAt)}` : ''}</span>
              </a>
              <IconButton icon="bookmark-simple-fill" label={t('saved.unsave')} variant="soft" size={40}
                onClick={() => setSaved(i.type, i.itemId, false).then(() => toast(t('saved.removed'))).catch(() => toast.error(t('common.error')))} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
