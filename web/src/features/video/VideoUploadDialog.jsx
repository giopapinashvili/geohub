import { useEffect, useRef, useState } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { TextField, TextArea, Segmented, Switch, Select } from '../../ui/Field.jsx';
import { Img } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { upload } from '../../lib/media.js';
import { navigate } from '../../lib/router.js';
import { youtubeIdFrom } from '../../data/normalize.js';
import { createVideo, myChannels, createChannel } from '../../data/videos.js';
import { me, uid } from '../../lib/auth.js';

/** Publish a video or reel: a YouTube link or an uploaded file. */
export function VideoUploadDialog({ onClose, short = false, initialChannel = null }) {
  const [mode, setMode] = useState('youtube');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [isShort, setIsShort] = useState(short);
  const [channels, setChannels] = useState([]);
  const [channelId, setChannelId] = useState(initialChannel?.id || '');
  const [newChannel, setNewChannel] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [channelLoading, setChannelLoading] = useState(true);
  const [channelError, setChannelError] = useState(false);
  const owner = useRef(uid.value);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    myChannels().then(c => {
      if (!active.current || uid.value !== owner.current) return;
      const rows = initialChannel?.ownerId === owner.current && !c.some(row => row.id === initialChannel.id) ? [initialChannel, ...c] : c;
      setChannels(rows);
      setChannelId(rows.some(row => row.id === initialChannel?.id) ? initialChannel.id : rows[0]?.id || '');
    }).catch(() => { if (active.current) setChannelError(true); })
      .finally(() => { if (active.current) setChannelLoading(false); });
    return () => { active.current = false; };
  }, []);
  const yt = youtubeIdFrom(url);
  useEffect(() => { if (/\/shorts\//.test(url)) setIsShort(true); }, [url]);

  const valid = title.trim() && !channelLoading && !channelError && (channelId !== '__new__' || newChannel.trim()) && (mode === 'youtube' ? yt : file);
  const close = () => { if (!busy) onClose(); };
  const publishingName = channelId === '__new__' ? newChannel.trim() : channels.find(c => c.id === channelId)?.name || me()?.name;
  const publish = async () => {
    if (!valid || busy || uid.value !== owner.current) return;
    setBusy(true);
    try {
      let channel = channels.find((c) => c.id === channelId) || null;
      if (channelId === '__new__' && newChannel.trim()) {
        const id = await createChannel({ name: newChannel.trim() });
        channel = { id, name: newChannel.trim(), avatar: '' };
        if (!active.current || uid.value !== owner.current) return;
        setChannels(rows => [...rows, channel]); setChannelId(id);
      }
      let videoUrl = '';
      if (mode === 'file') videoUrl = await upload(file, { folder: 'videos', kind: 'video', onProgress: setProgress });
      if (!active.current || uid.value !== owner.current) return;
      const id = await createVideo({ title, description: desc.trim(), youtubeUrl: mode === 'youtube' ? url.trim() : '', videoUrl, isShort, channel });
      if (!active.current || uid.value !== owner.current) return;
      toast.success(t('video.published'));
      onClose();
      navigate(isShort ? `/reels/${id}` : `/watch/${id}`);
    } catch (e) {
      if (active.current) toast.error(t(e.code === 'too-large' ? 'upload.tooLarge' : 'video.failed'));
    } finally { if (active.current) setBusy(false); }
  };

  return (
    <Modal open onClose={close} title={t(short ? 'video.addReel' : 'video.add')} size="md"
      footer={<><Button variant="secondary" onClick={close} disabled={busy}>{t('common.cancel')}</Button><Button variant="primary" onClick={publish} disabled={!valid} loading={busy}>{busy && mode === 'file' ? `${progress}%` : t('common.publish')}</Button></>}>
      <div class="stack">
        <p class="muted small">{t('video.linkFirstHint')}</p>
        <Segmented value={mode} onChange={setMode} label={t('video.source')} options={[
          { value: 'youtube', label: t('video.fromYoutube'), icon: 'youtube-logo' },
          { value: 'file', label: t('video.fromFile'), icon: 'upload-simple' },
        ]} />
        {mode === 'youtube' ? (
          <>
            <TextField label={t('video.youtubeLink')} icon="link" value={url} onInput={(e) => setUrl(e.currentTarget.value)} placeholder="https://www.youtube.com/watch?v=…" error={url && !yt ? t('video.badLink') : ''} />
            <p class="muted small">{t('video.youtubeEmbedHint')}</p>
            {yt && <div class="video-preview"><Img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} width={480} alt="" /></div>}
          </>
        ) : (
          <label class="upload-drop">
            <input type="file" accept="video/*" hidden onChange={(e) => setFile(e.currentTarget.files[0] || null)} />
            <strong>{file ? file.name : t('video.chooseFile')}</strong>
            <span class="muted small">{t('video.fileHint')}</span>
          </label>
        )}
        <TextField label={t('video.title')} value={title} onInput={(e) => setTitle(e.currentTarget.value)} maxLength={120} showCount />
        <TextArea label={t('common.description')} optional={t('common.optional')} value={desc} onInput={(e) => setDesc(e.currentTarget.value)} maxLength={2000} minRows={2} />
        <Select label={t('video.channel')} value={channelId} disabled={channelLoading || busy} onChange={(e) => setChannelId(e.currentTarget.value)} options={[{ value: '', label: t('video.noChannel') }, ...channels.map((c) => ({ value: c.id, label: c.name })), { value: '__new__', label: t('video.createChannel') }]} />
        {channelId === '__new__' && <TextField label={t('video.newChannel')} value={newChannel} onInput={(e) => setNewChannel(e.currentTarget.value)} maxLength={60} hint={t('video.newChannelHint')} />}
        {channelError && <p class="field-error" role="alert">{t('video.channelsLoadFailed')}</p>}
        {!channelLoading && publishingName && <p class="video-publishing-identity">{t('video.publishingAs', { name: publishingName })}</p>}
        <Switch checked={isShort} onChange={setIsShort} label={t('video.isShort')} description={t('video.isShortHint')} />
      </div>
    </Modal>
  );
}
