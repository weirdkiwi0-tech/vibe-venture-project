import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthService } from '../auth';
import { ANSWER_REPOSITORY, AnswerRepository } from './answers.repository';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { CreateAnswerCommentDto } from './dto/create-answer-comment.dto';
import { AnswerEntity } from './entities/answer.entity';
import { QUESTION_REPOSITORY, QuestionRepository } from './questions.repository';

interface AnswerCommentRecord {
  id: string;
  answerId: string;
  authorId: string;
  authorVisibility: 'public' | 'anonymous';
  content: string;
  attachments: string[];
  parentCommentId: string | null;
  createdAt: Date;
}

export interface AnswerCommentNode {
  id: string;
  answerId: string;
  authorId: string;
  authorVisibility: 'public' | 'anonymous';
  authorName: string;
  authorAvatar: string;
  authorPhotoUrl?: string;
  content: string;
  attachments: string[];
  parentCommentId: string | null;
  createdAt: Date;
  likeCount: number;
  replies: AnswerCommentNode[];
}

export interface AnswerWithMeta {
  answer: AnswerEntity;
  likeCount: number;
  comments: AnswerCommentNode[];
}

@Injectable()
export class AnswersService {
  private readonly likesByAnswerId = new Map<string, Set<string>>();
  private readonly commentsByAnswerId = new Map<string, AnswerCommentRecord[]>();
  private readonly commentLikesByCommentId = new Map<string, Set<string>>();

  constructor(
    @Inject(ANSWER_REPOSITORY)
    private readonly answerRepository: AnswerRepository,
    @Inject(QUESTION_REPOSITORY)
    private readonly questionRepository: QuestionRepository,
    @Optional() private readonly authService?: AuthService,
  ) {}

  async create(questionId: string, input: CreateAnswerDto, authorId = 'anonymous-user') {
    const question = await this.questionRepository.findById(questionId);
    if (!question) throw new NotFoundException('question not found');

    const attachments = input.attachments ?? [];
    if (input.type === 'video' && attachments.some((attachment) => !this.isVideoAttachment(attachment))) {
      throw new BadRequestException('video answer attachments must be video media only');
    }

    const answer = AnswerEntity.create({
      id: randomUUID(),
      questionId,
      authorId,
      type: input.type,
      content: input.content,
      attachments,
    });

    await this.answerRepository.save(answer);
    return answer;
  }

  async like(answerId: string, userId: string): Promise<{ likeCount: number; liked: boolean }> {
    await this.requireAnswer(answerId);

    const likes = this.likesByAnswerId.get(answerId) ?? new Set<string>();
    if (likes.has(userId)) {
      likes.delete(userId);
      this.likesByAnswerId.set(answerId, likes);
      return { likeCount: likes.size, liked: false };
    }

    likes.add(userId);
    this.likesByAnswerId.set(answerId, likes);
    return { likeCount: likes.size, liked: true };
  }

  async createComment(answerId: string, input: CreateAnswerCommentDto, authorId = 'anonymous-user') {
    await this.requireAnswer(answerId);
    const content = input.content.trim();
    if (!content) {
      throw new BadRequestException('content is required');
    }

    const attachments = input.attachments ?? [];
    if (attachments.some((attachment) => !this.isCommentMediaAttachment(attachment))) {
      throw new BadRequestException('comment attachments must be image or video media only');
    }

    const comments = this.commentsByAnswerId.get(answerId) ?? [];
    if (input.parentCommentId && !comments.some((comment) => comment.id === input.parentCommentId)) {
      throw new NotFoundException('parent comment not found');
    }

    const comment: AnswerCommentRecord = {
      id: randomUUID(),
      answerId,
      authorId,
      authorVisibility: input.authorVisibility ?? 'public',
      content,
      attachments,
      parentCommentId: input.parentCommentId ?? null,
      createdAt: new Date(),
    };

    comments.push(comment);
    this.commentsByAnswerId.set(answerId, comments);
    const [node] = await this.buildCommentTree([comment]);
    return node ?? this.toCommentNode(comment, []);
  }

  async listComments(answerId: string): Promise<AnswerCommentNode[]> {
    await this.requireAnswer(answerId);
    return this.buildCommentTree(this.commentsByAnswerId.get(answerId) ?? []);
  }

  async likeComment(answerId: string, commentId: string, userId: string): Promise<{ likeCount: number; liked: boolean }> {
    await this.requireAnswer(answerId);
    const comments = this.commentsByAnswerId.get(answerId) ?? [];
    if (!comments.some((comment) => comment.id === commentId)) {
      throw new NotFoundException('comment not found');
    }

    const likes = this.commentLikesByCommentId.get(commentId) ?? new Set<string>();
    if (likes.has(userId)) {
      likes.delete(userId);
      this.commentLikesByCommentId.set(commentId, likes);
      return { likeCount: likes.size, liked: false };
    }

    likes.add(userId);
    this.commentLikesByCommentId.set(commentId, likes);
    return { likeCount: likes.size, liked: true };
  }

