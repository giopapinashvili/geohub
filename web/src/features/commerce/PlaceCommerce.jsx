import { useEffect, useState } from 'preact/hooks';
import { getBusinessForPlace } from '../../data/business.js';
import { BusinessCatalog } from './BusinessCatalog.jsx';
import { Empty, Spinner } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { OfficialPlaceMenus } from './OfficialPlaceMenus.jsx';
import { officialMenuSources } from '../../lib/officialMenuSources.js';
import { officialMerchantForPlace } from '../../lib/officialMerchants.js';
import { OfficialMerchantCatalog } from './OfficialMerchantCatalog.jsx';

/** Only explicit place/business relationships may expose a merchant catalog. */
export function PlaceCommerce({ place }) {
  const [biz, setBiz] = useState(undefined);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true; setBiz(undefined); setError(false);
    getBusinessForPlace(place).then((b) => { if (active) setBiz(b); }).catch(() => { if (active) { setError(true); setBiz(null); } });
    return () => { active = false; };
  }, [place.id, place.businessId, place.raw?.businessId]);
  const menu = /^(food|restaurant|cafe|bar|pub|bakery|fast[-_]food|food[-_]court|ice[-_]cream)$/.test(place.category);
  const official = officialMenuSources(place);
  const merchant = officialMerchantForPlace(place);
  return <div class="place-commerce-content"><OfficialPlaceMenus place={place}/>{merchant && <OfficialMerchantCatalog merchant={merchant} compact/>}{biz === undefined ? <div class="center-pad"><Spinner /></div>
    : biz ? <BusinessCatalog biz={biz} menu={menu} branchId={place.branchId || place.raw?.branchId || ''} itemId={place.itemId || ''} />
      : error || (!official && !merchant) ? <Empty compact icon={menu ? 'fork-knife' : 'shopping-bag'} title={t(error ? 'commerce.loadError' : 'commerce.empty')} text={!error && t('commerce.emptyHint')} /> : null}</div>;
}
