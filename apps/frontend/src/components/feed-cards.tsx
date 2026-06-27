'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { deleteQuestion, likeQuestion, likeVideo } from '../lib/api';
import { createReportLink } from '../lib/report-links';
import { useAuthUser } from './role-provider';

export function VideoGrid({ videos }: { videos: Array<{ id: string; title: string; subject: string; url: string; durationSeconds: number; likeCount: number; viewCount: number; createdAt: string }> }) {
  const router = useRouter();
  const { authUser } = useAuthUser();
  const [items, setItems] = useState(videos);
  const [likedByVideo, setLikedByVideo] = useState<Record<string, boolean>>({});
  const canInlinePlay = (url: string) => url.startsWith('data:video') || /\.(mp4|webm|ogg)(\?|$)/i.test(url);

  useEffect(() => {
    setItems(videos);
  }, [videos]);

  const goToDetail = (videoId: string) => {
    router.push(`/videos/${videoId}`);
  };

  const handleLikeVideo = async (videoId: string) => {
    if (!authUser) {
      window.alert('좋아요는 로그인 후 사용할 수 있습니다.');
      return;
    }

    const result = await likeVideo(videoId, authUser.id);
    setItems((prev) =>
      prev.map((video) =>
        video.id === videoId ? { ...video, likeCount: result.likeCount, viewCount: result.viewCount } : video,
      ),
    );
    setLikedByVideo((prev) => ({ ...prev, [videoId]: result.liked }));
  };

  return (
    <div className="card-grid two-up">
      {items.map((video) => (
        <article
          key={video.id}
          className="surface-card accent-border video-card"
          role="button"
          tabIndex={0}
          onClick={() => goToDetail(video.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              goToDetail(video.id);
            }
          }}
        >
          <div className="card-meta">{video.subject} · 영상 · {Math.round(video.durationSeconds / 60)}분</div>
          <h3>{video.title}</h3>
          {canInlinePlay(video.url) ? (
            <video src={video.url} className="answer-attachment-video" style={{ cursor: 'pointer' }} />
          ) : (
            <p className="card-meta">미리보기는 상세에서 확인할 수 있어요.</p>
          )}
          <div className="card-footer">
            <span>좋아요 {video.likeCount} · 조회 {video.viewCount} · {new Date(video.createdAt).toLocaleDateString('ko-KR')}</span>
            <div>
              <button
                type="button"
                className={`heart-like-button ${likedByVideo[video.id] ? 'active' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleLikeVideo(video.id);
                }}
                aria-label="영상 좋아요 토글"
                title="영상 좋아요 토글"
              >
                ♥
              </button>
              {' · '}
              <Link
                href={createReportLink({
                  targetType: 'video',
                  targetId: video.id,
                  sourceLabel: '풀이 영상',
                  reason: '부적절한 영상 내용',
                })}
                className="text-link action-report"
                onClick={(event) => event.stopPropagation()}
              >
                신고하기
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

type QuestionListItem = {
  id: string;
  authorId?: string;
  title: string;
  body: string;
  subject: string;
  grade: string;
  status: string;
  likeCount: number;
  viewCount: number;
  answerCount: number;
  createdAt: string;
};

function QuestionCards({
  items,
  startIndex,
  totalCount,
  authUser,
  onDelete,
  onLike,
  likedState,
}: {
  items: QuestionListItem[];
  startIndex: number;
  totalCount: number;
  authUser: ReturnType<typeof useAuthUser>['authUser'];
  onDelete: (questionId: string) => Promise<void>;
  onLike: (questionId: string) => Promise<void>;
  likedState: Record<string, boolean>;
}) {
  const router = useRouter();

  return (
    <>
      {items.map((question, index) => {
        const absoluteIndex = startIndex + index;
        const policyLabel = totalCount === 10
          ? (absoluteIndex < 7 ? '인기 질문' : '도움 필요 질문')
          : null;

        return (
        <article
          key={question.id}
          className="surface-card question-card"
          role="button"
          tabIndex={0}
          onClick={() => router.push(`/questions/${question.id}`)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              router.push(`/questions/${question.id}`);
            }
          }}
        >
          <div className="question-index">{String(startIndex + index + 1).padStart(2, '0')}</div>
          <div>
            <div className="card-meta">
              {policyLabel ? <span>{policyLabel}</span> : null}
              {policyLabel ? ' · ' : ''}
              {question.subject} · 고{question.grade} · {question.status}
            </div>
            <h3>
              <Link href={`/questions/${question.id}`} className="question-title-link">
                {question.title}
              </Link>
            </h3>
            <p>{question.body}</p>
            <div className="card-footer">
              <span>좋아요 {question.likeCount} · 조회 {question.viewCount} · 답변 {question.answerCount}개</span>
              <div>
                <button
                  type="button"
                  className={`heart-like-button ${likedState[question.id] ? 'active' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onLike(question.id);
                  }}
                  aria-label="좋아요 토글"
                  title="좋아요 토글"
                >
                  ♥
                </button>
                {' · '}
                <span>{new Date(question.createdAt).toLocaleDateString('ko-KR')}</span>
                {' · '}
                {!authUser || authUser.id !== question.authorId ? (
                  <Link
                    href={createReportLink({
                      targetType: 'question',
                      targetId: question.id,
                      sourceLabel: '질문 게시글',
                      reason: '부적절한 질문 내용',
                    })}
                    className="text-link action-report"
                    onClick={(event) => event.stopPropagation()}
                  >
                    신고하기
                  </Link>
                ) : null}
                {authUser && 'authorId' in question && (authUser.id === question.authorId || authUser.role === 'admin') ? (
                  <>
                    {' · '}
                    <button
                      type="button"
                      className="text-link action-danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onDelete(question.id);
                      }}
                    >
                      삭제
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </article>
        );
      })}
    </>
  );
}

