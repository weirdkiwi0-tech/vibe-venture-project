import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfilePanel } from '../../src/components/profile-panel';

const getMyQuestionsMock = jest.fn().mockResolvedValue([]);
const getMyAnswersMock = jest.fn().mockResolvedValue([]);
const getMyVideosMock = jest.fn().mockResolvedValue([]);
const getMyCommunityPostsMock = jest.fn().mockResolvedValue([]);
const getCommunityBoardMock = jest.fn().mockResolvedValue({
  posts: [],
  totalPages: 1,
  friends: [{ id: 'friend-1', name: '민지', avatar: 'M' }],
});

jest.mock('../../src/components/role-provider', () => ({
  useAuthUser: () => ({
    authResolved: true,
    authUser: {
      id: 'student-jun',
      email: 'student-jun@example.com',
      displayName: '준',
      role: 'user',
    },
    refetchAuth: jest.fn(),
  }),
}));

jest.mock('../../src/lib/api', () => ({
  deleteAnswer: jest.fn(),
  deleteCommunityPost: jest.fn(),
  deleteQuestion: jest.fn(),
  deleteVideo: jest.fn(),
  getCommunityBoard: (...args: unknown[]) => getCommunityBoardMock(...args),
  getCommunityProfile: jest.fn().mockResolvedValue({
    profile: {
      id: 'friend-1',
      name: '민지',
      role: 'student',
      school: '바이브고',
      grade: '2',
      bio: '같이 공부해요',
      avatar: 'M',
      subjects: [],
      relationship: 'pending-incoming',
      friendCount: 0,
      lastMessagePreview: '',
    },
    recentPosts: [],
    messages: [],
    canChat: false,
    pendingFriendRequestId: 'request-1',
    incomingFriendRequestId: 'request-1',
  }),
  getGoogleAuthUrl: jest.fn(),
  getMyAnswers: (...args: unknown[]) => getMyAnswersMock(...args),
  getMyCommunityPosts: (...args: unknown[]) => getMyCommunityPostsMock(...args),
  getMyQuestions: (...args: unknown[]) => getMyQuestionsMock(...args),
  getMyVideos: (...args: unknown[]) => getMyVideosMock(...args),
  acceptFriendRequest: jest.fn(),
  requestFriend: jest.fn(),
  sendDirectMessage: jest.fn(),
  signInLocal: jest.fn(),
  signUpLocal: jest.fn(),
}));

describe('ProfilePanel (unit)', () => {
  it('shows the pending friend request count in the friends tab', async () => {
    const user = userEvent.setup();

    render(<ProfilePanel />);

    await user.click(screen.getByRole('tab', { name: /내 친구/ }));

    expect(screen.getByRole('tab', { name: /내 친구/ })).toHaveTextContent('요청 1');
    expect(screen.getByText('받은 친구 요청')).toBeInTheDocument();
  });
});