import { Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';
import { MentoringSessionEntity } from './entities/mentoring-session.entity';
import { MentoringSessionRepository } from './mentoring-session.repository';
import { DatabaseService } from '../db/database.service';

@Injectable()
export class SqliteMentoringSessionRepository
  implements MentoringSessionRepository
{
  constructor(private databaseService: DatabaseService) {}

  private getDb(): Database.Database {
    return this.databaseService.getDatabase();
  }

  async save(session: MentoringSessionEntity): Promise<void> {
    const stmt = this.getDb().prepare(`
      INSERT OR REPLACE INTO mentoring_sessions (
        id, studentId, mentorId, channelId, question, startedAt, slaDeadline,
        firstResponseAt, status, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.learnerId,
      '', // mentorId - not in entity
      '', // channelId - not in entity
      session.question,
      session.createdAt.toISOString(),
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h SLA
      session.firstMentorResponseAt?.toISOString() || null,
      'active',
      session.createdAt.toISOString(),
    );
  }

  async findById(id: string): Promise<MentoringSessionEntity | null> {
    const stmt = this.getDb().prepare('SELECT * FROM mentoring_sessions WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.mapToEntity(row);
  }

  async findByLearnerId(learnerId: string): Promise<MentoringSessionEntity[]> {
    const stmt = this.getDb().prepare(
      'SELECT * FROM mentoring_sessions WHERE studentId = ? ORDER BY createdAt DESC',
    );
    const rows = stmt.all(learnerId) as any[];

    return rows.map((row) => this.mapToEntity(row));
  }

  async listAll(): Promise<MentoringSessionEntity[]> {
    const stmt = this.getDb().prepare(
      'SELECT * FROM mentoring_sessions ORDER BY createdAt DESC',
    );
    const rows = stmt.all() as any[];

    return rows.map((row) => this.mapToEntity(row));
  }

  async deleteById(id: string): Promise<void> {
    const stmt = this.getDb().prepare('DELETE FROM mentoring_sessions WHERE id = ?');
    stmt.run(id);
  }

  private mapToEntity(row: any): MentoringSessionEntity {
    return MentoringSessionEntity.create({
      id: row.id,
      learnerId: row.studentId,
      question: row.question,
      createdAt: new Date(row.createdAt),
      firstMentorResponseAt: row.firstResponseAt ? new Date(row.firstResponseAt) : null,
    });
  }
}
