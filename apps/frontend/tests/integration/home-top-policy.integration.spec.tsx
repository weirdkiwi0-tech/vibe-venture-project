import { render } from '@testing-library/react';
import HomePage from '../../src/app/page';
import { getHomeFeed } from '../../src/lib/api';
import { createTopPolicyQuestions } from '../support/top-policy-fixtures';

const mockQuestionList = jest.fn(() => <div data-testid="question-list" />);

jest.mock('next/headers', () => ({
  headers: async () => ({
    get: () => null,
  }),
}));

jest.mock('../../src/lib/api', () => ({
  getHomeFeed: jest.fn(),
}));

jest.mock('../../src/components/site-shell', () => ({
  SiteShell: ({ children }: { children: unknown }) => <div>{children as never}</div>,
}));

jest.mock('../../src/components/section-card', () => ({
  SectionCard: ({ children }: { children: unknown }) => <section>{children as never}</section>,
}));

jest.mock('../../src/components/stats-strip', () => ({
  StatsStrip: () => <div />,
}));

jest.mock('../../src/components/feed-cards', () => ({
  VideoGrid: () => <div />,
  QuestionList: (props: unknown) => mockQuestionList(props),
}));

describe('home top policy (integration)', () => {
  it('passes exactly 10 questions as popular 7 + help-needed 3 to QuestionList', async () => {
    const mockedGetHomeFeed = getHomeFeed as jest.MockedFunction<typeof getHomeFeed>;
    mockedGetHomeFeed.mockResolvedValue({
      feed: {
        videos: [],
        questions: createTopPolicyQuestions(13, { titlePrefix: '정책질문' }),
      },
      metadata: {
        videoCount: 0,
        questionCount: 13,
        generatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      },
    });

    render(await HomePage());

    const passedQuestions = mockQuestionList.mock.calls[0]?.[0] as {
      questions: Array<{ title: string }>;
    };

    expect(passedQuestions.questions).toHaveLength(10);
    expect(passedQuestions.questions.slice(0, 7).map((item) => item.title)).toEqual([
      '정책질문-0',
      '정책질문-1',
      '정책질문-2',
      '정책질문-3',
      '정책질문-4',
      '정책질문-5',
      '정책질문-6',
    ]);
    expect(passedQuestions.questions.slice(7).map((item) => item.title).sort()).toEqual([
      '정책질문-10',
      '정책질문-11',
      '정책질문-12',
    ]);
  });
});
