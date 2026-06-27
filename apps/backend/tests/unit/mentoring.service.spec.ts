import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InMemoryMentoringMessageRepository } from '../../src/mentoring/in-memory-mentoring-message.repository';
import { InMemoryMentoringSessionRepository } from '../../src/mentoring/in-memory-mentoring-session.repository';
import { MentoringSessionEntity } from '../../src/mentoring/entities/mentoring-session.entity';
import { MentoringService } from '../../src/mentoring/mentoring.service';

describe('MentoringService (unit)', () => {
  let service: MentoringService;

  beforeEach(() => {
    service = new MentoringService(
      new InMemoryMentoringSessionRepository(),
      new InMemoryMentoringMessageRepository(),
    );
  });

  it('creates session and accepts messages', async () => {
    const session = await service.createSession({ question: 'math question' });

    const learnerMessage = await service.sendMessage(session.id, {
      sender: 'learner',
      content: 'hello',
    });

    const mentorMessage = await service.sendMessage(session.id, {
      sender: 'mentor',
      content: 'answer',
    });

    expect(learnerMessage.sessionId).toBe(session.id);
    expect(mentorMessage.sender).toBe('mentor');

    const found = await service.findSessionById(session.id);
    expect(found.session.firstMentorResponseAt).not.toBeNull();
  });

  it('throws not found for unknown session', async () => {
    await expect(
      service.sendMessage('missing', { sender: 'learner', content: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('blocks message with external link by safety policy', async () => {
    const session = await service.createSession({ question: 'policy test' });

    await expect(
      service.sendMessage(session.id, {
        sender: 'learner',
        content: 'check https://example.com',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists SLA breached sessions', async () => {
    const repo = new InMemoryMentoringSessionRepository();
    await repo.save(
      MentoringSessionEntity.create({
        id: 'session-old',
        learnerId: 'learner-1',
        question: 'old session',
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      }),
    );

    const localService = new MentoringService(
      repo,
      new InMemoryMentoringMessageRepository(),
    );

    const breaches = await localService.listSlaBreaches(new Date());
    expect(breaches).toHaveLength(1);
    expect(breaches[0].isSlaBreached).toBe(true);
  });

  it('keeps firstMentorResponseAt at first mentor message and never sets it for learner messages', async () => {
    const session = await service.createSession({ question: 'first mentor response contract' });

    await service.sendMessage(session.id, {
      sender: 'learner',
      content: 'learner before mentor',
    });

    const afterLearner = await service.findSessionById(session.id);
    expect(afterLearner.session.firstMentorResponseAt).toBeNull();

    const firstMentorMessage = await service.sendMessage(session.id, {
      sender: 'mentor',
      content: 'first mentor response',
    });

    const afterFirstMentor = await service.findSessionById(session.id);
    expect(afterFirstMentor.session.firstMentorResponseAt?.toISOString()).toBe(
      firstMentorMessage.createdAt.toISOString(),
    );

    await service.sendMessage(session.id, {
      sender: 'mentor',
      content: 'second mentor response',
    });

    const afterSecondMentor = await service.findSessionById(session.id);
    expect(afterSecondMentor.session.firstMentorResponseAt?.toISOString()).toBe(
      firstMentorMessage.createdAt.toISOString(),
    );
  });

  it('persists firstMentorResponseAt only on first mentor message', async () => {
    const sessionRepository = new InMemoryMentoringSessionRepository();
    const messageRepository = new InMemoryMentoringMessageRepository();
    const localService = new MentoringService(sessionRepository, messageRepository);
    const saveSpy = jest.spyOn(sessionRepository, 'save');

    const session = await localService.createSession({ question: 'save once contract' });

    await localService.sendMessage(session.id, {
      sender: 'mentor',
      content: 'first mentor',
    });

    await localService.sendMessage(session.id, {
      sender: 'mentor',
      content: 'second mentor',
    });

    expect(saveSpy).toHaveBeenCalledTimes(2);
  });
});
