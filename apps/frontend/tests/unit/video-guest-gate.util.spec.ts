import { isGuestPlaybackLimitReached } from '../../src/lib/video-guest-gate';

describe('guest playback gate utility (unit)', () => {
  it('returns false at 59s of a 120s video', () => {
    expect(isGuestPlaybackLimitReached(59, 120)).toBe(false);
  });

  it('returns true at 60s of a 120s video', () => {
    expect(isGuestPlaybackLimitReached(60, 120)).toBe(true);
  });

  it('returns false when duration is 0', () => {
    expect(isGuestPlaybackLimitReached(1, 0)).toBe(false);
  });
});
