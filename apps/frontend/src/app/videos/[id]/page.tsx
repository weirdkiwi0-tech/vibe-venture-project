'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionCard } from '../../../components/section-card';
import { SiteShell } from '../../../components/site-shell';
import { useAuthUser } from '../../../components/role-provider';
import { createReportLink } from '../../../lib/report-links';
import {
  createVideoComment,
  deleteVideo,
  getVideoById,
  getVideoComments,
  likeVideo,
  trackVideoView,
} from '../../../lib/api';
import type { VideoCommentItem, VideoItem } from '../../../lib/types';

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { authUser, authResolved } = useAuthUser();

  const id = typeof params?.id === 'string' ? params.id : '';

  const [video, setVideo] = useState<VideoItem | null>(null);
  const [comments, setComments] = useState<VideoCommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liked, setLiked] = useState(false);
  const [viewTracked, setViewTracked] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const guestRedirectedRef = useRef(false);

  useEffect(() => {
    if (!authResolved) {
      return;
    }

    if (!authUser) {
      if (guestRedirectedRef.current) {
        return;
      }

      guestRedirectedRef.current = true;
      window.alert('로그인/회원가입 후 영상을 볼 수 있습니다.');
      router.replace('/profile');
    }
  }, [authResolved, authUser, router]);

  useEffect(() => {
    if (authResolved && !authUser) {
      return;
    }

    if (!id) {
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [videoResult, commentResult] = await Promise.all([getVideoById(id), getVideoComments(id)]);
        if (!mounted) {
          return;
        }

        setVideo(videoResult);
        setComments(commentResult);
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(err instanceof Error ? err.message : '영상 정보를 불러오지 못했습니다.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!video || viewTracked) {
      return;
    }

    let mounted = true;

    const run = async () => {
      try {
        const result = await trackVideoView(video.id);
        if (!mounted) {
          return;
        }

        setVideo((prev) => (prev ? { ...prev, viewCount: result.viewCount, likeCount: result.likeCount } : prev));
        setViewTracked(true);
      } catch {
        if (mounted) {
          setViewTracked(true);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [video, viewTracked]);

  const reportHref = useMemo(() => {
    if (!video) {
      return '/reports/new';
    }

    return createReportLink({
      targetType: 'video',
      targetId: video.id,
      sourceLabel: '풀이 영상',
      reason: '부적절한 영상 내용',
    });
  }, [video]);

  const handleLike = async () => {
    if (!video) {
      return;
    }

    if (!authUser) {
      window.alert('좋아요는 로그인 후 사용할 수 있습니다.');
      return;
    }

    const result = await likeVideo(video.id, authUser.id);
    setVideo((prev) => (prev ? { ...prev, likeCount: result.likeCount, viewCount: result.viewCount } : prev));
    setLiked(result.liked);
  };

  const handleCreateComment = async () => {
    if (!video) {
      return;
    }

    if (!authUser) {
      window.alert('댓글은 로그인 후 작성할 수 있습니다.');
      return;
    }

    const content = commentDraft.trim();
    if (!content) {
      return;
    }

    setCommentSaving(true);
    try {
      const created = await createVideoComment({
        videoId: video.id,
        content,
        userId: authUser.id,
      });

      setComments((prev) => [...prev, created]);
      setCommentDraft('');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '댓글 등록에 실패했습니다.');
    } finally {
      setCommentSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!video || !authUser || authUser.role !== 'admin') {
      return;
    }

    if (!window.confirm('이 영상을 삭제하시겠습니까?')) {
      return;
    }

    setDeleting(true);
    try {
      await deleteVideo(video.id, authUser.id);
      router.push('/videos');
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '영상 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SiteShell title="풀이영상 상세" description="큰 화면으로 보고, 댓글과 신고를 바로 처리할 수 있습니다.">
      <SectionCard eyebrow="영상 플레이어" title="풀이영상 크게 보기">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
          <button type="button" className="secondary-button" onClick={() => router.push('/videos')}>
            목록으로
          </button>
          {authUser?.role === 'admin' && video ? (
            <button type="button" className="text-link action-danger" disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? '삭제 중...' : '이 영상 삭제'}
            </button>
          ) : null}
          {video ? (
            <Link href={reportHref} className="text-link action-report">
              이 영상 신고
            </Link>
          ) : null}
        </div>

        {loading ? <div className="empty-state">영상을 불러오는 중입니다...</div> : null}
        {authResolved && !authUser ? <div className="empty-state">로그인 화면으로 이동 중입니다...</div> : null}
        {error ? <p className="form-message error">{error}</p> : null}

        {!loading && !error && video ? (
          <article className="surface-card" style={{ padding: '1rem' }}>
            <div className="card-meta">
              {video.subject} · {formatDuration(video.durationSeconds)} · {new Date(video.createdAt).toLocaleDateString('ko-KR')}
            </div>
            <h3 style={{ marginTop: '0.35rem', marginBottom: '0.6rem' }}>{video.title}</h3>
            <video
              src={video.url}
              controls
              style={{ width: '100%', borderRadius: '12px', maxHeight: '72vh' }}
            />
            <div className="card-footer" style={{ marginTop: '0.7rem' }}>
              <span>좋아요 {video.likeCount} · 조회 {video.viewCount}</span>
              <button
                type="button"
                className={`heart-like-button ${liked ? 'active' : ''}`}
                onClick={() => void handleLike()}
                aria-label="좋아요 토글"
              >
                ♥
              </button>
            </div>
          </article>
        ) : null}
      </SectionCard>

      <SectionCard eyebrow="댓글" title="영상 댓글">
        {!authUser ? <p className="auth-status">로그인 후 댓글을 작성할 수 있습니다.</p> : null}

        <div className="form-grid" style={{ gap: '0.5rem' }}>
          <textarea
            rows={3}
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            placeholder="풀이 영상에 대한 질문이나 피드백을 남겨보세요"
            disabled={!authUser || !video}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="primary-button"
              disabled={!authUser || !video || commentSaving}
              onClick={() => void handleCreateComment()}
            >
              {commentSaving ? '등록 중...' : '댓글 등록'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.6rem', marginTop: '1rem' }}>
          {comments.length === 0 ? <div className="empty-state">첫 댓글을 남겨보세요.</div> : null}
          {comments.map((comment) => (
            <article key={comment.id} className="surface-card" style={{ padding: '0.8rem' }}>
              <div className="card-meta">
                {comment.authorId} · {new Date(comment.createdAt).toLocaleString('ko-KR')}
              </div>
              <p style={{ margin: '0.4rem 0 0' }}>{comment.content}</p>
              <div style={{ marginTop: '0.35rem' }}>
                <Link
                  href={createReportLink({
                    targetType: 'comment',
                    targetId: comment.id,
                    sourceLabel: '영상 댓글',
                    reason: '부적절한 댓글 내용',
                  })}
                  className="text-link action-report"
                >
                  신고하기
                </Link>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </SiteShell>
  );
}
