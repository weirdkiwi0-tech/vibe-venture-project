import { Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { QuestionLikeRepository } from './question-like.repository';
import { DatabaseService } from '../db/database.service';

@Injectable()
export class SqliteQuestionLikeRepository implements QuestionLikeRepository {
  constructor(private databaseService: DatabaseService) {}

  private getDb(): Database.Database {
    return this.databaseService.getDatabase();
  }

  async hasUserLiked(questionId: string, userId: string): Promise<boolean> {
    const stmt = this.getDb().prepare(
      'SELECT 1 FROM question_likes WHERE questionId = ? AND userId = ?',
    );
    const result = stmt.get(questionId, userId);
    return !!result;
  }

  async saveLike(questionId: string, userId: string): Promise<void> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    try {
      const stmt = this.getDb().prepare(`
        INSERT INTO question_likes (id, questionId, userId, createdAt)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(id, questionId, userId, createdAt);

      // Update likeCount in questions table
      const updateStmt = this.getDb().prepare(
        'UPDATE questions SET likeCount = likeCount + 1 WHERE id = ?',
      );
      updateStmt.run(questionId);
    } catch (error) {
      // Handle duplicate key error silently (user already liked)
    }
  }

  async removeLike(questionId: string, userId: string): Promise<void> {
    const stmt = this.getDb().prepare(
      'DELETE FROM question_likes WHERE questionId = ? AND userId = ?',
    );
    const result = stmt.run(questionId, userId);

    if (result.changes > 0) {
      // Update likeCount in questions table
      const updateStmt = this.getDb().prepare(
        'UPDATE questions SET likeCount = likeCount - 1 WHERE id = ?',
      );
      updateStmt.run(questionId);
    }
  }

  async countLikes(questionId: string): Promise<number> {
    const stmt = this.getDb().prepare(
      'SELECT COUNT(*) as count FROM question_likes WHERE questionId = ?',
    );
    const result = stmt.get(questionId) as any;
    return result.count;
  }
}
