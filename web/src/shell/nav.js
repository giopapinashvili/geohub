// Navigation structure shared by the header, the left column, the mobile
// bars and the menu page. `key` matches the route's `nav` value.

export const PRIMARY = [
  { key: 'home', href: '/', icon: 'house', iconActive: 'house-fill', label: 'nav.home' },
  { key: 'video', href: '/video', icon: 'monitor-play', iconActive: 'monitor-play-fill', label: 'nav.video' },
  { key: 'map', href: '/map', icon: 'map-trifold', iconActive: 'map-trifold-fill', label: 'nav.map' },
  { key: 'marketplace', href: '/marketplace', icon: 'storefront', iconActive: 'storefront-fill', label: 'nav.marketplace' },
  { key: 'groups', href: '/groups', icon: 'users-three', iconActive: 'users-three-fill', label: 'nav.groups' },
];

/** Left column / menu shortcuts, in display order. */
export const SECTIONS = [
  { key: 'friends', href: '/friends', icon: 'users', tone: '#2f7fd0', label: 'nav.friends', auth: true },
  { key: 'explore', href: '/explore', icon: 'compass', tone: '#1f8f6d', label: 'nav.explore' },
  { key: 'reels', href: '/reels', icon: 'film-strip', tone: '#d42a58', label: 'nav.reels' },
  { key: 'video', href: '/video', icon: 'monitor-play', tone: '#c2410c', label: 'nav.video' },
  { key: 'events', href: '/events', icon: 'calendar-blank', tone: '#b3207a', label: 'nav.events' },
  { key: 'groups', href: '/groups', icon: 'users-three', tone: '#2563a8', label: 'nav.groups' },
  { key: 'marketplace', href: '/marketplace', icon: 'storefront', tone: '#0e7490', label: 'nav.marketplace' },
  { key: 'map', href: '/map', icon: 'map-trifold', tone: '#15803d', label: 'nav.map' },
  { key: 'saved', href: '/saved', icon: 'bookmark-simple', tone: '#7c3aed', label: 'nav.saved', auth: true },
  { key: 'business', href: '/business', icon: 'briefcase', tone: '#a16207', label: 'nav.business' },
  { key: 'rewards', href: '/rewards', icon: 'gift', tone: '#de8f1f', label: 'nav.rewards' },
  { key: 'premium', href: '/premium', icon: 'crown', tone: '#e3325f', label: 'nav.premium' },
];

export const MOBILE_TABS = [
  { key: 'home', href: '/', icon: 'house', iconActive: 'house-fill', label: 'nav.home' },
  { key: 'reels', href: '/reels', icon: 'film-strip', iconActive: 'film-strip-fill', label: 'nav.reels' },
  { key: 'create', icon: 'plus', label: 'nav.create' },
  { key: 'map', href: '/map', icon: 'map-trifold', iconActive: 'map-trifold-fill', label: 'nav.map' },
  { key: 'menu', href: '/menu', icon: 'list', label: 'nav.menu' },
];

export const FOOTER_LINKS = [
  { href: '/about', label: 'nav.about' },
  { href: '/privacy', label: 'nav.privacy' },
  { href: '/terms', label: 'nav.terms' },
  { href: '/about?tab=safety', label: 'nav.safety' },
];
