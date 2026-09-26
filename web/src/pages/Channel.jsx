import { useState } from 'preact/hooks';
import { Avatar } from '../ui/Avatar.jsx';
import { Button } from '../ui/Button.jsx';
import { Tabs } from '../ui/Tabs.jsx';
import { Modal } from '../ui/Modal.jsx';
import { TextField, TextArea } from '../ui/Field.jsx';
import { Card, Empty, Img, PageSpinner, Spinner } from '../ui/misc.jsx';
import { t, tn } from '../lib/i18n.js';
import { useTitle, useAsync } from '../lib/hooks.js';
import { formatDate } from '../lib/format.js';
import { query, setQuery } from '../lib/router.js';
import { uid } from '../lib/auth.js';
import { toast } from '../lib/toast.js';
import { upload } from '../lib/media.js';
import { getChannel, channelVideos, updateChannel } from '../data/videos.js';
import { VideoCard } from '../features/video/VideoCard.jsx';
import { VideoUploadDialog } from '../features/video/VideoUploadDialog.jsx';
import { SubscribeButton } from './Watch.jsx';

function EditChannel({ channel, onClose, onSaved }) {
  const [name, setName] = useState(channel.name);
  const [desc, setDesc] = useState(channel.description);
  const [avatar, setAvatar] = useState(channel.avatar);
  const [banner, setBanner] = useState(channel.banner);
  const [busy, setBusy] = useState('');
  const pick = async (e, set, key) => {
    const file = e.currentTarget.files[0];
    if (!file) return;
    setBusy(key);
    try { set(await upload(file, { folder: 'channels' })); } catch (err) { toast.error(t(err.code === 'too-large' ? 'upload.tooLarge' : 'common.error')); }
    setBusy('');
  };
  const save = async () => {
    setBusy('save');
    try {
      await updateChannel(channel.id, { name, description: desc, avatar, banner });
      toast.success(t('video.channelSaved'));
      onSaved({ ...channel, name: name.trim(), description: desc.trim(), avatar, banner });
    } catch { toast.error(t('common.error')); }
    setBusy('');
  };
  return (
    <Modal open onClose={onClose} title={t('video.editChannel')} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} loading={busy === 'save'} disabled={!name.trim() || !!busy}>{t('common.save')}</Button></>}>
      <div class="stack">
        <div class="channel-edit-media">
          <label class="channel-edit-banner">
            {banner ? <Img src={banner} width={800} alt="" /> : <span class="channel-banner" />}
            <input type="file" accept="image/*" hidden onChange={(e) => pick(e, setBanner, 'banner')} />
            <span class="btn btn-secondary btn-sm">{busy === 'banner' ? <Spinner size={16} /> : t('profile.editCover')}</span>
          </label>
          <label class="channel-edit-avatar">
            <Avatar src={avatar} name={name} size={80} />
            <input type="file" accept="image/*" hidden onChange={(e) => pick(e, setAvatar, 'avatar')} />
            <span class="link small">{busy === 'avatar' ? t('common.uploading') : t('profile.changePhoto')}</span>
          </label>
        </div>
        <TextField label={t('video.channelName')} value={name} onInput={(e) => setName(e.currentTarget.value)} maxLength={60} />
        <TextArea label={t('common.description')} optional={t('common.optional')} value={desc} onInput={(e) => setDesc(e.currentTarget.value)} maxLength={1000} minRows={3} />
      </div>
    </Modal>
  );
}

/** Channel page: banner, subscribe, videos / reels / about. */
export default function Channel({ params }) {
  const ch = useAsync(() => getChannel(params.id), [params.id]);
  const vids = useAsync(() => channelVideos(params.id, 80), [params.id]);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const channel = ch.data;
  useTitle(channel?.name || t('video.channel'));
  const tab = query.value.get('tab') || 'videos';

  if (ch.loading && !channel) return <PageSpinner />;
  if (!channel) return <Card><Empty icon="television-simple" title={t('video.channelNotFound')} action={<Button variant="primary" href="/video?tab=channels">{t('video.channels')}</Button>} /></Card>;

  const own = channel.ownerId === uid.value;
  const all = vids.data || [];
  const list = all.filter((v) => (tab === 'reels' ? v.isShort : !v.isShort));

  return (
    <div class="channel-page">
      <Card class="channel-head" pad={false}>
        <div class="channel-banner">{channel.banner && <Img src={channel.banner} width={1200} alt="" eager />}</div>
        <div class="channel-info">
          <Avatar src={channel.avatar} name={channel.name} size={96} />
          <div class="channel-text">
            <h1 class="channel-name">{channel.name}</h1>
            <p class="muted small">{tn('video.subscribers', channel.subscriberCount)} · {tn('video.videoCount', all.length || channel.videoCount)}</p>
          </div>
          <div class="row gap-8 wrap">
            {own ? (
              <>
                <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>{t('video.add')}</Button>
                <Button variant="secondary" icon="pencil-simple" onClick={() => setEditing(true)}>{t('video.editChannel')}</Button>
              </>
            ) : <SubscribeButton channel={channel} onChange={(d) => ch.setData({ ...channel, subscriberCount: Math.max(0, channel.subscriberCount + d) })} />}
          </div>
        </div>
        <div class="channel-tabs">
          <Tabs value={tab} onChange={(v) => setQuery({ tab: v === 'videos' ? null : v })} label={channel.name} items={[
            { value: 'videos', label: t('video.videos') },
            { value: 'reels', label: t('video.reels') },
            { value: 'about', label: t('video.about') },
          ]} />
        </div>
      </Card>
      <div class="channel-body">
        {tab === 'about' ? (
          <Card>
            {channel.description ? <p class="channel-desc">{channel.description}</p> : <p class="muted">{t('video.noDescription')}</p>}
            {channel.createdAt > 0 && <p class="muted small" style={{ marginTop: 12 }}>{t('video.joined', { date: formatDate(channel.createdAt) })}</p>}
          </Card>
        ) : vids.loading ? <div class="center-pad"><Spinner /></div> : list.length ? (
          <div class="video-grid">{list.map((v) => <VideoCard key={v.id} video={v} />)}</div>
        ) : <Card><Empty icon="monitor-play" title={t('video.noVideosYet')} /></Card>}
      </div>
      {editing && <EditChannel channel={channel} onClose={() => setEditing(false)} onSaved={(c) => { ch.setData(c); setEditing(false); }} />}
      {adding && <VideoUploadDialog onClose={() => setAdding(false)} />}
    </div>
  );
}
