const normalized = value => typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : '';
const isTbilisi = value => /^(?:(?:ქ\.?|ქალაქი)\s*)?(?:თბილისი|tbilisi|tiflis)$/.test(normalized(value));
const isGeorgia = value => /^(?:ge|geo|georgia|საქართველო)$/.test(normalized(value));

function phoneContext(place) {
  const raw = place?.raw || {}, tags = raw.tags || {};
  const countries = [place?.countryCode, place?.country, raw.countryCode, raw.country, tags['addr:country']].filter(value => normalized(value));
  const foreign = countries.some(value => !isGeorgia(value));
  const city = [place?.city, raw.city, tags['addr:city']].find(value => normalized(value));
  const tbilisi = !foreign && isTbilisi(city);
  // The imported dataset's explicit jurisdiction covers Tbilisi and its suburbs.
  // It establishes Georgia for mobiles, never a local landline area code.
  const georgia = !foreign && (tbilisi || countries.some(isGeorgia) || /^tbilisi-osm-\d{4}-\d{2}-\d{2}$/.test(raw.datasetId || ''));
  return { tbilisi, georgia };
}

function telephone(text, context) {
  // Labels/extension prose must not be concatenated into the subscriber number.
  const value = text.replace(/^(?:tel(?:ephone)?|phone|ტელ(?:ეფონი)?|მობ(?:ილური)?)\s*[:.]?\s*/i, '').trim();
  if (!/^[+\d\s().\-–—]+$/.test(value)) return '';
  const compact = value.replace(/[\s().\-–—]/g, '');
  const international = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  if (/^\+[1-9]\d{7,14}$/.test(international)) {
    if (international.startsWith('+995') && !/^\+995\d{9}$/.test(international)) return '';
    return international;
  }
  if (!/^\d+$/.test(compact)) return '';
  if (context.georgia) {
    if (/^995(?:32\d{7}|5\d{8})$/.test(compact)) return `+${compact}`;
    if (/^(?:32\d{7}|5\d{8})$/.test(compact)) return `+995${compact}`;
    if (/^0(?:32\d{7}|5\d{8})$/.test(compact)) return `+995${compact.slice(1)}`;
  }
  if (context.tbilisi && /^[2-9]\d{6}$/.test(compact)) return `+99532${compact}`;
  return '';
}

/** Keep each published contact readable; only explicit, unambiguous numbers become links. */
export function phoneContacts(value, place = {}) {
  const sources = Array.isArray(value) ? value.filter(entry => typeof entry === 'string') : typeof value === 'string' ? [value] : [];
  const context = phoneContext(place);
  return sources.flatMap(source => source.split(/[;,\n\r|/]+|\s+(?:and|და|&)\s+/i))
    // A second explicit international prefix starts another phone, not one long number.
    .flatMap(source => source.replace(/(\d)\s+(?=\+\d|\(\+\d)/g, '$1\n').split('\n'))
    .map(text => text.trim()).filter(Boolean).map(text => {
      const number = telephone(text, context);
      return { text, href: number ? `tel:${number}` : '' };
    });
}
