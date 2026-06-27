import { Injectable } from '@nestjs/common';
import { TableClient } from '@azure/data-tables';
import { ensureTable, getTableClient, listAllEntities } from '../db/azure-table.util';
import { ReportEntity } from './entities/report.entity';
import { ReportRepository } from './reports.repository';

@Injectable()
export class SqliteReportRepository implements ReportRepository {
  private readonly client: TableClient;
  private readonly ready: Promise<void>;

  constructor() {
    this.client = getTableClient('REPORTS_TABLE_NAME', 'reports');
    this.ready = ensureTable(this.client);
  }

  private async ensureReady() {
    await this.ready;
  }

  async save(report: ReportEntity): Promise<void> {
    await this.ensureReady();
    await this.client.upsertEntity({
      partitionKey: 'reports',
      rowKey: report.id,
      reporterId: report.reporterId,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      details: report.details ?? '',
      severity: report.severity,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    }, 'Replace');
  }

  async listAll(): Promise<ReportEntity[]> {
    await this.ensureReady();
    const rows = await listAllEntities<Record<string, unknown>>(this.client, `partitionKey eq 'reports'`);
    return rows
      .map((row) => this.mapToEntity(row))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findById(id: string): Promise<ReportEntity | undefined> {
    await this.ensureReady();
    try {
      const row = await this.client.getEntity<Record<string, unknown>>('reports', id);
      return this.mapToEntity(row);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404) {
        return undefined;
      }
      throw error;
    }
  }

  private mapToEntity(row: Record<string, unknown>): ReportEntity {
    return ReportEntity.create({
      id: String(row.rowKey ?? row.id),
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
