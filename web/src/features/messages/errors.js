import { t } from '../../lib/i18n.js';

export function messageError(e) {
  const map = {
    blocking: 'messages.err.blocking',
    blocked: 'messages.err.blocked',
    'messages-disabled': 'messages.err.disabled',
    'friends-only': 'messages.err.friendsOnly',
    'own-business': 'messages.err.ownBusiness',
    auth: 'auth.required',
  };
  return t(map[e?.code] || 'common.error');
}
