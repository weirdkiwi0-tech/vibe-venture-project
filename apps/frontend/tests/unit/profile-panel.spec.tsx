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
const getCommunityProfileMock = jest.fn();
const sendDirectMessageMock = jest.fn();
const stableAuthUser = {
  id: 'student-jun',
  email: 'student-jun@example.com',
  displayName: '준',
  role: 'user',
};

const pendingIncomingProfile = {
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
};

const friendProfileWithChat = {
  profile: {
    id: 'friend-1',
    name: '민지',
    role: 'student',
    school: '바이브고',
    grade: '2',
    bio: '같이 공부해요',
    avatar: 'M',
    subjects: ['수학'],
    relationship: 'friend',
    friendCount: 1,
    lastMessagePreview: '안녕!',
  },
  recentPosts: [],
  messages: [],
  canChat: true,
  pendingFriendRequestId: null,
  incomingFriendRequestId: null,
};

const renderProfilePanel = () => {
  const user = userEvent.setup();
  render(<ProfilePanel />);
  return { user };
};

const openFriendsTab = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('tab', { name: /내 친구/ }));
};

const openFriendProfile = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /민지/ }));
};

const openDirectChatModal = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: '1대1채팅하기' }));
};

const mockFriendProfiles = (...profiles: unknown[]) => {
  profiles.forEach((profile) => getCommunityProfileMock.mockResolvedValueOnce(profile));
};

const friendProfileWithoutChat = {
  profile: {
    id: 'friend-1',
    name: '민지',
    role: 'student',
    school: '바이브고',
    grade: '2',
    bio: '같이 공부해요',
    avatar: 'M',
    subjects: ['수학'],
    relationship: 'none',
    friendCount: 0,
    lastMessagePreview: '',
  },
  recentPosts: [],
  messages: [],
  canChat: false,
  pendingFriendRequestId: null,
  incomingFriendRequestId: null,
};

jest.mock('../../src/components/role-provider', () => ({
  useAuthUser: () => ({
    authResolved: true,
    authUser: stableAuthUser,
    refetchAuth: jest.fn(),
  }),
}));

jest.mock('../../src/lib/api', () => ({
  deleteAnswer: jest.fn(),
  deleteCommunityPost: jest.fn(),
  deleteQuestion: jest.fn(),
  deleteVideo: jest.fn(),
  getCommunityBoard: (...args: unknown[]) => getCommunityBoardMock(...args),
  getCommunityProfile: (...args: unknown[]) => getCommunityProfileMock(...args),
  getGoogleAuthUrl: jest.fn(),
  getMyAnswers: (...args: unknown[]) => getMyAnswersMock(...args),
  getMyCommunityPosts: (...args: unknown[]) => getMyCommunityPostsMock(...args),
  getMyQuestions: (...args: unknown[]) => getMyQuestionsMock(...args),
  getMyVideos: (...args: unknown[]) => getMyVideosMock(...args),
  acceptFriendRequest: jest.fn(),
  requestFriend: jest.fn(),
  sendDirectMessage: (...args: unknown[]) => sendDirectMessageMock(...args),
  signInLocal: jest.fn(),
  signUpLocal: jest.fn(),
}));

describe('ProfilePanel (unit)', () => {
  beforeEach(() => {
    getCommunityProfileMock.mockReset();
    sendDirectMessageMock.mockReset();
    getCommunityProfileMock.mockResolvedValue(pendingIncomingProfile);
  });

  it('친구 탭에서 받은 친구 요청 건수를 표시한다', async () => {
    const { user } = renderProfilePanel();

    await openFriendsTab(user);

    expect(screen.getByRole('tab', { name: /내 친구/ })).toHaveTextContent('요청 1');
    expect(screen.getByText('받은 친구 요청')).toBeInTheDocument();
  });

  it('친구 프로필 모달에서 1대1채팅하기 버튼을 노출한다', async () => {
    const { user } = renderProfilePanel();
    mockFriendProfiles(pendingIncomingProfile, friendProfileWithChat);

    await openFriendsTab(user);
    await user.click(screen.getByTitle('민지 프로필 보기'));

    expect(await screen.findByText('친구 프로필')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1대1채팅하기' })).toBeInTheDocument();
  });

  it('친구 프로필에서 1대1채팅하기 클릭 시 채팅 모달을 연다', async () => {
    const { user } = renderProfilePanel();
    mockFriendProfiles(friendProfileWithChat, friendProfileWithChat, friendProfileWithChat);

    await openFriendsTab(user);
    await openFriendProfile(user);
    await openDirectChatModal(user);

    expect(await screen.findByText('1:1 채팅')).toBeInTheDocument();
    expect(screen.getAllByRole('dialog').length).toBeGreaterThanOrEqual(2);
  });

  it('채팅 권한이 없으면 입력창과 전송 버튼을 숨긴다', async () => {
    const { user } = renderProfilePanel();
    mockFriendProfiles(friendProfileWithChat, friendProfileWithChat, friendProfileWithoutChat);

    await openFriendsTab(user);
    await openFriendProfile(user);
    await openDirectChatModal(user);

    expect(await screen.findByText('친구가 아니면 1:1 채팅을 시작할 수 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '메시지' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '보내기' })).not.toBeInTheDocument();
  });

  it('메시지 전송 성공 시 direct message API 호출 후 프로필을 다시 조회한다', async () => {
    const { user } = renderProfilePanel();
    sendDirectMessageMock.mockResolvedValue({
      id: 'dm-1',
      senderId: stableAuthUser.id,
      recipientId: 'friend-1',
      content: '반가워!',
      createdAt: new Date().toISOString(),
    });
    mockFriendProfiles(
      friendProfileWithChat,
      friendProfileWithChat,
      friendProfileWithChat,
      {
        ...friendProfileWithChat,
        messages: [
          {
            id: 'dm-1',
            senderId: stableAuthUser.id,
            recipientId: 'friend-1',
            content: '반가워!',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    );

    await openFriendsTab(user);
    await openFriendProfile(user);
    await openDirectChatModal(user);

    const messageBox = await screen.findByRole('textbox', { name: '메시지' });
    await user.type(messageBox, '반가워!');
    await user.click(screen.getByRole('button', { name: '전송' }));

    expect(sendDirectMessageMock).toHaveBeenCalledWith({
      recipientId: 'friend-1',
      content: '반가워!',
      userId: stableAuthUser.id,
    });
    expect(getCommunityProfileMock).toHaveBeenLastCalledWith('friend-1', stableAuthUser.id);
    expect(getCommunityProfileMock.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});