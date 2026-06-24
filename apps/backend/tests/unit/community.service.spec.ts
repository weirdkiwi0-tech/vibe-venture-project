import { CommunityService } from '../../src/community/community.service';
import { AuthService } from '../../src/auth';

describe('CommunityService (unit)', () => {
  const createAuthServiceMock = () => ({
    getUserById: (id: string) => {
      if (id === 'author-user' || id === 'viewer-user') {
        return {
          id,
          email: `${id}@example.com`,
          displayName: id,
          role: 'user',
        };
      }
      return undefined;
    },
  }) as unknown as AuthService;

  it('increases post viewCount for guests and non-registered users', async () => {
    const service = new CommunityService(createAuthServiceMock());
    const created = await service.createPost(
      {
        title: 'community post',
        content: 'content',
      },
      'author-user',
    );

    const guestView = await service.getPostDetail(created.id);
    const unknownUserView = await service.getPostDetail(created.id, 'unknown-user');

    expect(guestView.viewCount).toBe(1);
    expect(unknownUserView.viewCount).toBe(2);
  });

  it('increases post viewCount for registered users', async () => {
    const service = new CommunityService(createAuthServiceMock());
    const created = await service.createPost(
      {
        title: 'community post',
        content: 'content',
      },
      'author-user',
    );

    const viewed = await service.getPostDetail(created.id, 'viewer-user');
    expect(viewed.viewCount).toBe(1);
  });

  it('masks avatar and photo when anonymous comments are created and listed', async () => {
    const service = new CommunityService(createAuthServiceMock());
    const createdPost = await service.createPost(
      {
        title: 'anonymous comment test post',
        content: 'content',
      },
      'author-user',
    );

    const createdComment = await service.createPostComment(
      createdPost.id,
      {
        content: '익명 댓글',
        authorVisibility: 'anonymous',
      },
      'author-user',
    );

    expect(createdComment.authorVisibility).toBe('anonymous');
    expect(createdComment.authorName).toBe('익명');
    expect(createdComment.authorAvatar).toBe('익');
    expect(createdComment.authorPhotoUrl).toBeUndefined();

    const listed = await service.getPostComments(createdPost.id, 'viewer-user');
    expect(listed).toHaveLength(1);
    expect(listed[0].authorVisibility).toBe('anonymous');
    expect(listed[0].authorName).toBe('익명');
    expect(listed[0].authorAvatar).toBe('익');
    expect(listed[0].authorPhotoUrl).toBeUndefined();
  });

  it('shows pending friend request notification only in receiver mailbox', async () => {
    const authService = {
      getUserById: (id: string) => {
        if (id === 'sender-user' || id === 'target-user') {
          return {
            id,
            email: `${id}@example.com`,
            displayName: id === 'sender-user' ? '보낸사람' : '받는사람',
            role: 'user',
          };
        }
        return undefined;
      },
    } as unknown as AuthService;

    const service = new CommunityService(authService);
    const request = await service.requestFriend('sender-user', 'target-user');

    const senderMailbox = await service.getMailbox('sender-user');
    const targetMailbox = await service.getMailbox('target-user');

    const senderNotification = senderMailbox.notifications.find(
      (notification) => notification.relatedRequestId === request.id && notification.title === '새 친구 요청',
    );
    const targetNotification = targetMailbox.notifications.find(
      (notification) => notification.relatedRequestId === request.id && notification.title === '새 친구 요청',
    );

    expect(senderMailbox.friendRequests.some((item) => item.id === request.id)).toBe(true);
    expect(senderNotification).toBeUndefined();
    expect(targetNotification).toBeDefined();
    expect(targetNotification?.actorId).toBe('sender-user');
  });
});
