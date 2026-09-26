import { render } from 'preact';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/shell.css';
import './styles/content.css';
import './styles/pages.css';
import { resolveLegacy } from './legacy.js';

// Old bookmarks and shared links ("/profile.html?id=…") land here because
// Cloudflare serves index.html for any path without a file.
const legacy = resolveLegacy(location.pathname + location.search + location.hash);
if (legacy) history.replaceState(history.state, '', legacy);

import('./lib/theme.js');

const { App } = await import('./app.jsx');
render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.MODE !== 'emulator') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => console.warn('[sw]', e));
  });
}
