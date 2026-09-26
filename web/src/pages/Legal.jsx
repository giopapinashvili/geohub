import { Card } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';

/** Privacy policy and terms (the same interim text the old site showed). */
export default function Legal({ doc = 'terms' }) {
  useTitle(t(`legal.${doc}`));
  return (
    <div class="page-pad">
      <Card class="legal">
        <h1 class="page-title">{t(`legal.${doc}`)}</h1>
        {[1, 2].map((i) => <p key={i}>{t(`legal.${doc}.p${i}`)}</p>)}
        <p class="muted small">{t('legal.draft')}</p>
      </Card>
    </div>
  );
}
