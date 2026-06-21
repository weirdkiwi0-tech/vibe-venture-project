'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createCommunityPostComment, deleteCommunityPost, likeCommunityPost } from '../lib/api';
import { createReportLink } from '../lib/report-links';
import { useAuthUser } from './role-provider';
import type { CommunityPostCommentItem, CommunityPostDetail } from '../lib/types';

interface CommunityPostWindowProps {
  initialPost: CommunityPostDetail;
  initialComments: CommunityPostCommentItem[];
}

export function CommunityPostWindow({ initialPost, initialComments }: CommunityPostWindowProps) {
  const { authUser } = useAuthUser();
  const [post, setPost] = useState(initialPost);
  const [message, setMessage] = useState('');
  const [comments, setComments] = useState(initialComments);
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleOpenCommentComposer = () => {
    setCommentComposerOpen(true);
    setMessage('');
  };

  const handleCreateComment = async () => {
    if (!authUser) {
      setMessage('댓글은 로그인 후 이용해주세요.');
      return;
    }

    const content = commentDraft.trim();
    if (!content) {
      setMessage('댓글 내용을 입력해주세요.');
      return;
    }

    setCommentSaving(true);
    try {
      const created = await createCommunityPostComment({
        postId: post.id,
        content,
        userId: authUser.id,
      });
      setComments((prev) => [...prev, created]);
      setCommentDraft('');
      setMessage('');
      setCommentComposerOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.toLowerCase().includes('login required') || errorMessage.includes('Unauthorized')) {
        setMessage('댓글은 로그인 후 이용해주세요.');
      } else {
        setMessage('댓글 등록 중 오류가 발생했습니다.');
      }
    } finally {
      setCommentSaving(false);
    }
  };

  const handleLike = async () => {
    if (!authUser) {
      setMessage('좋아요는 로그인 후 이용해주세요.');
      return;
    }

    try {
      const result = await likeCommunityPost(post.id);
      setPost((prev) => ({ ...prev, likeCount: result.likeCount }));
      setMessage('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.toLowerCase().includes('login required') || errorMessage.includes('Unauthorized')) {
        setMessage('로그인 후 이용해주세요.');
        return;
      }
      setMessage('좋아요 처리 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!authUser) {
      setMessage('삭제는 로그인 후 이용해주세요.');
      return;
    }
    if (!window.confirm('삭제하시겠습니까?')) return;

    setDeleting(true);
    try {
      await deleteCommunityPost(post.id, authUser.id);

      if (window.opener) {
        window.close();
        return;
      }

      window.location.href = '/community';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.toLowerCase().includes('only author can delete post')) {
        setMessage('작성자(또는 관리자)만 삭제할 수 있어요.');
        return;
      }
      if (errorMessage.toLowerCase().includes('post not found')) {
        setMessage('이미 삭제되었거나 존재하지 않는 게시글입니다.');
        return;
      }
      if (errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('login required')) {
        setMessage('로그인 후 다시 시도해주세요.');
        return;
      }
      setMessage(errorMessage || '게시글 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className="surface-card" style={{ padding: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '0.75rem',
          paddingBottom: '0.5rem',
          borderBottom: '2px solid #111',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '2rem', lineHeight: 1.1 }}>{post.title}</h2>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '1rem', color: '#333', flexWrap: 'wrap' }}>
          <span>날짜 {new Date(post.createdAt).toLocaleDateString('ko-KR')}</span>
          <span>조회수 {post.viewCount}</span>
          <span>좋아요 {post.likeCount}</span>
        </div>
      </div>

      <section
        style={{
          border: '3px solid #111',
          borderRadius: '10px',
          minHeight: '320px',
          padding: '1.5rem',
          marginBottom: '1rem',
        }}
      >
        <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '1.25rem', lineHeight: 1.7 }}>{post.content}</p>
      </section>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <button type="button" className="primary-button" onClick={() => void handleLike()}>
          좋아요 {post.likeCount}
        </button>
        <Link
          href={createReportLink({
            targetType: 'community-post',
            targetId: post.id,
            sourceLabel: '커뮤니티 게시글',
            reason: '부적절한 게시글 내용',
          })}
          className="text-link action-report"
        >
          게시글 신고
        </Link>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            if (window.opener) {
              window.close();
              return;
            }
            window.location.href = '/community';
          }}
        >
          닫기
        </button>
        {(post.isMine || authUser?.role === 'admin') && (
          <button type="button" className="text-link action-danger" onClick={() => void handleDelete()} disabled={deleting}>
            {deleting ? '삭제 중...' : '삭제'}
          </button>
        )}
        {message && <p style={{ color: '#dc3545', margin: 0 }}>{message}</p>}
      </div>

      <section style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: commentComposerOpen ? '0.75rem' : 0 }}>
        <button
          type="button"
          className="text-link"
          style={{ whiteSpace: 'nowrap' }}
          onClick={handleOpenCommentComposer}
        >
          댓글 달기
        </button>
      </section>

      {commentComposerOpen && (
        <section style={{ marginBottom: '1rem' }}>
          <textarea
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            rows={3}
            placeholder="댓글을 입력하세요"
            style={{ width: '100%', borderRadius: '8px', border: '1px solid #ccc', padding: '0.6rem' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setCommentComposerOpen(false);
                setCommentDraft('');
              }}
            >
              취소
            </button>
            <button type="button" className="primary-button" onClick={() => void handleCreateComment()} disabled={commentSaving}>
              {commentSaving ? '등록 중...' : '등록'}
            </button>
          </div>
        </section>
      )}

      {comments.length > 0 && (
        <section style={{ borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
          {comments.map((comment) => (
            <article key={comment.id} style={{ padding: '0.5rem 0' }}>
              <div style={{ fontSize: '0.88rem', color: '#555', marginBottom: '0.15rem' }}>
                {comment.authorName} · {new Date(comment.createdAt).toLocaleDateString('ko-KR')}
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{comment.content}</p>
              <div style={{ marginTop: '0.25rem' }}>
                <Link
                  href={createReportLink({
                    targetType: 'comment',
                    targetId: comment.id,
                    sourceLabel: '커뮤니티 댓글',
                    reason: '부적절한 댓글 내용',
                  })}
                  className="text-link action-report"
                >
                  신고하기
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </article>
  );
}
