import { DomainValidationError } from '../errors/domain-validation.error';

export type AnswerType = 'text' | 'video';

export interface CreateAnswerEntityProps {
  id: string;
  questionId: string;
  authorId: string;
  type: AnswerType;
  content: string;
  attachments?: string[];
  createdAt?: Date;
}

export class AnswerEntity {
  readonly id: string;
  readonly questionId: string;
  readonly authorId: string;
  readonly type: AnswerType;
  readonly content: string;
  readonly attachments: string[];
  readonly createdAt: Date;

  private constructor(props: Required<CreateAnswerEntityProps>) {
    this.id = props.id;
    this.questionId = props.questionId;
    this.authorId = props.authorId;
    this.type = props.type;
    this.content = props.content;
    this.attachments = props.attachments;
    this.createdAt = props.createdAt;
  }

  static create(props: CreateAnswerEntityProps): AnswerEntity {
    if (!props.id?.trim()) throw new DomainValidationError('id is required');
    if (!props.questionId?.trim())
      throw new DomainValidationError('questionId is required');
    if (!props.authorId?.trim())
      throw new DomainValidationError('authorId is required');
    if (!props.content?.trim())
      throw new DomainValidationError('content is required');
    if (!['text', 'video'].includes(props.type)) {
      throw new DomainValidationError('type must be text or video');
    }

    return new AnswerEntity({
      ...props,
      attachments: props.attachments ?? [],
      createdAt: props.createdAt ?? new Date(),
    });
  }
}
