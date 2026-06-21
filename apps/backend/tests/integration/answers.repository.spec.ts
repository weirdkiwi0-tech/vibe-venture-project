import { InMemoryAnswerRepository } from '../../src/questions/in-memory-answer.repository';
import { AnswerEntity } from '../../src/questions/entities/answer.entity';

describe('InMemoryAnswerRepository (integration)', () => {
  it('saves and finds answers by question id', async () => {
    const repo = new InMemoryAnswerRepository();
    const answer = AnswerEntity.create({
      id: 'a-1',
      questionId: 'q-1',
      authorId: 'u-1',
      type: 'text',
      content: 'content',
    });

    await repo.save(answer);
    const found = await repo.findByQuestionId('q-1');

    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('a-1');
    expect(await repo.countByQuestionId('q-1')).toBe(1);
  });
});
