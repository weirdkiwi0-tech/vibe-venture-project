import { DomainValidationError } from '../errors/domain-validation.error';

export interface CreateRewardPointProps {
  id: string;
  userId: string;
  reason: string;
  points: number;
  createdAt?: Date;
}

export class RewardPointEntity {
  readonly id: string;
  readonly userId: string;
  readonly reason: string;
  readonly points: number;
  readonly createdAt: Date;

  private constructor(props: Required<CreateRewardPointProps>) {
    this.id = props.id;
    this.userId = props.userId;
    this.reason = props.reason;
    this.points = props.points;
    this.createdAt = props.createdAt;
  }

  static create(props: CreateRewardPointProps): RewardPointEntity {
    if (!props.id?.trim()) throw new DomainValidationError('id is required');
    if (!props.userId?.trim()) {
      throw new DomainValidationError('userId is required');
    }
    if (!props.reason?.trim()) {
      throw new DomainValidationError('reason is required');
    }
    if (!Number.isInteger(props.points) || props.points <= 0) {
      throw new DomainValidationError('points must be a positive integer');
    }

    return new RewardPointEntity({
      ...props,
      createdAt: props.createdAt ?? new Date(),
    });
  }
}
