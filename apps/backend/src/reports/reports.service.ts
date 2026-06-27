import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TableClient } from '@azure/data-tables';
import { randomUUID } from 'crypto';
import { ensureTable, escapeOdataString, getTableClient, listAllEntities } from '../db/azure-table.util';
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
  private questionsClient?: TableClient;
  private answersClient?: TableClient;
  private videosClient?: TableClient;
  private videoCommentsClient?: TableClient;
  private videoCommentLikesClient?: TableClient;
  private questionLikesClient?: TableClient;
  private ready?: Promise<void>;
  private readonly hasTableConnection: boolean;

  constructor(
    @Inject(REPORT_REPOSITORY)
    private readonly reportRepository: ReportRepository,
    @Inject(ADMIN_AUDIT_LOG_REPOSITORY)
    private readonly adminAuditLogRepository: AdminAuditLogRepository,
  ) {
    this.hasTableConnection = Boolean(process.env.AZURE_TABLES_CONNECTION_STRING);
  }

  private async ensureReady(): Promise<void> {
    if (!this.hasTableConnection) {
      return;
    }

    if (!this.ready) {
      this.questionsClient = getTableClient('QUESTIONS_TABLE_NAME', 'questions');
      this.answersClient = getTableClient('ANSWERS_TABLE_NAME', 'answers');
      this.videosClient = getTableClient('VIDEOS_TABLE_NAME', 'videos');
      this.videoCommentsClient = getTableClient('VIDEO_COMMENTS_TABLE_NAME', 'videocomments');
      this.videoCommentLikesClient = getTableClient('VIDEO_COMMENT_LIKES_TABLE_NAME', 'videocommentlikes');
      this.questionLikesClient = getTableClient('QUESTION_LIKES_TABLE_NAME', 'questionlikes');
      this.ready = Promise.all([
        ensureTable(this.questionsClient),
        ensureTable(this.answersClient),
        ensureTable(this.videosClient),
        ensureTable(this.videoCommentsClient),
        ensureTable(this.videoCommentLikesClient),
        ensureTable(this.questionLikesClient),
      ]).then(() => undefined);
    }

    await this.ready;
  }

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
    if (!this.hasTableConnection) {
      return;
    }

    await this.ensureReady();
    const targetAuthorId = await this.resolveTargetAuthorId(input.targetType, input.targetId);
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
  ): Promise<string | null> {
    return this.resolveTargetAuthorIdFromTable(targetType, targetId);
  }

  private async resolveTargetAuthorIdFromTable(
    targetType: 'question' | 'answer' | 'video' | 'comment' | 'community-post',
    targetId: string,
  ): Promise<string | null> {

    if (targetType === 'question') {
      const row = await this.questionsClient!.getEntity<Record<string, unknown>>('questions', targetId).catch(() => undefined);
      return row?.authorId ? String(row.authorId) : null;
    }

    if (targetType === 'video') {
      const row = await this.videosClient!.getEntity<Record<string, unknown>>('videos', targetId).catch(() => undefined);
      return row?.uploaderId ? String(row.uploaderId) : null;
    }

    if (targetType === 'comment') {
      const videoCommentRow = await this.videoCommentsClient!.getEntity<Record<string, unknown>>('videocomments', targetId).catch(() => undefined);
      return videoCommentRow?.authorId ? String(videoCommentRow.authorId) : null;
    }

    if (targetType === 'community-post') {
      return null;
    }

    const row = await this.answersClient!.getEntity<Record<string, unknown>>('answers', targetId).catch(() => undefined);
    return row?.authorId ? String(row.authorId) : null;
  }

  async listQueue(statuses: string[] = ['pending', 'reviewing']) {
    const reports = await this.reportRepository.listAll();
    const queueStatuses: Array<'pending' | 'reviewing'> = ['pending', 'reviewing'];
    const allowedStatuses = new Set<string>(queueStatuses);
    const selectedStatuses = statuses.filter(
      (status): status is 'pending' | 'reviewing' => allowedStatuses.has(status),
    );
    const effectiveStatuses = selectedStatuses.length > 0 ? selectedStatuses : queueStatuses;

    return reports
      .filter((report) => effectiveStatuses.includes(report.status as 'pending' | 'reviewing'))
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

    await this.deleteTargetByReport(report);

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

  private async deleteTargetByReport(report: ReportEntity): Promise<void> {
    if (!this.hasTableConnection) {
      return;
    }

    await this.ensureReady();

    if (report.targetType === 'question') {
      const escapedQuestionId = escapeOdataString(report.targetId);
      const likes = await listAllEntities<Record<string, unknown>>(
        this.questionLikesClient!,
        `partitionKey eq 'questionlikes' and questionId eq '${escapedQuestionId}'`,
      );
      await Promise.all(likes.map((like) => this.questionLikesClient!.deleteEntity('questionlikes', String(like.rowKey ?? like.id)).catch(() => undefined)));

      const answers = await listAllEntities<Record<string, unknown>>(
        this.answersClient!,
        `partitionKey eq 'answers' and questionId eq '${escapedQuestionId}'`,
      );
      await Promise.all(answers.map((answer) => this.answersClient!.deleteEntity('answers', String(answer.rowKey ?? answer.id)).catch(() => undefined)));

      await this.questionsClient!.deleteEntity('questions', report.targetId).catch(() => undefined);
      return;
    }

    if (report.targetType === 'video') {
      const escapedVideoId = escapeOdataString(report.targetId);
      const comments = await listAllEntities<Record<string, unknown>>(
        this.videoCommentsClient!,
        `partitionKey eq 'videocomments' and videoId eq '${escapedVideoId}'`,
      );

      await Promise.all(comments.map(async (comment) => {
        const commentId = String(comment.rowKey ?? comment.id);
        await this.videoCommentsClient!.deleteEntity('videocomments', commentId).catch(() => undefined);

        const escapedCommentId = escapeOdataString(commentId);
        const likes = await listAllEntities<Record<string, unknown>>(
          this.videoCommentLikesClient!,
          `partitionKey eq 'videocommentlikes' and commentId eq '${escapedCommentId}'`,
        );

        await Promise.all(likes.map((like) => this.videoCommentLikesClient!.deleteEntity('videocommentlikes', String(like.rowKey ?? like.id)).catch(() => undefined)));
      }));

      await this.videosClient!.deleteEntity('videos', report.targetId).catch(() => undefined);
      return;
    }

    if (report.targetType === 'comment') {
      await this.videoCommentsClient!.deleteEntity('videocomments', report.targetId).catch(() => undefined);

      const escapedCommentId = escapeOdataString(report.targetId);
      const likes = await listAllEntities<Record<string, unknown>>(
        this.videoCommentLikesClient!,
        `partitionKey eq 'videocommentlikes' and commentId eq '${escapedCommentId}'`,
      );

      await Promise.all(likes.map((like) => this.videoCommentLikesClient!.deleteEntity('videocommentlikes', String(like.rowKey ?? like.id)).catch(() => undefined)));
      return;
    }

    if (report.targetType === 'community-post') {
      // Community module still uses in-memory storage.
      return;
    }

    await this.answersClient!.deleteEntity('answers', report.targetId).catch(() => undefined);
  }
}
