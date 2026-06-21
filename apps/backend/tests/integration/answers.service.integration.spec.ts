import { InMemoryAnswerRepository } from '../../src/questions/in-memory-answer.repository';
import { AnswersService } from '../../src/questions/answers.service';
import { InMemoryQuestionRepository } from '../../src/questions/in-memory-question.repository';
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
});
