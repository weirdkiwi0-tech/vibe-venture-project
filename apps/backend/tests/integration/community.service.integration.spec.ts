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

    const requesterMailbox = await service.getMailbox('student-jun');
    const requesterAcceptedRequest = requesterMailbox.friendRequests.find((item) => item.id === accepted.id);
    const receiverRejectedRequest = mailbox.friendRequests.find((item) => item.id === rejected.id);
    const requesterRejectedRequest = requesterMailbox.friendRequests.find((item) => item.id === rejected.id);

    expect(requesterAcceptedRequest?.status).toBe('accepted');
    expect(receiverRejectedRequest?.status).toBe('rejected');
    expect(requesterRejectedRequest?.status).toBe('rejected');

    const requesterProfile = await service.getProfile('friend-user', 'student-jun');
    const receiverProfile = await service.getProfile('student-jun', 'friend-user');

    expect(requesterProfile.profile.relationship).toBe('friend');
    expect(receiverProfile.profile.relationship).toBe('friend');
  });

  it('does not allow re-processing after request is already accepted or rejected', async () => {
    const service = new CommunityService(createAuthServiceMock());

    const accepted = await service.requestFriend('student-jun', 'friend-user');
    await service.acceptFriendRequest(accepted.id, 'friend-user');

    await expect(service.rejectFriendRequest(accepted.id, 'friend-user')).rejects.toThrow('friend request is already processed');

    const rejectOnlyService = new CommunityService(createAuthServiceMock());
    const rejected = await rejectOnlyService.requestFriend('friend-user', 'student-jun');
    await rejectOnlyService.rejectFriendRequest(rejected.id, 'student-jun');

    await expect(rejectOnlyService.acceptFriendRequest(rejected.id, 'student-jun')).rejects.toThrow(
      'friend request is already processed',
    );
  });

  it('keeps anonymous comment identity masked while nickname comments stay visible', async () => {
    const service = new CommunityService(createAuthServiceMock());

    const post = await service.createPost(
      {
        title: 'masking integration test',
        content: 'content',
      },
      'student-jun',
    );

    const anonymous = await service.createPostComment(
      post.id,
      {
        content: '익명 댓글',
        authorVisibility: 'anonymous',
      },
      'student-jun',
    );

    const nickname = await service.createPostComment(
      post.id,
      {
        content: '닉네임 댓글',
        authorVisibility: 'nickname',
      },
      'friend-user',
    );

    expect(anonymous.authorName).toBe('익명');
    expect(anonymous.authorAvatar).toBe('익');
    expect(anonymous.authorPhotoUrl).toBeUndefined();

    const listed = await service.getPostComments(post.id, 'student-jun');
    const anonymousListed = listed.find((comment) => comment.id === anonymous.id);
    const nicknameListed = listed.find((comment) => comment.id === nickname.id);

    expect(anonymousListed?.authorName).toBe('익명');
    expect(anonymousListed?.authorAvatar).toBe('익');
    expect(anonymousListed?.authorPhotoUrl).toBeUndefined();

    expect(nicknameListed?.authorName).toBe('민지');
    expect(nicknameListed?.authorAvatar).toBe('민');
    expect(nicknameListed?.authorPhotoUrl).toBeUndefined();
  });

  it('emits pending friend request notification only for the receiver mailbox', async () => {
    const service = new CommunityService(createAuthServiceMock());

    const request = await service.requestFriend('student-jun', 'friend-user');
    const requesterMailbox = await service.getMailbox('student-jun');
    const receiverMailbox = await service.getMailbox('friend-user');

    const requesterPending = requesterMailbox.notifications.filter(
      (notification) => notification.relatedRequestId === request.id && notification.title === '새 친구 요청',
    );
    const receiverPending = receiverMailbox.notifications.filter(
      (notification) => notification.relatedRequestId === request.id && notification.title === '새 친구 요청',
    );

    expect(requesterPending).toHaveLength(0);
    expect(receiverPending).toHaveLength(1);
    expect(receiverPending[0].actorId).toBe('student-jun');
  });

  it('supports requestFriend -> accept -> direct message -> getProfile canChat/messages contract', async () => {
    const service = new CommunityService(createAuthServiceMock());

    const request = await service.requestFriend('student-jun', 'friend-user');
    await service.acceptFriendRequest(request.id, 'friend-user');
    await service.sendDirectMessage({ recipientId: 'friend-user', content: '안녕 민지!' }, 'student-jun');

    const profile = await service.getProfile('friend-user', 'student-jun');

    expect(profile.canChat).toBe(true);
    expect(profile.messages).toHaveLength(1);
    expect(profile.messages[0].senderId).toBe('student-jun');
    expect(profile.messages[0].recipientId).toBe('friend-user');
    expect(profile.messages[0].content).toBe('안녕 민지!');
    expect(profile.profile.lastMessagePreview).toBe('안녕 민지!');
  });

  it('supports full post/comment lifecycle with author self-view guard and anonymous authorId masking', async () => {
    const service = new CommunityService(createAuthServiceMock());

    const post = await service.createPost(
      {
        title: '초기 제목',
        content: '초기 내용',
      },
      'student-jun',
    );

    const authorView = await service.getPostDetail(post.id, 'student-jun');
    expect(authorView.viewCount).toBe(0);
    expect(authorView.isMine).toBe(true);

    const friendView = await service.getPostDetail(post.id, 'friend-user');
    expect(friendView.viewCount).toBe(1);
    expect(friendView.isMine).toBe(false);

    const updatedPost = await service.updatePost(
      post.id,
      { title: '변경된 제목', content: '변경된 내용' },
      'student-jun',
    );
    expect(updatedPost.title).toBe('변경된 제목');
    expect(updatedPost.content).toBe('변경된 내용');

    const comment = await service.createPostComment(
      post.id,
      {
        content: '익명 초기 댓글',
        authorVisibility: 'anonymous',
      },
      'student-jun',
    );
    expect(comment.authorId).toBe('anonymous');
    expect(comment.authorName).toBe('익명');
    expect(comment.isMine).toBe(true);

    const updatedComment = await service.updatePostComment(
      post.id,
      comment.id,
      { content: '익명 수정 댓글' },
      'student-jun',
    );
    expect(updatedComment.content).toBe('익명 수정 댓글');
    expect(updatedComment.authorId).toBe('anonymous');

    const firstLike = await service.likePostComment(post.id, comment.id, 'friend-user');
    expect(firstLike).toEqual({ liked: true, likeCount: 1 });

    const secondLike = await service.likePostComment(post.id, comment.id, 'friend-user');
    expect(secondLike).toEqual({ liked: false, likeCount: 0 });

    const myPosts = await service.getMyPosts('student-jun');
    expect(myPosts).toHaveLength(1);
    expect(myPosts[0].id).toBe(post.id);
    expect(myPosts[0].title).toBe('변경된 제목');

    await service.deletePost(post.id, 'student-jun');
    const afterDelete = await service.getMyPosts('student-jun');
    expect(afterDelete).toHaveLength(0);
  });
});
