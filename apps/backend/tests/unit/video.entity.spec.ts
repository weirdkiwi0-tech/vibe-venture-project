import { VideoEntity } from '../../src/videos/entities/video.entity';
import { DomainValidationError } from '../../src/videos/errors/domain-validation.error';

describe('VideoEntity (unit)', () => {
  it('creates video', () => {
    const video = VideoEntity.create({
      id: 'v-1',
      uploaderId: 'u-1',
      title: 'lecture',
      url: 'https://stream.test/v1',
      durationSeconds: 120,
    });

    expect(video.id).toBe('v-1');
    expect(video.durationSeconds).toBe(120);
  });

  it('throws when duration is invalid', () => {
    expect(() =>
      VideoEntity.create({
        id: 'v-2',
        uploaderId: 'u-1',
        title: 'lecture',
        url: 'https://stream.test/v2',
        durationSeconds: 0,
      }),
    ).toThrow(DomainValidationError);
  });
});
