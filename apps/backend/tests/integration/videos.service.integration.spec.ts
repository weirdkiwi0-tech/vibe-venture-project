import { VideosService } from '../../src/videos/videos.service';
import { InMemoryVideoRepository } from '../../src/videos/in-memory-video.repository';

describe('VideosService + Repository (integration)', () => {
  it('creates videos and applies fallback list rule', async () => {
    const service = new VideosService(new InMemoryVideoRepository());

    await service.create({
      title: 'v1',
      url: 'https://stream.test/v1',
      durationSeconds: 120,
    });
    await service.create({
      title: 'v2',
      url: 'https://stream.test/v2',
      durationSeconds: 140,
    });

    const list = await service.listHomeTopVideos();
    expect(list).toHaveLength(2);
  });

  it('returns guest policy with login requirement at 50 percent', async () => {
    const service = new VideosService(new InMemoryVideoRepository());
    const video = await service.create({
      title: 'gating test',
      url: 'https://stream.test/gating',
      durationSeconds: 100,
    });

    const policy = await service.getPlaybackPolicy(video.id, 'guest', 60);
    expect(policy.canPlay).toBe(false);
    expect(policy.stopAtPercent).toBe(50);
    expect(policy.action).toBe('login_required');
  });
});
