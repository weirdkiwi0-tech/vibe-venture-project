import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createAuthenticatedAgent, sessionCookie } from '../support/e2e-helpers';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth';
import { createAdminSession } from '../support/e2e-helpers';

describe('Reports API (e2e)', () => {
  let app: INestApplication;
  let member: Awaited<ReturnType<typeof createAuthenticatedAgent>>;
  let authService: AuthService;

  async function createQuestionTarget() {
    const questionRes = await member.post('/questions').send({
      title: `report-target-question-${Date.now()}`,
      body: 'report target body',
      subject: 'MATH',
      grade: '2',
    });

    expect(questionRes.status).toBe(201);
    return questionRes.body.id as string;
  }

  async function createAnswerTarget() {
    const questionId = await createQuestionTarget();
    const answerRes = await member
      .post(`/questions/${questionId}/answers`)
      .set('Cookie', await sessionCookie(app, `answer-author-${Date.now()}`))
      .send({
        type: 'text',
        content: 'report target answer',
      });

    expect(answerRes.status).toBe(201);
    return answerRes.body.id as string;
  }

  /**
   * Create admin session with reports-specific email
   * Wraps common createAdminSession helper
   */
  async function createReportsAdminSession() {
    return createAdminSession(authService, {
      email: 'reports-admin@example.com',
      googleId: `reports-admin-${Date.now()}`,
      displayName: 'Reports Admin',
    });
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
    member = await createAuthenticatedAgent(app);

    authService = moduleRef.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /reports -> 201', async () => {
    const questionId = await createQuestionTarget();

    const res = await member.post('/reports').send({
      targetType: 'question',
      targetId: questionId,
      reason: 'spam',
      severity: 'normal',
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('pending');
  });

  it('POST /reports -> 400 when targetId missing', async () => {
    const res = await member.post('/reports').send({
      targetType: 'question',
      reason: 'spam',
    });

    expect(res.status).toBe(400);
  });

  it('GET /reports -> 200', async () => {
    const adminSession = await createReportsAdminSession();
    const answerId = await createAnswerTarget();

    await member.post('/reports').send({
      targetType: 'answer',
      targetId: answerId,
      reason: 'abuse',
    });

    const res = await member.get('/reports').set('Cookie', `keepit-session=${adminSession}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /reports/:id/approve -> 200 and GET /reports/audit-logs -> 200', async () => {
    const adminSession = await createReportsAdminSession();
    const answerId = await createAnswerTarget();

    const created = await member.post('/reports').send({
      targetType: 'answer',
      targetId: answerId,
      reason: 'spam',
    });

    const approved = await member
      .post(`/reports/${created.body.id}/approve`)
      .set('Cookie', [`keepit-session=${adminSession}`])
      .set('x-user-id', 'admin-1')
      .send({ reason: 'confirmed' });

    expect(approved.status).toBe(201);
    expect(approved.body.status).toBe('resolved');

    const logs = await member
      .get('/reports/audit-logs')
      .set('Cookie', [`keepit-session=${adminSession}`]);
    expect(logs.status).toBe(200);
    expect(Array.isArray(logs.body)).toBe(true);
    expect(logs.body.length).toBeGreaterThan(0);
  });

  it('GET /reports/queue -> 200', async () => {
    const adminSession = await createReportsAdminSession();
    const questionId = await createQuestionTarget();

    await member.post('/reports').send({
      targetType: 'question',
      targetId: questionId,
      reason: 'queue item',
      severity: 'high',
    });

    const res = await member
      .get('/reports/queue')
      .set('Cookie', [`keepit-session=${adminSession}`]);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /reports/queue -> 403 without admin role', async () => {
    const res = await member.get('/reports/queue');

    expect(res.status).toBe(403);
  });

  it('accepts community-post/comment reports and includes them in admin overview buckets', async () => {
    const adminSession = await createReportsAdminSession();

    const communityReport = await member.post('/reports').send({
      targetType: 'community-post',
      targetId: 'community-post-e2e-1',
      reason: 'community spam',
      severity: 'high',
    });

    const commentReport = await member.post('/reports').send({
      targetType: 'comment',
      targetId: 'comment-e2e-1',
      reason: 'comment abuse',
      severity: 'normal',
    });

    expect(communityReport.status).toBe(201);
    expect(communityReport.body.targetType).toBe('community-post');
    expect(commentReport.status).toBe(201);
    expect(commentReport.body.targetType).toBe('comment');

    const overview = await member
      .get('/admin/overview')
      .set('Cookie', [`keepit-session=${adminSession}`]);

    expect(overview.status).toBe(200);
    expect(overview.body.reportBuckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetType: 'community-post',
          targetId: 'community-post-e2e-1',
        }),
        expect.objectContaining({
          targetType: 'comment',
          targetId: 'comment-e2e-1',
        }),
      ]),
    );
  });

  it('fixes queue contract: pending/reviewing only, high before normal, oldest first, terminal states excluded', async () => {
    const adminSession = await createReportsAdminSession();
    const testTag = `queue-contract-${Date.now()}`;

    const highOlderTarget = await createQuestionTarget();
    const highNewerTarget = await createQuestionTarget();
    const normalOlderTarget = await createQuestionTarget();
    const resolvedTarget = await createQuestionTarget();
    const rejectedTarget = await createQuestionTarget();
    const restoredTarget = await createQuestionTarget();

    const highOlder = await member.post('/reports').send({
      targetType: 'question',
      targetId: highOlderTarget,
      reason: `${testTag}-high-older`,
      severity: 'high',
    });
    const normalOlder = await member.post('/reports').send({
      targetType: 'question',
      targetId: normalOlderTarget,
      reason: `${testTag}-normal-older`,
      severity: 'normal',
    });
    const highNewer = await member.post('/reports').send({
      targetType: 'question',
      targetId: highNewerTarget,
      reason: `${testTag}-high-newer`,
      severity: 'high',
    });
    const resolved = await member.post('/reports').send({
      targetType: 'question',
      targetId: resolvedTarget,
      reason: `${testTag}-resolved`,
      severity: 'high',
    });
    const rejected = await member.post('/reports').send({
      targetType: 'question',
      targetId: rejectedTarget,
      reason: `${testTag}-rejected`,
      severity: 'high',
    });
    const restored = await member.post('/reports').send({
      targetType: 'question',
      targetId: restoredTarget,
      reason: `${testTag}-restored`,
      severity: 'high',
    });

    expect(highOlder.status).toBe(201);
    expect(highNewer.status).toBe(201);
    expect(normalOlder.status).toBe(201);
    expect(resolved.status).toBe(201);
    expect(rejected.status).toBe(201);
    expect(restored.status).toBe(201);

    const resolvedResult = await member
      .post(`/reports/${resolved.body.id}/approve`)
      .set('Cookie', [`keepit-session=${adminSession}`])
      .send({ reason: `${testTag}-approve` });
    const rejectedResult = await member
      .post(`/reports/${rejected.body.id}/reject`)
      .set('Cookie', [`keepit-session=${adminSession}`])
      .send({ reason: `${testTag}-reject` });
    const restoredResult = await member
      .post(`/reports/${restored.body.id}/restore`)
      .set('Cookie', [`keepit-session=${adminSession}`])
      .send({ reason: `${testTag}-restore` });

    expect(resolvedResult.status).toBe(201);
    expect(rejectedResult.status).toBe(201);
    expect(restoredResult.status).toBe(201);

    const queueRes = await member
      .get('/reports/queue?status=resolved,rejected,restored,pending,reviewing')
      .set('Cookie', [`keepit-session=${adminSession}`]);

    expect(queueRes.status).toBe(200);

    const contractQueue = queueRes.body.filter((report: { reason: string }) => report.reason.startsWith(testTag));

    expect(contractQueue.map((report: { id: string }) => report.id)).toEqual([
      highOlder.body.id,
      highNewer.body.id,
      normalOlder.body.id,
    ]);
  });

  it('POST /reports/:id/reject → 201, status: rejected', async () => {
    const adminSession = await createReportsAdminSession();
    const questionId = await createQuestionTarget();

    const created = await member.post('/reports').send({
      targetType: 'question',
      targetId: questionId,
      reason: 'standalone reject test',
    });
    expect(created.status).toBe(201);

    const rejected = await member
      .post(`/reports/${created.body.id}/reject`)
      .set('Cookie', [`keepit-session=${adminSession}`])
      .send({ reason: '신고 거절 사유' });

    expect(rejected.status).toBe(201);
    expect(rejected.body.status).toBe('rejected');
  });

  it('POST /reports/:id/restore → 201, status: restored', async () => {
    const adminSession = await createReportsAdminSession();
    const questionId = await createQuestionTarget();

    const created = await member.post('/reports').send({
      targetType: 'question',
      targetId: questionId,
      reason: 'standalone restore test',
    });
    expect(created.status).toBe(201);

    const restored = await member
      .post(`/reports/${created.body.id}/restore`)
      .set('Cookie', [`keepit-session=${adminSession}`])
      .send({ reason: '복원 사유' });

    expect(restored.status).toBe(201);
    expect(restored.body.status).toBe('restored');
  });

  it('reject 후 approve 전환 → status: resolved', async () => {
    const adminSession = await createReportsAdminSession();
    const questionId = await createQuestionTarget();

    const created = await member.post('/reports').send({
      targetType: 'question',
      targetId: questionId,
      reason: 'reject then approve test',
    });
    expect(created.status).toBe(201);

    await member
      .post(`/reports/${created.body.id}/reject`)
      .set('Cookie', [`keepit-session=${adminSession}`])
      .send({ reason: '일단 거절' });

    const approved = await member
      .post(`/reports/${created.body.id}/approve`)
      .set('Cookie', [`keepit-session=${adminSession}`])
      .send({ reason: '재검토 후 승인' });

    expect(approved.status).toBe(201);
    expect(approved.body.status).toBe('resolved');
  });
});
