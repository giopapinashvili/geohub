// Reviewed 2026-10-19. Entity-wide Wikidata P18 may depict a different campus
// from the current representative pin; keep exclusions stable across regeneration.
const exclusions = {
  osm_relation_16507696: ['File:Georgische Technische Universität - 1. Korpus.jpg'],
};

export function isExcludedCuratedPhoto(placeId, sourceTitle) {
  return exclusions[placeId]?.includes(sourceTitle) || false;
}
