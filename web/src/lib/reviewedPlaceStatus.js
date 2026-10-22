/** Exact reviewed location decisions. A missing/old source is never proof of closure. */
const sourceConflict = (id, reason) => ({
  status: 'needs-review', checkedAt: '2026-10-19', hideFromMap: true, reason,
  sourceUrls: [`https://www.openstreetmap.org/${id.replace('osm_', '').replace('_', '/')}`],
  evidenceKind: 'current-source-conflict',
});

export const REVIEWED_PLACE_STATUS = {
  osm_node_11831337269: {
    status: 'needs-review', checkedAt: '2026-10-19', hideFromMap: true,
    reason: 'ნაძალადევთან მდებარეობაზე მიღებულია შეუსაბამობის შეტყობინება. ბიბლუსის ოფიციალურ სიაში კვლავ არის დადიანის 137-ის ფილიალი, თუმცა ამ წერტილის შესაბამისობა და ადგილზე მიმდინარე საქმიანობა ცალკე ვერ დადასტურდა.',
    sourceUrls: ['https://biblusi.ge/contact', 'https://www.openstreetmap.org/node/11831337269'],
    evidenceKind: 'user-report-conflicts-with-official-listing',
  },
  directory_liberty_253110: {
    status: 'needs-review', checkedAt: '2026-10-19', hideFromMap: true,
    reason: 'ბანკის წყაროში ლებანიძის 19-ის მისამართს სხვა უბანში მდებარე კოორდინატი ახლავს. ამ კონკრეტული აპარატის სწორი წერტილი დასაზუსტებელია.',
    sourceUrls: ['https://libertybank.ge/ka/chven-shesakheb/kompaniis-shesakheb/bankomatebi'],
    evidenceKind: 'official-address-coordinate-conflict',
  },
  osm_node_11891519969: {
    status: 'needs-review', checkedAt: '2026-10-19', hideFromMap: true,
    reason: 'ადგილმდებარეობა გადასამოწმებელია: მიღებულია შეუსაბამობის შეტყობინება. წყაროში ობიექტის გადამოწმების ბოლო თარიღია 09.05.2024; მიმდინარე საქმიანობა ვერ დადასტურდა.',
    sourceUrls: ['https://www.openstreetmap.org/node/11891519969'],
    evidenceKind: 'user-report-and-source-review',
  },
  osm_node_11891519970: {
    status: 'needs-review', checkedAt: '2026-10-19', hideFromMap: true,
    reason: 'ადგილმდებარეობა გადასამოწმებელია: მიღებულია შეუსაბამობის შეტყობინება. წყაროში ობიექტის გადამოწმების ბოლო თარიღია 09.05.2024; მიმდინარე საქმიანობა ვერ დადასტურდა.',
    sourceUrls: ['https://www.openstreetmap.org/node/11891519970'],
    evidenceKind: 'user-report-and-source-review',
  },
  osm_node_11799440269: sourceConflict('osm_node_11799440269', 'წყაროში მითითებულია ასათიანის ქუჩაზე გადასვლა. ახალი ფილიალის ზუსტი მისამართი და კოორდინატები დასაზუსტებელია; ძველ წერტილზე მიმართულება დროებით შეჩერებულია.'),
  osm_node_14023067343: sourceConflict('osm_node_14023067343', 'წყაროში აღნიშნულია აღმაშენებლის გამზირის 28-ში გადასვლა. გადასვლის დასრულება და შესასვლელის ზუსტი წერტილი დასაზუსტებელია.'),
  osm_node_4428539589: sourceConflict('osm_node_4428539589', 'წყარო ერთდროულად მიუთითებს მოქმედ და გაუქმებულ აფთიაქს. საქმიანობის მიმდინარე სტატუსი დასაზუსტებელია.'),
  osm_node_4473111715: sourceConflict('osm_node_4473111715', 'წყარო ერთდროულად მიუთითებს მოქმედ და გაუქმებულ აფთიაქს. საქმიანობის მიმდინარე სტატუსი დასაზუსტებელია.'),
  osm_node_11368918412: sourceConflict('osm_node_11368918412', 'წყარო ერთდროულად მიუთითებს მოქმედ და გაუქმებულ აფთიაქს. საქმიანობის მიმდინარე სტატუსი დასაზუსტებელია.'),
  osm_way_1280782849: sourceConflict('osm_way_1280782849', 'წყაროში სამუშაო საათების ნაცვლად მითითებულია „დახურულია“. მიმდინარე მდგომარეობა და შესაძლო ხელახალი გახსნა დასაზუსტებელია.'),
  osm_way_1330435491: sourceConflict('osm_way_1330435491', 'წყარო ერთდროულად მიუთითებს მოქმედ და გაუქმებულ საზოგადოებრივ ტუალეტს. ხელმისაწვდომობა დასაზუსტებელია.'),
  osm_node_12518762942: {
    status: 'address-corrected', checkedAt: '2026-10-19', hideFromMap: false,
    reason: 'მისამართი განახლებულია კომპანიის მიმდინარე საკონტაქტო გვერდის მიხედვით. რუკაზე ნაჩვენებია ატრიუმის ბიზნეს ცენტრის სავარაუდო ცენტრი; ოფისის ზუსტი შესასვლელი ცალკე დადასტურებული არ არის.',
    address: 'გიორგი სააკაძის მე-2 გასასვლელი 1ა, ბიზნეს ცენტრი ატრიუმი, I სართული',
    coordinates: { lat: 41.7254419, lng: 44.7804421 },
    fields: { website: 'https://www.aigcars.ge/', phone: '+995 32 211 12 13; +995 596 29 60 60; +995 596 46 60 60', openingHours: 'Mo-Fr 10:00-18:00' },
    coordinateNote: 'კომპანიის მისამართთან შეჯერებული ბიზნეს ცენტრის სავარაუდო ცენტრი; ოფისის შესასვლელის წერტილი უცნობია.',
    sourceUrls: ['https://www.aigcars.ge/კონტაქტი', 'https://www.openstreetmap.org/way/1103005478'],
    coordinateSourceId: 'osm_way_1103005478',
    evidenceKind: 'official-contact-and-named-building',
  },
};

export function reviewedPlaceStatus(place) {
  const id = typeof place === 'string' ? place : place?.raw?.linkedOsmId || place?.id;
  return REVIEWED_PLACE_STATUS[id] || (typeof place === 'object' ? place?.raw?.locationReview : null) || null;
}

export function isPlaceLocationHeld(place) {
  return reviewedPlaceStatus(place)?.hideFromMap === true;
}

/** Preserve IDs, ownership and old coordinates. Only explicit evidence changes a location. */
export function applyReviewedPlaceStatus(place) {
  if (!place?.id) return place;
  const review = reviewedPlaceStatus(place);
  if (!review) return place;
  const raw = { ...place.raw, locationReview: review };
  if (review.hideFromMap) raw.mapHidden = true;
  if (review.coordinates) {
    raw.originalReviewedCoordinates ||= { lat: place.lat, lng: place.lng };
    raw.originalReviewedAddress ??= place.address || '';
    raw.coordinateAccuracy = 'approximate-center';
    raw.coordinateNote = review.coordinateNote;
    raw.coordinateEvidenceUrl = review.sourceUrls[0];
    raw.coordinateSourceId = review.coordinateSourceId;
  }
  if (review.fields) {
    raw.originalReviewedFields ||= Object.fromEntries(Object.keys(review.fields).map(key=>[key, raw[key] ?? null]));
    Object.assign(raw, review.fields);
  }
  return { ...place, ...(review.coordinates || {}), ...(review.address ? { address: review.address } : {}), raw };
}
