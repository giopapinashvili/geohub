/* GeoHub notification mock data. Frontend only. */

const MOCK_NOTIFICATIONS = [
  { id: 'n01', type: 'follow', icon: 'user-plus', userId: 'u12', title: 'New follower', body: 'Medea Sharashidze started following you.', href: 'profile.html?user=medea.hidden', time: '4 min ago', unread: true },
  { id: 'n02', type: 'comment', icon: 'comment-dots', userId: 'u03', title: 'Comment reply', body: 'Mariam replied to your Fabrika check-in.', href: 'feed.html#p01', time: '18 min ago', unread: true },
  { id: 'n03', type: 'challenge', icon: 'trophy', userId: 'u08', title: 'Challenge completed', body: 'Free Events Hunter is complete. +120 XP unlocked.', href: 'challenges.html', time: '1h ago', unread: true },
  { id: 'n04', type: 'reward', icon: 'gift', userId: 'u29', title: 'Reward unlocked', body: 'Roasters Lab added a QR coffee reward near you.', href: 'rewards.html', time: '2h ago', unread: false },
  { id: 'n05', type: 'invite', icon: 'paper-plane', userId: 'u06', title: 'Friend invite', body: 'Tamo invited you to Fabrika Night Market.', href: 'feed.html', time: '3h ago', unread: false },
  { id: 'n06', type: 'business', icon: 'store', userId: 'u20', title: 'Business offer', body: 'Mestia Svan Guesthouse posted a hiker reward.', href: 'business.html?id=8', time: '6h ago', unread: false },
  { id: 'n07', type: 'xp', icon: 'bolt', userId: 'u01', title: 'XP milestone', body: 'You crossed another GeoHub XP milestone.', href: 'profile.html', time: 'Yesterday', unread: false }
];

window.MOCK_NOTIFICATIONS = MOCK_NOTIFICATIONS;
