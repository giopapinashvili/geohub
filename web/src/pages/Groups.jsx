import { useEffect, useMemo, useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { Modal } from '../ui/Modal.jsx';
import { SearchInput, TextField, TextArea, Select, Segmented } from '../ui/Field.jsx';
import { Card, Empty, Img, Skeleton } from '../ui/misc.jsx';
import { Icon } from '../ui/Icon.jsx';
import { t, tn } from '../lib/i18n.js';
import { useTitle, useAsync } from '../lib/hooks.js';
import { query, setQuery, navigate } from '../lib/router.js';
import { uid } from '../lib/auth.js';
import { requireLogin } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { listGroups, myGroups, createGroup } from '../data/groups.js';

export const GROUP_CATS = ['general', 'travel', 'food', 'sports', 'tech', 'music', 'art', 'education', 'business', 'family', 'pets', 'local', 'games', 'health'];
export const groupCatLabel = (c) => (GROUP_CATS.includes(c) ? t(`groups.cat.${c}`) : c);

export function GroupCard({ g }) {
  return (
    <a href={`/groups/${g.id}`} class="card group-card">
      <span class="group-card-cover"><Img src={g.cover} width={600} alt="" fallback={<span class="biz-card-cover-fallback">{g.emoji || '👥'}</span>} /></span>
      <span class="group-card-body">
        <strong class="place-card-name">{g.name}</strong>
        <span class="muted small"><Icon name={g.privacy === 'private' ? 'lock' : 'globe-simple'} size={13} /> {t(g.privacy === 'private' ? 'groups.private' : 'groups.public')} · {tn('groups.members', g.memberCount)}</span>
        <span class="muted xs">{groupCatLabel(g.category)}</span>
      </span>
    </a>
  );
}

function CreateGroup({ onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [privacy, setPrivacy] = useState('public');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { const id = await createGroup({ name, description, category, privacy }); toast.success(t('groups.created')); onClose(); navigate(`/groups/${id}`); }
    catch { toast.error(t('common.error')); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('groups.create')} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" loading={busy} disabled={name.trim().length < 3} onClick={submit}>{t('common.create')}</Button></>}>
      <div class="stack">
        <TextField label={t('groups.name')} value={name} onInput={(e) => setName(e.currentTarget.value)} maxLength={80} />
        <Select label={t('place.category')} value={category} onChange={(e) => setCategory(e.currentTarget.value)} options={GROUP_CATS.map((c) => ({ value: c, label: groupCatLabel(c) }))} />
        <div class="field"><span class="field-label">{t('groups.privacy')}</span>
          <Segmented value={privacy} onChange={setPrivacy} label={t('groups.privacy')} options={[{ value: 'public', label: t('groups.public'), icon: 'globe-simple' }, { value: 'private', label: t('groups.private'), icon: 'lock' }]} />
          <p class="field-hint">{t(privacy === 'private' ? 'groups.privateHint' : 'groups.publicHint')}</p>
        </div>
        <TextArea label={t('common.description')} optional={t('common.optional')} value={description} onInput={(e) => setDescription(e.currentTarget.value)} maxLength={1000} minRows={3} />
      </div>
    </Modal>
  );
}

/** Groups: discover and your groups. */
export default function Groups() {
  useTitle(t('nav.groups'));
  const tab = query.value.get('tab') || 'discover';
  const [all, setAll] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [creating, setCreating] = useState(false);
  const mine = useAsync(() => (uid.value ? myGroups() : Promise.resolve([])), [uid.value]);
  useEffect(() => { listGroups().then(setAll).catch(() => setAll([])); }, []);
  const list = useMemo(() => {
    const src = tab === 'mine' ? mine.data || [] : all || [];
    const n = q.trim().toLowerCase();
    return src.filter((g) => (!cat || g.category === cat) && (!n || `${g.name} ${g.description}`.toLowerCase().includes(n))).sort((a, b) => b.memberCount - a.memberCount);
  }, [all, mine.data, tab, q, cat]);
  const loading = tab === 'mine' ? mine.loading : !all;
  return (
    <div class="page-pad biz-hub">
      <div class="page-head">
        <div><h1 class="page-title">{t('nav.groups')}</h1><p class="page-sub">{t('groups.sub')}</p></div>
        <Button variant="primary" icon="plus" onClick={() => { if (requireLogin('group')) setCreating(true); }}>{t('groups.create')}</Button>
      </div>
      <Tabs variant="pill" value={tab} onChange={(v) => setQuery({ tab: v === 'discover' ? null : v })} label={t('nav.groups')} items={[
        { value: 'discover', label: t('groups.discover'), icon: 'compass' },
        { value: 'mine', label: t('groups.mine'), icon: 'users-three', hidden: !uid.value },
      ]} />
      <SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('groups.search')} />
      <div class="chip-row">
        <button type="button" class={`chip${!cat ? ' is-active' : ''}`} onClick={() => setCat('')}>{t('common.all')}</button>
        {GROUP_CATS.map((c) => <button key={c} type="button" class={`chip${cat === c ? ' is-active' : ''}`} onClick={() => setCat(cat === c ? '' : c)}>{groupCatLabel(c)}</button>)}
      </div>
      {loading ? <div class="place-grid"><Skeleton h={220} /><Skeleton h={220} /><Skeleton h={220} /></div>
        : list.length ? <div class="place-grid">{list.map((g) => <GroupCard key={g.id} g={g} />)}</div>
        : <Card><Empty icon="users-three" title={t(tab === 'mine' ? 'groups.noMine' : 'groups.none')} action={<Button variant="primary" icon="plus" onClick={() => { if (requireLogin('group')) setCreating(true); }}>{t('groups.create')}</Button>} /></Card>}
      {creating && <CreateGroup onClose={() => setCreating(false)} />}
    </div>
  );
}
