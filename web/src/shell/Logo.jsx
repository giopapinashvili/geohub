let gid = 0;

/** GeoHub mark: a pin carrying an eight-point star, on the brand gradient. */
export function LogoMark({ size = 36 }) {
  const id = `lg${++gid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" class="logo-mark">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#1d4ed8" />
          <stop offset="1" stop-color="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id})`} />
      <path fill="#fff" d="M24 8.5c-7.46 0-13.5 5.86-13.5 13.1 0 9.3 11.5 18.2 12.4 18.86a1.8 1.8 0 0 0 2.2 0c.9-.66 12.4-9.56 12.4-18.86C37.5 14.36 31.46 8.5 24 8.5Z" />
      <path fill={`url(#${id})`} d="M24 15.2l2.1 3.2 3.7-1-.9 3.8 2.8 2.7-3.8.6-.9 3.7-3-2.5-3 2.5-.9-3.7-3.8-.6 2.8-2.7-.9-3.8 3.7 1Z" />
    </svg>
  );
}

export function Logo({ size = 36, word = true, href = '/' }) {
  return (
    <a href={href} class="logo" aria-label="GeoHub">
      <LogoMark size={size} />
      {word && <span class="logo-word">Geo<span>Hub</span></span>}
    </a>
  );
}
