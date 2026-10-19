/** Station centers describe underground platforms, not pedestrian access.
 * Resolve entrances through explicit OSM stop_area membership, never proximity.
 */
export function linkMetroEntrances(places, elements) {
  const byId = new Map(places.map(place => [place.id, place]));
  const links = new Map();
  const stations = new Map();
  for (const area of elements) {
    if (area.type !== 'relation' || area.tags?.public_transport !== 'stop_area') continue;
    const members = (area.members || []).map(member => byId.get(`osm_${member.type}_${member.id}`)).filter(Boolean);
    const stationMembers = members.filter(place => place.category === 'metro');
    const entrances = members.filter(place => place.category === 'metro-entrance');
    if (!stationMembers.length || !entrances.length) continue;
    const name = area.tags['name:ka'] || stationMembers[0].name;
    const sourceUrl = `https://www.openstreetmap.org/relation/${area.id}`;
    for (const entrance of entrances) {
      if (!links.has(entrance.id)) links.set(entrance.id, []);
      links.get(entrance.id).push({ name, sourceUrl, stationIds: stationMembers.map(place => place.id),
        aliases: [area.tags['name:en'], area.tags['name:ru'], ...stationMembers.flatMap(place => place.aliases || [])].filter(Boolean) });
    }
    for (const station of stationMembers) {
      if (!stations.has(station.id)) stations.set(station.id, new Map());
      for (const entrance of entrances) stations.get(station.id).set(entrance.id, entrance);
    }
  }
  for (const [id, areas] of links) {
    const entrance = byId.get(id);
    const names = [...new Set(areas.map(area => area.name))];
    const previousName = entrance.name;
    entrance.name = names.join(' / ');
    entrance.aliases = [...new Set([...names, ...areas.flatMap(area => area.aliases), ...(entrance.aliases || [])])].filter(name => name !== entrance.name);
    entrance.raw = { ...entrance.raw, named: true, entranceName: previousName,
      metroStationIds: [...new Set(areas.flatMap(area => area.stationIds))],
      metroNameSourceUrls: [...new Set(areas.map(area => area.sourceUrl))],
      coordinateNote: 'მეტროს ჩასასვლელი — რუკაზე აღნიშნული შესასვლელის კოორდინატები.' };
  }
  for (const station of places.filter(place => place.category === 'metro')) {
    const entrances = [...(stations.get(station.id)?.values() || [])].sort((a, b) => a.id.localeCompare(b.id));
    station.raw = { ...station.raw, mapHidden: true, metroEntranceIds: entrances.map(place => place.id),
      ...(entrances[0] ? { mapPlaceId: entrances[0].id, mapCoordinates: {lat:entrances[0].lat,lng:entrances[0].lng} } : {}),
      coordinateNote: 'სადგურის მიწისქვეშა მდებარეობა. რუკაზე მეტროს ნიშნები მხოლოდ ჩასასვლელებთან ჩანს.' };
  }
  return { stations: stations.size, namedEntrances: links.size,
    unresolvedEntrances: places.filter(place => place.category === 'metro-entrance' && !links.has(place.id)).map(place => place.id) };
}
