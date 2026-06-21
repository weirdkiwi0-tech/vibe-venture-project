import { Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';
import { AnswerEntity } from './entities/answer.entity';
import { AnswerRepository } from './answers.repository';
import { DatabaseService } from '../db/database.service';

@Injectable()
export class SqliteAnswerRepository implements AnswerRepository {
  constructor(private databaseService: DatabaseService) {}

  private getDb(): Database.Database {
    return this.databaseService.getDatabase();
  }

  async save(answer: AnswerEntity): Promise<void> {
    const stmt = this.getDb().prepare(`
      INSERT OR REPLACE INTO answers (
        id, questionId, authorId, type, content, attachments, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      answer.id,
      answer.questionId,
      answer.authorId,
      answer.type,
      answer.content,
      JSON.stringify(answer.attachments),
      answer.createdAt.toISOString(),
    );
  }

  async findById(id: string): Promise<AnswerEntity | null> {
    const stmt = this.getDb().prepare('SELECT * FROM answers WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.mapToEntity(row);
  }

  async findByQuestionId(questionId: string): Promise<AnswerEntity[]> {
    const stmt = this.getDb().prepare('SELECT * FROM answers WHERE questionId = ? ORDER BY createdAt ASC');
    const rows = stmt.all(questionId) as any[];

    return rows.map((row) => this.mapToEntity(row));
  }

  async findByAuthorId(authorId: string): Promise<AnswerEntity[]> {
    const stmt = this.getDb().prepare('SELECT * FROM answers WHERE authorId = ? ORDER BY createdAt DESC');
    const rows = stmt.all(authorId) as any[];

    return rows.map((row) => this.mapToEntity(row));
  }

  async deleteById(id: string): Promise<void> {
    const db = this.getDb();
    const tx = db.transaction((answerId: string) => {
      db.prepare('DELETE FROM answer_likes WHERE answerId = ?').run(answerId);
      db.prepare('DELETE FROM comments WHERE answerId = ?').run(answerId);
      db.prepare('DELETE FROM answers WHERE id = ?').run(answerId);
    });

    tx(id);
  }

  async deleteByQuestionId(questionId: string): Promise<void> {
    const db = this.getDb();
    const tx = db.transaction((targetQuestionId: string) => {
      db.prepare(
        'DELETE FROM answer_likes WHERE answerId IN (SELECT id FROM answers WHERE questionId = ?)',
      ).run(targetQuestionId);
      db.prepare(
        'DELETE FROM comments WHERE answerId IN (SELECT id FROM answers WHERE questionId = ?)',
      ).run(targetQuestionId);
      db.prepare('DELETE FROM answers WHERE questionId = ?').run(targetQuestionId);
    });

    tx(questionId);
  }

  async countByQuestionId(questionId: string): Promise<number> {
    const stmt = this.getDb().prepare(
      'SELECT COUNT(*) as count FROM answers WHERE questionId = ?',
    );
    const result = stmt.get(questionId) as any;
    return result.count;
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
