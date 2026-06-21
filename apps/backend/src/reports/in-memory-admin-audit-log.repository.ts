import { Injectable } from '@nestjs/common';
import { AdminAuditLogEntity } from './entities/admin-audit-log.entity';
import { AdminAuditLogRepository } from './reports.repository';

@Injectable()
export class InMemoryAdminAuditLogRepository implements AdminAuditLogRepository {
  private readonly store: AdminAuditLogEntity[] = [];

  async save(entry: AdminAuditLogEntity): Promise<void> {
    this.store.push(entry);
  }

  async listAll(): Promise<AdminAuditLogEntity[]> {
    return [...this.store];
  }
}