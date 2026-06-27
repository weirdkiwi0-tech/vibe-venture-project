import { AdminService } from '../../src/admin/admin.service';
import { InMemoryAdminAuditLogRepository } from '../../src/reports/in-memory-admin-audit-log.repository';
import { InMemoryReportRepository } from '../../src/reports/in-memory-report.repository';
import { ReportsService } from '../../src/reports/reports.service';

describe('AdminService + ReportsService (integration)', () => {
  it('summarizes moderation state from real repositories', async () => {
    const reportsService = new ReportsService(
      new InMemoryReportRepository(),
      new InMemoryAdminAuditLogRepository(),
    );
    const authService = {
      listUsers: jest.fn(),
      deleteUser: jest.fn(),
      banUser: jest.fn(),
      unbanUser: jest.fn(),
    };
    const adminService = new AdminService(reportsService, authService as never);

    await reportsService.create({
      targetType: 'question',
      targetId: 'q-1',
      reason: 'spam',
      severity: 'high',
    });
    await reportsService.create({
      targetType: 'answer',
      targetId: 'a-1',
      reason: 'abuse',
    });
    await reportsService.create({
      targetType: 'question',
      targetId: 'q-1',
      reason: 'duplicate spam',
    });
    await reportsService.approve('missing-check-not-used', 'noop').catch(() => undefined);

    const overview = await adminService.getOverview();

    expect(overview.cards.find((card) => card.key === 'pendingReports')?.value).toBe(3);
    expect(overview.cards.find((card) => card.key === 'highRiskReports')?.value).toBe(1);
    expect(overview.urgentReports).toHaveLength(3);
    expect(overview.reportBuckets).toHaveLength(2);
    expect(overview.reportBuckets[0]).toEqual(
      expect.objectContaining({
        id: 'question:q-1',
        reportCount: 2,
      }),
    );
  });

  it('reflects community-post and comment reports in overview buckets', async () => {
    const reportsService = new ReportsService(
      new InMemoryReportRepository(),
      new InMemoryAdminAuditLogRepository(),
    );
    const authService = {
      listUsers: jest.fn(),
      deleteUser: jest.fn(),
      banUser: jest.fn(),
      unbanUser: jest.fn(),
    };
    const adminService = new AdminService(reportsService, authService as never);

    await reportsService.create({
      targetType: 'community-post',
      targetId: 'cp-100',
      reason: 'community spam',
      severity: 'high',
    });
    await reportsService.create({
      targetType: 'comment',
      targetId: 'c-900',
      reason: 'comment abuse',
      severity: 'normal',
    });

    const overview = await adminService.getOverview();

    expect(overview.urgentReports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetType: 'community-post', targetId: 'cp-100' }),
        expect.objectContaining({ targetType: 'comment', targetId: 'c-900' }),
      ]),
    );

    expect(overview.reportBuckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'community-post:cp-100',
          targetType: 'community-post',
          href: '/community/posts/cp-100',
          title: '신고된 커뮤니티 게시글',
        }),
        expect.objectContaining({
          id: 'comment:c-900',
          targetType: 'comment',
          href: '/questions',
          title: '신고된 댓글/답글',
        }),
      ]),
    );
  });

  it('listUsers() 반환 목록 형태 검증', async () => {
    const reportsService = new ReportsService(
      new InMemoryReportRepository(),
      new InMemoryAdminAuditLogRepository(),
    );
    const { AuthService: RealAuthService } = await import('../../src/auth/auth.service');
    const realAuthService = new RealAuthService();
    await realAuthService.signUpLocal({ email: 'admin-list-test@test.com', password: 'Secure@99', displayName: '어드민목록' });
    const adminService = new AdminService(reportsService, realAuthService as never);

    const users = await adminService.listUsers();

    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    const user = users[0];
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('displayName');
    expect(user).toHaveProperty('role');
    expect(user).toHaveProperty('createdAt');
  });

  it('banUser + unbanUser 왕복: ban_until 설정 후 해제 확인', async () => {
    const reportsService = new ReportsService(
      new InMemoryReportRepository(),
      new InMemoryAdminAuditLogRepository(),
    );
    const { AuthService: RealAuthService } = await import('../../src/auth/auth.service');
    const realAuthService = new RealAuthService();
    const { user } = await realAuthService.signUpLocal({ email: 'ban-roundtrip@test.com', password: 'Secure@99', displayName: '밴왕복' });
    const adminService = new AdminService(reportsService, realAuthService as never);

    const banUntil = new Date(Date.now() + 3600 * 1000).toISOString();
    await adminService.banUser(user.id, banUntil);
    const banInfo = await realAuthService.getBanInfoByUserId(user.id);
    expect(banInfo.isBanned).toBe(true);

    await adminService.unbanUser(user.id);
    const afterUnban = await realAuthService.getBanInfoByUserId(user.id);
    expect(afterUnban.isBanned).toBe(false);
  });

  it('deleteUser 후 getUserById → undefined', async () => {
    const reportsService = new ReportsService(
      new InMemoryReportRepository(),
      new InMemoryAdminAuditLogRepository(),
    );
    const { AuthService: RealAuthService } = await import('../../src/auth/auth.service');
    const realAuthService = new RealAuthService();
    const { user } = await realAuthService.signUpLocal({ email: 'delete-test@test.com', password: 'Secure@99', displayName: '삭제테스터' });
    const adminService = new AdminService(reportsService, realAuthService as never);

    await adminService.deleteUser(user.id);

    const found = await realAuthService.getUserById(user.id);
    expect(found).toBeUndefined();
  });

  it('updateUserRole → 역할 변경 확인', async () => {
    const reportsService = new ReportsService(
      new InMemoryReportRepository(),
      new InMemoryAdminAuditLogRepository(),
    );
    const { AuthService: RealAuthService } = await import('../../src/auth/auth.service');
    const realAuthService = new RealAuthService();
    const { user } = await realAuthService.signUpLocal({ email: 'role-change@test.com', password: 'Secure@99', displayName: '역할변경' });
    const adminService = new AdminService(reportsService, realAuthService as never);

    expect(user.role).toBe('user');
    await adminService.updateUserRole(user.id, 'admin');

    const updated = await realAuthService.getUserById(user.id);
    expect(updated?.role).toBe('admin');
  });

  it('banUser + listUsers → 해당 유저의 banned_until이 설정됨', async () => {
    const reportsService = new ReportsService(
      new InMemoryReportRepository(),
      new InMemoryAdminAuditLogRepository(),
    );
    const { AuthService: RealAuthService } = await import('../../src/auth/auth.service');
    const realAuthService = new RealAuthService();
    const { user } = await realAuthService.signUpLocal({ email: 'ban-listusers@test.com', password: 'Secure@99', displayName: '밴목록확인' });
    const adminService = new AdminService(reportsService, realAuthService as never);

    const banUntil = new Date(Date.now() + 3600 * 1000).toISOString();
    await adminService.banUser(user.id, banUntil);

    const users = await adminService.listUsers();
    const found = users.find((u) => u.id === user.id);
    expect(found).toBeDefined();
    expect(found!.banned_until).toBeDefined();
    expect(found!.banned_until).not.toBeNull();
  });

  it('unbanUser + listUsers → 해당 유저의 banned_until이 null', async () => {
    const reportsService = new ReportsService(
      new InMemoryReportRepository(),
      new InMemoryAdminAuditLogRepository(),
    );
    const { AuthService: RealAuthService } = await import('../../src/auth/auth.service');
    const realAuthService = new RealAuthService();
    const { user } = await realAuthService.signUpLocal({ email: 'unban-listusers@test.com', password: 'Secure@99', displayName: '언밴목록확인' });
    const adminService = new AdminService(reportsService, realAuthService as never);

    const banUntil = new Date(Date.now() + 3600 * 1000).toISOString();
    await adminService.banUser(user.id, banUntil);
    await adminService.unbanUser(user.id);

    const users = await adminService.listUsers();
    const found = users.find((u) => u.id === user.id);
    expect(found).toBeDefined();
    expect(found!.banned_until).toBeNull();
  });

  it('deleteUser + listUsers → 해당 유저가 목록에서 사라짐', async () => {
    const reportsService = new ReportsService(
      new InMemoryReportRepository(),
      new InMemoryAdminAuditLogRepository(),
    );
    const { AuthService: RealAuthService } = await import('../../src/auth/auth.service');
    const realAuthService = new RealAuthService();
    const { user } = await realAuthService.signUpLocal({ email: 'delete-listusers@test.com', password: 'Secure@99', displayName: '삭제목록확인' });
    const adminService = new AdminService(reportsService, realAuthService as never);

    await adminService.deleteUser(user.id);

    const users = await adminService.listUsers();
    const found = users.find((u) => u.id === user.id);
    expect(found).toBeUndefined();
  });

  it('updateUserRole + listUsers → 해당 유저 role이 admin으로 변경됨', async () => {
    const reportsService = new ReportsService(
      new InMemoryReportRepository(),
      new InMemoryAdminAuditLogRepository(),
    );
    const { AuthService: RealAuthService } = await import('../../src/auth/auth.service');
    const realAuthService = new RealAuthService();
    const { user } = await realAuthService.signUpLocal({ email: 'role-listusers@test.com', password: 'Secure@99', displayName: '역할목록확인' });
    const adminService = new AdminService(reportsService, realAuthService as never);

    await adminService.updateUserRole(user.id, 'admin');

    const users = await adminService.listUsers();
    const found = users.find((u) => u.id === user.id);
    expect(found).toBeDefined();
    expect(found!.role).toBe('admin');
  });
});