import { useEffect, useRef, useState } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Menu } from '../../ui/Menu.jsx';
import { SearchInput } from '../../ui/Field.jsx';
import { Spinner } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { profile } from '../../lib/auth.js';
import { composer, friendIds } from '../../lib/store.js';
import { toast } from '../../lib/toast.js';
import { upload } from '../../lib/media.js';
import { useDebounced } from '../../lib/hooks.js';
import { createPost } from '../../data/posts.js';
import { getUsers, searchUsers } from '../../data/users.js';
import { searchPlaces } from '../../data/search.js';
import { BACKGROUNDS } from './backgrounds.js';
import { AUDIENCE } from './PostCard.jsx';

const FEELINGS = ['😊 ბედნიერი', '🥰 შეყვარებული', '😂 მხიარული', '🤩 აღფრთოვანებული', '😌 მშვიდი', '🙏 მადლიერი', '💪 მოტივირებული', '🎉 ზეიმობს', '😎 მაგარი', '🤔 ფიქრობს', '😴 დაღლილი', '😢 მოწყენილი', '🏖️ მოგზაურობს', '🍷 ქეიფობს', '⚽ გულშემატკივრობს', '🎂 იუბილარი'];
const DRAFT_KEY = 'gh_draft';

function Picker({ title, onBack, children }) {
  return (
    <div class="composer-picker">
      <div class="composer-picker-head">
        <IconButton icon="arrow-left" label={t('common.back')} onClick={onBack} size={36} variant="soft" />
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function PeoplePicker({ selected, onChange, onBack }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const term = useDebounced(q, 250);
  useEffect(() => {
    let alive = true;
    (term.trim().length >= 2 ? searchUsers(term, 15) : getUsers([...friendIds.value].slice(0, 30))).then((r) => alive && setList(r));
    return () => { alive = false; };
  }, [term]);
  const has = (u) => selected.some((x) => x.id === u.id);
  return (
    <Picker title={t('composer.tag')} onBack={onBack}>
      <SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('messages.findPeople')} autoFocus />
      {selected.length > 0 && <div class="chip-row">{selected.map((u) => <button key={u.id} type="button" class="chip is-active" onClick={() => onChange(selected.filter((x) => x.id !== u.id))}>{u.name}<Icon name="x" size={14} /></button>)}</div>}
      <div class="picker-list">
        {list.map((u) => (
          <button key={u.id} type="button" class={`picker-row${has(u) ? ' is-active' : ''}`} onClick={() => onChange(has(u) ? selected.filter((x) => x.id !== u.id) : [...selected, u])}>
            <Avatar src={u.avatar} name={u.name} size={40} /><span>{u.name}</span>{has(u) && <Icon name="check-circle-fill" size={20} />}
          </button>
        ))}
      </div>
    </Picker>
  );
}

function PlacePicker({ onPick, onBack }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const term = useDebounced(q, 250);
  useEffect(() => {
    let alive = true;
    if (term.trim().length >= 2) searchPlaces(term, 12).then((r) => alive && setList(r));
    else setList([]);
    return () => { alive = false; };
  }, [term]);
  return (
    <Picker title={t('composer.location')} onBack={onBack}>
      <SearchInput value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('composer.searchPlace')} autoFocus />
      <div class="picker-list">
        {list.map((p) => (
          <button key={p.id} type="button" class="picker-row" onClick={() => onPick({ name: p.name, placeId: p.id, city: p.city })}>
            <span class="searchbox-ico is-place"><Icon name="map-pin-fill" size={18} /></span>
            <span class="picker-text"><strong>{p.name}</strong><span class="muted small">{p.city}</span></span>
          </button>
        ))}
        {q.trim().length >= 2 && (
          <button type="button" class="picker-row" onClick={() => onPick({ name: q.trim() })}>
            <span class="searchbox-ico"><Icon name="plus" size={18} /></span>
            <span class="picker-text"><strong>{t('composer.useLocation', { name: q.trim() })}</strong></span>
          </button>
        )}
      </div>
    </Picker>
  );
}

