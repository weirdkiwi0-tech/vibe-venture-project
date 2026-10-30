import type { Route } from 'next';

export const REPORT_TARGET_TYPES = [
  'question',
  'answer',
  'video',
  'comment',
  'community-post',
] as const;

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export function normalizeReportTargetType(value: string | null | undefined): ReportTargetType {
  if (value && (REPORT_TARGET_TYPES as readonly string[]).includes(value)) {
    return value as ReportTargetType;
  }
  return 'question';
}

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
    targetId: input.targetId.trim(),
    source: input.sourceLabel.trim(),
    reason: input.reason.trim(),
  });

  const trimmedDetails = input.details?.trim();
  if (trimmedDetails) {
    params.set('details', trimmedDetails);
  }

  if (input.severity) {
    params.set('severity', input.severity);
  }

  return `/reports/new?${params.toString()}` as Route;
}
