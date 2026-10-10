import { Card } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { formatDate } from '../lib/format.js';
import { LEGAL, LEGAL_UPDATED } from '../features/legal/texts.js';

/** Terms of service and privacy policy. */
export default function Legal({ doc = 'terms' }) {
  useTitle(t(`legal.${doc}`));
  const sections = LEGAL[doc] || LEGAL.terms;
  return (
    <div class="page-pad narrow">
      <Card class="legal">
        <h1 class="page-title">{t(`legal.${doc}`)}</h1>
        <p class="muted small">{t('legal.updated', { date: formatDate(new Date(`${LEGAL_UPDATED}T12:00:00`).getTime()) })}</p>
        {sections.map((s) => (
          <section key={s.h} class="legal-section">
            <h2>{s.h}</h2>
            {s.p.map((p, i) => <p key={i}>{p}</p>)}
          </section>
        ))}
        <p class="muted small">{t('legal.questions')} <a class="link" href="/support">{t('nav.support')}</a></p>
      </Card>
    </div>
  );
}
