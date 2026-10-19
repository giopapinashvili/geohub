import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../../ui/Icon.jsx';
import { Button } from '../../ui/Button.jsx';
import { Spinner } from '../../ui/misc.jsx';
import { getImportedManifest, getImportedPlace } from '../../data/importedPlaces.js';
import { taxonomyCategory } from '../../lib/placeTaxonomy.js';
import '../../styles/imported-place-info.css';

const DIETS = {vegan:'ვეგანური არჩევანი',vegetarian:'ვეგეტარიანული არჩევანი',halal:'ჰალალის არჩევანი',kosher:'კოშერის არჩევანი','gluten-free':'უგლუტენო არჩევანი','lactose-free':'ლაქტოზის გარეშე'};
function httpUrl(value) {
  try { const url=new URL(value); return ['http:','https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
function date(value) {
  const parsed=new Date(value);
  return Number.isFinite(parsed.getTime()) ? `${String(parsed.getUTCDate()).padStart(2,'0')}.${String(parsed.getUTCMonth()+1).padStart(2,'0')}.${parsed.getUTCFullYear()}` : '';
}

function MallDirectory({ place }) {
  const [open,setOpen]=useState(false);
  const [state,setState]=useState({records:[],loading:false,failed:0});
  const [limit,setLimit]=useState(30);
  const [retry,setRetry]=useState(0);
  const ids=place.raw.tenantIds || [];
  useEffect(()=>{ setOpen(false); setLimit(30); setState({records:[],loading:false,failed:0}); },[place.id]);
  useEffect(()=>{
    if (!open || !ids.length) return;
    let alive=true;
    setState(previous=>({...previous,loading:true}));
    Promise.allSettled(ids.map(getImportedPlace)).then(results=>{
      if (!alive) return;
      const records=results.filter(result=>result.status==='fulfilled' && result.value).map(result=>result.value).sort((a,b)=>a.name.localeCompare(b.name,'ka'));
      setState({records,loading:false,failed:results.length-records.length});
    });
    return ()=>{alive=false;};
  },[place.id,open,retry]);
  if (place.category!=='mall') return null;
  return (
    <div class="imported-mall-directory">
      <h3>რა არის შიგნით</h3>
      {ids.length ? <>
        <p class="muted small">წყაროში მონიშნულია {ids.length} ობიექტი ამ შენობაში. სია შეიძლება არასრული იყოს.</p>
        <Button variant="secondary" size="sm" icon="storefront" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open ? 'სიის დახურვა' : 'მაღაზიებისა და სერვისების ნახვა'}</Button>
        {open && <div class="imported-mall-list">
          {state.loading ? <Spinner /> : <>
            {state.records.slice(0,limit).map(tenant=><a key={tenant.id} href={`/place/${tenant.id}`}><Icon name={taxonomyCategory(tenant.category).icon} size={20} /><span><strong>{tenant.name}</strong><small>{taxonomyCategory(tenant.category).label}{tenant.facets?.level ? ` · სართული ${tenant.facets.level}` : ''}</small></span><Icon name="arrow-up-right" size={15}/></a>)}
            {state.records.length>limit && <Button variant="ghost" size="sm" onClick={()=>setLimit(value=>value+30)}>მეტის ჩვენება</Button>}
            {state.failed>0 && <div class="imported-place-retry" role="status"><span>ზოგი ობიექტი ვერ ჩაიტვირთა.</span><Button variant="ghost" size="sm" onClick={()=>setRetry(value=>value+1)}>ხელახლა ცდა</Button></div>}
          </>}
        </div>}
      </> : <p class="muted small">ამ სავაჭრო ცენტრის შიდა ობიექტების სია წყაროში ჯერ არ არის შევსებული.</p>}
    </div>
  );
}

function SourceDetails({ place }) {
  const [manifest,setManifest]=useState(null);
  const [error,setError]=useState(false);
  const load=()=>{ setError(false); getImportedManifest().then(setManifest).catch(()=>setError(true)); };
  const raw=place.raw;
  const url=httpUrl(raw.linkedSourceUrl || raw.sourceUrl);
  return (
    <details class="imported-place-source" onToggle={event=>{if(event.currentTarget.open && !manifest)load();}}>
      <summary><Icon name="info" size={16}/><span>წყარო და მონაცემების მდგომარეობა</span></summary>
      <div class="imported-place-source-body">
        <p>{url ? <a href={url} target="_blank" rel="noopener noreferrer">OpenStreetMap-ის ჩანაწერი <Icon name="arrow-up-right" size={12}/></a> : 'OpenStreetMap'} · ნაკრები: {date(raw.sourceDate)}</p>
        {raw.sourceUpdatedAt && <p>ამ ჩანაწერის ბოლო ცვლილება წყაროში: {date(raw.sourceUpdatedAt)}</p>}
        <p>საათები, საკონტაქტო ინფორმაცია და ობიექტის მდგომარეობა წყაროს მონაცემებს ეყრდნობა; ამ გვერდის შექმნა მათ ადგილზე გადამოწმებას არ ნიშნავს.</p>
        {manifest && <p>თბილისისა და შემოგარენის ამ ნაკრებშია {manifest.totalPlaces.toLocaleString('ka-GE')} ობიექტი, {manifest.addressCount.toLocaleString('ka-GE')} მისამართი და {manifest.streetCount.toLocaleString('ka-GE')} ქუჩის სახელი. დაფარვა დამოკიდებულია OpenStreetMap-ში შევსებულ ინფორმაციაზე.</p>}
        {error && <button type="button" class="link" onClick={load}>ნაკრების ინფორმაციის ხელახლა ჩატვირთვა</button>}
        <p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL</a></p>
      </div>
    </details>
  );
}

/** Facts imported from an attributed snapshot. Never fabricates reviews/photos. */
export function ImportedPlaceInfo({ place, showFacts=true }) {
  if (!place?.raw || (!['openstreetmap','official-directory'].includes(place.raw.source) && !place.raw.linkedOsmId)) return null;
  const raw=place.raw;
  const facets=place.facets || {};
  const website=httpUrl(raw.website);
  const phone=typeof raw.phone==='string' ? raw.phone.split(';')[0].trim() : '';
  const telephone=phone.replace(/[^\d+]/g,'');
  const labels=[...(facets.diets || []).map(id=>DIETS[id]).filter(Boolean),
    facets.wheelchair==='yes' ? 'ეტლით მისაწვდომი' : facets.wheelchair==='limited' ? 'ეტლით ნაწილობრივ მისაწვდომი' : '',
    facets.outdoorSeating ? 'გარე დასაჯდომი სივრცე' : '',facets.takeaway ? 'წასაღებად' : '',facets.delivery ? 'მიტანა' : ''].filter(Boolean);
  return (
    <div class="imported-place-info">
      {raw.operatingStatus === 'source-reports-inactive' && <p class="imported-place-location-note"><Icon name="info" size={16}/><span>{raw.sourceNote || 'წყაროს მიხედვით ამჟამად არ ფუნქციონირებს.'}</span></p>}
      {raw.editorial?.highlights?.length > 0 && <ul class="imported-place-facets">{raw.editorial.highlights.map(label => <li key={label}>{label}</li>)}</ul>}
      {raw.editorial?.sources?.length > 0 && <div class="imported-editorial-sources"><span>ინფორმაციის წყარო:</span>{raw.editorial.sources.filter(source => httpUrl(source.url)).map(source => <a key={source.url} href={httpUrl(source.url)} target="_blank" rel="noopener noreferrer">{source.label}<Icon name="arrow-up-right" size={13}/></a>)}</div>}
      {raw.coordinateAccuracy==='approximate-center' && <p class="imported-place-location-note"><Icon name="crosshair" size={16}/><span>კოორდინატი აღნიშნავს ობიექტის სავარაუდო ცენტრს; შესასვლელი შეიძლება სხვა მხარეს იყოს.</span></p>}
      {showFacts && <div class="imported-place-facts">
        {raw.openingHours && <p><Icon name="clock" size={17}/><span><small>სამუშაო საათები წყაროს მიხედვით</small>{raw.openingHours}</span></p>}
        {phone && telephone && <a href={`tel:${telephone}`}><Icon name="phone" size={17}/><span>{phone}</span></a>}
        {website && <a href={website} target="_blank" rel="noopener noreferrer"><Icon name="globe-simple" size={17}/><span>{new URL(website).hostname}</span><Icon name="arrow-up-right" size={13}/></a>}
      </div>}
      {labels.length>0 && <ul class="imported-place-facets" aria-label="წყაროში მითითებული მახასიათებლები">{labels.map(label=><li key={label}>{label}</li>)}</ul>}
      {['private','no','customers','permit','members'].includes(facets.access) && <p class="muted small">წყაროში მითითებულია შესვლის შეზღუდვა: {({private:'კერძო ტერიტორია',no:'საჯარო შესვლა აკრძალულია',customers:'მხოლოდ მომხმარებლებისთვის',permit:'საჭიროა ნებართვა',members:'მხოლოდ წევრებისთვის'})[facets.access]}.</p>}
      {raw.mallId && <a class="imported-place-mall-link" href={`/place/${raw.mallId}`}><Icon name="buildings" size={17}/>{raw.mallName || 'სავაჭრო ცენტრი'}<Icon name="arrow-up-right" size={13}/></a>}
      <MallDirectory key={place.id} place={place}/>
      {raw.source === 'openstreetmap' || raw.linkedOsmId ? <SourceDetails key={place.id} place={place}/> : httpUrl(raw.sourceUrl) && <a class="imported-source-post-link" href={httpUrl(raw.sourceUrl)} target="_blank" rel="noopener noreferrer">დაწესებულების ოფიციალური წყარო<Icon name="arrow-up-right" size={15}/></a>}
    </div>
  );
}
