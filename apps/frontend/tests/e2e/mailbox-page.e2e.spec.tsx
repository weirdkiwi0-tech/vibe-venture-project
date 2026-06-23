import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MailboxPage from '../../src/app/mailbox/page';

const getCommunityMailboxMock = jest.fn();
const acceptFriendRequestMock = jest.fn();
const rejectFriendRequestMock = jest.fn();
const mockedAuthUser = {
  id: 'student-jun',
  email: 'student-jun@example.com',
  displayName: '준',
  role: 'user' as const,
};

jest.mock('next/navigation', () => ({
  usePathname: () => '/mailbox',
}));

jest.mock('../../src/components/role-provider', () => ({
  useAuthUser: () => ({
    authResolved: true,
    authUser: mockedAuthUser,
    refetchAuth: jest.fn(),
  }),
}));

jest.mock('../../src/components/community-profile-modal', () => ({
  CommunityProfileModal: ({ displayName }: { displayName: string }) => <div>{displayName}</div>,
}));

jest.mock('../../src/lib/api', () => ({
  getCommunityMailbox: (...args: unknown[]) => getCommunityMailboxMock(...args),
  acceptFriendRequest: (...args: unknown[]) => acceptFriendRequestMock(...args),
  rejectFriendRequest: (...args: unknown[]) => rejectFriendRequestMock(...args),
}));

describe('mailbox page e2e', () => {
  beforeEach(() => {
    getCommunityMailboxMock.mockReset();
    acceptFriendRequestMock.mockReset();
    rejectFriendRequestMock.mockReset();
  });

  it('accepts a friend request and refreshes mailbox list', async () => {
    const firstMailbox = {
      notifications: [
        {
          id: 'friend-request-1',
          type: 'friend-request',
          title: '새 친구 요청',
          message: '민지 님이 친구 요청을 보냈습니다.',
          actorId: 'friend-user',
          actorName: '민지',
          actorAvatar: 'M',
          readAt: null,
          createdAt: '2026-06-23T00:00:00.000Z',
        },
      ],
      friendRequests: [
        {
          id: 'request-1',
          requesterId: 'friend-user',
          targetId: 'student-jun',
          requesterName: '민지',
          requesterAvatar: 'M',
          targetName: '준',
          targetAvatar: 'J',
          status: 'pending',
          createdAt: '2026-06-23T00:00:00.000Z',
          updatedAt: '2026-06-23T00:00:00.000Z',
        },
      ],
    };

    const secondMailbox = {
      notifications: [],
      friendRequests: [],
    };

    getCommunityMailboxMock.mockResolvedValueOnce(firstMailbox).mockResolvedValueOnce(secondMailbox);
    acceptFriendRequestMock.mockResolvedValue({ id: 'request-1', status: 'accepted' });

    const user = userEvent.setup();
    render(<MailboxPage />);

    expect(await screen.findByText('친구요청이 도착했습니다. 수락하면 서로 친구로 등록됩니다.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '수락' }));

    await waitFor(() => {
      expect(acceptFriendRequestMock).toHaveBeenCalledWith({ requestId: 'request-1', userId: 'student-jun' });
    });

    expect(await screen.findByText('대기 중인 친구요청이 없습니다.')).toBeInTheDocument();
    expect(getCommunityMailboxMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a friend request and refreshes mailbox list', async () => {
    const firstMailbox = {
      notifications: [],
      friendRequests: [
        {
          id: 'request-2',
          requesterId: 'friend-user',
          targetId: 'student-jun',
          requesterName: '민지',
          requesterAvatar: 'M',
          targetName: '준',
          targetAvatar: 'J',
          status: 'pending',
          createdAt: '2026-06-23T00:00:00.000Z',
          updatedAt: '2026-06-23T00:00:00.000Z',
        },
      ],
    };

    const secondMailbox = {
      notifications: [],
      friendRequests: [],
    };

    getCommunityMailboxMock.mockResolvedValueOnce(firstMailbox).mockResolvedValueOnce(secondMailbox);
    rejectFriendRequestMock.mockResolvedValue({ id: 'request-2', status: 'rejected' });

    const user = userEvent.setup();
    render(<MailboxPage />);

    expect(await screen.findByRole('button', { name: '거절' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '거절' }));

    await waitFor(() => {
      expect(rejectFriendRequestMock).toHaveBeenCalledWith({ requestId: 'request-2', userId: 'student-jun' });
    });

    expect(await screen.findByText('대기 중인 친구요청이 없습니다.')).toBeInTheDocument();
  });
});
