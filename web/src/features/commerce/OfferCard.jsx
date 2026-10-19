import { useState } from 'preact/hooks';
import { Icon } from '../../ui/Icon.jsx';
import { Button } from '../../ui/Button.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { Img } from '../../ui/misc.jsx';
import { PlaceBrand } from '../places/PlaceBrand.jsx';
import { placeBrand } from '../../lib/placeBrands.js';
import { t } from '../../lib/i18n.js';
import { formatCommercePrice, discountPercent, DEMO_OFFER_LABEL } from '../../lib/commerce.js';

export const ITEM_ICONS = { product: 'shopping-bag', dish: 'fork-knife', service: 'wrench', bundle: 'gift' };
export function OfferCard({ offer }) {
  const [open, setOpen] = useState(false);
  const pct = discountPercent(offer.originalPriceMinor, offer.priceMinor);
  const price = formatCommercePrice(offer.priceMinor, offer.currency), old = formatCommercePrice(offer.originalPriceMinor, offer.currency);
  const official = offer.sourceKind === 'official-website';
  const stamp = official ? offer.observedAtMs : offer.endsAtMs;
  const date = stamp ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Tbilisi' }).format(stamp).replaceAll('/', '.') : '';
  const image = /^https:\/\//i.test(offer.imageUrl || '') || (offer.isDemo && /^\/demo-media\/[\w.-]+$/.test(offer.imageUrl || '')) ? offer.imageUrl : '';
  const businessName = offer.businessName || t('nav.business');
  const businessHref = official && /^\/brands\/[a-z0-9-]+$/.test(offer.merchantHref || '') ? `${offer.merchantHref}?item=${encodeURIComponent(offer.itemId)}` : offer.isDemo ? offer.demoPageHref : offer.businessId ? `/business/${encodeURIComponent(offer.businessId)}?tab=catalog&item=${encodeURIComponent(offer.itemId)}` : '';
  const identity = { name: businessName, category: offer.businessCategory || offer.categoryId || '', raw: { brand: businessName } };
  const knownBrand = placeBrand(identity);
  const logo = /^https:\/\//i.test(offer.businessImageUrl || '') ? offer.businessImageUrl : '';
  const initials = businessName.trim().split(/\s+/).slice(0, 2).map(word => [...word][0]).join('');
  const brandMark = knownBrand ? <PlaceBrand place={identity} size="heading"/> : <span class="deal-brand-logo">{logo ? <Img src={logo} width={96} alt={businessName}/> : <span class="deal-brand-initials">{initials}</span>}</span>;
  const artwork = <div class={`deal-art${official ? ' is-product-photo' : ''}`} style={{ '--deal-tone': offer.tone || 'var(--brand)' }}>
    {image ? <Img src={image} width={640} alt={offer.isDemo ? offer.photoCredit?.caption || 'საილუსტრაციო ფოტო' : offer.title}/> : <><span class="deal-art-ring"/><Icon name={offer.icon || ITEM_ICONS[offer.type] || 'tag'} size={60}/></>}
    {offer.isDemo && image && <span class="deal-illustration-label">საილუსტრაციო ფოტო</span>}
  </div>;
  const merchantLink = (className = 'deal-merchant-link') => businessHref ? <a class={className} href={businessHref}>{brandMark}<span>{businessName}</span><Icon name="arrow-up-right" size={15}/></a> : <span class={className}>{brandMark}<span>{businessName}</span></span>;
  return <>
    <article class="deal-card deal-horizontal">
      <div class="deal-layout">
        <button class="deal-open deal-photo-button" type="button" onClick={() => setOpen(true)} aria-label={t('deals.open', { name: offer.title })}>{artwork}</button>
        <div class="deal-card-body">
          <div class="deal-merchant-row">{merchantLink()}<span class="deal-percent">−{pct}%</span></div>
          <button class="deal-title-button" type="button" onClick={() => setOpen(true)}><h2>{offer.title}</h2></button>
          <p class="deal-description">{offer.description || offer.conditions}</p>
          <div class="deal-prices"><strong>{price}</strong><del>{old}</del></div>
          <div class="deal-meta"><Icon name={official ? 'globe-simple' : 'clock'} size={15}/><span>{offer.isDemo ? t('deals.example') : official ? `ონლაინ ფასი · შემოწმდა ${date}` : t('deals.until', { date })}</span></div>
          <div class="deal-card-actions">{businessHref && <a href={businessHref}>მაღაზიის გვერდი<Icon name="arrow-up-right" size={14}/></a>}<button type="button" onClick={() => setOpen(true)}>დეტალები</button></div>
        </div>
      </div>
      {offer.isDemo && <p class="deal-demo-label"><Icon name="info" size={15}/>{DEMO_OFFER_LABEL}</p>}
      {official && <div class="deal-source-line"><a href={offer.sourceUrl} target="_blank" rel="noopener noreferrer">ფოტო და ფასი: {offer.sourceName}<Icon name="arrow-up-right" size={12}/></a><span>ფილიალის მარაგი გადაამოწმე</span></div>}
    </article>
    {open && <Modal open onClose={() => setOpen(false)} title={offer.title} size="md"><div class="stack deal-detail">
      {offer.isDemo && <p class="deal-demo-label">{DEMO_OFFER_LABEL}</p>}
      {artwork}{merchantLink()}
      <div class="deal-prices"><strong>{price}</strong><del>{old}</del><span class="tag tag-success">−{pct}%</span></div>
      {offer.description && <p>{offer.description}</p>}
      {offer.preparationMinutes > 0 && <p><Icon name="clock" size={17}/> {t('commerce.prepValue', { n: offer.preparationMinutes })}</p>}
      <div class="deal-conditions"><h3>{t('deals.conditions')}</h3><p>{offer.conditions || t('deals.askBusiness')}</p>
        {official ? <p>წყარო შემოწმდა {date}. აქციის დასრულების თარიღი GeoHub-ში დადასტურებული არ არის. ფასი და მარაგი შეძენამდე გადაამოწმე.</p> : !offer.isDemo && <p>{t('deals.until', { date })}</p>}
      </div>
      {businessHref && <Button variant="primary" href={businessHref}>მაღაზიის გვერდზე გადასვლა</Button>}
      {official && <Button variant="secondary" icon="arrow-up-right" href={offer.sourceUrl} target="_blank" rel="noopener noreferrer">პროდუქტი ოფიციალურ საიტზე</Button>}
      {offer.isDemo && offer.photoCredit && <div class="deal-photo-credit">© {offer.photoCredit.author} · <a href={offer.photoCredit.licenseUrl} target="_blank" rel="noopener noreferrer">{offer.photoCredit.license}</a> · <a href={offer.photoCredit.sourceUrl} target="_blank" rel="noopener noreferrer">ორიგინალი ფოტო</a></div>}
    </div></Modal>}
  </>;
}
