export const QUESTION_LIKE_REPOSITORY = Symbol('QUESTION_LIKE_REPOSITORY');

export interface QuestionLikeRepository {
  hasUserLiked(questionId: string, userId: string): Promise<boolean>;
  saveLike(questionId: string, userId: string): Promise<void>;
  removeLike(questionId: string, userId: string): Promise<void>;
}
