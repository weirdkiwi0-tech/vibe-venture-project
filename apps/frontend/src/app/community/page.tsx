import { CommunityBoard } from '../../components/community-board';
import { SiteShell } from '../../components/site-shell';
import { getCommunityBoard } from '../../lib/api';

export default async function CommunityPage() {
  const board = await getCommunityBoard('guest-user');

  return (
    <SiteShell
      title="커뮤니티"
      description="자유 채팅, 문제 공유, 프로필 조회, 친구 요청과 1:1 채팅까지 한 화면에서 연결합니다."
    >
      <CommunityBoard initialBoard={board} />
    </SiteShell>
  );
}
