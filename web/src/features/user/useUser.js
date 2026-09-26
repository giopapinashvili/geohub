import { useEffect, useState } from 'preact/hooks';
import { getUser } from '../../data/users.js';

/** Cached profile lookup for rendering names and avatars. */
export function useUser(id) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!id) { setUser(null); return undefined; }
    getUser(id).then((u) => alive && setUser(u));
    return () => { alive = false; };
  }, [id]);
  return user;
}
