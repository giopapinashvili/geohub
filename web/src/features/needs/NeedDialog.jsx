import { useState } from 'preact/hooks';
import { Modal } from '../../ui/Modal.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { TextArea, TextField, Select } from '../../ui/Field.jsx';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { cityOptions } from '../../lib/geo.js';
import { profile } from '../../lib/auth.js';
import { createNeed, NEED_CATS, WHEN } from '../../data/needs.js';

/** Post what you need; matching businesses are told and answer with offers. */
export function NeedDialog({ onClose, onCreated, initialCategory = '' }) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [city, setCity] = useState(profile.value?.city || 'თბილისი');
  const [budget, setBudget] = useState('');
  const [when, setWhen] = useState('week');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { const id = await createNeed({ text, category, city, budget, when }); toast.success(t('needs.posted')); onCreated?.(id); onClose(); }
    catch { toast.error(t('common.error')); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('needs.dialogTitle')} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" icon="megaphone" loading={busy} disabled={text.trim().length < 8 || !category} onClick={submit}>{t('needs.post')}</Button></>}>
      <div class="stack">
        <TextArea label={t('needs.what')} value={text} onInput={(e) => setText(e.currentTarget.value)} maxLength={600} minRows={3} placeholder={t('needs.whatPh')} autoFocus />
        <div class="field">
          <span class="field-label">{t('place.category')}</span>
          <div class="need-cats">
            {NEED_CATS.map((c) => (
              <button key={c.id} type="button" class={`need-cat${category === c.id ? ' is-active' : ''}`} style={{ '--tone': c.tone }} onClick={() => setCategory(c.id)}>
                <Icon name={c.icon} size={20} /><span>{t(`needs.cat.${c.id}`)}</span>
              </button>
            ))}
          </div>
        </div>
        <div class="form-2">
          <Select label={t('place.city')} value={city} onChange={(e) => setCity(e.currentTarget.value)} options={cityOptions()} />
          <Select label={t('needs.when')} value={when} onChange={(e) => setWhen(e.currentTarget.value)} options={WHEN.map((w) => ({ value: w, label: t(`needs.when.${w}`) }))} />
        </div>
        <TextField label={t('needs.budget')} optional={t('common.optional')} type="number" min="0" value={budget} onInput={(e) => setBudget(e.currentTarget.value)} placeholder="₾" />
        <p class="muted small row gap-6"><Icon name="lightning-fill" size={16} class="tone-brand" />{t('needs.hint')}</p>
      </div>
    </Modal>
  );
}
