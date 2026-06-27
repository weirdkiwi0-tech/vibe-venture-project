import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { TableClient } from '@azure/data-tables';
import { randomUUID } from 'crypto';
import { AuthService } from '../auth';
import { ensureTable, escapeOdataString, getTableClient, listAllEntities } from '../db/azure-table.util';
import { CreateVideoDto } from './dto/create-video.dto';
import { VideoEntity } from './entities/video.entity';
import { VIDEO_REPOSITORY, VideoRepository } from './videos.repository';

export interface VideoCommentItem {
  id: string;
  videoId: string;
  authorId: string;
  authorVisibility: 'nickname' | 'anonymous';
  authorName: string;
  authorAvatar: string;
  authorPhotoUrl?: string;
  content: string;
  createdAt: Date;
  likeCount: number;
}

@Injectable()
export class VideosService {
  private readonly likesByVideoId = new Map<string, Set<string>>();
  private readonly commentsByVideoId = new Map<string, VideoCommentItem[]>();
  private readonly commentLikesByCommentId = new Map<string, Set<string>>();
  private readonly useTableStorage = Boolean(process.env.AZURE_TABLES_CONNECTION_STRING);
  private commentsClient?: TableClient;
  private commentLikesClient?: TableClient;
  private ready?: Promise<void>;

  constructor(
    @Inject(VIDEO_REPOSITORY)
    private readonly videoRepository: VideoRepository,
    @Optional() private readonly authService?: AuthService,
    @Optional() private readonly legacyAuthService?: AuthService,
  ) {}

  private async ensureReady() {
    if (!this.useTableStorage) {
      return;
    }

    if (!this.ready) {
      this.commentsClient = getTableClient('VIDEO_COMMENTS_TABLE_NAME', 'videocomments');
      this.commentLikesClient = getTableClient('VIDEO_COMMENT_LIKES_TABLE_NAME', 'videocommentlikes');
      this.ready = Promise.all([
        ensureTable(this.commentsClient),
        ensureTable(this.commentLikesClient),
      ]).then(() => undefined);
    }
    await this.ready;
  }

  private getAuthService(): AuthService | undefined {
    return this.authService ?? this.legacyAuthService;
  }

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
    const sorted = [...source].sort(sortByTopScore);
    return source.length >= 50 ? sorted.slice(0, 10) : sorted;
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
    await this.ensureReady();
    await this.findById(videoId);

