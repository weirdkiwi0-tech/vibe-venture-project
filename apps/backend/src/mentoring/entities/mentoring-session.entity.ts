import { DomainValidationError } from '../errors/domain-validation.error';

export interface CreateMentoringSessionProps {
  id: string;
  learnerId: string;
  question: string;
  createdAt?: Date;
  firstMentorResponseAt?: Date | null;
}

export class MentoringSessionEntity {
  readonly id: string;
  readonly learnerId: string;
  readonly question: string;
  readonly createdAt: Date;
  readonly firstMentorResponseAt: Date | null;

  private constructor(props: Required<CreateMentoringSessionProps>) {
    this.id = props.id;
    this.learnerId = props.learnerId;
    this.question = props.question;
    this.createdAt = props.createdAt;
    this.firstMentorResponseAt = props.firstMentorResponseAt;
  }

  static create(props: CreateMentoringSessionProps): MentoringSessionEntity {
    if (!props.id?.trim()) throw new DomainValidationError('id is required');
    if (!props.learnerId?.trim()) {
      throw new DomainValidationError('learnerId is required');
    }
    if (!props.question?.trim()) {
      throw new DomainValidationError('question is required');
    }

    return new MentoringSessionEntity({
      ...props,
      createdAt: props.createdAt ?? new Date(),
      firstMentorResponseAt: props.firstMentorResponseAt ?? null,
    });
  }

  markFirstMentorResponse(at: Date): MentoringSessionEntity {
    if (this.firstMentorResponseAt) {
      return this;
    }

    return new MentoringSessionEntity({
      id: this.id,
      learnerId: this.learnerId,
      question: this.question,
      createdAt: this.createdAt,
      firstMentorResponseAt: at,
    });
  }

  isSlaBreached(now = new Date()): boolean {
    if (this.firstMentorResponseAt) {
      return false;
    }

    const elapsedMs = now.getTime() - this.createdAt.getTime();
    const hours24 = 24 * 60 * 60 * 1000;
    return elapsedMs > hours24;
  }
}
