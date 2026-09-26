import { Suspense } from 'preact/compat';
import { Component } from 'preact';
import { useEffect } from 'preact/hooks';
import { ROUTES, NOT_FOUND } from './routes.js';
import { loc, match, navigate } from './lib/router.js';
import { authReady, signedIn } from './lib/auth.js';
import { Shell } from './shell/Shell.jsx';
import { PageSpinner, Empty, Toaster } from './ui/misc.jsx';
import { Button } from './ui/Button.jsx';
import { t } from './lib/i18n.js';

function resolve(pathname) {
  for (const r of ROUTES) {
    const params = match(r.path, pathname);
    if (params) return { route: r, params };
  }
  return { route: NOT_FOUND, params: {} };
}

class PageBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error('[page]', error); }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (this.state.error) {
      return (
        <Empty
          icon="warning"
          title={t('error.pageTitle')}
          text={t('error.pageText')}
          action={<Button variant="primary" icon="arrow-clockwise" onClick={() => location.reload()}>{t('common.reload')}</Button>}
        />
      );
    }
    return this.props.children;
  }
}

function Guard({ route, children }) {
  const needAuth = route.auth;
  useEffect(() => {
    if (needAuth && authReady.value && !signedIn.value) {
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    }
  }, [needAuth, authReady.value, signedIn.value]);
  if (needAuth && (!authReady.value || !signedIn.value)) return <PageSpinner />;
  return children;
}

export function App() {
  const { path } = loc.value;
  const { route, params } = resolve(path);
  const Page = route.component;
  useEffect(() => { sessionStorage.removeItem('gh_chunk_reload'); }, [path]);
  return (
    <>
      <Shell layout={route.layout} nav={route.nav} immersive={route.immersive}>
        <PageBoundary resetKey={path}>
          <Suspense fallback={<PageSpinner />}>
            <Guard route={route}>
              <Page key={route.path} params={params} {...(route.props || {})} />
            </Guard>
          </Suspense>
        </PageBoundary>
      </Shell>
      <Toaster />
    </>
  );
}
