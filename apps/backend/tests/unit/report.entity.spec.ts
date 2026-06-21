import { ReportEntity } from '../../src/reports/entities/report.entity';
import { DomainValidationError } from '../../src/reports/errors/domain-validation.error';

describe('ReportEntity (unit)', () => {
  it('creates report with defaults', () => {
    const report = ReportEntity.create({
      id: 'r-1',
      reporterId: 'u-1',
      targetType: 'question',
      targetId: 'q-1',
      reason: 'spam',
    });

    expect(report.status).toBe('pending');
    expect(report.severity).toBe('normal');
  });

  it('throws when targetId is missing', () => {
    expect(() =>
      ReportEntity.create({
        id: 'r-2',
        reporterId: 'u-1',
        targetType: 'answer',
        targetId: '',
        reason: 'abuse',
      }),
    ).toThrow(DomainValidationError);
  });
});
