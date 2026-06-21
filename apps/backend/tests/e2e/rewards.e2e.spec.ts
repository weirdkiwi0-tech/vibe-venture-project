import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Rewards API (e2e)', () => {
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

  it('POST /rewards/earn -> 201', async () => {
    const res = await request(app.getHttpServer()).post('/rewards/earn').send({
      userId: 'u-reward',
      reason: 'contribution',
      points: 40,
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('GET /rewards/users/:userId/history -> 200 with total points', async () => {
    await request(app.getHttpServer()).post('/rewards/earn').send({
      userId: 'u-history',
      reason: 'activity-1',
      points: 10,
    });
    await request(app.getHttpServer()).post('/rewards/earn').send({
      userId: 'u-history',
      reason: 'activity-2',
      points: 15,
    });

    const res = await request(app.getHttpServer()).get(
      '/rewards/users/u-history/history',
    );

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('u-history');
    expect(res.body.totalPoints).toBe(25);
    expect(Array.isArray(res.body.entries)).toBe(true);
  });
});
