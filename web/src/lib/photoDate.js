/** Capture dates only: never substitute an upload/download timestamp. */
export function photoDateLabel(value) {
  if (typeof value !== 'string') return 'გადაღების თარიღი უცნობია';
  if (/^\d{4}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00Z`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value) return value.split('-').reverse().join('.');
  return 'გადაღების თარიღი უცნობია';
}
