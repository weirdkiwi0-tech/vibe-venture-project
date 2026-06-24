import { render, screen } from '@testing-library/react';
import VideoDetailPage from '../../src/app/videos/[id]/page';

const pushMock = jest.fn();
const refreshMock = jest.fn();
const replaceMock = jest.fn();
const getVideoByIdMock = jest.fn();
const getVideoCommentsMock = jest.fn();
const trackVideoViewMock = jest.fn();

const mockedCommunityProfileModal = jest.fn(
  ({ displayName }: { displayName: string }) => <div>{displayName}</div>,
);

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'video-1' }),
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
    authUser: {
      id: 'student-jun',
      email: 'student-jun@example.com',
      displayName: '준',
      role: 'user',
    },
  }),
}));

jest.mock('../../src/components/community-profile-modal', () => ({
  CommunityProfileModal: (props: { displayName: string }) => mockedCommunityProfileModal(props),
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

describe('video comment visibility e2e', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    replaceMock.mockReset();
    getVideoByIdMock.mockReset();
    getVideoCommentsMock.mockReset();
    trackVideoViewMock.mockReset();
    mockedCommunityProfileModal.mockClear();

    getVideoByIdMock.mockResolvedValue({
      id: 'video-1',
      title: '테스트 영상',
      subject: 'MATH',
      url: 'https://stream.test/video-1',
      durationSeconds: 120,
      likeCount: 0,
      viewCount: 0,
      createdAt: '2026-06-24T00:00:00.000Z',
    });
    getVideoCommentsMock.mockResolvedValue([
      {
        id: 'comment-anonymous',
        videoId: 'video-1',
        authorId: 'user-1',
        authorVisibility: 'anonymous',
        authorName: '익명',
        authorAvatar: '익',
        content: '익명 댓글',
        createdAt: '2026-06-24T00:00:00.000Z',
        likeCount: 0,
      },
      {
        id: 'comment-nickname',
        videoId: 'video-1',
        authorId: 'user-2',
        authorVisibility: 'nickname',
        authorName: '민지',
        authorAvatar: '민',
        authorPhotoUrl: 'https://example.com/mz.png',
        content: '닉네임 댓글',
        createdAt: '2026-06-24T00:00:01.000Z',
        likeCount: 0,
      },
    ]);
    trackVideoViewMock.mockResolvedValue({ viewCount: 1, likeCount: 0 });
  });

  it('renders anonymous comment as badge and nickname comment as profile modal chip', async () => {
    render(<VideoDetailPage />);

    expect(await screen.findByText('익명 댓글')).toBeInTheDocument();
    expect(await screen.findByText('닉네임 댓글')).toBeInTheDocument();

    expect(screen.getByLabelText('익명 댓글 작성자')).toBeInTheDocument();
    expect(screen.getByText('익명')).toBeInTheDocument();

    expect(screen.getByText('민지')).toBeInTheDocument();
    expect(mockedCommunityProfileModal).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: '민지' }),
    );
    expect(mockedCommunityProfileModal).not.toHaveBeenCalledWith(
      expect.objectContaining({ displayName: '익명' }),
    );
  });
});
