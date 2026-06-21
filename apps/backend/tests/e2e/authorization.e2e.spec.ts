import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth';

describe('Authorization API (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;
  const originalAdminEmails = process.env.GOOGLE_ADMIN_EMAILS;

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

  afterEach(() => {
    process.env.GOOGLE_ADMIN_EMAILS = originalAdminEmails;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /admin/overview -> 403 when session role is user even if header says admin', async () => {
    process.env.GOOGLE_ADMIN_EMAILS = '';

    const login = authService.signInWithGoogle({
      googleId: 'g-authz-user',
      email: 'user-authz@example.com',
      displayName: 'User Authz',
    });
    const sessionId = authService.createSession(login.user.id);

    const res = await request(app.getHttpServer())
      .get('/admin/overview')
      .set('Cookie', [`keepit-session=${sessionId}`])
      .set('x-user-role', 'admin');

    expect(res.status).toBe(403);
  });

  it('GET /admin/overview -> 200 when session role is admin even if header says user', async () => {
    process.env.GOOGLE_ADMIN_EMAILS = 'admin-authz@example.com';

    const login = authService.signInWithGoogle({
      googleId: 'g-authz-admin',
      email: 'admin-authz@example.com',
      displayName: 'Admin Authz',
    });
    const sessionId = authService.createSession(login.user.id);

    const res = await request(app.getHttpServer())
      .get('/admin/overview')
      .set('Cookie', [`keepit-session=${sessionId}`])
      .set('x-user-role', 'user');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cards)).toBe(true);
  });
});
