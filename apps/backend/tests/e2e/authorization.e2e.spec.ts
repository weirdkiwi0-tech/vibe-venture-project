import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth';
import { CommunityService } from '../../src/community/community.service';

describe('Authorization API (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;
  const originalAdminEmails = process.env.GOOGLE_ADMIN_EMAILS;

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

    authService = moduleRef.get(AuthService);
  });

  afterEach(() => {
    process.env.GOOGLE_ADMIN_EMAILS = originalAdminEmails;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /admin/overview -> 403 when session role is user even if header says admin', async () => {
    process.env.GOOGLE_ADMIN_EMAILS = '';

    const login = await authService.signInWithGoogle({
      googleId: 'g-authz-user',
      email: 'user-authz@example.com',
      displayName: 'User Authz',
    });
    const sessionId = await authService.createSession(login.user.id);

    const res = await request(app.getHttpServer())
      .get('/admin/overview')
      .set('Cookie', [`keepit-session=${sessionId}`])
      .set('x-user-role', 'admin');

    expect(res.status).toBe(403);
  });

  it('GET /admin/overview -> 200 when session role is admin even if header says user', async () => {
    process.env.GOOGLE_ADMIN_EMAILS = 'admin-authz@example.com';

    const login = await authService.signInWithGoogle({
      googleId: 'g-authz-admin',
      email: 'admin-authz@example.com',
      displayName: 'Admin Authz',
    });
    const sessionId = await authService.createSession(login.user.id);

    const res = await request(app.getHttpServer())
      .get('/admin/overview')
      .set('Cookie', [`keepit-session=${sessionId}`])
      .set('x-user-role', 'user');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cards)).toBe(true);
  });

  it('rejects forged identity headers for private community actions', async () => {
    const user = await authService.signUpLocal({ email: `forged-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Identity owner' });
    const mailbox = await request(app.getHttpServer()).get('/community/mailbox').set('x-user-id', user.user.id);
    expect(mailbox.status).toBe(401);
    const message = await request(app.getHttpServer()).post('/community/messages/direct')
      .set('x-user-id', user.user.id).send({ recipientId: user.user.id, content: 'forged message' });
    expect(message.status).toBe(401);
  });

  it('does not expose a private conversation or friends through a claimed viewer ID', async () => {
    const community = app.get(CommunityService);
    const owner = await authService.signUpLocal({ email: `owner-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Chat owner' });
    const peer = await authService.signUpLocal({ email: `peer-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Chat peer' });
    const friend = await community.requestFriend(owner.user.id, peer.user.id);
    await community.acceptFriendRequest(friend.id, peer.user.id);
    await community.sendDirectMessage({ recipientId: peer.user.id, content: 'private conversation' }, owner.user.id);
    const guest = await request(app.getHttpServer()).get(`/community/profiles/${peer.user.id}?currentUserId=${owner.user.id}`)
      .set('x-user-id', owner.user.id);
    expect(guest.status).toBe(200);
    expect(guest.body.messages).toEqual([]);
    expect(guest.body.canChat).toBe(false);
    const board = await request(app.getHttpServer()).get('/community').set('x-user-id', owner.user.id);
    expect(board.body.friends).toEqual([]);
    const session = await authService.createSession(owner.user.id);
    const authenticated = await request(app.getHttpServer()).get(`/community/profiles/${peer.user.id}`)
      .set('Cookie', `keepit-session=${session}`);
    expect(authenticated.body.messages).toHaveLength(1);
    expect(authenticated.body.canChat).toBe(true);
  });

  it('rejects forged identities across question, video and report writes', async () => {
    for (const route of ['/questions', '/videos', '/reports', '/mentoring/sessions']) {
      const response = await request(app.getHttpServer()).post(route).set('x-user-id', 'victim').send({});
      expect(response.status).toBe(401);
    }
  });

  it('restricts mentoring reads and role claims to the owner and an administrator', async () => {
    const owner = await authService.signUpLocal({ email: `mentor-owner-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Owner' });
    const other = await authService.signUpLocal({ email: `mentor-other-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Other' });
    const cookie = `keepit-session=${await authService.createSession(owner.user.id)}`;
    const otherCookie = `keepit-session=${await authService.createSession(other.user.id)}`;
    const created = await request(app.getHttpServer()).post('/mentoring/sessions').set('Cookie', cookie).send({ question: 'Private mentoring question' });
    expect(created.status).toBe(201);
    const route = `/mentoring/sessions/${created.body.id}`;
    expect((await request(app.getHttpServer()).get(route)).status).toBe(401);
    expect((await request(app.getHttpServer()).get(route).set('Cookie', otherCookie)).status).toBe(403);
    expect((await request(app.getHttpServer()).post(`${route}/messages`).set('Cookie', cookie).send({ sender: 'mentor', content: 'Forged mentor' })).status).toBe(403);
    await authService.updateUserRole(other.user.id, 'admin');
    expect((await request(app.getHttpServer()).post(`${route}/messages`).set('Cookie', otherCookie).send({ sender: 'mentor', content: 'Authorized response' })).status).toBe(201);
    expect((await request(app.getHttpServer()).get(route).set('Cookie', cookie)).body.messages).toHaveLength(1);
  });

  it('does not identify anonymous authors through question responses or profile post lists', async () => {
    const owner = await authService.signUpLocal({ email: `anonymous-owner-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Hidden owner' });
    const cookie = `keepit-session=${await authService.createSession(owner.user.id)}`;
    const question = await request(app.getHttpServer()).post('/questions').set('Cookie', cookie)
      .send({ title: 'Anonymous question', body: 'Private identity', subject: 'MATH', grade: '2', visibility: 'anonymous' });
    expect(question.status).toBe(201);
    const detail = await request(app.getHttpServer()).get(`/questions/${question.body.id}`);
    expect(detail.body.authorId).toBe('anonymous');
    expect(detail.body.isOwner).toBe(false);
    const ownDetail = await request(app.getHttpServer()).get(`/questions/${question.body.id}`).set('Cookie', cookie);
    expect(ownDetail.body.authorId).toBe('anonymous');
    expect(ownDetail.body.isOwner).toBe(true);
    const post = await request(app.getHttpServer()).post('/community/posts').set('Cookie', cookie)
      .send({ title: 'Anonymous community', content: 'Hidden author', authorVisibility: 'anonymous' });
    expect(post.status).toBe(201);
    const profile = await request(app.getHttpServer()).get(`/community/profiles/${owner.user.id}`);
    expect(profile.body.recentPosts.some((item: { id: string }) => item.id === post.body.id)).toBe(false);
  });

  it('derives playback membership from the session, not the viewerType query', async () => {
    const owner = await authService.signUpLocal({ email: `playback-owner-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Viewer' });
    const cookie = `keepit-session=${await authService.createSession(owner.user.id)}`;
    const video = await request(app.getHttpServer()).post('/videos').set('Cookie', cookie).send({ title: 'Gate test', url: 'https://stream.test/gate', durationSeconds: 100 });
    expect(video.status).toBe(201);
    const route = `/videos/${video.body.id}/playback-policy?viewerType=member&positionPercent=75`;
    expect((await request(app.getHttpServer()).get(route)).body).toMatchObject({ canPlay: false, stopAtPercent: 50 });
    expect((await request(app.getHttpServer()).get(route).set('Cookie', cookie)).body).toMatchObject({ canPlay: true, stopAtPercent: 100 });
  });

  it('blocks an already issued session immediately after a ban', async () => {
    const owner = await authService.signUpLocal({ email: `banned-owner-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Suspended' });
    const cookie = `keepit-session=${await authService.createSession(owner.user.id)}`;
    await authService.banUser(owner.user.id, new Date(Date.now() + 60_000).toISOString());
    expect((await request(app.getHttpServer()).post('/community/posts').set('Cookie', cookie).send({ title: 'Blocked', content: 'Blocked' })).status).toBe(403);
    await authService.unbanUser(owner.user.id);
    expect((await request(app.getHttpServer()).post('/community/posts').set('Cookie', cookie).send({ title: 'Restored', content: 'Allowed' })).status).toBe(201);
  });

  it('protects report details and reward grants from ordinary users', async () => {
    const owner = await authService.signUpLocal({ email: `reward-owner-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Member' });
    const other = await authService.signUpLocal({ email: `reward-other-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Other' });
    const cookie = `keepit-session=${await authService.createSession(owner.user.id)}`;
    expect((await request(app.getHttpServer()).get('/reports')).status).toBe(403);
    expect((await request(app.getHttpServer()).get('/reports').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app.getHttpServer()).post('/rewards/earn').set('Cookie', cookie).send({ userId: owner.user.id, reason: 'forged grant', points: 9999 })).status).toBe(403);
    expect((await request(app.getHttpServer()).get(`/rewards/users/${other.user.id}/history`).set('Cookie', cookie)).status).toBe(403);
    expect((await request(app.getHttpServer()).get(`/rewards/users/${owner.user.id}/history`).set('Cookie', cookie)).status).toBe(200);
    await authService.updateUserRole(owner.user.id, 'admin');
    expect((await request(app.getHttpServer()).post('/rewards/earn').set('Cookie', cookie).send({ userId: other.user.id, reason: 'authorized grant', points: 10 })).status).toBe(201);
    expect((await request(app.getHttpServer()).get('/reports').set('Cookie', cookie)).status).toBe(200);
  });

  it('actually deletes a locally reported question and returns 404 for nonexistent reports', async () => {
    const owner = await authService.signUpLocal({ email: `moderation-owner-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Author' });
    const admin = await authService.signUpLocal({ email: `moderation-admin-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Admin' });
    await authService.updateUserRole(admin.user.id, 'admin');
    const cookie = `keepit-session=${await authService.createSession(owner.user.id)}`;
    const adminCookie = `keepit-session=${await authService.createSession(admin.user.id)}`;
    const question = await request(app.getHttpServer()).post('/questions').set('Cookie', cookie).send({ title: 'Reported question', body: 'Moderated body', subject: 'MATH', grade: '2' });
    expect(question.status).toBe(201);
    const report = await request(app.getHttpServer()).post('/reports').set('Cookie', adminCookie).send({ targetType: 'question', targetId: question.body.id, reason: 'moderation check' });
    expect(report.status).toBe(201);
    expect((await request(app.getHttpServer()).post(`/reports/${report.body.id}/delete-target`).set('Cookie', adminCookie).send({ reason: 'confirmed moderation' })).status).toBe(201);
    expect((await request(app.getHttpServer()).get(`/questions/${question.body.id}`)).status).toBe(404);
    expect((await request(app.getHttpServer()).post('/reports/missing/approve').set('Cookie', adminCookie).send({ reason: 'missing report' })).status).toBe(404);
  });

  it('removes moderated posts, answers, videos and comment reply trees from local storage', async () => {
    const owner = await authService.signUpLocal({ email: `cascade-owner-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Owner' });
    const admin = await authService.signUpLocal({ email: `cascade-admin-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Moderator' });
    await authService.updateUserRole(admin.user.id, 'admin');
    const ownerCookie = `keepit-session=${await authService.createSession(owner.user.id)}`;
    const adminCookie = `keepit-session=${await authService.createSession(admin.user.id)}`;
    const create = async (path: string, data: object) => {
      const response = await request(app.getHttpServer()).post(path).set('Cookie', ownerCookie).send(data);
      expect(response.status).toBe(201);
      return response.body;
    };
    const moderate = async (targetType: string, targetId: string) => {
      const report = await request(app.getHttpServer()).post('/reports').set('Cookie', adminCookie).send({ targetType, targetId, reason: 'confirmed removal' });
      expect(report.status).toBe(201);
      await request(app.getHttpServer()).post(`/reports/${report.body.id}/delete-target`).set('Cookie', adminCookie).send({ reason: 'remove target' }).expect(201);
    };
    const question = await create('/questions', { title: 'Cascade question', body: 'Question body', subject: 'MATH', grade: '2' });
    const answer = await create(`/questions/${question.id}/answers`, { type: 'text', content: 'Answer body' });
    const answerComment = await create(`/questions/answers/${answer.id}/comments`, { content: 'Answer comment' });
    await create(`/questions/answers/${answer.id}/comments`, { content: 'Answer reply', parentCommentId: answerComment.id });
    const post = await create('/community/posts', { title: 'Cascade post', content: 'Post body' });
    const postComment = await create(`/community/posts/${post.id}/comments`, { content: 'Community comment' });
    await create(`/community/posts/${post.id}/comments`, { content: 'Community reply', parentCommentId: postComment.id });
    const video = await create('/videos', { title: 'Cascade video', url: 'https://stream.test/cascade', durationSeconds: 100 });
    const videoComment = await create(`/videos/${video.id}/comments`, { content: 'Video comment' });
    for (const [id, path] of [
      [answerComment.id, `/questions/answers/${answer.id}/comments`],
      [postComment.id, `/community/posts/${post.id}/comments`],
      [videoComment.id, `/videos/${video.id}/comments`],
    ]) {
      await moderate('comment', id);
      const comments = await request(app.getHttpServer()).get(path).expect(200);
      expect(comments.body).toEqual([]);
    }
    await moderate('answer', answer.id);
    expect((await request(app.getHttpServer()).get(`/questions/${question.id}/answers`)).body).toEqual([]);
    await moderate('community-post', post.id);
    await request(app.getHttpServer()).get(`/community/posts/${post.id}`).expect(404);
    await moderate('video', video.id);
    await request(app.getHttpServer()).get(`/videos/${video.id}`).expect(404);
  });

  it('does not grant administrator access through unverified signup emails or password login', async () => {
    const email = `reserved-admin-${Date.now()}@test.com`;
    process.env.GOOGLE_ADMIN_EMAILS = email;
    const reserved = await request(app.getHttpServer()).post('/auth/signup').send({ email, password: 'Secure@99', displayName: 'Claimed admin' });
    expect(reserved.status).toBe(403);
    const account = await authService.signUpLocal({ email: `future-admin-${Date.now()}@test.com`, password: 'Secure@99', displayName: 'Local member' });
    process.env.GOOGLE_ADMIN_EMAILS = account.user.email;
    const signin = await request(app.getHttpServer()).post('/auth/signin').send({ email: account.user.email, password: 'Secure@99' });
    expect(signin.status).toBe(200);
    expect(signin.body.user.role).toBe('user');
    const cookies = signin.headers['set-cookie'];
    expect((await request(app.getHttpServer()).get('/admin/overview').set('Cookie', cookies)).status).toBe(403);
  });
});
