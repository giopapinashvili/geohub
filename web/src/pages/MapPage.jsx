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
import { GEORGIA_CENTER, getPosition, distanceKm } from '../lib/geo.js';
import { loadMapLibre, styleUrl, localizeLabels, addPlaceLayers, applyPlaceTheme, placesToGeoJSON } from '../lib/map.js';
import { applyMapAppearance } from '../lib/mapAppearance.js';
import { theme } from '../lib/theme.js';
import { ICONS } from '../ui/icons.js';
import { getPlace, listPlaces } from '../data/places.js';
import { PlaceCard } from '../features/places/PlaceCard.jsx';
import { MapPlacePreview } from '../features/places/MapPlacePreview.jsx';
import { MapPlaceDetails } from '../features/places/MapPlaceDetails.jsx';
import { MapSidebarHandle, useMapSidebar } from '../features/places/MapSidebar.jsx';
import { useCategories, categoryOf } from '../features/places/categories.js';
import { CheckinDialog } from '../features/places/CheckinDialog.jsx';
import { AddPlaceDialog } from '../features/places/AddPlaceDialog.jsx';

const MAP_THEME_KEY = 'gh_map_theme';
function savedMapTheme() {
  try {
    const value = localStorage.getItem(MAP_THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch { return null; }
}

/** Places on a map with category filters, search, check-in and add-place. */
export default function MapPage() {
  useTitle(t('nav.map'));
  const cats = useCategories();
  const desktop = isDesktop();
  const pageRef = useRef(null);
  const box = useRef(null);
  const mapRef = useRef(null);
  const selectedRef = useRef(null);
  const libRef = useRef(null);
  const meMarker = useRef(null);
  const [places, setPlaces] = useState(null);
  const [ready, setReady] = useState(false);
  const [perspective, setPerspective] = useState(false);
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
  const selectedId = query.value.get('place') || null;
  const expanded = !!selectedId && query.value.get('details') === '1';
  const sidebar = useMapSidebar(pageRef, desktop, expanded);
  const showSidebar = useRef(sidebar.show);
  showSidebar.current = sidebar.show;
  const [linkedPlace, setLinkedPlace] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [me, setMe] = useState(null);
  const [checkin, setCheckin] = useState(() => (query.value.get('checkin') === '1' ? { place: null } : null));
  const [adding, setAdding] = useState(() => query.value.get('add') === '1');

  useEffect(() => { listPlaces().then(setPlaces).catch(() => setPlaces([])); }, []);
  // A shared place link can point outside the first page of map results.
  useEffect(() => {
    let active = true;
    setLinkedPlace(null);
    if (selectedId && places && !places.some((p) => p.id === selectedId)) {
      getPlace(selectedId).then((p) => { if (active) setLinkedPlace(p); }).catch(() => {});
    }
    return () => { active = false; };
  }, [selectedId, places]);
  const selected = places?.find((p) => p.id === selectedId) || (linkedPlace?.id === selectedId ? linkedPlace : null);

  const filtered = useMemo(() => {
    if (!places) return [];
    const needle = q.trim().toLowerCase();
    return places.filter((p) => (cat === 'all' || p.category === cat) && (!needle || `${p.name} ${p.city} ${p.address}`.toLowerCase().includes(needle)));
  }, [places, cat, q]);
  const geojson = useMemo(() => placesToGeoJSON(
    selected && !filtered.some((p) => p.id === selected.id) ? [...filtered, selected] : filtered,
    (p) => categoryOf(p).tone, (p) => categoryOf(p).icon,
  ), [filtered, selected]);
  const geoRef = useRef(geojson);
  geoRef.current = geojson;

  const visible = useMemo(() => {
    const list = bounds ? filtered.filter((p) => p.lat != null && bounds.contains([p.lng, p.lat])) : filtered;
    const ref = me || null;
    return list.map((p) => ({ p, d: ref ? distanceKm(ref, p) : Infinity }))
      .sort((a, b) => (ref ? a.d - b.d : b.p.checkinCount - a.p.checkinCount))
      .slice(0, 80);
  }, [filtered, bounds, me]);

  // Create the map once.
  useEffect(() => {
    let map;
    let resizeObserver;
    let alive = true;
    loadMapLibre().then((maplibregl) => {
      if (!alive || !box.current) return;
      map = new maplibregl.Map({
        container: box.current, style: styleUrl(), center: [GEORGIA_CENTER.lng, GEORGIA_CENTER.lat], zoom: GEORGIA_CENTER.zoom,
        canvasContextAttributes: { antialias: true },
        minZoom: 4, maxZoom: 20, pitch: 0, maxPitch: 65, attributionControl: { compact: true }, dragRotate: true, pitchWithRotate: true, touchPitch: true, cooperativeGestures: false,
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
        const visibility = tilted ? 'visible' : 'none';
        if (map.getLayer('gh-buildings-3d') && map.getLayoutProperty('gh-buildings-3d', 'visibility') !== visibility) {
          map.setLayoutProperty('gh-buildings-3d', 'visibility', visibility);
        }
      };
      const onStyle = () => {
        // Later theme/camera updates can briefly report an unready style.
        // The initial-load timeout must stop once the basemap has arrived.
        clearTimeout(timer);
        applyMapAppearance(map, mapThemeRef.current);
        updatePerspective();
        localizeLabels(map);
        addPlaceLayers(map, geoRef.current);
        applyPlaceTheme(map, mapThemeRef.current);
        if (selectedRef.current) map.setFeatureState({ source: 'gh-places', id: selectedRef.current }, { selected: true });
        setReady(true);
        setFailed(false);
      };
      map.on('style.load', onStyle);
      map.on('pitch', updatePerspective);
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
        if (query.value.get('details') === '1') showSidebar.current();
        setQuery({ place: id });
      });
      for (const layer of ['gh-clusters', 'gh-points']) {
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

  // Keep the selected location visible even while nearby places are clustered.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib || selected?.lat == null || selected?.lng == null) return undefined;
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'map-selected-pin';
    const icon = ICONS[categoryOf(selected).icon] || ICONS['map-pin'];
    // Only bundled, static icon paths go into this SVG.
    element.innerHTML = `<svg width="23" height="23" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${icon}</svg>`;
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
    return () => marker.remove();
  }, [selected?.id, selected?.lat, selected?.lng, ready, lang.value]);

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

  const select = (p) => { setQuery({ place: p.id, details: null }); setSheet(false); };
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
      {visible.map(({ p, d }) => <PlaceCard key={p.id} place={p} distance={d} compact showDescription active={p.id === selectedId} href={`/place/${p.id}`} onClick={(e) => { e.preventDefault(); select(p); }} />)}
    </div>
  ) : <Empty compact icon="map-trifold" title={t('map.nothingHere')} text={t('map.nothingHereText')} />;

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
          <p class="muted small map-count">{tn('map.placesInView', visible.length)}</p>
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
      {desktop && <MapSidebarHandle sidebar={sidebar} />}
      {checkin && <CheckinDialog place={checkin.place} onClose={() => { setCheckin(null); if (query.value.get('checkin')) setQuery({ checkin: null }); }} onAddPlace={startAdd} />}
      {adding && <AddPlaceDialog at={me} onClose={() => { setAdding(false); if (query.value.get('add')) setQuery({ add: null }); }} onCreated={(id) => navigate(`/place/${id}`)} />}
    </div>
  );
}
