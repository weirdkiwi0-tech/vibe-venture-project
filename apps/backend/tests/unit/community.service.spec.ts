import { CommunityService } from '../../src/community/community.service';
import { AuthService } from '../../src/auth';

describe('CommunityService (unit)', () => {
  const createAuthServiceMock = () => ({
    getUserById: (id: string) => {
      if (id === 'author-user' || id === 'viewer-user') {
        return {
          id,
          email: `${id}@example.com`,
          displayName: id,
          role: 'user',
        };
      }
      return undefined;
    },
  }) as unknown as AuthService;

  it('does not increase post viewCount for guests and non-registered users', async () => {
    const service = new CommunityService(createAuthServiceMock());
    const created = await service.createPost(
      {
        title: 'community post',
        content: 'content',
      },
      'author-user',
    );

    const guestView = await service.getPostDetail(created.id);
    const unknownUserView = await service.getPostDetail(created.id, 'unknown-user');

    expect(guestView.viewCount).toBe(0);
    expect(unknownUserView.viewCount).toBe(0);
  });

  it('increases post viewCount for registered users', async () => {
    const service = new CommunityService(createAuthServiceMock());
    const created = await service.createPost(
      {
        title: 'community post',
        content: 'content',
      },
      'author-user',
    );

    const viewed = await service.getPostDetail(created.id, 'viewer-user');
    expect(viewed.viewCount).toBe(1);
  });
});
