import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Community API (e2e)', () => {
  let app: INestApplication;

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

  it('creates, accepts, and reflects friend requests in mailbox and board', async () => {
    const requesterEmail = `community-requester-${randomUUID()}@example.com`;
    const targetEmail = `community-target-${randomUUID()}@example.com`;

    const requesterSignUp = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: requesterEmail,
        password: 'Password123!',
        displayName: '요청자',
      });

    const targetSignUp = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: targetEmail,
        password: 'Password123!',
        displayName: '대상자',
      });

    expect(requesterSignUp.status).toBe(201);
    expect(targetSignUp.status).toBe(201);

    const requesterId = requesterSignUp.body.user.id as string;
    const targetId = targetSignUp.body.user.id as string;

    const requestFriend = await request(app.getHttpServer())
      .post('/community/friend-requests')
      .set('x-user-id', requesterId)
      .send({ targetId });

    expect(requestFriend.status).toBe(201);
    expect(requestFriend.body.status).toBe('pending');

    const profileBeforeAccept = await request(app.getHttpServer())
      .get(`/community/profiles/${encodeURIComponent(targetId)}?currentUserId=${encodeURIComponent(requesterId)}`)
      .set('x-user-id', requesterId);

    expect(profileBeforeAccept.status).toBe(200);
    expect(profileBeforeAccept.body.profile.relationship).toBe('pending-incoming');
    expect(profileBeforeAccept.body.incomingFriendRequestId).toBe(requestFriend.body.id);

    const accept = await request(app.getHttpServer())
      .post(`/community/friend-requests/${encodeURIComponent(requestFriend.body.id)}/accept`)
      .set('x-user-id', targetId)
      .send({});

    expect(accept.status).toBe(201);
    expect(accept.body.status).toBe('accepted');

    const mailbox = await request(app.getHttpServer())
      .get('/community/mailbox')
      .set('x-user-id', targetId);

    expect(mailbox.status).toBe(200);
    expect(Array.isArray(mailbox.body.friendRequests)).toBe(true);
    const acceptedRequest = mailbox.body.friendRequests.find((item: { id: string }) => item.id === requestFriend.body.id);
    expect(acceptedRequest?.status).toBe('accepted');

    const board = await request(app.getHttpServer())
      .get('/community')
      .set('x-user-id', requesterId);

    expect(board.status).toBe(200);
    expect(Array.isArray(board.body.friends)).toBe(true);
    expect(board.body.friends.some((friend: { id: string }) => friend.id === targetId)).toBe(true);
  });

  it('masks anonymous comment author identity in create and list responses', async () => {
    const userEmail = `community-commenter-${randomUUID()}@example.com`;

    const signUp = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: userEmail,
        password: 'Password123!',
        displayName: '댓글작성자',
      });

    expect(signUp.status).toBe(201);
    const userId = signUp.body.user.id as string;

    const post = await request(app.getHttpServer())
      .post('/community/posts')
      .set('x-user-id', userId)
      .send({
        title: '익명 댓글 게시글',
        content: '내용',
      });

    expect(post.status).toBe(201);

    const createdComment = await request(app.getHttpServer())
      .post(`/community/posts/${encodeURIComponent(post.body.id)}/comments`)
      .set('x-user-id', userId)
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
      .set('x-user-id', userId);

    expect(listedComments.status).toBe(200);
    expect(Array.isArray(listedComments.body)).toBe(true);
    const anonymousListed = listedComments.body.find((item: { id: string }) => item.id === createdComment.body.id);
    expect(anonymousListed?.authorVisibility).toBe('anonymous');
    expect(anonymousListed?.authorName).toBe('익명');
    expect(anonymousListed?.authorAvatar).toBe('익');
    expect(anonymousListed?.authorPhotoUrl).toBeUndefined();
  });

  it('returns pending friend-request notification only for receiver mailbox', async () => {
    const requesterEmail = `community-noti-requester-${randomUUID()}@example.com`;
    const receiverEmail = `community-noti-receiver-${randomUUID()}@example.com`;

    const requesterSignUp = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: requesterEmail,
        password: 'Password123!',
        displayName: '보낸사용자',
      });

    const receiverSignUp = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: receiverEmail,
        password: 'Password123!',
        displayName: '받는사용자',
      });

    expect(requesterSignUp.status).toBe(201);
    expect(receiverSignUp.status).toBe(201);

    const requesterId = requesterSignUp.body.user.id as string;
    const receiverId = receiverSignUp.body.user.id as string;

    const createdRequest = await request(app.getHttpServer())
      .post('/community/friend-requests')
      .set('x-user-id', requesterId)
      .send({ targetId: receiverId });

    expect(createdRequest.status).toBe(201);

    const requesterMailbox = await request(app.getHttpServer())
      .get('/community/mailbox')
      .set('x-user-id', requesterId);
    const receiverMailbox = await request(app.getHttpServer())
      .get('/community/mailbox')
      .set('x-user-id', receiverId);

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
    expect(receiverPending[0].actorId).toBe(requesterId);
  });
});
