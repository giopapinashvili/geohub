import { authors, licenses, images, places } from './curatedPlaceMedia.generated.js';
import { getPlaceEditorial } from './curatedPlaceEditorial.js';
import { getInstitutionPhotos } from './curatedInstitutionMedia.generated.js';
import { isExcludedCuratedPhoto } from './curatedPlaceMediaExclusions.js';

// Exact OSM matches only. The generated entries use explicit Commons/Wikidata
// source links; full linkage, source and SHA metadata is /place-media/credits.json.
// Never assign a photograph by a matching business name alone.
const MEDIA = {
  osm_way_548795814: [
    { url: '/place-media/fabrika-courtyard-d7474793ae81.jpg', caption: 'ფაბრიკის ეზო', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Courtyard_view_of_Fabrika_Tbilisi.jpg', author: 'Tabeabenlakehal', authorUrl: 'https://commons.wikimedia.org/wiki/User:Tabeabenlakehal', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', dateTaken: '2023-08-19' },
    { url: '/place-media/fabrika-night-fce40f840200.jpg', caption: 'ფაბრიკა საღამოს', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fabrika_Tbilisi,_an_urban_culture_hub_in_the_capital_of_Georgia.jpg', author: 'Alf Altendorf', authorUrl: 'https://www.flickr.com/people/alfaltendorf/', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/', dateTaken: '2022-09-02' },
  ],
  osm_relation_19640789: [
    { url: '/place-media/rustaveli-theatre-03d1e4bc7b06.jpg', caption: 'რუსთაველის თეატრის ფასადი', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Rustaveli_Theater,_Tbilisi.jpg', author: 'Armineaghayan', authorUrl: 'https://commons.wikimedia.org/wiki/User:Armineaghayan', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', dateTaken: '2016-05-06' },
  ],
  osm_way_38424053: [
    { url: '/place-media/tbilisi-central-19df9530f8a9.jpg', caption: 'თბილისი ცენტრალის შენობა', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tbilisi_Central_Station_-_panoramio.jpg', author: 'DJMX', authorUrl: '', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', dateTaken: '2012-04-03' },
  ],
};

export function applyCuratedPlaceMedia(place) {
  const sourceId = place?.raw?.linkedOsmId || place?.id;
  const editorial = getPlaceEditorial(sourceId);
  if (editorial) place = { ...place, description: place.description || editorial.description,
    raw: { ...place.raw, editorial, website: place.raw?.website || editorial.website } };
  const generated = places[sourceId];
  const manual = MEDIA[sourceId];
  const institution = getInstitutionPhotos(sourceId);
  if (!generated && !manual && !institution.length) return place;
  const media = [...institution, ...(manual || []), ...(generated || []).filter(([imageIndex]) => !isExcludedCuratedPhoto(sourceId, images[imageIndex][1])).map(([imageIndex, caption]) => {
    const [hash, sourceTitle, authorIndex, licenseIndex, dateTaken] = images[imageIndex];
    const [author, authorUrl] = authors[authorIndex];
    const [license, licenseUrl] = licenses[licenseIndex];
    return {
      url: `/place-media/commons-${hash}.jpg`, caption, sourceTitle,
      sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(sourceTitle.slice(5).replaceAll(' ', '_'))}`,
      author, authorUrl, license, licenseUrl, dateTaken,
    };
  })];
  return {
    ...place, image: place.image || media[0].url,
    photos: [...new Set([...(place.photos || []), ...media.map((photo) => photo.url)])],
    raw: { ...place.raw, photoCredits: [...(place.raw?.photoCredits || []), ...media.filter((photo) => !place.raw?.photoCredits?.some((credit) => credit.url === photo.url))] },
  };
}
