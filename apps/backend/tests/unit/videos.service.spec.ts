import { NotFoundException } from '@nestjs/common';
import { AuthService } from '../../src/auth';
import { VideoEntity } from '../../src/videos/entities/video.entity';
import { InMemoryVideoRepository } from '../../src/videos/in-memory-video.repository';
import { VideosService } from '../../src/videos/videos.service';

describe('VideosService (unit)', () => {
  let repo: InMemoryVideoRepository;
  let service: VideosService;

  beforeEach(() => {
    repo = new InMemoryVideoRepository();
    service = new VideosService(repo);
  });

  it('returns all videos when count is below 50 (fallback)', async () => {
    await repo.save(
      VideoEntity.create({
        id: 'v-1',
        uploaderId: 'u-1',
        title: 'older',
        url: 'https://stream.test/older',
        durationSeconds: 100,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );
    await repo.save(
      VideoEntity.create({
        id: 'v-2',
        uploaderId: 'u-1',
        title: 'newer',
        url: 'https://stream.test/newer',
        durationSeconds: 100,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    );

    const list = await service.listHomeTopVideos();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('v-2');
  });

  it('returns only top 10 when count is 50 or more', async () => {
    for (let i = 0; i < 55; i += 1) {
      await repo.save(
        VideoEntity.create({
          id: `v-${i}`,
          uploaderId: 'u-1',
          title: `video-${i}`,
          url: `https://stream.test/${i}`,
          durationSeconds: 90,
          createdAt: new Date(1700000000000 + i * 1000),
        }),
      );
    }

    const list = await service.listHomeTopVideos();
    expect(list).toHaveLength(10);
  });

  it('returns all videos when count is below 50 even if more than 3', async () => {
    for (let i = 0; i < 4; i += 1) {
      await repo.save(
        VideoEntity.create({
          id: `small-${i}`,
          uploaderId: 'u-1',
          title: `small-video-${i}`,
          url: `https://stream.test/small-${i}`,
          durationSeconds: 90,
          createdAt: new Date(1701000000000 + i * 1000),
        }),
      );
    }

    const list = await service.listHomeTopVideos();
    expect(list).toHaveLength(4);
  });

  it('applies guest playback boundary policy at 49.9, 50, and 50.1', async () => {
    const video = await service.create({
      title: 'guest gate',
      url: 'https://stream.test/gate',
      durationSeconds: 180,
    });

    const at49_9 = await service.getPlaybackPolicy(video.id, 'guest', 49.9);
    const at50 = await service.getPlaybackPolicy(video.id, 'guest', 50);
    const at50_1 = await service.getPlaybackPolicy(video.id, 'guest', 50.1);

    expect(at49_9).toMatchObject({
      canPlay: true,
      action: 'none',
      stopAtPercent: 50,
    });
    expect(at50).toMatchObject({
      canPlay: false,
      action: 'login_required',
      stopAtPercent: 50,
    });
    expect(at50_1).toMatchObject({
      canPlay: false,
      action: 'login_required',
      stopAtPercent: 50,
    });
  });

  it('always allows member playback with full access policy', async () => {
    const video = await service.create({
      title: 'member policy',
      url: 'https://stream.test/member-policy',
      durationSeconds: 180,
    });

    const at49_9 = await service.getPlaybackPolicy(video.id, 'member', 49.9);
    const at50 = await service.getPlaybackPolicy(video.id, 'member', 50);
    const at50_1 = await service.getPlaybackPolicy(video.id, 'member', 50.1);

    expect(at49_9).toMatchObject({
      canPlay: true,
      action: 'none',
      stopAtPercent: 100,
    });
    expect(at50).toMatchObject({
      canPlay: true,
      action: 'none',
      stopAtPercent: 100,
    });
    expect(at50_1).toMatchObject({
      canPlay: true,
      action: 'none',
      stopAtPercent: 100,
    });
  });

  it('throws when video does not exist', async () => {
    await expect(service.getPlaybackPolicy('missing', 'guest', 10)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('increases viewCount when viewer is not authenticated', async () => {
    const created = await service.create({
      title: 'view guard',
      url: 'https://stream.test/view-guard',
      durationSeconds: 180,
    });

    const viewed = await service.incrementView(created.id);
    expect(viewed.viewCount).toBe(1);
  });

  it('increases viewCount when viewer is a registered user', async () => {
    const authServiceMock = {
      getUserById: (id: string) => (id === 'registered-user' ? { id } : undefined),
    } as unknown as AuthService;
    const localService = new VideosService(repo, authServiceMock);

    const created = await localService.create({
      title: 'member view',
      url: 'https://stream.test/member-view',
      durationSeconds: 180,
    });

    const viewed = await localService.incrementView(created.id, 'registered-user');
    expect(viewed.viewCount).toBe(1);
  });

  it('createComment - nickname 모드: AuthService.getUserById displayName을 authorName에 반영', async () => {
    const authServiceMock = {
      getUserById: jest.fn().mockResolvedValue({ id: 'user-1', displayName: '댓글작성자', photoUrl: '/a.png' }),
    } as unknown as AuthService;
    const localService = new VideosService(repo, authServiceMock);

    const video = await localService.create({
      title: 'comment video',
      url: 'https://stream.test/comment-video',
      durationSeconds: 180,
    });

    const comment = await localService.createComment(
      video.id,
      { content: '테스트 댓글', authorVisibility: 'nickname' },
      'user-1',
    );

    expect(comment.authorName).toBe('댓글작성자');
    expect(comment.authorAvatar).toBe('댓');
  });

  it('createComment - anonymous 모드: authorName 익명, authorAvatar 익', async () => {
    const video = await service.create({
      title: 'anon comment video',
      url: 'https://stream.test/anon-comment',
      durationSeconds: 180,
    });

    const comment = await service.createComment(
      video.id,
      { content: '익명 댓글', authorVisibility: 'anonymous' },
      'any-user',
    );

    expect(comment.authorName).toBe('익명');
    expect(comment.authorAvatar).toBe('익');
    expect(comment.authorPhotoUrl).toBeUndefined();
  });
});
