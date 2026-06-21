import { InMemoryReportRepository } from '../../src/reports/in-memory-report.repository';
import { InMemoryAdminAuditLogRepository } from '../../src/reports/in-memory-admin-audit-log.repository';
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
});
