import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InMemoryAnswerRepository } from '../../src/questions/in-memory-answer.repository';
import { InMemoryQuestionLikeRepository } from '../../src/questions/in-memory-question-like.repository';
import { InMemoryQuestionRepository } from '../../src/questions/in-memory-question.repository';
import { AuthService } from '../../src/auth';
import { AnswerEntity } from '../../src/questions/entities/answer.entity';
import { QuestionsService } from '../../src/questions/questions.service';
import { QuestionEntity } from '../../src/questions/entities/question.entity';
import { ReportsService } from '../../src/reports/reports.service';
import { InMemoryReportRepository } from '../../src/reports/in-memory-report.repository';
import { InMemoryAdminAuditLogRepository } from '../../src/reports/in-memory-admin-audit-log.repository';
import { seedTopPolicyQuestions } from '../support/top-policy-fixture';

describe('QuestionsService (unit)', () => {
  let service: QuestionsService;
  let questionRepo: InMemoryQuestionRepository;
  let answerRepo: InMemoryAnswerRepository;
  let questionLikeRepo: InMemoryQuestionLikeRepository;

  beforeEach(() => {
    questionRepo = new InMemoryQuestionRepository();
    answerRepo = new InMemoryAnswerRepository();
    questionLikeRepo = new InMemoryQuestionLikeRepository();
    service = new QuestionsService(questionRepo, answerRepo, questionLikeRepo);
  });

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

  it('creates a question', async () => {
    const question = await service.create({
      title: 'Trig question',
      body: 'How to solve?',
      subject: 'MATH',
      grade: '2',
      visibility: 'anonymous',
      attachments: [],
    });

    expect(question.id).toBeDefined();
    expect(question.title).toBe('Trig question');
  });

  it.each([
    ['title', { title: '   ', body: 'How to solve?', subject: 'MATH', grade: '2' }, 'title is required'],
    ['body', { title: 'Trig question', body: '   ', subject: 'MATH', grade: '2' }, 'body is required'],
    ['subject', { title: 'Trig question', body: 'How to solve?', subject: '   ', grade: '2' }, 'subject is required'],
    ['grade', { title: 'Trig question', body: 'How to solve?', subject: 'MATH', grade: '   ' }, 'grade is required'],
  ])('throws BadRequestException with consistent message when %s is blank', async (_field, input, expectedMessage) => {
    await expectCreateBadRequest(service, input, expectedMessage);
  });

  it('uses anonymous visibility by default when not provided', async () => {
    const question = await service.create({
      title: 'Default visibility question',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });

    expect(question.visibility).toBe('anonymous');
  });

  it('stores nickname visibility when provided', async () => {
    const question = await service.create({
      title: 'Nickname visibility question',
      body: 'body',
      subject: 'MATH',
      grade: '2',
      visibility: 'nickname',
    });

    expect(question.visibility).toBe('nickname');
  });

  it('preserves visibility values in listAllQuestions and listByAuthorId', async () => {
    const authorId = 'visibility-author';
    const anonymousQuestion = await service.create({
      title: 'unit visibility anonymous',
      body: 'body',
      subject: 'MATH',
      grade: '2',
      visibility: 'anonymous',
    }, authorId);

    const nicknameQuestion = await service.create({
      title: 'unit visibility nickname',
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

  it('throws NotFoundException when question does not exist', async () => {
    await expect(service.findById('nope')).rejects.toThrow(NotFoundException);
  });

  it('solves existing question', async () => {
    const created = await service.create({
      title: 'solve me',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    });

    const solved = await service.solve(created.id);
    expect(solved.question.status).toBe('solved');
  });

  it('throws ForbiddenException when non-author tries to solve question', async () => {
    const created = await service.create({
      title: 'owner only solve',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    }, 'author-1');

    await expect(service.solve(created.id, 'other-user')).rejects.toThrow(ForbiddenException);
  });

  it('allows admin user to solve question', async () => {
    const repo = new InMemoryQuestionRepository();
    const localAnswerRepo = new InMemoryAnswerRepository();
    const localQuestionLikeRepo = new InMemoryQuestionLikeRepository();
    const authService = {
      getUserById: jest.fn((userId: string) => {
        if (userId === 'admin-1') {
          return { id: 'admin-1', role: 'admin' };
        }

        return { id: userId, role: 'user' };
      }),
    };

    const localService = new QuestionsService(repo, localAnswerRepo, localQuestionLikeRepo, authService as unknown as AuthService);
    const created = await localService.create({
      title: 'admin solve',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    }, 'author-1');

    const solved = await localService.solve(created.id, 'admin-1');

    expect(solved.question.status).toBe('solved');
    expect(authService.getUserById).toHaveBeenCalledWith('admin-1');
  });

  it('is idempotent when solve is called twice', async () => {
    const repo = new InMemoryQuestionRepository();
    const answerRepo = new InMemoryAnswerRepository();
    const questionLikeRepo = new InMemoryQuestionLikeRepository();
    const localService = new QuestionsService(repo, answerRepo, questionLikeRepo);

    await repo.save(
      QuestionEntity.create({
        id: 'q-solved',
        authorId: 'u-1',
        title: 'already solved',
        body: 'body',
        subject: 'MATH',
        grade: '2',
        status: 'solved',
      }),
    );

    const first = await localService.solve('q-solved', 'u-1');
    const second = await localService.solve('q-solved', 'u-1');

    expect(first.question.status).toBe('solved');
    expect(second.question.status).toBe('solved');
  });

  it('lists top questions sorted by likeCount desc then createdAt desc', async () => {
    for (let i = 0; i < 10; i += 1) {
      const created = await service.create({
        title: `question-${i}`,
        body: 'body',
        subject: 'MATH',
        grade: '1',
      });

      for (let j = 0; j < i; j += 1) {
        await service.like(created.id, `user-${i}-${j}`);
      }
    }

    const list = await service.listTopQuestions();
    expect(list).toHaveLength(10);

    const popularCounts = list.slice(0, 7).map((item) => item.question.likeCount);
    expect(popularCounts).toEqual([9, 8, 7, 6, 5, 4, 3]);

    const helpNeededCounts = list
      .slice(7)
      .map((item) => item.question.likeCount)
      .sort((a, b) => a - b);
    expect(helpNeededCounts).toEqual([0, 1, 2]);
  });

  it('toggles like for same user on same question', async () => {
    const created = await service.create({
      title: 'like once',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });

    const first = await service.like(created.id, 'user-1');
    const second = await service.like(created.id, 'user-1');
    const third = await service.like(created.id, 'user-2');
    const fourth = await service.like(created.id, 'user-1');

    expect(first.question.likeCount).toBe(1);
    expect(first.liked).toBe(true);
    expect(second.question.likeCount).toBe(0);
    expect(second.liked).toBe(false);
    expect(third.question.likeCount).toBe(1);
    expect(third.liked).toBe(true);
    expect(fourth.question.likeCount).toBe(2);
    expect(fourth.liked).toBe(true);
  });

  it('returns available questions when total count is less than 10', async () => {
    await service.create({
      title: 'only one',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });

    const list = await service.listTopQuestions();
    expect(list).toHaveLength(1);
  });

  it('filters top questions by subject and grade', async () => {
    await service.create({
      title: 'math question',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    });

    await service.create({
      title: 'english question',
      body: 'body',
      subject: 'ENGLISH',
      grade: '1',
    });

    const filtered = await service.listTopQuestions(10, {
      subject: 'MATH',
      grade: '1',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].question.subject).toBe('MATH');
    expect(filtered[0].question.grade).toBe('1');
  });

  it('applies top policy as popular 7 plus help-needed 3 when there are more than 10 questions', async () => {
    await seedTopPolicyQuestions(service, 'policy', '1');

    const list = await service.listTopQuestions();
    expect(list).toHaveLength(10);

    const topTitles = list.slice(0, 7).map((item) => item.question.title);
    expect(topTitles).toEqual([
      'policy-0',
      'policy-1',
      'policy-2',
      'policy-3',
      'policy-4',
      'policy-5',
      'policy-6',
    ]);

    const helpNeededTitles = list.slice(7).map((item) => item.question.title);
    expect(helpNeededTitles.sort()).toEqual(['policy-10', 'policy-11', 'policy-12']);
  });

  it('applies strict top policy for exactly 10 questions with deterministic order', async () => {
    const baseTime = Date.parse('2026-01-01T00:00:00.000Z');

    const createPreset = async (
      id: string,
      score: { likeCount: number; viewCount: number },
      status: 'open' | 'solved',
      minuteOffset: number,
    ) => {
      await questionRepo.save(
        QuestionEntity.create({
          id,
          authorId: 'author-1',
          title: id,
          body: 'body',
          subject: 'MATH',
          grade: '1',
          status,
          likeCount: score.likeCount,
          viewCount: score.viewCount,
          createdAt: new Date(baseTime + minuteOffset * 60_000),
          updatedAt: new Date(baseTime + minuteOffset * 60_000),
        }),
      );
    };

    await createPreset('q-1', { likeCount: 7, viewCount: 1 }, 'open', 1);
    await createPreset('q-2', { likeCount: 6, viewCount: 2 }, 'open', 2);
    await createPreset('q-3', { likeCount: 5, viewCount: 3 }, 'open', 3);
    await createPreset('q-4', { likeCount: 4, viewCount: 4 }, 'open', 4);
    await createPreset('q-5', { likeCount: 3, viewCount: 5 }, 'open', 5);
    await createPreset('q-6', { likeCount: 2, viewCount: 6 }, 'open', 6);
    await createPreset('q-7', { likeCount: 1, viewCount: 7 }, 'open', 7);

    await createPreset('q-8', { likeCount: 0, viewCount: 0 }, 'solved', 8);
    await createPreset('q-9', { likeCount: 0, viewCount: 1 }, 'open', 9);
    await createPreset('q-10', { likeCount: 0, viewCount: 2 }, 'open', 10);

    const list = await service.listTopQuestions();

    expect(list).toHaveLength(10);
    expect(list.slice(0, 7).map((item) => item.question.id)).toEqual([
      'q-7',
      'q-6',
      'q-5',
      'q-4',
      'q-3',
      'q-2',
      'q-1',
    ]);

    expect(list.slice(7).map((item) => item.question.id)).toEqual(['q-9', 'q-10', 'q-8']);
  });

  it('ranks popularity by likeCount + viewCount desc, then createdAt desc', async () => {
    const olderHighScore = QuestionEntity.create({
      id: 'score-older',
      authorId: 'author-1',
      title: 'score-older',
      body: 'body',
      subject: 'MATH',
      grade: '1',
      likeCount: 3,
      viewCount: 10,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const newerLowerLikeButHigherScore = QuestionEntity.create({
      id: 'score-top',
      authorId: 'author-1',
      title: 'score-top',
      body: 'body',
      subject: 'MATH',
      grade: '1',
      likeCount: 2,
      viewCount: 20,
      createdAt: new Date('2026-01-01T00:05:00.000Z'),
      updatedAt: new Date('2026-01-01T00:05:00.000Z'),
    });
    const newerSameScore = QuestionEntity.create({
      id: 'score-same-newer',
      authorId: 'author-1',
      title: 'score-same-newer',
      body: 'body',
      subject: 'MATH',
      grade: '1',
      likeCount: 5,
      viewCount: 8,
      createdAt: new Date('2026-01-01T00:10:00.000Z'),
      updatedAt: new Date('2026-01-01T00:10:00.000Z'),
    });

    await questionRepo.save(olderHighScore);
    await questionRepo.save(newerLowerLikeButHigherScore);
    await questionRepo.save(newerSameScore);

    const list = await service.listTopQuestions(undefined);

    expect(list.slice(0, 3).map((item) => item.question.id)).toEqual([
      'score-top',
      'score-same-newer',
      'score-older',
    ]);
  });

  it('increases viewCount when viewer is not authenticated', async () => {
    const authServiceMock = {
      getUserById: (_id: string) => undefined,
    } as unknown as AuthService;
    const localService = new QuestionsService(questionRepo, answerRepo, questionLikeRepo, authServiceMock);

    const created = await localService.create({
      title: 'guest view check',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });

    const before = await localService.findById(created.id, 'unknown-user');
    const after = await localService.findById(created.id);

    expect(before.question.viewCount).toBe(1);
    expect(after.question.viewCount).toBe(2);
  });

  it('increases viewCount when viewer is a registered user', async () => {
    const authServiceMock = {
      getUserById: (id: string) => (id === 'registered-user' ? { id } : undefined),
    } as unknown as AuthService;

    const localService = new QuestionsService(questionRepo, answerRepo, questionLikeRepo, authServiceMock);
    const created = await localService.create({
      title: 'member view check',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    });

    const viewed = await localService.findById(created.id, 'registered-user');
    expect(viewed.question.viewCount).toBe(1);
  });

  it('hides reported question for reporter across top/all/detail, but not for admin and anonymous-user', async () => {
    const repo = new InMemoryQuestionRepository();
    const localAnswerRepo = new InMemoryAnswerRepository();
    const localQuestionLikeRepo = new InMemoryQuestionLikeRepository();
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

    const localService = new QuestionsService(
      repo,
      localAnswerRepo,
      localQuestionLikeRepo,
      authService as unknown as AuthService,
      reportsService,
    );

    const created = await localService.create({
      title: 'report-hide-unit-target',
      body: 'body',
      subject: 'MATH',
      grade: '2',
    }, 'author-1');

    await reportsService.create({
      targetType: 'question',
      targetId: created.id,
      reason: 'hide for reporter',
    }, 'reporter-1');

    const reporterTop = await localService.listTopQuestions(undefined, undefined, 'reporter-1');
    const reporterAll = await localService.listAllQuestions(undefined, 'reporter-1');

    expect(reporterTop.some((item) => item.question.id === created.id)).toBe(false);
    expect(reporterAll.some((item) => item.question.id === created.id)).toBe(false);
    await expect(localService.findById(created.id, 'reporter-1')).rejects.toThrow(NotFoundException);

    const adminTop = await localService.listTopQuestions(undefined, undefined, 'admin-1');
    const adminAll = await localService.listAllQuestions(undefined, 'admin-1');
    const adminDetail = await localService.findById(created.id, 'admin-1');

    expect(adminTop.some((item) => item.question.id === created.id)).toBe(true);
    expect(adminAll.some((item) => item.question.id === created.id)).toBe(true);
    expect(adminDetail.question.id).toBe(created.id);

    const anonymousTop = await localService.listTopQuestions(undefined, undefined, 'anonymous-user');
    const anonymousAll = await localService.listAllQuestions(undefined, 'anonymous-user');
    const anonymousDetail = await localService.findById(created.id, 'anonymous-user');

    expect(anonymousTop.some((item) => item.question.id === created.id)).toBe(true);
    expect(anonymousAll.some((item) => item.question.id === created.id)).toBe(true);
    expect(anonymousDetail.question.id).toBe(created.id);
  });
});
