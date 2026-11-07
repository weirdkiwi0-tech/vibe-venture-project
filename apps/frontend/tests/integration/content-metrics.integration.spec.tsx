import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CommunityPostWindow } from '../../src/components/community-post-window';
import { QuestionAnswerList, QuestionDetailCard } from '../../src/components/question-detail-cards';
import { useAuthUser } from '../../src/components/role-provider';
import { likeAnswer, likeAnswerComment, likeCommunityPost, likeCommunityPostComment, likeQuestion } from '../../src/lib/api';
import type { CommunityPostCommentItem, CommunityPostDetail, QuestionAnswerItem, QuestionItem } from '../../src/lib/types';
import { createTopPolicyQuestions } from '../support/top-policy-fixtures';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('../../src/components/role-provider', () => ({ useAuthUser: jest.fn() }));
jest.mock('../../src/components/community-profile-modal', () => ({
  CommunityProfileModal: () => <span>Author</span>,
}));
jest.mock('../../src/lib/api', () => ({
  likeQuestion: jest.fn(),
  likeAnswer: jest.fn(),
  likeAnswerComment: jest.fn(),
  likeCommunityPost: jest.fn(),
  likeCommunityPostComment: jest.fn(),
}));

const question: QuestionItem = {
  ...createTopPolicyQuestions(1)[0],
  authorId: 'author-1',
  visibility: 'anonymous',
};
const post: CommunityPostDetail = {
  id: 'post-1',
  title: 'Post example',
  content: 'Post body',
  authorId: 'author-1',
  authorName: 'Author',
  authorAvatar: 'A',
  authorVisibility: 'anonymous',
  createdAt: question.createdAt,
  likeCount: 10,
  viewCount: 5,
  attachments: [],
  isMine: false,
};
const comment: CommunityPostCommentItem = {
  id: 'comment-1',
  postId: post.id,
  authorId: post.authorId,
  authorName: post.authorName,
  authorAvatar: post.authorAvatar,
  authorVisibility: 'anonymous',
  content: 'Comment body',
  parentCommentId: null,
  createdAt: post.createdAt,
  likeCount: 2,
  isMine: false,
  replies: [],
};
const answer: QuestionAnswerItem = {
  id: 'answer-1',
  questionId: question.id,
  authorId: post.authorId,
  type: 'text',
  content: 'Answer body',
  attachments: [],
  createdAt: post.createdAt,
  likeCount: 4,
  comments: [{
    id: 'answer-comment-1',
    answerId: 'answer-1',
    authorId: post.authorId,
    authorName: post.authorName,
    authorVisibility: 'anonymous',
    content: 'Answer comment',
    attachments: [],
    parentCommentId: null,
    createdAt: post.createdAt,
    likeCount: 2,
    replies: [],
  }],
};

beforeEach(() => {
  jest.resetAllMocks();
  window.localStorage.clear();
  jest.mocked(useAuthUser).mockReturnValue({
    authResolved: true,
    authUser: { id: 'viewer-1', email: 'viewer@example.com', displayName: 'Viewer', role: 'user' },
    refetchAuth: jest.fn(),
  });
});

