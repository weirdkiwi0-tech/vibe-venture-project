import { Injectable } from '@nestjs/common';
import { TableClient } from '@azure/data-tables';
import { MentoringMessageEntity } from './entities/mentoring-message.entity';
import { MentoringMessageRepository } from './mentoring-message.repository';
import { ensureTable, escapeOdataString, getTableClient, listAllEntities } from '../db/azure-table.util';

@Injectable()
export class SqliteMentoringMessageRepository
  implements MentoringMessageRepository
{
  private readonly client: TableClient;
  private readonly ready: Promise<void>;

  constructor() {
    this.client = getTableClient('MENTORING_MESSAGES_TABLE_NAME', 'mentoringmessages');
    this.ready = ensureTable(this.client);
  }

  private async ensureReady() {
    await this.ready;
  }

  async save(message: MentoringMessageEntity): Promise<void> {
    await this.ensureReady();
    await this.client.upsertEntity({
      partitionKey: 'mentoringmessages',
      rowKey: message.id,
      sessionId: message.sessionId,
      sender: message.sender,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    }, 'Replace');
  }

  async findById(id: string): Promise<MentoringMessageEntity | null> {
    await this.ensureReady();
    try {
      const row = await this.client.getEntity<Record<string, unknown>>('mentoringmessages', id);
      return this.mapToEntity(row);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async findBySessionId(sessionId: string): Promise<MentoringMessageEntity[]> {
    await this.ensureReady();
    const escapedSessionId = escapeOdataString(sessionId);
    const rows = await listAllEntities<Record<string, unknown>>(
      this.client,
      `partitionKey eq 'mentoringmessages' and sessionId eq '${escapedSessionId}'`,
    );

    return rows
      .map((row) => this.mapToEntity(row))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async deleteById(id: string): Promise<void> {
    await this.ensureReady();
    try {
      await this.client.deleteEntity('mentoringmessages', id);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode !== 404) {
        throw error;
      }
    }
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    const rows = await this.findBySessionId(sessionId);
    await Promise.all(rows.map((row) => this.deleteById(row.id)));
  }

  private mapToEntity(row: any): MentoringMessageEntity {
    return MentoringMessageEntity.create({
      id: String(row.rowKey ?? row.id),
      sessionId: String(row.sessionId),
      sender: String(row.sender) as 'learner' | 'mentor',
      content: String(row.content),
      createdAt: new Date(String(row.createdAt)),
    });
  }
}
