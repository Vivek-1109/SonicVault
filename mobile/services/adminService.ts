import { api } from './api';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { getAccessTokenCache } from './api';
import { refreshTokens } from './authService';
import { config } from '../constants/config';
import type { Song, StorageStats } from '../types';

async function getUploadAccessToken(): Promise<string> {
  const cached = getAccessTokenCache();
  if (cached) return cached;

  const stored = await SecureStore.getItemAsync('sv_access_token');
  if (stored) return stored;

  const refreshed = await refreshTokens();
  return refreshed.accessToken;
}

function parseErrorMessage(body?: string | null): string {
  if (!body) return 'Upload failed';
  try {
    const parsed = JSON.parse(body);
    return parsed.error || parsed.message || body;
  } catch {
    return body;
  }
}

function parseSongResponse(body?: string | null): Song {
  if (!body) throw new Error('Upload succeeded but returned no song data');
  const parsed = JSON.parse(body);
  return parsed.song || parsed;
}

export const adminService = {
  getStats: async (): Promise<StorageStats> => {
    const res = await api.get('/api/admin/storage');
    const raw = res.data;
    // Backend returns: { totalSongs, totalSizeBytes, totalPlaylists, totalFavorites }
    // Map to mobile StorageStats type: { songs: {count, size}, playlists: {count}, dbSize, totalSize }
    return {
      songs: { count: raw.totalSongs ?? 0, size: raw.totalSizeBytes ?? 0 },
      playlists: { count: raw.totalPlaylists ?? 0 },
      dbSize: 0,
      totalSize: raw.totalSizeBytes ?? 0,
    };
  },

  syncMetadata: async (): Promise<{ message: string; results?: any }> => {
    // Backend doesn't have a dedicated sync endpoint; just refresh stats
    const res = await api.get('/api/admin/storage');
    return { message: `Sync complete. ${res.data.totalSongs ?? 0} songs in library.` };
  },

  uploadSong: async (
    fileUri: string,
    filename: string,
    mimeType: string,
    onProgress?: (progress: number) => void
  ): Promise<Song> => {
    async function uploadOnce(token: string): Promise<FileSystem.FileSystemUploadResult | undefined | null> {
      let finalUri = fileUri;
      let needsCleanup = false;

      // Ensure it's a file:// URI to prevent Java IOExceptions with expo-file-system multipart upload
      if (fileUri.startsWith('content://')) {
        const tempUri = `${FileSystem.cacheDirectory}${Date.now()}_upload_temp`;
        await FileSystem.copyAsync({ from: fileUri, to: tempUri });
        finalUri = tempUri;
        needsCleanup = true;
      }

      try {
        const parameters: Record<string, string> = {};
        if (filename) parameters.filename = filename;
        if (mimeType) parameters.mimeType = mimeType;

        const uploadTask = FileSystem.createUploadTask(
          `${config.API_BASE_URL}/api/admin/songs/upload`,
          finalUri,
          {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'file',
            mimeType,
            parameters,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          (data) => {
            if (!onProgress) return;
            const expected = data.totalBytesExpectedToSend || 0;
            const progress = expected > 0 ? data.totalBytesSent / expected : 0;
            onProgress(Math.max(0, Math.min(progress, 1)));
          }
        );

        return await uploadTask.uploadAsync();
      } finally {
        if (needsCleanup) {
          await FileSystem.deleteAsync(finalUri, { idempotent: true });
        }
      }
    }

    let token = await getUploadAccessToken();
    let response = await uploadOnce(token);

    if (response?.status === 401) {
      const refreshed = await refreshTokens();
      token = refreshed.accessToken;
      response = await uploadOnce(token);
    }

    if (!response || response.status < 200 || response.status >= 300) {
      throw new Error(parseErrorMessage(response?.body));
    }

    return parseSongResponse(response.body);
  },

  deleteSong: async (id: string): Promise<void> => {
    await api.delete(`/api/admin/songs/${id}`);
  },
};
