import { officialMerchant } from '../lib/officialMerchants.js';
import { PlaceBrand } from '../features/places/PlaceBrand.jsx';
import { OfficialMerchantCatalog } from '../features/commerce/OfficialMerchantCatalog.jsx';
import { Button } from '../ui/Button.jsx';
import { Card, Empty } from '../ui/misc.jsx';
import { useTitle } from '../lib/hooks.js';
import { query } from '../lib/router.js';
import '../styles/commerce.css';

export default function BrandDirectory({ params }) {
  const merchant = officialMerchant(params.id);
  useTitle(merchant?.name || 'მაღაზია');
  if (!merchant) return <Card><Empty title="მაღაზია ვერ მოიძებნა" action={<Button href="/discounts">ფასდაკლებები</Button>}/></Card>;
  return <div class="page-pad brand-directory">
    <a href="/discounts">← ფასდაკლებები</a>
    <header class="brand-directory-header"><PlaceBrand place={{name:merchant.name,raw:{brand:merchant.name}}} size="heading"/><div><h1>{merchant.name}</h1><span class="muted small">GeoHub-ის ცნობარი · რეალური მაღაზია</span></div></header>
    <p class="brand-directory-body">{merchant.description}</p><p class="small muted">გვერდი შედგენილია საჯარო წყაროებით. ბიზნესის მიერ მართვა ან პარტნიორობა დადასტურებული არ არის.</p>
    <div class="row gap-12 wrap"><Button href={merchant.website} target="_blank" rel="noopener noreferrer" icon="globe-simple">ოფიციალური საიტი</Button>{merchant.phone && <span>{merchant.phone}</span>}</div>
    <OfficialMerchantCatalog merchant={merchant} itemId={query.value.get('item') || ''}/>
    <h2>ფილიალები რუკაზე</h2><p class="small muted">საჯარო რუკის წყაროში მონიშნული მისამართები; სრული სია გადაამოწმე ოფიციალურ საიტზე.</p>
    <div class="brand-branches">{merchant.branches.map(branch => <a key={branch.id} href={`/place/${branch.id}`}><strong>{branch.name}</strong><small>{branch.address || 'მისამართი რუკაზე'}</small><span>ფილიალის გვერდი ↗</span></a>)}</div>
    <Card><h2>როგორ შეარჩიო ფილიალი და პროდუქტი</h2><p class="brand-directory-body">კატალოგში მოდელის სახელით შეამოწმე ფასი და გახსენი ოფიციალური პროდუქტის გვერდი. ფილიალში მისვლამდე გადაამოწმე მარაგი, საგარანტიო პირობები და მიღების შესაძლებლობა. აქ მოცემული ონლაინ ფასები ყველა ფილიალის მარაგის არსებობას არ ნიშნავს.</p><a href={merchant.website} target="_blank" rel="noopener noreferrer">წყარო: {merchant.website}</a></Card>
  </div>;
}
