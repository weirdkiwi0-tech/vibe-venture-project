import Link from 'next/link';
import { headers } from 'next/headers';
import { SiteShell } from '../../components/site-shell';
import { SectionCard } from '../../components/section-card';
import { getAllVideos, getCommunityBoard, getQuestionsAll } from '../../lib/api';

interface SearchParams {
  q?: string;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const keyword = (params.q ?? '').trim();
  const cookieHeader = (await headers()).get('cookie') ?? undefined;

  const [questions, community, videos] = keyword
    ? await Promise.all([
        getQuestionsAll({ title: keyword }, cookieHeader),
        getCommunityBoard('guest-user', 1, keyword),
        getAllVideos(keyword),
      ])
    : [[], { posts: [], totalPages: 1, friends: [] }, []];

  const totalCount = questions.length + community.posts.length + videos.length;

  return (
    <SiteShell
      title="통합 검색"
      description="질문, 커뮤니티, 풀이영상을 한 번에 검색합니다."
    >
      <SectionCard eyebrow="검색" title="통합 검색어 입력">
        <form method="get" action="/search" className="search-form">
          <div className="form-group">
            <input
              type="text"
              name="q"
              placeholder="예: 1"
              defaultValue={keyword}
              className="search-input"
            />
          </div>
          <div className="form-row">
            <button type="submit" className="search-button">검색</button>
            {keyword ? <Link href="/search" className="reset-button">초기화</Link> : null}
          </div>
        </form>
      </SectionCard>

      {!keyword ? (
        <SectionCard eyebrow="안내" title="검색어를 입력해주세요">
          <div className="empty-state">제목에 포함된 키워드로 질문, 커뮤니티, 풀이영상을 찾아드립니다.</div>
        </SectionCard>
      ) : (
        <>
          <SectionCard eyebrow="검색 결과" title={`"${keyword}" 결과 ${totalCount}건`}>
            <p className="card-meta">제목 기준으로 검색했습니다.</p>
          </SectionCard>

          <SectionCard eyebrow="질문" title={`질문 작성 목록 ${questions.length}건`}>
            {questions.length === 0 ? (
              <div className="empty-state">검색어가 포함된 질문 제목이 없습니다.</div>
            ) : (
              <div className="stack-list">
                {questions.map((item) => (
                  <article key={item.id} className="surface-card">
                    <div className="profile-activity-topline">
                      <strong>{item.title}</strong>
                      <span className="community-badge subtle">{item.subject} · 고{item.grade}</span>
                    </div>
                    <p className="card-meta">좋아요 {item.likeCount} · 답변 {item.answerCount}</p>
                    <div className="hero-actions">
                      <Link className="secondary-button" href={`/questions/${item.id}`}>질문 보기</Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard eyebrow="커뮤니티" title={`커뮤니티 글 ${community.posts.length}건`}>
            {community.posts.length === 0 ? (
              <div className="empty-state">검색어가 포함된 커뮤니티 글 제목이 없습니다.</div>
            ) : (
              <div className="stack-list">
                {community.posts.map((item) => (
                  <article key={item.id} className="surface-card">
                    <div className="profile-activity-topline">
                      <strong>{item.title}</strong>
                      <span className="card-meta">{item.authorName}</span>
                    </div>
                    <p className="card-meta">조회 {item.viewCount} · 좋아요 {item.likeCount}</p>
                    <div className="hero-actions">
                      <Link className="secondary-button" href="/community">커뮤니티에서 보기</Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard eyebrow="풀이영상" title={`풀이영상 ${videos.length}건`}>
            {videos.length === 0 ? (
              <div className="empty-state">검색어가 포함된 영상 제목이 없습니다.</div>
            ) : (
              <div className="stack-list">
                {videos.map((item) => (
                  <article key={item.id} className="surface-card">
                    <div className="profile-activity-topline">
                      <strong>{item.title}</strong>
                      <span className="community-badge subtle">{item.subject || '일반'}</span>
                    </div>
                    <p className="card-meta">조회 {item.viewCount} · 좋아요 {item.likeCount}</p>
                    <div className="hero-actions">
                      <Link className="secondary-button" href={`/videos/${item.id}`}>영상 보기</Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </SiteShell>
  );
}
