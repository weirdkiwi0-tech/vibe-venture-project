import { AnswerEntity } from './entities/answer.entity';

export const ANSWER_REPOSITORY = Symbol('ANSWER_REPOSITORY');

export interface AnswerRepository {
  save(answer: AnswerEntity): Promise<void>;
  findById(id: string): Promise<AnswerEntity | null>;
  findByQuestionId(questionId: string): Promise<AnswerEntity[]>;
  findByAuthorId(authorId: string): Promise<AnswerEntity[]>;
  countByQuestionId(questionId: string): Promise<number>;
  deleteById(id: string): Promise<void>;
  deleteByQuestionId(questionId: string): Promise<void>;
}
