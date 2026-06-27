import { InMemoryReportRepository } from '../../src/reports/in-memory-report.repository';
import { InMemoryAdminAuditLogRepository } from '../../src/reports/in-memory-admin-audit-log.repository';
import { ReportEntity } from '../../src/reports/entities/report.entity';
import { ReportsService } from '../../src/reports/reports.service';

describe('ReportsService (unit)', () => {
  let service: ReportsService;

  beforeEach(() => {
    service = new ReportsService(
      new InMemoryReportRepository(),
      new InMemoryAdminAuditLogRepository(),
    );
  });

  it('creates a report', async () => {
    const report = await service.create({
      targetType: 'question',
      targetId: 'q-1',
      reason: 'copyright',
      severity: 'high',
    });

    expect(report.id).toBeDefined();
    expect(report.status).toBe('pending');
    expect(report.severity).toBe('high');
  });

  it('lists reports', async () => {
    await service.create({
      targetType: 'answer',
      targetId: 'a-1',
      reason: 'spam',
    });

    const reports = await service.listAll();
    expect(reports).toHaveLength(1);
    expect(reports[0].targetType).toBe('answer');
  });

  it('resolves reports and records audit logs', async () => {
    const created = await service.create({
      targetType: 'question',
      targetId: 'q-2',
      reason: 'abuse',
    });

    const updated = await service.approve(created.id, 'confirmed by admin');
    const logs = await service.listAuditLogs();

    expect(updated.status).toBe('resolved');
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('approve');
  });

  it('listQueue keeps pending/reviewing only and sorts high severity first then oldest first', async () => {
    const repo = new InMemoryReportRepository();
    const localService = new ReportsService(repo, new InMemoryAdminAuditLogRepository());

    const highOlder = ReportEntity.create({
      id: 'high-older',
      reporterId: 'user-1',
      targetType: 'question',
      targetId: 'q-high-older',
      reason: 'abuse',
      severity: 'high',
      status: 'pending',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const highNewer = ReportEntity.create({
      id: 'high-newer',
      reporterId: 'user-1',
      targetType: 'question',
      targetId: 'q-high-newer',
      reason: 'abuse',
      severity: 'high',
      status: 'reviewing',
      createdAt: new Date('2026-01-01T00:00:01.000Z'),
    });
    const normalOlder = ReportEntity.create({
      id: 'normal-older',
      reporterId: 'user-1',
      targetType: 'question',
      targetId: 'q-normal-older',
      reason: 'spam',
      severity: 'normal',
      status: 'pending',
      createdAt: new Date('2026-01-01T00:00:00.500Z'),
    });
    const resolved = ReportEntity.create({
      id: 'resolved',
      reporterId: 'user-1',
      targetType: 'question',
      targetId: 'q-resolved',
      reason: 'spam',
      severity: 'high',
      status: 'resolved',
      createdAt: new Date('2026-01-01T00:00:00.100Z'),
    });
    const rejected = ReportEntity.create({
      id: 'rejected',
      reporterId: 'user-1',
      targetType: 'question',
      targetId: 'q-rejected',
      reason: 'spam',
      severity: 'high',
      status: 'rejected',
      createdAt: new Date('2026-01-01T00:00:00.200Z'),
    });
    const restored = ReportEntity.create({
      id: 'restored',
      reporterId: 'user-1',
      targetType: 'question',
      targetId: 'q-restored',
      reason: 'spam',
      severity: 'high',
      status: 'restored',
      createdAt: new Date('2026-01-01T00:00:00.300Z'),
    });

    await repo.save(highOlder);
    await repo.save(highNewer);
    await repo.save(normalOlder);
    await repo.save(resolved);
    await repo.save(rejected);
    await repo.save(restored);

    const queue = await localService.listQueue(['resolved' as unknown as 'pending']);

    expect(queue.map((report) => report.id)).toEqual(['high-older', 'high-newer', 'normal-older']);
  });
});
