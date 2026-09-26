import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Button, IconButton } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Img, Spinner, Empty } from '../ui/misc.jsx';
import { SearchInput } from '../ui/Field.jsx';
import { t, tn, lang } from '../lib/i18n.js';
import { useTitle, isDesktop } from '../lib/hooks.js';
import { theme } from '../lib/theme.js';
import { query, setQuery, navigate } from '../lib/router.js';
import { requireLogin } from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { GEORGIA_CENTER, cityLabel, getPosition, distanceKm } from '../lib/geo.js';
import { loadMapLibre, styleUrl, localizeLabels, addPlaceLayers, placesToGeoJSON } from '../lib/map.js';
import { listPlaces } from '../data/places.js';
import { PlaceCard } from '../features/places/PlaceCard.jsx';
import { useCategories, categoryOf } from '../features/places/categories.js';
import { CheckinDialog } from '../features/places/CheckinDialog.jsx';
import { AddPlaceDialog } from '../features/places/AddPlaceDialog.jsx';

function directionsUrl(p) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}

function SelectedCard({ place, onClose, onCheckin }) {
  const cat = categoryOf(place);
  return (
    <div class="map-selected card">
      <a href={`/place/${place.id}`} class="map-selected-img">
        <Img src={place.image} width={240} alt="" fallback={<span class="place-row-ico" style={{ '--tone': cat.tone }}><Icon name={cat.icon} size={28} /></span>} />
      </a>
      <div class="map-selected-body">
        <a href={`/place/${place.id}`} class="map-selected-name">{place.name}</a>
        <span class="muted small ellipsis">{[cat.label, cityLabel(place.city)].filter(Boolean).join(' · ')}</span>
        {place.rating > 0 && <span class="place-rating small"><Icon name="star-fill" size={14} />{place.rating.toFixed(1).replace('.', ',')}<span class="muted">· {tn('place.checkins', place.checkinCount)}</span></span>}
        <div class="map-selected-actions">
          <Button variant="primary" size="sm" icon="map-pin" onClick={onCheckin}>{t('checkin.short')}</Button>
          <Button variant="secondary" size="sm" href={`/place/${place.id}`}>{t('common.open')}</Button>
          {place.lat != null && <IconButton icon="navigation-arrow" label={t('place.directions')} size={32} variant="soft" href={directionsUrl(place)} target="_blank" rel="noopener" />}
        </div>
      </div>
      <IconButton icon="x" label={t('common.close')} size={30} class="map-selected-close" onClick={onClose} />
    </div>
  );
}

