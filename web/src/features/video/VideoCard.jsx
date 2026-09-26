import { Img } from '../../ui/misc.jsx';
import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { tn } from '../../lib/i18n.js';
import { timeAgo } from '../../lib/format.js';

/** YouTube-style card: 16:9 thumbnail, title, channel and stats. */
export function VideoCard({ video, compact }) {
  const href = video.isShort ? `/reels/${video.id}` : `/watch/${video.id}`;
  const channelName = video.channelName || video.authorName || 'GeoHub';
  return (
    <article class={`video-card${compact ? ' is-compact' : ''}`}>
      <a href={href} class="video-thumb" aria-label={video.title}>
        <Img src={video.thumbnail} width={compact ? 240 : 480} alt="" />
        <span class="video-thumb-play" aria-hidden="true"><Icon name="play-fill" size={22} /></span>
      </a>
      <div class="video-meta">
        {!compact && (
          <a href={video.channelId ? `/video/channel/${video.channelId}` : `/u/${video.authorId}`} class="video-channel-avatar">
            <Avatar src={video.channelAvatar || video.authorAvatar} name={channelName} size={36} />
          </a>
        )}
        <div class="video-meta-text">
          <a href={href} class="video-title">{video.title}</a>
          <a href={video.channelId ? `/video/channel/${video.channelId}` : `/u/${video.authorId}`} class="video-sub">{channelName}</a>
          <span class="video-sub">{tn('video.views', video.viewCount)} · {timeAgo(video.createdAt)}</span>
        </div>
      </div>
    </article>
  );
}

/** Embedded player for a video document (YouTube or uploaded file). */
export function VideoPlayer({ video, autoplay, muted, loop, controls = true, onEnded, short }) {
  if (video.youtubeId) {
    const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
    if (autoplay) params.set('autoplay', '1');
    if (muted) params.set('mute', '1');
    if (loop) { params.set('loop', '1'); params.set('playlist', video.youtubeId); }
    if (!controls) params.set('controls', '0');
    return (
      <iframe
        class={`video-frame${short ? ' is-short' : ''}`}
        src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?${params}`}
        title={video.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerpolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    );
  }
  return (
    <video class={`video-frame${short ? ' is-short' : ''}`} src={video.videoUrl} poster={video.thumbnail || undefined}
      controls={controls} autoPlay={autoplay} muted={muted} loop={loop} playsInline onEnded={onEnded} />
  );
}
