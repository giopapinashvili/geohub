import { useEffect, useRef } from 'preact/hooks';
import { Icon } from './Icon.jsx';

let idSeq = 0;
const useId = (id) => { const r = useRef(id || `f${++idSeq}`); return r.current; };

export function Field({ label, hint, error, id, children, optional, counter }) {
  return (
    <div class={`field${error ? ' has-error' : ''}`}>
      {label && (
        <label class="field-label" for={id}>
          {label}{optional && <span class="field-optional"> · {optional}</span>}
        </label>
      )}
      {children}
      {(error || hint || counter) && (
        <div class="field-foot">
          {error ? <p class="field-error" id={`${id}-err`} role="alert">{error}</p> : hint ? <p class="field-hint" id={`${id}-hint`}>{hint}</p> : <span />}
          {counter && <span class="field-counter">{counter}</span>}
        </div>
      )}
    </div>
  );
}

export function TextField({ label, hint, error, id, icon, optional, value, onInput, maxLength, showCount, class: cls = '', ...rest }) {
  const fid = useId(id);
  return (
    <Field label={label} hint={hint} error={error} id={fid} optional={optional} counter={showCount && maxLength ? `${(value || '').length}/${maxLength}` : null}>
      <div class={`input-wrap${icon ? ' has-icon' : ''}`}>
        {icon && <Icon name={icon} size={18} class="input-icon" />}
        <input
          id={fid}
          class={`input ${cls}`}
          value={value}
          onInput={onInput}
          maxLength={maxLength}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
          {...rest}
        />
      </div>
    </Field>
  );
}

/** Textarea that grows with its content up to `maxRows`. */
export function TextArea({ label, hint, error, id, optional, value, onInput, maxLength, showCount, minRows = 3, maxRows = 12, class: cls = '', ...rest }) {
  const fid = useId(id);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 22;
    const max = lh * maxRows + 24;
    el.style.height = Math.min(el.scrollHeight + 2, max) + 'px';
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [value]);
  return (
    <Field label={label} hint={hint} error={error} id={fid} optional={optional} counter={showCount && maxLength ? `${(value || '').length}/${maxLength}` : null}>
      <textarea
        ref={ref}
        id={fid}
        rows={minRows}
        class={`input textarea ${cls}`}
        value={value}
        onInput={onInput}
        maxLength={maxLength}
        aria-invalid={error ? 'true' : undefined}
        {...rest}
      />
    </Field>
  );
}

export function Select({ label, hint, error, id, optional, options, value, onChange, placeholder, ...rest }) {
  const fid = useId(id);
  return (
    <Field label={label} hint={hint} error={error} id={fid} optional={optional}>
      <div class="select-wrap">
        <select id={fid} class="input select" value={value} onChange={onChange} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Icon name="caret-down" size={16} class="select-caret" />
      </div>
    </Field>
  );
}

export function Switch({ checked, onChange, label, description, id, disabled }) {
  const fid = useId(id);
  return (
    <label class={`switch-row${disabled ? ' is-disabled' : ''}`} for={fid}>
      <span class="switch-text">
        <span class="switch-label">{label}</span>
        {description && <span class="switch-desc">{description}</span>}
      </span>
      <input id={fid} type="checkbox" role="switch" class="switch-input" checked={checked} disabled={disabled} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span class="switch" aria-hidden="true" />
    </label>
  );
}

export function Checkbox({ checked, onChange, label, id }) {
  const fid = useId(id);
  return (
    <label class="check-row" for={fid}>
      <input id={fid} type="checkbox" class="check-input" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span class="check-box" aria-hidden="true"><Icon name="check" size={14} /></span>
      <span>{label}</span>
    </label>
  );
}

/** Segmented control for 2–4 mutually exclusive options. */
export function Segmented({ options, value, onChange, label, size = 'md' }) {
  return (
    <div class={`segmented segmented-${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value ? 'true' : 'false'}
          class={`segmented-opt${value === o.value ? ' is-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={16} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onInput, placeholder, onSubmit, autoFocus, label, class: cls = '', ...rest }) {
  return (
    <form class={`search-input ${cls}`} role="search" onSubmit={(e) => { e.preventDefault(); onSubmit?.(value); }}>
      <Icon name="magnifying-glass" size={18} class="search-input-icon" />
      <input
        type="search"
        class="search-input-field"
        value={value}
        onInput={onInput}
        placeholder={placeholder}
        aria-label={label || placeholder}
        autoFocus={autoFocus}
        enterKeyHint="search"
        {...rest}
      />
    </form>
  );
}
