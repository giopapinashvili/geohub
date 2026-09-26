import { Modal } from '../ui/Modal.jsx';
import { Icon } from '../ui/Icon.jsx';
import { t } from '../lib/i18n.js';
import { createMenu, openComposer, storyCreator } from '../lib/store.js';
import { navigate } from '../lib/router.js';

const OPTIONS = [
  { key: 'need', icon: 'megaphone', tone: '#2563eb', title: 'create.need', sub: 'create.needSub', run: () => navigate('/needs?new=1') },
  { key: 'post', icon: 'note-pencil', tone: '#2563eb', title: 'create.post', sub: 'create.postSub', run: () => openComposer({}) },
  { key: 'photo', icon: 'images', tone: '#16803c', title: 'create.photo', sub: 'create.photoSub', run: () => openComposer({ pick: 'media' }) },
  { key: 'story', icon: 'plus-circle', tone: '#b3207a', title: 'create.story', sub: 'create.storySub', run: () => { storyCreator.value = true; } },
  { key: 'reel', icon: 'film-strip', tone: '#c2410c', title: 'create.reel', sub: 'create.reelSub', run: () => navigate('/reels?upload=1') },
  { key: 'checkin', icon: 'map-pin', tone: '#0e7490', title: 'create.checkin', sub: 'create.checkinSub', run: () => navigate('/map?checkin=1') },
  { key: 'listing', icon: 'tag', tone: '#2563a8', title: 'create.listing', sub: 'create.listingSub', run: () => navigate('/marketplace/new') },
  { key: 'group', icon: 'users-three', tone: '#6b4fa0', title: 'create.group', sub: 'create.groupSub', run: () => navigate('/groups?create=1') },
  { key: 'page', icon: 'storefront', tone: '#a16207', title: 'create.page', sub: 'create.pageSub', run: () => navigate('/business/new') },
];

export function CreateMenu() {
  const close = () => { createMenu.value = false; };
  return (
    <Modal open onClose={close} title={t('nav.create')} size="md">
      <div class="create-grid">
        {OPTIONS.map((o) => (
          <button key={o.key} type="button" class="create-opt" onClick={() => { close(); o.run(); }}>
            <span class="create-opt-icon" style={{ '--tone': o.tone }}><Icon name={o.icon} size={24} /></span>
            <span class="create-opt-text">
              <strong>{t(o.title)}</strong>
              <span>{t(o.sub)}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
