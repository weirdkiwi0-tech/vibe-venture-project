import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateMentoringMessageDto } from './dto/create-mentoring-message.dto';
import { CreateMentoringSessionDto } from './dto/create-mentoring-session.dto';
import { MentoringMessageEntity } from './entities/mentoring-message.entity';
import { MentoringSessionEntity } from './entities/mentoring-session.entity';
import {
  MENTORING_MESSAGE_REPOSITORY,
  MentoringMessageRepository,
} from './mentoring-message.repository';
import {
  MENTORING_SESSION_REPOSITORY,
  MentoringSessionRepository,
} from './mentoring-session.repository';

@Injectable()
export class MentoringService {
  constructor(
    @Inject(MENTORING_SESSION_REPOSITORY)
    private readonly sessionRepository: MentoringSessionRepository,
    @Inject(MENTORING_MESSAGE_REPOSITORY)
    private readonly messageRepository: MentoringMessageRepository,
  ) {}

  async createSession(input: CreateMentoringSessionDto, learnerId = 'anonymous-user') {
    const session = MentoringSessionEntity.create({
      id: randomUUID(),
      learnerId,
      question: input.question,
    });

    await this.sessionRepository.save(session);
    return session;
  }

  async sendMessage(sessionId: string, input: CreateMentoringMessageDto) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException('mentoring session not found');
    }

    this.assertSafetyPolicy(input.content);

    const message = MentoringMessageEntity.create({
      id: randomUUID(),
      sessionId,
      sender: input.sender,
      content: input.content,
    });

    await this.messageRepository.save(message);

    if (input.sender === 'mentor' && !session.firstMentorResponseAt) {
      const updatedSession = session.markFirstMentorResponse(message.createdAt);
      await this.sessionRepository.save(updatedSession);
    }

    return message;
  }

  private assertSafetyPolicy(content: string) {
    const hasExternalLink = /(https?:\/\/|www\.)/i.test(content);
    const hasPhoneNumber = /\b\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/.test(content);
    const hasProfanity = /(badword|curseword)/i.test(content);

    if (hasExternalLink || hasPhoneNumber || hasProfanity) {
      throw new BadRequestException('message violates mentoring safety policy');
    }
  }

  async findSessionById(id: string) {
    const session = await this.sessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException('mentoring session not found');
    }

    const messages = await this.messageRepository.findBySessionId(id);
    return {
      session,
      messages,
      isSlaBreached: session.isSlaBreached(),
    };
  }

  async listSlaBreaches(now = new Date()) {
    const sessions = await this.sessionRepository.listAll();

    return sessions
      .filter((session) => session.isSlaBreached(now))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((session) => ({
        id: session.id,
        learnerId: session.learnerId,
        question: session.question,
        createdAt: session.createdAt,
        firstMentorResponseAt: session.firstMentorResponseAt,
        isSlaBreached: session.isSlaBreached(now),
      }));
  }
}
