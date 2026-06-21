import { Body, Controller, Delete, Get, Headers, Param, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth';
import { CreateVideoCommentDto } from './dto/create-video-comment.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { PlaybackPolicyQueryDto } from './dto/playback-policy-query.dto';
import { VideosService } from './videos.service';

@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly authService: AuthService,
  ) {}

  private resolveAuthenticatedUserId(req: Request, headerUserId?: string) {
    const sessionId = req.cookies?.['keepit-session'] as string | undefined;
    const sessionUser = this.authService.getUserBySessionId(sessionId);
    if (sessionUser) {
      return sessionUser.id;
    }

    if (!headerUserId) {
      return undefined;
    }

    const headerUser = this.authService.getUserById(headerUserId);
    return headerUser?.id;
  }

  private resolveViewerId(req: Request, headerUserId?: string) {
    const sessionId = req.cookies?.['keepit-session'] as string | undefined;
    const sessionUser = this.authService.getUserBySessionId(sessionId);
    return sessionUser?.id ?? headerUserId;
  }

  @Post()
  async create(@Body() body: CreateVideoDto, @Headers('x-user-id') uploaderId?: string) {
    const video = await this.videosService.create(body, uploaderId);
    return {
      id: video.id,
      title: video.title,
      subject: video.subject,
      url: video.url,
      durationSeconds: video.durationSeconds,
      likeCount: video.likeCount,
      viewCount: video.viewCount,
      createdAt: video.createdAt.toISOString(),
    };
  }

  @Get('home-top')
  async listHomeTopVideos() {
    const videos = await this.videosService.listHomeTopVideos();
    return videos.map((video) => ({
      id: video.id,
      title: video.title,
      subject: video.subject,
      url: video.url,
      durationSeconds: video.durationSeconds,
      likeCount: video.likeCount,
      viewCount: video.viewCount,
      createdAt: video.createdAt.toISOString(),
    }));
  }

  @Get()
  async listAllVideos(
    @Query('q') query?: string,
    @Query('subject') subject?: string,
    @Query('sort') sort?: 'latest' | 'popular',
  ) {
    const videos = await this.videosService.listAllVideos(query ?? '', subject ?? '', sort ?? 'latest');
    return videos.map((video) => ({
      id: video.id,
      title: video.title,
      subject: video.subject,
      url: video.url,
      durationSeconds: video.durationSeconds,
      likeCount: video.likeCount,
      viewCount: video.viewCount,
      createdAt: video.createdAt.toISOString(),
    }));
  }

  @Get('mine')
  async listMyVideos(@Headers('x-user-id') uploaderId?: string) {
    const videos = await this.videosService.listByUploaderId(uploaderId ?? 'anonymous-user');
    return videos.map((video) => ({
      id: video.id,
      title: video.title,
      subject: video.subject,
      url: video.url,
      durationSeconds: video.durationSeconds,
      likeCount: video.likeCount,
      viewCount: video.viewCount,
      createdAt: video.createdAt.toISOString(),
    }));
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const video = await this.videosService.findById(id);
    return {
      id: video.id,
      title: video.title,
      subject: video.subject,
      url: video.url,
      durationSeconds: video.durationSeconds,
      likeCount: video.likeCount,
      viewCount: video.viewCount,
      createdAt: video.createdAt.toISOString(),
    };
  }

  @Post(':id/like')
  async likeVideo(@Param('id') id: string, @Headers('x-user-id') userId?: string) {
    const result = await this.videosService.like(id, userId ?? 'anonymous-user');
    return {
      id: result.video.id,
      likeCount: result.video.likeCount,
      viewCount: result.video.viewCount,
      liked: result.liked,
    };
  }

  @Post(':id/view')
  async viewVideo(
    @Param('id') id: string,
    @Req() req: Request,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const viewerId = this.resolveAuthenticatedUserId(req, userIdHeader);
    const video = await this.videosService.incrementView(id, viewerId);
    return {
      id: video.id,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
    };
  }

  @Get(':id/comments')
  async listComments(@Param('id') id: string) {
    const comments = await this.videosService.listComments(id);
    return comments.map((comment) => ({
      id: comment.id,
      videoId: comment.videoId,
      authorId: comment.authorId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    }));
  }

  @Post(':id/comments')
  async createComment(
    @Param('id') id: string,
    @Body() body: CreateVideoCommentDto,
    @Req() req: Request,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.resolveViewerId(req, userIdHeader);
    if (!userId) {
      throw new UnauthorizedException('login required to comment');
    }

    const comment = await this.videosService.createComment(id, { content: body.content }, userId);
    return {
      id: comment.id,
      videoId: comment.videoId,
      authorId: comment.authorId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  @Get(':id/playback-policy')
  async getPlaybackPolicy(
    @Param('id') id: string,
    @Query() query: PlaybackPolicyQueryDto,
  ) {
    return this.videosService.getPlaybackPolicy(
      id,
      query.viewerType,
      query.positionPercent,
    );
  }

  @Delete(':id')
  async deleteVideo(
    @Param('id') id: string,
    @Req() req: Request,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const requestUserId = this.resolveViewerId(req, userIdHeader) ?? 'anonymous-user';
    await this.videosService.deleteById(id, requestUserId);
    return { success: true };
  }
}
