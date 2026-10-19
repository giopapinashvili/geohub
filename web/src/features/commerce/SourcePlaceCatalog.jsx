import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Img } from '../../ui/misc.jsx';
import { rankRecords } from '../../lib/discoverySearch.js';
import { normalizeCatalogQuery } from '../../lib/catalogSearchTerms.js';
import { sourceCatalogPriceLabel } from '../../lib/sourceCatalogPresentation.js';
import { formatCommercePrice } from '../../lib/commerce.js';
import { query } from '../../lib/router.js';
import { sourceHttpsUrl } from '../../data/sourceCatalogs.js';
import '../../styles/source-catalog.css';

const DIETS = {vegan:'ვეგანური',vegetarian:'ვეგეტარიანული',halal:'ჰალალი',kosher:'კოშერი','gluten-free':'უგლუტენო','dairy-free':'რძის გარეშე','lactose-free':'ლაქტოზის გარეშე'};

function CatalogItem({ item, catalog, focused }) {
  const sourceUrl = sourceHttpsUrl(item.sourceUrl) || catalog.sourceUrl;
  const options = (item.optionGroups || []).map(group => ({...catalog.optionGroups?.find(entry=>entry.id===group.id),...group})).filter(group=>group.values?.length);
  const expired = catalog.freshnessUntilMs && catalog.freshnessUntilMs < Date.now();
  return <article class={`directory-catalog-item${focused ? ' is-focused' : ''}${item.imageUrl ? '' : ' is-text-only'}`} data-source-item={item.id} data-item-kind={item.kind}>
    {item.imageUrl && <div class="directory-catalog-photo"><Img src={item.imageUrl} width={400} alt={item.name} fallback={<span class="directory-photo-missing">ფოტო ვერ ჩაიტვირთა</span>}/></div>}
    <div class="directory-catalog-item-body">
      <h3>{item.name}</h3>
      {item.categoryIds?.length > 0 && <small>{item.categoryIds.map(id=>catalog.categories.find(category=>category.id===id)?.name).filter(Boolean).join(' · ')}</small>}
      {item.unitInfo && <small>{item.unitInfo}</small>}
      {item.dietarySource === 'publisher-declared' && item.dietaryTags?.some(tag=>DIETS[tag]) && <small class="directory-catalog-diet">წყაროს მითითებით: {item.dietaryTags.map(tag=>DIETS[tag]).filter(Boolean).join(' · ')}</small>}
      {item.description && <details class="directory-item-description"><summary>{item.kind === 'dish' ? 'შემადგენლობა და დეტალები' : 'დეტალები'}</summary><p>{item.description}</p></details>}
      <strong class="directory-catalog-price">{sourceCatalogPriceLabel(item)}</strong>
      {item.priceType === 'base-with-required-options' && <small>საწყისი ფასი — სავალდებულო არჩევანმა შეიძლება ფასი შეცვალოს.</small>}
      {options.length > 0 && <details class="directory-item-description directory-item-options"><summary>არჩევანი და დანამატები</summary>{options.map(group=><div key={group.id}><strong>{group.name}</strong>{group.min > 0 && <small>სავალდებულო არჩევანი: მინიმუმ {group.min}</small>}{group.freeSelections > 0 && <small>ფასში შედის {group.freeSelections} არჩევანი.</small>}{group.prerequisiteValueIds?.length > 0 && <small>ხელმისაწვდომობა წინა არჩევანზეა დამოკიდებული.</small>}<ul>{group.values.map(value=><li key={value.id}><span>{value.name}</span><b>{expired || !Number.isSafeInteger(value.priceMinor) ? 'ფასი დასაზუსტებელია' : `${value.priceMinor < 0 ? '−' : '+'}${formatCommercePrice(Math.abs(value.priceMinor),'GEL')}`}</b></li>)}</ul></div>)}</details>}
      {item.sellByWeight?.gramsPerStep > 0 && <small>წონით · ნაბიჯი {item.sellByWeight.gramsPerStep} გ</small>}
      {item.minQuantity > 1 && <small>მინიმალური რაოდენობა: {item.minQuantity}</small>}
      {item.sourceAvailability === 'unavailable' && <small>შემოწმებისას წყაროზე მიუწვდომელი იყო.</small>}
      {item.availabilityNote && <small>{item.availabilityNote}</small>}
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer">წყაროს ნახვა<Icon name="arrow-up-right" size={14}/></a>
    </div>
  </article>;
}

