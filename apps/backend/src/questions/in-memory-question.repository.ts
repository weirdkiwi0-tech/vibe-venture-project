import { Injectable } from '@nestjs/common';
import { attachLocalState } from '../db/local-state';
import { QuestionEntity } from './entities/question.entity';
import { QuestionRepository } from './questions.repository';

@Injectable()
export class InMemoryQuestionRepository implements QuestionRepository {
  private readonly store = new Map<string, QuestionEntity>();

  constructor() {
    attachLocalState(this, 'questions', ['store'], ['save', 'deleteById'], { store: QuestionEntity.prototype });
  }

  async save(question: QuestionEntity): Promise<void> {
    this.store.set(question.id, question);
  }

  async findById(id: string): Promise<QuestionEntity | null> {
    return this.store.get(id) ?? null;
  }

  async findByAuthorId(authorId: string): Promise<QuestionEntity[]> {
    return Array.from(this.store.values()).filter((question) => question.authorId === authorId);
  }

  async listAll(): Promise<QuestionEntity[]> {
    return Array.from(this.store.values());
  }

  async deleteById(id: string): Promise<void> {
    this.store.delete(id);
  }
}