/** Places on a map with category filters, search, check-in and add-place. */
export default function MapPage() {
  useTitle(t('nav.map'));
  const cats = useCategories();
  const desktop = isDesktop();
  const box = useRef(null);
  const mapRef = useRef(null);
  const selectedRef = useRef(null);
  const libRef = useRef(null);
  const meMarker = useRef(null);
  const [places, setPlaces] = useState(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [bounds, setBounds] = useState(null);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState(query.value.get('place') || null);
  const [sheet, setSheet] = useState(false);
  const [me, setMe] = useState(null);
  const [checkin, setCheckin] = useState(() => (query.value.get('checkin') === '1' ? { place: null } : null));
  const [adding, setAdding] = useState(() => query.value.get('add') === '1');

  useEffect(() => { listPlaces(500).then(setPlaces).catch(() => setPlaces([])); }, []);

  const filtered = useMemo(() => {
    if (!places) return [];
    const needle = q.trim().toLowerCase();
    return places.filter((p) => (cat === 'all' || p.category === cat) && (!needle || `${p.name} ${p.city} ${p.address}`.toLowerCase().includes(needle)));
  }, [places, cat, q]);
  const geojson = useMemo(() => placesToGeoJSON(filtered, (p) => categoryOf(p).tone), [filtered]);
  const geoRef = useRef(geojson);
  geoRef.current = geojson;

  const visible = useMemo(() => {
    const list = bounds ? filtered.filter((p) => p.lat != null && bounds.contains([p.lng, p.lat])) : filtered;
    const ref = me || null;
    return list.map((p) => ({ p, d: ref ? distanceKm(ref, p) : Infinity }))
      .sort((a, b) => (ref ? a.d - b.d : b.p.checkinCount - a.p.checkinCount))
      .slice(0, 80);
  }, [filtered, bounds, me]);

  const selected = places?.find((p) => p.id === selectedId) || null;

  // Create the map once.
  useEffect(() => {
    let map;
    let alive = true;
    loadMapLibre().then((maplibregl) => {
      if (!alive || !box.current) return;
      map = new maplibregl.Map({
        container: box.current, style: styleUrl(), center: [GEORGIA_CENTER.lng, GEORGIA_CENTER.lat], zoom: GEORGIA_CENTER.zoom,
        minZoom: 4, maxZoom: 18, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, cooperativeGestures: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      if (isDesktop()) {
        const geo = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false, showAccuracyCircle: true });
        map.addControl(geo, 'top-right');
        geo.on('geolocate', (e) => setMe({ lat: e.coords.latitude, lng: e.coords.longitude }));
        geo.on('error', () => toast.error(t('map.locationDenied')));
      }
      mapRef.current = map;
      libRef.current = maplibregl;
      const onStyle = () => {
        localizeLabels(map);
        addPlaceLayers(map, geoRef.current, theme.value === 'dark');
        if (selectedRef.current) map.setFeatureState({ source: 'gh-places', id: selectedRef.current }, { selected: true });
        setReady(true);
        setFailed(false);
      };
      map.on('style.load', onStyle);
      map.on('moveend', () => setBounds(map.getBounds()));
      map.on('load', () => setBounds(map.getBounds()));
      map.on('error', (e) => console.warn('[map]', e?.error?.message || e));
      map.on('click', 'gh-clusters', async (e) => {
        const f = e.features[0];
        const zoom = await map.getSource('gh-places').getClusterExpansionZoom(f.properties.cluster_id);
        map.easeTo({ center: f.geometry.coordinates, zoom: zoom + 0.3 });
      });
      map.on('click', 'gh-points', (e) => {
        const id = e.features[0].properties.id;
        setSelectedId(id);
        setQuery({ place: id });
      });
      for (const layer of ['gh-clusters', 'gh-points']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
      }
    }).catch(() => setFailed(true));
    // A basemap that never arrives (offline, blocked) shouldn't spin forever.
    const timer = setTimeout(() => { if (alive && !mapRef.current?.isStyleLoaded()) setFailed(true); }, 20000);
    return () => { alive = false; clearTimeout(timer); map?.remove(); mapRef.current = null; };
  }, []);

  // Theme or language switch: new basemap, layers re-added on style.load.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setReady(false);
    map.setStyle(styleUrl(), { diff: false });
  }, [theme.value]);
  useEffect(() => { const map = mapRef.current; if (map && ready) localizeLabels(map); }, [lang.value]);

  // Data changes.
  useEffect(() => {
    const src = ready && mapRef.current?.getSource('gh-places');
    if (src) src.setData(geojson);
  }, [geojson, ready]);

  // Selection: highlight, and fly there when it came from outside the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (selectedRef.current) map.setFeatureState({ source: 'gh-places', id: selectedRef.current }, { selected: false });
    selectedRef.current = selectedId;
    if (!selectedId || !selected) return;
    map.setFeatureState({ source: 'gh-places', id: selectedId }, { selected: true });
    if (selected.lat != null) {
      const inView = map.getBounds().contains([selected.lng, selected.lat]);
      if (!inView || map.getZoom() < 11) map.flyTo({ center: [selected.lng, selected.lat], zoom: Math.max(map.getZoom(), 13), speed: 1.4 });
    }
  }, [selectedId, ready, !!selected]);

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

  const select = (p) => { setSelectedId(p.id); setQuery({ place: p.id }); setSheet(false); };
  const clearSelection = () => { setSelectedId(null); setQuery({ place: null }); };
  const startCheckin = (place = null) => { if (requireLogin('checkin')) setCheckin({ place }); };
  const startAdd = () => { if (requireLogin('place')) { setCheckin(null); setAdding(true); } };
  const locate = () => getPosition().then((p) => { setMe(p); mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 12 }); }).catch((e) => toast.error(t(e.message === 'denied' ? 'map.locationDenied' : 'map.locationFailed')));

  const chips = (
    <div class="map-chips" role="toolbar" aria-label={t('place.category')}>
      <button type="button" class={`chip${cat === 'all' ? ' is-active' : ''}`} onClick={() => setCat('all')}>{t('common.all')}</button>
      {cats.map((c) => (
        <button key={c.id} type="button" class={`chip${cat === c.id ? ' is-active' : ''}`} onClick={() => setCat(cat === c.id ? 'all' : c.id)}>
          <Icon name={c.icon} size={16} style={{ color: cat === c.id ? undefined : c.tone }} />{c.label}
        </button>
      ))}
    </div>
  );
  const list = !places ? <div class="center-pad"><Spinner /></div> : visible.length ? (
    <div class="map-list">
      {visible.map(({ p, d }) => <PlaceCard key={p.id} place={p} distance={d} compact active={p.id === selectedId} href={`/place/${p.id}`} onClick={(e) => { e.preventDefault(); select(p); }} />)}
    </div>
  ) : <Empty compact icon="map-trifold" title={t('map.nothingHere')} text={t('map.nothingHereText')} />;

  return (
    <div class={`map-page${desktop ? ' is-split' : ''}`}>
      {desktop && (
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
          <p class="muted small map-count">{tn('map.placesInView', visible.length)}</p>
          {list}
        </aside>
      )}
      <div class="map-stage">
        <div ref={box} class="map-canvas" aria-label={t('nav.map')} role="region" />
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
        {selected && <SelectedCard place={selected} onClose={clearSelection} onCheckin={() => startCheckin(selected)} />}
        {!desktop && !selected && (
          <div class={`map-sheet${sheet ? ' is-open' : ''}`}>
            <button type="button" class="map-sheet-handle" onClick={() => setSheet((s) => !s)} aria-expanded={sheet}>
              <span class="map-sheet-grip" />
              <span class="bold">{tn('map.placesInView', visible.length)}</span>
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
      {checkin && <CheckinDialog place={checkin.place} onClose={() => { setCheckin(null); if (query.value.get('checkin')) setQuery({ checkin: null }); }} onAddPlace={startAdd} />}
      {adding && <AddPlaceDialog at={me} onClose={() => { setAdding(false); if (query.value.get('add')) setQuery({ add: null }); }} onCreated={(id) => navigate(`/place/${id}`)} />}
    </div>
  );
}
