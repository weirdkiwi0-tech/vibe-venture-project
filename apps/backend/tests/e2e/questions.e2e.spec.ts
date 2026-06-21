import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth';

describe('Questions API (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;

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

  it('POST /questions -> 201', async () => {
    const res = await request(app.getHttpServer()).post('/questions').send({
      title: 'E2E title',
      body: 'E2E body',
      subject: 'MATH',
      grade: '2',
      visibility: 'anonymous',
      attachments: ['https://file.test/a.png'],
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('open');
  });

  it('POST /questions -> 400 when title missing', async () => {
    const res = await request(app.getHttpServer()).post('/questions').send({
      body: 'E2E body',
      subject: 'MATH',
      grade: '2',
    });

    expect(res.status).toBe(400);
  });

  it('GET /questions/:id -> 200 and 404', async () => {
    const created = await request(app.getHttpServer()).post('/questions').send({
      title: 'to fetch',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    });

    const ok = await request(app.getHttpServer()).get(
      `/questions/${created.body.id}`,
    );
    expect(ok.status).toBe(200);
    expect(ok.body.answerCount).toBe(0);

    const notFound = await request(app.getHttpServer()).get('/questions/not-found');
    expect(notFound.status).toBe(404);
  });

  it('POST/GET /questions/:id/answers and answerCount update', async () => {
    const created = await request(app.getHttpServer()).post('/questions').send({
      title: 'question with answers',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });

    const createAnswerRes = await request(app.getHttpServer())
      .post(`/questions/${created.body.id}/answers`)
      .send({
        type: 'text',
        content: 'first answer',
      });

    expect(createAnswerRes.status).toBe(201);
    expect(createAnswerRes.body.questionId).toBe(created.body.id);

    const listRes = await request(app.getHttpServer()).get(
      `/questions/${created.body.id}/answers`,
    );
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);

    const questionRes = await request(app.getHttpServer()).get(
      `/questions/${created.body.id}`,
    );
    expect(questionRes.status).toBe(200);
    expect(questionRes.body.answerCount).toBe(1);
  });

  it('rejects non-video attachments when answer type is video', async () => {
    const created = await request(app.getHttpServer()).post('/questions').send({
      title: 'video-only attachment rule',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });

    const res = await request(app.getHttpServer())
      .post(`/questions/${created.body.id}/answers`)
      .send({
        type: 'video',
        content: 'video answer',
        attachments: ['data:image/png;base64,AAAA'],
      });

    expect(res.status).toBe(400);
    expect(String(res.body.message)).toContain('video media only');
  });

  it('POST /questions/answers/:answerId/like toggles and comments support replies', async () => {
    const created = await request(app.getHttpServer()).post('/questions').send({
      title: 'question with answer interactions',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });

    const createAnswerRes = await request(app.getHttpServer())
      .post(`/questions/${created.body.id}/answers`)
      .set('x-user-id', 'answer-author')
      .send({
        type: 'text',
        content: 'answer content',
      });

    const answerId = createAnswerRes.body.id as string;

    const likeFirst = await request(app.getHttpServer())
      .post(`/questions/answers/${answerId}/like`)
      .set('x-user-id', 'u-1');
    const likeSecond = await request(app.getHttpServer())
      .post(`/questions/answers/${answerId}/like`)
      .set('x-user-id', 'u-1');

    expect(likeFirst.status).toBe(201);
    expect(likeFirst.body.likeCount).toBe(1);
    expect(likeFirst.body.liked).toBe(true);
    expect(likeSecond.body.likeCount).toBe(0);
    expect(likeSecond.body.liked).toBe(false);

    const rootComment = await request(app.getHttpServer())
      .post(`/questions/answers/${answerId}/comments`)
      .set('x-user-id', 'u-2')
      .send({
        content: 'root comment',
        attachments: ['data:image/png;base64,AAAA'],
      });

    const replyComment = await request(app.getHttpServer())
      .post(`/questions/answers/${answerId}/comments`)
      .set('x-user-id', 'u-3')
      .send({
        content: 'reply comment',
        parentCommentId: rootComment.body.id,
        attachments: ['data:video/mp4;base64,BBBB'],
      });

    expect(rootComment.status).toBe(201);
    expect(replyComment.status).toBe(201);

    const listAnswersRes = await request(app.getHttpServer()).get(
      `/questions/${created.body.id}/answers`,
    );

    expect(listAnswersRes.status).toBe(200);
    expect(listAnswersRes.body[0].likeCount).toBe(0);
    expect(listAnswersRes.body[0].comments).toHaveLength(1);
    expect(listAnswersRes.body[0].comments[0].content).toBe('root comment');
    expect(listAnswersRes.body[0].comments[0].attachments).toEqual(['data:image/png;base64,AAAA']);
    expect(listAnswersRes.body[0].comments[0].replies).toHaveLength(1);
    expect(listAnswersRes.body[0].comments[0].replies[0].content).toBe('reply comment');
    expect(listAnswersRes.body[0].comments[0].replies[0].attachments).toEqual(['data:video/mp4;base64,BBBB']);
  });

  it('PATCH /questions/:id/solve -> 200 and idempotent', async () => {
    const created = await request(app.getHttpServer()).post('/questions').send({
      title: 'to solve',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });

    const first = await request(app.getHttpServer()).patch(
      `/questions/${created.body.id}/solve`,
    );
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('solved');

    const second = await request(app.getHttpServer()).patch(
      `/questions/${created.body.id}/solve`,
    );
    expect(second.status).toBe(200);
    expect(second.body.status).toBe('solved');
  });

  it('PATCH /questions/:id/solve -> 404 for unknown id', async () => {
    const res = await request(app.getHttpServer()).patch('/questions/not-found/solve');
    expect(res.status).toBe(404);
  });

  it('GET /questions includes solved status in list', async () => {
    const created = await request(app.getHttpServer()).post('/questions').send({
      title: 'list solved target',
      body: 'body',
      subject: 'MATH',
      grade: '3',
    });

    await request(app.getHttpServer()).patch(`/questions/${created.body.id}/solve`);

    const listRes = await request(app.getHttpServer()).get('/questions');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);

    const found = listRes.body.find((item: { id: string; status: string }) => item.id === created.body.id);
    expect(found).toBeDefined();
    expect(found.status).toBe('solved');
  });

  it('GET /questions filters by subject and grade', async () => {
    await request(app.getHttpServer()).post('/questions').send({
      title: 'filter math',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });

    await request(app.getHttpServer()).post('/questions').send({
      title: 'filter english',
      body: 'body',
      subject: 'ENGLISH',
      grade: '2',
    });

    const res = await request(app.getHttpServer()).get('/questions?subject=MATH&grade=2');

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(
      res.body.every(
        (item: { subject: string; grade: string }) =>
          item.subject === 'MATH' && item.grade === '2',
      ),
    ).toBe(true);
  });

  it('GET /videos returns an array and supports empty state', async () => {
    const res = await request(app.getHttpServer()).get('/videos');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /questions/:id/like toggles per account', async () => {
    const created = await request(app.getHttpServer()).post('/questions').send({
      title: 'like once e2e',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });

    const user1 = authService.signInWithGoogle({
      googleId: `google-like-u1-${Date.now()}`,
      email: `like-u1-${Date.now()}@example.com`,
      displayName: 'Like User 1',
    });
    const user2 = authService.signInWithGoogle({
      googleId: `google-like-u2-${Date.now()}`,
      email: `like-u2-${Date.now()}@example.com`,
      displayName: 'Like User 2',
    });
    const user1Session = authService.createSession(user1.user.id);
    const user2Session = authService.createSession(user2.user.id);

    const first = await request(app.getHttpServer())
      .post(`/questions/${created.body.id}/like`)
      .set('Cookie', [`keepit-session=${user1Session}`]);
    const second = await request(app.getHttpServer())
      .post(`/questions/${created.body.id}/like`)
      .set('Cookie', [`keepit-session=${user1Session}`]);
    const third = await request(app.getHttpServer())
      .post(`/questions/${created.body.id}/like`)
      .set('Cookie', [`keepit-session=${user2Session}`]);
    const fourth = await request(app.getHttpServer())
      .post(`/questions/${created.body.id}/like`)
      .set('Cookie', [`keepit-session=${user1Session}`]);

    expect(first.status).toBe(201);
    expect(first.body.likeCount).toBe(1);
    expect(first.body.liked).toBe(true);
    expect(second.body.likeCount).toBe(0);
    expect(second.body.liked).toBe(false);
    expect(third.body.likeCount).toBe(1);
    expect(third.body.liked).toBe(true);
    expect(fourth.body.likeCount).toBe(2);
    expect(fourth.body.liked).toBe(true);
  });

  it('POST /questions/:id/like -> 401 when user header is missing', async () => {
    const created = await request(app.getHttpServer()).post('/questions').send({
      title: 'like auth required',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });

    const res = await request(app.getHttpServer()).post(`/questions/${created.body.id}/like`);
    expect(res.status).toBe(401);
  });

  it('GET /questions returns top ordered by likeCount desc', async () => {
    const low = await request(app.getHttpServer()).post('/questions').send({
      title: 'top-low',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    });
    const high = await request(app.getHttpServer()).post('/questions').send({
      title: 'top-high',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    });

    const topUser1 = authService.signInWithGoogle({
      googleId: `google-top-u1-${Date.now()}`,
      email: `top-u1-${Date.now()}@example.com`,
      displayName: 'Top User 1',
    });
    const topUser2 = authService.signInWithGoogle({
      googleId: `google-top-u2-${Date.now()}`,
      email: `top-u2-${Date.now()}@example.com`,
      displayName: 'Top User 2',
    });
    const topUser1Session = authService.createSession(topUser1.user.id);
    const topUser2Session = authService.createSession(topUser2.user.id);

    await request(app.getHttpServer())
      .post(`/questions/${low.body.id}/like`)
      .set('Cookie', [`keepit-session=${topUser1Session}`]);

    await request(app.getHttpServer())
      .post(`/questions/${high.body.id}/like`)
      .set('Cookie', [`keepit-session=${topUser1Session}`]);
    await request(app.getHttpServer())
      .post(`/questions/${high.body.id}/like`)
      .set('Cookie', [`keepit-session=${topUser2Session}`]);

    const res = await request(app.getHttpServer()).get('/questions');
    expect(res.status).toBe(200);

    const highIndex = res.body.findIndex((item: { id: string }) => item.id === high.body.id);
    const lowIndex = res.body.findIndex((item: { id: string }) => item.id === low.body.id);
    expect(highIndex).toBeGreaterThanOrEqual(0);
    expect(lowIndex).toBeGreaterThanOrEqual(0);
    expect(highIndex).toBeLessThan(lowIndex);
  });

  it('hides reported question only for reporter', async () => {
    const created = await request(app.getHttpServer()).post('/questions').send({
      title: 'report-hide-target',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    });

    const reporter = authService.signInWithGoogle({
      googleId: `google-reporter-${Date.now()}`,
      email: `reporter-${Date.now()}@example.com`,
      displayName: 'Reporter User',
    });
    const another = authService.signInWithGoogle({
      googleId: `google-another-${Date.now()}`,
      email: `another-${Date.now()}@example.com`,
      displayName: 'Another User',
    });

    const reporterSession = authService.createSession(reporter.user.id);
    const anotherSession = authService.createSession(another.user.id);

    const reportRes = await request(app.getHttpServer())
      .post('/reports')
      .set('Cookie', [`keepit-session=${reporterSession}`])
      .send({
        targetType: 'question',
        targetId: created.body.id,
        reason: 'hide for me',
        details: 'not interested',
        severity: 'normal',
      });

    expect(reportRes.status).toBe(201);

    const reporterList = await request(app.getHttpServer())
      .get('/questions')
      .set('Cookie', [`keepit-session=${reporterSession}`]);
    const anotherList = await request(app.getHttpServer())
      .get('/questions')
      .set('Cookie', [`keepit-session=${anotherSession}`]);

    expect(reporterList.status).toBe(200);
    expect(anotherList.status).toBe(200);
    expect(reporterList.body.some((item: { id: string }) => item.id === created.body.id)).toBe(false);
    expect(anotherList.body.some((item: { id: string }) => item.id === created.body.id)).toBe(true);
  });
});
