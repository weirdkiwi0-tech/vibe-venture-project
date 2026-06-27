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

  it('returns guest policy boundary behavior at 49.9, 50, and 50.1', async () => {
    const service = new VideosService(new InMemoryVideoRepository());
    const video = await service.create({
      title: 'gating test',
      url: 'https://stream.test/gating',
      durationSeconds: 100,
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

  it('returns member policy with full playback regardless of boundary positions', async () => {
    const service = new VideosService(new InMemoryVideoRepository());
    const video = await service.create({
      title: 'member-gating test',
      url: 'https://stream.test/member-gating',
      durationSeconds: 100,
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
});
