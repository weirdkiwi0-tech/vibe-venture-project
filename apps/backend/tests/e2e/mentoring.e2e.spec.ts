import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth';

describe('Mentoring API (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;

  function createAdminSession() {
    process.env.GOOGLE_ADMIN_EMAILS = 'mentoring-admin@example.com';
    const login = authService.signInWithGoogle({
      googleId: `mentoring-admin-${Date.now()}`,
      email: 'mentoring-admin@example.com',
      displayName: 'Mentoring Admin',
    });

    return authService.createSession(login.user.id);
  }

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

  afterAll(async () => {
    await app.close();
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
    const adminSession = createAdminSession();

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
});
