import { MentoringSessionEntity } from './entities/mentoring-session.entity';

export const MENTORING_SESSION_REPOSITORY = Symbol('MENTORING_SESSION_REPOSITORY');

export interface MentoringSessionRepository {
  save(session: MentoringSessionEntity): Promise<void>;
  findById(id: string): Promise<MentoringSessionEntity | null>;
  listAll(): Promise<MentoringSessionEntity[]>;
}
