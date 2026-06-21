import { Injectable } from '@nestjs/common';
import { QuestionLikeRepository } from './question-like.repository';

@Injectable()
export class InMemoryQuestionLikeRepository implements QuestionLikeRepository {
  private readonly likesByQuestionId = new Map<string, Set<string>>();

  async hasUserLiked(questionId: string, userId: string): Promise<boolean> {
    const likedUsers = this.likesByQuestionId.get(questionId);
    return likedUsers?.has(userId) ?? false;
  }

  async saveLike(questionId: string, userId: string): Promise<void> {
    const likedUsers = this.likesByQuestionId.get(questionId) ?? new Set<string>();
    likedUsers.add(userId);
    this.likesByQuestionId.set(questionId, likedUsers);
  }

  async removeLike(questionId: string, userId: string): Promise<void> {
    const likedUsers = this.likesByQuestionId.get(questionId);
    if (!likedUsers) {
      return;
    }

    likedUsers.delete(userId);
    if (likedUsers.size === 0) {
      this.likesByQuestionId.delete(questionId);
      return;
    }

    this.likesByQuestionId.set(questionId, likedUsers);
  }
}
