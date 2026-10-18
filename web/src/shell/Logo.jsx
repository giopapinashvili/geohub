/** The owner's supplied G/pin artwork, shared by every site header. */
export function LogoMark({ size = 36 }) {
  return (
    <img src="/icons/geohub-g-128.png" width={size} height={size} alt="" aria-hidden="true" class="logo-mark" decoding="async" />
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
