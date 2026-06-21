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
});