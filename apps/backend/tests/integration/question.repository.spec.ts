import { InMemoryQuestionRepository } from '../../src/questions/in-memory-question.repository';
import { QuestionEntity } from '../../src/questions/entities/question.entity';

describe('InMemoryQuestionRepository (integration)', () => {
  it('saves and finds by id', async () => {
    const repo = new InMemoryQuestionRepository();
    const question = QuestionEntity.create({
      id: 'q-1',
      authorId: 'u-1',
      title: 'title',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    });

    await repo.save(question);
    const found = await repo.findById('q-1');

    expect(found).not.toBeNull();
    expect(found?.title).toBe('title');
  });
});
