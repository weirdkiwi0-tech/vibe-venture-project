import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
  const expectCreateBadRequest = async (
    service: QuestionsService,
    input: { title: string; body: string; subject: string; grade: string },
    expectedMessage: string,
  ) => {
    try {
      await service.create(input);
      throw new Error('expected create to throw BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as Error).message).toBe(expectedMessage);
    }
  };

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

  it.each([
    ['title', { title: '   ', body: 'integration body', subject: 'MATH', grade: '3' }, 'title is required'],
    ['body', { title: 'integration title', body: '   ', subject: 'MATH', grade: '3' }, 'body is required'],
    ['subject', { title: 'integration title', body: 'integration body', subject: '   ', grade: '3' }, 'subject is required'],
    ['grade', { title: 'integration title', body: 'integration body', subject: 'MATH', grade: '   ' }, 'grade is required'],
  ])('rejects blank %s with consistent validation message', async (_field, input, expectedMessage) => {
    const repo = new InMemoryQuestionRepository();
    const answerRepo = new InMemoryAnswerRepository();
    const questionLikeRepo = new InMemoryQuestionLikeRepository();
    const service = new QuestionsService(repo, answerRepo, questionLikeRepo);

    await expectCreateBadRequest(service, input, expectedMessage);
  });

  it('keeps visibility consistently across create and query flow', async () => {
    const repo = new InMemoryQuestionRepository();
    const answerRepo = new InMemoryAnswerRepository();
    const questionLikeRepo = new InMemoryQuestionLikeRepository();
    const service = new QuestionsService(repo, answerRepo, questionLikeRepo);

    const defaultVisibility = await service.create({
      title: 'integration visibility default',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });

    const nicknameVisibility = await service.create({
      title: 'integration visibility nickname',
      body: 'body',
      subject: 'MATH',
      grade: '2',
      visibility: 'nickname',
    });

    const defaultDetail = await service.findById(defaultVisibility.id);
    const nicknameDetail = await service.findById(nicknameVisibility.id);
    const listed = await service.listTopQuestions(10, { subject: 'MATH', grade: '2' });

    const listedDefault = listed.find((item) => item.question.id === defaultVisibility.id);
    const listedNickname = listed.find((item) => item.question.id === nicknameVisibility.id);

    expect(defaultDetail.question.visibility).toBe('anonymous');
    expect(nicknameDetail.question.visibility).toBe('nickname');
    expect(listedDefault?.question.visibility).toBe('anonymous');
    expect(listedNickname?.question.visibility).toBe('nickname');
  });

  it('keeps visibility in listAllQuestions and listByAuthorId', async () => {
    const repo = new InMemoryQuestionRepository();
    const answerRepo = new InMemoryAnswerRepository();
    const questionLikeRepo = new InMemoryQuestionLikeRepository();
    const service = new QuestionsService(repo, answerRepo, questionLikeRepo);

    const authorId = 'integration-visibility-author';
    const anonymousQuestion = await service.create({
      title: 'integration listAll anonymous',
      body: 'body',
      subject: 'MATH',
      grade: '2',
      visibility: 'anonymous',
    }, authorId);
    const nicknameQuestion = await service.create({
      title: 'integration listAll nickname',
      body: 'body',
      subject: 'MATH',
      grade: '2',
      visibility: 'nickname',
    }, authorId);

    const all = await service.listAllQuestions({
      subject: 'MATH',
      grade: '2',
    });
    const mine = await service.listByAuthorId(authorId);

    const anonymousInAll = all.find((item) => item.question.id === anonymousQuestion.id);
    const nicknameInAll = all.find((item) => item.question.id === nicknameQuestion.id);
    const anonymousInMine = mine.find((item) => item.question.id === anonymousQuestion.id);
    const nicknameInMine = mine.find((item) => item.question.id === nicknameQuestion.id);

    expect(anonymousInAll?.question.visibility).toBe('anonymous');
    expect(nicknameInAll?.question.visibility).toBe('nickname');
    expect(anonymousInMine?.question.visibility).toBe('anonymous');
    expect(nicknameInMine?.question.visibility).toBe('nickname');
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

  it('rejects solve when requester is not author', async () => {
    const repo = new InMemoryQuestionRepository();
    const answerRepo = new InMemoryAnswerRepository();
    const questionLikeRepo = new InMemoryQuestionLikeRepository();
    const service = new QuestionsService(repo, answerRepo, questionLikeRepo);

    const created = await service.create({
      title: 'integration owner solve',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    }, 'author-1');

    await expect(service.solve(created.id, 'other-user')).rejects.toThrow(ForbiddenException);
  });

  it('allows admin to solve question', async () => {
    const repo = new InMemoryQuestionRepository();
    const answerRepo = new InMemoryAnswerRepository();
    const questionLikeRepo = new InMemoryQuestionLikeRepository();
    const authService = {
      getUserById: jest.fn((userId: string) => {
        if (userId === 'admin-1') {
          return { id: 'admin-1', role: 'admin' };
        }

        return { id: userId, role: 'user' };
      }),
    };
    const service = new QuestionsService(repo, answerRepo, questionLikeRepo, authService as never);

    const created = await service.create({
      title: 'integration admin solve',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    }, 'author-1');

    const solved = await service.solve(created.id, 'admin-1');

    expect(solved.question.status).toBe('solved');
    expect(authService.getUserById).toHaveBeenCalledWith('admin-1');
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

  it('hides reported question for reporter across top/all/detail, but keeps it for admin and anonymous-user', async () => {
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

        if (userId === 'reporter-1') {
          return { id: 'reporter-1', role: 'user' };
        }

        if (userId === 'author-1') {
          return { id: 'author-1', role: 'user' };
        }

        return undefined;
      }),
    };
    const service = new QuestionsService(repo, answerRepo, questionLikeRepo, authService as never, reportsService);

    const created = await service.create({
      title: 'integration report-hide target',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    }, 'author-1');

    await reportsService.create({
      targetType: 'question',
      targetId: created.id,
      reason: 'hide for reporter',
    }, 'reporter-1');

    const reporterTop = await service.listTopQuestions(undefined, undefined, 'reporter-1');
    const reporterAll = await service.listAllQuestions(undefined, 'reporter-1');

    expect(reporterTop.some((item) => item.question.id === created.id)).toBe(false);
    expect(reporterAll.some((item) => item.question.id === created.id)).toBe(false);
    await expect(service.findById(created.id, 'reporter-1')).rejects.toThrow('question not found');

    const adminTop = await service.listTopQuestions(undefined, undefined, 'admin-1');
    const adminAll = await service.listAllQuestions(undefined, 'admin-1');
    const adminDetail = await service.findById(created.id, 'admin-1');

    expect(adminTop.some((item) => item.question.id === created.id)).toBe(true);
    expect(adminAll.some((item) => item.question.id === created.id)).toBe(true);
    expect(adminDetail.question.id).toBe(created.id);

    const anonymousTop = await service.listTopQuestions(undefined, undefined, 'anonymous-user');
    const anonymousAll = await service.listAllQuestions(undefined, 'anonymous-user');
    const anonymousDetail = await service.findById(created.id, 'anonymous-user');

    expect(anonymousTop.some((item) => item.question.id === created.id)).toBe(true);
    expect(anonymousAll.some((item) => item.question.id === created.id)).toBe(true);
    expect(anonymousDetail.question.id).toBe(created.id);
  });
});
