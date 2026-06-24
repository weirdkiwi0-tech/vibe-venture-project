'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  createCommunityPostComment,
  deleteCommunityPost,
  likeCommunityPost,
  likeCommunityPostComment,
  updateCommunityPost,
  updateCommunityPostComment,
} from '../lib/api';
import { createReportLink } from '../lib/report-links';
import { useCommunityPreferences } from '../lib/community-preferences';
import { useAuthUser } from './role-provider';
import { CommunityProfileModal } from './community-profile-modal';
import { AnonymousProfileBadge } from './anonymous-profile-badge';
import type { CommunityPostCommentItem, CommunityPostDetail } from '../lib/types';

interface CommunityPostWindowProps {
  initialPost: CommunityPostDetail;
  initialComments: CommunityPostCommentItem[];
}

export function CommunityPostWindow({ initialPost, initialComments }: CommunityPostWindowProps) {
  const { authUser } = useAuthUser();
  const { preferences } = useCommunityPreferences();
  const [post, setPost] = useState(initialPost);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [postTitleDraft, setPostTitleDraft] = useState(initialPost.title);
  const [postContentDraft, setPostContentDraft] = useState(initialPost.content);
  const [postSaving, setPostSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [comments, setComments] = useState(initialComments);
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyDraftByComment, setReplyDraftByComment] = useState<Record<string, string>>({});
  const [openReplyByComment, setOpenReplyByComment] = useState<Record<string, boolean>>({});
  const [commentSaving, setCommentSaving] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentEditDraft, setCommentEditDraft] = useState('');
  const [commentEditSaving, setCommentEditSaving] = useState(false);
  const [likeLoadingByComment, setLikeLoadingByComment] = useState<Record<string, boolean>>({});
  const [likedByComment, setLikedByComment] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setPost(initialPost);
    setPostTitleDraft(initialPost.title);
    setPostContentDraft(initialPost.content);
    setIsEditingPost(false);
    setComments(initialComments);
    setEditingCommentId(null);
    setCommentEditDraft('');
    setReplyDraftByComment({});
    setOpenReplyByComment({});
    setLikeLoadingByComment({});
    setLikedByComment({});
  }, [initialPost, initialComments]);

  const isPostOwner = useMemo(() => authUser?.id === post.authorId, [authUser?.id, post.authorId]);

  const canEditComment = (comment: CommunityPostCommentItem) => authUser?.id === comment.authorId;

  const appendCommentToTree = (
    currentComments: CommunityPostCommentItem[],
    nextComment: CommunityPostCommentItem,
  ): CommunityPostCommentItem[] => {
    if (!nextComment.parentCommentId) {
      return [...currentComments, nextComment];
    }

    const appendTo = (nodes: CommunityPostCommentItem[]): CommunityPostCommentItem[] =>
      nodes.map((node) => {
        if (node.id === nextComment.parentCommentId) {
          return { ...node, replies: [...node.replies, nextComment] };
        }

        if (node.replies.length === 0) {
          return node;
        }

        return { ...node, replies: appendTo(node.replies) };
      });

    return appendTo(currentComments);
  };

  const updateCommentInTree = (
    currentComments: CommunityPostCommentItem[],
    commentId: string,
    updater: (comment: CommunityPostCommentItem) => CommunityPostCommentItem,
  ): CommunityPostCommentItem[] =>
    currentComments.map((comment) => {
      if (comment.id === commentId) {
        return updater(comment);
      }

      if (comment.replies.length === 0) {
        return comment;
      }

      return {
        ...comment,
        replies: updateCommentInTree(comment.replies, commentId, updater),
      };
    });

  const handleStartEditPost = () => {
    setPostTitleDraft(post.title);
    setPostContentDraft(post.content);
    setIsEditingPost(true);
    setMessage('');
  };

  const handleCancelEditPost = () => {
    setPostTitleDraft(post.title);
    setPostContentDraft(post.content);
    setIsEditingPost(false);
  };

  const handleSavePostEdit = async () => {
    if (!authUser) {
      setMessage('수정은 로그인 후 이용해주세요.');
      return;
    }

    const title = postTitleDraft.trim();
    const content = postContentDraft.trim();
    if (!title || !content) {
      setMessage('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setPostSaving(true);
    try {
      const updated = await updateCommunityPost({ postId: post.id, title, content, userId: authUser.id });
      setPost(updated);
      setIsEditingPost(false);
      setMessage('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.toLowerCase().includes('only author can edit post')) {
        setMessage('작성자만 수정할 수 있어요.');
        return;
      }
      setMessage(errorMessage || '게시글 수정 중 오류가 발생했습니다.');
    } finally {
      setPostSaving(false);
    }
  };

  const handleOpenCommentComposer = () => {
    setCommentComposerOpen(true);
    setMessage('');
  };

  const handleCreateComment = async (parentCommentId?: string) => {
    if (!authUser) {
      setMessage('댓글은 로그인 후 이용해주세요.');
      return;
    }

    const draft = parentCommentId ? (replyDraftByComment[parentCommentId] ?? '') : commentDraft;
    const content = draft.trim();
    if (!content) {
      setMessage('댓글 내용을 입력해주세요.');
      return;
    }

    setCommentSaving(true);
    try {
      const created = await createCommunityPostComment({
        postId: post.id,
        content,
        parentCommentId,
        authorVisibility: preferences.communityAuthorVisibility,
        userId: authUser.id,
      });
      setComments((prev) => appendCommentToTree(prev, created));
      if (parentCommentId) {
        setReplyDraftByComment((prev) => ({ ...prev, [parentCommentId]: '' }));
        setOpenReplyByComment((prev) => ({ ...prev, [parentCommentId]: false }));
      } else {
        setCommentDraft('');
      }
      setMessage('');
      if (!parentCommentId) {
        setCommentComposerOpen(false);
      }
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

  const handleStartEditComment = (comment: CommunityPostCommentItem) => {
    setEditingCommentId(comment.id);
    setCommentEditDraft(comment.content);
    setMessage('');
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setCommentEditDraft('');
  };

  const handleSaveCommentEdit = async (comment: CommunityPostCommentItem) => {
    if (!authUser) {
      setMessage('수정은 로그인 후 이용해주세요.');
      return;
    }

    const content = commentEditDraft.trim();
    if (!content) {
      setMessage('댓글 내용을 입력해주세요.');
      return;
    }

    setCommentEditSaving(true);
    try {
      const updated = await updateCommunityPostComment({
        postId: post.id,
        commentId: comment.id,
        content,
        userId: authUser.id,
      });
      setComments((prev) => updateCommentInTree(prev, comment.id, () => updated));
      setEditingCommentId(null);
      setCommentEditDraft('');
      setMessage('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.toLowerCase().includes('only author can edit comment')) {
        setMessage('작성자만 수정할 수 있어요.');
        return;
      }
      setMessage(errorMessage || '댓글 수정 중 오류가 발생했습니다.');
    } finally {
      setCommentEditSaving(false);
    }
  };

  const handleLikeComment = async (comment: CommunityPostCommentItem) => {
    if (!authUser) {
      setMessage('좋아요는 로그인 후 이용해주세요.');
      return;
    }

    setLikeLoadingByComment((prev) => ({ ...prev, [comment.id]: true }));
    try {
      const result = await likeCommunityPostComment({ postId: post.id, commentId: comment.id, userId: authUser.id });
      setComments((prev) => updateCommentInTree(prev, comment.id, (item) => ({ ...item, likeCount: result.likeCount })));
      setLikedByComment((prev) => ({ ...prev, [comment.id]: result.liked }));
      setMessage('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      setMessage(errorMessage || '댓글 좋아요 처리 중 오류가 발생했습니다.');
    } finally {
      setLikeLoadingByComment((prev) => ({ ...prev, [comment.id]: false }));
    }
  };

  const renderComments = (nodes: CommunityPostCommentItem[], depth = 0) =>
    nodes.map((comment) => (
      <div key={comment.id} style={{ paddingLeft: depth > 0 ? '1rem' : 0, borderLeft: depth > 0 ? '2px solid #eee' : 'none', marginTop: '0.5rem' }}>
        <article style={{ padding: '0.5rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.15rem', alignItems: 'center' }}>
            {comment.authorVisibility === 'anonymous' ? (
              <AnonymousProfileBadge compact ariaLabel="익명 댓글 작성자" />
            ) : (
              <CommunityProfileModal
                userId={comment.authorId}
                viewerId={authUser?.id}
                displayName={comment.authorName}
                avatar={comment.authorAvatar}
                photoUrl={comment.authorPhotoUrl}
                compact
              />
            )}
            <span style={{ fontSize: '0.82rem', color: '#555' }}>{new Date(comment.createdAt).toLocaleDateString('ko-KR')}</span>
          </div>
          {editingCommentId === comment.id ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <textarea
                value={commentEditDraft}
                onChange={(event) => setCommentEditDraft(event.target.value)}
                rows={3}
                style={{ width: '100%', borderRadius: '8px', border: '1px solid #ccc', padding: '0.6rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="secondary-button" onClick={handleCancelEditComment} disabled={commentEditSaving}>
                  취소
                </button>
                <button type="button" className="primary-button" onClick={() => void handleSaveCommentEdit(comment)} disabled={commentEditSaving}>
                  {commentEditSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{comment.content}</p>
          )}
          <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className={`heart-like-button ${likedByComment[comment.id] ? 'active' : ''}`}
              onClick={() => void handleLikeComment(comment)}
              disabled={likeLoadingByComment[comment.id]}
              aria-pressed={likedByComment[comment.id] ?? false}
            >
              ♥ {comment.likeCount}
            </button>
            <button
              type="button"
              className="text-link"
              onClick={() => setOpenReplyByComment((prev) => ({ ...prev, [comment.id]: !prev[comment.id] }))}
            >
              답글
            </button>
            {canEditComment(comment) && editingCommentId !== comment.id ? (
              <button type="button" className="text-link" onClick={() => void handleStartEditComment(comment)}>
                수정
              </button>
            ) : null}
            {canEditComment(comment) && editingCommentId === comment.id ? (
              <span className="card-meta">편집 중</span>
            ) : null}
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

          {openReplyByComment[comment.id] ? (
            <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.45rem' }}>
              <textarea
                value={replyDraftByComment[comment.id] ?? ''}
                onChange={(event) => setReplyDraftByComment((prev) => ({ ...prev, [comment.id]: event.target.value }))}
                rows={2}
                placeholder="답글을 입력하세요"
                style={{ width: '100%', borderRadius: '8px', border: '1px solid #ccc', padding: '0.6rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setOpenReplyByComment((prev) => ({ ...prev, [comment.id]: false }))}
                >
                  취소
                </button>
                <button type="button" className="primary-button" onClick={() => void handleCreateComment(comment.id)} disabled={commentSaving}>
                  {commentSaving ? '등록 중...' : '답글 등록'}
                </button>
              </div>
            </div>
          ) : null}
        </article>

        {comment.replies.length > 0 ? renderComments(comment.replies, depth + 1) : null}
      </div>
    ));

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
        {post.authorVisibility === 'anonymous' ? (
          <AnonymousProfileBadge ariaLabel="익명 게시글 작성자" />
        ) : (
          <CommunityProfileModal
            userId={post.authorId}
            viewerId={authUser?.id}
            displayName={post.authorName}
            avatar={post.authorAvatar}
            photoUrl={post.authorPhotoUrl}
          />
        )}
        <div style={{ display: 'flex', gap: '1rem', fontSize: '1rem', color: '#333', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span>날짜 {new Date(post.createdAt).toLocaleDateString('ko-KR')}</span>
          <span>조회수 {post.viewCount}</span>
          <span>좋아요 {post.likeCount}</span>
        </div>
      </div>

      <h2 style={{ margin: '0 0 0.85rem', fontSize: '2rem', lineHeight: 1.1 }}>{post.title}</h2>

      <section
        style={{
          border: '3px solid #111',
          borderRadius: '10px',
          minHeight: '320px',
          padding: '1.5rem',
          marginBottom: '1rem',
        }}
      >
        {isEditingPost ? (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <input
              type="text"
              value={postTitleDraft}
              onChange={(event) => setPostTitleDraft(event.target.value)}
              placeholder="게시글 제목"
              style={{ width: '100%', borderRadius: '8px', border: '1px solid #ccc', padding: '0.7rem' }}
            />
            <textarea
              value={postContentDraft}
              onChange={(event) => setPostContentDraft(event.target.value)}
              rows={10}
              placeholder="게시글 내용"
              style={{ width: '100%', borderRadius: '8px', border: '1px solid #ccc', padding: '0.7rem', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="secondary-button" onClick={handleCancelEditPost} disabled={postSaving}>
                취소
              </button>
              <button type="button" className="primary-button" onClick={() => void handleSavePostEdit()} disabled={postSaving}>
                {postSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        ) : (
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '1.25rem', lineHeight: 1.7 }}>{post.content}</p>
        )}
      </section>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <button type="button" className="primary-button" onClick={() => void handleLike()}>
          좋아요 {post.likeCount}
        </button>
        {isPostOwner && !isEditingPost ? (
          <button type="button" className="secondary-button" onClick={handleStartEditPost}>
            수정
          </button>
        ) : null}
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
        {(isPostOwner || authUser?.role === 'admin') && (
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
          {renderComments(comments)}
        </section>
      )}
    </article>
  );
}
