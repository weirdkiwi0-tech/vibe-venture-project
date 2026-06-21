import { DomainValidationError } from '../errors/domain-validation.error';

export type ReportTargetType = 'question' | 'answer' | 'video' | 'comment' | 'community-post';
export type ReportSeverity = 'normal' | 'high';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected' | 'restored';

export interface CreateReportEntityProps {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
  severity?: ReportSeverity;
  status?: ReportStatus;
  createdAt?: Date;
}

export class ReportEntity {
  readonly id: string;
  readonly reporterId: string;
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly reason: string;
  readonly details?: string;
  readonly severity: ReportSeverity;
  readonly status: ReportStatus;
  readonly createdAt: Date;

  private constructor(props: Required<CreateReportEntityProps>) {
    this.id = props.id;
    this.reporterId = props.reporterId;
    this.targetType = props.targetType;
    this.targetId = props.targetId;
    this.reason = props.reason;
    this.details = props.details;
    this.severity = props.severity;
    this.status = props.status;
    this.createdAt = props.createdAt;
  }

  static create(props: CreateReportEntityProps): ReportEntity {
    if (!props.id?.trim()) throw new DomainValidationError('id is required');
    if (!props.reporterId?.trim()) {
      throw new DomainValidationError('reporterId is required');
    }
    if (!props.targetId?.trim()) {
      throw new DomainValidationError('targetId is required');
    }
    if (!props.reason?.trim()) {
      throw new DomainValidationError('reason is required');
    }

    if (
      props.targetType !== 'question'
      && props.targetType !== 'answer'
      && props.targetType !== 'video'
      && props.targetType !== 'comment'
      && props.targetType !== 'community-post'
    ) {
      throw new DomainValidationError('targetType is invalid');
    }

    if (props.severity && props.severity !== 'normal' && props.severity !== 'high') {
      throw new DomainValidationError('severity is invalid');
    }

    return new ReportEntity({
      ...props,
      details: props.details ?? '',
      severity: props.severity ?? 'normal',
      status: props.status ?? 'pending',
      createdAt: props.createdAt ?? new Date(),
    });
  }

  markReviewing(now = new Date()): ReportEntity {
    return this.withStatus('reviewing', now);
  }

  resolve(now = new Date()): ReportEntity {
    return this.withStatus('resolved', now);
  }

  reject(now = new Date()): ReportEntity {
    return this.withStatus('rejected', now);
  }

  restore(now = new Date()): ReportEntity {
    return this.withStatus('restored', now);
  }

  private withStatus(status: ReportStatus, now: Date): ReportEntity {
    return new ReportEntity({
      id: this.id,
      reporterId: this.reporterId,
      targetType: this.targetType,
      targetId: this.targetId,
      reason: this.reason,
      details: this.details ?? '',
      severity: this.severity,
      status,
      createdAt: this.createdAt,
    });
  }
}
