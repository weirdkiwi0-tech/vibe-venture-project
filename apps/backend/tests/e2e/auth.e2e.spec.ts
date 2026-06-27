import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
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

  // ── 회원가입 유효성 검사 ─────────────────────────────────────────────
  describe('POST /auth/signup 유효성 검사', () => {
    it('잘못된 이메일 형식(1@1)으로 가입 시 400을 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: '1@1', password: 'Secure@99', displayName: '테스터' });
      expect(res.status).toBe(400);
    });

    it('비밀번호가 7자이고 특수문자 없으면 400을 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'valid@test.com', password: 'abc123!', displayName: '테스터' });
      expect(res.status).toBe(400);
    });

    it('비밀번호가 8자 이상이지만 특수문자 없으면 400을 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'valid@test.com', password: 'password99', displayName: '테스터' });
      expect(res.status).toBe(400);
    });

    it('닉네임이 1자이면 400을 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'valid@test.com', password: 'Secure@99', displayName: 'A' });
      expect(res.status).toBe(400);
    });

    it('닉네임이 17자이면 400을 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'valid@test.com', password: 'Secure@99', displayName: '12345678901234567' });
      expect(res.status).toBe(400);
    });

    it('모든 조건을 충족하면 201을 반환한다', async () => {
      const uniqueEmail = `valid-${randomUUID()}@test.com`;
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: uniqueEmail, password: 'Secure@99', displayName: '테스터' });
      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
    });

    it('이미 가입된 이메일로 재가입 시도 시 409 또는 400을 반환한다', async () => {
      const uniqueEmail = `dup-${randomUUID()}@test.com`;
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: uniqueEmail, password: 'Secure@99', displayName: '첫번째' });

      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: uniqueEmail, password: 'Secure@99', displayName: '두번째' });
      expect([400, 409]).toContain(res.status);
    });
  });

  // ── 기존 테스트 ───────────────────────────────────────────────────────
  it('GET /auth/me -> unauthenticated when session cookie is missing', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.isAuthenticated).toBe(false);
  });

  it('GET /auth/me -> authenticated with valid session cookie', async () => {
    process.env.GOOGLE_ADMIN_EMAILS = 'admin@example.com';
    const login = await authService.signInWithGoogle({
      googleId: 'google-e2e-1',
      email: 'admin@example.com',
      displayName: 'E2E Admin',
    });
    const sessionId = await authService.createSession(login.user.id);

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

  describe('POST /auth/signin 로그인 실패', () => {
    it('틀린 비밀번호 로그인 → 401', async () => {
      const uniqueEmail = `wrongpw-e2e-${randomUUID()}@test.com`;
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: uniqueEmail, password: 'Secure@99', displayName: '비밀번호테스터' });

      const res = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email: uniqueEmail, password: 'WrongPassword@99' });

      expect(res.status).toBe(401);
    });

    it('존재하지 않는 이메일 로그인 → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email: `notexist-${randomUUID()}@test.com`, password: 'Secure@99' });

      expect(res.status).toBe(401);
    });
  });
});
