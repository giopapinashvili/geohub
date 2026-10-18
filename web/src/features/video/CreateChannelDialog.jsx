import { useRef, useState, useEffect } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { TextField, TextArea } from '../../ui/Field.jsx';
import { uid } from '../../lib/auth.js';
import { t } from '../../lib/i18n.js';
import { navigate } from '../../lib/router.js';
import { toast } from '../../lib/toast.js';
import { createChannel } from '../../data/videos.js';

/** A creator can establish a channel before linking their first video. */
export function CreateChannelDialog({ onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const owner = useRef(uid.value);
  const active = useRef(true);
  useEffect(() => () => { active.current = false; }, []);
  const close = () => { if (!busy) onClose(); };
  const save = async () => {
    if (busy || !name.trim() || uid.value !== owner.current) return;
    setBusy(true);
    try {
      const id = await createChannel({ name: name.trim(), description: description.trim() });
      if (!active.current || uid.value !== owner.current) return;
      toast.success(t('video.channelCreated')); onClose(); navigate(`/video/channel/${id}`);
    } catch { if (active.current) toast.error(t('common.error')); }
    finally { if (active.current) setBusy(false); }
  };
  return <Modal open onClose={close} title={t('video.createChannel')} size="md"
    footer={<><Button onClick={close} disabled={busy}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} disabled={!name.trim()} loading={busy}>{t('video.createChannel')}</Button></>}>
    <div class="stack">
      <p class="muted small">{t('video.channelIntro')}</p>
      <TextField label={t('video.channelName')} value={name} onInput={e => setName(e.currentTarget.value)} maxLength={60} autoFocus />
      <TextArea label={t('common.description')} value={description} onInput={e => setDescription(e.currentTarget.value)} maxLength={1000} minRows={3} optional={t('common.optional')} />
    </div>
  </Modal>;
}
