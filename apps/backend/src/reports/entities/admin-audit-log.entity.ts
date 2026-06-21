import { DomainValidationError } from '../errors/domain-validation.error';
import { ReportTargetType } from './report.entity';

export type AdminAuditAction = 'approve' | 'reject' | 'restore';

export interface CreateAdminAuditLogEntityProps {
  id: string;
  adminId: string;
  action: AdminAuditAction;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export class AdminAuditLogEntity {
  readonly id: string;
  readonly adminId: string;
  readonly action: AdminAuditAction;
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly reason: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;

  private constructor(props: Required<CreateAdminAuditLogEntityProps>) {
    this.id = props.id;
    this.adminId = props.adminId;
    this.action = props.action;
    this.targetType = props.targetType;
    this.targetId = props.targetId;
    this.reason = props.reason;
    this.metadata = props.metadata;
    this.createdAt = props.createdAt;
  }

  static create(props: CreateAdminAuditLogEntityProps): AdminAuditLogEntity {
    if (!props.id?.trim()) throw new DomainValidationError('id is required');
    if (!props.adminId?.trim()) throw new DomainValidationError('adminId is required');
    if (!props.reason?.trim()) throw new DomainValidationError('reason is required');

    return new AdminAuditLogEntity({
      ...props,
      metadata: props.metadata ?? {},
      createdAt: props.createdAt ?? new Date(),
    });
  }
}