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
});
