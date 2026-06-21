'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { SectionCard } from './section-card';
import { AdminUsersPanel } from './admin-users-panel';
import type { AdminUser } from '../lib/api';
import type { AdminOverviewResponse } from '../lib/types';
import type { UserRole } from '../lib/roles';
import {
  belongsToReportCategory,
  getReportTypeLabel,
  REPORT_CATEGORY_LABELS,
  type AdminReportCategory,
} from '../lib/admin-report-categories';

type AdminTab = 'overview' | 'users' | 'reports' | 'sla';
const REPORTS_PER_PAGE = 8;

interface AdminDashboardProps {
  overview: AdminOverviewResponse;
  users: AdminUser[];
  breaches: Array<{
    id: string;
    learnerId: string;
    question: string;
    createdAt: string;
    firstMentorResponseAt: string | null;
    isSlaBreached: boolean;
  }>;
  currentRole: UserRole;
}

export function AdminDashboard({ overview, users, breaches, currentRole }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [pendingCount, setPendingCount] = useState(overview.cards.find((c) => c.key === 'pendingReports')?.value ?? 0);
  const [activeReportCategory, setActiveReportCategory] = useState<AdminReportCategory>('community');
  const [currentReportPage, setCurrentReportPage] = useState(1);
  const filteredReportBuckets = overview.reportBuckets.filter((report) =>
    belongsToReportCategory(report.targetType, activeReportCategory),
  );
  const totalReportPages = Math.max(1, Math.ceil(filteredReportBuckets.length / REPORTS_PER_PAGE));
  const visibleReportBuckets = filteredReportBuckets.slice(
    (currentReportPage - 1) * REPORTS_PER_PAGE,
    currentReportPage * REPORTS_PER_PAGE,
  );
  const reportCategoryTabs: Array<{ key: AdminReportCategory; label: string; count: number }> = [
    {
      key: 'community',
      label: REPORT_CATEGORY_LABELS.community,
      count: overview.reportBuckets.filter((report) => belongsToReportCategory(report.targetType, 'community')).length,
    },
    {
      key: 'question',
      label: REPORT_CATEGORY_LABELS.question,
      count: overview.reportBuckets.filter((report) => belongsToReportCategory(report.targetType, 'question')).length,
    },
    {
      key: 'video',
      label: REPORT_CATEGORY_LABELS.video,
      count: overview.reportBuckets.filter((report) => belongsToReportCategory(report.targetType, 'video')).length,
    },
    {
      key: 'comment',
      label: REPORT_CATEGORY_LABELS.comment,
      count: overview.reportBuckets.filter((report) => belongsToReportCategory(report.targetType, 'comment')).length,
    },
  ];

  useEffect(() => {
    if (currentReportPage > totalReportPages) {
      setCurrentReportPage(totalReportPages);
    }
  }, [currentReportPage, totalReportPages]);

  const tabButtons: Array<{ key: AdminTab; label: string; icon: string; count?: number }> = [
    { key: 'overview', label: '개요', icon: '📊' },
    { key: 'users', label: '계정 관리', icon: '👤', count: users.length },
    { key: 'reports', label: '신고', icon: '🚩', count: pendingCount },
    { key: 'sla', label: 'SLA', icon: '⏱️', count: breaches.length },
  ];

  void currentRole;

  return (
    <div className="stack-list">
      {/* ─── 탭 바 ─── */}
      <div className="admin-tab-bar" role="tablist">
        {tabButtons.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`admin-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="admin-tab-icon">{tab.icon}</span>
            <span className="admin-tab-label">{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span className="admin-tab-count">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── 개요 탭 ─── */}
      {activeTab === 'overview' ? (
        <div className="stack-list">
          <SectionCard eyebrow="대시보드" title="운영 현황 요약">
            <div className="admin-overview-grid">
              {overview.cards.map((card) => (
                <article key={card.key} className="admin-overview-card">
                  <div className="card-meta">{card.label}</div>
                  <h3 style={{ fontSize: '2rem', margin: '12px 0' }}>{card.value}</h3>
                </article>
              ))}
            </div>
          </SectionCard>

          {overview.reportBuckets.length > 0 && (
            <SectionCard eyebrow="최우선" title="처리 대기 중인 신고 Top 5">
              <div className="admin-report-list compact">
                {overview.reportBuckets.slice(0, 5).map((report) => (
                  <Link key={report.id} href={report.href as Route} className="admin-report-row">
                    <div className="admin-report-row-copy">
                      <strong>{report.title}</strong>
                      <span>
                        {getReportTypeLabel(report.targetType)} · 최근 접수 {new Date(report.latestReportedAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <span className="admin-report-row-count">신고 {report.reportCount}건</span>
                  </Link>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      ) : null}

      {/* ─── 계정 관리 탭 ─── */}
      {activeTab === 'users' ? (
        <SectionCard eyebrow="계정 관리" title={`가입 계정 ${users.length}명`}>
          <AdminUsersPanel initialUsers={users} currentRole={currentRole} />
        </SectionCard>
      ) : null}

      {/* ─── 신고 탭 ─── */}
      {activeTab === 'reports' ? (
        <SectionCard eyebrow="신고 처리" title={`처리 대기 중인 신고 ${pendingCount}건`}>
          <div className="stack-list">
            <p className="card-meta">신고된 행을 누르면 해당 게시물 상세 화면으로 이동합니다.</p>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {reportCategoryTabs.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className={activeReportCategory === category.key ? 'primary-button' : 'secondary-button'}
                  onClick={() => {
                    setActiveReportCategory(category.key);
                    setCurrentReportPage(1);
                  }}
                >
                  {category.label} ({category.count})
                </button>
              ))}
            </div>

            {filteredReportBuckets.length === 0 ? (
              <div className="empty-state">처리 대기 중인 신고가 없습니다.</div>
            ) : (
              <>
                <div className="admin-report-list">
                  {visibleReportBuckets.map((report) => (
                    <Link key={report.id} href={report.href as Route} className="admin-report-row">
                      <div className="admin-report-row-copy">
                        <strong>{report.title}</strong>
                        <span>
                          {getReportTypeLabel(report.targetType)} · 최근 접수 {new Date(report.latestReportedAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>

                      <div className="admin-report-row-side">
                        <span className={`admin-report-severity ${report.highestSeverity === 'high' ? 'high' : ''}`}>
                          {report.highestSeverity === 'high' ? '긴급' : '일반'}
                        </span>
                        <span className="admin-report-row-count">신고 {report.reportCount}건</span>
                      </div>
                    </Link>
                  ))}
                </div>

                {totalReportPages > 1 ? (
                  <nav className="admin-report-pagination" aria-label="신고 목록 페이지 이동">
                    {Array.from({ length: totalReportPages }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        className={`admin-report-page-button ${page === currentReportPage ? 'active' : ''}`}
                        onClick={() => setCurrentReportPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                  </nav>
                ) : null}
              </>
            )}
          </div>
        </SectionCard>
      ) : null}

      {/* ─── SLA 탭 ─── */}
      {activeTab === 'sla' ? (
        <SectionCard eyebrow="멘토링 SLA" title={`24시간 초과 세션 ${breaches.length}건`}>
          <div className="stack-list">
            {breaches.length === 0 ? (
              <div className="empty-state">현재 SLA 초과 세션이 없습니다.</div>
            ) : (
              breaches.map((session) => (
                <article key={session.id} className="surface-card">
                  <div className="card-meta">{session.learnerId}</div>
                  <h3>{session.question}</h3>
                  <p className="card-meta">
                    생성: {new Date(session.createdAt).toLocaleString('ko-KR')}
                  </p>
                  {session.firstMentorResponseAt && (
                    <p className="card-meta">
                      첫 응답: {new Date(session.firstMentorResponseAt).toLocaleString('ko-KR')}
                    </p>
                  )}
                  {session.isSlaBreached && (
                    <p style={{ color: '#a21f1f', fontSize: '0.9rem', marginTop: '8px' }}>
                      ⚠️ SLA 초과됨
                    </p>
                  )}
                </article>
              ))
            )}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
