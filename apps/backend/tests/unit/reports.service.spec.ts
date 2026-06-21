import { InMemoryReportRepository } from '../../src/reports/in-memory-report.repository';
import { InMemoryAdminAuditLogRepository } from '../../src/reports/in-memory-admin-audit-log.repository';
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
});
