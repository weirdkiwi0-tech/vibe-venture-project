export function hasReachedGuestPlaybackLimit(currentTime: number, duration: number): boolean {
  if (!Number.isFinite(duration) || duration <= 0) {
    return false;
  }

  if (!Number.isFinite(currentTime) || currentTime < 0) {
    return false;
  }

  return currentTime / duration >= 0.5;
}

// Backward-compatible alias for existing imports.
export const isGuestPlaybackLimitReached = hasReachedGuestPlaybackLimit;
