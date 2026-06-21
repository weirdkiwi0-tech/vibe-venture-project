import { VideoEntity } from './entities/video.entity';

export const VIDEO_REPOSITORY = Symbol('VIDEO_REPOSITORY');

export interface VideoRepository {
  save(video: VideoEntity): Promise<void>;
  findById(id: string): Promise<VideoEntity | null>;
  listByUploaderId(uploaderId: string): Promise<VideoEntity[]>;
  listAll(): Promise<VideoEntity[]>;
  deleteById(id: string): Promise<void>;
}
