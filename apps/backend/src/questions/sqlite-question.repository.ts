import { Injectable } from '@nestjs/common';
import { TableClient } from '@azure/data-tables';
import { QuestionEntity } from './entities/question.entity';
import { QuestionRepository } from './questions.repository';
import { ensureTable, escapeOdataString, getTableClient, listAllEntities } from '../db/azure-table.util';

@Injectable()
export class SqliteQuestionRepository implements QuestionRepository {
  private readonly client: TableClient;
  private readonly ready: Promise<void>;

  constructor() {
    this.client = getTableClient('QUESTIONS_TABLE_NAME', 'questions');
    this.ready = ensureTable(this.client);
  }

  private async ensureReady() {
    await this.ready;
  }

  async save(question: QuestionEntity): Promise<void> {
    await this.ensureReady();
    await this.client.upsertEntity({
      partitionKey: 'questions',
      rowKey: question.id,
      authorId: question.authorId,
      title: question.title,
      body: question.body,
      subject: question.subject,
      grade: question.grade,
      attachments: JSON.stringify(question.attachments),
      visibility: question.visibility,
      status: question.status,
      likeCount: question.likeCount,
      viewCount: question.viewCount,
      createdAt: question.createdAt.toISOString(),
      updatedAt: question.updatedAt.toISOString(),
    }, 'Replace');
  }

  async findById(id: string): Promise<QuestionEntity | null> {
    await this.ensureReady();
    try {
      const row = await this.client.getEntity<Record<string, unknown>>('questions', id);
      return this.mapToEntity(row);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async findByAuthorId(authorId: string): Promise<QuestionEntity[]> {
    await this.ensureReady();
    const escapedAuthorId = escapeOdataString(authorId);
    const rows = await listAllEntities<Record<string, unknown>>(
      this.client,
      `partitionKey eq 'questions' and authorId eq '${escapedAuthorId}'`,
    );

    return rows
      .map((row) => this.mapToEntity(row))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listAll(): Promise<QuestionEntity[]> {
    await this.ensureReady();
    const rows = await listAllEntities<Record<string, unknown>>(this.client, `partitionKey eq 'questions'`);
    return rows
      .map((row) => this.mapToEntity(row))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteById(id: string): Promise<void> {
    await this.ensureReady();
    try {
      await this.client.deleteEntity('questions', id);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode !== 404) {
        throw error;
      }
    }
  }

  private mapToEntity(row: any): QuestionEntity {
    return QuestionEntity.create({
      id: row.id,
      authorId: row.authorId,
      title: row.title,
      body: row.body,
      subject: row.subject,
      grade: row.grade,
      attachments: JSON.parse(row.attachments || '[]'),
      visibility: row.visibility,
      status: row.status,
      likeCount: row.likeCount,
      viewCount: row.viewCount,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    });
  }
}
