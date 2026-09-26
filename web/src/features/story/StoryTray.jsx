import { useEffect, useRef, useState } from 'preact/hooks';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { IconButton } from '../../ui/Button.jsx';
import { Img, Skeleton } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { profile, signedIn, uid } from '../../lib/auth.js';
import { storyCreator, requireLogin } from '../../lib/store.js';
import { listenStoryTray } from '../../data/stories.js';
import { safeBackground } from '../post/backgrounds.js';
import { query as queryParams, setQuery } from '../../lib/router.js';
import { StoryViewer } from './StoryViewer.jsx';

function StoryCard({ group, onOpen }) {
  const latest = group.stories[group.stories.length - 1];
  const bg = safeBackground(latest.bg);
  return (
    <button type="button" class={`story-card${group.seen ? ' is-seen' : ''}`} onClick={onOpen} aria-label={t('stories.open', { name: group.name })}>
      {latest.mediaUrl
        ? <Img src={latest.mediaUrl} width={120} class="story-card-img" alt="" />
        : <span class="story-card-text" style={{ background: (bg || safeBackground('pomegranate')).css }}>{latest.text.slice(0, 40)}</span>}
      <span class="story-card-shade" aria-hidden="true" />
      <span class="story-card-avatar"><Avatar src={group.avatar} name={group.name} size={40} ring={group.seen ? 'seen' : 'story'} /></span>
      <span class="story-card-name">{group.authorId === uid.value ? t('stories.yours') : group.name}</span>
    </button>
  );
}

/** Facebook-style row of story cards with a "create story" card first. */
export function StoryTray() {
  const [groups, setGroups] = useState(null);
  const [open, setOpen] = useState(null);
  const scroller = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => listenStoryTray(setGroups), [uid.value]);

  // Deep link: /?story=ID opens the viewer on that story.
  const deep = queryParams.value.get('story');
  useEffect(() => {
    if (!deep || !groups) return;
    const gi = groups.findIndex((g) => g.stories.some((s) => s.id === deep));
    if (gi >= 0) setOpen({ group: gi, story: groups[gi].stories.findIndex((s) => s.id === deep) });
  }, [deep, groups]);

  const updateEdges = () => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 8, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 8 });
  };
  useEffect(updateEdges, [groups]);
  const scrollBy = (dir) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' });

  const p = profile.value;
  return (
    <section class="stories" aria-label={t('stories.title')}>
      <div class="stories-scroll" ref={scroller} onScroll={updateEdges}>
        {(signedIn.value || !groups?.length) && (
          <button type="button" class="story-card story-create" onClick={() => { if (requireLogin('story')) storyCreator.value = true; }}>
            <span class="story-create-top">{p?.avatar ? <Img src={p.avatar} width={120} alt="" /> : <span class="story-create-ph"><Icon name="user" size={40} /></span>}</span>
            <span class="story-create-plus"><Icon name="plus" size={22} /></span>
            <span class="story-create-label">{t('stories.create')}</span>
          </button>
        )}
        {groups === null && [0, 1, 2, 3].map((i) => <Skeleton key={i} w={112} h={196} r={14} class="story-skel" />)}
        {groups?.map((g, i) => <StoryCard key={g.authorId} group={g} onOpen={() => setOpen({ group: i, story: g.authorId === uid.value || g.seen ? 0 : Math.max(0, g.stories.findIndex((s) => !s.viewedBy.includes(uid.value))) })} />)}
      </div>
      {edges.left && <IconButton icon="caret-left" label={t('common.back')} class="stories-nav is-left" variant="soft" size={40} onClick={() => scrollBy(-1)} />}
      {edges.right && <IconButton icon="caret-right" label={t('common.next')} class="stories-nav is-right" variant="soft" size={40} onClick={() => scrollBy(1)} />}
      {open && groups && (
        <StoryViewer
          groups={groups}
          start={open}
          onClose={() => { setOpen(null); if (deep) setQuery({ story: null }); }}
        />
      )}
    </section>
  );
}
