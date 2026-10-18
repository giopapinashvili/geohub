import { useEffect, useRef } from 'preact/hooks';
import { getDemoMerchant, DEMO_BATCH_ID } from '../features/commerce/demo.js';
import { OfferCard, ITEM_ICONS } from '../features/commerce/OfferCard.jsx';
import { Button } from '../ui/Button.jsx';
import { Card, Empty, Img } from '../ui/misc.jsx';
import { Icon } from '../ui/Icon.jsx';
import { useTitle } from '../lib/hooks.js';
import { query } from '../lib/router.js';
import { formatCommercePrice } from '../lib/commerce.js';
import '../styles/commerce.css';

/** Static fictional examples never enter business, map or social collections. */
export default function DemoMerchant({ params }) {
  const merchant = getDemoMerchant(params.id), itemRef = useRef(null);
  const focused = merchant && query.value.get('item') === merchant.item.id;
  useTitle(merchant?.name || 'დემო გვერდი');
  useEffect(() => { if (focused) itemRef.current?.scrollIntoView({ block: 'center' }); }, [params.id, focused]);
  if (!merchant) return <Card><Empty icon="storefront" title="დემო გვერდი ვერ მოიძებნა" action={<Button href="/discounts?mode=demo">დემო შეთავაზებები</Button>}/></Card>;
  const { media, item, offer } = merchant;
  return <div class="page-pad demo-merchant-page" data-demo-batch={DEMO_BATCH_ID}>
    <Button variant="ghost" icon="arrow-left" href="/discounts?mode=demo">დემო შეთავაზებები</Button>
    <p class="deals-notice"><Icon name="info" size={22}/><span><strong>სადემონსტრაციო გვერდი — გამოგონილი ბიზნესი</strong><br/>სახელი, ფასები და შეთავაზება მხოლოდ GeoHub-ის მუშაობის საჩვენებლადაა. ეს არ არის მოქმედი მაღაზია; შეძენა, დაჯავშნა და ჩექინი შეუძლებელია.</span></p>
    <Card class="demo-merchant-hero" pad={false}>
      <div class="demo-merchant-cover"><Img src={media.url} width={1000} alt={media.caption} eager fetchpriority="high"/><span>საილუსტრაციო ფოტო · გამოგონილი ბიზნესი</span></div>
      <div class="demo-merchant-head"><span class="demo-merchant-logo" style={{ '--demo-tone': merchant.tone }}><Icon name={merchant.icon} size={28}/></span><div><span class="deals-eyebrow">GEOHUB · დემო</span><h1>{merchant.name}</h1><p>{merchant.label} · საჩვენებელი გვერდი</p></div></div>
      <p class="demo-merchant-about">{merchant.about}</p>
      <details class="demo-media-credit"><summary>ფოტოს წყარო და ავტორი</summary><p>{media.caption}</p><p>© {media.author} · {media.dateTaken} · <a href={media.licenseUrl} target="_blank" rel="noopener noreferrer">{media.license}</a> · <a href={media.sourceUrl} target="_blank" rel="noopener noreferrer">ორიგინალი ფოტო</a></p><p>პრევიუ შემცირებულია და ჩარჩოზეა მორგებული.</p></details>
    </Card>
    <nav class="demo-merchant-sections" aria-label="დემო გვერდის განყოფილებები"><a href="#demo-catalog">{merchant.label}</a><a href="#demo-post">საჩვენებელი პოსტი</a><a href="#demo-offer">ფასდაკლების მაგალითი</a></nav>
    <section id="demo-catalog" class="demo-catalog-section"><h2>{merchant.label}</h2><p class="muted small">კატალოგის მაგალითი · ყველა ფასი და დეტალი სადემონსტრაციოა.</p>
      <article ref={itemRef} class={`card demo-catalog-item${focused ? ' is-focused' : ''}`} data-item-id={item.id}>
        <div class="demo-catalog-image"><Img src={media.url} width={640} alt={media.caption}/><span>საილუსტრაციო ფოტო</span></div>
        <div class="demo-catalog-body"><span class="demo-catalog-type"><Icon name={ITEM_ICONS[item.type]} size={18}/>{merchant.label} · დემო</span><h3>{item.title}</h3><p>{item.description}</p><ul>{merchant.itemDetails.map(detail => <li key={detail}>{detail}</li>)}</ul><p class="demo-catalog-price"><strong>{formatCommercePrice(item.priceMinor, item.currency)}</strong><span>საჩვენებელი საბაზისო ფასი</span></p>{item.preparationMinutes && <p><Icon name="clock" size={16}/> მომზადების მაგალითი: {item.preparationMinutes} წუთი</p>}<a class="link" href="#demo-offer">ამ ჩანაწერის ფასდაკლების მაგალითი <Icon name="arrow-down" size={15}/></a></div>
      </article>
    </section>
    <Card id="demo-post" class="demo-merchant-post"><span class="deals-eyebrow"><Icon name="note-pencil" size={17}/> GEOHUB · საჩვენებელი პოსტი</span><h2>გაიცანი ჩვენი {item.type === 'dish' ? 'მენიუს' : 'კატალოგის'} მაგალითი</h2><p>„{item.title}“ დაკავშირებულია ქვემოთ მოცემულ ფასდაკლებასთან. რეალურ ბიზნესს შეეძლება თავის გვერდზე შეავსოს პროდუქტის ან სერვისის ინფორმაცია და შემდეგ სწორედ მასზე შექმნას შეთავაზება.</p></Card>
    <section id="demo-offer" class="demo-merchant-offer"><h2>ფასდაკლების მაგალითი</h2><p class="muted small">შეთავაზება უკავშირდება ზემოთ მოცემულ კატალოგის ჩანაწერს.</p><OfferCard offer={offer}/></section>
  </div>;
}
