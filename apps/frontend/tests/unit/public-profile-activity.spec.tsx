import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommunityProfileModal } from '../../src/components/community-profile-modal';
import { FriendProfileWindow } from '../../src/components/friend-profile-window';
import { PublicProfileActivity } from '../../src/components/public-profile-activity';
import { getCommunityProfile, getPublicProfileActivity } from '../../src/lib/api';
import type { CommunityProfileDetailResponse, PublicProfileActivity as Activity } from '../../src/lib/types';

jest.mock('../../src/lib/api', () => ({
  getCommunityProfile: jest.fn(),
  getPublicProfileActivity: jest.fn(),
  requestFriend: jest.fn(),
}));

const getProfileMock = jest.mocked(getCommunityProfile);
const getActivityMock = jest.mocked(getPublicProfileActivity);
const profileId = 'u_c24a9d5c-f832-4424-a5c7-953cb46cb7ed';
const profile: CommunityProfileDetailResponse = {
  profile: {
    id: profileId,
    name: '민지',
    role: 'student',
    school: 'U_ 학교',
    grade: '3',
    bio: `${profileId} 님의 프로필입니다.`,
    avatar: '민',
    subjects: ['수학'],
    relationship: 'friend',
    friendCount: 1,
    lastMessagePreview: '',
  },
  recentPosts: [],
  messages: [],
  canChat: true,
  pendingFriendRequestId: null,
  incomingFriendRequestId: null,
};
const activity: Activity = {
  posts: [{
    id: 'post-1', title: '함께 공부해요', authorId: profileId, authorName: '민지',
    authorAvatar: '민', authorVisibility: 'nickname', likeCount: 2, viewCount: 3,
    createdAt: '2026-11-02T10:00:00Z',
  }],
  questions: [{
    id: 'question-1', title: '수학 질문', authorId: profileId, body: '풀이가 궁금해요',
    subject: '수학', grade: '2', attachments: [], visibility: 'nickname', status: 'open',
    likeCount: 1, viewCount: 2, answerCount: 0,
    createdAt: '2026-11-02T10:00:00Z', updatedAt: '2026-11-02T10:00:00Z',
  }],
  videos: [{
    id: 'video-1', title: '수학 풀이 영상', subject: '수학', url: '/video.mp4',
    durationSeconds: 30, likeCount: 0, viewCount: 1, createdAt: '2026-11-02T10:00:00Z',
  }],
};

describe('public profile activity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getProfileMock.mockResolvedValue(profile);
    getActivityMock.mockResolvedValue(activity);
  });

  it('shows only the nickname introduction and linked activity tabs in community profiles', async () => {
    const user = userEvent.setup();
    render(<CommunityProfileModal userId={profileId} viewerId="viewer" displayName="민지" avatar="민" />);
    await user.click(screen.getByRole('button', { name: /민지/ }));
    expect(await screen.findByText('민지 님의 프로필입니다.')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(profileId, 'i'))).not.toBeInTheDocument();
    expect(screen.queryByText(/U_ 학교/)).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '함께 공부해요' }))
      .toHaveAttribute('href', '/community/posts/post-1');
    expect(screen.getByRole('tab', { name: /커뮤니티 글/ })).toHaveTextContent('1');
    expect(screen.getByLabelText('좋아요 2개')).toHaveTextContent('\u2661');
    expect(screen.getByLabelText('조회 3회')).toHaveTextContent('\u{1F441}\uFE0E');
    await user.click(screen.getByRole('tab', { name: /질문/ }));
    expect(screen.getByRole('link', { name: '수학 질문' })).toHaveAttribute('href', '/questions/question-1');
    expect(screen.getByLabelText('좋아요 1개')).toHaveTextContent('\u2661');
    expect(screen.getByLabelText('조회 2회')).toHaveTextContent('\u{1F441}\uFE0E');
    await user.click(screen.getByRole('tab', { name: /영상/ }));
    expect(screen.getByRole('link', { name: '수학 풀이 영상' })).toHaveAttribute('href', '/videos/video-1');
    expect(screen.getByLabelText('좋아요 0개')).toHaveTextContent('\u2661');
    expect(screen.getByLabelText('조회 1회')).toHaveTextContent('\u{1F441}\uFE0E');
    expect(getActivityMock).toHaveBeenCalledWith(profileId, 'viewer');
  });

  it('uses the same activity tabs in friend profiles without removing chat actions', async () => {
    const user = userEvent.setup();
    const startChat = jest.fn();
    render(
      <FriendProfileWindow open profile={profile} viewerId="viewer" onClose={jest.fn()} onStartChat={startChat} />,
    );
    expect(screen.getByText('민지 님의 프로필입니다.')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(profileId, 'i'))).not.toBeInTheDocument();
    expect(screen.queryByText(/U_ 학교/)).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '함께 공부해요' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '1대1채팅하기' }));
    expect(startChat).toHaveBeenCalledTimes(1);
  });

  it('shows empty states and zero counts without inventing activity', async () => {
    getActivityMock.mockResolvedValue({ posts: [], questions: [], videos: [] });
    const user = userEvent.setup();
    render(<PublicProfileActivity profileId={profileId} viewerId="viewer" />);
    expect(await screen.findByText('공개한 커뮤니티 글이 없습니다.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /질문/ }));
    expect(screen.getByText('공개한 질문이 없습니다.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /영상/ }));
    expect(screen.getByText('올린 영상이 없습니다.')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').every((tab) => tab.textContent?.endsWith('0'))).toBe(true);
  });

  it('shows loading and errors, and reloads activity when retried', async () => {
    getActivityMock.mockRejectedValueOnce(new Error('활동 연결 실패'));
    const user = userEvent.setup();
    render(<PublicProfileActivity profileId={profileId} viewerId="viewer" />);
    expect(screen.getByRole('status')).toHaveTextContent('활동 내역을 불러오는 중입니다');
    expect(await screen.findByRole('alert')).toHaveTextContent('활동 연결 실패');
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('link', { name: '함께 공부해요' })).toBeInTheDocument();
  });

  it('does not retain another profile activity after the profile changes', async () => {
    const { rerender } = render(<PublicProfileActivity profileId={profileId} viewerId="viewer" />);
    expect(await screen.findByRole('link', { name: '함께 공부해요' })).toBeInTheDocument();
    getActivityMock.mockResolvedValue({ posts: [], questions: [], videos: [] });
    rerender(<PublicProfileActivity profileId="other-profile" viewerId="viewer" />);
    await waitFor(() => expect(getActivityMock).toHaveBeenLastCalledWith('other-profile', 'viewer'));
    expect(await screen.findByText('공개한 커뮤니티 글이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '함께 공부해요' })).not.toBeInTheDocument();
  });
});
