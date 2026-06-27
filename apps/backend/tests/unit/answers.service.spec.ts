import { NotFoundException } from '@nestjs/common';
import { InMemoryAnswerRepository } from '../../src/questions/in-memory-answer.repository';
import { InMemoryQuestionRepository } from '../../src/questions/in-memory-question.repository';
import { AnswersService } from '../../src/questions/answers.service';
import { AnswerEntity } from '../../src/questions/entities/answer.entity';
import { QuestionEntity } from '../../src/questions/entities/question.entity';
import { AuthService } from '../../src/auth';

describe('AnswersService (unit)', () => {
  it('creates answer for existing question', async () => {
    const answerRepo = new InMemoryAnswerRepository();
    const questionRepo = new InMemoryQuestionRepository();
    const service = new AnswersService(answerRepo, questionRepo);

    const q = QuestionEntity.create({
      id: 'q-1',
      authorId: 'u-1',
      title: 'title',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    });
    await questionRepo.save(q);

    const created = await service.create('q-1', {
      type: 'text',
      content: 'answer body',
    });

    expect(created.id).toBeDefined();
    expect(created.questionId).toBe('q-1');
  });

  it('throws when question does not exist', async () => {
    const answerRepo = new InMemoryAnswerRepository();
    const questionRepo = new InMemoryQuestionRepository();
    const service = new AnswersService(answerRepo, questionRepo);

    await expect(
      service.create('missing-q', { type: 'text', content: 'abc' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('creates then immediately lists answer with unchanged author/content/type/attachments', async () => {
    const answerRepo = new InMemoryAnswerRepository();
    const questionRepo = new InMemoryQuestionRepository();
    const service = new AnswersService(answerRepo, questionRepo);

    await questionRepo.save(
      QuestionEntity.create({
        id: 'q-2',
        authorId: 'q-author',
        title: 'title',
        body: 'body',
        subject: 'MATH',
        grade: '2',
      }),
    );

    const created = await service.create(
      'q-2',
      {
        type: 'video',
        content: 'video answer content',
        attachments: ['data:video/mp4;base64,AAAA'],
      },
      'answer-author',
    );

    const listed = await service.findByQuestionId('q-2');

    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(created.id);
    expect(listed[0].authorId).toBe('answer-author');
    expect(listed[0].content).toBe('video answer content');
    expect(listed[0].type).toBe('video');
    expect(listed[0].attachments).toEqual(['data:video/mp4;base64,AAAA']);
  });

  it('lists answers by createdAt asc and id asc when createdAt is identical', async () => {
    const answerRepo = new InMemoryAnswerRepository();
    const questionRepo = new InMemoryQuestionRepository();
    const service = new AnswersService(answerRepo, questionRepo);

    await questionRepo.save(
      QuestionEntity.create({
        id: 'q-3',
        authorId: 'q-author',
        title: 'title',
        body: 'body',
        subject: 'MATH',
        grade: '3',
      }),
    );

    const sameTime = new Date('2026-01-01T00:00:00.000Z');
    await answerRepo.save(
      AnswerEntity.create({
        id: 'b-answer',
        questionId: 'q-3',
        authorId: 'a-1',
        type: 'text',
        content: 'second by id',
        createdAt: sameTime,
      }),
    );
    await answerRepo.save(
      AnswerEntity.create({
        id: 'a-answer',
        questionId: 'q-3',
        authorId: 'a-2',
        type: 'text',
        content: 'first by id',
        createdAt: sameTime,
      }),
    );

    const listed = await service.findByQuestionId('q-3');

    expect(listed.map((answer) => answer.id)).toEqual(['a-answer', 'b-answer']);
  });

  it('throws not found when listing answers for missing question', async () => {
    const answerRepo = new InMemoryAnswerRepository();
    const questionRepo = new InMemoryQuestionRepository();
    const service = new AnswersService(answerRepo, questionRepo);

    await expect(service.findByQuestionId('missing-question')).rejects.toThrow(NotFoundException);
  });

  it('createComment anonymous 모드: authorName 익명, authorAvatar 익', async () => {
    const answerRepo = new InMemoryAnswerRepository();
    const questionRepo = new InMemoryQuestionRepository();
    const service = new AnswersService(answerRepo, questionRepo);

    const question = QuestionEntity.create({ id: 'q-anon', authorId: 'u-1', title: 'title', body: 'body', subject: 'MATH', grade: '1' });
    await questionRepo.save(question);
    const answer = await service.create('q-anon', { type: 'text', content: 'answer' }, 'u-1');

    const comment = await service.createComment(answer.id, { content: '익명 댓글', authorVisibility: 'anonymous' }, 'user-2');

    expect(comment.authorName).toBe('익명');
    expect(comment.authorAvatar).toBe('익');
    expect(comment.authorPhotoUrl).toBeUndefined();
  });

  it('createComment public 모드: AuthService displayName 조회 결과를 authorName에 반영', async () => {
    const answerRepo = new InMemoryAnswerRepository();
    const questionRepo = new InMemoryQuestionRepository();
    const authServiceMock = {
      getUserById: jest.fn().mockResolvedValue({ id: 'u-3', displayName: '답변댓글작성자', photoUrl: '/p.png' }),
    } as unknown as AuthService;
    const service = new AnswersService(answerRepo, questionRepo, authServiceMock);

    const question = QuestionEntity.create({ id: 'q-pub', authorId: 'u-1', title: 'title', body: 'body', subject: 'MATH', grade: '1' });
    await questionRepo.save(question);
    const answer = await service.create('q-pub', { type: 'text', content: 'answer' }, 'u-1');

    const comment = await service.createComment(answer.id, { content: '공개 댓글', authorVisibility: 'public' }, 'u-3');

    expect(comment.authorName).toBe('답변댓글작성자');
    expect(comment.authorAvatar).toBe('답');
  });

  it('createComment public 모드: authorAvatar가 string 타입', async () => {
    const answerRepo = new InMemoryAnswerRepository();
    const questionRepo = new InMemoryQuestionRepository();
    const authServiceMock = {
      getUserById: jest.fn().mockResolvedValue({ id: 'u-4', displayName: '아바타테스터', photoUrl: '/avatar.png' }),
    } as unknown as AuthService;
    const service = new AnswersService(answerRepo, questionRepo, authServiceMock);

    const question = QuestionEntity.create({ id: 'q-avatar', authorId: 'u-1', title: 'title', body: 'body', subject: 'MATH', grade: '1' });
    await questionRepo.save(question);
    const answer = await service.create('q-avatar', { type: 'text', content: 'answer' }, 'u-1');

    const comment = await service.createComment(answer.id, { content: '아바타 확인', authorVisibility: 'public' }, 'u-4');

    expect(typeof comment.authorAvatar).toBe('string');
  });
});
