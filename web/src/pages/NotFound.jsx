import { Button } from '../ui/Button.jsx';
import { Card, Empty } from '../ui/misc.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';

export default function NotFound() {
  useTitle(t('notFound.title'));
  return <Card><Empty icon="compass" title={t('notFound.title')} text={t('notFound.text')} action={<><Button variant="primary" href="/">{t('nav.home')}</Button><Button variant="secondary" href="/explore">{t('nav.explore')}</Button></>} /></Card>;
}