/** Post composer dialog. Opened through store.openComposer(options). */
export default function Composer() {
  const opts = composer.value || {};
  const p = profile.value;
  const [text, setText] = useState(() => { try { return opts.sharedPost ? '' : localStorage.getItem(DRAFT_KEY) || ''; } catch { return ''; } });
  const [media, setMedia] = useState([]); // [{ id, url?, preview, progress, type, error }]
  const [audience, setAudience] = useState('public');
  const [bg, setBg] = useState(null);
  const [showBg, setShowBg] = useState(false);
  const [feeling, setFeeling] = useState('');
  const [location, setLocation] = useState(null);
  const [tagged, setTagged] = useState([]);
  const [poll, setPoll] = useState(null);
  const [view, setView] = useState('main');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const close = () => { composer.value = null; };

  useEffect(() => { if (opts.pick === 'media') setTimeout(() => fileRef.current?.click(), 250); }, []);
  useEffect(() => { try { if (!opts.sharedPost) localStorage.setItem(DRAFT_KEY, text); } catch { /* ignore */ } }, [text]);

  const addFiles = (files) => {
    const list = Array.from(files || []).slice(0, 10 - media.length);
    for (const file of list) {
      const id = Math.random().toString(36).slice(2);
      const type = file.type.startsWith('video') ? 'video' : 'image';
      const preview = URL.createObjectURL(file);
      setMedia((m) => [...m, { id, preview, progress: 0, type }]);
      upload(file, { folder: 'posts', onProgress: (pct) => setMedia((m) => m.map((x) => (x.id === id ? { ...x, progress: pct } : x))) })
        .then((url) => setMedia((m) => m.map((x) => (x.id === id ? { ...x, url, progress: 100 } : x))))
        .catch((e) => {
          setMedia((m) => m.filter((x) => x.id !== id));
          toast.error(t(e.code === 'too-large' ? 'upload.tooLarge' : e.code === 'bad-type' ? 'upload.badType' : 'upload.failed'));
        });
    }
    setBg(null);
    setShowBg(false);
  };

  const uploading = media.some((m) => !m.url);
  const pollValid = !poll || (poll.question.trim() && poll.options.filter((o) => o.trim()).length >= 2);
  const canPost = !busy && !uploading && pollValid && (text.trim() || media.length || poll || opts.sharedPost);

  const publish = async () => {
    if (!canPost) return;
    setBusy(true);
    try {
      const created = await createPost({
        text,
        media: media.map((m) => m.url),
        mediaType: media.length === 1 && media[0].type === 'video' ? 'video' : media.length ? 'image' : '',
        visibility: opts.groupId ? 'public' : audience,
        feeling,
        location,
        bgGradient: bg,
        taggedUsers: tagged,
        poll: poll ? { question: poll.question.trim(), options: poll.options.map((o) => o.trim()).filter(Boolean), endsAt: new Date(Date.now() + poll.days * 86400000) } : null,
        groupId: opts.groupId || null,
        groupPrivacy: opts.groupPrivacy,
        status: opts.groupId && opts.needsApproval ? 'pending' : 'active',
        asBusiness: opts.asBusiness || null,
        onBusinessId: opts.onBusinessId || null,
        sharedPostId: opts.sharedPost?.id || null,
        closeFriendIds: audience === 'close_friends' ? [...friendIds.value] : undefined,
      });
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      toast.success(t(opts.needsApproval ? 'composer.pendingApproval' : 'composer.published'));
      opts.onCreated?.(created);
      window.dispatchEvent(new CustomEvent('gh:post-created', { detail: created }));
      close();
    } catch (e) {
      toast.error(t(e.code === 'permission-denied' ? 'error.permission' : 'composer.failed'));
    }
    setBusy(false);
  };

  const authorName = opts.asBusiness?.name || p?.name || '';
  const authorAvatar = opts.asBusiness ? opts.asBusiness.logo : p?.avatar;
  const aud = AUDIENCE[audience];
  const bgPreset = BACKGROUNDS.find((b) => b.css === bg);
  const bigText = !media.length && !poll && text.length < 120;

  return (
    <Modal open onClose={close} title={view === 'main' ? t(opts.sharedPost ? 'share.withText' : 'composer.title') : undefined} size="md" class="composer-modal"
      footer={view === 'main' ? <Button variant="primary" block size="lg" onClick={publish} disabled={!canPost} loading={busy}>{uploading ? t('common.uploading') : t('common.publish')}</Button> : null}>
      {view === 'tag' && <PeoplePicker selected={tagged} onChange={setTagged} onBack={() => setView('main')} />}
      {view === 'place' && <PlacePicker onBack={() => setView('main')} onPick={(l) => { setLocation(l); setView('main'); }} />}
      {view === 'feeling' && (
        <Picker title={t('composer.feeling')} onBack={() => setView('main')}>
          <div class="feeling-grid">
            {FEELINGS.map((f) => <button key={f} type="button" class={`feeling-opt${feeling === f ? ' is-active' : ''}`} onClick={() => { setFeeling(feeling === f ? '' : f); setView('main'); }}>{f}</button>)}
          </div>
        </Picker>
      )}
      {view === 'main' && (
        <div class="composer">
          <div class="composer-author">
            <Avatar src={authorAvatar} name={authorName} size={44} square={!!opts.asBusiness} />
            <div class="composer-author-text">
              <strong>{authorName}
                {feeling && <span class="composer-extra"> — {t('post.feeling', { feeling })}</span>}
                {location && <span class="composer-extra"> — {t('post.at')} {location.name}</span>}
                {tagged.length > 0 && <span class="composer-extra"> — {t('composer.with', { names: tagged.map((u) => u.name).join(', ') })}</span>}
              </strong>
              {!opts.groupId && !opts.asBusiness && (
                <Menu label={t('audience.title')} align="start" width={280} items={['public', 'friends', 'close_friends', 'onlyme'].map((k) => ({
                  icon: AUDIENCE[k].icon, label: t(AUDIENCE[k].label), sub: t(`audience.${k}Sub`), onClick: () => setAudience(k),
                }))} trigger={(tp) => (
                  <button type="button" {...tp} class="audience-btn"><Icon name={aud.icon} size={14} />{t(aud.label)}<Icon name="caret-down" size={12} /></button>
                )} />
              )}
            </div>
          </div>

          <div class={`composer-text${bg ? ' has-bg' : ''}${bgPreset?.dark ? ' is-dark' : ''}`} style={bg ? { background: bg } : undefined}>
            <textarea
              class={`composer-input${bigText || bg ? ' is-big' : ''}`}
              value={text}
              onInput={(e) => setText(e.currentTarget.value)}
              placeholder={opts.groupId ? t('composer.placeholderGroup') : t('composer.placeholder', { name: (p?.name || '').split(' ')[0] })}
              aria-label={t('composer.title')}
              maxLength={5000}
              autoFocus
              rows={bg ? 3 : 4}
            />
          </div>

          {!media.length && !poll && (
            <div class="bg-row">
              <button type="button" class={`bg-toggle${showBg ? ' is-open' : ''}`} onClick={() => setShowBg((s) => !s)} aria-label={t('composer.background')} title={t('composer.background')}>Aa</button>
              {showBg && (
                <div class="bg-swatches">
                  <button type="button" class={`bg-swatch is-none${!bg ? ' is-active' : ''}`} onClick={() => setBg(null)} aria-label={t('composer.noBackground')} />
                  {BACKGROUNDS.map((b) => <button key={b.key} type="button" class={`bg-swatch${bg === b.css ? ' is-active' : ''}`} style={{ background: b.css }} onClick={() => setBg(b.css)} aria-label={b.key} />)}
                </div>
              )}
            </div>
          )}

          {media.length > 0 && (
            <div class={`composer-media count-${Math.min(media.length, 4)}`}>
              {media.map((m) => (
                <div key={m.id} class="composer-thumb">
                  {m.type === 'video' ? <video src={m.preview} muted playsInline /> : <img src={m.preview} alt="" />}
                  {!m.url && <div class="composer-progress"><Spinner size={22} /><span>{m.progress}%</span></div>}
                  <IconButton icon="x" label={t('common.remove')} size={30} variant="onmedia" class="composer-thumb-x" onClick={() => setMedia((all) => all.filter((x) => x.id !== m.id))} />
                </div>
              ))}
              {media.length < 10 && (
                <button type="button" class="composer-add-more" onClick={() => fileRef.current?.click()}><Icon name="plus" size={24} /><span>{t('composer.addMore')}</span></button>
              )}
            </div>
          )}

          {poll && (
            <div class="composer-poll">
              <div class="composer-poll-head"><strong>{t('composer.poll')}</strong><IconButton icon="x" label={t('common.remove')} size={30} onClick={() => setPoll(null)} /></div>
              <input class="input" placeholder={t('composer.pollQuestion')} value={poll.question} maxLength={200} onInput={(e) => setPoll({ ...poll, question: e.currentTarget.value })} />
              {poll.options.map((o, i) => (
                <input key={i} class="input" placeholder={t('composer.pollOption', { n: i + 1 })} value={o} maxLength={80}
                  onInput={(e) => { const opts2 = [...poll.options]; opts2[i] = e.currentTarget.value; setPoll({ ...poll, options: opts2 }); }} />
              ))}
              <div class="composer-poll-foot">
                {poll.options.length < 4 && <button type="button" class="link" onClick={() => setPoll({ ...poll, options: [...poll.options, ''] })}>+ {t('composer.pollAdd')}</button>}
                <select class="input select poll-days" value={poll.days} onChange={(e) => setPoll({ ...poll, days: Number(e.currentTarget.value) })} aria-label={t('composer.pollDuration')}>
                  {[1, 3, 7].map((d) => <option key={d} value={d}>{t('composer.days', { n: d })}</option>)}
                </select>
              </div>
            </div>
          )}

          {opts.sharedPost && (
            <div class="shared-post is-static">
              <div class="shared-post-body">
                <div class="post-author-line"><Avatar src={opts.sharedPost.authorAvatar} name={opts.sharedPost.authorName} size={28} /><strong>{opts.sharedPost.authorName}</strong></div>
                <p class="shared-post-text">{opts.sharedPost.text.slice(0, 200)}</p>
              </div>
            </div>
          )}

          <div class="composer-tools">
            <span class="composer-tools-label">{t('composer.addToPost')}</span>
            <div class="composer-tools-btns">
              <IconButton icon="images" label={t('composer.photo')} class="tool-green" onClick={() => fileRef.current?.click()} disabled={!!poll || !!opts.sharedPost} />
              <IconButton icon="user-plus" label={t('composer.tag')} class="tool-blue" onClick={() => setView('tag')} />
              <IconButton icon="smiley" label={t('composer.feeling')} class="tool-amber" onClick={() => setView('feeling')} />
              <IconButton icon="map-pin" label={t('composer.location')} class="tool-red" onClick={() => setView('place')} />
              <IconButton icon="chart-bar" label={t('composer.poll')} class="tool-teal" onClick={() => { setPoll(poll || { question: '', options: ['', ''], days: 3 }); setMedia([]); setBg(null); }} disabled={!!media.length || !!opts.sharedPost} />
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { addFiles(e.currentTarget.files); e.currentTarget.value = ''; }} />
        </div>
      )}
    </Modal>
  );
}
