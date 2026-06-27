import { Injectable } from '@nestjs/common';
import { TableClient } from '@azure/data-tables';
import { AnswerEntity } from './entities/answer.entity';
import { AnswerRepository } from './answers.repository';
import { ensureTable, escapeOdataString, getTableClient, listAllEntities } from '../db/azure-table.util';

@Injectable()
export class SqliteAnswerRepository implements AnswerRepository {
  private readonly client: TableClient;
  private readonly ready: Promise<void>;

  constructor() {
    this.client = getTableClient('ANSWERS_TABLE_NAME', 'answers');
    this.ready = ensureTable(this.client);
  }

  private async ensureReady() {
    await this.ready;
  }

  async save(answer: AnswerEntity): Promise<void> {
    await this.ensureReady();
    await this.client.upsertEntity({
      partitionKey: 'answers',
      rowKey: answer.id,
      questionId: answer.questionId,
      authorId: answer.authorId,
      type: answer.type,
      content: answer.content,
      attachments: JSON.stringify(answer.attachments),
      createdAt: answer.createdAt.toISOString(),
    }, 'Replace');
  }

  async findById(id: string): Promise<AnswerEntity | null> {
    await this.ensureReady();
    try {
      const row = await this.client.getEntity<Record<string, unknown>>('answers', id);
      return this.mapToEntity(row);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async findByQuestionId(questionId: string): Promise<AnswerEntity[]> {
    await this.ensureReady();
    const escapedQuestionId = escapeOdataString(questionId);
    const rows = await listAllEntities<Record<string, unknown>>(
      this.client,
      `partitionKey eq 'answers' and questionId eq '${escapedQuestionId}'`,
    );

    return rows
      .map((row) => this.mapToEntity(row))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async findByAuthorId(authorId: string): Promise<AnswerEntity[]> {
    await this.ensureReady();
    const escapedAuthorId = escapeOdataString(authorId);
    const rows = await listAllEntities<Record<string, unknown>>(
      this.client,
      `partitionKey eq 'answers' and authorId eq '${escapedAuthorId}'`,
    );

    return rows
      .map((row) => this.mapToEntity(row))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteById(id: string): Promise<void> {
    await this.ensureReady();
    try {
      await this.client.deleteEntity('answers', id);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode !== 404) {
        throw error;
      }
    }
  }

  async deleteByQuestionId(questionId: string): Promise<void> {
    await this.ensureReady();
    const rows = await this.findByQuestionId(questionId);
    await Promise.all(rows.map((row) => this.deleteById(row.id)));
  }

  async countByQuestionId(questionId: string): Promise<number> {
    const rows = await this.findByQuestionId(questionId);
    return rows.length;
  }

  private mapToEntity(row: any): AnswerEntity {
    return AnswerEntity.create({
      id: row.id,
      questionId: row.questionId,
      authorId: row.authorId,
      type: row.type,
      content: row.content,
      attachments: JSON.parse(row.attachments || '[]'),
      createdAt: new Date(row.createdAt),
    });
  }
}
