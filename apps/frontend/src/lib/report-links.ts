import type { Route } from 'next';

export type ReportTargetType = 'question' | 'answer' | 'video' | 'comment' | 'community-post';

export function createReportLink(input: {
  targetType: ReportTargetType;
  targetId: string;
  sourceLabel: string;
  reason: string;
  details?: string;
  severity?: 'normal' | 'high';
}): Route {
  const params = new URLSearchParams({
    targetType: input.targetType,
    targetId: input.targetId,
    source: input.sourceLabel,
    reason: input.reason,
  });

  if (input.details) {
    params.set('details', input.details);
  }

  if (input.severity) {
    params.set('severity', input.severity);
  }

  return `/reports/new?${params.toString()}` as Route;
}
