import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Home API (e2e)', () => {
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

  it('GET /home -> 200 with feed and metadata', async () => {
    await request(app.getHttpServer()).post('/videos').send({
      title: 'home video',
      url: 'https://stream.test/home-video',
      durationSeconds: 180,
    });

    await request(app.getHttpServer()).post('/questions').send({
      title: 'home question',
      body: 'How does this work?',
      subject: 'MATH',
      grade: '1',
    });

    const res = await request(app.getHttpServer()).get('/home');

    expect(res.status).toBe(200);
    expect(res.body.feed).toBeDefined();
    expect(Array.isArray(res.body.feed.videos)).toBe(true);
    expect(Array.isArray(res.body.feed.questions)).toBe(true);
    expect(res.body.metadata.videoCount).toBeGreaterThanOrEqual(1);
    expect(res.body.metadata.questionCount).toBeGreaterThanOrEqual(1);
    expect(res.body.metadata.generatedAt).toBeDefined();
  });
});