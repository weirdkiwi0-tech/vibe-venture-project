import { Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';
import { QuestionEntity } from './entities/question.entity';
import { QuestionRepository } from './questions.repository';
import { DatabaseService } from '../db/database.service';

@Injectable()
export class SqliteQuestionRepository implements QuestionRepository {
  constructor(private databaseService: DatabaseService) {}

  private getDb(): Database.Database {
    return this.databaseService.getDatabase();
  }

  async save(question: QuestionEntity): Promise<void> {
    const stmt = this.getDb().prepare(`
      INSERT OR REPLACE INTO questions (
        id, authorId, title, body, subject, grade, attachments,
        visibility, status, likeCount, viewCount, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      question.id,
      question.authorId,
      question.title,
      question.body,
      question.subject,
      question.grade,
      JSON.stringify(question.attachments),
      question.visibility,
      question.status,
      question.likeCount,
      question.viewCount,
      question.createdAt.toISOString(),
      question.updatedAt.toISOString(),
    );
  }

  async findById(id: string): Promise<QuestionEntity | null> {
    const stmt = this.getDb().prepare('SELECT * FROM questions WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.mapToEntity(row);
  }

  async findByAuthorId(authorId: string): Promise<QuestionEntity[]> {
    const stmt = this.getDb().prepare('SELECT * FROM questions WHERE authorId = ? ORDER BY createdAt DESC');
    const rows = stmt.all(authorId) as any[];

    return rows.map((row) => this.mapToEntity(row));
  }

  async listAll(): Promise<QuestionEntity[]> {
    const stmt = this.getDb().prepare('SELECT * FROM questions ORDER BY createdAt DESC');
    const rows = stmt.all() as any[];

    return rows.map((row) => this.mapToEntity(row));
  }

  async deleteById(id: string): Promise<void> {
    const db = this.getDb();
    const tx = db.transaction((questionId: string) => {
      db.prepare('DELETE FROM question_likes WHERE questionId = ?').run(questionId);
      db.prepare('DELETE FROM questions WHERE id = ?').run(questionId);
    });

    tx(id);
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
