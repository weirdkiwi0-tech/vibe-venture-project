import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthService } from '../auth';
import { DatabaseService } from '../db/database.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { VideoEntity } from './entities/video.entity';
import { VIDEO_REPOSITORY, VideoRepository } from './videos.repository';

export interface VideoCommentItem {
  id: string;
  videoId: string;
  authorId: string;
  content: string;
  createdAt: Date;
}

@Injectable()
export class VideosService {
  private readonly likesByVideoId = new Map<string, Set<string>>();

  constructor(
    @Inject(VIDEO_REPOSITORY)
    private readonly videoRepository: VideoRepository,
    @Optional() private readonly databaseService?: DatabaseService,
    @Optional() private readonly authService?: AuthService,
  ) {}

  async create(input: CreateVideoDto, uploaderId = 'anonymous-user') {
    const video = VideoEntity.create({
      id: randomUUID(),
      uploaderId,
      title: input.title,
      subject: input.subject,
      url: input.url,
      durationSeconds: input.durationSeconds,
    });

    await this.videoRepository.save(video);
    return video;
  }

  async listHomeTopVideos() {
    const videos = await this.videoRepository.listAll();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const todayVideos = videos.filter(
      (video) => video.createdAt >= startOfToday && video.createdAt < endOfToday,
    );

    const sortByTopScore = (left: (typeof videos)[number], right: (typeof videos)[number]) => {
      const scoreDiff = (right.likeCount + right.viewCount) - (left.likeCount + left.viewCount);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      if (right.likeCount !== left.likeCount) {
        return right.likeCount - left.likeCount;
      }

      if (right.viewCount !== left.viewCount) {
        return right.viewCount - left.viewCount;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    };

    const source = todayVideos.length > 0 ? todayVideos : videos;
    return [...source].sort(sortByTopScore).slice(0, 3);
  }

  async listAllVideos(search = '', subject = '', sort: 'latest' | 'popular' = 'latest') {
    const videos = await this.videoRepository.listAll();
    const keyword = search.trim().toLowerCase();
    const normalizedSubject = subject.trim().toLowerCase();

    const filtered = videos.filter((video) => {
      if (keyword && !video.title.toLowerCase().includes(keyword)) {
        return false;
      }

      if (normalizedSubject && normalizedSubject !== '전체' && video.subject.toLowerCase() !== normalizedSubject) {
        return false;
      }

      return true;
    });

    if (sort === 'popular') {
      return [...filtered].sort((a, b) => {
        const scoreDiff = (b.likeCount + b.viewCount) - (a.likeCount + a.viewCount);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    }

    return [...filtered].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findById(id: string) {
    const video = await this.videoRepository.findById(id);
    if (!video) {
      throw new NotFoundException('video not found');
    }

    return video;
  }

  async like(id: string, userId: string) {
    const video = await this.videoRepository.findById(id);
    if (!video) {
      throw new NotFoundException('video not found');
    }

    const likes = this.likesByVideoId.get(id) ?? new Set<string>();
    if (likes.has(userId)) {
      likes.delete(userId);
      this.likesByVideoId.set(id, likes);
      const unliked = video.unlike();
      await this.videoRepository.save(unliked);
      return { video: unliked, liked: false };
    }

    likes.add(userId);
    this.likesByVideoId.set(id, likes);
    const liked = video.like();
    await this.videoRepository.save(liked);
    return { video: liked, liked: true };
  }

  async incrementView(id: string, viewerId?: string) {
    const video = await this.findById(id);

    const shouldIncreaseView = this.shouldIncreaseViewCount(viewerId);
    if (!shouldIncreaseView) {
      return video;
    }

    const viewed = video.view();
    await this.videoRepository.save(viewed);
    return viewed;
  }

  async getPlaybackPolicy(
    id: string,
    viewerType: 'guest' | 'member',
    positionPercent: number,
  ) {
    const video = await this.videoRepository.findById(id);
    if (!video) {
      throw new NotFoundException('video not found');
    }

    if (viewerType === 'guest') {
      return {
        videoId: video.id,
        canPlay: positionPercent < 50,
        stopAtPercent: 50,
        action: positionPercent < 50 ? 'none' : 'login_required',
      };
    }

    return {
      videoId: video.id,
      canPlay: true,
      stopAtPercent: 100,
      action: 'none',
    };
  }

  async listByUploaderId(uploaderId: string) {
    const videos = await this.videoRepository.listByUploaderId(uploaderId);
    return videos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listComments(videoId: string): Promise<VideoCommentItem[]> {
    await this.findById(videoId);
    const db = this.databaseService?.getDatabase();
    if (!db) {
      return [];
    }

    const rows = db
      .prepare('SELECT id, videoId, authorId, content, createdAt FROM video_comments WHERE videoId = ? ORDER BY createdAt ASC')
      .all(videoId) as Array<{ id: string; videoId: string; authorId: string; content: string; createdAt: string }>;

    return rows.map((row) => ({
      id: row.id,
      videoId: row.videoId,
      authorId: row.authorId,
      content: row.content,
      createdAt: new Date(row.createdAt),
    }));
  }

  async createComment(videoId: string, input: { content: string }, authorId: string): Promise<VideoCommentItem> {
    await this.findById(videoId);
    const content = input.content.trim();
    if (!content) {
      throw new BadRequestException('content is required');
    }

    const db = this.databaseService?.getDatabase();
    if (!db) {
      throw new BadRequestException('database unavailable');
    }

    const comment: VideoCommentItem = {
      id: randomUUID(),
      videoId,
      authorId,
      content,
      createdAt: new Date(),
    };

    db.prepare(
      'INSERT INTO video_comments (id, videoId, authorId, content, createdAt) VALUES (?, ?, ?, ?, ?)',
    ).run(comment.id, comment.videoId, comment.authorId, comment.content, comment.createdAt.toISOString());

    return comment;
  }

  async deleteById(id: string, requestUserId: string) {
    const video = await this.findById(id);

    const requester = this.authService?.getUserById(requestUserId);
    const isAdmin = requester?.role === 'admin';

    if (video.uploaderId !== requestUserId && !isAdmin) {
      throw new ForbiddenException('only uploader can delete video');
    }

    await this.videoRepository.deleteById(id);

    const db = this.databaseService?.getDatabase();
    if (db) {
      db.prepare('DELETE FROM video_comments WHERE videoId = ?').run(id);
    }
  }

  private shouldIncreaseViewCount(viewerId?: string): boolean {
    if (!viewerId || viewerId === 'anonymous-user') {
      return false;
    }

    if (!this.authService) {
      return true;
    }

    return Boolean(this.authService.getUserById(viewerId));
  }
}
