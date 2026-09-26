import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { LogoMark } from './Logo.jsx';
import { t } from '../lib/i18n.js';
import { loginPrompt } from '../lib/store.js';

export function LoginPrompt() {
  const close = () => { loginPrompt.value = null; };
  const next = encodeURIComponent(location.pathname + location.search);
  return (
    <Modal open onClose={close} size="sm" title="">
      <div class="login-prompt">
        <LogoMark size={56} />
        <h2>{t('auth.promptTitle')}</h2>
        <p class="muted">{t('auth.promptText')}</p>
        <Button variant="primary" size="lg" block href={`/login?next=${next}`} onClick={close}>{t('auth.signIn')}</Button>
        <Button variant="secondary" size="lg" block href={`/signup?next=${next}`} onClick={close}>{t('auth.createAccount')}</Button>
      </div>
    </Modal>
  );
}
