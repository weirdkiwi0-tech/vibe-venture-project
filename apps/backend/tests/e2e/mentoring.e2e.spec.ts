import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth';
import { createAdminSession } from '../support/e2e-helpers';

describe('Mentoring API (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;
  let testDbPath = '';
  const originalDbPath = process.env.DB_PATH;

  beforeAll(async () => {
    testDbPath = resolve(process.cwd(), `data/test-mentoring-e2e-${randomUUID()}.sqlite`);
    process.env.DB_PATH = testDbPath;

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

  afterAll(async () => {
    await app.close();

    process.env.DB_PATH = originalDbPath;
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('creates session, sends messages, and fetches details', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/mentoring/sessions')
      .send({ question: 'e2e mentoring question' });

    expect(createRes.status).toBe(201);

    const sessionId = createRes.body.id;

    const learnerMessageRes = await request(app.getHttpServer())
      .post(`/mentoring/sessions/${sessionId}/messages`)
      .send({ sender: 'learner', content: 'hello mentor' });
    expect(learnerMessageRes.status).toBe(201);

    const mentorMessageRes = await request(app.getHttpServer())
      .post(`/mentoring/sessions/${sessionId}/messages`)
      .send({ sender: 'mentor', content: 'hello learner' });
    expect(mentorMessageRes.status).toBe(201);

    const findRes = await request(app.getHttpServer()).get(
      `/mentoring/sessions/${sessionId}`,
    );

    expect(findRes.status).toBe(200);
    expect(findRes.body.messages).toHaveLength(2);
    expect(findRes.body.firstMentorResponseAt).not.toBeNull();
    expect(findRes.body.isSlaBreached).toBe(false);
  });

  it('returns 404 when sending message to unknown session', async () => {
    const res = await request(app.getHttpServer())
      .post('/mentoring/sessions/unknown/messages')
      .send({ sender: 'mentor', content: 'x' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when message violates safety policy', async () => {
    const created = await request(app.getHttpServer())
      .post('/mentoring/sessions')
      .send({ question: 'policy e2e test' });

    const res = await request(app.getHttpServer())
      .post(`/mentoring/sessions/${created.body.id}/messages`)
      .send({ sender: 'learner', content: 'my phone is 010-1234-5678' });

    expect(res.status).toBe(400);
  });

  it('GET /mentoring/sessions/sla/breaches -> 403 without admin role', async () => {
    const res = await request(app.getHttpServer()).get('/mentoring/sessions/sla/breaches');
    expect(res.status).toBe(403);
  });

  it('GET /mentoring/sessions/sla/breaches -> 200 with admin role', async () => {
    const adminSession = await createAdminSession(authService, {
      email: 'mentoring-admin@example.com',
      googleId: `mentoring-admin-${Date.now()}`,
      displayName: 'Mentoring Admin',
    });

    const session = await request(app.getHttpServer())
      .post('/mentoring/sessions')
      .send({ question: 'sla breach candidate' });

    const res = await request(app.getHttpServer())
      .get('/mentoring/sessions/sla/breaches')
      .set('Cookie', [`keepit-session=${adminSession}`]);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((item: { id: string }) => item.id === session.body.id)).toBe(false);
  });

  it('keeps firstMentorResponseAt at first mentor message and ignores learner messages', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/mentoring/sessions')
      .send({ question: 'first mentor response e2e contract' });

    expect(createRes.status).toBe(201);
    const sessionId = createRes.body.id;

    const learnerRes = await request(app.getHttpServer())
      .post(`/mentoring/sessions/${sessionId}/messages`)
      .send({ sender: 'learner', content: 'learner first' });
    expect(learnerRes.status).toBe(201);

    const afterLearnerRes = await request(app.getHttpServer()).get(
      `/mentoring/sessions/${sessionId}`,
    );
    expect(afterLearnerRes.status).toBe(200);
    expect(afterLearnerRes.body.firstMentorResponseAt).toBeNull();

    const firstMentorRes = await request(app.getHttpServer())
      .post(`/mentoring/sessions/${sessionId}/messages`)
      .send({ sender: 'mentor', content: 'first mentor' });
    expect(firstMentorRes.status).toBe(201);

    const secondMentorRes = await request(app.getHttpServer())
      .post(`/mentoring/sessions/${sessionId}/messages`)
      .send({ sender: 'mentor', content: 'second mentor' });
    expect(secondMentorRes.status).toBe(201);

    const afterMentorRes = await request(app.getHttpServer()).get(
      `/mentoring/sessions/${sessionId}`,
    );

    expect(afterMentorRes.status).toBe(200);
    expect(afterMentorRes.body.firstMentorResponseAt).toBe(firstMentorRes.body.createdAt);
  });
});
