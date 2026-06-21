import { Injectable } from '@nestjs/common';
import { MentoringMessageEntity } from './entities/mentoring-message.entity';
import { MentoringMessageRepository } from './mentoring-message.repository';

@Injectable()
export class InMemoryMentoringMessageRepository
  implements MentoringMessageRepository
{
  private readonly store = new Map<string, MentoringMessageEntity>();

  async save(message: MentoringMessageEntity): Promise<void> {
    this.store.set(message.id, message);
  }

  async findBySessionId(sessionId: string): Promise<MentoringMessageEntity[]> {
    return Array.from(this.store.values())
      .filter((message) => message.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
