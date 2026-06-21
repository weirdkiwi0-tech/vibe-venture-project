import { DomainValidationError } from '../../src/questions/errors/domain-validation.error';
import { AnswerEntity } from '../../src/questions/entities/answer.entity';

describe('AnswerEntity', () => {
  it('creates answer entity', () => {
    const answer = AnswerEntity.create({
      id: 'a-1',
      questionId: 'q-1',
      authorId: 'u-1',
      type: 'text',
      content: 'This is an answer',
    });

    expect(answer.type).toBe('text');
    expect(answer.createdAt).toBeInstanceOf(Date);
  });

  it('throws when content is missing', () => {
    expect(() =>
      AnswerEntity.create({
        id: 'a-1',
        questionId: 'q-1',
        authorId: 'u-1',
        type: 'text',
        content: '',
      }),
    ).toThrow(DomainValidationError);
  });
});
