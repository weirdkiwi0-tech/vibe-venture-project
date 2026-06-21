import { ReportEntity } from './entities/report.entity';
import { AdminAuditLogEntity } from './entities/admin-audit-log.entity';

export const REPORT_REPOSITORY = Symbol('REPORT_REPOSITORY');

export interface ReportRepository {
  save(report: ReportEntity): Promise<void>;
  listAll(): Promise<ReportEntity[]>;
  findById(id: string): Promise<ReportEntity | undefined>;
}

export const ADMIN_AUDIT_LOG_REPOSITORY = Symbol('ADMIN_AUDIT_LOG_REPOSITORY');

export interface AdminAuditLogRepository {
  save(entry: AdminAuditLogEntity): Promise<void>;
  listAll(): Promise<AdminAuditLogEntity[]>;
}
