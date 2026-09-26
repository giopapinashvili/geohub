import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../../ui/Icon.jsx';
import { t, tn } from '../../lib/i18n.js';
import { tsToMillis } from '../../lib/format.js';
import { getMyVote, votePoll } from '../../data/posts.js';
import { uid } from '../../lib/auth.js';
import { requireLogin } from '../../lib/store.js';
import { toast } from '../../lib/toast.js';

export function Poll({ post }) {
  const [poll, setPoll] = useState(post.poll);
  const [mine, setMine] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPoll(post.poll); }, [post.poll]);
  useEffect(() => { if (uid.value) getMyVote(post.id).then(setMine); }, [post.id, uid.value]);
  if (!poll?.options?.length) return null;
  const total = Math.max(0, Number(poll.totalVotes) || poll.options.reduce((s, o) => s + (Number(o.votes) || 0), 0));
  const ended = !!tsToMillis(poll.endsAt) && tsToMillis(poll.endsAt) < Date.now();
  const showResults = !!mine || ended;
  const vote = async (id) => {
    if (!requireLogin('vote') || busy || ended) return;
    setBusy(true);
    const prev = mine;
    setMine(id);
    try { const next = await votePoll(post.id, id); if (next) setPoll(next); }
    catch { setMine(prev); toast.error(t('common.error')); }
    setBusy(false);
  };
  return (
    <div class="poll" role="group" aria-label={poll.question}>
      {poll.question !== post.text && <p class="poll-q">{poll.question}</p>}
      {poll.options.map((o) => {
        const pct = total ? Math.round(((Number(o.votes) || 0) / total) * 100) : 0;
        const on = mine === o.id;
        return (
          <button key={o.id} type="button" class={`poll-opt${on ? ' is-mine' : ''}${showResults ? ' has-results' : ''}`} disabled={busy || ended} onClick={() => vote(o.id)} aria-pressed={on ? 'true' : 'false'}>
            {showResults && <span class="poll-bar" style={{ width: `${pct}%` }} aria-hidden="true" />}
            <span class="poll-label">{on && <Icon name="check-circle-fill" size={18} />}{o.text}</span>
            {showResults && <span class="poll-pct">{pct}%</span>}
          </button>
        );
      })}
      <p class="poll-meta">{tn('poll.votes', total)}{ended ? ` · ${t('poll.ended')}` : ''}</p>
    </div>
  );
}
