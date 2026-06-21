import { NotFoundException } from '@nestjs/common';
import { InMemoryAnswerRepository } from '../../src/questions/in-memory-answer.repository';
import { InMemoryQuestionLikeRepository } from '../../src/questions/in-memory-question-like.repository';
import { InMemoryQuestionRepository } from '../../src/questions/in-memory-question.repository';
import { AuthService } from '../../src/auth';
import { AnswerEntity } from '../../src/questions/entities/answer.entity';
import { QuestionsService } from '../../src/questions/questions.service';
import { QuestionEntity } from '../../src/questions/entities/question.entity';

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

    const first = await localService.solve('q-solved');
    const second = await localService.solve('q-solved');

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

  it('does not increase viewCount when viewer is not authenticated', async () => {
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

    expect(before.question.viewCount).toBe(0);
    expect(after.question.viewCount).toBe(0);
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
});
