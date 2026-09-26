import { useState, useRef, useEffect } from 'preact/hooks';
import { Icon } from '../ui/Icon.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { t } from '../lib/i18n.js';
import { useDebounced, useClickOutside, useEscape } from '../lib/hooks.js';
import { quickSearch, recentSearches, rememberSearch, clearSearches } from '../data/search.js';
import { navigate } from '../lib/router.js';

/** Header search with typeahead results and recent searches. */
export function SearchBox() {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const wrap = useRef(null);
  const input = useRef(null);
  const term = useDebounced(value.trim(), 220);

  useClickOutside(wrap, () => setOpen(false), open);
  useEscape(() => { setOpen(false); input.current?.blur(); }, open);

  useEffect(() => {
    let alive = true;
    if (term.length < 2) { setResults(null); setLoading(false); return undefined; }
    setLoading(true);
    quickSearch(term).then((r) => { if (alive) { setResults(r); setLoading(false); } }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [term]);

  const items = [];
  if (results) {
    results.users.forEach((u) => items.push({ href: `/u/${u.id}`, title: u.name, sub: u.username ? `@${u.username}` : t('search.person'), avatar: u.avatar, name: u.name }));
    results.businesses.forEach((b) => items.push({ href: `/business/${b.id}`, title: b.name, sub: b.category || t('search.business'), avatar: b.logo, name: b.name, square: true }));
    results.places.forEach((p) => items.push({ href: `/place/${p.id}`, title: p.name, sub: p.city || t('search.place'), icon: 'map-pin-fill' }));
    results.groups.forEach((g) => items.push({ href: `/groups/${g.id}`, title: g.name, sub: t('search.group'), avatar: g.cover || g.avatar, name: g.name, square: true }));
  }
  const submitHref = value.trim() ? `/search?q=${encodeURIComponent(value.trim())}` : null;
  const recent = !value.trim() ? recentSearches() : [];

  const go = (href, remember = true) => {
    if (remember && value.trim()) rememberSearch(value.trim());
    setOpen(false);
    setValue('');
    input.current?.blur();
    navigate(href);
  };

  const onKey = (e) => {
    const total = items.length + (submitHref ? 1 : 0);
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(total - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(-1, c - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (cursor >= 0 && cursor < items.length) go(items[cursor].href);
      else if (submitHref) go(submitHref);
    }
  };

  return (
    <div ref={wrap} class={`searchbox${open ? ' is-open' : ''}`}>
      <div class="search-input">
        <Icon name="magnifying-glass" size={18} class="search-input-icon" />
        <input
          ref={input}
          type="search"
          class="search-input-field"
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          value={value}
          onInput={(e) => { setValue(e.currentTarget.value); setOpen(true); setCursor(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded={open ? 'true' : 'false'}
          aria-controls="searchbox-list"
          aria-autocomplete="list"
        />
      </div>
      {open && (
        <div class="searchbox-panel" id="searchbox-list" role="listbox">
          {!value.trim() && (
            recent.length ? (
              <>
                <div class="searchbox-head">
                  <span>{t('search.recent')}</span>
                  <button type="button" class="link" onClick={() => { clearSearches(); setOpen(false); }}>{t('search.clear')}</button>
                </div>
                {recent.map((r) => (
                  <a key={r} href={`/search?q=${encodeURIComponent(r)}`} class="searchbox-item" onClick={(e) => { e.preventDefault(); go(`/search?q=${encodeURIComponent(r)}`, false); }}>
                    <span class="searchbox-ico"><Icon name="clock" size={18} /></span>
                    <span class="searchbox-text"><span class="searchbox-title">{r}</span></span>
                  </a>
                ))}
              </>
            ) : <p class="searchbox-hint">{t('search.hint')}</p>
          )}
          {value.trim() && (
            <>
              {items.map((it, i) => (
                <a key={it.href} href={it.href} role="option" aria-selected={cursor === i ? 'true' : 'false'}
                  class={`searchbox-item${cursor === i ? ' is-active' : ''}`}
                  onClick={(e) => { e.preventDefault(); go(it.href); }}>
                  {it.icon
                    ? <span class="searchbox-ico is-place"><Icon name={it.icon} size={18} /></span>
                    : <Avatar src={it.avatar} name={it.name} size={36} square={it.square} />}
                  <span class="searchbox-text">
                    <span class="searchbox-title">{it.title}</span>
                    <span class="searchbox-sub">{it.sub}</span>
                  </span>
                </a>
              ))}
              {loading && !items.length && <p class="searchbox-hint">{t('common.loading')}</p>}
              {!loading && results && !items.length && <p class="searchbox-hint">{t('search.noQuick')}</p>}
              <a href={submitHref} role="option" aria-selected={cursor === items.length ? 'true' : 'false'}
                class={`searchbox-item searchbox-all${cursor === items.length ? ' is-active' : ''}`}
                onClick={(e) => { e.preventDefault(); go(submitHref); }}>
                <span class="searchbox-ico is-brand"><Icon name="magnifying-glass" size={18} /></span>
                <span class="searchbox-text"><span class="searchbox-title">{t('search.seeAll', { q: value.trim() })}</span></span>
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
