import { Injectable } from '@nestjs/common';
import { MentoringSessionEntity } from './entities/mentoring-session.entity';
import { MentoringSessionRepository } from './mentoring-session.repository';

@Injectable()
export class InMemoryMentoringSessionRepository
  implements MentoringSessionRepository
{
  private readonly store = new Map<string, MentoringSessionEntity>();

  async save(session: MentoringSessionEntity): Promise<void> {
    this.store.set(session.id, session);
  }

  async findById(id: string): Promise<MentoringSessionEntity | null> {
    return this.store.get(id) ?? null;
  }

  async listAll(): Promise<MentoringSessionEntity[]> {
    return Array.from(this.store.values());
  }
}
