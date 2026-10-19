import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Button, IconButton } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Spinner, Empty } from '../ui/misc.jsx';
import { SearchInput } from '../ui/Field.jsx';
import { t, tn, lang } from '../lib/i18n.js';
import { useTitle, isDesktop } from '../lib/hooks.js';
import { query, setQuery, navigate } from '../lib/router.js';
import { requireLogin } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { getPosition, distanceKm } from '../lib/geo.js';
import { loadMapLibre, styleUrl, localizeLabels, addPlaceLayers, setPlaceData, applyPlaceTheme, placesToGeoJSON } from '../lib/map.js';
import { applyMapAppearance } from '../lib/mapAppearance.js';
import { updateBuildingPerspective, TBILISI_MAP_DATA, getTbilisiMapDataStatus } from '../lib/tbilisiBasemap.js';
import { isMapCoordinate, readCoordinates, formatCoordinates } from '../lib/coordinates.js';
import { theme } from '../lib/theme.js';
import { ICONS } from '../ui/icons.js';
import { getPlace, listMapPlaces } from '../data/places.js';
import { loadImportedPlaces, mergeImportedPlaces } from '../data/importedPlaces.js';
import { searchImported } from '../lib/discoveryClient.js';
import { searchCatalogPlaces } from '../data/search.js';
import { loadCommunityTagPlaces } from '../data/reviewTags.js';
import { placePageHref, isCatalogLocationId } from '../lib/placeLinks.js';
import { placeBrand } from '../lib/placeBrands.js';
import { rankRecords } from '../lib/discoverySearch.js';
import { EMPTY_PLACE_FILTERS, matchesPlaceFilters } from '../lib/discoveryFilters.js';
import { PlaceCard } from '../features/places/PlaceCard.jsx';
import { MapPlacePreview } from '../features/places/MapPlacePreview.jsx';
import { MapPlaceDetails } from '../features/places/MapPlaceDetails.jsx';
import { MapSidebarHandle, useMapSidebar } from '../features/places/MapSidebar.jsx';
import { categoryOf } from '../features/places/categories.js';
import { MapFilters } from '../features/places/MapFilters.jsx';
import { CheckinDialog } from '../features/places/CheckinDialog.jsx';
import { AddPlaceDialog } from '../features/places/AddPlaceDialog.jsx';