  async findByQuestionIdWithMeta(questionId: string): Promise<AnswerWithMeta[]> {
    const answers = await this.findByQuestionId(questionId);
    return Promise.all(answers.map(async (answer) => ({
      answer,
      likeCount: this.likesByAnswerId.get(answer.id)?.size ?? 0,
      comments: await this.buildCommentTree(this.commentsByAnswerId.get(answer.id) ?? []),
    })));
  }

  async findByQuestionId(questionId: string) {
    const question = await this.questionRepository.findById(questionId);
    if (!question) throw new NotFoundException('question not found');

    const answers = await this.answerRepository.findByQuestionId(questionId);
    return this.sortByCreatedAtThenId(answers);
  }

  async findByAuthorId(authorId: string) {
    const answers = await this.answerRepository.findByAuthorId(authorId);
    return answers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteById(answerId: string, requestUserId: string) {
    const answer = await this.answerRepository.findById(answerId);
    if (!answer) {
      throw new NotFoundException('answer not found');
    }

    const requester = this.authService ? await this.authService.getUserById(requestUserId) : undefined;
    const isAdmin = requester?.role === 'admin';

    if (answer.authorId !== requestUserId && !isAdmin) {
      throw new ForbiddenException('only author can delete answer');
    }

    await this.answerRepository.deleteById(answerId);
    this.likesByAnswerId.delete(answerId);
    for (const comment of this.commentsByAnswerId.get(answerId) ?? []) {
      this.commentLikesByCommentId.delete(comment.id);
    }
    this.commentsByAnswerId.delete(answerId);
  }

  private async requireAnswer(answerId: string): Promise<AnswerEntity> {
    const answer = await this.answerRepository.findById(answerId);
    if (!answer) {
      throw new NotFoundException('answer not found');
    }
    return answer;
  }

  private async buildCommentTree(records: AnswerCommentRecord[]): Promise<AnswerCommentNode[]> {
    // Pre-resolve unique non-anonymous authors in batch
    const uniqueAuthorIds = [...new Set(records.filter((r) => r.authorVisibility !== 'anonymous').map((r) => r.authorId))];
    const userInfoMap = new Map<string, { name: string; avatar: string; photoUrl?: string }>();
    await Promise.all(uniqueAuthorIds.map(async (userId) => {
      const user = this.authService ? await this.authService.getUserById(userId).catch(() => undefined) : undefined;
      const name = user?.displayName ?? userId;
      const avatar = name.trim() ? name.trim().slice(0, 1).toUpperCase() : 'U';
      userInfoMap.set(userId, { name, avatar, photoUrl: user?.photoUrl });
    }));

    const nodes = new Map<string, AnswerCommentNode>();
    const roots: AnswerCommentNode[] = [];

    const sorted = [...records].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const record of sorted) {
      const userInfo = record.authorVisibility !== 'anonymous' ? userInfoMap.get(record.authorId) : undefined;
      nodes.set(record.id, this.toCommentNode(record, [], userInfo));
    }

    for (const record of sorted) {
      const node = nodes.get(record.id);
      if (!node) continue;

      if (record.parentCommentId) {
        const parent = nodes.get(record.parentCommentId);
        if (parent) {
          parent.replies.push(node);
          continue;
        }
      }

      roots.push(node);
    }

    return roots;
  }

  private toCommentNode(record: AnswerCommentRecord, replies: AnswerCommentNode[], userInfo?: { name: string; avatar: string; photoUrl?: string }): AnswerCommentNode {
    const isAnonymous = record.authorVisibility === 'anonymous';
    const name = isAnonymous ? '익명' : (userInfo?.name ?? record.authorId);
    const avatar = isAnonymous ? '익' : (userInfo?.avatar ?? (name.trim().slice(0, 1).toUpperCase() || 'U'));
    return {
      id: record.id,
      answerId: record.answerId,
      authorId: record.authorId,
      authorVisibility: record.authorVisibility,
      authorName: name,
      authorAvatar: avatar,
      authorPhotoUrl: isAnonymous ? undefined : userInfo?.photoUrl,
      content: record.content,
      attachments: record.attachments,
      parentCommentId: record.parentCommentId,
      createdAt: record.createdAt,
      likeCount: this.commentLikesByCommentId.get(record.id)?.size ?? 0,
      replies,
    };
  }

  private isVideoAttachment(attachment: string): boolean {
    return attachment.trim().toLowerCase().startsWith('data:video/');
  }

  private isCommentMediaAttachment(attachment: string): boolean {
    const normalized = attachment.trim().toLowerCase();
    return normalized.startsWith('data:image/') || normalized.startsWith('data:video/');
  }

  private sortByCreatedAtThenId(answers: AnswerEntity[]): AnswerEntity[] {
    return answers.sort((a, b) => {
      const createdAtDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return a.id.localeCompare(b.id);
    });
  }
}
