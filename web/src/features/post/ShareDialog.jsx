import { useEffect, useState } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Button } from '../../ui/Button.jsx';
import { SearchInput } from '../../ui/Field.jsx';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { createPost, trackShare } from '../../data/posts.js';
import { openComposer, friendIds } from '../../lib/store.js';
import { sendMessage, openDirect } from '../../data/messages.js';
import { getUsers, searchUsers } from '../../data/users.js';
import { useDebounced } from '../../lib/hooks.js';

export function postUrl(id) { return `${location.origin}/post/${id}`; }

export async function copyLink(url) {
  try { await navigator.clipboard.writeText(url); toast.success(t('common.linkCopied')); }
  catch { toast(url); }
}

function SendList({ url, onDone }) {
  const [q, setQ] = useState('');
  const [people, setPeople] = useState([]);
  const [sent, setSent] = useState({});
  const term = useDebounced(q, 250);
  useEffect(() => {
    let alive = true;
    if (term.trim().length >= 2) searchUsers(term, 12).then((r) => alive && setPeople(r));
    else getUsers([...friendIds.value].slice(0, 20)).then((r) => alive && setPeople(r));
    return () => { alive = false; };
  }, [term]);
  const send = async (u) => {
    setSent((s) => ({ ...s, [u.id]: 'busy' }));
    try {
      const cid = await openDirect(u.id);
      await sendMessage(cid, { text: url });
      setSent((s) => ({ ...s, [u.id]: 'done' }));
    } catch { setSent((s) => ({ ...s, [u.id]: undefined })); toast.error(t('common.error')); }
  };
  return (
    <div class="share-send">
      <SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('messages.findPeople')} />
      <div class="share-people">
        {people.map((u) => (
          <div key={u.id} class="share-person">
            <Avatar src={u.avatar} name={u.name} size={40} />
            <span class="share-person-name">{u.name}</span>
            <Button size="sm" variant={sent[u.id] === 'done' ? 'secondary' : 'primary'} loading={sent[u.id] === 'busy'} disabled={sent[u.id] === 'done'} onClick={() => send(u)}>
              {sent[u.id] === 'done' ? t('messages.sent') : t('common.send')}
            </Button>
          </div>
        ))}
        {!people.length && <p class="muted small">{t('messages.noContacts')}</p>}
      </div>
      <Button block variant="secondary" onClick={onDone}>{t('common.done')}</Button>
    </div>
  );
}

export function ShareDialog({ post, onClose }) {
  const [mode, setMode] = useState('menu');
  const [busy, setBusy] = useState(false);
  const url = postUrl(post.id);
  const shareNow = async () => {
    setBusy(true);
    try { await createPost({ sharedPostId: post.id, text: '' }); toast.success(t('share.done')); onClose(); }
    catch { toast.error(t('common.error')); }
    setBusy(false);
  };
  const native = async () => {
    try { await navigator.share({ title: post.authorName, text: post.text.slice(0, 120), url }); trackShare(post.id); onClose(); } catch { /* cancelled */ }
  };
  return (
    <Modal open onClose={onClose} title={mode === 'send' ? t('share.sendTitle') : t('share.title')} size="sm">
      {mode === 'menu' ? (
        <div class="share-menu">
          <button type="button" class="menu-item" disabled={busy} onClick={shareNow}>
            <span class="menu-icon"><Icon name="share-fat" size={20} /></span>
            <span class="menu-text"><span class="menu-label">{t('share.now')}</span><span class="menu-sub">{t('share.nowSub')}</span></span>
          </button>
          <button type="button" class="menu-item" onClick={() => { onClose(); openComposer({ sharedPost: post }); }}>
            <span class="menu-icon"><Icon name="note-pencil" size={20} /></span>
            <span class="menu-text"><span class="menu-label">{t('share.withText')}</span></span>
          </button>
          <button type="button" class="menu-item" onClick={() => setMode('send')}>
            <span class="menu-icon"><Icon name="paper-plane-tilt" size={20} /></span>
            <span class="menu-text"><span class="menu-label">{t('share.send')}</span></span>
          </button>
          <button type="button" class="menu-item" onClick={() => { copyLink(url); trackShare(post.id); onClose(); }}>
            <span class="menu-icon"><Icon name="link" size={20} /></span>
            <span class="menu-text"><span class="menu-label">{t('common.copyLink')}</span></span>
          </button>
          {typeof navigator.share === 'function' && (
            <button type="button" class="menu-item" onClick={native}>
              <span class="menu-icon"><Icon name="share-network" size={20} /></span>
              <span class="menu-text"><span class="menu-label">{t('share.more')}</span></span>
            </button>
          )}
        </div>
      ) : <SendList url={url} onDone={onClose} />}
    </Modal>
  );
}
