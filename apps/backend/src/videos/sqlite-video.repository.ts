import { Injectable } from '@nestjs/common';
import { TableClient } from '@azure/data-tables';
import { VideoEntity } from './entities/video.entity';
import { VideoRepository } from './videos.repository';
import { ensureTable, escapeOdataString, getTableClient, listAllEntities } from '../db/azure-table.util';

@Injectable()
export class SqliteVideoRepository implements VideoRepository {
  private readonly client: TableClient;
  private readonly ready: Promise<void>;

  constructor() {
    this.client = getTableClient('VIDEOS_TABLE_NAME', 'videos');
    this.ready = ensureTable(this.client);
  }

  private async ensureReady() {
    await this.ready;
  }

  async save(video: VideoEntity): Promise<void> {
    await this.ensureReady();
    await this.client.upsertEntity({
      partitionKey: 'videos',
      rowKey: video.id,
      uploaderId: video.uploaderId,
      title: video.title,
      subject: video.subject,
      url: video.url,
      durationSeconds: video.durationSeconds,
      likeCount: video.likeCount,
      viewCount: video.viewCount,
      createdAt: video.createdAt.toISOString(),
    }, 'Replace');
  }

  async findById(id: string): Promise<VideoEntity | null> {
    await this.ensureReady();
    try {
      const row = await this.client.getEntity<Record<string, unknown>>('videos', id);
      return this.mapToEntity(row);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async listByUploaderId(uploaderId: string): Promise<VideoEntity[]> {
    await this.ensureReady();
    const escapedUploaderId = escapeOdataString(uploaderId);
    const rows = await listAllEntities<Record<string, unknown>>(
      this.client,
      `partitionKey eq 'videos' and uploaderId eq '${escapedUploaderId}'`,
    );

    return rows
      .map((row) => this.mapToEntity(row))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listAll(): Promise<VideoEntity[]> {
    await this.ensureReady();
    const rows = await listAllEntities<Record<string, unknown>>(this.client, `partitionKey eq 'videos'`);
    return rows
      .map((row) => this.mapToEntity(row))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteById(id: string): Promise<void> {
    await this.ensureReady();
    try {
      await this.client.deleteEntity('videos', id);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode !== 404) {
        throw error;
      }
    }
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
