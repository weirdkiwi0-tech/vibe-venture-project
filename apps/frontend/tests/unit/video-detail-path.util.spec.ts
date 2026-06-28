import { toVideoDetailPath } from '../../src/lib/video-detail-path';

describe('video detail path utility (unit)', () => {
  it("returns '/videos/v-1' when id is 'v-1'", () => {
    expect(toVideoDetailPath('v-1')).toBe('/videos/v-1');
  });

  it("returns '/videos' when id is empty", () => {
    expect(toVideoDetailPath('')).toBe('/videos');
  });
});
