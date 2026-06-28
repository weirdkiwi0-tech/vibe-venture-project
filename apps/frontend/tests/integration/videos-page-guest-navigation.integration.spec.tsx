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

describe('VideosPage guest click navigation (integration)', () => {
  beforeEach(() => {
    pushMock.mockReset();
    getFilteredVideosMock.mockReset();

    window.alert = jest.fn();

    getFilteredVideosMock.mockResolvedValue([
      {
        id: 'v-1',
        title: '게스트 목록 영상',
        subject: '수학',
        url: 'https://stream.test/v-1',
        durationSeconds: 90,
        likeCount: 2,
        viewCount: 10,
        createdAt: '2026-06-28T00:00:00.000Z',
      },
    ]);
  });

  it('pushes /videos/{id} and does not push /profile when guest clicks a video card', async () => {
    render(<VideosPage />);

    const title = await screen.findByText('게스트 목록 영상');
    fireEvent.click(title);

    expect(pushMock).toHaveBeenCalledWith('/videos/v-1');
    expect(pushMock).not.toHaveBeenCalledWith('/profile');
  });
});
