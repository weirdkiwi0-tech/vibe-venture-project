'use client';

import { useSearchParams } from 'next/navigation';
import { SiteShell } from '../../../components/site-shell';
import { SectionCard } from '../../../components/section-card';
import { ReportFormWithDefaults } from '../../../components/forms';
import { useAuthUser } from '../../../components/role-provider';
import { createReport } from '../../../lib/api';

export default function NewReportPage() {
  const searchParams = useSearchParams();
  const { authUser } = useAuthUser();

  const targetType = searchParams.get('targetType');
  const targetId = searchParams.get('targetId');
  const reason = searchParams.get('reason');
  const details = searchParams.get('details');
  const severity = searchParams.get('severity');
  const source = searchParams.get('source');

  const initialValues = {
    targetType: targetType === 'answer'
      ? 'answer'
      : targetType === 'video'
        ? 'video'
        : targetType === 'comment'
          ? 'comment'
          : targetType === 'community-post'
            ? 'community-post'
          : 'question',
    targetId: targetId ?? '',
    reason: reason ?? '',
    details: details ?? '',
    severity: severity === 'high' ? 'high' : 'normal',
    sourceLabel: source ?? undefined,
  } as const;

  const submitReport = async (formData: FormData) => {
    await createReport({
      targetType: String(formData.get('targetType') ?? 'question') as 'question' | 'answer' | 'video' | 'comment' | 'community-post',
      targetId: String(formData.get('targetId') ?? ''),
      reason: String(formData.get('reason') ?? ''),
      details: String(formData.get('details') ?? ''),
      severity: String(formData.get('severity') ?? 'normal') as 'normal' | 'high',
      userId: authUser?.id,
    });
  };

  return (
    <SiteShell title="신고 작성" description="운영 처리의 시작점이 되는 신고 접수 화면입니다.">
      <SectionCard eyebrow="신고 접수" title="대상과 사유를 명확히 남겨 운영 큐로 넘기기">
        <ReportFormWithDefaults onSubmit={submitReport} initialValues={initialValues} redirectOnSuccessTo="/" />
      </SectionCard>
    </SiteShell>
  );
}
