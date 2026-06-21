import { Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';
import { DatabaseService } from '../db/database.service';
import { AdminAuditLogEntity } from './entities/admin-audit-log.entity';
import { AdminAuditLogRepository } from './reports.repository';

@Injectable()
export class SqliteAdminAuditLogRepository implements AdminAuditLogRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private getDb(): Database.Database {
    return this.databaseService.getDatabase();
  }

  async save(entry: AdminAuditLogEntity): Promise<void> {
    const stmt = this.getDb().prepare(`
      INSERT OR REPLACE INTO admin_audit_logs (
        id, adminId, action, targetType, targetId, reason, metadata, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.id,
      entry.adminId,
      entry.action,
      entry.targetType,
      entry.targetId,
      entry.reason,
      JSON.stringify(entry.metadata ?? {}),
      entry.createdAt.toISOString(),
    );
  }

  async listAll(): Promise<AdminAuditLogEntity[]> {
    const rows = this.getDb().prepare('SELECT * FROM admin_audit_logs ORDER BY createdAt DESC').all() as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapToEntity(row));
  }

  private mapToEntity(row: Record<string, unknown>): AdminAuditLogEntity {
    const rawMetadata = typeof row.metadata === 'string' ? row.metadata : '{}';

    return AdminAuditLogEntity.create({
      id: String(row.id),
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
