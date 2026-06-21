import { Injectable } from '@nestjs/common';
import { AnswerEntity } from './entities/answer.entity';
import { AnswerRepository } from './answers.repository';

@Injectable()
export class InMemoryAnswerRepository implements AnswerRepository {
  private readonly store = new Map<string, AnswerEntity>();

  async save(answer: AnswerEntity): Promise<void> {
    this.store.set(answer.id, answer);
  }

  async findById(id: string): Promise<AnswerEntity | null> {
    return this.store.get(id) ?? null;
  }

  async findByQuestionId(questionId: string): Promise<AnswerEntity[]> {
    return Array.from(this.store.values()).filter(
      (answer) => answer.questionId === questionId,
    );
  }

  async findByAuthorId(authorId: string): Promise<AnswerEntity[]> {
    return Array.from(this.store.values()).filter((answer) => answer.authorId === authorId);
  }

  async countByQuestionId(questionId: string): Promise<number> {
    const answers = await this.findByQuestionId(questionId);
    return answers.length;
  }

  async deleteById(id: string): Promise<void> {
    this.store.delete(id);
  }

  async deleteByQuestionId(questionId: string): Promise<void> {
    for (const [id, answer] of this.store.entries()) {
      if (answer.questionId === questionId) {
        this.store.delete(id);
      }
    }
  }
}
