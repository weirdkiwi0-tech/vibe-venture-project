import { InMemoryReportRepository } from '../../src/reports/in-memory-report.repository';
import { InMemoryAdminAuditLogRepository } from '../../src/reports/in-memory-admin-audit-log.repository';
import { ReportEntity } from '../../src/reports/entities/report.entity';
import { ReportsService } from '../../src/reports/reports.service';

describe('ReportsService + Repository (integration)', () => {
  it('creates then lists reports', async () => {
    const repo = new InMemoryReportRepository();
    const auditRepo = new InMemoryAdminAuditLogRepository();
    const service = new ReportsService(repo, auditRepo);

    const created = await service.create({
      targetType: 'question',
      targetId: 'q-integration',
      reason: 'inappropriate',
    });

    const list = await service.listAll();

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
    expect(list[0].status).toBe('pending');
  });

  it('filters queue and persists moderation actions', async () => {
    const repo = new InMemoryReportRepository();
    const auditRepo = new InMemoryAdminAuditLogRepository();
    const service = new ReportsService(repo, auditRepo);

    const pending = await service.create({
      targetType: 'question',
      targetId: 'q-1',
      reason: 'spam',
      severity: 'high',
    });
    await service.approve(pending.id, 'approved');

    const queue = await service.listQueue();
    const auditLogs = await service.listAuditLogs();

    expect(queue).toHaveLength(0);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].metadata).toMatchObject({ reportId: pending.id });
  });

  it('enforces queue contract: pending/reviewing only, high first, oldest first, excludes terminal states', async () => {
    const repo = new InMemoryReportRepository();
    const auditRepo = new InMemoryAdminAuditLogRepository();
    const service = new ReportsService(repo, auditRepo);

    await repo.save(
      ReportEntity.create({
        id: 'i-high-older',
        reporterId: 'integration-user',
        targetType: 'question',
        targetId: 'q-i-high-older',
        reason: 'abuse',
        severity: 'high',
        status: 'pending',
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    );
    await repo.save(
      ReportEntity.create({
        id: 'i-normal-older',
        reporterId: 'integration-user',
        targetType: 'question',
        targetId: 'q-i-normal-older',
        reason: 'spam',
        severity: 'normal',
        status: 'pending',
        createdAt: new Date('2026-02-01T00:00:00.100Z'),
      }),
    );
    await repo.save(
      ReportEntity.create({
        id: 'i-high-newer',
        reporterId: 'integration-user',
        targetType: 'question',
        targetId: 'q-i-high-newer',
        reason: 'abuse',
        severity: 'high',
        status: 'reviewing',
        createdAt: new Date('2026-02-01T00:00:01.000Z'),
      }),
    );
    await repo.save(
      ReportEntity.create({
        id: 'i-resolved',
        reporterId: 'integration-user',
        targetType: 'question',
        targetId: 'q-i-resolved',
        reason: 'abuse',
        severity: 'high',
        status: 'resolved',
        createdAt: new Date('2026-02-01T00:00:00.010Z'),
      }),
    );
    await repo.save(
      ReportEntity.create({
        id: 'i-rejected',
        reporterId: 'integration-user',
        targetType: 'question',
        targetId: 'q-i-rejected',
        reason: 'abuse',
        severity: 'high',
        status: 'rejected',
        createdAt: new Date('2026-02-01T00:00:00.020Z'),
      }),
    );
    await repo.save(
      ReportEntity.create({
        id: 'i-restored',
        reporterId: 'integration-user',
        targetType: 'question',
        targetId: 'q-i-restored',
        reason: 'abuse',
        severity: 'high',
        status: 'restored',
        createdAt: new Date('2026-02-01T00:00:00.030Z'),
      }),
    );

    const queue = await service.listQueue(['resolved' as unknown as 'pending']);

    expect(queue.map((report) => report.id)).toEqual(['i-high-older', 'i-high-newer', 'i-normal-older']);
  });
});
