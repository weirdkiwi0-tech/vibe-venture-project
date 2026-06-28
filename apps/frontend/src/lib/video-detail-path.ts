import type { Route } from 'next';

export function buildVideoDetailPath(id: string): Route {
  const trimmedId = id.trim();
  if (!trimmedId) {
    return '/videos' as Route;
  }

  return `/videos/${encodeURIComponent(trimmedId)}` as Route;
}

export const toVideoDetailPath = buildVideoDetailPath;