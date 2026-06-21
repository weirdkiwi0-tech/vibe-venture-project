import { fireEvent, render, screen } from '@testing-library/react';
import { AdminDashboard } from '../../src/components/admin-dashboard';
import type { AdminOverviewResponse } from '../../src/lib/types';

describe('admin reports tab e2e', () => {
  it('renders 4 category buttons and switches filtered rows', () => {
    const overview: AdminOverviewResponse = {
      cards: [
        { key: 'pendingReports', label: '미처리 신고', value: 4 },
        { key: 'reviewingReports', label: '검토 중 신고', value: 0 },
        { key: 'highRiskReports', label: '고위험 신고', value: 1 },
        { key: 'auditLogs', label: '감사 로그', value: 0 },
      ],
      reportBuckets: [
        {
          id: 'community-post:cp-10',
          targetType: 'community-post',
          targetId: 'cp-10',
          title: '커뮤니티 글 신고',
          href: '/community/posts/cp-10',
          reportCount: 1,
          highestSeverity: 'high',
          latestReportedAt: '2026-01-02T00:00:00.000Z',
        },
        {
          id: 'question:q-10',
          targetType: 'question',
          targetId: 'q-10',
          title: '질문 신고',
          href: '/questions/q-10',
          reportCount: 1,
          highestSeverity: 'normal',
          latestReportedAt: '2026-01-02T00:00:00.000Z',
        },
        {
          id: 'video:v-10',
          targetType: 'video',
          targetId: 'v-10',
          title: '영상 신고',
          href: '/videos/v-10',
          reportCount: 1,
          highestSeverity: 'normal',
          latestReportedAt: '2026-01-02T00:00:00.000Z',
        },
        {
          id: 'comment:c-10',
          targetType: 'comment',
          targetId: 'c-10',
          title: '댓글 신고',
          href: '/questions',
          reportCount: 1,
          highestSeverity: 'normal',
          latestReportedAt: '2026-01-02T00:00:00.000Z',
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

    const communityButton = screen.getByRole('button', { name: /커뮤니티 게시글/i });
    const questionButton = screen.getByRole('button', { name: /문제 질문작성/i });
    const videoButton = screen.getByRole('button', { name: /문제 풀이 영상/i });
    const commentButton = screen.getByRole('button', { name: /^댓글/i });

    expect(communityButton).toBeInTheDocument();
    expect(questionButton).toBeInTheDocument();
    expect(videoButton).toBeInTheDocument();
    expect(commentButton).toBeInTheDocument();

    expect(screen.getByText('커뮤니티 글 신고')).toBeInTheDocument();

    fireEvent.click(questionButton);
    expect(screen.getByText('질문 신고')).toBeInTheDocument();

    fireEvent.click(videoButton);
    expect(screen.getByText('영상 신고')).toBeInTheDocument();

    fireEvent.click(commentButton);
    expect(screen.getByText('댓글 신고')).toBeInTheDocument();
  });
});