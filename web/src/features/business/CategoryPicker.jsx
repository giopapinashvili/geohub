import { Field } from '../../ui/Field.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { lang } from '../../lib/i18n.js';
import { BIZ_GROUPS, BIZ_CATEGORIES, bizCategory, bizGroupLabel } from './categories.js';

/** Grouped native select of business categories (keeps unknown stored values). */
export function CategoryPicker({ label, value, onChange, error }) {
  const l = lang.value;
  const known = bizCategory(value);
  return (
    <Field label={label} error={error} id="biz-category">
      <div class="select-wrap">
        <select id="biz-category" class="input select" value={known ? known.id : value} onChange={(e) => onChange(e.currentTarget.value)}>
          {!value && <option value="">—</option>}
          {value && !known && <option value={value}>{value}</option>}
          {BIZ_GROUPS.map((g) => (
            <optgroup key={g} label={bizGroupLabel(g)}>
              {BIZ_CATEGORIES.filter((c) => c.group === g).map((c) => <option key={c.id} value={c.id}>{c.emoji} {c[l] || c.ka}</option>)}
            </optgroup>
          ))}
        </select>
        <Icon name="caret-down" size={16} class="select-caret" />
      </div>
    </Field>
  );
}
