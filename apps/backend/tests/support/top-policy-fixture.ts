import { QuestionsService } from '../../src/questions/questions.service';

export const TOP_POLICY_LIKE_COUNTS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0];

export async function seedTopPolicyQuestions(
  service: QuestionsService,
  titlePrefix: string,
  grade = '1',
) {
  for (let i = 0; i < TOP_POLICY_LIKE_COUNTS.length; i += 1) {
    const created = await service.create({
      title: `${titlePrefix}-${i}`,
      body: 'body',
      subject: 'MATH',
      grade,
    });

    for (let j = 0; j < TOP_POLICY_LIKE_COUNTS[i]; j += 1) {
      await service.like(created.id, `${titlePrefix}-user-${i}-${j}`);
    }
  }
}