import { lazy, Suspense } from 'preact/compat';
import { bp } from '../lib/hooks.js';
import { Header } from './Header.jsx';
import { TopBar, BottomNav } from './MobileBars.jsx';
import { LeftNav } from './LeftNav.jsx';
import { RightRail } from './RightRail.jsx';
import { composer, storyCreator, createMenu, loginPrompt, chatPopups } from '../lib/store.js';
import { CreateMenu } from './CreateMenu.jsx';
import { LoginPrompt } from './LoginPrompt.jsx';
import { CallLayer } from '../features/calls/CallLayer.jsx';
import { actor, setActor } from '../lib/actor.js';
import { Avatar } from '../ui/Avatar.jsx';
import { t } from '../lib/i18n.js';
import { navigate } from '../lib/router.js';

const Composer = lazy(() => import('../features/post/Composer.jsx'));
const StoryCreator = lazy(() => import('../features/story/StoryCreator.jsx'));
const ChatDock = lazy(() => import('./ChatDock.jsx'));

/**
 * Persistent frame around every page. Desktop (≥1024px): header plus side
 * columns depending on the route layout. Phones and tablets: top bar and
 * bottom tab bar.
 */
export function Shell({ layout = 'page', nav, immersive, children }) {
  const desktop = bp.value === 'lg' || bp.value === 'xl';
  if (layout === 'bare') {
    return (
      <>
        <main id="main" class="bare-main">{children}</main>
        <Dialogs />
      </>
    );
  }
  const showLeft = desktop && (layout === 'feed' || layout === 'page');
  const showRight = desktop && layout === 'feed' && bp.value === 'xl';
  return (
    <div class={`shell shell-${layout}${desktop ? ' is-desktop' : ' is-mobile'}${immersive ? ' is-immersive' : ''}${actor.value ? ' has-actor' : ''}`}>
      {desktop ? <Header active={nav} /> : <TopBar active={nav} hidden={immersive} />}
      {actor.value && (
        <div class="actor-bar">
          <Avatar src={actor.value.logo} name={actor.value.name} size={22} square />
          <span class="ellipsis">{t('switch.actingAs', { name: actor.value.name })}</span>
          <button type="button" class="actor-bar-back" onClick={() => { setActor(null); navigate('/'); }}>{t('switch.back')}</button>
        </div>
      )}
      <div class={`shell-body layout-${layout}${showRight ? ' has-right' : ''}${showLeft ? ' has-left' : ''}`}>
        {showLeft && <LeftNav active={nav} />}
        <main id="main" class="shell-main" tabIndex={-1}>{children}</main>
        {showRight && <RightRail />}
      </div>
      {!desktop && <BottomNav active={nav} immersive={immersive} />}
      {desktop && chatPopups.value.length > 0 && <Suspense fallback={null}><ChatDock /></Suspense>}
      <Dialogs />
    </div>
  );
}

function Dialogs() {
  return (
    <>
      {composer.value && <Suspense fallback={null}><Composer /></Suspense>}
      {storyCreator.value && <Suspense fallback={null}><StoryCreator /></Suspense>}
      {createMenu.value && <CreateMenu />}
      {loginPrompt.value && <LoginPrompt />}
      <CallLayer />
    </>
  );
}
