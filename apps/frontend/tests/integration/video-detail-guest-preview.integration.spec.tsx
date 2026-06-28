import { fireEvent, render, screen } from '@testing-library/react';
import VideoDetailPage from '../../src/app/videos/[id]/page';

const pushMock = jest.fn();
const refreshMock = jest.fn();
const replaceMock = jest.fn();
const getVideoByIdMock = jest.fn();
const getVideoCommentsMock = jest.fn();
const trackVideoViewMock = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'video-guest-1' }),
  useRouter: () => ({ push: pushMock, refresh: refreshMock, replace: replaceMock }),
}));

jest.mock('../../src/components/section-card', () => ({
  SectionCard: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

jest.mock('../../src/components/site-shell', () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('../../src/components/role-provider', () => ({
  useAuthUser: () => ({
    authResolved: true,
    authUser: null,
  }),
}));

jest.mock('../../src/components/community-profile-modal', () => ({
  CommunityProfileModal: () => <div>profile-modal</div>,
}));

jest.mock('../../src/lib/report-links', () => ({
  createReportLink: () => '/reports/new',
}));

jest.mock('../../src/lib/community-preferences', () => ({
  useCommunityPreferences: () => ({
    preferences: {
      pushNotifications: true,
      communityOnlyMode: false,
      profileVisibility: 'public',
      communityAuthorVisibility: 'nickname',
    },
  }),
}));

jest.mock('../../src/lib/api', () => ({
  createVideoComment: jest.fn(),
  deleteVideo: jest.fn(),
  getVideoById: (...args: unknown[]) => getVideoByIdMock(...args),
  getVideoComments: (...args: unknown[]) => getVideoCommentsMock(...args),
  likeVideoComment: jest.fn(),
  likeVideo: jest.fn(),
  trackVideoView: (...args: unknown[]) => trackVideoViewMock(...args),
}));

describe('video detail guest 50 percent preview (integration)', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    replaceMock.mockReset();
    getVideoByIdMock.mockReset();
    getVideoCommentsMock.mockReset();
    trackVideoViewMock.mockReset();

    window.alert = jest.fn();

    getVideoByIdMock.mockResolvedValue({
      id: 'video-guest-1',
      title: '게스트 미리보기 영상',
      subject: 'MATH',
      url: 'https://stream.test/video-guest-1',
      durationSeconds: 120,
      likeCount: 0,
      viewCount: 0,
      createdAt: '2026-06-28T00:00:00.000Z',
    });
    getVideoCommentsMock.mockResolvedValue([]);
    trackVideoViewMock.mockResolvedValue({ viewCount: 1, likeCount: 0 });
  });

  it('does not call router.replace(/profile) at initial guest render', async () => {
    render(<VideoDetailPage />);

    await screen.findByText('풀이영상 크게 보기');
    expect(replaceMock).not.toHaveBeenCalledWith('/profile');
  });

  it('shows login signup overlay when guest playback reaches 50 percent', async () => {
    const { container } = render(<VideoDetailPage />);

    await screen.findByText('풀이영상 크게 보기');

    const video = container.querySelector('video') as HTMLVideoElement | null;
    expect(video).not.toBeNull();

    if (!video) {
      return;
    }

    Object.defineProperty(video, 'duration', { value: 120, configurable: true });
    Object.defineProperty(video, 'currentTime', { value: 60, configurable: true });

    fireEvent(video, new Event('timeupdate'));

    expect(await screen.findByText('50% 미리보기 종료')).toBeInTheDocument();
    expect(await screen.findByText('로그인 또는 회원가입 후 전체 시청이 가능합니다.')).toBeInTheDocument();
  });
});
