import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Community API (e2e)', () => {
  let app: INestApplication;
  const testPassword = 'Password123!';

  const signUpUser = async (emailPrefix: string, displayName: string) => {
    const email = `${emailPrefix}-${randomUUID()}@example.com`;
    const signUp = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email,
        password: testPassword,
        displayName,
      });

    expect(signUp.status).toBe(201);

    return {
      id: signUp.body.user.id as string,
      email,
    };
  };

  const createFriendRequest = async (requesterId: string, targetId: string) => {
    const response = await request(app.getHttpServer())
      .post('/community/friend-requests')
      .set('x-user-id', requesterId)
      .send({ targetId });

    expect(response.status).toBe(201);

    return response;
  };

  const acceptFriendRequest = async (requestId: string, receiverId: string) => {
    const response = await request(app.getHttpServer())
      .post(`/community/friend-requests/${encodeURIComponent(requestId)}/accept`)
      .set('x-user-id', receiverId)
      .send({});

    expect(response.status).toBe(201);

    return response;
  };

  const rejectFriendRequest = async (requestId: string, receiverId: string) => {
    const response = await request(app.getHttpServer())
      .post(`/community/friend-requests/${encodeURIComponent(requestId)}/reject`)
      .set('x-user-id', receiverId)
      .send({});

    expect(response.status).toBe(201);

    return response;
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('친구 요청 수락 후 mailbox와 board에 친구 관계를 반영한다', async () => {
    const requester = await signUpUser('community-requester', '요청자');
    const target = await signUpUser('community-target', '대상자');

    const requestFriend = await createFriendRequest(requester.id, target.id);
    expect(requestFriend.body.status).toBe('pending');

    const profileBeforeAccept = await request(app.getHttpServer())
      .get(`/community/profiles/${encodeURIComponent(target.id)}?currentUserId=${encodeURIComponent(requester.id)}`)
      .set('x-user-id', requester.id);

    expect(profileBeforeAccept.status).toBe(200);
    expect(profileBeforeAccept.body.profile.relationship).toBe('pending-incoming');
    expect(profileBeforeAccept.body.incomingFriendRequestId).toBe(requestFriend.body.id);

    const accept = await acceptFriendRequest(requestFriend.body.id as string, target.id);
    expect(accept.body.status).toBe('accepted');

    const mailbox = await request(app.getHttpServer())
      .get('/community/mailbox')
      .set('x-user-id', target.id);

    const requesterMailbox = await request(app.getHttpServer())
      .get('/community/mailbox')
      .set('x-user-id', requester.id);

    expect(mailbox.status).toBe(200);
    expect(requesterMailbox.status).toBe(200);
    expect(Array.isArray(mailbox.body.friendRequests)).toBe(true);
    const acceptedRequest = mailbox.body.friendRequests.find((item: { id: string }) => item.id === requestFriend.body.id);
    const requesterAcceptedRequest = requesterMailbox.body.friendRequests.find((item: { id: string }) => item.id === requestFriend.body.id);
    expect(acceptedRequest?.status).toBe('accepted');
    expect(requesterAcceptedRequest?.status).toBe('accepted');

    const board = await request(app.getHttpServer())
      .get('/community')
      .set('x-user-id', requester.id);

    expect(board.status).toBe(200);
    expect(Array.isArray(board.body.friends)).toBe(true);
    expect(board.body.friends.some((friend: { id: string }) => friend.id === target.id)).toBe(true);

    const targetBoard = await request(app.getHttpServer())
      .get('/community')
      .set('x-user-id', target.id);

    expect(targetBoard.status).toBe(200);
    expect(targetBoard.body.friends.some((friend: { id: string }) => friend.id === requester.id)).toBe(true);

    const requesterProfileAfterAccept = await request(app.getHttpServer())
      .get(`/community/profiles/${encodeURIComponent(target.id)}?currentUserId=${encodeURIComponent(requester.id)}`)
      .set('x-user-id', requester.id);
    const targetProfileAfterAccept = await request(app.getHttpServer())
      .get(`/community/profiles/${encodeURIComponent(requester.id)}?currentUserId=${encodeURIComponent(target.id)}`)
      .set('x-user-id', target.id);

    expect(requesterProfileAfterAccept.status).toBe(200);
    expect(targetProfileAfterAccept.status).toBe(200);
    expect(requesterProfileAfterAccept.body.profile.relationship).toBe('friend');
    expect(targetProfileAfterAccept.body.profile.relationship).toBe('friend');
  });

  it('친구 요청 거절 후 양쪽 mailbox에 동일한 상태가 반영된다', async () => {
    const requester = await signUpUser('community-reject-requester', '거절요청자');
    const target = await signUpUser('community-reject-target', '거절대상자');

    const requestFriend = await createFriendRequest(requester.id, target.id);
    const rejected = await rejectFriendRequest(requestFriend.body.id as string, target.id);

    expect(rejected.body.status).toBe('rejected');

    const requesterMailbox = await request(app.getHttpServer())
      .get('/community/mailbox')
      .set('x-user-id', requester.id);
    const targetMailbox = await request(app.getHttpServer())
      .get('/community/mailbox')
      .set('x-user-id', target.id);

    expect(requesterMailbox.status).toBe(200);
    expect(targetMailbox.status).toBe(200);

    const requesterRejected = requesterMailbox.body.friendRequests.find((item: { id: string }) => item.id === requestFriend.body.id);
    const targetRejected = targetMailbox.body.friendRequests.find((item: { id: string }) => item.id === requestFriend.body.id);

    expect(requesterRejected?.status).toBe('rejected');
    expect(targetRejected?.status).toBe('rejected');
  });

  it('수락/거절이 완료된 친구 요청은 재처리할 수 없다', async () => {
    const acceptRequester = await signUpUser('community-terminal-accept-requester', '완료요청자A');
    const acceptTarget = await signUpUser('community-terminal-accept-target', '완료대상자A');

    const acceptedRequest = await createFriendRequest(acceptRequester.id, acceptTarget.id);
    await acceptFriendRequest(acceptedRequest.body.id as string, acceptTarget.id);

    const rejectAfterAccept = await request(app.getHttpServer())
      .post(`/community/friend-requests/${encodeURIComponent(acceptedRequest.body.id as string)}/reject`)
      .set('x-user-id', acceptTarget.id)
      .send({});

    expect(rejectAfterAccept.status).toBe(400);

    const rejectRequester = await signUpUser('community-terminal-reject-requester', '완료요청자B');
    const rejectTarget = await signUpUser('community-terminal-reject-target', '완료대상자B');

    const rejectedRequest = await createFriendRequest(rejectRequester.id, rejectTarget.id);
    await rejectFriendRequest(rejectedRequest.body.id as string, rejectTarget.id);

    const acceptAfterReject = await request(app.getHttpServer())
      .post(`/community/friend-requests/${encodeURIComponent(rejectedRequest.body.id as string)}/accept`)
      .set('x-user-id', rejectTarget.id)
      .send({});

    expect(acceptAfterReject.status).toBe(400);
  });

  it('익명 댓글 작성자의 신원을 생성/조회 응답에서 마스킹한다', async () => {
    const user = await signUpUser('community-commenter', '댓글작성자');

    const post = await request(app.getHttpServer())
      .post('/community/posts')
      .set('x-user-id', user.id)
      .send({
        title: '익명 댓글 게시글',
        content: '내용',
      });

    expect(post.status).toBe(201);

    const createdComment = await request(app.getHttpServer())
      .post(`/community/posts/${encodeURIComponent(post.body.id)}/comments`)
      .set('x-user-id', user.id)
      .send({
        content: '익명 댓글입니다',
        authorVisibility: 'anonymous',
      });

    expect(createdComment.status).toBe(201);
    expect(createdComment.body.authorVisibility).toBe('anonymous');
    expect(createdComment.body.authorName).toBe('익명');
    expect(createdComment.body.authorAvatar).toBe('익');
    expect(createdComment.body.authorPhotoUrl).toBeUndefined();

    const listedComments = await request(app.getHttpServer())
      .get(`/community/posts/${encodeURIComponent(post.body.id)}/comments`)
      .set('x-user-id', user.id);

    expect(listedComments.status).toBe(200);
    expect(Array.isArray(listedComments.body)).toBe(true);
    const anonymousListed = listedComments.body.find((item: { id: string }) => item.id === createdComment.body.id);
    expect(anonymousListed?.authorVisibility).toBe('anonymous');
    expect(anonymousListed?.authorName).toBe('익명');
    expect(anonymousListed?.authorAvatar).toBe('익');
    expect(anonymousListed?.authorPhotoUrl).toBeUndefined();
  });

  it('pending 친구요청 알림은 수신자 mailbox에만 나타난다', async () => {
    const requester = await signUpUser('community-noti-requester', '보낸사용자');
    const receiver = await signUpUser('community-noti-receiver', '받는사용자');

    const createdRequest = await createFriendRequest(requester.id, receiver.id);

    const requesterMailbox = await request(app.getHttpServer())
      .get('/community/mailbox')
      .set('x-user-id', requester.id);
    const receiverMailbox = await request(app.getHttpServer())
      .get('/community/mailbox')
      .set('x-user-id', receiver.id);

    expect(requesterMailbox.status).toBe(200);
    expect(receiverMailbox.status).toBe(200);

    const requesterPending = requesterMailbox.body.notifications.filter(
      (item: { relatedRequestId?: string; title: string }) =>
        item.relatedRequestId === createdRequest.body.id && item.title === '새 친구 요청',
    );
    const receiverPending = receiverMailbox.body.notifications.filter(
      (item: { relatedRequestId?: string; title: string }) =>
        item.relatedRequestId === createdRequest.body.id && item.title === '새 친구 요청',
    );

    expect(requesterPending).toHaveLength(0);
    expect(receiverPending).toHaveLength(1);
    expect(receiverPending[0].actorId).toBe(requester.id);
  });

  it('친구 관계 성립 후 direct message가 프로필 메시지 목록에 포함된다', async () => {
    const requester = await signUpUser('community-dm-requester', '채팅요청자');
    const target = await signUpUser('community-dm-target', '채팅대상자');

    const friendRequest = await createFriendRequest(requester.id, target.id);

    const accepted = await acceptFriendRequest(friendRequest.body.id as string, target.id);
    expect(accepted.body.status).toBe('accepted');

    const sent = await request(app.getHttpServer())
      .post('/community/messages/direct')
      .set('x-user-id', requester.id)
      .send({
        recipientId: target.id,
        content: 'E2E 다이렉트 메시지',
      });

    expect(sent.status).toBe(201);
    expect(sent.body.senderId).toBe(requester.id);
    expect(sent.body.recipientId).toBe(target.id);

    const profile = await request(app.getHttpServer())
      .get(`/community/profiles/${encodeURIComponent(target.id)}?currentUserId=${encodeURIComponent(requester.id)}`)
      .set('x-user-id', requester.id);

    expect(profile.status).toBe(200);
    expect(profile.body.canChat).toBe(true);
    expect(profile.body.messages.length).toBeGreaterThan(0);
    expect(profile.body.messages.some((item: { content: string }) => item.content === 'E2E 다이렉트 메시지')).toBe(true);
  });

  it('인증 없이 친구요청/수락/DM API 호출 시 401을 반환한다', async () => {
    const friendRequestWithoutAuth = await request(app.getHttpServer())
      .post('/community/friend-requests')
      .send({ targetId: 'some-user-id' });

    expect(friendRequestWithoutAuth.status).toBe(401);

    const acceptWithoutAuth = await request(app.getHttpServer())
      .post('/community/friend-requests/some-request-id/accept')
      .send({});

    expect(acceptWithoutAuth.status).toBe(401);

    const directMessageWithoutAuth = await request(app.getHttpServer())
      .post('/community/messages/direct')
      .send({ recipientId: 'some-user-id', content: '인증 없음' });

    expect(directMessageWithoutAuth.status).toBe(401);
  });
});
