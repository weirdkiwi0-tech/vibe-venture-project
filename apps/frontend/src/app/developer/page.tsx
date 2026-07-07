import Link from 'next/link';
import type { Route } from 'next';
import { cookies } from 'next/headers';
import { SiteShell } from '../../components/site-shell';
import { SectionCard } from '../../components/section-card';
import { parseUserRole, type UserRole } from '../../lib/roles';

async function getAuthMeServerSide(sessionCookie: string): Promise<{ role: UserRole; isAuthenticated: boolean } | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backend.blackpond-7507d149.koreacentral.azurecontainerapps.io'}/auth/me`, {
      method: 'GET',
      headers: {
        cookie: sessionCookie ? `keepit-session=${sessionCookie}` : '',
        'content-type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { isAuthenticated: boolean; user?: { role: string } };
    if (data.isAuthenticated && data.user) {
      return { role: parseUserRole(data.user.role), isAuthenticated: true };
    }

    return null;
  } catch {
    return null;
  }
}

const DEV_LINKS: Array<{ href: Route; label: string; desc: string }> = [
  { href: '/admin' as Route, label: '운영자 대시보드', desc: '신고, 계정, SLA 운영 기능' },
  { href: '/reports' as Route, label: '신고 목록', desc: '최근 신고 확인 및 상태 점검' },
  { href: '/reports/new' as Route, label: '신고 등록 테스트', desc: '신고 플로우 수동 점검' },
  { href: '/questions/new' as Route, label: '질문 등록 테스트', desc: '질문 생성/검증 시나리오 점검' },
  { href: '/videos/new' as Route, label: '영상 등록 테스트', desc: '영상 업로드/노출 동작 점검' },
  { href: '/profile' as Route, label: '계정/세션 확인', desc: '로그인 상태와 권한 확인' },
];

export default async function DeveloperPage() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get('keepit-session')?.value;

  const authResult = await getAuthMeServerSide(sessionValue || '');

  if (!authResult || authResult.role !== 'admin') {
    return (
      <SiteShell title="개발자 도구" description="관리자 권한에서만 접근할 수 있습니다.">
        <SectionCard eyebrow="접근 제한" title="개발자 권한이 필요합니다">
          <div className="empty-state">관리자 계정으로 로그인하면 개발자 전용 기능을 사용할 수 있습니다.</div>
        </SectionCard>
      </SiteShell>
    );
  }

  return (
    <SiteShell title="개발자 도구" description="개발자 전용 점검/운영 기능을 한 화면에 모았습니다.">
      <SectionCard eyebrow="Developer" title="자주 쓰는 기능 모음">
        <div className="card-grid two-up">
          {DEV_LINKS.map((item) => (
            <article key={item.href} className="surface-card">
              <div className="card-meta">개발자 기능</div>
              <h3>{item.label}</h3>
              <p>{item.desc}</p>
              <div className="hero-actions">
                <Link href={item.href} className="primary-button">
                  이동
                </Link>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Quick Access" title="외부 점검 링크">
        <div className="hero-actions">
          <a
            className="secondary-button"
            href="https://backend.blackpond-7507d149.koreacentral.azurecontainerapps.io/health"
            target="_blank"
            rel="noreferrer"
          >
            백엔드 health 확인
          </a>
          <a
            className="secondary-button"
            href="https://frontend.blackpond-7507d149.koreacentral.azurecontainerapps.io/"
            target="_blank"
            rel="noreferrer"
          >
            프론트 배포 URL 확인
          </a>
        </div>
      </SectionCard>
    </SiteShell>
  );
}