    if (!this.useTableStorage) {
      const comments = this.commentsByVideoId.get(videoId) ?? [];
      return [...comments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    const escapedVideoId = escapeOdataString(videoId);
    const rows = await listAllEntities<Record<string, unknown>>(
      this.commentsClient!,
      `partitionKey eq 'videocomments' and videoId eq '${escapedVideoId}'`,
    );

    const comments = await Promise.all(rows.map(async (row) => {
      const commentId = String(row.rowKey ?? row.id);
      const escapedCommentId = escapeOdataString(commentId);
      const likes = await listAllEntities<Record<string, unknown>>(
        this.commentLikesClient!,
        `partitionKey eq 'videocommentlikes' and commentId eq '${escapedCommentId}'`,
      );

      return {
        id: commentId,
        videoId: String(row.videoId),
        authorId: String(row.authorId),
        authorVisibility: (String(row.authorVisibility ?? 'nickname') as 'nickname' | 'anonymous'),
        authorName: String(row.authorVisibility) === 'anonymous' ? '익명' : await this.resolveAuthorName(String(row.authorId)),
        authorAvatar: String(row.authorVisibility) === 'anonymous' ? '익' : await this.resolveAuthorAvatar(String(row.authorId)),
        authorPhotoUrl: String(row.authorVisibility) === 'anonymous' ? undefined : await this.resolveAuthorPhotoUrl(String(row.authorId)),
        content: String(row.content),
        createdAt: new Date(String(row.createdAt)),
        likeCount: likes.length,
      };
    }));

    return comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createComment(videoId: string, input: { content: string; authorVisibility?: 'nickname' | 'anonymous' }, authorId: string): Promise<VideoCommentItem> {
    await this.ensureReady();
    await this.findById(videoId);
    const content = input.content.trim();
    if (!content) {
      throw new BadRequestException('content is required');
    }

    const comment: VideoCommentItem = {
      id: randomUUID(),
      videoId,
      authorId,
      authorVisibility: input.authorVisibility ?? 'nickname',
      authorName: input.authorVisibility === 'anonymous' ? '익명' : await this.resolveAuthorName(authorId),
      authorAvatar: input.authorVisibility === 'anonymous' ? '익' : await this.resolveAuthorAvatar(authorId),
      authorPhotoUrl: input.authorVisibility === 'anonymous' ? undefined : await this.resolveAuthorPhotoUrl(authorId),
      content,
      createdAt: new Date(),
      likeCount: 0,
    };

    if (!this.useTableStorage) {
      const comments = this.commentsByVideoId.get(videoId) ?? [];
      comments.push(comment);
      this.commentsByVideoId.set(videoId, comments);
      return comment;
    }

    await this.commentsClient!.upsertEntity({
      partitionKey: 'videocomments',
      rowKey: comment.id,
      videoId: comment.videoId,
      authorId: comment.authorId,
      authorVisibility: comment.authorVisibility,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    }, 'Replace');

    return comment;
  }

  async likeComment(videoId: string, commentId: string, userId: string): Promise<{ likeCount: number; liked: boolean }> {
    await this.ensureReady();
    await this.findById(videoId);

    if (!this.useTableStorage) {
      const comments = this.commentsByVideoId.get(videoId) ?? [];
      if (!comments.some((item) => item.id === commentId)) {
        throw new NotFoundException('comment not found');
      }

      const likes = this.commentLikesByCommentId.get(commentId) ?? new Set<string>();
      if (likes.has(userId)) {
        likes.delete(userId);
        this.commentLikesByCommentId.set(commentId, likes);
        const comment = comments.find((item) => item.id === commentId);
        if (comment) {
          comment.likeCount = likes.size;
        }
        return { likeCount: likes.size, liked: false };
      }

      likes.add(userId);
      this.commentLikesByCommentId.set(commentId, likes);
      const comment = comments.find((item) => item.id === commentId);
      if (comment) {
        comment.likeCount = likes.size;
      }
      return { likeCount: likes.size, liked: true };
    }

    const comment = await this.commentsClient!.getEntity<Record<string, unknown>>('videocomments', commentId).catch(() => undefined);
    if (!comment || String(comment.videoId) !== videoId) {
      throw new NotFoundException('comment not found');
    }

    const likeRowKey = `${commentId}::${userId}`;
    const existing = await this.commentLikesClient!.getEntity('videocommentlikes', likeRowKey).catch(() => undefined);

    if (existing) {
      await this.commentLikesClient!.deleteEntity('videocommentlikes', likeRowKey).catch(() => undefined);
    } else {
      await this.commentLikesClient!.upsertEntity({
        partitionKey: 'videocommentlikes',
        rowKey: likeRowKey,
        commentId,
        userId,
        createdAt: new Date().toISOString(),
      }, 'Replace');
    }

    const escapedCommentId = escapeOdataString(commentId);
    const likes = await listAllEntities<Record<string, unknown>>(
      this.commentLikesClient!,
      `partitionKey eq 'videocommentlikes' and commentId eq '${escapedCommentId}'`,
    );
    return { likeCount: likes.length, liked: !existing };
  }

  async deleteById(id: string, requestUserId: string) {
    const video = await this.findById(id);

    const authService = this.getAuthService();
    const requester = authService ? await authService.getUserById(requestUserId) : undefined;
    const isAdmin = requester?.role === 'admin';

    if (video.uploaderId !== requestUserId && !isAdmin) {
      throw new ForbiddenException('only uploader can delete video');
    }

    await this.videoRepository.deleteById(id);

    if (!this.useTableStorage) {
      const comments = this.commentsByVideoId.get(id) ?? [];
      for (const comment of comments) {
        this.commentLikesByCommentId.delete(comment.id);
      }
      this.commentsByVideoId.delete(id);
      return;
    }

    const escapedVideoId = escapeOdataString(id);
    const comments = await listAllEntities<Record<string, unknown>>(
      this.commentsClient!,
      `partitionKey eq 'videocomments' and videoId eq '${escapedVideoId}'`,
    );

    await Promise.all(comments.map(async (comment) => {
      const commentId = String(comment.rowKey ?? comment.id);
      await this.commentsClient!.deleteEntity('videocomments', commentId).catch(() => undefined);
      const escapedCommentId = escapeOdataString(commentId);
      const likes = await listAllEntities<Record<string, unknown>>(
        this.commentLikesClient!,
        `partitionKey eq 'videocommentlikes' and commentId eq '${escapedCommentId}'`,
      );
      await Promise.all(likes.map((like) => this.commentLikesClient!.deleteEntity('videocommentlikes', String(like.rowKey ?? like.id)).catch(() => undefined)));
    }));
  }

  private shouldIncreaseViewCount(viewerId?: string): boolean {
    return true;
  }

  private async resolveAuthorName(authorId: string) {
    const authService = this.getAuthService();
    const user = authService ? await authService.getUserById(authorId) : undefined;
    return user?.displayName ?? '알 수 없음';
  }

  private async resolveAuthorAvatar(authorId: string) {
    const name = (await this.resolveAuthorName(authorId)).trim();
    return name ? name.slice(0, 1).toUpperCase() : 'U';
  }

  private async resolveAuthorPhotoUrl(authorId: string) {
    const authService = this.getAuthService();
    const user = authService ? await authService.getUserById(authorId) : undefined;
    return user?.photoUrl ?? undefined;
  }
}
