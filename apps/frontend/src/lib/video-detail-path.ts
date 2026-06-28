export function buildVideoDetailPath(id: string): string {
  const trimmedId = id.trim();
  if (!trimmedId) {
    return '/videos';
  }

  return `/videos/${trimmedId}`;
}

export const toVideoDetailPath = buildVideoDetailPath;