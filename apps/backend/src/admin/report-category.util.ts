import type { ReportTargetType } from '../reports/entities/report.entity';

export type AdminReportCategory = 'community' | 'question' | 'video' | 'comment';

export const REPORT_CATEGORY_LABELS: Record<AdminReportCategory, string> = {
  community: '커뮤니티 게시글',
  question: '문제 질문작성',
  video: '문제 풀이 영상',
  comment: '댓글',
};

export function getReportCategory(targetType: ReportTargetType): AdminReportCategory {
  if (targetType === 'community-post') {
    return 'community';
  }

  if (targetType === 'question' || targetType === 'answer') {
    return 'question';
  }

  if (targetType === 'video') {
    return 'video';
  }

  return 'comment';
}

export function belongsToReportCategory(targetType: ReportTargetType, category: AdminReportCategory): boolean {
  return getReportCategory(targetType) === category;
}