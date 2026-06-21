import { QuestionEntity } from './entities/question.entity';

export const QUESTION_REPOSITORY = Symbol('QUESTION_REPOSITORY');

export interface QuestionRepository {
  save(question: QuestionEntity): Promise<void>;
  findById(id: string): Promise<QuestionEntity | null>;
  findByAuthorId(authorId: string): Promise<QuestionEntity[]>;
  listAll(): Promise<QuestionEntity[]>;
  deleteById(id: string): Promise<void>;
}
