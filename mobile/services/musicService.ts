import api from './api';
import type { StreamUrlResponse, DownloadUrlResponse } from '../types';

export async function getStreamUrl(songId: string): Promise<StreamUrlResponse> {
  const { data } = await api.get<StreamUrlResponse>(`/api/songs/${songId}/stream-url`);
  return data;
}

export async function getDownloadUrl(songId: string): Promise<DownloadUrlResponse> {
  const { data } = await api.get<DownloadUrlResponse>(`/api/songs/${songId}/download-url`);
  return data;
}

export function recordPlay(songId: string): void {
  // Fire-and-forget: don't await, don't throw on failure
  api.post('/api/recently-played', { songId }).catch(() => {});
}

export async function toggleFavorite(
  songId: string,
  isFavorite: boolean
): Promise<void> {
  if (isFavorite) {
    await api.delete(`/api/favorites/${songId}`);
  } else {
    await api.post(`/api/favorites/${songId}`);
  }
}

export async function getCoverArtUrl(r2Key: string): Promise<string> {
  const { data } = await api.get<{ url: string }>(`/api/cover-art/${encodeURIComponent(r2Key)}`);
  return data.url;
}
