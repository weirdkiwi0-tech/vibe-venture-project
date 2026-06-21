import { MentoringSessionEntity } from '../../src/mentoring/entities/mentoring-session.entity';

describe('MentoringSessionEntity (unit)', () => {
  it('marks first mentor response once', () => {
    const session = MentoringSessionEntity.create({
      id: 'm-1',
      learnerId: 'u-1',
      question: 'need help',
    });

    const firstAt = new Date('2026-01-01T00:00:00.000Z');
    const marked = session.markFirstMentorResponse(firstAt);
    const second = marked.markFirstMentorResponse(new Date('2026-01-02T00:00:00.000Z'));

    expect(marked.firstMentorResponseAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(second.firstMentorResponseAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('detects SLA breach after 24h without mentor response', () => {
    const session = MentoringSessionEntity.create({
      id: 'm-2',
      learnerId: 'u-1',
      question: 'need help',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(session.isSlaBreached(new Date('2026-01-02T00:00:01.000Z'))).toBe(true);
  });
});
