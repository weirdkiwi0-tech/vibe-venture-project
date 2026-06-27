import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { InMemoryAdminAuditLogRepository } from './in-memory-admin-audit-log.repository';
import { InMemoryReportRepository } from './in-memory-report.repository';
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
    InMemoryReportRepository,
    InMemoryAdminAuditLogRepository,
    {
      provide: REPORT_REPOSITORY,
      inject: [InMemoryReportRepository],
      useFactory: (inMemoryRepository: InMemoryReportRepository) => {
        if (!process.env.AZURE_TABLES_CONNECTION_STRING) {
          return inMemoryRepository;
        }

        return new SqliteReportRepository();
      },
    },
    {
      provide: ADMIN_AUDIT_LOG_REPOSITORY,
      inject: [InMemoryAdminAuditLogRepository],
      useFactory: (inMemoryRepository: InMemoryAdminAuditLogRepository) => {
        if (!process.env.AZURE_TABLES_CONNECTION_STRING) {
          return inMemoryRepository;
        }

        return new SqliteAdminAuditLogRepository();
      },
    },
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
