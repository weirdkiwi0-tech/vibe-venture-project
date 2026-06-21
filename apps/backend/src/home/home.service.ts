import { Injectable } from '@nestjs/common';
import { QuestionsService } from '../questions/questions.service';
import { VideosService } from '../videos/videos.service';

export interface HomeFeedQuestionItem {
  question: {
    id: string;
    title: string;
    body: string;
    subject: string;
    grade: string;
    attachments: string[];
    visibility: 'anonymous' | 'nickname';
    status: 'open' | 'solved';
    likeCount: number;
    viewCount: number;
    createdAt: Date;
    updatedAt: Date;
  };
  answerCount: number;
}

export interface HomeFeedResult {
  videos: Awaited<ReturnType<VideosService['listHomeTopVideos']>>;
  questions: HomeFeedQuestionItem[];
  generatedAt: string;
}

@Injectable()
export class HomeService {
  constructor(
    private readonly questionsService: QuestionsService,
    private readonly videosService: VideosService,
  ) {}

  async getHomeFeed(viewerId?: string): Promise<HomeFeedResult> {
    const [videos, questions] = await Promise.all([
      this.videosService.listHomeTopVideos(),
      this.questionsService.listTopQuestions(10, undefined, viewerId),
    ]);

    return {
      videos,
      questions,
      generatedAt: new Date().toISOString(),
    };
  }
}