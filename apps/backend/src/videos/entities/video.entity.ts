import { DomainValidationError } from '../errors/domain-validation.error';

export interface CreateVideoEntityProps {
  id: string;
  uploaderId: string;
  title: string;
  subject?: string;
  url: string;
  durationSeconds: number;
  likeCount?: number;
  viewCount?: number;
  createdAt?: Date;
}

export class VideoEntity {
  readonly id: string;
  readonly uploaderId: string;
  readonly title: string;
  readonly subject: string;
  readonly url: string;
  readonly durationSeconds: number;
  readonly likeCount: number;
  readonly viewCount: number;
  readonly createdAt: Date;

  private constructor(props: Required<CreateVideoEntityProps>) {
    this.id = props.id;
    this.uploaderId = props.uploaderId;
    this.title = props.title;
    this.subject = props.subject;
    this.url = props.url;
    this.durationSeconds = props.durationSeconds;
    this.likeCount = props.likeCount;
    this.viewCount = props.viewCount;
    this.createdAt = props.createdAt;
  }

  static create(props: CreateVideoEntityProps): VideoEntity {
    if (!props.id?.trim()) throw new DomainValidationError('id is required');
    if (!props.uploaderId?.trim()) {
      throw new DomainValidationError('uploaderId is required');
    }
    if (!props.title?.trim()) {
      throw new DomainValidationError('title is required');
    }
    if (!props.url?.trim()) {
      throw new DomainValidationError('url is required');
    }
    if (!Number.isFinite(props.durationSeconds) || props.durationSeconds <= 0) {
      throw new DomainValidationError('durationSeconds must be greater than 0');
    }

    return new VideoEntity({
      ...props,
      subject: props.subject?.trim() || '기타',
      likeCount: props.likeCount ?? 0,
      viewCount: props.viewCount ?? 0,
      createdAt: props.createdAt ?? new Date(),
    });
  }

  like(): VideoEntity {
    return new VideoEntity({
      id: this.id,
      uploaderId: this.uploaderId,
      title: this.title,
      subject: this.subject,
      url: this.url,
      durationSeconds: this.durationSeconds,
      likeCount: this.likeCount + 1,
      viewCount: this.viewCount,
      createdAt: this.createdAt,
    });
  }

  unlike(): VideoEntity {
    return new VideoEntity({
      id: this.id,
      uploaderId: this.uploaderId,
      title: this.title,
      subject: this.subject,
      url: this.url,
      durationSeconds: this.durationSeconds,
      likeCount: Math.max(0, this.likeCount - 1),
      viewCount: this.viewCount,
      createdAt: this.createdAt,
    });
  }

  view(): VideoEntity {
    return new VideoEntity({
      id: this.id,
      uploaderId: this.uploaderId,
      title: this.title,
      subject: this.subject,
      url: this.url,
      durationSeconds: this.durationSeconds,
      likeCount: this.likeCount,
      viewCount: this.viewCount + 1,
      createdAt: this.createdAt,
    });
  }
}
