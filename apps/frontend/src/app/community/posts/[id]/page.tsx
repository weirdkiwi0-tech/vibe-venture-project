import { SiteShell } from '../../../../components/site-shell';
import { CommunityPostWindow } from '../../../../components/community-post-window';
import { getCommunityPost, getCommunityPostComments } from '../../../../lib/api';
import { notFound } from 'next/navigation';

interface CommunityPostPageParams {
  id: string;
}

export default async function CommunityPostPage({ params }: { params: Promise<CommunityPostPageParams> }) {
  const { id } = await params;
  let post;
  let comments;

  try {
    [post, comments] = await Promise.all([getCommunityPost(id, 'guest-user'), getCommunityPostComments(id, 'guest-user')]);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('post not found') || message.includes('not found')) {
      notFound();
    }
    throw error;
  }

  return (
    <SiteShell title="커뮤니티 게시글" description="게시글 상세 내용을 새 창에서 확인합니다.">
      <CommunityPostWindow initialPost={post} initialComments={comments} />
    </SiteShell>
  );
}
