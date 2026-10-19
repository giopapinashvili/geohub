import { useEffect, useState } from 'preact/hooks';
import { listOfficialOffers } from '../../data/officialOffers.js';
import { commerceOfferState } from '../../lib/commerce.js';
import { OfferCard } from './OfferCard.jsx';
import { Button } from '../../ui/Button.jsx';
import { Spinner } from '../../ui/misc.jsx';
import '../../styles/commerce.css';

export function OfficialMerchantCatalog({ merchant, itemId = '', compact = false }) {
  const [rows, setRows] = useState(null), [failed, setFailed] = useState(false), [limit, setLimit] = useState(compact ? 6 : 24);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let alive = true; setRows(null); setFailed(false);
    const load = () => listOfficialOffers().then(items => { if (alive) { setRows(items.filter(item => item.brandId === merchant.id)); setFailed(false); } }).catch(() => { if (alive) { setRows([]); setFailed(true); } });
    load(); const timer = setInterval(load, 15 * 60000);
    return () => { alive = false; clearInterval(timer); };
  }, [merchant.id]);
  const sorted = rows && rows.filter(item => commerceOfferState(item, now) === 'active').sort((a, b) => Number(b.itemId === itemId) - Number(a.itemId === itemId));
  return <section class="source-catalog"><h2>ოფიციალური ონლაინ კატალოგიდან</h2><p>მაღაზიის საიტზე ნაჩვენები პროდუქტები და ფასები. კონკრეტულ ფილიალში მათი მარაგი დაუდასტურებელია. დეტალებზე დაჭერით იხსნება პროდუქტის წყარო.</p>
    {rows === null ? <Spinner/> : failed ? <p>კატალოგი დროებით ვერ ჩაიტვირთა. <a href={merchant.website} target="_blank" rel="noopener noreferrer">გახსენი ოფიციალური საიტი</a></p> : sorted.length ? <><div class="deals-grid">{sorted.slice(0,limit).map(offer => <OfferCard key={offer.id} offer={offer}/>)}</div>{sorted.length > limit && <Button variant="secondary" onClick={() => setLimit(n => n + 24)}>კატალოგის მეტის ნახვა</Button>}</> : <p>ბოლოს შემოწმებული შეთავაზებების განახლებაა საჭირო. <a href={merchant.website} target="_blank" rel="noopener noreferrer">ფასები ოფიციალურ საიტზე ნახე</a>.</p>}
  </section>;
}
