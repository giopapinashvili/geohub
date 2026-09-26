import { useEffect, useState } from 'preact/hooks';
import { Card, CardHeader, Img } from '../../ui/misc.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { t, formatCount } from '../../lib/i18n.js';
import { fetchReels } from '../../data/videos.js';

/** Horizontal strip of reels inside the home feed. */
export function ReelsStrip() {
  const [reels, setReels] = useState([]);
  useEffect(() => { fetchReels(12).then(setReels).catch(() => setReels([])); }, []);
  if (!reels.length) return null;
  return (
    <Card class="strip-card">
      <CardHeader title={<span class="row gap-8"><Icon name="film-strip-fill" size={22} class="tone-brand" />{t('nav.reels')}</span>} action={<a href="/reels" class="link">{t('common.seeAll')}</a>} />
      <div class="strip-scroll">
        {reels.map((r) => (
          <a key={r.id} href={`/reels/${r.id}`} class="reel-thumb">
            <Img src={r.thumbnail} width={160} alt="" />
            <span class="reel-thumb-shade" />
            <span class="reel-thumb-views"><Icon name="play" size={14} />{formatCount(r.viewCount)}</span>
            <span class="reel-thumb-title">{r.title}</span>
          </a>
        ))}
      </div>
    </Card>
  );
}
