import { useEffect, useRef, useState } from 'preact/hooks';
import { uid } from '../../lib/auth.js';
import { requireLogin } from '../../lib/store.js';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';
import { isSaved, setSaved } from '../../data/posts.js';

/** Favorites are private user state, scoped to both account and selected place. */
export function usePlaceSaved(placeId, place) {
  const viewerId = uid.value;
  const context = `${viewerId || ''}\n${placeId}`;
  const current = useRef(context);
  current.current = context;
  const [value, setValue] = useState({ context, saved: false, loading: !!viewerId, busy: false });
  const state = value.context === context ? value : { context, saved: false, loading: !!viewerId, busy: false };
  useEffect(() => {
    let active = true;
    setValue({ context, saved: false, loading: !!viewerId, busy: false });
    if (viewerId) isSaved('place', placeId).then(saved => {
      if (active && current.current === context && uid.value === viewerId) setValue({ context, saved, loading: false, busy: false });
    }).catch(() => {
      if (active && current.current === context && uid.value === viewerId) setValue({ context, saved: false, loading: false, busy: false });
    });
    return () => { active = false; };
  }, [context, placeId, viewerId]);
  const toggleSave = async () => {
    if (state.loading || state.busy || !place || !requireLogin('save')) return;
    const stillCurrent = () => current.current === context && uid.value === viewerId;
    setValue({ ...state, busy: true });
    try {
      await setSaved('place', placeId, !state.saved, { title: place.name, image: place.image || '' });
      if (!stillCurrent()) return;
      setValue({ context, saved: !state.saved, loading: false, busy: false });
      toast(t(state.saved ? 'saved.removed' : 'saved.added'));
    } catch {
      if (!stillCurrent()) return;
      setValue({ ...state, busy: false });
      toast.error(t('common.error'));
    }
  };
  return { ...state, toggleSave };
}
