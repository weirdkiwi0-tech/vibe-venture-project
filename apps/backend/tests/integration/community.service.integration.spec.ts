import { AuthService } from '../../src/auth';
import { CommunityService } from '../../src/community/community.service';

describe('CommunityService (integration)', () => {
  const createAuthServiceMock = () => ({
    getUserById: (id: string) => {
      if (id === 'student-jun' || id === 'friend-user') {
        return {
          id,
          email: `${id}@example.com`,
          displayName: id === 'student-jun' ? '준' : '민지',
          role: 'user',
        };
      }
      return undefined;
    },
  }) as unknown as AuthService;

  it('tracks pending friend requests through profile and mailbox contracts', async () => {
    const service = new CommunityService(createAuthServiceMock());

    const request = await service.requestFriend('student-jun', 'friend-user');
    const profile = await service.getProfile('friend-user', 'student-jun');
    const mailbox = await service.getMailbox('friend-user');

    expect(profile.profile.relationship).toBe('pending-incoming');
    expect(profile.incomingFriendRequestId).toBe(request.id);
    expect(mailbox.friendRequests).toHaveLength(1);
    expect(mailbox.friendRequests[0].id).toBe(request.id);
    expect(mailbox.friendRequests[0].status).toBe('pending');
    expect(mailbox.notifications[0].title).toBe('새 친구 요청');
  });

  it('accepts and rejects friend requests while updating friend and mailbox state', async () => {
    const service = new CommunityService(createAuthServiceMock());

    const accepted = await service.requestFriend('student-jun', 'friend-user');
    const rejected = await service.requestFriend('friend-user', 'student-jun');

    const acceptedResult = await service.acceptFriendRequest(accepted.id, 'friend-user');
    const rejectedResult = await service.rejectFriendRequest(rejected.id, 'student-jun');

    expect(acceptedResult.status).toBe('accepted');
    expect(rejectedResult.status).toBe('rejected');

    const board = await service.getBoard('student-jun');
    expect(board.friends).toEqual([{ id: 'friend-user', name: '민지', avatar: '민' }]);

    const mailbox = await service.getMailbox('friend-user');
    const acceptedRequest = mailbox.friendRequests.find((item) => item.id === accepted.id);
    expect(acceptedRequest?.status).toBe('accepted');
  });
});
