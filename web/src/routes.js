import { lazy } from 'preact/compat';

// A deploy replaces every hashed chunk; a tab opened before the deploy then
// fails to load the next page. Reload once to pick up the new build.
function page(loader) {
  return lazy(() => loader().catch((err) => {
    const key = 'gh_chunk_reload';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      location.reload();
      return new Promise(() => {});
    }
    throw err;
  }));
}

/**
 * layout:
 *   feed  — left navigation, content, right rail (desktop)
 *   page  — left navigation and wide content
 *   full  — header only; the page owns the whole width (map, chat, reels)
 *   bare  — no chrome (sign-in, onboarding)
 * auth: true — signed-out visitors are sent to /login
 */
export const ROUTES = [
  { path: '/', component: page(() => import('./pages/Home.jsx')), layout: 'page', nav: 'home' },
  { path: '/post/:id', component: page(() => import('./pages/PostPage.jsx')), layout: 'feed', nav: 'home' },
  { path: '/reels/:id?', component: page(() => import('./pages/Reels.jsx')), layout: 'full', nav: 'reels', immersive: true },
  { path: '/video', component: page(() => import('./pages/Video.jsx')), layout: 'page', nav: 'video' },
  { path: '/video/channel/:id', component: page(() => import('./pages/Channel.jsx')), layout: 'page', nav: 'video' },
  { path: '/watch/:id', component: page(() => import('./pages/Watch.jsx')), layout: 'full', nav: 'video' },
  { path: '/explore', component: page(() => import('./pages/Explore.jsx')), layout: 'page', nav: 'explore' },
  { path: '/search', component: page(() => import('./pages/Search.jsx')), layout: 'page', nav: 'explore' },
  { path: '/map', component: page(() => import('./pages/MapPage.jsx')), layout: 'full', nav: 'map' },
  { path: '/place/:id', component: page(() => import('./pages/Place.jsx')), layout: 'page', nav: 'explore' },
  { path: '/u/:id', component: page(() => import('./pages/Profile.jsx')), layout: 'page', nav: 'profile' },
  { path: '/messages/:id?', component: page(() => import('./pages/Messages.jsx')), layout: 'full', nav: 'messages', auth: true },
  { path: '/notifications', component: page(() => import('./pages/Notifications.jsx')), layout: 'feed', nav: 'notifications', auth: true },
  { path: '/friends', component: page(() => import('./pages/Friends.jsx')), layout: 'page', nav: 'friends', auth: true },
  { path: '/saved', component: page(() => import('./pages/Saved.jsx')), layout: 'page', nav: 'saved', auth: true },
  { path: '/business', component: page(() => import('./pages/BusinessHub.jsx')), layout: 'page', nav: 'business' },
  { path: '/business/new', component: page(() => import('./pages/BusinessNew.jsx')), layout: 'page', nav: 'business', auth: true },
  { path: '/business/:id', component: page(() => import('./pages/BusinessPage.jsx')), layout: 'page', nav: 'business' },
  { path: '/business/:id/manage', component: page(() => import('./pages/BusinessManage.jsx')), layout: 'page', nav: 'business', auth: true },
  { path: '/events', component: page(() => import('./pages/Events.jsx')), layout: 'page', nav: 'events' },
  { path: '/events/:id', component: page(() => import('./pages/EventPage.jsx')), layout: 'page', nav: 'events' },
  { path: '/groups', component: page(() => import('./pages/Groups.jsx')), layout: 'page', nav: 'groups' },
  { path: '/groups/:id', component: page(() => import('./pages/GroupPage.jsx')), layout: 'page', nav: 'groups' },
  { path: '/marketplace', component: page(() => import('./pages/Marketplace.jsx')), layout: 'page', nav: 'marketplace' },
  { path: '/marketplace/new', component: page(() => import('./pages/MarketNew.jsx')), layout: 'page', nav: 'marketplace', auth: true },
  { path: '/marketplace/:id', component: page(() => import('./pages/MarketItem.jsx')), layout: 'page', nav: 'marketplace' },
  { path: '/rewards', component: page(() => import('./pages/Rewards.jsx')), layout: 'page', nav: 'rewards' },
  { path: '/premium', component: page(() => import('./pages/Premium.jsx')), layout: 'page', nav: 'premium' },
  { path: '/settings/:section?', component: page(() => import('./pages/Settings.jsx')), layout: 'page', nav: 'settings', auth: true },
  { path: '/menu', component: page(() => import('./pages/MenuPage.jsx')), layout: 'page', nav: 'menu' },
  { path: '/login', component: page(() => import('./pages/Login.jsx')), layout: 'bare' },
  { path: '/signup', component: page(() => import('./pages/Signup.jsx')), layout: 'bare' },
  { path: '/onboarding', component: page(() => import('./pages/Onboarding.jsx')), layout: 'bare', auth: true },
  { path: '/invite/:code?', component: page(() => import('./pages/Invite.jsx')), layout: 'bare' },
  { path: '/admin/:section?', component: page(() => import('./pages/Admin.jsx')), layout: 'full', nav: 'admin', auth: true },
  { path: '/about', component: page(() => import('./pages/About.jsx')), layout: 'page', nav: 'about' },
  { path: '/privacy', component: page(() => import('./pages/Legal.jsx')), layout: 'page', props: { doc: 'privacy' } },
  { path: '/terms', component: page(() => import('./pages/Legal.jsx')), layout: 'page', props: { doc: 'terms' } },
];

export const NOT_FOUND = { path: '*', component: page(() => import('./pages/NotFound.jsx')), layout: 'page' };
