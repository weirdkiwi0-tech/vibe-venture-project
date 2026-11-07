import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuestionList, VideoGrid } from '../../src/components/feed-cards';
import { useAuthUser } from '../../src/components/role-provider';
import { likeQuestion, likeVideo } from '../../src/lib/api';
import { createTopPolicyQuestions } from '../support/top-policy-fixtures';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../src/components/role-provider', () => ({
  useAuthUser: jest.fn(),
}));

jest.mock('../../src/lib/api', () => ({
  deleteQuestion: jest.fn(),
  likeQuestion: jest.fn(),
  likeVideo: jest.fn(),
}));

const mockedAuth = jest.mocked(useAuthUser);
const mockedLike = jest.mocked(likeQuestion);
const question = { ...createTopPolicyQuestions(1)[0], authorId: 'author-1' };

beforeEach(() => {
  jest.clearAllMocks();
  mockedAuth.mockReturnValue({
    authResolved: true,
    authUser: null,
    refetchAuth: jest.fn(),
  });

});

describe('video card monochrome presentation', () => {
  const video = {
    id: 'video-1',
    title: 'Video example',
    subject: '수학',
    url: 'https://example.test/video',
    durationSeconds: 60,
    likeCount: 2,
    viewCount: 5,
    createdAt: '2026-11-05T00:00:00.000Z',
  };

  it('shares the count-bearing heart and text eye/flag without duplicate metrics', () => {
    render(<VideoGrid videos={[video]} />);
    expect(screen.getByRole('button', { name: '영상 좋아요 토글' })).toHaveTextContent('\u26612');
    expect(screen.getAllByLabelText('좋아요 2개')).toHaveLength(1);
    expect(screen.getByLabelText('조회 5회')).toHaveTextContent('\u{1F441}\uFE0E');
    expect(screen.getByRole('link', { name: '신고하기' })).toHaveTextContent('\u2691');
  });

  it('keeps keyboard actions on the heart and flag separate from the video card', async () => {
    mockedAuth.mockReturnValue({
      authResolved: true,
      authUser: { id: 'viewer-1', email: 'viewer@example.com', displayName: 'Viewer', role: 'user' },
      refetchAuth: jest.fn(),
    });
    jest.mocked(likeVideo).mockResolvedValue({ id: video.id, likeCount: 3, viewCount: 5, liked: true });
    const { container } = render(<VideoGrid videos={[video]} />);
    const heart = screen.getByRole('button', { name: '영상 좋아요 토글' });
    fireEvent.keyDown(heart, { key: ' ' });
    fireEvent.click(heart);
    await waitFor(() => expect(heart).toHaveAttribute('aria-pressed', 'true'));
    expect(heart).toHaveTextContent('\u26653');
    expect(likeVideo).toHaveBeenCalledWith(video.id, 'viewer-1');
    fireEvent.keyDown(screen.getByRole('link', { name: '신고하기' }), { key: 'Enter' });
    expect(mockPush).not.toHaveBeenCalled();
    fireEvent.keyDown(container.querySelector('.video-card')!, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalledWith('/videos/video-1');
  });
});

afterEach(() => jest.restoreAllMocks());

describe('home top question presentation', () => {
  it.each([true, false])('opens the answer anchor without activating the parent card (TOP: %s)', (autoSlide) => {
    render(<QuestionList questions={[question]} autoSlide={autoSlide} />);
    const bubble = screen.getByRole('link', { name: '답변 0개 보기' });
    expect(bubble).toHaveAttribute('href', '/questions/q-0#answers');
    fireEvent.keyDown(bubble, { key: 'Enter' });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    click.preventDefault();
    fireEvent(bubble, click);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('uses accessible monochrome Unicode metrics and a flag link', () => {
    const { container } = render(<QuestionList questions={[question]} autoSlide />);

    expect(container.querySelector('.question-top-card .question-index')).toHaveTextContent('01');
    expect(screen.getByRole('button', { name: '좋아요 10개' })).toHaveTextContent('\u2661');
    expect(screen.getByLabelText('조회 0회')).toHaveTextContent('\u{1F441}\uFE0E');
    expect(screen.getByLabelText('답변 0개')).toHaveTextContent('\u{1F5E8}\uFE0E');
    expect(screen.getAllByText('\u2661')).toHaveLength(1);
    const report = screen.getByRole('link', { name: '신고하기' });
    expect(report).toHaveTextContent('\u2691');
    expect(report).toHaveAttribute('href', expect.stringContaining('targetId=q-0'));
    expect(screen.queryByText('좋아요 10 · 조회 0 · 답변 0개')).not.toBeInTheDocument();
  });

  it('omits rank badges and their column from the regular question list', () => {
    const { container } = render(<QuestionList questions={[question]} />);

    expect(container.querySelector('.question-top-card')).not.toBeInTheDocument();
    expect(container.querySelector('.question-index')).not.toBeInTheDocument();
    expect(container.querySelector('.question-card')?.children).toHaveLength(1);
    expect(screen.getByRole('button', { name: '좋아요 10개' })).toHaveTextContent('\u2661');
    expect(screen.getByLabelText('조회 0회')).toHaveTextContent('\u{1F441}\uFE0E');
    expect(screen.getByLabelText('답변 0개')).toHaveTextContent('\u{1F5E8}\uFE0E');
    expect(screen.getByRole('link', { name: '신고하기' })).toHaveTextContent('\u2691');
  });

  it('updates the heart count without navigating to the question', async () => {
    mockedAuth.mockReturnValue({
      authResolved: true,
      authUser: { id: 'viewer-1', email: 'viewer@example.com', displayName: 'Viewer', role: 'user' },
      refetchAuth: jest.fn(),
    });
    mockedLike.mockResolvedValue({ ...question, likeCount: 11, liked: true });
    render(<QuestionList questions={[question]} autoSlide />);

    const heart = screen.getByRole('button', { name: '좋아요 10개' });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(heart, { key: 'Enter' });
    fireEvent.click(heart);
    await waitFor(() => expect(mockedLike).toHaveBeenCalledWith('q-0', 'viewer-1'));
    expect(await screen.findByRole('button', { name: '좋아요 11개' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '좋아요 11개' })).toHaveTextContent('\u2665');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('keeps report keyboard activation separate from card navigation', () => {
    const { container } = render(<QuestionList questions={[question]} autoSlide />);
    fireEvent.keyDown(screen.getByRole('link', { name: '신고하기' }), { key: 'Enter' });
    expect(mockPush).not.toHaveBeenCalled();
    const card = container.querySelector('.question-top-card');
    expect(card).not.toBeNull();
    fireEvent.keyDown(card!, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalledWith('/questions/q-0');
  });

  it('still asks guests to log in when they press the heart', () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    render(<QuestionList questions={[question]} autoSlide />);
    fireEvent.click(screen.getByRole('button', { name: '좋아요 10개' }));
    expect(alert).toHaveBeenCalledWith('좋아요는 로그인 후 사용할 수 있습니다.');
    expect(mockedLike).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
