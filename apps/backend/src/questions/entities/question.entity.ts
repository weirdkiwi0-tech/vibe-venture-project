import { DomainValidationError } from '../errors/domain-validation.error';

export type QuestionStatus = 'open' | 'solved';
export type Visibility = 'anonymous' | 'nickname';

const QUESTION_VISIBILITIES: Visibility[] = ['anonymous', 'nickname'];

export interface CreateQuestionEntityProps {
  id: string;
  authorId: string;
  title: string;
  body: string;
  subject: string;
  grade: string;
  attachments?: string[];
  visibility?: Visibility;
  status?: QuestionStatus;
  likeCount?: number;
  viewCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class QuestionEntity {
  readonly id: string;
  readonly authorId: string;
  readonly title: string;
  readonly body: string;
  readonly subject: string;
  readonly grade: string;
  readonly attachments: string[];
  readonly visibility: Visibility;
  readonly status: QuestionStatus;
  readonly likeCount: number;
  readonly viewCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: Required<CreateQuestionEntityProps>) {
    this.id = props.id;
    this.authorId = props.authorId;
    this.title = props.title;
    this.body = props.body;
    this.subject = props.subject;
    this.grade = props.grade;
    this.attachments = props.attachments;
    this.visibility = props.visibility;
    this.status = props.status;
    this.likeCount = props.likeCount;
    this.viewCount = props.viewCount;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: CreateQuestionEntityProps): QuestionEntity {
    if (!props.id?.trim()) throw new DomainValidationError('id is required');
    if (!props.authorId?.trim())
      throw new DomainValidationError('authorId is required');
    if (!props.title?.trim())
      throw new DomainValidationError('title is required');
    if (!props.body?.trim()) throw new DomainValidationError('body is required');
    if (!props.subject?.trim())
      throw new DomainValidationError('subject is required');
    if (!props.grade?.trim())
      throw new DomainValidationError('grade is required');
    if (props.visibility && !QUESTION_VISIBILITIES.includes(props.visibility)) {
      throw new DomainValidationError('visibility must be anonymous or nickname');
    }

    return new QuestionEntity({
      ...props,
      attachments: props.attachments ?? [],
      visibility: props.visibility ?? 'anonymous',
      status: props.status ?? 'open',
      likeCount: props.likeCount ?? 0,
      viewCount: props.viewCount ?? 0,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? props.createdAt ?? new Date(),
    });
  }

  solve(now = new Date()): QuestionEntity {
    if (this.status === 'solved') {
      return this;
    }

    return new QuestionEntity({
      id: this.id,
      authorId: this.authorId,
      title: this.title,
      body: this.body,
      subject: this.subject,
      grade: this.grade,
      attachments: this.attachments,
      visibility: this.visibility,
      status: 'solved',
      likeCount: this.likeCount,
      viewCount: this.viewCount,
      createdAt: this.createdAt,
      updatedAt: now,
    });
  }

  like(now = new Date()): QuestionEntity {
    return new QuestionEntity({
      id: this.id,
      authorId: this.authorId,
      title: this.title,
      body: this.body,
      subject: this.subject,
      grade: this.grade,
      attachments: this.attachments,
      visibility: this.visibility,
      status: this.status,
      likeCount: this.likeCount + 1,
      viewCount: this.viewCount,
      createdAt: this.createdAt,
      updatedAt: now,
    });
  }

  unlike(now = new Date()): QuestionEntity {
    return new QuestionEntity({
      id: this.id,
      authorId: this.authorId,
      title: this.title,
      body: this.body,
      subject: this.subject,
      grade: this.grade,
      attachments: this.attachments,
      visibility: this.visibility,
      status: this.status,
      likeCount: Math.max(0, this.likeCount - 1),
      viewCount: this.viewCount,
      createdAt: this.createdAt,
      updatedAt: now,
    });
  }

  view(now = new Date()): QuestionEntity {
    return new QuestionEntity({
      id: this.id,
      authorId: this.authorId,
      title: this.title,
      body: this.body,
      subject: this.subject,
      grade: this.grade,
      attachments: this.attachments,
      visibility: this.visibility,
      status: this.status,
      likeCount: this.likeCount,
      viewCount: this.viewCount + 1,
      createdAt: this.createdAt,
      updatedAt: now,
    });
  }
}
