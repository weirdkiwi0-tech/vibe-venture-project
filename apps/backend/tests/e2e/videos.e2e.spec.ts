import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth';

describe('Videos API (e2e)', () => {
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

  it('POST /videos -> 201', async () => {
    const res = await request(app.getHttpServer()).post('/videos').send({
      title: 'e2e video',
      url: 'https://stream.test/e2e',
      durationSeconds: 240,
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('POST /videos -> 400 when url is missing', async () => {
    const res = await request(app.getHttpServer()).post('/videos').send({
      title: 'invalid',
      durationSeconds: 120,
    });

    expect(res.status).toBe(400);
  });

  it('GET /videos/home-top -> 200', async () => {
    await request(app.getHttpServer()).post('/videos').send({
      title: 'home-top target',
      url: 'https://stream.test/home-top',
      durationSeconds: 300,
    });

    const res = await request(app.getHttpServer()).get('/videos/home-top');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /videos/:id/playback-policy enforces guest boundary at 49.9, 50, 50.1', async () => {
    const created = await request(app.getHttpServer()).post('/videos').send({
      title: 'gate check',
      url: 'https://stream.test/gate-check',
      durationSeconds: 180,
    });

    const allowed = await request(app.getHttpServer()).get(
      `/videos/${created.body.id}/playback-policy?viewerType=guest&positionPercent=49.9`,
    );
    const at50 = await request(app.getHttpServer()).get(
      `/videos/${created.body.id}/playback-policy?viewerType=guest&positionPercent=50`,
    );
    const at50_1 = await request(app.getHttpServer()).get(
      `/videos/${created.body.id}/playback-policy?viewerType=guest&positionPercent=50.1`,
    );

    expect(allowed.status).toBe(200);
    expect(allowed.body).toMatchObject({
      canPlay: true,
      action: 'none',
      stopAtPercent: 50,
    });
    expect(at50.status).toBe(200);
    expect(at50.body).toMatchObject({
      canPlay: false,
      action: 'login_required',
      stopAtPercent: 50,
    });
    expect(at50_1.status).toBe(200);
    expect(at50_1.body).toMatchObject({
      canPlay: false,
      action: 'login_required',
      stopAtPercent: 50,
    });
  });

  it('GET /videos/:id/playback-policy always allows member with full playback policy', async () => {
    const created = await request(app.getHttpServer()).post('/videos').send({
      title: 'member gate check',
      url: 'https://stream.test/member-gate-check',
      durationSeconds: 180,
    });

    const at49_9 = await request(app.getHttpServer()).get(
      `/videos/${created.body.id}/playback-policy?viewerType=member&positionPercent=49.9`,
    );
    const at50 = await request(app.getHttpServer()).get(
      `/videos/${created.body.id}/playback-policy?viewerType=member&positionPercent=50`,
    );
    const at50_1 = await request(app.getHttpServer()).get(
      `/videos/${created.body.id}/playback-policy?viewerType=member&positionPercent=50.1`,
    );

    expect(at49_9.status).toBe(200);
    expect(at49_9.body).toMatchObject({
      canPlay: true,
      action: 'none',
      stopAtPercent: 100,
    });
    expect(at50.status).toBe(200);
    expect(at50.body).toMatchObject({
      canPlay: true,
      action: 'none',
      stopAtPercent: 100,
    });
    expect(at50_1.status).toBe(200);
    expect(at50_1.body).toMatchObject({
      canPlay: true,
      action: 'none',
      stopAtPercent: 100,
    });
  });

  it('GET /videos/:id -> 200', async () => {
    const created = await request(app.getHttpServer()).post('/videos').send({
      title: 'detail target',
      url: 'https://stream.test/detail-target',
      durationSeconds: 210,
    });

    const res = await request(app.getHttpServer()).get(`/videos/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.title).toBe('detail target');
  });

  it('POST /videos/:id/comments and GET /videos/:id/comments -> 201/200', async () => {
    const created = await request(app.getHttpServer()).post('/videos').send({
      title: 'comment target',
      url: 'https://stream.test/comment-target',
      durationSeconds: 220,
    });

    const write = await request(app.getHttpServer())
      .post(`/videos/${created.body.id}/comments`)
      .set('x-user-id', 'video-comment-user')
      .send({ content: '첫 댓글입니다' });

    expect(write.status).toBe(201);
    expect(write.body.videoId).toBe(created.body.id);

    const list = await request(app.getHttpServer()).get(`/videos/${created.body.id}/comments`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBeGreaterThan(0);
    expect(list.body[0].content).toBe('첫 댓글입니다');
  });

  it('POST /reports allows video target type', async () => {
    const created = await request(app.getHttpServer()).post('/videos').send({
      title: 'report target',
      url: 'https://stream.test/report-target',
      durationSeconds: 180,
    });

    const report = await request(app.getHttpServer())
      .post('/reports')
      .set('x-user-id', 'video-reporter')
      .send({
        targetType: 'video',
        targetId: created.body.id,
        reason: '테스트 신고',
        details: '영상 신고 동작 확인을 위한 상세 사유입니다.',
        severity: 'normal',
      });

    expect(report.status).toBe(201);
    expect(report.body.targetType).toBe('video');
    expect(report.body.targetId).toBe(created.body.id);
  });

  it('GET /videos/:id 응답에 uploaderId, uploaderName 필드 존재 및 non-null', async () => {
    const { user } = await authService.signUpLocal({
      email: `uploader-${Date.now()}@test.com`,
      password: 'Secure@99',
      displayName: '업로더닉네임',
    });
    const sessionId = await authService.createSession(user.id);

    const created = await request(app.getHttpServer())
      .post('/videos')
      .set('Cookie', [`keepit-session=${sessionId}`])
      .set('x-user-id', user.id)
      .send({ title: '업로더테스트', url: 'https://stream.test/uploader', durationSeconds: 60 });
    expect(created.status).toBe(201);

    const detail = await request(app.getHttpServer()).get(`/videos/${created.body.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.uploaderId).toBeDefined();
    expect(detail.body.uploaderName).toBeDefined();
    expect(detail.body.uploaderId).not.toBeNull();
    expect(detail.body.uploaderName).not.toBeNull();
  });

  it('업로드한 유저의 displayName이 uploaderName에 반영된다', async () => {
    const { user } = await authService.signUpLocal({
      email: `displayname-${Date.now()}@test.com`,
      password: 'Secure@99',
      displayName: '실제닉네임테스터',
    });
    const sessionId = await authService.createSession(user.id);

    const created = await request(app.getHttpServer())
      .post('/videos')
      .set('Cookie', [`keepit-session=${sessionId}`])
      .set('x-user-id', user.id)
      .send({ title: '닉네임확인', url: 'https://stream.test/displayname', durationSeconds: 90 });
    expect(created.status).toBe(201);

    const detail = await request(app.getHttpServer()).get(`/videos/${created.body.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.uploaderId).toBe(user.id);
    expect(detail.body.uploaderName).toBe('실제닉네임테스터');
  });

  it('비디오 댓글에 authorName, authorAvatar 필드 존재', async () => {
    const { user } = await authService.signUpLocal({
      email: `videocomment-${Date.now()}@test.com`,
      password: 'Secure@99',
      displayName: '댓글닉네임',
    });
    const sessionId = await authService.createSession(user.id);

    const created = await request(app.getHttpServer())
      .post('/videos')
      .send({ title: '댓글테스트', url: 'https://stream.test/comment-check', durationSeconds: 120 });

    await request(app.getHttpServer())
      .post(`/videos/${created.body.id}/comments`)
      .set('Cookie', [`keepit-session=${sessionId}`])
      .set('x-user-id', user.id)
      .send({ content: '댓글 내용', authorVisibility: 'nickname' });

    const comments = await request(app.getHttpServer()).get(`/videos/${created.body.id}/comments`);
    expect(comments.status).toBe(200);
    expect(comments.body.length).toBeGreaterThan(0);
    expect(comments.body[0].authorName).toBeDefined();
    expect(comments.body[0].authorAvatar).toBeDefined();
  });

  it('POST /videos/:id/like → 200, liked: true, likeCount 증가', async () => {
    const created = await request(app.getHttpServer()).post('/videos').send({
      title: 'like test video',
      url: 'https://stream.test/like-test',
      durationSeconds: 100,
    });
    expect(created.status).toBe(201);

    const liked = await request(app.getHttpServer())
      .post(`/videos/${created.body.id}/like`)
      .set('x-user-id', 'like-user-1');

    expect(liked.status).toBe(200);
    expect(liked.body.liked).toBe(true);
    expect(liked.body.likeCount).toBe(1);
  });

  it('POST /videos/:id/like 두 번 → liked: false (토글)', async () => {
    const created = await request(app.getHttpServer()).post('/videos').send({
      title: 'like toggle video',
      url: 'https://stream.test/like-toggle',
      durationSeconds: 100,
    });

    await request(app.getHttpServer())
      .post(`/videos/${created.body.id}/like`)
      .set('x-user-id', 'toggle-user-1');

    const unliked = await request(app.getHttpServer())
      .post(`/videos/${created.body.id}/like`)
      .set('x-user-id', 'toggle-user-1');

    expect(unliked.status).toBe(200);
    expect(unliked.body.liked).toBe(false);
    expect(unliked.body.likeCount).toBe(0);
  });

  it('POST /videos/:id/view → 200, viewCount 존재', async () => {
    const created = await request(app.getHttpServer()).post('/videos').send({
      title: 'view test video',
      url: 'https://stream.test/view-test',
      durationSeconds: 100,
    });

    const viewed = await request(app.getHttpServer())
      .post(`/videos/${created.body.id}/view`)
      .set('x-user-id', 'view-user-1');

    expect(viewed.status).toBe(200);
    expect(viewed.body.viewCount).toBeDefined();
  });
});
