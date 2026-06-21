'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SiteShell } from '../../components/site-shell';
import { SectionCard } from '../../components/section-card';
import { deleteVideo, getFilteredVideos, likeVideo } from '../../lib/api';
import type { VideoItem } from '../../lib/types';
import { useAuthUser } from '../../components/role-provider';

const VIDEO_SUBJECTS = ['전체', '수학', '영어', '국어', '과학', '사회', '기타'] as const;
const ITEMS_PER_PAGE = 10;

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function VideosPage() {
  const router = useRouter();
  const { authUser, authResolved } = useAuthUser();
  const params = useSearchParams();
  const focusId = params.get('focus') ?? '';

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState<(typeof VIDEO_SUBJECTS)[number]>('전체');
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [likedByVideo, setLikedByVideo] = useState<Record<string, boolean>>({});
  const [deletingByVideo, setDeletingByVideo] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const guestRedirectingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const fetched = await getFilteredVideos({ search, subject, sort });
        if (!mounted) return;
        setVideos(fetched);
        setCurrentPage(1);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : '영상을 불러오지 못했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [search, sort, subject]);

  const sortedVideos = useMemo(() => {
    if (!focusId) return videos;
    const target = videos.find((video) => video.id === focusId);
    if (!target) return videos;
    return [target, ...videos.filter((video) => video.id !== focusId)];
  }, [focusId, videos]);

  const totalPages = Math.max(1, Math.ceil(sortedVideos.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedVideos = sortedVideos.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleLike = async (videoId: string) => {
    if (!authUser) {
      window.alert('좋아요는 로그인 후 사용할 수 있습니다.');
      return;
    }

    const result = await likeVideo(videoId, authUser.id);
    setVideos((prev) => prev.map((video) => video.id === videoId ? { ...video, likeCount: result.likeCount, viewCount: result.viewCount } : video));
    setLikedByVideo((prev) => ({ ...prev, [videoId]: result.liked }));
  };

  const goToDetail = (videoId: string) => {
    if (!authResolved) {
      return;
    }

    if (!authUser) {
      if (guestRedirectingRef.current) {
        return;
      }

      guestRedirectingRef.current = true;
      window.alert('로그인/회원가입 후 영상을 볼 수 있습니다.');
      router.push('/profile');
      return;
    }

    router.push(`/videos/${videoId}`);
  };

  const handleDelete = async (videoId: string) => {
    if (!authUser || authUser.role !== 'admin') {
      return;
    }

    if (!window.confirm('이 영상을 삭제하시겠습니까?')) {
      return;
    }

    setDeletingByVideo((prev) => ({ ...prev, [videoId]: true }));
    try {
      await deleteVideo(videoId, authUser.id);
      setVideos((prev) => prev.filter((video) => video.id !== videoId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '영상 삭제에 실패했습니다.');
    } finally {
      setDeletingByVideo((prev) => ({ ...prev, [videoId]: false }));
    }
  };

  return (
    <SiteShell title="모든 풀이 영상보기" description="여태 올라온 영상 풀이를 모아보고, 검색해서 바로 재생할 수 있습니다.">
      <SectionCard eyebrow="전체 영상" title="영상 검색 및 바로 보기">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput.trim());
          }}
          style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}
        >
          <input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="제목으로 검색 (예: 수학, 함수, 영어)"
            style={{ flex: 1 }}
          />
          <button type="submit" className="primary-button">검색</button>
        </form>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <strong style={{ alignSelf: 'center' }}>과목 선택</strong>
          {VIDEO_SUBJECTS.map((item) => (
            <button
              key={item}
              type="button"
              className={subject === item ? 'primary-button' : 'secondary-button'}
              onClick={() => setSubject(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className={sort === 'popular' ? 'primary-button' : 'secondary-button'}
            onClick={() => setSort('popular')}
          >
            인기순
          </button>
          <button
            type="button"
            className={sort === 'latest' ? 'primary-button' : 'secondary-button'}
            onClick={() => setSort('latest')}
          >
            최신순
          </button>
        </div>

        {loading ? <div className="empty-state">영상을 불러오는 중입니다...</div> : null}
        {error ? <p className="form-message error">{error}</p> : null}

        {!loading && !error ? (
          sortedVideos.length > 0 ? (
            <>
              <div className="card-grid two-up">
                {paginatedVideos.map((video) => (
                  <article
                    key={video.id}
                    className="surface-card"
                    role="button"
                    tabIndex={0}
                    style={{ border: video.id === focusId ? '2px solid #2b6ccf' : undefined }}
                    onClick={() => goToDetail(video.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        goToDetail(video.id);
                      }
                    }}
                  >
                    <div className="card-meta">
                      {video.subject} · {formatDuration(video.durationSeconds)} · {new Date(video.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                    <h3>{video.title}</h3>
                    <video src={video.url} style={{ width: '100%', borderRadius: '12px', cursor: 'pointer' }} />
                    <div className="card-footer" style={{ marginTop: '0.6rem' }}>
                      <span>좋아요 {video.likeCount} · 조회 {video.viewCount}</span>
                      <div>
                        {authUser?.role === 'admin' ? (
                          <button
                            type="button"
                            className="text-link action-danger"
                            disabled={Boolean(deletingByVideo[video.id])}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDelete(video.id);
                            }}
                          >
                            {deletingByVideo[video.id] ? '삭제 중...' : '삭제'}
                          </button>
                        ) : null}
                        {authUser?.role === 'admin' ? ' · ' : null}
                        <button
                          type="button"
                          className={`heart-like-button ${likedByVideo[video.id] ? 'active' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleLike(video.id);
                          }}
                        >
                          ♥
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={`video-page-${page}`}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      style={{
                        padding: '0.35rem 0.7rem',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                        background: page === safePage ? '#3b82f6' : '#fff',
                        color: page === safePage ? '#fff' : '#333',
                        fontWeight: page === safePage ? 700 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">등록된 영상이 없습니다.</div>
          )
        ) : null}
      </SectionCard>
    </SiteShell>
  );
}
