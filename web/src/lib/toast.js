import { signal } from '@preact/signals';

/** Visible toasts, newest last. Rendered by ui/Toaster.jsx. */
export const toasts = signal([]);
let seq = 0;

export function toast(message, { type = 'info', duration = 3500, action } = {}) {
  const id = ++seq;
  toasts.value = [...toasts.value.slice(-2), { id, message, type, action }];
  if (duration) setTimeout(() => dismissToast(id), duration);
  return id;
}
toast.success = (m, o) => toast(m, { ...o, type: 'success' });
toast.error = (m, o) => toast(m, { ...o, type: 'error', duration: 5000 });

export function dismissToast(id) {
  toasts.value = toasts.value.filter((x) => x.id !== id);
}
