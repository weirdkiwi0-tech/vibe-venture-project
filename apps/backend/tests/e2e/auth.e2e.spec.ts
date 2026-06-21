import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth';

describe('Auth API (e2e)', () => {
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

  it('GET /auth/me -> unauthenticated when session cookie is missing', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.isAuthenticated).toBe(false);
  });

  it('GET /auth/me -> authenticated with valid session cookie', async () => {
    process.env.GOOGLE_ADMIN_EMAILS = 'admin@example.com';
    const login = authService.signInWithGoogle({
      googleId: 'google-e2e-1',
      email: 'admin@example.com',
      displayName: 'E2E Admin',
    });
    const sessionId = authService.createSession(login.user.id);

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', [`keepit-session=${sessionId}`]);

    expect(res.status).toBe(200);
    expect(res.body.isAuthenticated).toBe(true);
    expect(res.body.user.email).toBe('admin@example.com');
    expect(res.body.user.role).toBe('admin');
  });

  it('GET /auth/logout -> clears cookies and redirects to callback page', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/logout')
      .set('Cookie', ['keepit-session=fake-session', 'keepit-role=admin']);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/auth/callback');

    const rawSetCookie = res.headers['set-cookie'];
    const setCookie = Array.isArray(rawSetCookie) ? rawSetCookie : [];
    expect(setCookie.some((cookie) => cookie.startsWith('keepit-session='))).toBe(true);
    expect(setCookie.some((cookie) => cookie.startsWith('keepit-role='))).toBe(true);
  });
});
