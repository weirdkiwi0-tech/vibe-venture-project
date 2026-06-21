import { Inject, Injectable, Optional } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ReportsService } from '../reports/reports.service';
import { ANSWER_REPOSITORY, type AnswerRepository } from '../questions/answers.repository';
import { QUESTION_REPOSITORY, type QuestionRepository } from '../questions/questions.repository';
import { VideosService } from '../videos/videos.service';
import { getReportCategory } from './report-category.util';

export interface AdminOverviewCard {
  key: 'pendingReports' | 'reviewingReports' | 'highRiskReports' | 'auditLogs';
  label: string;
  value: number;
}

export interface AdminOverviewResult {
  cards: AdminOverviewCard[];
  reportBuckets: Array<{
    id: string;
    targetType: 'question' | 'answer' | 'video' | 'comment' | 'community-post';
    targetId: string;
    title: string;
    href: string;
    reportCount: number;
    highestSeverity: 'normal' | 'high';
    latestReportedAt: string;
  }>;
  urgentReports: Array<{
    id: string;
    targetType: string;
    targetId: string;
    reason: string;
    details: string;
    severity: string;
    status: string;
    createdAt: string;
  }>;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly authService: AuthService,
    @Optional() private readonly videosService?: VideosService,
    @Optional() @Inject(QUESTION_REPOSITORY) private readonly questionRepository?: QuestionRepository,
    @Optional() @Inject(ANSWER_REPOSITORY) private readonly answerRepository?: AnswerRepository,
  ) {}

  listUsers() {
    return this.authService.listUsers().map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      banned_until: user.banned_until || null,
    }));
  }

  deleteUser(userId: string) {
    this.authService.deleteUser(userId);
  }

  banUser(userId: string, banUntil: string) {
    this.authService.banUser(userId, banUntil);
  }

  unbanUser(userId: string) {
    this.authService.unbanUser(userId);
  }

  updateUserRole(userId: string, role: 'user' | 'admin') {
    this.authService.updateUserRole(userId, role);
  }

  async getOverview(): Promise<AdminOverviewResult> {
    const [allReports, queue, auditLogs] = await Promise.all([
      this.reportsService.listAll(),
      this.reportsService.listQueue(),
      this.reportsService.listAuditLogs(),
    ]);

    return {
      cards: [
        { key: 'pendingReports', label: '미처리 신고', value: allReports.filter((r) => r.status === 'pending').length },
        { key: 'reviewingReports', label: '검토 중 신고', value: allReports.filter((r) => r.status === 'reviewing').length },
        { key: 'highRiskReports', label: '고위험 신고', value: queue.filter((r) => r.severity === 'high').length },
        { key: 'auditLogs', label: '감사 로그', value: auditLogs.length },
      ],
      reportBuckets: await this.buildReportBuckets(queue),
      urgentReports: queue.map((report) => ({
        id: report.id,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        details: report.details ?? '',
        severity: report.severity,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      })),
    };
  }

  private async buildReportBuckets(queue: Awaited<ReturnType<ReportsService['listQueue']>>) {
    const groupedReports = new Map<string, {
      targetType: 'question' | 'answer' | 'video' | 'comment' | 'community-post';
      targetId: string;
      reportCount: number;
      highestSeverity: 'normal' | 'high';
      latestReportedAt: Date;
    }>();

    for (const report of queue) {
      const key = `${report.targetType}:${report.targetId}`;
      const existing = groupedReports.get(key);

      if (!existing) {
        groupedReports.set(key, {
          targetType: report.targetType,
          targetId: report.targetId,
          reportCount: 1,
          highestSeverity: report.severity,
          latestReportedAt: report.createdAt,
        });
        continue;
      }

      existing.reportCount += 1;
      if (report.severity === 'high') {
        existing.highestSeverity = 'high';
      }
      if (report.createdAt.getTime() > existing.latestReportedAt.getTime()) {
        existing.latestReportedAt = report.createdAt;
      }
    }

    const buckets = await Promise.all(
      [...groupedReports.values()].map(async (group) => {
        const target = await this.resolveReportTarget(group.targetType, group.targetId);
        return {
          id: `${group.targetType}:${group.targetId}`,
          targetType: group.targetType,
          targetId: group.targetId,
          title: target.title,
          href: target.href,
          reportCount: group.reportCount,
          highestSeverity: group.highestSeverity,
          latestReportedAt: group.latestReportedAt.toISOString(),
        };
      }),
    );

    return buckets.sort((left, right) => {
      if (left.highestSeverity !== right.highestSeverity) {
        return left.highestSeverity === 'high' ? -1 : 1;
      }
      if (right.reportCount !== left.reportCount) {
        return right.reportCount - left.reportCount;
      }
      return new Date(right.latestReportedAt).getTime() - new Date(left.latestReportedAt).getTime();
    });
  }

  private async resolveReportTarget(targetType: 'question' | 'answer' | 'video' | 'comment' | 'community-post', targetId: string) {
    const category = getReportCategory(targetType);

    if (category === 'comment') {
      return {
        title: '신고된 댓글/답글',
        href: '/questions',
      };
    }

    if (category === 'community') {
      return {
        title: '신고된 커뮤니티 게시글',
        href: `/community/posts/${targetId}`,
      };
    }

    if (targetType === 'question') {
      const question = await this.questionRepository?.findById(targetId);
      return {
        title: question?.title ?? '삭제되었거나 찾을 수 없는 질문',
        href: `/questions/${targetId}`,
      };
    }

    if (targetType === 'video') {
      const video = await this.videosService?.findById(targetId).catch(() => null);
      return {
        title: video?.title ?? '삭제되었거나 찾을 수 없는 영상',
        href: `/videos/${targetId}`,
      };
    }

    const answer = await this.answerRepository?.findById(targetId);
    if (!answer) {
      return {
        title: '삭제되었거나 찾을 수 없는 답변',
        href: '/questions',
      };
    }

    const question = await this.questionRepository?.findById(answer.questionId);
    if (!question) {
      return {
        title: '삭제되었거나 찾을 수 없는 답변',
        href: '/questions',
      };
    }

    return {
      title: question.title,
      href: `/questions/${question.id}#answer-${targetId}`,
    };
  }
}
