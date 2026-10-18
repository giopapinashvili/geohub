// Search is shared by the map and global typeahead. The large city index stays
// in a worker, so typing never synchronously scans thousands of addresses.
let worker;
let nextId = 0;
const pending = new Map();
function reset(error) {
  worker?.terminate(); worker = null;
  for (const job of pending.values()) { clearTimeout(job.timer); job.reject(error); }
  pending.clear();
}
export function searchImported(query, options = {}) {
  if (String(query).trim().length < 2 && !options.allowEmpty) return Promise.resolve([]);
  if (!worker) {
    try { worker = new Worker(new URL('./discoverySearch.worker.js', import.meta.url), { type: 'module' }); }
    catch { return Promise.reject(new Error('Search unavailable')); }
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id);
      if (!job) return;
      clearTimeout(job.timer); pending.delete(data.id);
      if (data.error) job.reject(new Error('Search data unavailable')); else job.resolve(data.result);
    };
    worker.onerror = () => reset(new Error('Search unavailable'));
  }
  // Superseded searches settle immediately; no promises are left hanging.
  const channel = options.channel || 'global';
  for (const [key, job] of pending) {
    if (job.channel !== channel) continue;
    clearTimeout(job.timer); job.resolve([]); pending.delete(key);
  }
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Search timed out')); }, 30000);
    pending.set(id, { resolve, reject, timer, channel });
    worker.postMessage({ ...options, channel, id, query: String(query).slice(0, 200) });
  });
}
