import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CommunityBoard } from '../../src/components/community-board';
import { createCommunityPost, getCommunityBoard } from '../../src/lib/api';
import type { CommunityBoardResponse } from '../../src/lib/types';

jest.mock('../../src/lib/api', () => ({
  createCommunityPost: jest.fn(),
  getCommunityBoard: jest.fn(),
}));

jest.mock('../../src/components/role-provider', () => ({
  useAuthUser: () => ({
    authResolved: true,
    authUser: { id: 'learner-1' },
  }),
}));

const mockedGetBoard = jest.mocked(getCommunityBoard);
const mockedCreatePost = jest.mocked(createCommunityPost);
const emptyBoard: CommunityBoardResponse = { posts: [], friends: [], totalPages: 1 };

function boardWithPost(title: string): CommunityBoardResponse {
  return {
    ...emptyBoard,
    posts: [{
      id: title,
      title,
      authorId: 'learner-1',
      authorName: 'Learner',
      authorAvatar: 'L',
      authorVisibility: 'anonymous',
      createdAt: '2026-11-05T00:00:00.000Z',
      viewCount: 0,
      likeCount: 0,
    }],
  };
}

function search(query: string) {
  fireEvent.change(screen.getByPlaceholderText('게시글 제목이나 관련 텍스트 입력'), {
    target: { value: query },
  });
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
}

beforeEach(() => {
  jest.resetAllMocks();
  window.localStorage.clear();
  mockedGetBoard.mockResolvedValue(emptyBoard);
});

describe('community board request recovery', () => {
  it('keeps the newest search results when an older response arrives later', async () => {
    let resolveOlder!: (board: CommunityBoardResponse) => void;
    const olderResponse = new Promise<CommunityBoardResponse>((resolve) => {
      resolveOlder = resolve;
    });
    mockedGetBoard
      .mockResolvedValueOnce(boardWithPost('Initial result'))
      .mockReturnValueOnce(olderResponse)
      .mockResolvedValueOnce(boardWithPost('Newest result'));
    render(<CommunityBoard initialBoard={emptyBoard} />);
    await screen.findByText('Initial result');

    search('older');
    await waitFor(() => expect(mockedGetBoard).toHaveBeenLastCalledWith('learner-1', 1, 'older'));
    search('newest');
    await screen.findByText('Newest result');
    await act(async () => resolveOlder(boardWithPost('Outdated result')));

    expect(screen.getByText('Newest result')).toBeInTheDocument();
    expect(screen.queryByText('Outdated result')).not.toBeInTheDocument();
  });

  it('ignores a pending request after unmounting', async () => {
    let resolvePending!: (board: CommunityBoardResponse) => void;
    mockedGetBoard.mockReturnValueOnce(new Promise((resolve) => {
      resolvePending = resolve;
    }));
    const view = render(<CommunityBoard initialBoard={emptyBoard} />);
    view.unmount();
    await act(async () => resolvePending(boardWithPost('Late result')));
    expect(screen.queryByText('Late result')).not.toBeInTheDocument();
  });

  it('ignores an older search failure after the latest search succeeds', async () => {
    let rejectOlder!: (error: Error) => void;
    mockedGetBoard
      .mockResolvedValueOnce(boardWithPost('Initial result'))
      .mockReturnValueOnce(new Promise((_resolve, reject) => {
        rejectOlder = reject;
      }))
      .mockResolvedValueOnce(boardWithPost('Newest result'));
    render(<CommunityBoard initialBoard={emptyBoard} />);
    await screen.findByText('Initial result');
    search('older');
    search('newest');
    await screen.findByText('Newest result');
    await act(async () => rejectOlder(new Error('Outdated outage')));

    expect(screen.getByText('Newest result')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a load error and retries the same search without losing existing posts', async () => {
    mockedGetBoard
      .mockResolvedValueOnce(boardWithPost('Existing result'))
      .mockRejectedValueOnce(new Error('Temporary outage'))
      .mockResolvedValueOnce(boardWithPost('Recovered result'));
    render(<CommunityBoard initialBoard={emptyBoard} />);
    await screen.findByText('Existing result');

    search('recovery');
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporary outage');
    expect(screen.getByText('Existing result')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await screen.findByText('Recovered result');
    expect(mockedGetBoard).toHaveBeenLastCalledWith('learner-1', 1, 'recovery');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not present a successful post as failed when only the list refresh fails', async () => {
    mockedGetBoard
      .mockResolvedValueOnce(emptyBoard)
      .mockRejectedValueOnce(new Error('List refresh failed'))
      .mockResolvedValueOnce(boardWithPost('Created post'));
    mockedCreatePost.mockResolvedValue({
      ...boardWithPost('Created post').posts[0],
      content: 'Post content',
      attachments: [],
      isMine: true,
    });
    render(<CommunityBoard initialBoard={emptyBoard} />);
    await waitFor(() => expect(mockedGetBoard).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: '+ 글쓰기' }));
    fireEvent.change(screen.getByPlaceholderText('게시글 제목을 입력하세요'), {
      target: { value: 'Created post' },
    });
    fireEvent.change(screen.getByPlaceholderText('내용을 입력하세요'), {
      target: { value: 'Post content' },
    });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));

    await waitFor(() => expect(screen.queryByText('게시글 작성')).not.toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('List refresh failed');
    expect(screen.queryByText('게시글 등록에 실패했습니다.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await screen.findByText('Created post');
    expect(mockedCreatePost).toHaveBeenCalledTimes(1);
  });

  it('keeps the form contents when creating the post itself fails', async () => {
    mockedCreatePost.mockRejectedValue(new Error('Create failed'));
    render(<CommunityBoard initialBoard={emptyBoard} />);
    await waitFor(() => expect(mockedGetBoard).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: '+ 글쓰기' }));
    fireEvent.change(screen.getByPlaceholderText('게시글 제목을 입력하세요'), {
      target: { value: 'Unsubmitted post' },
    });
    fireEvent.change(screen.getByPlaceholderText('내용을 입력하세요'), {
      target: { value: 'Retained content' },
    });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));

    await screen.findByText('게시글 등록에 실패했습니다.');
    expect(screen.getByPlaceholderText('게시글 제목을 입력하세요')).toHaveValue('Unsubmitted post');
    expect(screen.getByPlaceholderText('내용을 입력하세요')).toHaveValue('Retained content');
    expect(mockedGetBoard).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '등록' })).toBeEnabled();
  });
});
