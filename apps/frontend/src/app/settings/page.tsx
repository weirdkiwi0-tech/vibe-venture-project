import { SiteShell } from '../../components/site-shell';
import { SectionCard } from '../../components/section-card';
import { SettingsPanel } from '../../components/settings-panel';

export default function SettingsPage() {
  return (
    <SiteShell title="설정" description="알림, 피드 우선순위, 프로필 공개 범위를 관리합니다.">
      <SectionCard eyebrow="환경 설정" title="서비스 이용 환경을 내 방식으로 조정">
        <SettingsPanel />
      </SectionCard>
    </SiteShell>
  );
}