describe('content detail monochrome actions', () => {
  it('updates question likes with one count-bearing heart and retains the report destination', async () => {
    jest.mocked(likeQuestion).mockResolvedValue({ ...question, likeCount: 11, liked: true });
    render(<QuestionDetailCard question={question} />);
    const heart = screen.getByRole('button', { name: '좋아요 토글' });
    expect(heart).toHaveTextContent('\u266110');
    expect(screen.getAllByLabelText('좋아요 10개')).toHaveLength(1);
    expect(screen.getByLabelText('조회 0회')).toHaveTextContent('\u{1F441}\uFE0E');
    expect(screen.getByLabelText('답변 0개')).toHaveTextContent('\u{1F5E8}\uFE0E');
    expect(screen.getByRole('link', { name: '답변 0개 보기' })).toHaveAttribute('href', '#answers');
    const report = screen.getByRole('link', { name: '이 질문 신고' });
    expect(report).toHaveTextContent('\u2691');
    expect(report).toHaveAttribute('href', expect.stringContaining(`targetId=${question.id}`));
    fireEvent.click(heart);
    await waitFor(() => expect(heart).toHaveAttribute('aria-pressed', 'true'));
    expect(heart).toHaveTextContent('\u266511');
  });

  it('preserves the owner-only delete action and hides reporting for own questions', () => {
    render(<QuestionDetailCard question={{ ...question, authorId: 'viewer-1', isOwner: true }} />);
    expect(screen.queryByRole('link', { name: '이 질문 신고' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('toggles community post heart shape and count without duplicate like metrics', async () => {
    jest.mocked(likeCommunityPost)
      .mockResolvedValueOnce({ likeCount: 11, liked: true })
      .mockResolvedValueOnce({ likeCount: 10, liked: false });
    render(<CommunityPostWindow initialPost={post} initialComments={[]} />);
    expect(screen.getAllByText('\u2661')).toHaveLength(1);
    expect(screen.getByLabelText('조회 5회')).toHaveTextContent('\u{1F441}\uFE0E');
    fireEvent.click(screen.getByRole('button', { name: '좋아요 10개' }));
    const likedHeart = await screen.findByRole('button', { name: '좋아요 11개' });
    expect(likedHeart).toHaveAttribute('aria-pressed', 'true');
    expect(likedHeart).toHaveTextContent('\u266511');
    fireEvent.click(likedHeart);
    const heart = await screen.findByRole('button', { name: '좋아요 10개' });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    expect(heart).toHaveTextContent('\u266110');
    expect(likeCommunityPost).toHaveBeenCalledWith(post.id);
    expect(screen.getByRole('link', { name: '게시글 신고' })).toHaveAttribute('href', expect.stringContaining('targetId=post-1'));
  });

  it('keeps community comment and nested reply like/report controls functional', async () => {
    jest.mocked(likeCommunityPostComment).mockResolvedValue({ likeCount: 3, liked: true });
    render(<CommunityPostWindow initialPost={post} initialComments={[{
      ...comment,
      replies: [{ ...comment, id: 'reply-1', parentCommentId: comment.id, content: 'Reply body', likeCount: 0 }],
    }]} />);
    const heart = screen.getByRole('button', { name: '댓글 좋아요 2개' });
    fireEvent.click(heart);
    await waitFor(() => expect(heart).toHaveAttribute('aria-pressed', 'true'));
    expect(heart).toHaveTextContent('\u26653');
    expect(likeCommunityPostComment).toHaveBeenCalledWith({ postId: post.id, commentId: comment.id, userId: 'viewer-1' });
    expect(screen.getByRole('button', { name: '댓글 좋아요 0개' })).toHaveTextContent('\u26610');
    const reports = screen.getAllByRole('link', { name: '신고하기' });
    expect(reports).toHaveLength(2);
    reports.forEach((report) => expect(report).toHaveTextContent('\u2691'));
    expect(reports[1]).toHaveAttribute('href', expect.stringContaining('targetId=reply-1'));
  });

  it('keeps community guest likes gated with a visible login message', async () => {
    jest.mocked(useAuthUser).mockReturnValue({ authResolved: true, authUser: null, refetchAuth: jest.fn() });
    render(<CommunityPostWindow initialPost={post} initialComments={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '좋아요 10개' }));
    expect(await screen.findByText('좋아요는 로그인 후 이용해주세요.')).toBeInTheDocument();
    expect(likeCommunityPost).not.toHaveBeenCalled();
  });

  it('shares heart and flag symbols with answers and answer comments', async () => {
    jest.mocked(likeAnswer).mockResolvedValue({ likeCount: 5, liked: true });
    jest.mocked(likeAnswerComment).mockResolvedValue({ likeCount: 3, liked: true });
    render(<QuestionAnswerList initialAnswers={[answer]} />);
    const answerHeart = screen.getByRole('button', { name: '답변 하트' });
    fireEvent.click(answerHeart);
    await waitFor(() => expect(answerHeart).toHaveAttribute('aria-pressed', 'true'));
    expect(answerHeart).toHaveTextContent('\u26655');
    const commentHeart = screen.getByRole('button', { name: '댓글 좋아요 2개' });
    fireEvent.click(commentHeart);
    await waitFor(() => expect(commentHeart).toHaveAttribute('aria-pressed', 'true'));
    expect(commentHeart).toHaveTextContent('\u26653');
    expect(likeAnswer).toHaveBeenCalledWith(answer.id, 'viewer-1');
    expect(likeAnswerComment).toHaveBeenCalledWith({ answerId: answer.id, commentId: 'answer-comment-1', userId: 'viewer-1' });
    screen.getAllByRole('link', { name: '신고하기' }).forEach((report) => {
      expect(report).toHaveTextContent('\u2691');
      expect(report).toHaveAttribute('title', '신고하기');
    });
  });
});
