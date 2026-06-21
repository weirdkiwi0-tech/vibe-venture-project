import { SiteShell } from '../../components/site-shell';
import { SectionCard } from '../../components/section-card';
import { getReports } from '../../lib/api';

export default async function ReportsPage() {
  const reports = await getReports();

  return (
    <SiteShell title="신고 목록" description="운영자가 바라보는 신고 현황의 읽기 전용 뷰입니다.">
      <SectionCard eyebrow="신고 현황" title="최근 신고">
        <div className="stack-list">
          {reports.map((report) => (
            <article key={report.id} className="surface-card">
              <div className="card-meta">
                {report.targetType} · {report.severity} · {report.status}
              </div>
              <h3>{report.reason}</h3>
              <p>{report.details || '상세 사유 없음'}</p>
              <div className="card-footer">
                <span>{report.targetId}</span>
                <span>{new Date(report.createdAt).toLocaleDateString('ko-KR')}</span>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </SiteShell>
  );
}