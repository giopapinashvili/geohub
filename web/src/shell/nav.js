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
  { key: 'home', href: '/', icon: 'house', tone: '#2563eb', label: 'nav.home' },
  { key: 'needs', href: '/needs', icon: 'megaphone', tone: '#f97316', label: 'nav.needs' },
  { key: 'explore', href: '/explore', icon: 'compass', tone: '#06b6d4', label: 'nav.explore' },
  { key: 'business', href: '/business', icon: 'briefcase', tone: '#8b5cf6', label: 'nav.business' },
  { key: 'marketplace', href: '/marketplace', icon: 'storefront', tone: '#10b981', label: 'nav.marketplace' },
  { key: 'map', href: '/map', icon: 'map-trifold', tone: '#16a34a', label: 'nav.map' },
  { key: 'events', href: '/events', icon: 'calendar-blank', tone: '#f43f5e', label: 'nav.events' },
  { key: 'groups', href: '/groups', icon: 'users-three', tone: '#6366f1', label: 'nav.groups' },
  { key: 'friends', href: '/friends', icon: 'users', tone: '#0ea5e9', label: 'nav.friends', auth: true },
  { key: 'video', href: '/video', icon: 'monitor-play', tone: '#ef4444', label: 'nav.video' },
  { key: 'reels', href: '/reels', icon: 'film-strip', tone: '#d946ef', label: 'nav.reels' },
  { key: 'saved', href: '/saved', icon: 'bookmark-simple', tone: '#a855f7', label: 'nav.saved', auth: true },
  { key: 'rewards', href: '/rewards', icon: 'gift', tone: '#f59e0b', label: 'nav.rewards' },
  { key: 'premium', href: '/premium', icon: 'crown', tone: '#eab308', label: 'nav.premium' },
];

export const MOBILE_TABS = [
  { key: 'home', href: '/', icon: 'house', iconActive: 'house-fill', label: 'nav.home', tone: '#2563eb' },
  { key: 'explore', href: '/explore', icon: 'compass', iconActive: 'compass-fill', label: 'nav.explore', tone: '#06b6d4' },
  { key: 'create', icon: 'plus', label: 'nav.create' },
  { key: 'marketplace', href: '/marketplace', icon: 'storefront', iconActive: 'storefront-fill', label: 'nav.marketplace', tone: '#10b981' },
  { key: 'menu', href: '/menu', icon: 'list', label: 'nav.menu', tone: '#8b5cf6' },
];

export const FOOTER_LINKS = [
  { href: '/about', label: 'nav.about' },
  { href: '/privacy', label: 'nav.privacy' },
  { href: '/terms', label: 'nav.terms' },
  { href: '/about?tab=safety', label: 'nav.safety' },
];
