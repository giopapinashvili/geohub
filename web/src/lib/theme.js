import { signal, effect } from '@preact/signals';

const KEY = 'gh_theme';
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

function read() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch { return 'system'; }
}

/** 'system' | 'light' | 'dark' — what the user chose. */
export const themePref = signal(read());
/** 'light' | 'dark' — what is on screen. */
export const theme = signal('light');

function apply() {
  const dark = themePref.value === 'dark' || (themePref.value === 'system' && media?.matches);
  theme.value = dark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme.value);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#000000' : '#ffffff');
}

effect(() => {
  try {
    if (themePref.value === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, themePref.value);
  } catch { /* private mode */ }
  apply();
});
media?.addEventListener?.('change', apply);

export function setTheme(pref) { themePref.value = pref; }
