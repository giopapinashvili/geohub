import { useEffect, useState } from 'preact/hooks';
import { getBusiness } from '../../data/business.js';

export function useBusiness(id) {
  const [biz, setBiz] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!id) { setBiz(null); return undefined; }
    getBusiness(id).then((b) => alive && setBiz(b));
    return () => { alive = false; };
  }, [id]);
  return biz;
}
