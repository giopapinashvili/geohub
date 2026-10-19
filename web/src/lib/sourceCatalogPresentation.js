import { formatCommercePrice } from './commerce.js';

/** A weighed price, base price and minimum order are different facts. */
export function sourceCatalogPriceLabel(item) {
  if (item.priceMinor == null) return formatCommercePrice(null,item.currency);
  if (item.priceMinor === 0 && item.priceType === 'base-with-required-options') return 'ფასი არჩევანზეა დამოკიდებული';
  if (Number.isSafeInteger(item.sellByWeight?.pricePerKgMinor)) return `${formatCommercePrice(item.sellByWeight.pricePerKgMinor,item.currency)} / კგ`;
  return `${formatCommercePrice(item.priceMinor,item.currency)}${item.priceKind==='from' ? '-დან' : ''}${item.priceUnit ? ` / ${item.priceUnit}` : ''}`;
}
