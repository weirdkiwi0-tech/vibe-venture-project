import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth';
import {
  createAdminSession,
  createNormalUserSession,
} from '../support/e2e-helpers';
import { TEST_PASSWORD } from '../support/test-constants';

describe('Admin API (e2e)', () => {
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

  it('GET /admin/overview -> 403 without admin role', async () => {
    const res = await request(app.getHttpServer()).get('/admin/overview');
    expect(res.status).toBe(403);
  });

  it('GET /admin/overview -> 200 with admin role', async () => {
    const adminSession = await createAdminSession(authService);

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

  it('GET /admin/users → 어드민 세션으로 유저 목록 조회 → 200, 배열 반환', async () => {
    const adminSession = await createAdminSession(authService);

    const res = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Cookie', [`keepit-session=${adminSession}`]);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /admin/users → 일반 유저 세션 → 403', async () => {
    const { sessionId } = await createNormalUserSession(authService);

    const res = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Cookie', [`keepit-session=${sessionId}`]);

    expect(res.status).toBe(403);
  });

  it('PATCH /admin/users/:id/role → admin 세션으로 role 변경 → { success: true }', async () => {
    const adminSession = await createAdminSession(authService);
    const { userId } = await createNormalUserSession(authService);

    const res = await request(app.getHttpServer())
      .patch(`/admin/users/${userId}/role`)
      .set('Cookie', [`keepit-session=${adminSession}`])
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('PATCH /admin/users/:id/ban → 밴 후 login 401, PATCH /admin/users/:id/unban → 언밴 후 login 200', async () => {
    const adminSession = await createAdminSession(authService);
    const { userId, email } = await createNormalUserSession(authService);

    // 밴 적용
    const banRes = await request(app.getHttpServer())
      .patch(`/admin/users/${userId}/ban`)
      .set('Cookie', [`keepit-session=${adminSession}`])
      .send({ banUntil: new Date(Date.now() + 3600 * 1000).toISOString() });
    expect(banRes.status).toBe(200);

    // 밴 상태 로그인 시도 → 401
    const loginAfterBan = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password: TEST_PASSWORD });
    expect(loginAfterBan.status).toBe(401);

    // 언밴 적용
    await request(app.getHttpServer())
      .patch(`/admin/users/${userId}/unban`)
      .set('Cookie', [`keepit-session=${adminSession}`]);

    // 언밴 후 로그인 → 200
    const loginAfterUnban = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password: TEST_PASSWORD });
    expect(loginAfterUnban.status).toBe(200);
  });

  it('DELETE /admin/users/:id → 삭제 후 login 401', async () => {
    const adminSession = await createAdminSession(authService);
    const { userId, email } = await createNormalUserSession(authService);

    const delRes = await request(app.getHttpServer())
      .delete(`/admin/users/${userId}`)
      .set('Cookie', [`keepit-session=${adminSession}`]);
    expect(delRes.status).toBe(200);

    const loginAfterDelete = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password: TEST_PASSWORD });
    expect(loginAfterDelete.status).toBe(401);
  });

  it('DELETE /admin/users/:id → 삭제 후 GET /admin/users 목록에서 사라짐', async () => {
    const adminSession = await createAdminSession(authService);
    const { sessionId: userSession, userId } = await createNormalUserSession(authService);
    void userSession;

    const delRes = await request(app.getHttpServer())
      .delete(`/admin/users/${userId}`)
      .set('Cookie', [`keepit-session=${adminSession}`]);
    expect(delRes.status).toBe(200);

    const listRes = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Cookie', [`keepit-session=${adminSession}`]);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.some((u: { id: string }) => u.id === userId)).toBe(false);
  });
});