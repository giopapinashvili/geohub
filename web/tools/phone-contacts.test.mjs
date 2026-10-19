import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneContacts } from '../src/lib/phoneContacts.js';

const tbilisi = { city: 'თბილისი' };
const hrefs = (value, place = tbilisi) => phoneContacts(value, place).map(row => row.href);

test('FINO and AACC local contacts get Tbilisi prefix without rewriting the published text', () => {
  assert.deepEqual(phoneContacts('2193011', tbilisi), [{ text: '2193011', href: 'tel:+995322193011' }]);
  assert.deepEqual(phoneContacts('2502021', tbilisi), [{ text: '2502021', href: 'tel:+995322502021' }]);
  assert.deepEqual(phoneContacts('2 438 999', { city: 'Tbilisi' }), [{ text: '2 438 999', href: 'tel:+995322438999' }]);
  assert.deepEqual(hrefs('270 85 78', { raw: { tags: { 'addr:city': 'ქ. თბილისი' } } }), ['tel:+995322708578']);
});

test('Georgia or dataset context alone never guesses a seven-digit landline area code', () => {
  for (const place of [{}, { country: 'Georgia' }, { city: 'Batumi', country: 'GE' }, { raw: { datasetId: 'tbilisi-osm-2026-10-17' } }, { city: 'Tbilisi', country: 'US' }]) {
    assert.deepEqual(phoneContacts('2193011', place), [{ text: '2193011', href: '' }]);
  }
});

test('Georgian mobile and explicitly coded Tbilisi numbers normalize only in known Georgian context', () => {
  const values = ['(599) 58 50 44', '032 224 30 30', '(32) 254 58 45', '995 599 585044', '0599585044'];
  const expected = ['tel:+995599585044', 'tel:+995322243030', 'tel:+995322545845', 'tel:+995599585044', 'tel:+995599585044'];
  assert.deepEqual(values.flatMap(value => hrefs(value, { countryCode: 'GE' })), expected);
  assert.deepEqual(hrefs('(599) 58 50 44', { raw: { datasetId: 'tbilisi-osm-2026-10-17' } }), [expected[0]]);
  assert.deepEqual(hrefs('(599) 58 50 44', {}), ['']);
  assert.deepEqual(hrefs('032 224 30 30', { city: 'Paris', country: 'France' }), ['']);
});

test('every explicit contact stays separate, including multiple international numbers', () => {
  const text = '+995 32 222 43 09;+995 32 299 00 01';
  assert.deepEqual(phoneContacts(text, {}), [
    { text: '+995 32 222 43 09', href: 'tel:+995322224309' },
    { text: '+995 32 299 00 01', href: 'tel:+995322990001' },
  ]);
  for (const separator of [', ', ' / ', ' | ', '\n', ' და ', ' and ', ' & ']) {
    assert.deepEqual(hrefs(`2193011${separator}2502021`), ['tel:+995322193011', 'tel:+995322502021']);
  }
  assert.deepEqual(hrefs('+995 599 585044 +995 577 123456'), ['tel:+995599585044', 'tel:+995577123456']);
  assert.deepEqual(hrefs(['2193011', '2502021']), ['tel:+995322193011', 'tel:+995322502021']);
});

test('explicit international numbers remain international and malformed/prose values remain readable', () => {
  assert.deepEqual(hrefs('+44 20 7946 0958', {}), ['tel:+442079460958']);
  assert.deepEqual(hrefs('0044 20 7946 0958', {}), ['tel:+442079460958']);
  assert.deepEqual(hrefs('(+995 32) 254 58 45', {}), ['tel:+995322545845']);
  assert.deepEqual(hrefs('ტელ: 2193011'), ['tel:+995322193011']);
  for (const value of ['Call 2193011 ext 5', '+9951234', '+995 322 193 011 577 123456', '2193011 2502021', 'javascript:alert(2193011)', '*123#', '112', '2193011 ext. 02', 'ნომერი დროებით გამორთულია']) {
    assert.deepEqual(phoneContacts(value, tbilisi), [{ text: value, href: '' }], value);
  }
  assert.deepEqual(phoneContacts(null), []);
});
