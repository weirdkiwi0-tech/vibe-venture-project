import { render, screen } from '@testing-library/react';
import HomePage from '../../src/app/page';
import { getHomeFeed } from '../../src/lib/api';
import { createTopPolicyQuestions } from '../support/top-policy-fixtures';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('next/headers', () => ({
  headers: async () => ({
    get: () => null,
  }),
}));

jest.mock('../../src/components/role-provider', () => ({
  useAuthUser: () => ({
    authResolved: true,
    authUser: null,
    refetchAuth: jest.fn(),
  }),
}));

jest.mock('../../src/components/role-switcher', () => ({
  RoleSwitcher: () => <div>role-switcher</div>,
}));

jest.mock('../../src/components/role-navigation', () => ({
  RoleNavigation: () => <div>role-navigation</div>,
}));

jest.mock('../../src/lib/api', () => ({
  getHomeFeed: jest.fn(),
  deleteQuestion: jest.fn(),
  likeQuestion: jest.fn(),
  likeVideo: jest.fn(),
}));

describe('home top policy e2e', () => {
  it('shows grouped labels for 7 popular questions and 3 help-needed questions', async () => {
    const mockedGetHomeFeed = getHomeFeed as jest.MockedFunction<typeof getHomeFeed>;
    mockedGetHomeFeed.mockResolvedValue({
      feed: {
        videos: [],
        questions: createTopPolicyQuestions(10, { titlePrefix: '홈질문' }),
      },
      metadata: {
        videoCount: 0,
        questionCount: 10,
        generatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      },
    });

    render(await HomePage());

    expect(screen.getAllByText('인기 질문')).toHaveLength(7);
    expect(screen.getAllByText('도움 필요 질문')).toHaveLength(3);
  });
});
