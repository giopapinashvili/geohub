import { Checkbox } from '../../ui/Field.jsx';
import { t } from '../../lib/i18n.js';
import { dayLabel } from './hours.js';

/** Seven rows of open/close times with a "closed" toggle. */
export function HoursEditor({ rows, onChange }) {
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div class="hours-editor">
      {rows.map((r, i) => (
        <div key={i} class={`hours-row${r.closed ? ' is-closed' : ''}`}>
          <span class="hours-day">{dayLabel(i)}</span>
          <input type="time" class="input" value={r.open} disabled={r.closed} aria-label={`${dayLabel(i)} — ${t('biz.opens')}`} onInput={(e) => set(i, { open: e.currentTarget.value })} />
          <span class="muted">–</span>
          <input type="time" class="input" value={r.close} disabled={r.closed} aria-label={`${dayLabel(i)} — ${t('biz.closes')}`} onInput={(e) => set(i, { close: e.currentTarget.value })} />
          <Checkbox checked={r.closed} onChange={(v) => set(i, { closed: v })} label={t('biz.closedDay')} />
        </div>
      ))}
      <button type="button" class="link small" onClick={() => onChange(rows.map((r) => ({ ...r, open: rows[0].open, close: rows[0].close })))}>{t('biz.copyMonday')}</button>
    </div>
  );
}
