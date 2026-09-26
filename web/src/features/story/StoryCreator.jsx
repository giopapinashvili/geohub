import { useRef, useState } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Segmented } from '../../ui/Field.jsx';
import { Spinner } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { storyCreator, friendIds } from '../../lib/store.js';
import { toast } from '../../lib/toast.js';
import { upload } from '../../lib/media.js';
import { createStory } from '../../data/stories.js';
import { BACKGROUNDS } from '../post/backgrounds.js';

/** Create a photo, video or text story. */
export default function StoryCreator() {
  const [mode, setMode] = useState(null); // 'media' | 'text'
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [text, setText] = useState('');
  const [bg, setBg] = useState(BACKGROUNDS[0]);
  const [audience, setAudience] = useState('public');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const input = useRef(null);
  const close = () => { storyCreator.value = false; };

  const pick = (f) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMode('media');
  };

  const publish = async () => {
    setBusy(true);
    try {
      let mediaUrl = null;
      let mediaType = '';
      if (mode === 'media' && file) {
        mediaUrl = await upload(file, { folder: 'stories', onProgress: setProgress });
        mediaType = file.type.startsWith('video') ? 'video' : 'image';
      }
      await createStory({
        text: text.trim(),
        mediaUrl,
        mediaType,
        bg: mode === 'text' ? bg.key : null,
        closeFriends: audience === 'friends',
        closeFriendsList: audience === 'friends' ? [...friendIds.value] : [],
      });
      toast.success(t('stories.published'));
      close();
    } catch (e) {
      toast.error(t(e.code === 'too-large' ? 'upload.tooLarge' : 'stories.failed'));
    }
    setBusy(false);
  };

  const isVideo = file?.type.startsWith('video');
  return (
    <Modal open onClose={close} title={t('stories.create')} size="md"
      footer={mode ? (
        <>
          <Button variant="secondary" onClick={() => { setMode(null); setFile(null); setText(''); }}>{t('common.back')}</Button>
          <Button variant="primary" onClick={publish} loading={busy} disabled={mode === 'text' && !text.trim()}>{busy && mode === 'media' ? `${progress}%` : t('stories.share')}</Button>
        </>
      ) : null}>
      {!mode && (
        <div class="story-new-choices">
          <button type="button" class="story-new-choice is-media" onClick={() => input.current?.click()}>
            <span><Icon name="images" size={32} /></span><strong>{t('stories.photoVideo')}</strong>
          </button>
          <button type="button" class="story-new-choice is-text" onClick={() => setMode('text')}>
            <span>Aa</span><strong>{t('stories.textStory')}</strong>
          </button>
        </div>
      )}
      {mode && (
        <div class="story-new">
          <div class="story-new-preview" style={mode === 'text' ? { background: bg.css } : undefined}>
            {mode === 'media' && (isVideo ? <video src={preview} autoPlay muted loop playsInline /> : <img src={preview} alt="" />)}
            {mode === 'text'
              ? <textarea class="story-new-text" value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder={t('stories.typeSomething')} maxLength={220} autoFocus aria-label={t('stories.textStory')} />
              : text && <p class="story-caption">{text}</p>}
            {busy && <div class="composer-progress"><Spinner size={24} /></div>}
          </div>
          <div class="story-new-side">
            {mode === 'media' && (
              <input class="input" value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder={t('stories.caption')} maxLength={220} aria-label={t('stories.caption')} />
            )}
            {mode === 'text' && (
              <div class="bg-swatches">
                {BACKGROUNDS.map((b) => <button key={b.key} type="button" class={`bg-swatch${bg.key === b.key ? ' is-active' : ''}`} style={{ background: b.css }} onClick={() => setBg(b)} aria-label={b.key} />)}
              </div>
            )}
            <div class="field">
              <span class="field-label">{t('stories.whoSees')}</span>
              <Segmented value={audience} onChange={setAudience} label={t('stories.whoSees')} options={[
                { value: 'public', label: t('audience.public'), icon: 'globe-hemisphere-east' },
                { value: 'friends', label: t('audience.friends'), icon: 'users' },
              ]} />
            </div>
            <p class="muted small"><Icon name="clock" size={14} /> {t('stories.expires')}</p>
            {mode === 'media' && <IconButton icon="arrows-clockwise" label={t('stories.change')} variant="soft" onClick={() => input.current?.click()} />}
          </div>
        </div>
      )}
      <input ref={input} type="file" accept="image/*,video/*" hidden onChange={(e) => { pick(e.currentTarget.files[0]); e.currentTarget.value = ''; }} />
    </Modal>
  );
}
