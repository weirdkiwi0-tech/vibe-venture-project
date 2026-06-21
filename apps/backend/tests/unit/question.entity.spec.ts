import { DomainValidationError } from '../../src/questions/errors/domain-validation.error';
import { QuestionEntity } from '../../src/questions/entities/question.entity';

describe('QuestionEntity', () => {
  it('creates entity with defaults', () => {
    const question = QuestionEntity.create({
      id: 'q-1',
      authorId: 'u-1',
      title: 'title',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    });

    expect(question.visibility).toBe('anonymous');
    expect(question.status).toBe('open');
    expect(question.attachments).toEqual([]);
    expect(question.createdAt).toBeInstanceOf(Date);
  });

  it('throws when title is missing', () => {
    expect(() =>
      QuestionEntity.create({
        id: 'q-1',
        authorId: 'u-1',
        title: '',
        body: 'body',
        subject: 'MATH',
        grade: '1',
      }),
    ).toThrow(DomainValidationError);
  });

  it('solves an open question', () => {
    const question = QuestionEntity.create({
      id: 'q-2',
      authorId: 'u-1',
      title: 'title',
      body: 'body',
      subject: 'MATH',
      grade: '1',
    });

    const solved = question.solve(new Date('2026-01-01T00:00:00.000Z'));

    expect(solved.status).toBe('solved');
    expect(solved.updatedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('is idempotent for already solved question', () => {
    const solvedQuestion = QuestionEntity.create({
      id: 'q-3',
      authorId: 'u-1',
      title: 'title',
      body: 'body',
      subject: 'MATH',
      grade: '1',
      status: 'solved',
    });

    const result = solvedQuestion.solve();
    expect(result).toBe(solvedQuestion);
  });
});
