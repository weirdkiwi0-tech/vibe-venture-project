import Link from 'next/link';
import { headers } from 'next/headers';
import { SiteShell } from '../../components/site-shell';
import { SectionCard } from '../../components/section-card';
import { QuestionList } from '../../components/feed-cards';
import { getQuestionsAll } from '../../lib/api';

interface SearchParams {
  title?: string;
  subject?: string;
  grade?: string;
  page?: string;
}

const ITEMS_PER_PAGE = 10;

function getPaginationQuery(params: SearchParams, page: number) {
  return {
    ...(params.title?.trim() ? { title: params.title.trim() } : {}),
    ...(params.subject?.trim() ? { subject: params.subject.trim() } : {}),
    ...(params.grade?.trim() ? { grade: params.grade.trim() } : {}),
    page: String(page),
  };
}

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const cookieHeader = (await headers()).get('cookie') ?? undefined;
  const questions = await getQuestionsAll(undefined, cookieHeader);
  const isFiltering = Boolean(params.title || params.subject || params.grade);
  const rawPage = Number(params.page ?? '1');
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  
  // searchParams가 있으면 모든 질문 조회, 없으면 기본 질문만
  const allQuestions = isFiltering
    ? await getQuestionsAll(params, cookieHeader)
    : [];

  const displayQuestions = isFiltering ? allQuestions : questions;
  const totalPages = Math.max(1, Math.ceil(displayQuestions.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedQuestions = displayQuestions.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  return (
    <SiteShell title="질문 목록" description="과목과 학년 기준으로 정리된 질문을 빠르게 탐색합니다.">
      {/* 검색 폼 섹션 */}
      <SectionCard eyebrow="질문 검색" title="질문 찾기">
        <div className="search-form-container">
          <form method="get" action="/questions" className="search-form">
            <div className="form-group">
              <input
                type="text"
                name="title"
                placeholder="질문 제목 검색..."
                defaultValue={params.title || ''}
                className="search-input"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <select name="subject" defaultValue={params.subject || ''} className="filter-select">
                  <option value="">전체 과목</option>
                  <option value="수학">수학</option>
                  <option value="영어">영어</option>
                  <option value="국어">국어</option>
                  <option value="과학">과학</option>
                  <option value="사회">사회</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div className="form-group">
                <select name="grade" defaultValue={params.grade || ''} className="filter-select">
                  <option value="">전체 학년</option>
                  <option value="1">고1</option>
                  <option value="2">고2</option>
                  <option value="3">고3</option>
                </select>
              </div>
              <button type="submit" className="search-button">검색</button>
              {(params.title || params.subject || params.grade) && (
                <Link href="/questions" className="reset-button">초기화</Link>
              )}
            </div>
          </form>
        </div>
      </SectionCard>

      {/* 검색 결과 섹션 */}
      {isFiltering && (
        <SectionCard eyebrow="검색 결과" title={`질문 ${displayQuestions.length}개 찾음`}>
          {paginatedQuestions.length > 0 ? (
            <>
              <QuestionList questions={paginatedQuestions} />
              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <Link
                      key={`search-page-${page}`}
                      href={{ pathname: '/questions', query: getPaginationQuery(params, page) }}
                      style={{
                        padding: '0.35rem 0.7rem',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                        background: page === safePage ? '#3b82f6' : '#fff',
                        color: page === safePage ? '#fff' : '#333',
                        fontWeight: page === safePage ? 700 : 400,
                        textDecoration: 'none',
                      }}
                    >
                      {page}
                    </Link>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <p>해당하는 질문이 없습니다.</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* 기본 섹션 */}
      {!isFiltering && (
        <SectionCard eyebrow="질문 탐색" title="현재 올라온 질문">
          <div className="section-toolbar">
            <span>인기 있는 질문과 도움이 필요한 질문</span>
            <Link href="/questions" className="text-link">모든 질문 보기</Link>
          </div>
          <QuestionList questions={paginatedQuestions} />
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <Link
                  key={`default-page-${page}`}
                  href={{ pathname: '/questions', query: getPaginationQuery(params, page) }}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    background: page === safePage ? '#3b82f6' : '#fff',
                    color: page === safePage ? '#fff' : '#333',
                    fontWeight: page === safePage ? 700 : 400,
                    textDecoration: 'none',
                  }}
                >
                  {page}
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </SiteShell>
  );
}