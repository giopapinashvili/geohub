import { forwardRef } from 'preact/compat';
import { Icon } from './Icon.jsx';
import { Spinner } from './misc.jsx';

/**
 * variant: primary | soft | secondary | ghost | outline | danger
 * size: sm | md | lg
 * Renders an <a> when `href` is given, so navigation stays a real link.
 */
export const Button = forwardRef(function Button({
  variant = 'secondary', size = 'md', icon, iconRight, loading, block, href, children,
  class: cls = '', type = 'button', disabled, ...rest
}, ref) {
  const className = `btn btn-${variant} btn-${size}${block ? ' btn-block' : ''}${!children ? ' btn-icon-only' : ''} ${cls}`;
  const inner = (
    <>
      {loading ? <Spinner size={size === 'sm' ? 14 : 18} /> : icon && <Icon name={icon} size={size === 'sm' ? 16 : 20} />}
      {children && <span class="btn-label">{children}</span>}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </>
  );
  if (href && !disabled) {
    return <a ref={ref} href={href} class={className} {...rest}>{inner}</a>;
  }
  return (
    <button ref={ref} type={type} class={className} disabled={disabled || loading} aria-busy={loading ? 'true' : undefined} {...rest}>
      {inner}
    </button>
  );
});

/** Round icon-only button. `label` is required for accessibility. */
export const IconButton = forwardRef(function IconButton({ icon, label, size = 40, iconSize, variant = 'ghost', badge, class: cls = '', href, active, style: extraStyle, ...rest }, ref) {
  const className = `icon-btn icon-btn-${variant}${active ? ' is-active' : ''} ${cls}`;
  const style = { width: size, height: size, ...(extraStyle || {}) };
  const inner = (
    <>
      <Icon name={icon} size={iconSize || Math.round(size * 0.52)} />
      {badge ? <span class="badge-dot" aria-hidden="true">{badge > 99 ? '99+' : badge}</span> : null}
    </>
  );
  const aria = badge ? `${label} (${badge})` : label;
  if (href) return <a ref={ref} href={href} class={className} style={style} aria-label={aria} title={label} {...rest}>{inner}</a>;
  return <button ref={ref} type="button" class={className} style={style} aria-label={aria} title={label} {...rest}>{inner}</button>;
});
