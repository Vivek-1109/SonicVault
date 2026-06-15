import * as FileSystem from 'expo-file-system/legacy';
import { getInfoAsync } from 'expo-file-system/legacy';
import { api } from './api';
import { useDownloadStore } from '../stores/downloadStore';
import type { Song } from '../types';

export class DownloadService {
  private static getDownloadDirectory(): string {
    return `${FileSystem.documentDirectory}sonicvault_downloads/`;
  }

  public static async init(): Promise<void> {
    const dir = this.getDownloadDirectory();
    const info = await getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }

  public static async downloadSong(song: Song): Promise<void> {
    const store = useDownloadStore.getState();
    
    // Guard against duplicate downloads
    if (store.isDownloaded(song.id)) return;

    try {
      await this.init();
      useDownloadStore.getState().queueDownload(song.id, song.fileSize ?? 0, song.title, song.artist, song.artworkUrl, song.duration ?? 0);

      // 1. Get pre-signed download URL from backend
      const res = await api.get(`/api/songs/${song.id}/download-url`);
      const { url } = res.data;

      // 2. Determine local path
      // Clean filename for file system
      const safeTitle = song.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const extension = 'mp3'; // Currently assuming all are MP3s based on backend design
      const localUri = `${this.getDownloadDirectory()}${song.id}_${safeTitle}.${extension}`;

      // 3. Start download
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        localUri,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          store.updateProgress(song.id, progress);
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (result && result.status === 200) {
        store.completeDownload(song.id, result.uri);
      } else {
        throw new Error(`Download failed with status ${result?.status}`);
      }
    } catch (error: any) {
      console.error('Download error:', error);
      store.failDownload(song.id, error.message || 'Download failed');
    }
  }

  public static async removeSong(songId: string): Promise<void> {
    const store = useDownloadStore.getState();
    const localUri = store.getLocalUri(songId);

    if (localUri) {
      try {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      } catch (e) {
        console.error('Failed to delete file:', e);
      }
    }
    
    store.removeDownload(songId);
  }

  public static async clearAll(): Promise<void> {
    const store = useDownloadStore.getState();
    const dir = this.getDownloadDirectory();
    
    try {
      await FileSystem.deleteAsync(dir, { idempotent: true });
      await this.init(); // Recreate empty directory
    } catch (e) {
      console.error('Failed to clear downloads directory:', e);
    }

    store.removeAllDownloads();
  }
}
