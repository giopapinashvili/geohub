const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
export const validYouTubeId = value => typeof value === 'string' && YOUTUBE_ID.test(value);

/** Parse supported public YouTube URLs; a lookalike domain is never a provider. */
export function parseYouTubeUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) return null;
  try {
    const text = value.trim();
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    let id = '';
    let isShort = false;
    if (['youtu.be', 'www.youtu.be'].includes(url.hostname)) id = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1] || '';
    else if (YOUTUBE_HOSTS.has(url.hostname)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else {
        const match = url.pathname.match(/^\/(shorts|embed|live|v)\/([A-Za-z0-9_-]{11})\/?$/);
        id = match?.[2] || ''; isShort = match?.[1] === 'shorts';
      }
    }
    return validYouTubeId(id) ? { id, isShort, url: `https://www.youtube.com/watch?v=${id}` } : null;
  } catch { return null; }
}
export const youtubeIdFrom = value => parseYouTubeUrl(value)?.id || '';

export function videoText(value, max, label, required = false) {
  if (typeof value !== 'string') throw new Error(`${label}: არასწორი მნიშვნელობა.`);
  const text = value.trim();
  if ((required && !text) || text.length > max) throw new Error(`${label}: შეავსე მაქსიმუმ ${max} სიმბოლოთი.`);
  return text;
}
export function publicMediaUrl(value, label, required = false) {
  const text = videoText(value, 2048, label, required);
  if (!text) return '';
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) throw new Error();
    return url.href;
  } catch { throw new Error(`${label}: საჭიროა სწორი HTTPS ბმული.`); }
}
export function normalizeVideoSource({ youtubeUrl = '', videoUrl = '', isShort = false } = {}) {
  const youtube = parseYouTubeUrl(youtubeUrl);
  if (youtubeUrl && !youtube) throw new Error('მიუთითე YouTube-ის ვიდეოს სწორი ბმული.');
  if (youtube && videoUrl) throw new Error('აირჩიე YouTube-ის ბმული ან ვიდეოფაილი.');
  if (!youtube && !videoUrl) throw new Error('დაამატე YouTube-ის ბმული ან ვიდეოფაილი.');
  return { youtubeId: youtube?.id || null, youtubeUrl: youtube?.url || null,
    videoUrl: youtube ? null : publicMediaUrl(videoUrl, 'ვიდეო', true), isShort: !!isShort || !!youtube?.isShort };
}
