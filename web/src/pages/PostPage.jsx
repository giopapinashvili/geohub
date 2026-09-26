import { Card, Empty, PageSpinner } from '../ui/misc.jsx';
import { Button } from '../ui/Button.jsx';
import { t } from '../lib/i18n.js';
import { useLive, useTitle } from '../lib/hooks.js';
import { query } from '../lib/router.js';
import { listenPost, canSee } from '../data/posts.js';
import { viewerCtx } from '../lib/store.js';
import { PostCard } from '../features/post/PostCard.jsx';

/** Single post with its comments open (notification and share target). */
export default function PostPage({ params }) {
  const { data: post, loading } = useLive((ok, err) => listenPost(params.id, ok, err), [params.id]);
  useTitle(post ? `${post.authorName}: ${post.text.slice(0, 40)}` : t('post.title'));
  if (loading) return <PageSpinner />;
  if (!post || !canSee(post, viewerCtx.value)) {
    return <Card><Empty icon="note-pencil" title={t('post.notFound')} text={t('post.notFoundText')} action={<Button variant="primary" href="/">{t('nav.home')}</Button>} /></Card>;
  }
  return <div class="feed"><PostCard post={post} openComments highlightComment={query.value.get('comment')} /></div>;
}
