import { SiteShell } from '../../components/site-shell';
import { SectionCard } from '../../components/section-card';
import { ProfilePanel } from '../../components/profile-panel';

export default function ProfilePage() {
  return (
    <SiteShell title="내 프로필" description="내 계정 정보와 주요 활동 이동 경로를 확인합니다.">
      <SectionCard eyebrow="프로필" title="내 계정 상태">
        <ProfilePanel />
      </SectionCard>
    </SiteShell>
  );
}
