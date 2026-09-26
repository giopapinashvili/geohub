import { useState } from 'preact/hooks';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/misc.jsx';
import { Icon } from '../ui/Icon.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/hooks.js';
import { navigate, back } from '../lib/router.js';
import { toast } from '../lib/toast.js';
import { createBusiness } from '../data/business.js';
import { BizCard } from '../features/business/BizCard.jsx';
import { BasicsFields, ContactFields, LookFields, emptyBusiness, toPayload, validBasics } from '../features/business/BusinessForm.jsx';
import { normBiz } from '../data/normalize.js';

const STEPS = ['basics', 'contact', 'look'];

/** Three-step page creation with a live preview card. */
export default function BusinessNew() {
  useTitle(t('biz.create'));
  const [f, setF] = useState(emptyBusiness);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const payload = toPayload(f);
  const preview = normBiz('preview', { ...payload, title: f.title || t('biz.name'), logoUrl: f.logoUrl, coverUrl: f.coverUrl, isOnline: f.businessType === 'online' });

  const create = async () => {
    setBusy(true);
    try {
      const id = await createBusiness(payload);
      toast.success(t('biz.created'));
      navigate(`/business/${id}`, { replace: true });
    } catch (e) {
      console.warn(e);
      toast.error(t('common.error'));
      setBusy(false);
    }
  };
  const canNext = step !== 0 || validBasics(f);

  return (
    <div class="page-pad biz-new">
      <div class="page-head">
        <div>
          <h1 class="page-title">{t('biz.create')}</h1>
          <p class="page-sub">{t('biz.createSub')}</p>
        </div>
      </div>
      <ol class="steps" aria-label={t('biz.steps')}>
        {STEPS.map((s, i) => (
          <li key={s} class={`step${i === step ? ' is-current' : ''}${i < step ? ' is-done' : ''}`}>
            <span class="step-num">{i < step ? <Icon name="check" size={14} /> : i + 1}</span>{t(`biz.step.${s}`)}
          </li>
        ))}
      </ol>
      <div class="biz-new-grid">
        <Card>
          {step === 0 && <BasicsFields f={f} set={set} />}
          {step === 1 && <ContactFields f={f} set={set} />}
          {step === 2 && <LookFields f={f} set={set} />}
          <div class="form-actions">
            <Button variant="secondary" onClick={() => (step ? setStep(step - 1) : back('/business'))}>{step ? t('common.back') : t('common.cancel')}</Button>
            {step < STEPS.length - 1
              ? <Button variant="primary" iconRight="arrow-right" disabled={!canNext} onClick={() => setStep(step + 1)}>{t('common.next')}</Button>
              : <Button variant="primary" icon="check" loading={busy} disabled={!validBasics(f)} onClick={create}>{t('biz.createBtn')}</Button>}
          </div>
        </Card>
        <aside class="biz-preview">
          <span class="muted small bold">{t('biz.preview')}</span>
          <BizCard biz={preview} />
        </aside>
      </div>
    </div>
  );
}
