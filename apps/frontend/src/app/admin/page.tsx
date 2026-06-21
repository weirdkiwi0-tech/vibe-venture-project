import { cookies } from 'next/headers';
import { SiteShell } from '../../components/site-shell';
import { SectionCard } from '../../components/section-card';
import { AdminDashboard } from '../../components/admin-dashboard';
import { parseUserRole, type UserRole } from '../../lib/roles';
import { getAdminOverview, getAdminUsers, getSlaBreaches } from '../../lib/api';

async function getAuthMeServerSide(sessionCookie: string): Promise<{ role: UserRole; isAuthenticated: boolean } | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backend.blackpond-7507d149.koreacentral.azurecontainerapps.io'}/auth/me`, {
      method: 'GET',
      headers: {
        'cookie': sessionCookie ? `keepit-session=${sessionCookie}` : '',
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

export default async function AdminPage() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get('keepit-session')?.value;

  // 서버에서 직접 /auth/me를 호출하여 현재 권한을 확인
  const authResult = await getAuthMeServerSide(sessionValue || '');

  if (!authResult || authResult.role !== 'admin') {
    return (
      <SiteShell title="운영자 대시보드" description="관리자 역할이 있어야 접근할 수 있습니다.">
        <SectionCard eyebrow="접근 제한" title="관리자 권한이 필요합니다">
          <div className="empty-state">관리자 권한이 부여된 계정으로 로그인해야 운영자 화면을 볼 수 있습니다.</div>
        </SectionCard>
      </SiteShell>
    );
  }

  const currentRole: UserRole = 'admin';
  const cookieHeader = sessionValue ? `keepit-session=${sessionValue}` : '';

  let overview;
  let breaches;
  let users;

  try {
    [overview, breaches, users] = await Promise.all([
      getAdminOverview(currentRole, cookieHeader),
      getSlaBreaches(currentRole, cookieHeader),
      getAdminUsers(currentRole, cookieHeader),
    ]);
  } catch (error) {
    console.error('[AdminPage] API 호출 실패:', error);
    return (
      <SiteShell title="운영자 대시보드" description="신고, 계정, SLA를 탭으로 관리합니다.">
        <SectionCard eyebrow="세션 만료" title="다시 로그인해 주세요">
          <div className="empty-state">
            관리자 세션이 만료되었거나 권한이 변경되었습니다. 설정 화면에서 다시 로그인한 뒤 접근해 주세요.
          </div>
        </SectionCard>
      </SiteShell>
    );
  }

  return (
    <SiteShell title="운영자 대시보드" description="신고, 계정, SLA를 탭으로 관리합니다.">
      <AdminDashboard overview={overview} users={users} breaches={breaches} currentRole={currentRole} />
    </SiteShell>
  );
}