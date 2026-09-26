import { useEffect, useMemo, useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Select } from '../ui/Field.jsx';
import { Card, Empty, Skeleton } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { query, setQuery, navigate } from '../lib/router.js';
import { uid } from '../lib/auth.js';
import { requireLogin } from '../lib/store.js';
import { cityOptions, cityLabel } from '../lib/geo.js';
import { listNeeds, NEED_CATS, needOf } from '../data/needs.js';
import { NeedCard } from '../features/needs/NeedCard.jsx';
import { NeedDialog } from '../features/needs/NeedDialog.jsx';

/** The request board: people say what they need, businesses answer. */
export default function Needs() {
  useTitle(t('needs.title'));
  const cat = query.value.get('cat') || '';
  const city = query.value.get('city') || '';
  const mine = query.value.get('mine') === '1';
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(() => query.value.get('new') === '1');
  useEffect(() => { listNeeds().then(setList).catch(() => setList([])); }, []);
  const shown = useMemo(() => (list || []).filter((p) => {
    const n = needOf(p);
    return (!cat || n.category === cat) && (!city || cityLabel(n.city) === cityLabel(city)) && (!mine || p.authorId === uid.value);
  }), [list, cat, city, mine]);
  const start = () => { if (requireLogin('need')) setOpen(true); };
  return (
    <div class="page-pad needs-page">
      <section class="needs-hero">
        <div class="grow">
          <h1 class="explore-title">{t('needs.title')}</h1>
          <p>{t('needs.sub')}</p>
          <ol class="needs-steps"><li>{t('needs.step1')}</li><li>{t('needs.step2')}</li><li>{t('needs.step3')}</li></ol>
        </div>
        <Button variant="primary" icon="megaphone" onClick={start} class="needs-cta">{t('needs.cta')}</Button>
      </section>
      <div class="needs-filters">
        <div class="chip-row">
          <button type="button" class={`chip${!cat ? ' is-active' : ''}`} onClick={() => setQuery({ cat: null })}>{t('common.all')}</button>
          {NEED_CATS.map((c) => <button key={c.id} type="button" class={`chip${cat === c.id ? ' is-active' : ''}`} onClick={() => setQuery({ cat: cat === c.id ? null : c.id })}><Icon name={c.icon} size={16} style={cat === c.id ? undefined : { color: c.tone }} />{t(`needs.cat.${c.id}`)}</button>)}
        </div>
        <div class="explore-filter-row">
          <div class="explore-city"><Select label={t('place.city')} value={city} onChange={(e) => setQuery({ city: e.currentTarget.value || null })} options={[{ value: '', label: t('explore.allCities') }, ...cityOptions()]} /></div>
          {uid.value && <Button variant={mine ? 'soft' : 'secondary'} icon="user" onClick={() => setQuery({ mine: mine ? null : '1' })}>{t('needs.mine')}</Button>}
        </div>
      </div>
      {!list ? <div class="needs-grid"><Skeleton h={200} /><Skeleton h={200} /><Skeleton h={200} /></div>
        : shown.length ? <div class="needs-grid">{shown.map((p) => <NeedCard key={p.id} post={p} onClosed={(id) => setList((l) => l.filter((x) => x.id !== id))} />)}</div>
        : <Card><Empty icon="megaphone" title={t('needs.none')} text={t('needs.noneText')} action={<Button variant="primary" icon="megaphone" onClick={start}>{t('needs.cta')}</Button>} /></Card>}
      {open && <NeedDialog initialCategory={cat} onClose={() => { setOpen(false); if (query.value.get('new')) setQuery({ new: null }); }} onCreated={(id) => navigate(`/post/${id}`)} />}
    </div>
  );
}
