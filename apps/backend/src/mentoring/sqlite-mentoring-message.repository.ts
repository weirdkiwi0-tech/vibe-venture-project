import { Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';
import { MentoringMessageEntity } from './entities/mentoring-message.entity';
import { MentoringMessageRepository } from './mentoring-message.repository';
import { DatabaseService } from '../db/database.service';

@Injectable()
export class SqliteMentoringMessageRepository
  implements MentoringMessageRepository
{
  constructor(private databaseService: DatabaseService) {}

  private getDb(): Database.Database {
    return this.databaseService.getDatabase();
  }

  async save(message: MentoringMessageEntity): Promise<void> {
    const stmt = this.getDb().prepare(`
      INSERT OR REPLACE INTO mentoring_messages (
        id, sessionId, authorId, content, createdAt
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.sessionId,
      message.sender, // Using sender as authorId for now
      message.content,
      message.createdAt.toISOString(),
    );
  }

  async findById(id: string): Promise<MentoringMessageEntity | null> {
    const stmt = this.getDb().prepare('SELECT * FROM mentoring_messages WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.mapToEntity(row);
  }

  async findBySessionId(sessionId: string): Promise<MentoringMessageEntity[]> {
    const stmt = this.getDb().prepare(
      'SELECT * FROM mentoring_messages WHERE sessionId = ? ORDER BY createdAt ASC',
    );
    const rows = stmt.all(sessionId) as any[];

    return rows.map((row) => this.mapToEntity(row));
  }

  async deleteById(id: string): Promise<void> {
    const stmt = this.getDb().prepare('DELETE FROM mentoring_messages WHERE id = ?');
    stmt.run(id);
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    const stmt = this.getDb().prepare('DELETE FROM mentoring_messages WHERE sessionId = ?');
    stmt.run(sessionId);
  }

  private mapToEntity(row: any): MentoringMessageEntity {
    return MentoringMessageEntity.create({
      id: row.id,
      sessionId: row.sessionId,
      sender: row.authorId as 'learner' | 'mentor',
      content: row.content,
      createdAt: new Date(row.createdAt),
    });
  }
}
