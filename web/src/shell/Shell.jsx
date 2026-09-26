import { lazy, Suspense } from 'preact/compat';
import { bp } from '../lib/hooks.js';
import { Header } from './Header.jsx';
import { TopBar, BottomNav } from './MobileBars.jsx';
import { LeftNav } from './LeftNav.jsx';
import { composer, storyCreator, createMenu, loginPrompt, chatPopups } from '../lib/store.js';
import { CreateMenu } from './CreateMenu.jsx';
import { LoginPrompt } from './LoginPrompt.jsx';

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
  const showRight = false;
  return (
    <div class={`shell shell-${layout}${desktop ? ' is-desktop' : ' is-mobile'}${immersive ? ' is-immersive' : ''}`}>
      {desktop ? <Header active={nav} /> : <TopBar active={nav} hidden={immersive} />}
      <div class={`shell-body layout-${layout}${showRight ? ' has-right' : ''}${showLeft ? ' has-left' : ''}`}>
        {showLeft && <LeftNav active={nav} />}
        <main id="main" class="shell-main" tabIndex={-1}>{children}</main>
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
    </>
  );
}
