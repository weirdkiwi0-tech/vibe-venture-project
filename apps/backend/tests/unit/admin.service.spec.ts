import { AdminService } from '../../src/admin/admin.service';

describe('AdminService (unit)', () => {
  it('builds overview cards and urgent reports from moderation data', async () => {
    const reportsService = {
      listAll: jest.fn().mockResolvedValue([
        { status: 'pending' },
        { status: 'reviewing' },
        { status: 'resolved' },
      ]),
      listQueue: jest.fn().mockResolvedValue([
        {
          id: 'r-1',
          targetType: 'question',
          targetId: 'q-1',
          reason: 'spam',
          severity: 'high',
          status: 'pending',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'r-2',
          targetType: 'question',
          targetId: 'q-1',
          reason: 'duplicate spam',
          severity: 'normal',
          status: 'pending',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ]),
      listAuditLogs: jest.fn().mockResolvedValue([{}]),
    };

    const authService = {
      listUsers: jest.fn(),
      deleteUser: jest.fn(),
      banUser: jest.fn(),
      unbanUser: jest.fn(),
    };

    const service = new AdminService(reportsService as never, authService as never);
    const overview = await service.getOverview();

    expect(reportsService.listAll).toHaveBeenCalledTimes(1);
    expect(reportsService.listQueue).toHaveBeenCalledTimes(1);
    expect(reportsService.listAuditLogs).toHaveBeenCalledTimes(1);
    expect(overview.cards).toHaveLength(4);
    expect(overview.urgentReports).toHaveLength(2);
    expect(overview.reportBuckets).toEqual([
      expect.objectContaining({
        id: 'question:q-1',
        title: '삭제되었거나 찾을 수 없는 질문',
        href: '/questions/q-1',
        reportCount: 2,
        highestSeverity: 'high',
      }),
    ]);
  });
});