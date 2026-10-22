import { useState } from 'preact/hooks';
import { Icon } from '../../ui/Icon.jsx';
import { Img } from '../../ui/misc.jsx';
import { Button } from '../../ui/Button.jsx';
import { Lightbox } from '../post/Lightbox.jsx';
import { importedPlaceEntries } from '../../lib/importedPlacePosts.js';
import '../../styles/imported-place-info.css';

function DirectoryHeader({ entry, photos = false }) {
  return <header><span class="imported-source-post-icon"><Icon name={photos ? 'images' : 'map-trifold'} size={23}/></span><span><strong>GeoHub-ის ცნობარი</strong><small>{photos ? 'ფოტოამბავი · წყაროების მიხედვით' : `${entry.locationHeld ? 'მდებარეობა გადასამოწმებელია' : 'ინფორმაცია წყაროების მიხედვით'}${entry.isImported ? ' · OpenStreetMap' : ''}${entry.sourceDate ? ` · ${entry.sourceDateKind}: ${entry.sourceDate}` : ''}`}</small></span><span class="imported-source-badge">ცნობარი</span></header>;
}
function DirectoryPhotos({ entry }) {
  const [active, setActive] = useState(-1);
  return <article class="card card-pad imported-source-post imported-photo-post" data-place-id={entry.placeId}>
    <DirectoryHeader entry={entry} photos/>
    <h3><a href={entry.placeHref}>{entry.name} — ფოტოამბავი</a></h3>
    <p class="imported-source-disclosure">საჯარო წყაროებიდან შეკრებილი ფოტოები ავტორებითა და ცნობილი გადაღების თარიღებით.</p>
    <div class={`imported-source-photos${entry.photos.length === 1 ? ' is-single' : ''}`}>
      {entry.photos.map((photo, index) => <figure key={photo.url}>
        <button type="button" class="imported-source-photo-open" onClick={() => setActive(index)} aria-label={`${photo.caption} — ფოტოს გახსნა`}><Img src={photo.url} width={800} alt={photo.caption}/><span><Icon name="magnifying-glass" size={17}/></span></button>
        <figcaption><strong>{photo.caption}</strong><span>{photo.dateLabel} · {photo.rights === 'source-published' ? 'გამომქვეყნებელი: ' : ''}{photo.authorUrl ? <a href={photo.authorUrl} target="_blank" rel="noopener noreferrer">{photo.author}</a> : photo.author}</span><span><a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">ფოტოს წყარო</a> · {photo.rights === 'source-published' ? 'გამომქვეყნებლის ცნობარის ფოტო' : <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a>}</span></figcaption>
      </figure>)}
    </div>
    <p class="muted small">ფოტო ასახავს გადაღების დროინდელ მდგომარეობას. პრევიუ შემცირებულია და ჩარჩოზეა მორგებული.</p>
    {active >= 0 && <Lightbox media={entry.photos.map(photo => photo.url)} index={active} onClose={() => setActive(-1)}/>}
  </article>;
}

/** Source-based information cards kept out of social posts and engagement counts. */
export function ImportedPlacePosts({ place, includePhotos = true }) {
  const entry = importedPlaceEntries(place);
  if (!entry) return null;
  return <section class="imported-directory-feed" aria-label="GeoHub-ის ცნობარი და ფოტოამბები">
    {entry.reviewNotice && <p class="imported-source-disclosure" role="status">{entry.reviewNotice}</p>}
    {entry.editorialPosts.map((post, index) => <article key={index} class="card card-pad imported-source-post imported-editorial-post" data-place-id={entry.placeId}><DirectoryHeader entry={entry}/><h3>{post.title}</h3><p>{post.body}</p>{post.sourceUrl && <a class="imported-source-post-link" href={post.sourceUrl} target="_blank" rel="noopener noreferrer">ინფორმაციის წყარო<Icon name="arrow-up-right" size={15}/></a>}</article>)}
    {includePhotos && entry.photos.length > 0 && <DirectoryPhotos key={entry.placeId} entry={entry}/>}
    <article class="card card-pad imported-source-post imported-visitor-post" data-place-id={entry.placeId}>
      <DirectoryHeader entry={entry}/>
      <h3><a href={entry.placeHref}>{entry.name} — სასარგებლო ინფორმაცია</a></h3>
      {entry.description && <p>{entry.description}</p>}
      <dl class="imported-source-fact-list">{entry.facts.map((fact,index) => <div key={`${fact.label}:${index}`}><dt><Icon name={fact.icon} size={18}/>{fact.label}</dt><dd>{fact.href ? <a href={fact.href} target={fact.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{fact.value}</a> : fact.value}</dd></div>)}</dl>
      {entry.amenities.length > 0 && <ul class="imported-place-facets" aria-label="წყაროში მითითებული მახასიათებლები">{entry.amenities.map(label => <li key={label}>{label}</li>)}</ul>}
      <p class="imported-source-disclosure">GeoHub-ის ცნობარის ინფორმაცია წყაროს მონაცემებს ეყრდნობა. საათები და სხვა დეტალები ადგილზე შეიძლება შეცვლილი იყოს.</p>
      <div class="imported-source-actions">{entry.mapHref && <Button variant="soft" icon="map-trifold" href={entry.mapHref}>რუკაზე ნახვა</Button>}{entry.sourceUrl && <a class="imported-source-post-link" href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">წყაროს ჩანაწერი<Icon name="arrow-up-right" size={15}/></a>}</div>
      {(entry.sourceDates.length > 0 || entry.isImported) && <footer>{entry.sourceDates.map(date => <span key={date.label}>{date.label}: {date.value}</span>)}{entry.isImported && <span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL</a></span>}</footer>}
    </article>
    {entry.guide && <article class="card card-pad imported-source-post imported-guide-post" data-place-id={entry.placeId}><DirectoryHeader entry={entry}/><h3>{entry.guide.title}</h3><ul class="imported-guide-list">{entry.guide.points.map(point => <li key={point}>{point}</li>)}</ul><p class="imported-source-disclosure">{entry.guide.disclosure}</p></article>}
  </section>;
}
