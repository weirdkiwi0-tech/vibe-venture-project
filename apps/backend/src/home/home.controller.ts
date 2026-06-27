import { Controller, Get, Headers, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth';
import { HomeService } from './home.service';

@Controller('home')
export class HomeController {
  constructor(
    private readonly homeService: HomeService,
    private readonly authService: AuthService,
  ) {}

  private async resolveViewerId(req: Request, headerUserId?: string) {
    const sessionId = req.cookies?.['keepit-session'] as string | undefined;
    const sessionUser = await this.authService.getUserBySessionId(sessionId);
    return sessionUser?.id ?? headerUserId;
  }

  @Get()
  async getHomeFeed(@Req() req: Request, @Headers('x-user-id') userIdHeader: string | undefined) {
    const viewerId = await this.resolveViewerId(req, userIdHeader);
    const { videos, questions, generatedAt } = await this.homeService.getHomeFeed(viewerId);

    return {
      feed: {
        videos: videos.map((video) => ({
          id: video.id,
          title: video.title,
          subject: video.subject,
          url: video.url,
          durationSeconds: video.durationSeconds,
          likeCount: video.likeCount,
          viewCount: video.viewCount,
          createdAt: video.createdAt.toISOString(),
        })),
        questions: questions.map(({ question, answerCount }) => ({
          id: question.id,
          title: question.title,
          body: question.body,
          subject: question.subject,
          grade: question.grade,
          attachments: question.attachments,
          visibility: question.visibility,
          status: question.status,
          likeCount: question.likeCount,
          viewCount: question.viewCount,
          createdAt: question.createdAt.toISOString(),
          updatedAt: question.updatedAt.toISOString(),
          answerCount,
        })),
      },
      metadata: {
        videoCount: videos.length,
        questionCount: questions.length,
        generatedAt,
      },
    };
  }
}