import { useEffect, useState } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { Tabs } from '../../ui/Tabs.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Spinner, Empty } from '../../ui/misc.jsx';
import { t } from '../../lib/i18n.js';
import { listReactions, REACTION_EMOJI } from '../../data/posts.js';
import { getUsers } from '../../data/users.js';

export function ReactionsDialog({ postId, onClose }) {
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('all');
  useEffect(() => {
    listReactions(postId).then(async (list) => {
      const users = await getUsers(list.map((r) => r.userId));
      const byId = new Map(users.map((u) => [u.id, u]));
      setRows(list.map((r) => ({ ...r, user: byId.get(r.userId) })).filter((r) => r.user));
    }).catch(() => setRows([]));
  }, [postId]);
  const counts = {};
  (rows || []).forEach((r) => { counts[r.type] = (counts[r.type] || 0) + 1; });
  const tabs = [{ value: 'all', label: t('common.all'), count: rows?.length || 0 }, ...Object.keys(counts).map((k) => ({ value: k, label: REACTION_EMOJI[k] || '👍', count: counts[k] }))];
  const shown = (rows || []).filter((r) => tab === 'all' || r.type === tab);
  return (
    <Modal open onClose={onClose} title={t('react.title')} size="sm" noPad>
      <Tabs items={tabs} value={tab} onChange={setTab} label={t('react.title')} />
      <div class="rx-list">
        {rows === null && <div class="center-pad"><Spinner /></div>}
        {rows && !shown.length && <Empty compact icon="heart" title={t('react.none')} />}
        {shown.map((r) => (
          <a key={r.userId} href={`/u/${r.userId}`} class="rx-row" onClick={onClose}>
            <span class="rx-avatar"><Avatar src={r.user.avatar} name={r.user.name} size={44} /><span class="rx-badge">{REACTION_EMOJI[r.type] || '👍'}</span></span>
            <span class="rx-name">{r.user.name}</span>
          </a>
        ))}
      </div>
    </Modal>
  );
}
