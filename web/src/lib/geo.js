import { lang } from './i18n.js';

/** Georgian cities offered in forms. The Georgian name is what gets stored. */
export const CITIES = [
  { ka: 'თბილისი', en: 'Tbilisi', ru: 'Тбилиси', lat: 41.7151, lng: 44.8271 },
  { ka: 'ბათუმი', en: 'Batumi', ru: 'Батуми', lat: 41.6168, lng: 41.6367 },
  { ka: 'ქუთაისი', en: 'Kutaisi', ru: 'Кутаиси', lat: 42.2679, lng: 42.6946 },
  { ka: 'რუსთავი', en: 'Rustavi', ru: 'Рустави', lat: 41.5495, lng: 44.9933 },
  { ka: 'გორი', en: 'Gori', ru: 'Гори', lat: 41.9842, lng: 44.1158 },
  { ka: 'ზუგდიდი', en: 'Zugdidi', ru: 'Зугдиди', lat: 42.5088, lng: 41.8709 },
  { ka: 'ფოთი', en: 'Poti', ru: 'Поти', lat: 42.1462, lng: 41.6719 },
  { ka: 'თელავი', en: 'Telavi', ru: 'Телави', lat: 41.9198, lng: 45.4731 },
  { ka: 'სიღნაღი', en: 'Sighnaghi', ru: 'Сигнахи', lat: 41.6197, lng: 45.9227 },
  { ka: 'ბორჯომი', en: 'Borjomi', ru: 'Боржоми', lat: 41.8386, lng: 43.3796 },
  { ka: 'მესტია', en: 'Mestia', ru: 'Местиа', lat: 43.0456, lng: 42.7297 },
  { ka: 'ყაზბეგი', en: 'Kazbegi', ru: 'Казбеги', lat: 42.6572, lng: 44.6437 },
  { ka: 'ქობულეთი', en: 'Kobuleti', ru: 'Кобулети', lat: 41.8214, lng: 41.7792 },
  { ka: 'მცხეთა', en: 'Mtskheta', ru: 'Мцхета', lat: 41.8455, lng: 44.7207 },
  { ka: 'ახალციხე', en: 'Akhaltsikhe', ru: 'Ахалцихе', lat: 41.6390, lng: 42.9826 },
  { ka: 'ოზურგეთი', en: 'Ozurgeti', ru: 'Озургети', lat: 41.9244, lng: 42.0068 },
  { ka: 'ამბროლაური', en: 'Ambrolauri', ru: 'Амбролаури', lat: 42.5214, lng: 43.1622 },
  { ka: 'გუდაური', en: 'Gudauri', ru: 'Гудаури', lat: 42.4777, lng: 44.4783 },
];

export const GEORGIA_CENTER = { lat: 42.15, lng: 43.55, zoom: 6.4 };

export function cityOptions() {
  const l = lang.value;
  return CITIES.map((c) => ({ value: c.ka, label: c[l] || c.ka }));
}

/** Display name for a stored city value (Georgian, English or a slug). */
export function cityLabel(value) {
  if (!value || value === 'all_georgia') return '';
  const v = String(value).toLowerCase();
  const c = CITIES.find((x) => x.ka === value || x.en.toLowerCase() === v || x.ru.toLowerCase() === v);
  return c ? (c[lang.value] || c.ka) : value;
}
