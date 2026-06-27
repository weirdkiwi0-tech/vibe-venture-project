import { InMemoryAnswerRepository } from '../../src/questions/in-memory-answer.repository';
import { InMemoryQuestionLikeRepository } from '../../src/questions/in-memory-question-like.repository';
import { InMemoryQuestionRepository } from '../../src/questions/in-memory-question.repository';
import { QuestionsService } from '../../src/questions/questions.service';
import { AnswerEntity } from '../../src/questions/entities/answer.entity';
import { ReportsService } from '../../src/reports/reports.service';
import { InMemoryReportRepository } from '../../src/reports/in-memory-report.repository';
import { InMemoryAdminAuditLogRepository } from '../../src/reports/in-memory-admin-audit-log.repository';
import { seedTopPolicyQuestions } from '../support/top-policy-fixture';

describe('QuestionsService + Repository (integration)', () => {
  it('creates then fetches question', async () => {
    const repo = new InMemoryQuestionRepository();
    const answerRepo = new InMemoryAnswerRepository();
    const questionLikeRepo = new InMemoryQuestionLikeRepository();
    const service = new QuestionsService(repo, answerRepo, questionLikeRepo);

    const created = await service.create({
      title: 'integration title',
      body: 'integration body',
      subject: 'MATH',
      grade: '3',
    });

    const found = await service.findById(created.id);

    expect(found.question.id).toBe(created.id);
    expect(found.question.grade).toBe('3');
    expect(found.answerCount).toBe(0);
  });

  it('solves question and persists solved state', async () => {
    const repo = new InMemoryQuestionRepository();
    const answerRepo = new InMemoryAnswerRepository();
    const questionLikeRepo = new InMemoryQuestionLikeRepository();
    const service = new QuestionsService(repo, answerRepo, questionLikeRepo);

    const created = await service.create({
      title: 'integration solve',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    });

    await service.solve(created.id);
    const found = await service.findById(created.id);

    expect(found.question.status).toBe('solved');
  });

  it('lists questions with solved status and answerCount', async () => {
    const repo = new InMemoryQuestionRepository();
    const answerRepo = new InMemoryAnswerRepository();
    const questionLikeRepo = new InMemoryQuestionLikeRepository();
    const service = new QuestionsService(repo, answerRepo, questionLikeRepo);

    const created = await service.create({
      title: 'list target',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    });

    await answerRepo.save(
      AnswerEntity.create({
        id: 'a-list-1',
        questionId: created.id,
        authorId: 'u-1',
        type: 'text',
        content: 'answer',
      }),
    );

    await service.solve(created.id);

    const list = await service.listTopQuestions();
    const found = list.find((item) => item.question.id === created.id);

    expect(found).toBeDefined();
    expect(found?.question.status).toBe('solved');
    expect(found?.answerCount).toBe(1);
  });

  it('filters questions by subject and grade', async () => {
    const repo = new InMemoryQuestionRepository();
    const answerRepo = new InMemoryAnswerRepository();
    const questionLikeRepo = new InMemoryQuestionLikeRepository();
    const service = new QuestionsService(repo, answerRepo, questionLikeRepo);

    await service.create({
      title: 'math',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });
    await service.create({
      title: 'science',
      body: 'body',
      subject: 'SCIENCE',
      grade: '2',
    });

    const filtered = await service.listTopQuestions(10, {
      subject: 'MATH',
      grade: '2',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].question.subject).toBe('MATH');
  });

  it('returns 7 popular plus 3 help-needed questions for top list policy', async () => {
    const repo = new InMemoryQuestionRepository();
    const answerRepo = new InMemoryAnswerRepository();
    const questionLikeRepo = new InMemoryQuestionLikeRepository();
    const service = new QuestionsService(repo, answerRepo, questionLikeRepo);

    await seedTopPolicyQuestions(service, 'integration-policy', '2');

    const top = await service.listTopQuestions();

    expect(top).toHaveLength(10);
    expect(top.slice(0, 7).map((item) => item.question.title)).toEqual([
      'integration-policy-0',
      'integration-policy-1',
      'integration-policy-2',
      'integration-policy-3',
      'integration-policy-4',
      'integration-policy-5',
      'integration-policy-6',
    ]);
    expect(top.slice(7).map((item) => item.question.title).sort()).toEqual([
      'integration-policy-10',
      'integration-policy-11',
      'integration-policy-12',
    ]);
  });

  it('toggles likeCount when same user likes same question repeatedly', async () => {
    const repo = new InMemoryQuestionRepository();
    const answerRepo = new InMemoryAnswerRepository();
    const questionLikeRepo = new InMemoryQuestionLikeRepository();
    const service = new QuestionsService(repo, answerRepo, questionLikeRepo);

    const created = await service.create({
      title: 'like dedupe target',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });

    await service.like(created.id, 'user-1');
    await service.like(created.id, 'user-1');
    const likedBySecond = await service.like(created.id, 'user-2');
    const likedAgainByFirst = await service.like(created.id, 'user-1');

    expect(likedBySecond.question.likeCount).toBe(1);
    expect(likedAgainByFirst.question.likeCount).toBe(2);
  });

  it('allows admin to open question detail even when admin reported that question', async () => {
    const repo = new InMemoryQuestionRepository();
    const answerRepo = new InMemoryAnswerRepository();
    const questionLikeRepo = new InMemoryQuestionLikeRepository();
    const reportsService = new ReportsService(
      new InMemoryReportRepository(),
      new InMemoryAdminAuditLogRepository(),
    );
    const authService = {
      getUserById: jest.fn((userId: string) => {
        if (userId === 'admin-1') {
          return { id: 'admin-1', role: 'admin' };
        }
        return { id: userId, role: 'user' };
      }),
    };
    const service = new QuestionsService(repo, answerRepo, questionLikeRepo, authService as never, reportsService);

    const created = await service.create({
      title: 'reported question',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    }, 'author-1');

    await reportsService.create({
      targetType: 'question',
      targetId: created.id,
      reason: 'spam',
    }, 'admin-1');

    const found = await service.findById(created.id, 'admin-1');

    expect(found.question.id).toBe(created.id);
    expect(authService.getUserById).toHaveBeenCalledWith('admin-1');
  });
});
