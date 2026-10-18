import { useState } from 'preact/hooks';
import { Icon } from '../../ui/Icon.jsx';
import { Button } from '../../ui/Button.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { Img } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { formatCommercePrice, discountPercent, DEMO_OFFER_LABEL } from '../../lib/commerce.js';

export const ITEM_ICONS = { product: 'shopping-bag', dish: 'fork-knife', service: 'wrench', bundle: 'gift' };
export function OfferCard({ offer }) {
  const [open, setOpen] = useState(false);
  const pct = discountPercent(offer.originalPriceMinor, offer.priceMinor);
  const price = formatCommercePrice(offer.priceMinor, offer.currency);
  const old = formatCommercePrice(offer.originalPriceMinor, offer.currency);
  const end = offer.endsAtMs ? new Intl.DateTimeFormat('ka-GE', { day: 'numeric', month: 'short', timeZone: 'Asia/Tbilisi' }).format(offer.endsAtMs) : '';
  const image = /^https:\/\//i.test(offer.imageUrl || '') || (offer.isDemo && /^\/demo-media\/[\w.-]+$/.test(offer.imageUrl || '')) ? offer.imageUrl : '';
  const businessName = offer.businessName || t('nav.business');
  const logo = /^https:\/\//i.test(offer.businessImageUrl || '') ? offer.businessImageUrl : '';
  const initials = businessName.trim().split(/\s+/).slice(0, 2).map((word) => [...word][0]).join('');
  const logoFallback = <span class="deal-brand-initials" role="img" aria-label={businessName}>{initials}</span>;
  const artwork = <div class="deal-art" style={{ '--deal-tone': offer.tone || 'var(--brand)' }}>
    {image ? <Img src={image} width={640} alt={offer.isDemo ? offer.photoCredit?.caption || 'საილუსტრაციო ფოტო' : ''} eager={open} /> : <><span class="deal-art-ring" /><Icon name={offer.icon || ITEM_ICONS[offer.type] || 'tag'} size={76} /><span class="deal-art-caption">{t(`commerce.type.${offer.type}`)}</span></>}
    {offer.isDemo && image && <span class="deal-illustration-label">საილუსტრაციო ფოტო</span>}
    <span class="deal-corner"><span class="deal-brand-logo" title={businessName}>{logo ? <Img src={logo} width={96} alt={businessName} fallback={logoFallback} /> : logoFallback}</span><span class="deal-percent">−{pct}%</span></span>
  </div>;
  return <>
    <article class="deal-card">
      <button class="deal-open" type="button" onClick={() => setOpen(true)} aria-label={t('deals.open', { name: offer.title })}>
        {artwork}
        <div class="deal-card-body">
          <span class="deal-business">{offer.businessName || t('nav.business')}</span>
          <h2>{offer.title}</h2>
          <p class="deal-description">{offer.description || offer.conditions}</p>
          <div class="deal-prices"><strong>{price}</strong><del>{old}</del></div>
          <div class="deal-meta"><Icon name="clock" size={15} /><span>{offer.isDemo ? t('deals.example') : t('deals.until', { date: end })}</span></div>
        </div>
      </button>
      {offer.isDemo && <><p class="deal-demo-label"><Icon name="info" size={15} />{DEMO_OFFER_LABEL}</p>{offer.photoCredit && <div class="deal-photo-credit">© {offer.photoCredit.author} · <a href={offer.photoCredit.licenseUrl} target="_blank" rel="noopener noreferrer">{offer.photoCredit.license}</a> · <a href={offer.photoCredit.sourceUrl} target="_blank" rel="noopener noreferrer">წყარო</a></div>}</>}
    </article>
    {open && <Modal open onClose={() => setOpen(false)} title={offer.title} size="md">
      <div class="stack deal-detail">
        {offer.isDemo && <p class="deal-demo-label">{DEMO_OFFER_LABEL}</p>}
        {artwork}
        <p class="muted">{offer.businessName}</p>
        <div class="deal-prices"><strong>{price}</strong><del>{old}</del><span class="tag tag-success">−{pct}%</span></div>
        {offer.description && <p>{offer.description}</p>}
        {offer.preparationMinutes > 0 && <p><Icon name="clock" size={17} /> {t('commerce.prepValue', { n: offer.preparationMinutes })}</p>}
        <div class="deal-conditions"><h3>{t('deals.conditions')}</h3><p>{offer.conditions || t('deals.askBusiness')}</p>
          {!offer.isDemo && <p>{t('deals.until', { date: end })}</p>}
          <p>{offer.isDemo ? 'გამოგონილი მაგალითი — რეალურ ფილიალს ან მარაგს არ უკავშირდება.' : offer.allBranches ? t('deals.allBranches') : t('deals.selectedBranches', { n: offer.branchIds?.length || 0 })}</p>
        </div>
        {!offer.isDemo && offer.businessId && <Button variant="primary" href={`/business/${encodeURIComponent(offer.businessId)}?tab=catalog&item=${encodeURIComponent(offer.itemId)}`}>{t('deals.businessPage')}</Button>}
        {offer.isDemo && offer.demoPageHref && <Button variant="primary" href={`${offer.demoPageHref}?item=${encodeURIComponent(offer.itemId)}`}>დემო გვერდისა და კატალოგის ნახვა</Button>}
        {offer.isDemo && offer.photoCredit && <div class="deal-photo-credit">{offer.photoCredit.caption} · © {offer.photoCredit.author} · <a href={offer.photoCredit.licenseUrl} target="_blank" rel="noopener noreferrer">{offer.photoCredit.license}</a> · <a href={offer.photoCredit.sourceUrl} target="_blank" rel="noopener noreferrer">ორიგინალი ფოტო</a></div>}
      </div>
    </Modal>}
  </>;
}
