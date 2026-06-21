import { MentoringMessageEntity } from './entities/mentoring-message.entity';

export const MENTORING_MESSAGE_REPOSITORY = Symbol('MENTORING_MESSAGE_REPOSITORY');

export interface MentoringMessageRepository {
  save(message: MentoringMessageEntity): Promise<void>;
  findBySessionId(sessionId: string): Promise<MentoringMessageEntity[]>;
}
