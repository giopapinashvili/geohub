import { actor } from '../../lib/actor.js';
import { me } from '../../lib/auth.js';
import { Avatar } from '../../ui/Avatar.jsx';

/** A deliberately personal feature must say who will perform the action. */
export function PersonalActionNotice({ children }) {
  const user = me();
  if (!actor.value || !user) return null;
  return <div class="row gap-8 small" role="note" style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '12px', marginBlock: '8px', background: 'var(--surface-2)' }}>
    <Avatar src={user.avatar} name={user.name} size={32} />
    <span><strong>პირადი პროფილით — {user.name}.</strong> {children}</span>
  </div>;
}
