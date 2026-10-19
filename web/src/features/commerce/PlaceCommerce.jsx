import { useEffect, useState } from 'preact/hooks';
import { getBusinessForPlace } from '../../data/business.js';
import { BusinessCatalog } from './BusinessCatalog.jsx';
import { Empty, Spinner } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { OfficialPlaceMenus } from './OfficialPlaceMenus.jsx';
import { officialMenuSources } from '../../lib/officialMenuSources.js';
import { officialMerchantForPlace } from '../../lib/officialMerchants.js';
import { OfficialMerchantCatalog } from './OfficialMerchantCatalog.jsx';
import { SourcePlaceCatalog } from './SourcePlaceCatalog.jsx';
import { loadPlaceSourceCatalogs } from '../../data/sourceCatalogs.js';
import { Button } from '../../ui/Button.jsx';

/** Only explicit place/business relationships may expose a merchant catalog. */
export function PlaceCommerce({ place }) {
  const [businessState, setBusinessState] = useState({placeId:'',value:undefined});
  const biz = businessState.placeId === place.id ? businessState.value : undefined;
  const [error, setError] = useState(false);
  const [sourceState, setSourceState] = useState({placeId:'',catalogs:[],loading:true,failed:false});
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setSourceState({placeId:place.id,catalogs:[],loading:true,failed:false});
    loadPlaceSourceCatalogs(place).then(result => {
      if (active) setSourceState({...result,placeId:place.id,loading:false});
    }).catch(() => { if (active) setSourceState({placeId:place.id,catalogs:[],loading:false,failed:true}); });
    return () => { active=false; };
  }, [place.id,retry]);
  useEffect(() => {
    let active = true; setBusinessState({placeId:place.id,value:undefined}); setError(false);
    getBusinessForPlace(place).then((b) => { if (active) setBusinessState({placeId:place.id,value:b}); }).catch(() => { if (active) { setError(true); setBusinessState({placeId:place.id,value:null}); } });
    return () => { active = false; };
  }, [place.id, place.businessId, place.raw?.businessId]);
  const menu = /^(food|restaurant|cafe|bar|pub|bakery|fast[-_]food|food[-_]court|ice[-_]cream)$/.test(place.category);
  const official = officialMenuSources(place);
  const merchant = officialMerchantForPlace(place);
  const currentSources = sourceState.placeId === place.id ? sourceState.catalogs : [];
  return <div class="place-commerce-content"><OfficialPlaceMenus place={place}/>{currentSources.map(catalog => <SourcePlaceCatalog key={`${place.id}:${catalog.venueId}`} catalog={catalog} place={place}/>)}
    {sourceState.loading && <div class="center-pad"><Spinner/></div>}
    {sourceState.failed && <div class="directory-catalog-context" role="status">კატალოგის ნაწილი ვერ ჩაიტვირთა. <Button variant="ghost" size="sm" onClick={() => setRetry(value=>value+1)}>ხელახლა ცდა</Button></div>}
    {merchant && <OfficialMerchantCatalog merchant={merchant} compact/>}{biz === undefined ? !currentSources.length && <div class="center-pad"><Spinner /></div>
    : biz ? <BusinessCatalog biz={biz} menu={menu} branchId={place.branchId || place.raw?.branchId || ''} itemId={place.itemId || ''} />
      : !sourceState.loading && !sourceState.failed && !currentSources.length && (error || (!official && !merchant)) ? <Empty compact icon={menu ? 'fork-knife' : 'shopping-bag'} title={t(error ? 'commerce.loadError' : 'commerce.empty')} text={!error && t('commerce.emptyHint')} /> : null}</div>;
}
