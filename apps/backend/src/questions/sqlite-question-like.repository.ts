import { Injectable } from '@nestjs/common';
import { TableClient } from '@azure/data-tables';
import { QuestionLikeRepository } from './question-like.repository';
import { ensureTable, escapeOdataString, getTableClient, listAllEntities } from '../db/azure-table.util';

@Injectable()
export class SqliteQuestionLikeRepository implements QuestionLikeRepository {
  private readonly client: TableClient;
  private readonly ready: Promise<void>;

  constructor() {
    this.client = getTableClient('QUESTION_LIKES_TABLE_NAME', 'questionlikes');
    this.ready = ensureTable(this.client);
  }

  private async ensureReady() {
    await this.ready;
  }

  private getRowKey(questionId: string, userId: string): string {
    return `${questionId}::${userId}`;
  }

  async hasUserLiked(questionId: string, userId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      await this.client.getEntity('questionlikes', this.getRowKey(questionId, userId));
      return true;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async saveLike(questionId: string, userId: string): Promise<void> {
    await this.ensureReady();
    await this.client.upsertEntity({
      partitionKey: 'questionlikes',
      rowKey: this.getRowKey(questionId, userId),
      questionId,
      userId,
      createdAt: new Date().toISOString(),
    }, 'Merge');
  }

  async removeLike(questionId: string, userId: string): Promise<void> {
    await this.ensureReady();
    try {
      await this.client.deleteEntity('questionlikes', this.getRowKey(questionId, userId));
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode !== 404) {
        throw error;
      }
    }
  }

  async countLikes(questionId: string): Promise<number> {
    await this.ensureReady();
    const escapedQuestionId = escapeOdataString(questionId);
    const rows = await listAllEntities<Record<string, unknown>>(
      this.client,
      `partitionKey eq 'questionlikes' and questionId eq '${escapedQuestionId}'`,
    );
    return rows.length;
  }
}
