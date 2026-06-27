import { InMemoryAnswerRepository } from '../../src/questions/in-memory-answer.repository';
import { AnswersService } from '../../src/questions/answers.service';
import { InMemoryQuestionRepository } from '../../src/questions/in-memory-question.repository';
import { AnswerEntity } from '../../src/questions/entities/answer.entity';
import { QuestionEntity } from '../../src/questions/entities/question.entity';

describe('AnswersService + repositories (integration)', () => {
  it('creates and lists answers', async () => {
    const answerRepo = new InMemoryAnswerRepository();
    const questionRepo = new InMemoryQuestionRepository();
    const service = new AnswersService(answerRepo, questionRepo);

    await questionRepo.save(
      QuestionEntity.create({
        id: 'q-1',
        authorId: 'u-1',
        title: 'q title',
        body: 'q body',
        subject: 'MATH',
        grade: '2',
      }),
    );

    await service.create('q-1', { type: 'text', content: 'a1' });
    await service.create('q-1', { type: 'video', content: 'https://v.test/1' });

    const list = await service.findByQuestionId('q-1');
    expect(list).toHaveLength(2);
  });

  it('returns newly created answer immediately with unchanged fields', async () => {
    const answerRepo = new InMemoryAnswerRepository();
    const questionRepo = new InMemoryQuestionRepository();
    const service = new AnswersService(answerRepo, questionRepo);

    await questionRepo.save(
      QuestionEntity.create({
        id: 'q-2',
        authorId: 'u-1',
        title: 'q title',
        body: 'q body',
        subject: 'MATH',
        grade: '2',
      }),
    );

    const created = await service.create(
      'q-2',
      {
        type: 'video',
        content: 'explain by video',
        attachments: ['data:video/mp4;base64,AAAA'],
      },
      'teacher-1',
    );
    const list = await service.findByQuestionId('q-2');

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
    expect(list[0].authorId).toBe('teacher-1');
    expect(list[0].content).toBe('explain by video');
    expect(list[0].type).toBe('video');
    expect(list[0].attachments).toEqual(['data:video/mp4;base64,AAAA']);
  });

  it('applies deterministic ordering: createdAt asc, then id asc for ties', async () => {
    const answerRepo = new InMemoryAnswerRepository();
    const questionRepo = new InMemoryQuestionRepository();
    const service = new AnswersService(answerRepo, questionRepo);

    await questionRepo.save(
      QuestionEntity.create({
        id: 'q-3',
        authorId: 'u-1',
        title: 'q title',
        body: 'q body',
        subject: 'MATH',
        grade: '2',
      }),
    );

    const sameTime = new Date('2026-02-02T00:00:00.000Z');
    await answerRepo.save(
      AnswerEntity.create({
        id: 'b-id',
        questionId: 'q-3',
        authorId: 'u-2',
        type: 'text',
        content: 'b',
        createdAt: sameTime,
      }),
    );
    await answerRepo.save(
      AnswerEntity.create({
        id: 'a-id',
        questionId: 'q-3',
        authorId: 'u-3',
        type: 'text',
        content: 'a',
        createdAt: sameTime,
      }),
    );

    const list = await service.findByQuestionId('q-3');
    expect(list.map((answer) => answer.id)).toEqual(['a-id', 'b-id']);
  });

  it('throws when listing answers for missing question', async () => {
    const answerRepo = new InMemoryAnswerRepository();
    const questionRepo = new InMemoryQuestionRepository();
    const service = new AnswersService(answerRepo, questionRepo);

    await expect(service.findByQuestionId('missing-question')).rejects.toThrow('question not found');
  });
});
