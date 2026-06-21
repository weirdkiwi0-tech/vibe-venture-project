import { Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';
import { DatabaseService } from '../db/database.service';
import { ReportEntity } from './entities/report.entity';
import { ReportRepository } from './reports.repository';

@Injectable()
export class SqliteReportRepository implements ReportRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private getDb(): Database.Database {
    return this.databaseService.getDatabase();
  }

  async save(report: ReportEntity): Promise<void> {
    const stmt = this.getDb().prepare(`
      INSERT OR REPLACE INTO reports (
        id, reporterId, targetType, targetId, reason, details, severity, status, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      report.id,
      report.reporterId,
      report.targetType,
      report.targetId,
      report.reason,
      report.details ?? '',
      report.severity,
      report.status,
      report.createdAt.toISOString(),
    );
  }

  async listAll(): Promise<ReportEntity[]> {
    const rows = this.getDb().prepare('SELECT * FROM reports ORDER BY createdAt DESC').all() as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapToEntity(row));
  }

  async findById(id: string): Promise<ReportEntity | undefined> {
    const row = this.getDb().prepare('SELECT * FROM reports WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) {
      return undefined;
    }
    return this.mapToEntity(row);
  }

  private mapToEntity(row: Record<string, unknown>): ReportEntity {
    return ReportEntity.create({
      id: String(row.id),
      reporterId: String(row.reporterId),
      targetType: String(row.targetType) as 'question' | 'answer' | 'video' | 'comment' | 'community-post',
      targetId: String(row.targetId),
      reason: String(row.reason),
      details: typeof row.details === 'string' ? row.details : '',
      severity: String(row.severity) as 'normal' | 'high',
      status: String(row.status) as 'pending' | 'reviewing' | 'resolved' | 'rejected' | 'restored',
      createdAt: new Date(String(row.createdAt)),
    });
  }
}
