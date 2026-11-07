import { Injectable } from '@nestjs/common';
import { attachLocalState } from '../db/local-state';
import { ReportEntity } from './entities/report.entity';
import { ReportRepository } from './reports.repository';

@Injectable()
export class InMemoryReportRepository implements ReportRepository {
  private readonly store = new Map<string, ReportEntity>();

  constructor() {
    attachLocalState(this, 'reports', ['store'], ['save'], { store: ReportEntity.prototype });
  }

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
