import { Avatar } from '../../ui/Avatar.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Img } from '../../ui/misc.jsx';
import { t, formatCount } from '../../lib/i18n.js';
import { timeAgo } from '../../lib/format.js';
import { isVideoUrl } from '../../data/normalize.js';
import { safeBackground } from './backgrounds.js';

/** Compact, image-first post tile for the home grid; opens the post page. */
export function PostTile({ post }) {
  const media = post.media[0];
  const video = media && isVideoUrl(media, post.mediaType);
  const bg = !media && safeBackground(post.bgGradient);
  const text = post.poll?.question || post.text;
  return (
    <a href={`/post/${post.id}`} class={`post-tile${media ? ' has-media' : ''}${post.type === 'need' ? ' is-need' : ''}`}>
      {post.type === 'need' && <span class="post-tile-need"><Icon name="megaphone" size={14} />{t('needs.badge')}</span>}
      {media && (
        <span class="post-tile-media">
          {video ? <span class="post-tile-video"><Icon name="play-fill" size={28} /></span> : <Img src={media} width={520} alt="" />}
          {post.media.length > 1 && <span class="post-tile-count"><Icon name="images" size={14} />{post.media.length}</span>}
        </span>
      )}
      {!media && text && <span class={`post-tile-text${bg ? ' is-bg' : ''}`} style={bg ? { background: bg } : undefined}>{post.poll && <Icon name="chart-bar" size={18} />}{text.slice(0, 220)}</span>}
      {media && text && <span class="post-tile-caption">{text.slice(0, 120)}</span>}
      {post.placeName && <span class="post-tile-place"><Icon name="map-pin-fill" size={13} />{post.placeName}</span>}
      <span class="post-tile-foot">
        <Avatar src={post.authorAvatar} name={post.authorName} size={26} square={post.authorType === 'business'} />
        <span class="post-tile-author">{post.authorName}</span>
        <span class="post-tile-stats"><Icon name="heart" size={14} />{formatCount(post.likeCount)}{post.commentCount > 0 && <><Icon name="chat-circle" size={14} />{formatCount(post.commentCount)}</>}</span>
      </span>
      <span class="post-tile-time">{timeAgo(post.createdAt)}</span>
    </a>
  );
}
