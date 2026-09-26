import { useEffect, useState } from 'preact/hooks';
import { Avatar } from '../../ui/Avatar.jsx';
import { IconButton } from '../../ui/Button.jsx';
import { Spinner } from '../../ui/misc.jsx';
import { t, tn } from '../../lib/i18n.js';
import { timeAgo } from '../../lib/format.js';
import { uid, isAdmin } from '../../lib/auth.js';
import { toast } from '../../lib/toast.js';
import { listenVideoComments, addVideoComment, deleteVideoComment } from '../../data/videos.js';
import { CommentInput } from '../post/Comments.jsx';
import { RichText } from '../post/PostText.jsx';

/** Comment list and input for a video or reel. */
export function VideoComments({ video, heading = true }) {
  const [list, setList] = useState(null);
  useEffect(() => listenVideoComments(video.id, setList), [video.id]);
  return (
    <section class="watch-comments">
      {heading && <h2 class="card-title">{tn('video.comments', list?.length ?? video.commentCount)}</h2>}
      <CommentInput onSubmit={(text) => addVideoComment(video.id, text)} />
      {!list && <div class="center-pad"><Spinner /></div>}
      {list && !list.length && !heading && <p class="muted small center">{t('video.noComments')}</p>}
      {list?.map((c) => (
        <div key={c.id} class="cmt">
          <Avatar src={c.authorAvatar} name={c.authorName} size={34} href={`/u/${c.authorId}`} />
          <div class="cmt-main">
            <div class="cmt-row">
              <div class="cmt-bubble"><a href={`/u/${c.authorId}`} class="cmt-name">{c.authorName}</a><div class="cmt-text"><RichText text={c.text} /></div></div>
              {(c.authorId === uid.value || video.authorId === uid.value || isAdmin.value) && (
                <IconButton icon="trash" label={t('common.delete')} size={30} class="cmt-more" onClick={() => deleteVideoComment(video.id, c.id).catch(() => toast.error(t('common.error')))} />
              )}
            </div>
            <div class="cmt-meta"><span class="muted">{timeAgo(c.createdAt)}</span></div>
          </div>
        </div>
      ))}
    </section>
  );
}