const MAP_THEME_KEY = 'gh_map_theme';
const MAP_VIEW_KEY = 'gh_map_view_v1';
function savedMapView() {
  try {
    const value = JSON.parse(localStorage.getItem(MAP_VIEW_KEY));
    if (isMapCoordinate(value) && Number.isFinite(value.zoom) && value.zoom >= 4 && value.zoom <= 20) {
      return { center: [value.lng, value.lat], zoom: value.zoom, pitch: Math.max(0, Math.min(65, Number(value.pitch) || 0)), bearing: Number(value.bearing) || 0 };
    }
  } catch { /* Storage can be unavailable in a private browser. */ }
  return { center: [44.797, 41.715], zoom: 12, pitch: 0, bearing: 0 };
}
function savedMapTheme() {
  try {
    const value = localStorage.getItem(MAP_THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch { return null; }
}

/** Places on a map with category filters, search, check-in and add-place. */
export default function MapPage() {
  useTitle(t('nav.map'));
  const desktop = isDesktop();
  const pageRef = useRef(null);
  const box = useRef(null);
  const mapRef = useRef(null);
  const selectedRef = useRef(null);
  const libRef = useRef(null);
  const meMarker = useRef(null);
  const [places, setPlaces] = useState(null);
  const [placesError, setPlacesError] = useState(false);
  const [placesTruncated, setPlacesTruncated] = useState(false);
  const [imported, setImported] = useState([]);
  const [coverage, setCoverage] = useState(null);
  const [importError, setImportError] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [zoom, setZoom] = useState(12);
  const [filters, setFilters] = useState(() => ({ ...EMPTY_PLACE_FILTERS }));
  const [searchResults, setSearchResults] = useState([]);
  const [catalogResults, setCatalogResults] = useState([]);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [community, setCommunity] = useState(null);
  const [communityError, setCommunityError] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [ready, setReady] = useState(false);
  const [perspective, setPerspective] = useState(false);
  const [mapDataStatus, setMapDataStatus] = useState('loading');
  const [mapThemeChoice, setMapThemeChoice] = useState(savedMapTheme);
  const mapTheme = mapThemeChoice || theme.value;
  const mapThemeRef = useRef(mapTheme);
  mapThemeRef.current = mapTheme;
  useEffect(() => {
    const syncTheme = (event) => { if (event.key === MAP_THEME_KEY || event.key === null) setMapThemeChoice(savedMapTheme()); };
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);
  const [failed, setFailed] = useState(false);
  const [bounds, setBounds] = useState(null);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [listLimit, setListLimit] = useState(60);
  const [searchLimit, setSearchLimit] = useState(120);
  useEffect(() => { setListLimit(60); setSearchLimit(120); }, [q, cat, filters]);
  const searchingCity = q.trim().length >= 2;
  const discovering = searchingCity || !!filters.diet || !!filters.preparationMax || !!filters.experienceTag;
  const selectedId = query.value.get('place') || null;
  const addressLat = query.value.get('lat');
  const addressLng = query.value.get('lng');
  const addressLabel = (query.value.get('label') || '').slice(0, 200);
  const expanded = !!selectedId && query.value.get('details') === '1';
  const sidebar = useMapSidebar(pageRef, desktop, expanded);
  const showSidebar = useRef(sidebar.show);
  showSidebar.current = sidebar.show;
  const [linkedPlace, setLinkedPlace] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [me, setMe] = useState(null);
  const [checkin, setCheckin] = useState(() => (query.value.get('checkin') === '1' ? { place: null } : null));
  const [adding, setAdding] = useState(() => query.value.get('add') === '1');

  useEffect(() => {
    let active = true;
    listMapPlaces().then((result) => { if (active) { setPlaces(result.places); setPlacesTruncated(result.truncated); } })
      .catch(() => { if (active) { setPlaces([]); setPlacesError(true); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!bounds) return;
    let active = true;
    setImportLoading(true);
    const timer = setTimeout(() => {
      const box = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      loadImportedPlaces(box, { zoom }).then((result) => {
        if (active) { setImported(result.places); setCoverage(result.coverage); setImportError(false); }
      }).catch(() => { if (active) setImportError(true); })
        .finally(() => { if (active) setImportLoading(false); });
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [bounds, zoom]);
  const allPlaces = useMemo(() => mergeImportedPlaces(places || [], imported), [places, imported]);
  useEffect(() => {
    let active = true;
    setCommunity(null); setCommunityError(false);
    if (filters.experienceTag) loadCommunityTagPlaces(filters.experienceTag)
      .then(async result => {
        // Virtual merchant branches are absent from the OSM index; resolve the
        // reviewed branches directly, with bounded fan-out and visible limits.
        const ids = result.placeIds.filter(isCatalogLocationId);
        const resolvedPlaces = [];
        for (let offset = 0; active && offset < Math.min(ids.length, 80); offset += 5) {
          const batch = await Promise.all(ids.slice(offset, Math.min(offset + 5, 80)).map(id => getPlace(id)));
          resolvedPlaces.push(...batch.filter(Boolean));
        }
        if (active) setCommunity({ ...result, resolvedPlaces, truncated: result.truncated || ids.length > 80 });
      })
      .catch(() => { if (active) setCommunityError(true); });
    return () => { active = false; };
  }, [filters.experienceTag]);
  const allowedPlaceIds = useMemo(() => filters.experienceTag
    ? new Set(community?.tag === filters.experienceTag ? community.placeIds : []) : null, [filters.experienceTag, community]);
  const discoveryPlaces = useMemo(() => [...allPlaces, ...(community?.resolvedPlaces || [])], [allPlaces, community]);
  useEffect(() => {
    let active = true;
    setSearchResults([]); setCatalogResults([]); setSearchError(false); setSearchTruncated(false);
    if (!discovering) { setSearching(false); return; }
    if (filters.experienceTag && community?.tag !== filters.experienceTag) { setSearching(!communityError); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      Promise.allSettled([
        searchImported(q, { channel: 'map', category: cat, filters, limit: searchLimit, allowEmpty: true,
          ...(allowedPlaceIds ? { allowedPlaceIds: [...allowedPlaceIds] } : {}) }),
        searchCatalogPlaces(q, 80, { filters, category: cat }),
      ]).then(([importedResult, catalogResult]) => {
        if (!active) return;
        if (importedResult.status === 'fulfilled') setSearchResults(importedResult.value);
        if (catalogResult.status === 'fulfilled') setCatalogResults(catalogResult.value);
        setSearchError(importedResult.status === 'rejected' || catalogResult.status === 'rejected' || catalogResult.value?.coverage?.unavailable);
        setSearchTruncated(catalogResult.value?.coverage?.truncated === true || importedResult.value?.length >= searchLimit);
      }).catch(() => { if (active) setSearchError(true); })
        .finally(() => { if (active) setSearching(false); });
    }, 220);
    return () => { active = false; clearTimeout(timer); };
  }, [q, cat, filters, community, communityError, searchLimit]);
  const knownSelection = catalogResults.find(p => p.id === selectedId) || discoveryPlaces.find(p => p.id === selectedId);
  // A shared place link can point outside the first page of map results.
  useEffect(() => {
    let active = true;
    setLinkedPlace(null);
    if (selectedId && !knownSelection) {
      getPlace(selectedId).then((p) => { if (active) {
        if (p?.raw?.mapPlaceId) setQuery({ place: p.raw.mapPlaceId });
        else setLinkedPlace(p);
      } }).catch(() => {});
    }
    return () => { active = false; };
  }, [selectedId, !!knownSelection]);
  const selected = knownSelection || (linkedPlace?.id === selectedId ? linkedPlace : null);

  const filtered = useMemo(() => {
    const matches = p => (!allowedPlaceIds || allowedPlaceIds.has(p.id)) && matchesPlaceFilters(p, filters, cat);
    const matching = discoveryPlaces.filter(matches);
    if (!discovering) return matching;
    const byId = new Map(discoveryPlaces.map((p) => [p.id, p]));
    const combined = new Map(rankRecords(matching, q, { limit: searchLimit }).map((p) => [p.id, p]));
    for (const hit of searchResults.filter((p) => p.kind === 'place')) {
      if (!combined.has(hit.id) && matches(hit)) combined.set(hit.id, { ...(byId.get(hit.id) || { rating: 0, reviewCount: 0, checkinCount: 0, image: '', photos: [] }), ...hit });
    }
    for (const hit of catalogResults) {
      if (matches(hit)) combined.set(hit.id, { ...byId.get(hit.id), ...hit, searchScore: Math.max(combined.get(hit.id)?.searchScore || 0, hit.searchScore || 0) });
    }
    return [...combined.values()].sort((a, b) => b.searchScore - a.searchScore).slice(0, searchLimit);
  }, [discoveryPlaces, filters, cat, q, discovering, searchResults, catalogResults, allowedPlaceIds, searchLimit]);
  const addressResults = searchResults.filter((p) => p.kind !== 'place').slice(0, 12);
  const geojson = useMemo(() => placesToGeoJSON(
    selected && !filtered.some((p) => p.id === selected.id) ? [...filtered, selected] : filtered,
    (p) => categoryOf(p).tone, (p) => categoryOf(p).icon,
  ), [filtered, selected]);
  const geoRef = useRef(geojson);
  geoRef.current = geojson;

  const viewResults = useMemo(() => {
    const list = bounds && !discovering ? filtered.filter((p) => isMapCoordinate(p) && bounds.contains([p.lng, p.lat])) : filtered;
    const ref = me || null;
    return list.map((p) => ({ p, d: ref ? distanceKm(ref, p) : Infinity }))
      .sort((a, b) => discovering ? b.p.searchScore - a.p.searchScore : (ref ? a.d - b.d : (b.p.checkinCount || 0) - (a.p.checkinCount || 0)));
  }, [filtered, bounds, me, discovering]);
  const visible = viewResults.slice(0, listLimit);

  // Create the map once.
  useEffect(() => {
    let map;
    let resizeObserver;
    let alive = true;
    loadMapLibre().then((maplibregl) => {
      if (!alive || !box.current) return;
      map = new maplibregl.Map({
        container: box.current, style: styleUrl(), ...savedMapView(),
        canvasContextAttributes: { antialias: true },
        minZoom: 4, maxZoom: 20, maxPitch: 65, attributionControl: { compact: true }, dragRotate: true, pitchWithRotate: true, touchPitch: true, cooperativeGestures: false,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
      if (isDesktop()) {
        const geo = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false, showAccuracyCircle: true });
        map.addControl(geo, 'top-right');
        geo.on('geolocate', (e) => setMe({ lat: e.coords.latitude, lng: e.coords.longitude }));
        geo.on('error', () => toast.error(t('map.locationDenied')));
      }
      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(box.current);
      libRef.current = maplibregl;
      const updatePerspective = () => {
        const tilted = map.getPitch() > 1;
        setPerspective(tilted);
        updateBuildingPerspective(map);
      };
      const onStyle = () => {
        // Later theme/camera updates can briefly report an unready style.
        // The initial-load timeout must stop once the basemap has arrived.
        clearTimeout(timer);
        applyMapAppearance(map, mapThemeRef.current);
        setMapDataStatus(getTbilisiMapDataStatus(map));
        updatePerspective();
        localizeLabels(map);
        addPlaceLayers(map, geoRef.current);
        applyPlaceTheme(map, mapThemeRef.current);
        if (selectedRef.current) map.setFeatureState({ source: 'gh-places', id: selectedRef.current }, { selected: true });
        setReady(true);
        setFailed(false);
      };
      map.on('style.load', onStyle);
      map.on('geohub:mapdata', (event) => setMapDataStatus(event.status));
      map.on('pitch', updatePerspective);
      const updateView = () => {
        setBounds(map.getBounds()); setZoom(map.getZoom());
        const center = map.getCenter();
        try { localStorage.setItem(MAP_VIEW_KEY, JSON.stringify({ lat: center.lat, lng: center.lng, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() })); } catch { /* Optional preference. */ }
      };
      map.on('moveend', updateView);
      map.on('load', updateView);
      map.on('error', (e) => console.warn('[map]', e?.error?.message || e));
      map.on('click', 'gh-points', (e) => {
        const id = e.features[0].properties.id;
        if (query.value.get('details') === '1') showSidebar.current();
        setQuery({ place: id, lat: null, lng: null, label: null });
      });
      for (const layer of ['gh-points']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
      }
    }).catch(() => setFailed(true));
    // A basemap that never arrives (offline, blocked) shouldn't spin forever.
    const timer = setTimeout(() => { if (alive && !mapRef.current?.isStyleLoaded()) setFailed(true); }, 20000);
    return () => {
      alive = false;
      clearTimeout(timer);
      resizeObserver?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Follow the shell until the user chooses a separate, remembered map theme.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applyMapAppearance(map, mapTheme);
    applyPlaceTheme(map, mapTheme);
  }, [mapTheme, ready]);
  useEffect(() => { const map = mapRef.current; if (map && ready) localizeLabels(map); }, [lang.value]);

  // Data changes.
  useEffect(() => {
    if (ready && mapRef.current) setPlaceData(mapRef.current, geojson);
  }, [geojson, ready]);

  // Address/branch links can point to coordinates without inventing a place.
  useEffect(() => {
    const point = readCoordinates({ lat: addressLat, lng: addressLng });
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib || selectedId || !isMapCoordinate(point)) return;
    const content = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = addressLabel || t('place.address');
    const coords = document.createElement('p');
    coords.textContent = formatCoordinates(point);
    content.append(title, coords);
    const marker = new lib.Marker({ color: '#1675ee' }).setLngLat([point.lng, point.lat])
      .setPopup(new lib.Popup({ offset: 26 }).setDOMContent(content)).addTo(map);
    marker.togglePopup();
    map.flyTo({ center: [point.lng, point.lat], zoom: 17, speed: 1.5 });
    return () => marker.remove();
  }, [addressLat, addressLng, addressLabel, ready, selectedId]);

  // Selection: highlight, and fly there when it came from outside the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (selectedRef.current) map.setFeatureState({ source: 'gh-places', id: selectedRef.current }, { selected: false });
    selectedRef.current = selectedId;
    if (!selectedId || !selected) return;
    map.setFeatureState({ source: 'gh-places', id: selectedId }, { selected: true });
    if (isMapCoordinate(selected)) {
      const inView = map.getBounds().contains([selected.lng, selected.lat]);
      if (!inView || map.getZoom() < 11) map.flyTo({ center: [selected.lng, selected.lat], zoom: Math.max(map.getZoom(), 13), speed: 1.4 });
    }
  }, [selectedId, ready, !!selected]);

  // Keep the selected location visible even when nearby symbols collide.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib || !isMapCoordinate(selected)) return undefined;
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'map-selected-pin';
    const icon = ICONS[categoryOf(selected).icon] || ICONS['map-pin'];
    // Only bundled, static icon paths go into this SVG.
    element.innerHTML = `<svg width="23" height="23" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${icon}</svg>`;
    const fallback = element.firstElementChild;
    const brand = placeBrand(selected);
    let disposed = false;
    let artwork;
    if (brand) {
      artwork = new Image();
      artwork.className = 'map-selected-pin-logo';
      artwork.alt = '';
      artwork.setAttribute('aria-hidden', 'true');
      artwork.onload = () => {
        if (disposed) return;
        fallback.replaceWith(artwork);
        element.classList.add('is-branded');
        element.classList.toggle('is-wide', !!brand.wide);
        element.style.setProperty('--selected-brand-background', brand.background);
        element.dataset.brand = brand.id;
      };
      artwork.onerror = () => {
        if (disposed) return;
        if (artwork.parentNode === element) artwork.replaceWith(fallback);
        element.classList.remove('is-branded', 'is-wide');
        element.style.removeProperty('--selected-brand-background');
        delete element.dataset.brand;
      };
      artwork.src = brand.src;
    }
    const label = document.createElement('span');
    label.className = 'map-selected-pin-label';
    label.textContent = selected.name;
    label.setAttribute('aria-hidden', 'true');
    element.appendChild(label);
    const marker = new lib.Marker({ element, anchor: 'center' })
      .setLngLat([selected.lng, selected.lat]).addTo(map);
    element.setAttribute('aria-label', `${selected.name} — ${t('map.details')}`);
    const open = (event) => { event?.stopPropagation(); showSidebar.current(); setQuery({ details: '1' }); };
    element.addEventListener('click', open);
    return () => {
      disposed = true;
      if (artwork) artwork.onload = artwork.onerror = null;
      marker.remove();
    };
  }, [selected?.id, selected?.lat, selected?.lng, selected?.name, selected?.category, selected?.raw?.brand, selected?.raw?.operator, selected?.raw?.website, ready, lang.value]);

  // "My location" dot for the phone button (desktop uses MapLibre's control).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !me || desktop || !libRef.current) return;
    if (!meMarker.current) {
      const el = document.createElement('span');
      el.className = 'map-me';
      meMarker.current = new libRef.current.Marker({ element: el }).setLngLat([me.lng, me.lat]).addTo(map);
    } else meMarker.current.setLngLat([me.lng, me.lat]);
  }, [me, ready]);

  const select = (p) => {
    setQuery({ place: p.id, details: null, lat: null, lng: null, label: null }); setSheet(false);
    if (isMapCoordinate(p)) mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: Math.max(16, mapRef.current.getZoom()), speed: 1.4 });
  };
  const selectAddress = (p) => { setQuery({ place: null, details: null, lat: p.lat, lng: p.lng, label: p.name || p.address }); setSheet(false); };
  const clearSelection = () => setQuery({ place: null, details: null });
  const expand = () => { sidebar.show(); setQuery({ details: '1' }); };
  const collapse = () => {
    setQuery({ details: null });
    requestAnimationFrame(() => document.querySelector('[data-testid="map-place-expand"]')?.focus({ preventScroll: true }));
  };
  const startCheckin = (place = null) => { if (requireLogin('checkin')) setCheckin({ place }); };
  const startAdd = () => { if (requireLogin('place')) { setCheckin(null); setAdding(true); } };
  const locate = () => getPosition().then((p) => { setMe(p); mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 12 }); }).catch((e) => toast.error(t(e.message === 'denied' ? 'map.locationDenied' : 'map.locationFailed')));
  const togglePerspective = () => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ pitch: map.getPitch() > 1 ? 0 : 55, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650 });
  };
  const toggleMapTheme = () => {
    const next = mapTheme === 'dark' ? 'light' : 'dark';
    const choice = next === theme.value ? null : next;
    setMapThemeChoice(choice);
    try {
      if (choice) localStorage.setItem(MAP_THEME_KEY, choice);
      else localStorage.removeItem(MAP_THEME_KEY);
    } catch { /* private mode */ }
  };

  const chips = <MapFilters category={cat} onCategory={setCat} value={filters} onChange={setFilters} />;
  const list = <>
    <div class="map-search-status" role="status" aria-live="polite">
      {searching ? t('map.searching') : searchError || communityError ? t('map.searchUnavailable') : importLoading && !allPlaces.length ? t('common.loading') : ''}
    </div>
    {(placesError || importError) && <p class="map-data-note">{t('map.partialPlaces')} <button type="button" class="link" onClick={() => location.reload()}>{t('common.reload')}</button></p>}
    {addressResults.map((p) => <button type="button" key={p.id} class="map-address-result" onClick={() => selectAddress(p)}><Icon name="map-pin" size={22} /><span><strong>{p.name}</strong><small>{p.address !== p.name ? p.address : t('place.address')}{p.searchMatch === 'fuzzy' ? ` · ${t('map.similarResult')}` : ''}</small></span></button>)}
    {!places && !allPlaces.length && !coverage ? <div class="center-pad"><Spinner /></div> : visible.length ? (
    <div class="map-list">
      {visible.map(({ p, d }) => <div key={p.id}>{p.searchMatch === 'fuzzy' && <small class="muted">{t('map.similarResult')}</small>}<PlaceCard place={p} distance={d} compact showDescription active={p.id === selectedId} href={placePageHref(p)} onClick={(e) => { e.preventDefault(); select(p); }} />{filters.experienceTag && community?.counts?.[p.id] > 0 && <small class="muted">{t('map.communityVotes', { n: community.counts[p.id] })}</small>}</div>)}
      {(visible.length < viewResults.length || (discovering && searchTruncated && searchLimit < 5000)) && <Button variant="secondary" loading={searching} onClick={() => { setListLimit(n => n + 60); if (listLimit + 60 >= viewResults.length && discovering && searchTruncated) setSearchLimit(n => Math.min(5000, n + 120)); }}>{t('common.loadMore')}</Button>}
    </div>
  ) : !searching && !addressResults.length ? <Empty compact icon="map-trifold" title={t('map.nothingHere')} text={t('map.nothingHereText')} /> : null}
    {coverage && <p class="map-data-note"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> · {coverage.sourceDate?.slice(0, 10)}{coverage.mode === 'overview' ? ` · ${t('map.overviewPlaces')}` : ''}</p>}
  </>;

  return (
    <div ref={pageRef} data-map-theme={mapTheme} class={`map-page${desktop ? ' is-split' : ''}${selected && expanded ? ' has-place-details' : ''}${desktop && sidebar.collapsed ? ' is-sidebar-collapsed' : ''}${desktop && sidebar.resizing ? ' is-sidebar-resizing' : ''}`}
      style={desktop ? { '--map-sidebar-width': `${sidebar.width}px`, '--map-sidebar-visible': `${sidebar.collapsed ? 0 : sidebar.width}px` } : undefined}>
      {desktop && <div id="map-sidebar-content" class="map-sidebar-shell" inert={sidebar.collapsed || undefined} aria-hidden={sidebar.collapsed ? 'true' : undefined}>
        <div class="map-sidebar-content">
        {selected && expanded ? <MapPlaceDetails key={selected.id} place={selected} onClose={collapse} onCheckin={() => startCheckin(selected)} /> : (
        <aside class="map-panel">
          <div class="map-panel-head">
            <h1 class="page-title">{t('nav.map')}</h1>
            <div class="row gap-8">
              <Button variant="primary" icon="map-pin" onClick={() => startCheckin()}>{t('checkin.short')}</Button>
              <IconButton icon="map-pin-plus" label={t('place.add')} variant="soft" onClick={startAdd} />
            </div>
          </div>
          <SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('map.searchPlaces')} />
          {chips}
          <p class="muted small map-count">{tn('map.placesInView', viewResults.length)}{visible.length < viewResults.length ? ` · სიაში ${visible.length}` : ''}</p>
          {(placesTruncated || coverage?.truncated || searchTruncated || community?.truncated) && <p class="muted small">{t('map.partialPlaces')}</p>}
          {list}
        </aside>
        )}
        </div>
      </div>}
      <div class="map-stage">
        <div ref={box} class="map-canvas" aria-label={t('nav.map')} role="region" />
        {ready && <div class="map-view-controls">
          <button type="button" class="map-view-toggle" onClick={togglePerspective}
            aria-label={t('map.perspective')} title={t('map.perspective')} aria-pressed={perspective}>
            {perspective ? '2D' : '3D'}
          </button>
          <button type="button" class="map-theme-toggle" onClick={toggleMapTheme}
            aria-label={t(mapTheme === 'dark' ? 'map.lightMode' : 'map.darkMode')}
            title={t(mapTheme === 'dark' ? 'map.lightMode' : 'map.darkMode')}>
            <Icon name={mapTheme === 'dark' ? 'sun' : 'moon'} size={20} />
          </button>
          <a class="map-theme-toggle" href="/map-data/tbilisi-20261018.json" target="_blank" rel="noopener noreferrer"
            aria-label={t(mapDataStatus === 'fallback' ? 'map.dataFallback' : 'map.dataSource', { date: TBILISI_MAP_DATA.dataAsOf.slice(0, 10) })}
            title={t(mapDataStatus === 'fallback' ? 'map.dataFallback' : 'map.dataSource', { date: TBILISI_MAP_DATA.dataAsOf.slice(0, 10) })}>
            <Icon name="info" size={20} />
          </a>
        </div>}
        {!ready && !failed && <div class="map-loading"><Spinner size={28} /></div>}
        {failed && <div class="map-loading"><Empty icon="map-trifold" title={t('map.failed')} action={<Button variant="secondary" onClick={() => location.reload()}>{t('common.reload')}</Button>} /></div>}
        {!desktop && (
          <div class="map-float-top">
            <div class="map-search-row">
              <SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('map.searchPlaces')} class="map-search" />
              <IconButton icon="crosshair" label={t('map.myLocation')} variant="soft" class="map-fab" onClick={locate} />
            </div>
            {chips}
          </div>
        )}
        {selected && !expanded && <MapPlacePreview place={selected} onExpand={expand} onClose={clearSelection} onCheckin={() => startCheckin(selected)} />}
        {!desktop && selected && expanded && <MapPlaceDetails key={selected.id} place={selected} onClose={collapse} onCheckin={() => startCheckin(selected)} />}
        {!desktop && !selected && (
          <div class={`map-sheet${sheet ? ' is-open' : ''}`}>
            <button type="button" class="map-sheet-handle" onClick={() => setSheet((s) => !s)} aria-expanded={sheet}>
              <span class="map-sheet-grip" />
              <span class="bold">{tn('map.placesInView', viewResults.length)}</span>
              <Icon name={sheet ? 'caret-down' : 'caret-up'} size={18} />
            </button>
            {sheet && <div class="map-sheet-body">{list}</div>}
            {!sheet && (
              <div class="map-sheet-actions">
                <Button variant="primary" icon="map-pin" onClick={() => startCheckin()}>{t('checkin.short')}</Button>
                <Button variant="secondary" icon="map-pin-plus" onClick={startAdd}>{t('place.add')}</Button>
              </div>
            )}
          </div>
        )}
      </div>
      {desktop && <MapSidebarHandle sidebar={sidebar} />}
      {checkin && <CheckinDialog place={checkin.place} onClose={() => { setCheckin(null); if (query.value.get('checkin')) setQuery({ checkin: null }); }} onAddPlace={startAdd} />}
      {adding && <AddPlaceDialog at={me} onClose={() => { setAdding(false); if (query.value.get('add')) setQuery({ add: null }); }} onCreated={(id) => navigate(`/place/${id}`)} />}
    </div>
  );
}
