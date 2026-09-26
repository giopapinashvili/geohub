// Coloured backgrounds for short text posts and text stories. The old site
// stored the raw CSS gradient on the post (bgGradient); new posts do the
// same, so both render everywhere. Values are validated before use.

export const BACKGROUNDS = [
  { key: 'pomegranate', css: 'linear-gradient(135deg,#e3325f,#f07a3a)' },
  { key: 'sunset', css: 'linear-gradient(135deg,#f59e0b,#e3325f)' },
  { key: 'wine', css: 'linear-gradient(135deg,#6d1a36,#b3207a)' },
  { key: 'ocean', css: 'linear-gradient(135deg,#0e7490,#1f3a8a)' },
  { key: 'forest', css: 'linear-gradient(135deg,#15803d,#0f5132)' },
  { key: 'mountain', css: 'linear-gradient(160deg,#334155,#0f172a)' },
  { key: 'lavender', css: 'linear-gradient(135deg,#8b5cf6,#db2777)' },
  { key: 'sand', css: 'linear-gradient(135deg,#f5d0a9,#e39a5b)', dark: true },
];

const SAFE = /^linear-gradient\(\s*[\d.]+deg\s*,\s*#[0-9a-f]{3,8}(\s+\d+%)?\s*,\s*#[0-9a-f]{3,8}(\s+\d+%)?\s*\)$/i;

/** CSS background for a stored value (preset key or gradient), or null. */
export function safeBackground(value) {
  if (!value || typeof value !== 'string') return null;
  const preset = BACKGROUNDS.find((b) => b.key === value || b.css === value.replace(/\s+/g, ''));
  if (preset) return preset;
  if (value.includes('var(')) return BACKGROUNDS[0];
  const compact = value.replace(/\s*,\s*/g, ',').trim();
  return SAFE.test(compact) ? { key: 'custom', css: compact } : null;
}
