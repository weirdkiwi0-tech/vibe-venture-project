import Link from 'next/link';
import { SiteShell } from '../../../../components/site-shell';

export default function CommunityPostNotFoundPage() {
  return (
    <SiteShell title="게시글을 찾을 수 없어요" description="요청하신 게시글이 삭제되었거나 존재하지 않습니다.">
      <section className="surface-card" style={{ padding: '1.5rem' }}>
        <p style={{ marginTop: 0, marginBottom: '1rem' }}>입력하신 링크의 게시글이 없거나 더 이상 열람할 수 없습니다.</p>
        <Link href="/community" className="primary-button" style={{ display: 'inline-flex', textDecoration: 'none' }}>
          커뮤니티로 돌아가기
        </Link>
      </section>
    </SiteShell>
  );
}
