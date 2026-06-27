import { Injectable } from '@nestjs/common';
import { TableClient } from '@azure/data-tables';
import { MentoringSessionEntity } from './entities/mentoring-session.entity';
import { MentoringSessionRepository } from './mentoring-session.repository';
import { ensureTable, escapeOdataString, getTableClient, listAllEntities } from '../db/azure-table.util';

@Injectable()
export class SqliteMentoringSessionRepository
  implements MentoringSessionRepository
{
  private readonly client: TableClient;
  private readonly ready: Promise<void>;

  constructor() {
    this.client = getTableClient('MENTORING_SESSIONS_TABLE_NAME', 'mentoringsessions');
    this.ready = ensureTable(this.client);
  }

  private async ensureReady() {
    await this.ready;
  }

  async save(session: MentoringSessionEntity): Promise<void> {
    await this.ensureReady();
    await this.client.upsertEntity({
      partitionKey: 'mentoringsessions',
      rowKey: session.id,
      learnerId: session.learnerId,
      question: session.question,
      createdAt: session.createdAt.toISOString(),
      firstMentorResponseAt: session.firstMentorResponseAt?.toISOString() ?? null,
    }, 'Replace');
  }

  async findById(id: string): Promise<MentoringSessionEntity | null> {
    await this.ensureReady();
    try {
      const row = await this.client.getEntity<Record<string, unknown>>('mentoringsessions', id);
      return this.mapToEntity(row);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async findByLearnerId(learnerId: string): Promise<MentoringSessionEntity[]> {
    await this.ensureReady();
    const escapedLearnerId = escapeOdataString(learnerId);
    const rows = await listAllEntities<Record<string, unknown>>(
      this.client,
      `partitionKey eq 'mentoringsessions' and learnerId eq '${escapedLearnerId}'`,
    );

    return rows
      .map((row) => this.mapToEntity(row))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listAll(): Promise<MentoringSessionEntity[]> {
    await this.ensureReady();
    const rows = await listAllEntities<Record<string, unknown>>(this.client, `partitionKey eq 'mentoringsessions'`);
    return rows
      .map((row) => this.mapToEntity(row))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteById(id: string): Promise<void> {
    await this.ensureReady();
    try {
      await this.client.deleteEntity('mentoringsessions', id);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode !== 404) {
        throw error;
      }
    }
  }

  private mapToEntity(row: any): MentoringSessionEntity {
    return MentoringSessionEntity.create({
      id: String(row.rowKey ?? row.id),
      learnerId: String(row.learnerId),
      question: String(row.question),
      createdAt: new Date(String(row.createdAt)),
      firstMentorResponseAt: row.firstMentorResponseAt ? new Date(String(row.firstMentorResponseAt)) : null,
    });
  }
}
