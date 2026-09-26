// Media helpers: Cloudinary unsigned uploads (Firebase Storage is not on
// this project's plan) and responsive image URLs.

import { CLOUDINARY } from './firebase.js';
import { auth } from './firebase.js';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Resize a Cloudinary URL on the fly; other URLs pass through untouched. */
export function img(url, width) {
  if (!url || typeof url !== 'string') return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  if (/\/upload\/[^/]*(w_|f_auto)/.test(url)) return url;
  const w = Math.round(Math.min(2000, width * (window.devicePixelRatio > 1 ? 2 : 1)));
  const kind = url.includes('/video/upload/') ? 'q_auto' : `f_auto,q_auto,c_limit,w_${w}`;
  return url.replace('/upload/', `/upload/${kind}/`);
}

/** Poster frame for a Cloudinary video URL. */
export function videoPoster(url) {
  if (!url || !url.includes('/video/upload/')) return '';
  return url.replace('/video/upload/', '/video/upload/so_0,f_jpg,q_auto,w_720/').replace(/\.(mp4|webm|mov|m4v)(\?.*)?$/i, '.jpg');
}

function folderFor(folder) {
  const safe = String(folder || 'uploads').replace(/[^a-zA-Z0-9_\-/]/g, '').replace(/^\/+|\/+$/g, '') || 'uploads';
  const uid = String(auth.currentUser?.uid || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '');
  return `${CLOUDINARY.rootFolder}/${safe}/${uid}`;
}

/** Downscale large photos before upload (keeps GIFs as they are). */
export async function compressImage(file, maxSide = 1600, quality = 0.84) {
  if (!file || !/^image\//i.test(file.type) || /gif/i.test(file.type) || !window.createImageBitmap) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale >= 1 && file.size <= 900 * 1024) { bmp.close?.(); return file; }
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * scale));
    c.height = Math.max(1, Math.round(bmp.height * scale));
    c.getContext('2d', { alpha: false }).drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const out = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
    return out || file;
  } catch { return file; }
}

export class UploadError extends Error {
  constructor(code) { super(code); this.code = code; }
}

/**
 * Upload an image, video, audio clip or document to Cloudinary.
 * Resolves to the secure URL. `onProgress` receives 0–100.
 */
export async function upload(file, { folder = 'uploads', onProgress, kind } = {}) {
  if (!file) throw new UploadError('no-file');
  const type = kind || (/^image\//.test(file.type) ? 'image' : /^(video|audio)\//.test(file.type) ? 'video' : 'raw');
  if (type === 'image') {
    if (!/^image\/(png|jpe?g|webp|gif|heic|heif)$/i.test(file.type)) throw new UploadError('bad-type');
    if (file.size > MAX_IMAGE_BYTES) throw new UploadError('too-large');
    file = await compressImage(file);
  } else if (type === 'video' && file.size > MAX_VIDEO_BYTES) {
    throw new UploadError('too-large');
  }
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', CLOUDINARY.uploadPreset);
  form.append('folder', folderFor(folder));
  form.append('tags', `geohub,${folder}`);
  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY.cloudName)}/${type}/upload`;

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.timeout = type === 'image' ? 45000 : 180000;
        if (onProgress) xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => {
          let body = {};
          try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
          if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) resolve(body.secure_url);
          else reject(new UploadError(body.error?.message || `http-${xhr.status}`));
        };
        xhr.onerror = () => reject(new UploadError('network'));
        xhr.ontimeout = () => reject(new UploadError('timeout'));
        xhr.send(form);
      });
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw lastErr;
}