export function SourcePlaceCatalog({ catalog, place }) {
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState(18);
  const container = useRef(null);
  const focusItem = place.itemId || query.value.get('item') || '';
  const heading = catalog.kind === 'menu' ? 'მენიუ' : catalog.kind === 'services' ? 'სერვისები' : 'პროდუქტები';
  const found = useMemo(() => {
    const rows = catalog.items.filter(item => !category || item.categoryIds.includes(category));
    const matches = term.trim() ? rankRecords(rows.map(item=>({...item,aliases:[normalizeCatalogQuery(item.name)]})), normalizeCatalogQuery(term), { limit: rows.length }) : rows;
    return matches.slice().sort((a, b) => Number(b.id === focusItem) - Number(a.id === focusItem));
  }, [catalog, term, category, focusItem]);
  useEffect(() => { setTerm(''); setCategory(''); setLimit(18); }, [catalog.venueId, catalog.placeId]);
  useEffect(() => {
    if (!focusItem) return;
    const frame = requestAnimationFrame(() => {
      const target = [...(container.current?.querySelectorAll('[data-source-item]') || [])].find(element => element.dataset.sourceItem === focusItem);
      target?.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusItem, catalog]);
  const checkedAt = (catalog.fetchedAt || catalog.sourceCheckedAt || '').slice(0, 10);
  const sourceName = catalog.sourceName || (catalog.priceContext === 'delivery-marketplace' ? 'Wolt' : 'ოფიციალური წყარო');
  return <section class="directory-catalog" ref={container} aria-label={`${place.name} — ${heading}`}>
    <header class="directory-catalog-heading"><div><span>{sourceName}</span><h2>{heading}<small>{catalog.items.length}</small></h2></div><Icon name={catalog.kind === 'menu' ? 'fork-knife' : catalog.kind === 'services' ? 'wrench' : 'shopping-bag'} size={26}/></header>
    <p class="directory-catalog-context">{catalog.priceContext === 'delivery-marketplace' ? 'ფასები Wolt-ის მენიუდანაა; ადგილზე ფასი და ხელმისაწვდომობა შეიძლება განსხვავდებოდეს.' : catalog.note || 'მომსახურების პირობები და ხელმისაწვდომობა გადაამოწმე მომწოდებელთან.'} {checkedAt && <>შემოწმებულია <time dateTime={checkedAt}>{checkedAt.split('-').reverse().join('.')}</time>.</>}</p>
    {catalog.status === 'partial' && <p class="directory-catalog-context">{catalog.items.length ? 'ჩატვირთულია კატალოგის ნაწილი.' : 'კატალოგი შევსების პროცესშია.'} სრული არჩევანი წყაროს ბმულზე ნახე.</p>}
    {catalog.freshnessUntilMs && catalog.freshnessUntilMs < Date.now() && <p class="directory-catalog-context">ფასები განახლებას ელოდება — მიმდინარე ფასი წყაროს ბმულზე გადაამოწმე.</p>}
    {catalog.items.length > 0 && <div class="directory-catalog-search"><Icon name="magnifying-glass" size={19}/><input type="search" aria-label={`${heading} — ძიება`} value={term} placeholder={catalog.kind === 'menu' ? 'მოძებნე კერძი…' : catalog.kind === 'services' ? 'მოძებნე სერვისი…' : 'მოძებნე პროდუქტი…'} onInput={event => { setTerm(event.currentTarget.value); setLimit(18); }}/></div>}
    {catalog.categories.length > 1 && <div class="directory-catalog-categories" aria-label="კატალოგის კატეგორიები"><button type="button" aria-pressed={!category} onClick={() => {setCategory('');setLimit(18);}}>ყველა</button>{catalog.categories.map(entry => <button key={entry.id} type="button" aria-pressed={category === entry.id} onClick={() => {setCategory(entry.id);setLimit(18);}}>{entry.name}</button>)}</div>}
    <p class="directory-catalog-count" role="status">{found.length} {catalog.kind === 'services' ? 'სერვისი' : 'ჩანაწერი'}{found.some(item => item.searchMatch === 'fuzzy') ? ' · ნაპოვნია მსგავსი სახელებიც' : ''}</p>
    <div class="directory-catalog-grid">{found.slice(0, limit).map(item => <CatalogItem key={item.id} item={item} catalog={catalog} focused={item.id === focusItem}/>)}</div>
    {!found.length && <div class="directory-catalog-empty"><p>{catalog.items.length ? 'ასეთი ჩანაწერი ამ კატალოგში ვერ მოიძებნა.' : 'ტექსტური კატალოგი ჯერ შევსებას ელოდება. არჩევანი წყაროს ბმულზე ნახე.'}</p>{catalog.items.length > 0 && <Button variant="ghost" onClick={() => {setTerm('');setCategory('');}}>ყველას ნახვა</Button>}</div>}
    {found.length > limit && <div class="center-pad"><Button variant="secondary" onClick={() => setLimit(value => value + 30)}>მეტის ჩვენება · {found.length - limit}</Button></div>}
    <footer><a href={catalog.sourceUrl} target="_blank" rel="noopener noreferrer">{sourceName} — სრული კატალოგი<Icon name="arrow-up-right" size={15}/></a><span>ფოტოები და ინფორმაცია: გამომქვეყნებლის კატალოგი</span></footer>
  </section>;
}
