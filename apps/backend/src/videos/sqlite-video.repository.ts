import { Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';
import { VideoEntity } from './entities/video.entity';
import { VideoRepository } from './videos.repository';
import { DatabaseService } from '../db/database.service';

@Injectable()
export class SqliteVideoRepository implements VideoRepository {
  constructor(private databaseService: DatabaseService) {}

  private getDb(): Database.Database {
    return this.databaseService.getDatabase();
  }

  async save(video: VideoEntity): Promise<void> {
    const stmt = this.getDb().prepare(`
      INSERT OR REPLACE INTO videos (
        id, uploaderId, title, subject, url, durationSeconds,
        likeCount, viewCount, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      video.id,
      video.uploaderId,
      video.title,
      video.subject,
      video.url,
      video.durationSeconds,
      video.likeCount,
      video.viewCount,
      video.createdAt.toISOString(),
    );
  }

  async findById(id: string): Promise<VideoEntity | null> {
    const stmt = this.getDb().prepare('SELECT * FROM videos WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.mapToEntity(row);
  }

  async listByUploaderId(uploaderId: string): Promise<VideoEntity[]> {
    const stmt = this.getDb().prepare(
      'SELECT * FROM videos WHERE uploaderId = ? ORDER BY createdAt DESC',
    );
    const rows = stmt.all(uploaderId) as any[];

    return rows.map((row) => this.mapToEntity(row));
  }

  async listAll(): Promise<VideoEntity[]> {
    const stmt = this.getDb().prepare('SELECT * FROM videos ORDER BY createdAt DESC');
    const rows = stmt.all() as any[];

    return rows.map((row) => this.mapToEntity(row));
  }

  async deleteById(id: string): Promise<void> {
    const db = this.getDb();
    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM video_comments WHERE videoId = ?').run(id);
      db.prepare('DELETE FROM videos WHERE id = ?').run(id);
    });
    deleteTx();
  }

  private mapToEntity(row: any): VideoEntity {
    return VideoEntity.create({
      id: row.id,
      uploaderId: row.uploaderId,
      title: row.title,
      subject: row.subject,
      url: row.url,
      durationSeconds: row.durationSeconds,
      likeCount: row.likeCount,
      viewCount: row.viewCount,
      createdAt: new Date(row.createdAt),
    });
  }
}
