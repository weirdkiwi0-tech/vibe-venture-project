import { render, screen } from '@testing-library/react';
import { QuestionList } from '../../src/components/feed-cards';
import { createTopPolicyQuestions } from '../support/top-policy-fixtures';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('../../src/components/role-provider', () => ({
  useAuthUser: () => ({
    authResolved: true,
    authUser: null,
    refetchAuth: jest.fn(),
  }),
}));

jest.mock('../../src/lib/api', () => ({
  deleteQuestion: jest.fn(),
  likeQuestion: jest.fn(),
  likeVideo: jest.fn(),
}));

describe('question top policy (unit)', () => {
  it('renders 7 popular badges and 3 help-needed badges for top question policy', () => {
    const questions = createTopPolicyQuestions(10, { titlePrefix: '질문' });

    render(<QuestionList questions={questions} autoSlide={false} />);

    expect(screen.getAllByText('인기 질문')).toHaveLength(7);
    expect(screen.getAllByText('도움 필요 질문')).toHaveLength(3);
  });
});
