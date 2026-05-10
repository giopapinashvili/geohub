/* GeoHub social interaction mock data. Frontend only. */

const MOCK_INTERACTIONS = {
  comments: {
    p01: [
      { id: 'c-p01-1', userId: 'u03', text: 'This table near the window is my favorite.', likes: 8, replies: [{ id: 'r-p01-1', userId: 'u01', text: 'Exactly. Best morning light there.', likes: 3 }] },
      { id: 'c-p01-2', userId: 'u08', text: 'Was the Wi-Fi stable today?', likes: 3, replies: [] }
    ],
    p02: [
      { id: 'c-p02-1', userId: 'u27', text: 'Confirming the wind after 2pm is serious.', likes: 14, replies: [] },
      { id: 'c-p02-2', userId: 'u18', text: 'Saving this for next weekend.', likes: 6, replies: [{ id: 'r-p02-1', userId: 'u02', text: 'Start early and you will be fine.', likes: 4 }] }
    ],
    p03: [
      { id: 'c-p03-1', userId: 'u21', text: 'I am bringing two friends.', likes: 9, replies: [] },
      { id: 'c-p03-2', userId: 'u13', text: 'After 21:00 is the good part.', likes: 12, replies: [] }
    ],
    p04: [
      { id: 'c-p04-1', userId: 'u25', text: 'Claimed mine this morning.', likes: 5, replies: [] },
      { id: 'c-p04-2', userId: 'u11', text: 'Budget-friendly coffee run approved.', likes: 7, replies: [] }
    ],
    p07: [
      { id: 'c-p07-1', userId: 'u05', text: 'Huge respect. This should be a weekly mission.', likes: 22, replies: [{ id: 'r-p07-1', userId: 'u19', text: 'Planning one for next Sunday.', likes: 10 }] },
      { id: 'c-p07-2', userId: 'u09', text: 'I can join the next Batumi task.', likes: 11, replies: [] }
    ]
  },
  reactions: {
    p01: { like: 128, love: 22, fire: 9, wow: 6, saved: 31, going: 0, interested: 14 },
    p02: { like: 284, love: 41, fire: 65, wow: 18, saved: 93, going: 12, interested: 44 },
    p03: { like: 201, love: 35, fire: 74, wow: 12, saved: 28, going: 217, interested: 88 },
    p04: { like: 96, love: 13, fire: 18, wow: 4, saved: 22, going: 0, interested: 31 },
    p05: { like: 176, love: 28, fire: 15, wow: 7, saved: 44, going: 0, interested: 19 },
    p06: { like: 77, love: 16, fire: 11, wow: 5, saved: 18, going: 0, interested: 23 },
    p07: { like: 312, love: 90, fire: 38, wow: 21, saved: 76, going: 14, interested: 52 },
    p08: { like: 421, love: 112, fire: 44, wow: 59, saved: 180, going: 0, interested: 67 },
    p09: { like: 133, love: 21, fire: 18, wow: 8, saved: 40, going: 28, interested: 86 },
    p10: { like: 89, love: 12, fire: 9, wow: 4, saved: 24, going: 0, interested: 31 },
    p11: { like: 101, love: 18, fire: 8, wow: 7, saved: 33, going: 16, interested: 75 },
    p12: { like: 22, love: 7, fire: 1, wow: 2, saved: 3, going: 0, interested: 8 }
  },
  friendsToShare: ['u03', 'u05', 'u06', 'u08', 'u14', 'u21'],
  activity: [
    { icon: '📍', userId: 'u03', text: 'checked in at Coffee Lab Vake', href: 'feed.html' },
    { icon: '🏆', userId: 'u08', text: 'completed Free Events Hunter', href: 'challenges.html' },
    { icon: '🎁', userId: 'u25', text: 'claimed a beauty reward', href: 'rewards.html' },
    { icon: '🎟️', userId: 'u06', text: 'joined Fabrika Night Market', href: 'feed.html' },
    { icon: '🏪', userId: 'u29', text: 'posted a new QR coffee offer', href: 'business.html?id=6' }
  ]
};

window.MOCK_INTERACTIONS = MOCK_INTERACTIONS;
