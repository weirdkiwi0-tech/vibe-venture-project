import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Dev seeded admin/operator signin (e2e)', () => {
  let app: INestApplication;
  const originalAdminEmails = process.env.GOOGLE_ADMIN_EMAILS;

  beforeAll(async () => {
    process.env.GOOGLE_ADMIN_EMAILS = 'admin@keepit.dev,operator@keepit.dev';

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
  });

  afterAll(async () => {
    process.env.GOOGLE_ADMIN_EMAILS = originalAdminEmails;
    await app.close();
  });

  it('POST /auth/signin admin 계정 로그인은 200과 role=admin을 반환해야 한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email: 'admin@keepit.dev', password: 'admin1234' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  it('POST /auth/signin operator 계정 로그인은 200과 role=admin을 반환해야 한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email: 'operator@keepit.dev', password: 'Operator#2026' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });
});
