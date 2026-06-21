import { InMemoryMentoringMessageRepository } from '../../src/mentoring/in-memory-mentoring-message.repository';
import { InMemoryMentoringSessionRepository } from '../../src/mentoring/in-memory-mentoring-session.repository';
import { MentoringSessionEntity } from '../../src/mentoring/entities/mentoring-session.entity';
import { MentoringService } from '../../src/mentoring/mentoring.service';

describe('MentoringService + Repository (integration)', () => {
  it('stores session and messages with first mentor response timestamp', async () => {
    const service = new MentoringService(
      new InMemoryMentoringSessionRepository(),
      new InMemoryMentoringMessageRepository(),
    );

    const session = await service.createSession({
      question: 'integration mentoring question',
    });

    await service.sendMessage(session.id, {
      sender: 'learner',
      content: 'need help',
    });
    await service.sendMessage(session.id, {
      sender: 'mentor',
      content: 'here is guidance',
    });

    const found = await service.findSessionById(session.id);
    expect(found.messages).toHaveLength(2);
    expect(found.session.firstMentorResponseAt).not.toBeNull();
    expect(found.isSlaBreached).toBe(false);
  });

  it('lists breached SLA sessions', async () => {
    const sessionRepo = new InMemoryMentoringSessionRepository();
    const messageRepo = new InMemoryMentoringMessageRepository();
    const service = new MentoringService(sessionRepo, messageRepo);

    await sessionRepo.save(
      MentoringSessionEntity.create({
        id: 'breach-session',
        learnerId: 'learner-1',
        question: 'breach test',
        createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
      }),
    );

    const breaches = await service.listSlaBreaches(new Date());
    expect(breaches).toHaveLength(1);
    expect(breaches[0].id).toBe('breach-session');
  });
});
