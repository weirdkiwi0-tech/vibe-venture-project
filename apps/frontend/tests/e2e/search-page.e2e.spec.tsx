import { render, screen } from '@testing-library/react';
import SearchPage from '../../src/app/search/page';
import { getAllVideos, getCommunityBoard, getQuestionsAll } from '../../src/lib/api';

jest.mock('next/headers', () => ({
  headers: async () => ({
    get: () => null,
  }),
}));

jest.mock('../../src/components/site-shell', () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('../../src/components/section-card', () => ({
  SectionCard: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

jest.mock('../../src/lib/api', () => ({
  getQuestionsAll: jest.fn(),
  getCommunityBoard: jest.fn(),
  getAllVideos: jest.fn(),
}));

describe('SearchPage (e2e)', () => {
  const mockedGetQuestionsAll = getQuestionsAll as jest.MockedFunction<typeof getQuestionsAll>;
  const mockedGetCommunityBoard = getCommunityBoard as jest.MockedFunction<typeof getCommunityBoard>;
  const mockedGetAllVideos = getAllVideos as jest.MockedFunction<typeof getAllVideos>;

  beforeEach(() => {
    mockedGetQuestionsAll.mockReset();
    mockedGetCommunityBoard.mockReset();
    mockedGetAllVideos.mockReset();
  });

  it('renders empty keyword guidance and does not call search APIs when q is blank', async () => {
    render(await SearchPage({ searchParams: Promise.resolve({ q: '   ' }) }));

    expect(screen.getByText('검색어를 입력해주세요')).toBeInTheDocument();
    expect(mockedGetQuestionsAll).not.toHaveBeenCalled();
    expect(mockedGetCommunityBoard).not.toHaveBeenCalled();
    expect(mockedGetAllVideos).not.toHaveBeenCalled();
  });

  it('renders total count summary and direct links to question, community post detail, and video detail', async () => {
    mockedGetQuestionsAll.mockResolvedValue([
      {
        id: 'q-1',
        title: '수학 미적분 질문',
        subject: '수학',
        grade: '2',
        likeCount: 3,
        answerCount: 1,
        status: 'open',
        createdAt: '2026-10-30T00:00:00.000Z',
      },
    ]);
    mockedGetCommunityBoard.mockResolvedValue({
      posts: [
        {
          id: 'post-1',
          title: '수학 공부법 공유',
          authorId: 'user-1',
          authorName: '준',
          authorAvatar: '준',
          authorVisibility: 'nickname',
          viewCount: 10,
          likeCount: 2,
          createdAt: '2026-10-30T00:00:00.000Z',
        },
      ],
      totalPages: 1,
      friends: [],
    });
    mockedGetAllVideos.mockResolvedValue([
      {
        id: 'v-1',
        title: '수학 킬러 문항 풀이',
        subject: '수학',
        url: 'https://stream.test/v-1',
        durationSeconds: 180,
        viewCount: 25,
        likeCount: 7,
        createdAt: '2026-10-30T00:00:00.000Z',
      },
    ]);

    render(await SearchPage({ searchParams: Promise.resolve({ q: '수학' }) }));

    expect(screen.getByText('"수학" 결과 3건')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '질문 보기' })).toHaveAttribute('href', '/questions/q-1');
    expect(screen.getByRole('link', { name: '커뮤니티에서 보기' })).toHaveAttribute('href', '/community/posts/post-1');
    expect(screen.getByRole('link', { name: '영상 보기' })).toHaveAttribute('href', '/videos/v-1');
  });
});
