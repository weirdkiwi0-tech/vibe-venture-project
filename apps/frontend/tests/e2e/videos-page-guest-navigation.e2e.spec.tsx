import { fireEvent, render, screen } from '@testing-library/react';
import VideosPage from '../../src/app/videos/page';

const pushMock = jest.fn();
const getFilteredVideosMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

jest.mock('../../src/components/site-shell', () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('../../src/components/section-card', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

jest.mock('../../src/components/role-provider', () => ({
  useAuthUser: () => ({
    authResolved: true,
    authUser: null,
  }),
}));

jest.mock('../../src/lib/api', () => ({
  deleteVideo: jest.fn(),
  likeVideo: jest.fn(),
  getFilteredVideos: (...args: unknown[]) => getFilteredVideosMock(...args),
}));

describe('VideosPage guest flow (e2e)', () => {
  beforeEach(() => {
    pushMock.mockReset();
    getFilteredVideosMock.mockReset();

    window.alert = jest.fn();

    getFilteredVideosMock.mockResolvedValue([
      {
        id: 'v-1',
        title: '게스트 E2E 목록 영상',
        subject: '영어',
        url: 'https://stream.test/v-1',
        durationSeconds: 120,
        likeCount: 5,
        viewCount: 50,
        createdAt: '2026-06-28T00:00:00.000Z',
      },
    ]);
  });

  it('navigates to /videos/{id} and does not show login-required alert when guest clicks first card', async () => {
    render(<VideosPage />);

    const title = await screen.findByText('게스트 E2E 목록 영상');
    fireEvent.click(title);

    expect(pushMock).toHaveBeenCalledWith('/videos/v-1');
    expect(window.alert).not.toHaveBeenCalled();
  });
});
