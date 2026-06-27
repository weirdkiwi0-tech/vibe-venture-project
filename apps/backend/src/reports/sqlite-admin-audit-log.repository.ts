import { Injectable } from '@nestjs/common';
import { TableClient } from '@azure/data-tables';
import { ensureTable, getTableClient, listAllEntities } from '../db/azure-table.util';
import { AdminAuditLogEntity } from './entities/admin-audit-log.entity';
import { AdminAuditLogRepository } from './reports.repository';

@Injectable()
export class SqliteAdminAuditLogRepository implements AdminAuditLogRepository {
  private readonly client: TableClient;
  private readonly ready: Promise<void>;

  constructor() {
    this.client = getTableClient('ADMIN_AUDIT_LOGS_TABLE_NAME', 'adminauditlogs');
    this.ready = ensureTable(this.client);
  }

  private async ensureReady() {
    await this.ready;
  }

  async save(entry: AdminAuditLogEntity): Promise<void> {
    await this.ensureReady();
    await this.client.upsertEntity({
      partitionKey: 'adminauditlogs',
      rowKey: entry.id,
      adminId: entry.adminId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reason: entry.reason,
      metadata: JSON.stringify(entry.metadata ?? {}),
      createdAt: entry.createdAt.toISOString(),
    }, 'Replace');
  }

  async listAll(): Promise<AdminAuditLogEntity[]> {
    await this.ensureReady();
    const rows = await listAllEntities<Record<string, unknown>>(this.client, `partitionKey eq 'adminauditlogs'`);
    return rows
      .map((row) => this.mapToEntity(row))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private mapToEntity(row: Record<string, unknown>): AdminAuditLogEntity {
    const rawMetadata = typeof row.metadata === 'string' ? row.metadata : '{}';

    return AdminAuditLogEntity.create({
      id: String(row.rowKey ?? row.id),
      adminId: String(row.adminId),
      action: String(row.action) as 'approve' | 'reject' | 'restore',
      targetType: String(row.targetType) as 'question' | 'answer' | 'video' | 'comment' | 'community-post',
      targetId: String(row.targetId),
      reason: String(row.reason),
      metadata: JSON.parse(rawMetadata),
      createdAt: new Date(String(row.createdAt)),
    });
  }
}
