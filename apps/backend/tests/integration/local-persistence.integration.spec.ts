import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth';

describe('Local persistence across application restarts', () => {
  let app: INestApplication | undefined;
  let directory: string;
  const previousDirectory = process.env.LOCAL_STATE_DIR;
  const previousProvider = process.env.AUTH_STORAGE_PROVIDER;

  async function start() {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    return app;
  }

  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), 'keepit-restart-'));
    process.env.LOCAL_STATE_DIR = directory;
    delete process.env.AUTH_STORAGE_PROVIDER;
  });
  afterAll(async () => {
    await app?.close();
    if (previousDirectory === undefined) delete process.env.LOCAL_STATE_DIR;
    else process.env.LOCAL_STATE_DIR = previousDirectory;
    if (previousProvider === undefined) delete process.env.AUTH_STORAGE_PROVIDER;
    else process.env.AUTH_STORAGE_PROVIDER = previousProvider;
    rmSync(directory, { recursive: true, force: true });
  });

  it('restores identities, private conversations, posts, interactions and entity methods', async () => {
    const first = await start();
    const auth = first.get(AuthService);
    const owner = await auth.signUpLocal({ email: 'restart-owner@test.com', password: 'RestartSecret!2026', displayName: 'Owner' });
    const peer = await auth.signUpLocal({ email: 'restart-peer@test.com', password: 'RestartSecret!2026', displayName: 'Peer' });
    const ownerCookie = `keepit-session=${await auth.createSession(owner.user.id)}`;
    const peerCookie = `keepit-session=${await auth.createSession(peer.user.id)}`;
    const server = first.getHttpServer();
    const post = await request(server).post('/community/posts').set('Cookie', ownerCookie).send({ title: 'Persistent post', content: 'Persistent body' }).expect(201);
    await request(server).post(`/community/posts/${post.body.id}/comments`).set('Cookie', peerCookie).send({ content: 'Persistent comment' }).expect(201);
    const friend = await request(server).post('/community/friend-requests').set('Cookie', ownerCookie).send({ targetId: peer.user.id }).expect(201);
    await request(server).post(`/community/friend-requests/${friend.body.id}/accept`).set('Cookie', peerCookie).expect(201);
    await request(server).post('/community/messages/direct').set('Cookie', ownerCookie).send({ recipientId: peer.user.id, content: 'Persistent private message' }).expect(201);
    const question = await request(server).post('/questions').set('Cookie', ownerCookie).send({ title: 'Persistent question', body: 'Question body', subject: 'MATH', grade: '2' }).expect(201);
    await request(server).post(`/questions/${question.body.id}/answers`).set('Cookie', peerCookie).send({ type: 'text', content: 'Persistent answer' }).expect(201);
    const video = await request(server).post('/videos').set('Cookie', ownerCookie).send({ title: 'Persistent video', url: 'https://stream.test/restart', durationSeconds: 100 }).expect(201);
    await request(server).post(`/videos/${video.body.id}/like`).set('Cookie', peerCookie).expect(200);
    const mentoring = await request(server).post('/mentoring/sessions').set('Cookie', ownerCookie).send({ question: 'Persistent mentoring' }).expect(201);
    await request(server).post(`/mentoring/sessions/${mentoring.body.id}/messages`).set('Cookie', ownerCookie).send({ sender: 'learner', content: 'Persistent session message' }).expect(201);
    await auth.updateUserRole(peer.user.id, 'admin');
    await first.close();
    app = undefined;

    const second = await start();
    const restoredAuth = second.get(AuthService);
    expect((await restoredAuth.signInLocal(owner.user.email, 'RestartSecret!2026')).id).toBe(owner.user.id);
    await expect(restoredAuth.signInLocal(owner.user.email, 'wrong-password')).rejects.toThrow();
    expect((await restoredAuth.signInLocal(peer.user.email, 'RestartSecret!2026')).role).toBe('admin');
    expect(readFileSync(join(directory, 'auth.bin')).includes(Buffer.from('RestartSecret!2026'))).toBe(false);
    const restored = second.getHttpServer();
    const profile = await request(restored).get(`/community/profiles/${peer.user.id}`).set('Cookie', ownerCookie).expect(200);
    expect(profile.body.canChat).toBe(true);
    expect(profile.body.messages[0].content).toBe('Persistent private message');
    const comments = await request(restored).get(`/community/posts/${post.body.id}/comments`).expect(200);
    expect(comments.body[0].content).toBe('Persistent comment');
    const questionDetail = await request(restored).get(`/questions/${question.body.id}`).expect(200);
    expect(questionDetail.body.answerCount).toBe(1);
    await request(restored).patch(`/questions/${question.body.id}/solve`).set('Cookie', ownerCookie).expect(200);
    const videoDetail = await request(restored).get(`/videos/${video.body.id}`).expect(200);
    expect(videoDetail.body.likeCount).toBe(1);
    await request(restored).post(`/videos/${video.body.id}/like`).set('Cookie', peerCookie).expect(200);
    const toggledVideo = await request(restored).get(`/videos/${video.body.id}`).expect(200);
    expect(toggledVideo.body.likeCount).toBe(0);
    const mentoringDetail = await request(restored).get(`/mentoring/sessions/${mentoring.body.id}`).set('Cookie', ownerCookie).expect(200);
    expect(mentoringDetail.body.messages[0].content).toBe('Persistent session message');
  }, 20_000);
});