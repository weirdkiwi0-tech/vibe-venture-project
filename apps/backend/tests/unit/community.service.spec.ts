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

  it('does not increase post viewCount when the author views their own post', async () => {
    const service = new CommunityService(createAuthServiceMock());
    const created = await service.createPost(
      {
        title: 'author self-view post',
        content: 'content',
      },
      'author-user',
    );

    const selfView = await service.getPostDetail(created.id, 'author-user');
    expect(selfView.viewCount).toBe(0);

    const otherView = await service.getPostDetail(created.id, 'viewer-user');
    expect(otherView.viewCount).toBe(1);
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
    expect(createdComment.authorId).toBe('anonymous');
    expect(createdComment.authorName).toBe('익명');
    expect(createdComment.authorAvatar).toBe('익');
    expect(createdComment.authorPhotoUrl).toBeUndefined();
    expect(createdComment.isMine).toBe(true);

    const listed = await service.getPostComments(createdPost.id, 'viewer-user');
    expect(listed).toHaveLength(1);
    expect(listed[0].authorVisibility).toBe('anonymous');
    expect(listed[0].authorId).toBe('anonymous');
    expect(listed[0].authorName).toBe('익명');
    expect(listed[0].authorAvatar).toBe('익');
    expect(listed[0].authorPhotoUrl).toBeUndefined();
    expect(listed[0].isMine).toBe(false);
  });

  it('supports updating post, updating comment, toggling comment likes, listing my posts, and deleting post with author/admin checks', async () => {
    const service = new CommunityService(createAuthServiceMock());
    const createdPost = await service.createPost(
      {
        title: '원본 제목',
        content: '원본 내용',
      },
      'author-user',
    );

    await expect(
      service.updatePost(createdPost.id, { title: '권한 없음', content: '수정 불가' }, 'viewer-user'),
    ).rejects.toThrow('only author can edit post');

    const updatedPost = await service.updatePost(
      createdPost.id,
      { title: '수정된 제목', content: '수정된 내용' },
      'author-user',
    );
    expect(updatedPost.title).toBe('수정된 제목');
    expect(updatedPost.content).toBe('수정된 내용');

    const comment = await service.createPostComment(
      createdPost.id,
      { content: '첫 댓글', authorVisibility: 'anonymous' },
      'author-user',
    );

    await expect(
      service.updatePostComment(createdPost.id, comment.id, { content: '타인 댓글 수정' }, 'viewer-user'),
    ).rejects.toThrow('only author can edit comment');

    const updatedComment = await service.updatePostComment(
      createdPost.id,
      comment.id,
      { content: '수정된 댓글' },
      'author-user',
    );
    expect(updatedComment.content).toBe('수정된 댓글');
    expect(updatedComment.authorId).toBe('anonymous');

    const likedComment = await service.likePostComment(createdPost.id, comment.id, 'viewer-user');
    expect(likedComment).toEqual({ liked: true, likeCount: 1 });

    const unlikedComment = await service.likePostComment(createdPost.id, comment.id, 'viewer-user');
    expect(unlikedComment).toEqual({ liked: false, likeCount: 0 });

    const myPosts = await service.getMyPosts('author-user');
    expect(myPosts).toHaveLength(1);
    expect(myPosts[0].id).toBe(createdPost.id);
    expect(myPosts[0].title).toBe('수정된 제목');

    await expect(service.deletePost(createdPost.id, 'viewer-user')).rejects.toThrow('only author can delete post');
    await service.deletePost(createdPost.id, 'author-user');

    await expect(service.getPostDetail(createdPost.id, 'viewer-user')).rejects.toThrow('post not found');
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

  it('fails to send a direct message when users are not friends', async () => {
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

    await expect(
      service.sendDirectMessage({ recipientId: 'target-user', content: '안녕하세요' }, 'sender-user'),
    ).rejects.toThrow('direct chat is available for friends only');
  });

  it('succeeds to send a direct message after friend request is accepted', async () => {
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
    await service.acceptFriendRequest(request.id, 'target-user');

    const sent = await service.sendDirectMessage(
      { recipientId: 'target-user', content: '친구가 되었네요!' },
      'sender-user',
    );

    expect(sent.senderId).toBe('sender-user');
    expect(sent.recipientId).toBe('target-user');
    expect(sent.content).toBe('친구가 되었네요!');
  });

  it('reflects messages and lastMessagePreview in getProfile after direct message exchange', async () => {
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
    await service.acceptFriendRequest(request.id, 'target-user');
    await service.sendDirectMessage({ recipientId: 'target-user', content: '첫 메시지' }, 'sender-user');

    const profile = await service.getProfile('target-user', 'sender-user');

    expect(profile.canChat).toBe(true);
    expect(profile.messages).toHaveLength(1);
    expect(profile.messages[0].content).toBe('첫 메시지');
    expect(profile.profile.lastMessagePreview).toBe('첫 메시지');
  });
});
