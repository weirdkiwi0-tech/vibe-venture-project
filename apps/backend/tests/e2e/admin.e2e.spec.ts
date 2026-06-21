import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth';

describe('Admin API (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;

  function createAdminSession() {
    process.env.GOOGLE_ADMIN_EMAILS = 'admin-e2e@example.com';
    const login = authService.signInWithGoogle({
      googleId: `admin-e2e-${Date.now()}`,
      email: 'admin-e2e@example.com',
      displayName: 'Admin E2E',
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

  it('GET /admin/overview -> 403 without admin role', async () => {
    const res = await request(app.getHttpServer()).get('/admin/overview');
    expect(res.status).toBe(403);
  });

  it('GET /admin/overview -> 200 with admin role', async () => {
    const adminSession = createAdminSession();

    await request(app.getHttpServer()).post('/reports').send({
      targetType: 'question',
      targetId: 'q-admin',
      reason: 'spam',
    });

    const res = await request(app.getHttpServer())
      .get('/admin/overview')
      .set('Cookie', [`keepit-session=${adminSession}`]);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(Array.isArray(res.body.reportBuckets)).toBe(true);
    expect(Array.isArray(res.body.urgentReports)).toBe(true);
  });
});