import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { AnswersService, type AnswerCommentNode, type AnswerWithMeta } from './answers.service';
import { CreateAnswerCommentDto } from './dto/create-answer-comment.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { QuestionsService } from './questions.service';
import type { QuestionEntity } from './entities/question.entity';
import type { AnswerEntity } from './entities/answer.entity';

type QuestionWithAnswerCount = {
  question: QuestionEntity;
  answerCount: number;
};

@Controller('questions')
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
    private readonly answersService: AnswersService,
    private readonly authService: AuthService,
  ) {}

  private async resolveViewerId(req: Request, headerUserId?: string) {
    const sessionId = req.cookies?.['keepit-session'] as string | undefined;
    const sessionUser = await this.authService.getUserBySessionId(sessionId);
    if (sessionUser) {
      return sessionUser.id;
    }

    if (!headerUserId) {
      return undefined;
    }

    const headerUser = await this.authService.getUserById(headerUserId);
    return headerUser?.id ?? headerUserId;
  }

  private mapQuestionItem({ question, answerCount }: QuestionWithAnswerCount) {
    return {
      id: question.id,
      authorId: question.authorId,
      title: question.title,
      body: question.body,
      subject: question.subject,
      grade: question.grade,
      attachments: question.attachments,
      visibility: question.visibility,
      status: question.status,
      createdAt: question.createdAt.toISOString(),
      updatedAt: question.updatedAt.toISOString(),
      likeCount: question.likeCount,
      viewCount: question.viewCount,
      answerCount,
    };
  }

  private mapAnswerComment(comment: AnswerCommentNode): {
    id: string;
    answerId: string;
    authorId: string;
    authorVisibility: 'public' | 'anonymous';
    authorName: string;
    content: string;
    attachments: string[];
    parentCommentId: string | null;
    createdAt: string;
    likeCount: number;
    replies: ReturnType<QuestionsController['mapAnswerComment']>[];
  } {
    return {
      id: comment.id,
      answerId: comment.answerId,
      authorId: comment.authorVisibility === 'anonymous' ? 'anonymous' : comment.authorId,
      authorVisibility: comment.authorVisibility,
      authorName: comment.authorName,
      content: comment.content,
      attachments: comment.attachments,
      parentCommentId: comment.parentCommentId,
      createdAt: comment.createdAt.toISOString(),
      likeCount: comment.likeCount,
      replies: comment.replies.map((reply) => this.mapAnswerComment(reply)),
    };
  }

  private mapAnswerItem(answer: AnswerEntity, meta?: { likeCount?: number; comments?: AnswerCommentNode[] }) {
    return {
      id: answer.id,
      authorId: answer.authorId,
      questionId: answer.questionId,
      type: answer.type,
      content: answer.content,
      attachments: answer.attachments,
      createdAt: answer.createdAt.toISOString(),
      likeCount: meta?.likeCount ?? 0,
      comments: (meta?.comments ?? []).map((comment) => this.mapAnswerComment(comment)),
    };
  }

  @Get()
  async listTopQuestions(
    @Req() req: Request,
    @Headers('x-user-id') userIdHeader: string | undefined,
    @Query() query: { subject?: string; grade?: string; title?: string },
  ) {
    const viewerId = await this.resolveViewerId(req, userIdHeader);
    const items = await this.questionsService.listTopQuestions(undefined, {
      subject: query.subject,
      grade: query.grade,
      title: query.title,
    }, viewerId);
    return items.map((item) => this.mapQuestionItem(item));
  }

  @Get('all')
  async listAllQuestions(
    @Req() req: Request,
    @Headers('x-user-id') userIdHeader: string | undefined,
    @Query() query: { subject?: string; grade?: string; title?: string },
  ) {
    const viewerId = await this.resolveViewerId(req, userIdHeader);
    const items = await this.questionsService.listAllQuestions({
      subject: query.subject,
      grade: query.grade,
      title: query.title,
    }, viewerId);
    return items.map((item) => this.mapQuestionItem(item));
  }

  @Get('mine')
  async listMyQuestions(@Headers('x-user-id') authorId?: string) {
    const items = await this.questionsService.listByAuthorId(authorId ?? 'anonymous-user');
    return items.map((item) => this.mapQuestionItem(item));
  }

  @Get('mine/answers')
  async listMyAnswers(@Headers('x-user-id') authorId?: string) {
    const answers = await this.answersService.findByAuthorId(authorId ?? 'anonymous-user');
    return answers.map((answer) => this.mapAnswerItem(answer));
  }

  @Post()
  async create(@Body() body: CreateQuestionDto, @Headers('x-user-id') authorId?: string) {
    const question = await this.questionsService.create(body, authorId);
    return {
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
    };
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @Req() req: Request,
    @Headers('x-user-id') userIdHeader: string | undefined,
  ) {
    const viewerId = await this.resolveViewerId(req, userIdHeader);
    return this.mapQuestionItem(await this.questionsService.findById(id, viewerId));
  }

  @Patch(':id/solve')
  async solve(
    @Param('id') id: string,
    @Req() req: Request,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const requestUserId = (await this.resolveViewerId(req, userIdHeader)) ?? 'anonymous-user';
    return this.mapQuestionItem(await this.questionsService.solve(id, requestUserId));
  }

  @Post(':id/like')
  async like(@Param('id') id: string, @Req() req: Request) {
    const sessionId = req.cookies?.['keepit-session'] as string | undefined;
    const user = await this.authService.getUserBySessionId(sessionId);
    if (!user) {
      throw new UnauthorizedException('login required to like question');
    }

    const { liked, ...questionItem } = await this.questionsService.like(id, user.id);
    return { ...this.mapQuestionItem(questionItem), liked };
  }

  @Post(':id/answers')
  async createAnswer(
    @Param('id') id: string,
    @Body() body: CreateAnswerDto,
    @Headers('x-user-id') authorId?: string,
  ) {
    const answer = await this.answersService.create(id, body, authorId);
    return this.mapAnswerItem(answer, { likeCount: 0, comments: [] });
  }

  @Get(':id/answers')
  async listAnswers(@Param('id') id: string) {
    const answers = await this.answersService.findByQuestionIdWithMeta(id);
    return answers.map((item: AnswerWithMeta) =>
      this.mapAnswerItem(item.answer, {
        likeCount: item.likeCount,
        comments: item.comments,
      }),
    );
  }

  @Post('answers/:answerId/like')
  async likeAnswer(
    @Param('answerId') answerId: string,
    @Headers('x-user-id') userId?: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException('login required to like answer');
    }

    return this.answersService.like(answerId, userId);
  }

  @Get('answers/:answerId/comments')
  async listAnswerComments(@Param('answerId') answerId: string) {
    const comments = await this.answersService.listComments(answerId);
    return comments.map((comment) => this.mapAnswerComment(comment));
  }

  @Post('answers/:answerId/comments')
  async createAnswerComment(
    @Param('answerId') answerId: string,
    @Body() body: CreateAnswerCommentDto,
    @Headers('x-user-id') userId?: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException('login required to comment');
    }

    const comment = await this.answersService.createComment(answerId, body, userId);
    return this.mapAnswerComment(comment);
  }

  @Post('answers/:answerId/comments/:commentId/like')
  async likeAnswerComment(
    @Param('answerId') answerId: string,
    @Param('commentId') commentId: string,
    @Headers('x-user-id') userId?: string,
  ) {
    if (!userId) {
      throw new UnauthorizedException('login required to like comment');
    }

    return this.answersService.likeComment(answerId, commentId, userId);
  }

  @Delete(':id')
  async deleteQuestion(
    @Param('id') id: string,
    @Req() req: Request,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const requestUserId = (await this.resolveViewerId(req, userIdHeader)) ?? 'anonymous-user';
    await this.questionsService.deleteById(id, requestUserId);
    return { success: true };
  }

  @Delete('answers/:answerId')
  async deleteAnswer(
    @Param('answerId') answerId: string,
    @Req() req: Request,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const requestUserId = (await this.resolveViewerId(req, userIdHeader)) ?? 'anonymous-user';
    await this.answersService.deleteById(answerId, requestUserId);
    return { success: true };
  }
}
