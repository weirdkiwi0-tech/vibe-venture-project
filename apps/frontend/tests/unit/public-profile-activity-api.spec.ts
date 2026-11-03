import { getPublicProfileActivity } from '../../src/lib/api';
import type { CommunityPostSummary, QuestionItem } from '../../src/lib/types';

const originalFetch = global.fetch;
const fetchMock = jest.fn();
const post: CommunityPostSummary = {
  id: 'post-new',
  title: '공개 커뮤니티 글',
  authorId: 'target-user',
  authorName: '민지',
  authorAvatar: '민',
  authorVisibility: 'nickname',
  viewCount: 2,
  likeCount: 1,
  createdAt: '2026-11-02T10:00:00Z',
};
const question: QuestionItem = {
  id: 'question-public',
  authorId: 'target-user',
  title: '공개 질문',
  body: '질문 내용',
  subject: '수학',
  grade: '2',
  attachments: [],
  visibility: 'nickname',
  status: 'open',
  viewCount: 1,
  likeCount: 0,
  answerCount: 0,
  createdAt: '2026-11-02T10:00:00Z',
  updatedAt: '2026-11-02T10:00:00Z',
};

describe('public profile activity API', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      let body;
      if (url.pathname === '/community') {
        body = {
          posts: url.searchParams.get('page') === '2'
            ? [{ ...post, id: 'post-old', createdAt: '2026-11-01T10:00:00Z' }]
            : [
              post,
              { ...post, id: 'post-anonymous', authorVisibility: 'anonymous' },
              { ...post, id: 'post-other', authorId: 'other-user' },
            ],
          totalPages: 2,
          friends: [],
        };
      } else if (url.pathname === '/questions/all') {
        body = [
          question,
          { ...question, id: 'question-anonymous', visibility: 'anonymous' },
          { ...question, id: 'question-other', authorId: 'other-user' },
        ];
      } else if (url.pathname === '/videos/mine') {
        body = [
          { id: 'video-old', title: '이전 영상', createdAt: '2026-11-01T10:00:00Z' },
          { id: 'video-new', title: '새 영상', createdAt: '2026-11-02T10:00:00Z' },
        ];
      } else {
        throw new Error(`Unexpected request: ${url.pathname}`);
      }
      return { ok: true, json: async () => body };
    });
  });

  afterEach(() => { global.fetch = originalFetch; });

  it('collects all community pages, filters anonymous and other-user content, and sorts newest first', async () => {
    const activity = await getPublicProfileActivity('target-user', 'viewer-user');
    expect(activity.posts.map((item) => item.id)).toEqual(['post-new', 'post-old']);
    expect(activity.questions.map((item) => item.id)).toEqual(['question-public']);
    expect(activity.videos.map((item) => item.id)).toEqual(['video-new', 'video-old']);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/community?page=2'),
      expect.objectContaining({ headers: { 'x-user-id': 'viewer-user' }, credentials: 'include' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/videos/mine'),
      expect.objectContaining({ headers: { 'x-user-id': 'target-user' } }),
    );
  });

  it('surfaces API failures instead of returning empty activity', async () => {
    fetchMock.mockRejectedValueOnce(new Error('활동 API 연결 실패'));
    await expect(getPublicProfileActivity('target-user', 'viewer-user'))
      .rejects.toThrow('활동 API 연결 실패');
  });
});