export function QuestionList({
  questions,
  autoSlide = false,
  itemsPerSlide = 2,
  slideIntervalMs = 4500,
}: {
  questions: QuestionListItem[];
  autoSlide?: boolean;
  itemsPerSlide?: number;
  slideIntervalMs?: number;
}) {
  const { authUser } = useAuthUser();
  const [items, setItems] = useState(questions);
  const [likedState, setLikedState] = useState<Record<string, boolean>>({});
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    setItems(questions);
  }, [questions]);

  const normalizedItemsPerSlide = Math.max(1, itemsPerSlide);
  const slides = useMemo(() => {
    const grouped: QuestionListItem[][] = [];
    for (let index = 0; index < items.length; index += normalizedItemsPerSlide) {
      grouped.push(items.slice(index, index + normalizedItemsPerSlide));
    }
    return grouped;
  }, [items, normalizedItemsPerSlide]);

  useEffect(() => {
    if (!autoSlide || slides.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, slideIntervalMs);

    return () => window.clearInterval(interval);
  }, [autoSlide, slideIntervalMs, slides.length]);

  useEffect(() => {
    if (currentSlide >= slides.length) {
      setCurrentSlide(0);
    }
  }, [currentSlide, slides.length]);

  const handleDelete = async (questionId: string) => {
    if (!authUser || !window.confirm('삭제하시겠습니까?')) {
      return;
    }

    await deleteQuestion(questionId, authUser.id);
    setItems((prev) => prev.filter((question) => question.id !== questionId));
  };

  const handleLike = async (questionId: string) => {
    if (!authUser) {
      window.alert('좋아요는 로그인 후 사용할 수 있습니다.');
      return;
    }

    const response = await likeQuestion(questionId, authUser.id);
    const currentLiked = Boolean(likedState[questionId]);
    const nextLiked = typeof response.liked === 'boolean' ? response.liked : !currentLiked;

    setItems((prev) =>
      prev.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const nextLikeCount = typeof response.liked === 'boolean'
          ? response.likeCount
          : Math.max(0, question.likeCount + (nextLiked ? 1 : -1));

        return { ...question, likeCount: nextLikeCount };
      }),
    );
    setLikedState((prev) => ({ ...prev, [questionId]: nextLiked }));
  };

  if (autoSlide) {
    if (slides.length === 0) {
      return <div className="empty-state">아직 표시할 질문이 없습니다.</div>;
    }

    return (
      <div className="question-carousel-wrap" aria-live="polite">
        <div
          className="question-carousel-track"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slideItems, slideIndex) => (
            <div className="question-carousel-slide" key={`question-slide-${slideIndex}`}>
              <div className="question-carousel-grid">
                <QuestionCards
                  items={slideItems}
                  startIndex={slideIndex * normalizedItemsPerSlide}
                  totalCount={items.length}
                  authUser={authUser}
                  onDelete={handleDelete}
                  onLike={handleLike}
                  likedState={likedState}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stack-list">
      <QuestionCards
        items={items}
        startIndex={0}
        totalCount={items.length}
        authUser={authUser}
        onDelete={handleDelete}
        onLike={handleLike}
        likedState={likedState}
      />
    </div>
  );
}