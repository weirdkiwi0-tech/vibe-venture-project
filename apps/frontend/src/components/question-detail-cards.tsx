'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createAnswerComment, deleteAnswer, deleteQuestion, likeAnswer, likeAnswerComment, likeQuestion } from '../lib/api';
import { createReportLink } from '../lib/report-links';
import type { QuestionAnswerCommentItem, QuestionAnswerItem, QuestionItem } from '../lib/types';
import { useAuthUser } from './role-provider';

async function toAttachmentValue(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

export function QuestionDetailCard({ question }: { question: QuestionItem }) {
  const router = useRouter();
  const { authUser } = useAuthUser();
  const [deleting, setDeleting] = useState(false);
  const [likeCount, setLikeCount] = useState(question.likeCount);
  const [liked, setLiked] = useState(false);

  const handleDelete = async () => {
    const requestUserId = authUser?.id;
    const canDeleteQuestion = Boolean(authUser && (authUser.id === question.authorId || authUser.role === 'admin'));
    if (!canDeleteQuestion || !requestUserId || !window.confirm('삭제하시겠습니까?')) {
      return;
    }

    setDeleting(true);
    try {
      await deleteQuestion(question.id, requestUserId);
      router.push('/questions');
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  const handleLike = async () => {
    if (!authUser) {
      window.alert('좋아요는 로그인 후 사용할 수 있습니다.');
      return;
    }

    const response = await likeQuestion(question.id, authUser.id);
    const nextLiked = typeof response.liked === 'boolean' ? response.liked : !liked;
    const nextLikeCount = typeof response.liked === 'boolean'
      ? response.likeCount
      : Math.max(0, likeCount + (nextLiked ? 1 : -1));

    setLikeCount(nextLikeCount);
    setLiked(nextLiked);
  };

  return (
    <div className="surface-card">
      <div className="card-meta">
        {question.subject} · 고{question.grade} · {question.status}
      </div>
      <p>{question.body}</p>
      {question.attachments.length > 0 ? (
        <div className="attachment-grid">
          {question.attachments.map((attachment, index) => (
            <img key={`${question.id}-attachment-${index}`} src={attachment} alt={`질문 첨부 ${index + 1}`} className="question-attachment" />
          ))}
        </div>
      ) : null}
      <div className="card-footer">
        <span>좋아요 {likeCount} · 조회 {question.viewCount} · 답변 {question.answerCount}개</span>
        <div>
          <button
            type="button"
            className={`heart-like-button ${liked ? 'active' : ''}`}
            onClick={() => void handleLike()}
            aria-label="좋아요 토글"
            title="좋아요 토글"
          >
            ♥
          </button>
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
            >
              이 질문 신고
            </Link>
          ) : null}
          {authUser && (authUser.id === question.authorId || authUser.role === 'admin') ? (
            <>
              {' · '}
              <button type="button" className="text-link action-danger" onClick={() => void handleDelete()} disabled={deleting}>
                삭제
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function QuestionAnswerList({ initialAnswers }: { initialAnswers: QuestionAnswerItem[] }) {
  const { authUser } = useAuthUser();
  const [answers, setAnswers] = useState(initialAnswers);
  const [commentDraftByAnswer, setCommentDraftByAnswer] = useState<Record<string, string>>({});
  const [replyDraftByComment, setReplyDraftByComment] = useState<Record<string, string>>({});
  const [commentVisibilityByAnswer, setCommentVisibilityByAnswer] = useState<Record<string, 'public' | 'anonymous'>>({});
  const [replyVisibilityByComment, setReplyVisibilityByComment] = useState<Record<string, 'public' | 'anonymous'>>({});
  const [commentFilesByAnswer, setCommentFilesByAnswer] = useState<Record<string, File[]>>({});
  const [replyFilesByComment, setReplyFilesByComment] = useState<Record<string, File[]>>({});
  const [openReplyByComment, setOpenReplyByComment] = useState<Record<string, boolean>>({});
  const [likeLoadingByAnswer, setLikeLoadingByAnswer] = useState<Record<string, boolean>>({});
  const [likedByAnswer, setLikedByAnswer] = useState<Record<string, boolean>>({});
  const [likeLoadingByComment, setLikeLoadingByComment] = useState<Record<string, boolean>>({});
  const [likedByComment, setLikedByComment] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setAnswers(initialAnswers);
  }, [initialAnswers]);

  const renderVisibilityToggle = (
    selected: 'public' | 'anonymous',
    onChange: (next: 'public' | 'anonymous') => void,
  ) => (
    <div style={{ display: 'inline-flex', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
      <button
        type="button"
        className="secondary-button"
        style={{ borderRadius: 0, border: 'none', background: selected === 'public' ? '#111827' : '#fff', color: selected === 'public' ? '#fff' : '#111827' }}
        onClick={() => onChange('public')}
      >
        아이디 공개
      </button>
      <button
        type="button"
        className="secondary-button"
        style={{ borderRadius: 0, border: 'none', background: selected === 'anonymous' ? '#111827' : '#fff', color: selected === 'anonymous' ? '#fff' : '#111827' }}
        onClick={() => onChange('anonymous')}
      >
        익명
      </button>
    </div>
  );

  const mutateAnswer = (answerId: string, mutate: (answer: QuestionAnswerItem) => QuestionAnswerItem) => {
    setAnswers((prev) => prev.map((answer) => (answer.id === answerId ? mutate(answer) : answer)));
  };

  const appendCommentToTree = (
    comments: QuestionAnswerCommentItem[],
    nextComment: QuestionAnswerCommentItem,
  ): QuestionAnswerCommentItem[] => {
    if (!nextComment.parentCommentId) {
      return [...comments, nextComment];
    }

    const appendTo = (nodes: QuestionAnswerCommentItem[]): QuestionAnswerCommentItem[] =>
      nodes.map((node) => {
        if (node.id === nextComment.parentCommentId) {
          return { ...node, replies: [...node.replies, nextComment] };
        }

        if (node.replies.length === 0) {
          return node;
        }

        return { ...node, replies: appendTo(node.replies) };
      });

    return appendTo(comments);
  };

  const handleDelete = async (answerId: string) => {
    if (!authUser || !window.confirm('삭제하시겠습니까?')) {
      return;
    }

    await deleteAnswer(answerId, authUser.id);
    setAnswers((prev) => prev.filter((answer) => answer.id !== answerId));
  };

  const handleLikeAnswer = async (answerId: string) => {
    if (!authUser) {
      window.alert('하트는 로그인 후 사용할 수 있습니다.');
      return;
    }

    setLikeLoadingByAnswer((prev) => ({ ...prev, [answerId]: true }));
    try {
      const result = await likeAnswer(answerId, authUser.id);
      mutateAnswer(answerId, (answer) => ({ ...answer, likeCount: result.likeCount }));
      setLikedByAnswer((prev) => ({ ...prev, [answerId]: result.liked }));
    } finally {
      setLikeLoadingByAnswer((prev) => ({ ...prev, [answerId]: false }));
    }
  };

  const handleCreateComment = async (answerId: string, parentCommentId?: string) => {
    if (!authUser) {
      window.alert('댓글은 로그인 후 작성할 수 있습니다.');
      return;
    }

    const key = parentCommentId ?? answerId;
    const content = (parentCommentId ? replyDraftByComment[parentCommentId] : commentDraftByAnswer[answerId])?.trim() ?? '';
    const selectedFiles = (parentCommentId ? replyFilesByComment[parentCommentId] : commentFilesByAnswer[answerId]) ?? [];
    const authorVisibility = parentCommentId
      ? (replyVisibilityByComment[parentCommentId] ?? 'public')
      : (commentVisibilityByAnswer[answerId] ?? 'public');
    if (!content) {
      return;
    }

    try {
      const attachments = await Promise.all(selectedFiles.slice(0, 4).map((file) => toAttachmentValue(file)));
      const comment = await createAnswerComment({
        answerId,
        content,
        attachments,
        parentCommentId,
        authorVisibility,
        userId: authUser.id,
      });

      mutateAnswer(answerId, (answer) => ({
        ...answer,
        comments: appendCommentToTree(answer.comments ?? [], comment),
      }));

      if (parentCommentId) {
        setReplyDraftByComment((prev) => ({ ...prev, [key]: '' }));
        setReplyFilesByComment((prev) => ({ ...prev, [key]: [] }));
        setOpenReplyByComment((prev) => ({ ...prev, [key]: false }));
      } else {
        setCommentDraftByAnswer((prev) => ({ ...prev, [key]: '' }));
        setCommentFilesByAnswer((prev) => ({ ...prev, [key]: [] }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '댓글 등록에 실패했습니다.';
      window.alert(message);
    }
  };

  const updateCommentLikeCount = (
    comments: QuestionAnswerCommentItem[],
    commentId: string,
    likeCount: number,
  ): QuestionAnswerCommentItem[] =>
    comments.map((comment) => {
      if (comment.id === commentId) {
        return { ...comment, likeCount };
      }

      if (comment.replies.length === 0) {
        return comment;
      }

      return {
        ...comment,
        replies: updateCommentLikeCount(comment.replies, commentId, likeCount),
      };
    });

  const handleLikeComment = async (answerId: string, commentId: string) => {
    if (!authUser) {
      window.alert('좋아요는 로그인 후 사용할 수 있습니다.');
      return;
    }

    setLikeLoadingByComment((prev) => ({ ...prev, [commentId]: true }));
    try {
      const result = await likeAnswerComment({ answerId, commentId, userId: authUser.id });
      mutateAnswer(answerId, (answer) => ({
        ...answer,
        comments: updateCommentLikeCount(answer.comments ?? [], commentId, result.likeCount),
      }));
      setLikedByComment((prev) => ({ ...prev, [commentId]: result.liked }));
    } finally {
      setLikeLoadingByComment((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  const renderComments = (answerId: string, comments: QuestionAnswerCommentItem[], depth = 0) => {
    return comments.map((comment) => (
      <div key={comment.id} className={depth > 0 ? 'reply-thread-nested' : 'reply-thread-root'}>
        <div className="surface-card reply-thread-card" style={{ padding: '0.6rem 0.8rem' }}>
          <div className="card-meta">{comment.authorName} · {new Date(comment.createdAt).toLocaleString('ko-KR')}</div>
          <p style={{ margin: '0.35rem 0' }}>{comment.content}</p>
          {(comment.attachments ?? []).length > 0 ? (
            <div className="attachment-grid" style={{ marginTop: '0.45rem' }}>
              {(comment.attachments ?? []).map((attachment, index) => {
                const key = `${comment.id}-attachment-${index}`;
                if (attachment.startsWith('data:video')) {
                  return <video key={key} src={attachment} controls className="answer-attachment-video" />;
                }
                if (attachment.startsWith('data:image')) {
                  return <img key={key} src={attachment} alt={`댓글 첨부 ${index + 1}`} className="question-attachment" />;
                }

                return null;
              })}
            </div>
          ) : null}
          <button
            type="button"
            className="text-link"
            onClick={() =>
              setOpenReplyByComment((prev) => ({
                ...prev,
                [comment.id]: !prev[comment.id],
              }))
            }
          >
            답글
          </button>
          {' · '}
          <button
            type="button"
            className={`heart-like-button ${likedByComment[comment.id] ? 'active' : ''}`}
            onClick={() => void handleLikeComment(answerId, comment.id)}
            disabled={likeLoadingByComment[comment.id]}
            aria-pressed={likedByComment[comment.id] ?? false}
          >
            ♥ {comment.likeCount ?? 0}
          </button>
          {' · '}
          <Link
            href={createReportLink({
              targetType: 'comment',
              targetId: comment.id,
              sourceLabel: '댓글/답글',
              reason: '부적절한 댓글 또는 답글',
            })}
            className="text-link action-report"
          >
            신고하기
          </Link>

          {openReplyByComment[comment.id] ? (
            <div className="reply-composer">
              {renderVisibilityToggle(
                replyVisibilityByComment[comment.id] ?? 'public',
                (next) => setReplyVisibilityByComment((prev) => ({ ...prev, [comment.id]: next })),
              )}
              <textarea
                rows={2}
                className="reply-input"
                value={replyDraftByComment[comment.id] ?? ''}
                placeholder="답글을 입력하세요"
                onChange={(event) =>
                  setReplyDraftByComment((prev) => ({
                    ...prev,
                    [comment.id]: event.target.value,
                  }))
                }
              />
              <input
                id={`reply-files-${comment.id}`}
                className="file-input-hidden"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []).filter((file) =>
                    file.type.startsWith('image/') || file.type.startsWith('video/'),
                  );
                  setReplyFilesByComment((prev) => ({ ...prev, [comment.id]: files }));
                }}
              />
              <div className="file-picker-row">
                <label htmlFor={`reply-files-${comment.id}`} className="file-picker-button">
                  파일 선택
                </label>
                <span className="file-picker-name">
                  {(replyFilesByComment[comment.id] ?? []).length > 0
                    ? (replyFilesByComment[comment.id] ?? []).map((file) => file.name).join(', ')
                    : '선택된 파일 없음'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button type="button" className="primary-button" onClick={() => void handleCreateComment(answerId, comment.id)}>
                  답글 등록
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setOpenReplyByComment((prev) => ({ ...prev, [comment.id]: false }))}
                >
                  취소
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {comment.replies.length > 0 ? renderComments(answerId, comment.replies, depth + 1) : null}
      </div>
    ));
  };

  if (answers.length === 0) {
    return <div className="empty-state">아직 답변이 없습니다.</div>;
  }

  return (
    <div className="stack-list">
      {answers.map((answer) => (
        <article key={answer.id} id={`answer-${answer.id}`} className="surface-card">
          <div className="card-meta">{answer.type}</div>
          <p>{answer.content}</p>
          {(answer.attachments ?? []).length > 0 ? (
            <div className="attachment-grid">
              {(answer.attachments ?? []).map((attachment, index) => {
                const key = `${answer.id}-attachment-${index}`;
                if (attachment.startsWith('data:video')) {
                  return <video key={key} src={attachment} controls className="answer-attachment-video" />;
                }
                if (attachment.startsWith('data:image')) {
                  return <img key={key} src={attachment} alt={`답변 첨부 ${index + 1}`} className="question-attachment" />;
                }

                return (
                  <a key={key} href={attachment} target="_blank" rel="noreferrer" className="text-link">
                    첨부자료 {index + 1} 열기
                  </a>
                );
              })}
            </div>
          ) : null}
          <div className="card-footer">
            <span>{new Date(answer.createdAt).toLocaleString('ko-KR')}</span>
            <div>
              <button
                type="button"
                className={`heart-like-button ${likedByAnswer[answer.id] ? 'active' : ''}`}
                onClick={() => void handleLikeAnswer(answer.id)}
                disabled={likeLoadingByAnswer[answer.id]}
                aria-label="답변 하트"
                title="답변 하트"
                aria-pressed={likedByAnswer[answer.id] ?? false}
              >
                ♥ {answer.likeCount ?? 0}
              </button>
              {' · '}
              {!authUser || authUser.id !== answer.authorId ? (
                <Link
                  href={createReportLink({
                    targetType: 'answer',
                    targetId: answer.id,
                    sourceLabel: answer.type === 'video' ? '풀이 영상 답변' : '댓글 답변',
                    reason: '부적절한 답변 내용',
                  })}
                  className="text-link action-report"
                >
                  신고하기
                </Link>
              ) : null}
              {authUser && (authUser.id === answer.authorId || authUser.role === 'admin') ? (
                <>
                  {' · '}
                  <button type="button" className="text-link action-danger" onClick={() => void handleDelete(answer.id)}>
                    삭제
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="answer-reply-section">
            <div className="card-meta">답글 {answer.comments?.length ?? 0}개</div>
            <div className="answer-reply-composer">
              {renderVisibilityToggle(
                commentVisibilityByAnswer[answer.id] ?? 'public',
                (next) => setCommentVisibilityByAnswer((prev) => ({ ...prev, [answer.id]: next })),
              )}
              <textarea
                rows={2}
                className="reply-input"
                placeholder="이 답변에 답글을 남겨보세요"
                value={commentDraftByAnswer[answer.id] ?? ''}
                onChange={(event) =>
                  setCommentDraftByAnswer((prev) => ({
                    ...prev,
                    [answer.id]: event.target.value,
                  }))
                }
              />
              <input
                id={`answer-reply-files-${answer.id}`}
                className="file-input-hidden"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []).filter((file) =>
                    file.type.startsWith('image/') || file.type.startsWith('video/'),
                  );
                  setCommentFilesByAnswer((prev) => ({ ...prev, [answer.id]: files }));
                }}
              />
              <div className="file-picker-row">
                <label htmlFor={`answer-reply-files-${answer.id}`} className="file-picker-button">
                  파일 선택
                </label>
                <span className="file-picker-name">
                  {(commentFilesByAnswer[answer.id] ?? []).length > 0
                    ? (commentFilesByAnswer[answer.id] ?? []).map((file) => file.name).join(', ')
                    : '선택된 파일 없음'}
                </span>
              </div>
              <div>
                <button type="button" className="primary-button" onClick={() => void handleCreateComment(answer.id)}>
                  답글 등록
                </button>
              </div>
            </div>

            <div className="answer-reply-list">
              {answer.comments && answer.comments.length > 0 ? (
                renderComments(answer.id, answer.comments)
              ) : (
                <p className="card-meta" style={{ marginTop: '0.5rem' }}>아직 답글이 없습니다.</p>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
