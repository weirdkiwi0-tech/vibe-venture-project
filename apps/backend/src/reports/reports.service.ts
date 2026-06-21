import { ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../db/database.service';
import { AdminAuditLogEntity } from './entities/admin-audit-log.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportEntity } from './entities/report.entity';
import {
  ADMIN_AUDIT_LOG_REPOSITORY,
  AdminAuditLogRepository,
  REPORT_REPOSITORY,
  ReportRepository,
} from './reports.repository';

@Injectable()
export class ReportsService {
  constructor(
    @Inject(REPORT_REPOSITORY)
    private readonly reportRepository: ReportRepository,
    @Inject(ADMIN_AUDIT_LOG_REPOSITORY)
    private readonly adminAuditLogRepository: AdminAuditLogRepository,
    @Optional() private readonly databaseService?: DatabaseService,
  ) {}

  async create(input: CreateReportDto, reporterId = 'anonymous-user') {
    await this.assertReportableTarget(input, reporterId);

    const report = ReportEntity.create({
      id: randomUUID(),
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: input.details,
      severity: input.severity,
    });

    await this.reportRepository.save(report);
    return report;
  }

  async listAll() {
    const reports = await this.reportRepository.listAll();
    return reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listReportedQuestionIdsByReporter(reporterId: string): Promise<Set<string>> {
    if (!reporterId || reporterId === 'anonymous-user') {
      return new Set<string>();
    }

    const reports = await this.reportRepository.listAll();
    return new Set(
      reports
        .filter((report) => report.reporterId === reporterId && report.targetType === 'question')
        .map((report) => report.targetId),
    );
  }

  private async assertReportableTarget(input: CreateReportDto, reporterId: string): Promise<void> {
    if (!this.databaseService) {
      return;
    }

    const targetAuthorId = this.resolveTargetAuthorId(input.targetType, input.targetId);
    if (input.targetType === 'comment' || input.targetType === 'community-post') {
      if (targetAuthorId && reporterId && reporterId !== 'anonymous-user' && reporterId === targetAuthorId) {
        throw new ForbiddenException('cannot report your own content');
      }
      return;
    }

    if (!targetAuthorId) {
      throw new NotFoundException('report target not found');
    }

    if (reporterId && reporterId !== 'anonymous-user' && reporterId === targetAuthorId) {
      throw new ForbiddenException('cannot report your own content');
    }
  }

  private resolveTargetAuthorId(
    targetType: 'question' | 'answer' | 'video' | 'comment' | 'community-post',
    targetId: string,
  ): string | null {
    const db = this.databaseService?.getDatabase();
    if (!db) {
      return null;
    }

    if (targetType === 'question') {
      const row = db.prepare('SELECT authorId FROM questions WHERE id = ?').get(targetId) as { authorId?: string } | undefined;
      return row?.authorId ?? null;
    }

    if (targetType === 'video') {
      const row = db.prepare('SELECT uploaderId FROM videos WHERE id = ?').get(targetId) as { uploaderId?: string } | undefined;
      return row?.uploaderId ?? null;
    }

    if (targetType === 'comment') {
      const answerCommentRow = db.prepare('SELECT authorId FROM comments WHERE id = ?').get(targetId) as { authorId?: string } | undefined;
      if (answerCommentRow?.authorId) {
        return answerCommentRow.authorId;
      }

      const videoCommentRow = db.prepare('SELECT authorId FROM video_comments WHERE id = ?').get(targetId) as { authorId?: string } | undefined;
      return videoCommentRow?.authorId ?? null;
    }

    if (targetType === 'community-post') {
      const row = db.prepare('SELECT authorId FROM community_posts WHERE id = ?').get(targetId) as { authorId?: string } | undefined;
      return row?.authorId ?? null;
    }

    const row = db.prepare('SELECT authorId FROM answers WHERE id = ?').get(targetId) as { authorId?: string } | undefined;
    return row?.authorId ?? null;
  }

  async listQueue(statuses: Array<'pending' | 'reviewing'> = ['pending', 'reviewing']) {
    const reports = await this.reportRepository.listAll();
    return reports
      .filter((report) => statuses.includes(report.status as 'pending' | 'reviewing'))
      .sort((a, b) => {
        if (a.severity !== b.severity) {
          return a.severity === 'high' ? -1 : 1;
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
  }

  async approve(id: string, reason: string, adminId = 'admin-user') {
    return this.resolveWithAction(id, 'approve', reason, adminId, (report) =>
      report.resolve(),
    );
  }

  async reject(id: string, reason: string, adminId = 'admin-user') {
    return this.resolveWithAction(id, 'reject', reason, adminId, (report) =>
      report.reject(),
    );
  }

  async restore(id: string, reason: string, adminId = 'admin-user') {
    return this.resolveWithAction(id, 'restore', reason, adminId, (report) =>
      report.restore(),
    );
  }

  async deleteTargetAndResolve(id: string, reason: string, adminId = 'admin-user') {
    const report = await this.reportRepository.findById(id);
    if (!report) {
      throw new Error('report not found');
    }

    this.deleteTargetByReport(report);

    const updated = report.resolve();
    await this.reportRepository.save(updated);

    await this.adminAuditLogRepository.save(
      AdminAuditLogEntity.create({
        id: randomUUID(),
        adminId,
        action: 'approve',
        targetType: updated.targetType,
        targetId: updated.targetId,
        reason,
        metadata: {
          reportId: updated.id,
          status: updated.status,
          moderation: 'delete-target',
        },
      }),
    );

    return updated;
  }

  async listAuditLogs() {
    const logs = await this.adminAuditLogRepository.listAll();
    return logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private async resolveWithAction(
    id: string,
    action: 'approve' | 'reject' | 'restore',
    reason: string,
    adminId: string,
    mutate: (report: ReportEntity) => ReportEntity,
  ) {
    const report = await this.reportRepository.findById(id);
    if (!report) {
      throw new Error('report not found');
    }

    const updated = mutate(report);
    await this.reportRepository.save(updated);

    await this.adminAuditLogRepository.save(
      AdminAuditLogEntity.create({
        id: randomUUID(),
        adminId,
        action,
        targetType: updated.targetType,
        targetId: updated.targetId,
        reason,
        metadata: { reportId: updated.id, status: updated.status },
      }),
    );

    return updated;
  }

  private deleteTargetByReport(report: ReportEntity): void {
    const db = this.databaseService?.getDatabase();
    if (!db) {
      throw new Error('database unavailable');
    }

    if (report.targetType === 'question') {
      const tx = db.transaction((questionId: string) => {
        db.prepare('DELETE FROM question_likes WHERE questionId = ?').run(questionId);
        db.prepare('DELETE FROM answer_likes WHERE answerId IN (SELECT id FROM answers WHERE questionId = ?)').run(questionId);
        db.prepare('DELETE FROM comments WHERE answerId IN (SELECT id FROM answers WHERE questionId = ?)').run(questionId);
        db.prepare('DELETE FROM answers WHERE questionId = ?').run(questionId);
        db.prepare('DELETE FROM questions WHERE id = ?').run(questionId);
      });

      tx(report.targetId);
      return;
    }

    if (report.targetType === 'video') {
      const tx = db.transaction((videoId: string) => {
        db.prepare('DELETE FROM video_comments WHERE videoId = ?').run(videoId);
        db.prepare('DELETE FROM videos WHERE id = ?').run(videoId);
      });

      tx(report.targetId);
      return;
    }

    if (report.targetType === 'comment') {
      const tx = db.transaction((commentId: string) => {
        db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
        db.prepare('DELETE FROM video_comments WHERE id = ?').run(commentId);
      });

      tx(report.targetId);
      return;
    }

    if (report.targetType === 'community-post') {
      const tx = db.transaction((postId: string) => {
        db.prepare('DELETE FROM community_post_likes WHERE postId = ?').run(postId);
        db.prepare('DELETE FROM community_posts WHERE id = ?').run(postId);
      });

      tx(report.targetId);
      return;
    }

    const tx = db.transaction((answerId: string) => {
      db.prepare('DELETE FROM answer_likes WHERE answerId = ?').run(answerId);
      db.prepare('DELETE FROM comments WHERE answerId = ?').run(answerId);
      db.prepare('DELETE FROM answers WHERE id = ?').run(answerId);
    });

    tx(report.targetId);
  }
}
