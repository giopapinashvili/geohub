import { ICONS } from './icons.js';

/**
 * Inline Phosphor icon. `name` is a Phosphor name ("heart"); add "-fill"
 * for the filled weight. Decorative by default; pass `label` to expose it
 * to assistive technology.
 */
export function Icon({ name, size = 20, label, class: cls = '', style }) {
  const body = ICONS[name];
  if (!body && import.meta.env.DEV) console.warn('[Icon] unknown', name);
  return (
    <svg
      class={`icon ${cls}`}
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="currentColor"
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
      // Static SVG path data generated at build time from the icon package.
      dangerouslySetInnerHTML={{ __html: (label ? `<title>${label.replace(/[<&>]/g, '')}</title>` : '') + (body || '') }}
    />
  );
}
