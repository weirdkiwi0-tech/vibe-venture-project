import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { rm } from 'fs/promises';
import { resolve } from 'path';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Home API (e2e)', () => {
  let app: INestApplication;
  const originalDbPath = process.env.DB_PATH;
  let testDbPath = '';

  beforeAll(async () => {
    testDbPath = resolve(process.cwd(), `data/test-home-e2e-${randomUUID()}.sqlite`);
    process.env.DB_PATH = testDbPath;

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
    process.env.DB_PATH = originalDbPath;
    await Promise.all([
      rm(testDbPath, { force: true }).catch(() => undefined),
      rm(`${testDbPath}-wal`, { force: true }).catch(() => undefined),
      rm(`${testDbPath}-shm`, { force: true }).catch(() => undefined),
    ]);
  });

  it('GET /home -> 200 with feed and metadata', async () => {
    await request(app.getHttpServer()).post('/videos').send({
      title: 'home video',
      url: 'https://stream.test/home-video',
      durationSeconds: 180,
    });

    const res = await request(app.getHttpServer()).get('/home');

    expect(res.status).toBe(200);
    expect(res.body.feed).toBeDefined();
    expect(Array.isArray(res.body.feed.videos)).toBe(true);
    expect(Array.isArray(res.body.feed.questions)).toBe(true);
    expect(res.body.metadata.videoCount).toBeGreaterThanOrEqual(1);
    expect(res.body.metadata.questionCount).toBeGreaterThanOrEqual(0);
    expect(res.body.metadata.generatedAt).toBeDefined();
  });

  it('GET /home returns top questions with strict policy order and no duplicates', async () => {
    const ids: string[] = [];

    for (let i = 0; i < 12; i += 1) {
      const created = await request(app.getHttpServer()).post('/questions').send({
        title: `home-policy-e2e-${i}`,
        body: 'policy body',
        subject: 'MATH',
        grade: '2',
      });
      expect(created.status).toBe(201);
      ids.push(String(created.body.id));
    }

    for (let i = 0; i < 7; i += 1) {
      for (let v = 0; v < 20 - i; v += 1) {
        await request(app.getHttpServer()).get(`/questions/${ids[i]}`);
      }
    }

    await request(app.getHttpServer()).patch(`/questions/${ids[7]}/solve`);

    for (let v = 0; v < 1; v += 1) {
      await request(app.getHttpServer()).get(`/questions/${ids[8]}`);
    }
    for (let v = 0; v < 2; v += 1) {
      await request(app.getHttpServer()).get(`/questions/${ids[9]}`);
    }
    for (let v = 0; v < 3; v += 1) {
      await request(app.getHttpServer()).get(`/questions/${ids[10]}`);
    }
    for (let v = 0; v < 4; v += 1) {
      await request(app.getHttpServer()).get(`/questions/${ids[11]}`);
    }

    const res = await request(app.getHttpServer()).get('/home');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.feed?.questions)).toBe(true);

    const policyItems = (res.body.feed.questions as Array<{ id: string; title: string }>).filter((item) =>
      item.title.startsWith('home-policy-e2e-'),
    );

    expect(policyItems).toHaveLength(10);

    const topIds = policyItems.map((item) => item.id);
    expect(new Set(topIds).size).toBe(10);
    expect(topIds.slice(0, 7)).toEqual(ids.slice(0, 7));
    expect(topIds.slice(7)).toEqual([ids[8], ids[9], ids[10]]);
  });
});