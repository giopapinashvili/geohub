import { useEffect, useState } from 'preact/hooks';
import { uid } from '../../lib/auth.js';
import { requireLogin } from '../../lib/store.js';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { formatCommercePrice } from '../../lib/commerce.js';
import { MAX_DISCOUNT_WATCHES, matchesDiscountWatch } from '../../lib/discountWatchlist.js';
import { listenDiscountWatches, saveDiscountWatch, removeDiscountWatch } from '../../data/discountWatchlist.js';
import { Button, IconButton } from '../../ui/Button.jsx';
import '../../styles/discount-watchlist.css';

export function DiscountWatchlist({ query, offers, now, onSelect }) {
  const userId = uid.value;
  const [snapshot, setSnapshot] = useState({ userId: '', entries: [] });
  const entries = snapshot.userId === userId ? snapshot.entries : [];
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    const unsubscribe = listenDiscountWatches(userId, entries => {
      if (active) setSnapshot({ userId, entries });
    }, () => { if (active) setError(true); });
    return () => { active = false; unsubscribe(); };
  }, [userId, retry]);
  async function save() {
    if (busy || !requireLogin('save')) return;
    setBusy('save');
    try { await saveDiscountWatch(query); toast.success(t('deals.watchSaved')); }
    catch (e) { toast.error(e.message || t('common.error')); }
    finally { setBusy(''); }
  }
  async function remove(id) {
    if (busy) return;
    setBusy(id);
    try { await removeDiscountWatch(id); }
    catch { toast.error(t('common.error')); }
    finally { setBusy(''); }
  }
  return <section class="discount-watchlist" aria-label={t('deals.watchlist')}>
    <div class="discount-watchlist-head"><div><h2>{t('deals.watchlist')}</h2><p class="small muted">{t('deals.watchHint')}</p></div><Button icon="bookmark" size="sm" onClick={save} loading={busy === 'save'} disabled={!!busy && busy !== 'save'}>{t('deals.watchSave')}</Button></div>
    {error && <p role="alert" class="small">{t('deals.watchError')} <button type="button" class="link" onClick={() => setRetry(n => n + 1)}>{t('common.retry')}</button></p>}
    {entries.length > 0 && <><p class="small muted">{entries.length}/{MAX_DISCOUNT_WATCHES} · {t('deals.watchLoaded')}</p><ul class="discount-watchlist-entries">{entries.map(entry => {
      const count = offers.filter(offer => matchesDiscountWatch(offer, entry, now)).length;
      const title = entry.term || (entry.type ? t(`commerce.type.${entry.type}`) : t('deals.maxPrice'));
      return <li key={entry.id}><button type="button" class="discount-watchlist-query" onClick={() => onSelect(entry)}><strong>{title}</strong><span>{[entry.type && t(`commerce.type.${entry.type}`), entry.maxPriceMinor !== null && `${t('deals.maxPrice')}: ${formatCommercePrice(entry.maxPriceMinor)}`].filter(Boolean).join(' · ')}</span><small>{t('deals.watchMatches', { n: count })}</small></button><IconButton icon="trash" size={36} label={t('deals.watchRemove', { name: title })} disabled={!!busy} onClick={() => remove(entry.id)} /></li>;
    })}</ul></>}
  </section>;
}
