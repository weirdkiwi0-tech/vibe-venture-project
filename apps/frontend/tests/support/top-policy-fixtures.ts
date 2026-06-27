const DEFAULT_LIKE_COUNTS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0];

type TopPolicyQuestionOverrides = {
  titlePrefix?: string;
  subject?: string;
  grade?: string;
};

export function createTopPolicyQuestions(
  length = 10,
  overrides: TopPolicyQuestionOverrides = {},
) {
  const { titlePrefix = '질문', subject = '수학', grade = '2' } = overrides;

  return Array.from({ length }, (_, index) => ({
    id: `q-${index}`,
    title: `${titlePrefix}-${index}`,
    body: '본문',
    subject,
    grade,
    attachments: [],
    visibility: 'anonymous',
    status: 'open',
    likeCount: DEFAULT_LIKE_COUNTS[index] ?? 0,
    viewCount: 0,
    createdAt: new Date(2026, 0, index + 1).toISOString(),
    updatedAt: new Date(2026, 0, index + 1).toISOString(),
    answerCount: 0,
  }));
}