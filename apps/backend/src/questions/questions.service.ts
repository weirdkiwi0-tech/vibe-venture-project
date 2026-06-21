import { ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthService } from '../auth';
import { ReportsService } from '../reports/reports.service';
import { ANSWER_REPOSITORY, AnswerRepository } from './answers.repository';
import { CreateQuestionDto } from './dto/create-question.dto';
import { QuestionEntity } from './entities/question.entity';
import { QUESTION_LIKE_REPOSITORY, QuestionLikeRepository } from './question-like.repository';
import { QUESTION_REPOSITORY, QuestionRepository } from './questions.repository';

type QuestionFilters = { subject?: string; grade?: string; title?: string };
type QuestionWithAnswerCount = { question: QuestionEntity; answerCount: number };

@Injectable()
export class QuestionsService {
  constructor(
    @Inject(QUESTION_REPOSITORY)
    private readonly questionRepository: QuestionRepository,
    @Inject(ANSWER_REPOSITORY)
    private readonly answerRepository: AnswerRepository,
    @Inject(QUESTION_LIKE_REPOSITORY)
    private readonly questionLikeRepository: QuestionLikeRepository,
    @Optional() private readonly authService?: AuthService,
    @Optional() private readonly reportsService?: ReportsService,
  ) {}

  async create(input: CreateQuestionDto, authorId = 'anonymous-user') {
    const question = QuestionEntity.create({
      id: randomUUID(),
      authorId,
      title: input.title,
      body: input.body,
      subject: input.subject,
      grade: input.grade,
      visibility: input.visibility,
      attachments: input.attachments,
    });

    await this.questionRepository.save(question);
    return question;
  }

  async findById(id: string, viewerId?: string) {
    const question = await this.questionRepository.findById(id);
    if (!question) {
      throw new NotFoundException('question not found');
    }

    const hiddenQuestionIds = await this.getHiddenQuestionIds(viewerId);
    if (hiddenQuestionIds.has(id)) {
      throw new NotFoundException('question not found');
    }

    const shouldIncreaseView = this.shouldIncreaseViewCount(viewerId);
    const viewedQuestion = shouldIncreaseView ? question.view() : question;

    if (shouldIncreaseView) {
      await this.questionRepository.save(viewedQuestion);
    }

    const answerCount = await this.answerRepository.countByQuestionId(id);
    return { question: viewedQuestion, answerCount };
  }

  async solve(id: string) {
    const found = await this.questionRepository.findById(id);
    if (!found) {
      throw new NotFoundException('question not found');
    }

    const solved = found.solve();
    await this.questionRepository.save(solved);

    const answerCount = await this.answerRepository.countByQuestionId(id);
    return { question: solved, answerCount };
  }

  async like(id: string, userId: string) {
    const found = await this.questionRepository.findById(id);
    if (!found) {
      throw new NotFoundException('question not found');
    }

    const alreadyLiked = await this.questionLikeRepository.hasUserLiked(id, userId);
    if (alreadyLiked) {
      const unliked = found.unlike();
      await this.questionRepository.save(unliked);
      await this.questionLikeRepository.removeLike(id, userId);

      const answerCount = await this.answerRepository.countByQuestionId(id);
      return { question: unliked, answerCount, liked: false };
    }

    const liked = found.like();
    await this.questionRepository.save(liked);
    await this.questionLikeRepository.saveLike(id, userId);

    const answerCount = await this.answerRepository.countByQuestionId(id);
    return { question: liked, answerCount, liked: true };
  }

  async listTopQuestions(
    limit = 10,
    filters?: QuestionFilters,
    viewerId?: string,
  ) {
    const questions = await this.questionRepository.listAll();
    const hiddenQuestionIds = await this.getHiddenQuestionIds(viewerId);
    const filteredQuestions = this.applyFilters(questions, filters, hiddenQuestionIds);
    const withCounts = await this.withAnswerCounts(filteredQuestions);

    const byPopular = [...withCounts].sort((a, b) => {
      if (b.question.likeCount !== a.question.likeCount) {
        return b.question.likeCount - a.question.likeCount;
      }
      return b.question.createdAt.getTime() - a.question.createdAt.getTime();
    });

    return byPopular.slice(0, limit);
  }

  async listAllQuestions(
    filters?: QuestionFilters,
    viewerId?: string,
  ) {
    const questions = await this.questionRepository.listAll();
    const hiddenQuestionIds = await this.getHiddenQuestionIds(viewerId);
    const filteredQuestions = this.applyFilters(questions, filters, hiddenQuestionIds);
    const withCounts = await this.withAnswerCounts(filteredQuestions);

    // 최신순으로 정렬
    const sorted = [...withCounts].sort((a, b) => {
      return b.question.createdAt.getTime() - a.question.createdAt.getTime();
    });

    return sorted;
  }

  async listByAuthorId(authorId: string) {
    const questions = await this.questionRepository.findByAuthorId(authorId);
    const withCounts = await this.withAnswerCounts(questions);

    return withCounts.sort(
      (a, b) => b.question.createdAt.getTime() - a.question.createdAt.getTime(),
    );
  }

  async deleteById(id: string, requestUserId: string) {
    const question = await this.questionRepository.findById(id);
    if (!question) {
      throw new NotFoundException('question not found');
    }

    const requester = this.authService?.getUserById(requestUserId);
    const isAdmin = requester?.role === 'admin';

    if (question.authorId !== requestUserId && !isAdmin) {
      throw new ForbiddenException('only author can delete question');
    }

    await this.answerRepository.deleteByQuestionId(id);
    await this.questionRepository.deleteById(id);
  }

  private async getHiddenQuestionIds(viewerId?: string): Promise<Set<string>> {
    if (!viewerId || !this.reportsService) {
      return new Set<string>();
    }

    if (viewerId === 'anonymous-user') {
      return new Set<string>();
    }

    const viewer = this.authService?.getUserById(viewerId);
    if (viewer?.role === 'admin') {
      return new Set<string>();
    }

    return this.reportsService.listReportedQuestionIdsByReporter(viewerId);
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

  private applyFilters(
    questions: QuestionEntity[],
    filters: QuestionFilters | undefined,
    hiddenQuestionIds: Set<string>,
  ): QuestionEntity[] {
    const titleQuery = filters?.title?.toLowerCase();

    return questions.filter((question) => {
      if (hiddenQuestionIds.has(question.id)) return false;
      if (filters?.subject && question.subject !== filters.subject) return false;
      if (filters?.grade && question.grade !== filters.grade) return false;
      if (titleQuery && !question.title.toLowerCase().includes(titleQuery)) return false;
      return true;
    });
  }

  private async withAnswerCounts(questions: QuestionEntity[]): Promise<QuestionWithAnswerCount[]> {
    return Promise.all(
      questions.map(async (question) => ({
        question,
        answerCount: await this.answerRepository.countByQuestionId(question.id),
      })),
    );
  }
}
