import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Videos API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
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
});
