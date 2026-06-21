import { Injectable } from '@nestjs/common';
import { VideoEntity } from './entities/video.entity';
import { VideoRepository } from './videos.repository';

@Injectable()
export class InMemoryVideoRepository implements VideoRepository {
  private readonly store = new Map<string, VideoEntity>();

  async save(video: VideoEntity): Promise<void> {
    this.store.set(video.id, video);
  }

  async findById(id: string): Promise<VideoEntity | null> {
    return this.store.get(id) ?? null;
  }

  async listByUploaderId(uploaderId: string): Promise<VideoEntity[]> {
    return Array.from(this.store.values()).filter((video) => video.uploaderId === uploaderId);
  }

  async listAll(): Promise<VideoEntity[]> {
    return Array.from(this.store.values());
  }

  async deleteById(id: string): Promise<void> {
    this.store.delete(id);
  }
}
