import { fireEvent, render, screen } from '@testing-library/react';
import { AdminDashboard } from '../../src/components/admin-dashboard';
import type { AdminOverviewResponse } from '../../src/lib/types';

describe('admin dashboard report tab (integration)', () => {
  it('shows 4 category buttons and filters bucket rows by selected category', async () => {
    const overview: AdminOverviewResponse = {
      cards: [
        { key: 'pendingReports', label: '미처리 신고', value: 5 },
        { key: 'reviewingReports', label: '검토 중 신고', value: 0 },
        { key: 'highRiskReports', label: '고위험 신고', value: 1 },
        { key: 'auditLogs', label: '감사 로그', value: 0 },
      ],
      reportBuckets: [
        {
          id: 'community-post:cp-1',
          targetType: 'community-post',
          targetId: 'cp-1',
          title: '커뮤니티 신고 1',
          href: '/community/posts/cp-1',
          reportCount: 1,
          highestSeverity: 'normal',
          latestReportedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'question:q-1',
          targetType: 'question',
          targetId: 'q-1',
          title: '질문 신고 1',
          href: '/questions/q-1',
          reportCount: 1,
          highestSeverity: 'normal',
          latestReportedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'video:v-1',
          targetType: 'video',
          targetId: 'v-1',
          title: '영상 신고 1',
          href: '/videos/v-1',
          reportCount: 1,
          highestSeverity: 'high',
          latestReportedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'comment:c-1',
          targetType: 'comment',
          targetId: 'c-1',
          title: '댓글 신고 1',
          href: '/questions',
          reportCount: 2,
          highestSeverity: 'normal',
          latestReportedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      urgentReports: [],
    };

    render(
      <AdminDashboard
        overview={overview}
        users={[]}
        breaches={[]}
        currentRole="admin"
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /신고/i }));

    expect(screen.getByRole('button', { name: /커뮤니티 게시글/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /문제 질문작성/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /문제 풀이 영상/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^댓글/i })).toBeInTheDocument();

    expect(screen.getByText('커뮤니티 신고 1')).toBeInTheDocument();
    expect(screen.queryByText('질문 신고 1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /문제 질문작성/i }));
    expect(screen.getByText('질문 신고 1')).toBeInTheDocument();
    expect(screen.queryByText('커뮤니티 신고 1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /문제 풀이 영상/i }));
    expect(screen.getByText('영상 신고 1')).toBeInTheDocument();
    expect(screen.queryByText('질문 신고 1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^댓글/i }));
    expect(screen.getByText('댓글 신고 1')).toBeInTheDocument();
    expect(screen.queryByText('영상 신고 1')).not.toBeInTheDocument();
  });
});