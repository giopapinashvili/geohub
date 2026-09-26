import { useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { img as optimise } from '../lib/media.js';
import { toasts, dismissToast } from '../lib/toast.js';

export function Spinner({ size = 20, class: cls = '' }) {
  return <span class={`spinner ${cls}`} style={{ width: size, height: size }} role="status" aria-label="…" />;
}

export function PageSpinner() {
  return <div class="page-spinner"><Spinner size={32} /></div>;
}

export function Skeleton({ w = '100%', h = 14, r = 6, class: cls = '', style }) {
  return <span class={`skeleton ${cls}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

export function Empty({ icon = 'sparkle', title, text, action, compact }) {
  return (
    <div class={`empty${compact ? ' empty-compact' : ''}`}>
      <div class="empty-icon"><Icon name={icon} size={compact ? 28 : 36} /></div>
      {title && <h3 class="empty-title">{title}</h3>}
      {text && <p class="empty-text">{text}</p>}
      {action && <div class="empty-action">{action}</div>}
    </div>
  );
}

export function Card({ children, class: cls = '', pad = true, as: Tag = 'section', ...rest }) {
  return <Tag class={`card${pad ? ' card-pad' : ''} ${cls}`} {...rest}>{children}</Tag>;
}

export function CardHeader({ title, action, sub }) {
  return (
    <header class="card-head">
      <div class="card-head-text">
        <h2 class="card-title">{title}</h2>
        {sub && <p class="card-sub">{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function Badge({ children, tone = 'neutral', icon }) {
  return <span class={`tag tag-${tone}`}>{icon && <Icon name={icon} size={14} />}{children}</span>;
}

export function Chip({ active, children, icon, onClick, href }) {
  const cls = `chip${active ? ' is-active' : ''}`;
  if (href) return <a class={cls} href={href} aria-current={active ? 'page' : undefined}>{icon && <Icon name={icon} size={16} />}{children}</a>;
  return <button type="button" class={cls} aria-pressed={active ? 'true' : 'false'} onClick={onClick}>{icon && <Icon name={icon} size={16} />}{children}</button>;
}

export function Verified({ size = 16 }) {
  return <span class="verified" title="✓"><Icon name="seal-check-fill" size={size} label="✓" /></span>;
}

/**
 * Lazy image with a neutral placeholder and graceful failure. `width` is the
 * rendered CSS width, used to request a right-sized Cloudinary variant.
 */
export function Img({ src, alt = '', width = 600, class: cls = '', fallback, ratio, style, eager, ...rest }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const url = optimise(src, width);
  if (!url || failed) {
    return fallback !== undefined ? fallback : <span class={`img-fallback ${cls}`} style={{ aspectRatio: ratio, ...style }} aria-hidden="true"><Icon name="image" size={28} /></span>;
  }
  return (
    <img
      src={url}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      class={`img${loaded ? ' is-loaded' : ''} ${cls}`}
      style={{ aspectRatio: ratio, ...style }}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      referrerpolicy="no-referrer"
      {...rest}
    />
  );
}

export function Toaster() {
  const list = toasts.value;
  return (
    <div class="toaster" role="region" aria-live="polite" aria-label="notifications">
      {list.map((x) => (
        <div key={x.id} class={`toast toast-${x.type}`} role={x.type === 'error' ? 'alert' : 'status'}>
          <Icon name={x.type === 'error' ? 'warning' : x.type === 'success' ? 'check-circle-fill' : 'info'} size={20} />
          <span class="toast-msg">{x.message}</span>
          {x.action && <button type="button" class="toast-action" onClick={() => { x.action.onClick(); dismissToast(x.id); }}>{x.action.label}</button>}
          <button type="button" class="toast-close" aria-label="×" onClick={() => dismissToast(x.id)}><Icon name="x" size={16} /></button>
        </div>
      ))}
    </div>
  );
}

export function Stat({ value, label, href }) {
  const inner = <><strong class="stat-value">{value}</strong><span class="stat-label">{label}</span></>;
  return href ? <a class="stat" href={href}>{inner}</a> : <div class="stat">{inner}</div>;
}
