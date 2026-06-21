import { NotFoundException } from '@nestjs/common';
import { InMemoryAnswerRepository } from '../../src/questions/in-memory-answer.repository';
import { InMemoryQuestionRepository } from '../../src/questions/in-memory-question.repository';
import { AnswersService } from '../../src/questions/answers.service';
import { QuestionEntity } from '../../src/questions/entities/question.entity';

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
});
