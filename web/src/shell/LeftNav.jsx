import { useEffect, useState } from 'preact/hooks';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { SECTIONS, FOOTER_LINKS } from './nav.js';
import { Icon } from '../ui/Icon.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { t } from '../lib/i18n.js';
import { profile, signedIn, uid } from '../lib/auth.js';

function useMyShortcuts() {
  const [groups, setGroups] = useState([]);
  const id = uid.value;
  useEffect(() => {
    if (!id) { setGroups([]); return undefined; }
    return onSnapshot(query(collection(db, 'groupMembers'), where('uid', '==', id), limit(8)),
      (s) => setGroups(s.docs.map((d) => ({ id: d.data().groupId, name: d.data().groupName || '' })).filter((g) => g.id && g.name)),
      () => setGroups([]));
  }, [id]);
  return groups;
}

export function LeftNav({ active }) {
  const p = profile.value;
  const shortcuts = useMyShortcuts();
  const items = SECTIONS.filter((s) => !s.auth || signedIn.value);
  return (
    <aside class="leftnav" aria-label={t('nav.sections')}>
      <nav class="leftnav-inner">
        {signedIn.value && p && (
          <a href="/u/me" class={`side-item${active === 'profile' ? ' is-active' : ''}`}>
            <Avatar src={p.avatar} name={p.name} size={36} />
            <span class="side-label">{p.name}</span>
          </a>
        )}
        {items.map((s) => (
          <a key={s.key} href={s.href} class={`side-item${active === s.key ? ' is-active' : ''}`} aria-current={active === s.key ? 'page' : undefined}>
            <span class="side-icon" style={{ '--tone': s.tone }}><Icon name={s.icon} size={20} /></span>
            <span class="side-label">{t(s.label)}</span>
          </a>
        ))}
        {shortcuts.length > 0 && (
          <>
            <h3 class="side-heading">{t('nav.yourGroups')}</h3>
            {shortcuts.map((g) => (
              <a key={g.id} href={`/groups/${g.id}`} class="side-item">
                <Avatar name={g.name} size={36} square />
                <span class="side-label">{g.name}</span>
              </a>
            ))}
          </>
        )}
        <footer class="side-footer">
          {FOOTER_LINKS.map((l, i) => <span key={l.href}>{i > 0 && ' · '}<a href={l.href}>{t(l.label)}</a></span>)}
          <span> · GeoHub © {new Date().getFullYear()}</span>
        </footer>
      </nav>
    </aside>
  );
}
