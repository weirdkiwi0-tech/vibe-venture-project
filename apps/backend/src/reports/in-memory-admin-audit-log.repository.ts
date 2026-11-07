import { Injectable } from '@nestjs/common';
import { attachLocalState } from '../db/local-state';
import { AdminAuditLogEntity } from './entities/admin-audit-log.entity';
import { AdminAuditLogRepository } from './reports.repository';

@Injectable()
export class InMemoryAdminAuditLogRepository implements AdminAuditLogRepository {
  private readonly store: AdminAuditLogEntity[] = [];

  constructor() {
    attachLocalState(this, 'audit-logs', ['store'], ['save']);
  }

  async save(entry: AdminAuditLogEntity): Promise<void> {
    this.store.push(entry);
  }

  async listAll(): Promise<AdminAuditLogEntity[]> {
    return [...this.store];
  }
}