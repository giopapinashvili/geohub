// Verified publisher links, matched to exact places. A checked link date is
// not a menu-effective date. These links do not invent searchable catalog items.
const SOURCES = {
  osm_way_548795814: {
    venue: 'ფაბრიკა', publisherUrl: 'https://www.hostelfabrika.com/eats', checkedAt: '2026-10-19', menuDate: null,
    note: 'ფაბრიკის ოფიციალური გვერდი ცალკე მენიუებს აქვეყნებს Lobby Bar-ისთვის, Bar Bagel-ისთვის და F.A.R.M-ისთვის.',
    dateNote: 'მენიუების მოქმედების თარიღი წყაროში მითითებული არ არის.',
    links: [{ title: 'Lobby Bar · Bar Bagel · F.A.R.M — მენიუები', url: 'https://linktr.ee/fabrika.hostel', kind: 'directory' }],
  },
  osm_node_6404748085: {
    venue: 'კაფე სტამბა', publisherUrl: 'https://guest.stambahotel.com/cafe-stamba', checkedAt: '2026-10-19', menuDate: null,
    note: 'ოფიციალურ გვერდზე ცალკეა საუზმე, ძირითადი მენიუ, დესერტი და ღვინო.',
    dateNote: 'წყაროს მენიუს ფაილები ატვირთულია 15.09.2025. ეს თარიღი დღევანდელი ფასების დადასტურებას არ ნიშნავს.',
    sourceUploadedAt: '2025-09-15',
    links: [{ title: 'კაფე სტამბას ოფიციალური მენიუები', url: 'https://guest.stambahotel.com/cafe-stamba#menu', kind: 'menu' }],
  },
  osm_node_8432033717: {
    venue: 'კაფე დაფნა — ათონელის 29', publisherUrl: 'https://daphna.ge/', checkedAt: '2026-10-19', menuDate: null,
    note: 'თბილისის ფილიალის მენიუ, გიორგი ათონელის ქუჩა 29. ბმული რესტორნის ოფიციალური საიტიდანაა.',
    dateNote: 'მენიუს განახლების თარიღი წყაროში მითითებული არ არის.',
    links: [{ title: 'თბილისის ფილიალის მენიუ', url: 'https://cafedaphna.ge/qr-menu/tbilisi/', kind: 'menu' }],
  },
};

export function officialMenuSources(place) {
  return SOURCES[place?.id] || null;
}
