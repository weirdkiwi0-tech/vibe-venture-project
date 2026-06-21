import { Injectable } from '@nestjs/common';
import { ReportEntity } from './entities/report.entity';
import { ReportRepository } from './reports.repository';

@Injectable()
export class InMemoryReportRepository implements ReportRepository {
  private readonly store = new Map<string, ReportEntity>();

  async save(report: ReportEntity): Promise<void> {
    this.store.set(report.id, report);
  }

  async listAll(): Promise<ReportEntity[]> {
    return Array.from(this.store.values());
  }

  async findById(id: string): Promise<ReportEntity | undefined> {
    return this.store.get(id);
  }
}
