import { DomainValidationError } from '../errors/domain-validation.error';

export type MessageSender = 'learner' | 'mentor';

export interface CreateMentoringMessageProps {
  id: string;
  sessionId: string;
  sender: MessageSender;
  content: string;
  createdAt?: Date;
}

export class MentoringMessageEntity {
  readonly id: string;
  readonly sessionId: string;
  readonly sender: MessageSender;
  readonly content: string;
  readonly createdAt: Date;

  private constructor(props: Required<CreateMentoringMessageProps>) {
    this.id = props.id;
    this.sessionId = props.sessionId;
    this.sender = props.sender;
    this.content = props.content;
    this.createdAt = props.createdAt;
  }

  static create(props: CreateMentoringMessageProps): MentoringMessageEntity {
    if (!props.id?.trim()) throw new DomainValidationError('id is required');
    if (!props.sessionId?.trim()) {
      throw new DomainValidationError('sessionId is required');
    }
    if (!props.content?.trim()) {
      throw new DomainValidationError('content is required');
    }
    if (props.sender !== 'learner' && props.sender !== 'mentor') {
      throw new DomainValidationError('sender is invalid');
    }

    return new MentoringMessageEntity({
      ...props,
      createdAt: props.createdAt ?? new Date(),
    });
  }
}
