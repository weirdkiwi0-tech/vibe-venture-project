import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { DatabaseService } from '../db/database.service';
import { ReportsController } from './reports.controller';
import { ADMIN_AUDIT_LOG_REPOSITORY, REPORT_REPOSITORY } from './reports.repository';
import { ReportsService } from './reports.service';
import { SqliteAdminAuditLogRepository } from './sqlite-admin-audit-log.repository';
import { SqliteReportRepository } from './sqlite-report.repository';

@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    DatabaseService,
    SqliteReportRepository,
    SqliteAdminAuditLogRepository,
    {
      provide: REPORT_REPOSITORY,
      useExisting: SqliteReportRepository,
    },
    {
      provide: ADMIN_AUDIT_LOG_REPOSITORY,
      useExisting: SqliteAdminAuditLogRepository,
    },
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
