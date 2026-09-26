import { useState } from 'preact/hooks';
import { Icon } from '../../ui/Icon.jsx';
import { Button } from '../../ui/Button.jsx';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { pushSupported, pushState, enablePush } from '../../data/push.js';

/** Invitation to turn on push notifications (hidden once decided). */
export function PushPrompt() {
  const [state, setState] = useState(pushState());
  const [busy, setBusy] = useState(false);
  if (!pushSupported() || state !== 'default') return null;
  return (
    <div class="push-prompt">
      <span class="push-prompt-icon"><Icon name="bell" size={22} /></span>
      <span class="push-prompt-text"><strong>{t('notif.enablePush')}</strong><span class="muted small">{t('notif.enablePushText')}</span></span>
      <Button size="sm" variant="primary" loading={busy} onClick={async () => {
        setBusy(true);
        const ok = await enablePush();
        setBusy(false);
        setState(pushState());
        if (ok) toast.success(t('notif.pushOn'));
      }}>{t('notif.enable')}</Button>
    </div>
  );
}
