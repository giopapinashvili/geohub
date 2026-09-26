import { Card } from '../ui/misc.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { query, setQuery } from '../lib/router.js';

const SECTIONS = { about: ['mission', 'places', 'people', 'business'], safety: ['report', 'block', 'privacy', 'kids'], help: ['account', 'checkin', 'business', 'contact'] };
const ICONS = { mission: 'heart', places: 'map-pin', people: 'users-three', business: 'storefront', report: 'flag', block: 'prohibit', privacy: 'lock', kids: 'shield-check', account: 'user-circle', checkin: 'map-pin', contact: 'envelope-simple' };

/** About GeoHub, safety tips and help. */
export default function About() {
  const tab = query.value.get('tab') || 'about';
  useTitle(t(`about.tab.${tab}`));
  return (
    <div class="page-pad biz-hub">
      <section class="premium-hero"><h1 class="explore-title">{t('about.title')}</h1><p>{t('about.sub')}</p></section>
      <Tabs variant="pill" value={tab} onChange={(v) => setQuery({ tab: v === 'about' ? null : v })} label={t('about.title')} items={Object.keys(SECTIONS).map((k) => ({ value: k, label: t(`about.tab.${k}`) }))} />
      <div class="about-grid">
        {(SECTIONS[tab] || SECTIONS.about).map((k) => (
          <Card key={k}><span class="stat-card-ico" style={{ '--tone': 'var(--brand)' }}><Icon name={ICONS[k]} size={22} /></span><h2 class="card-title" style={{ marginTop: 10 }}>{t(`about.${tab}.${k}.t`)}</h2><p class="text-2" style={{ marginTop: 6 }}>{t(`about.${tab}.${k}.d`)}</p></Card>
        ))}
      </div>
      <p class="muted small center"><a href="/terms" class="link">{t('legal.terms')}</a> · <a href="/privacy" class="link">{t('legal.privacy')}</a></p>
    </div>
  );
}
