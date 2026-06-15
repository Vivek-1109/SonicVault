import { create } from 'zustand';
import { getItem, setItem, KEYS } from '../utils/storage';
import type { DownloadState, DownloadActions, DownloadInfo, DownloadStatus } from '../types';

type DownloadStore = DownloadState & DownloadActions;

export const useDownloadStore = create<DownloadStore>((set, get) => {
  // Hydrate download metadata from AsyncStorage on store creation
  getItem<Record<string, DownloadInfo>>(KEYS.DOWNLOADS_META).then((data) => {
    if (data) {
      // Reset any in-progress downloads to 'queued' (app was killed mid-download)
      const cleaned: Record<string, DownloadInfo> = {};
      for (const [id, info] of Object.entries(data)) {
        if (info.status === 'downloading') {
          cleaned[id] = { ...info, status: 'queued', progress: 0 };
        } else {
          cleaned[id] = info;
        }
      }
      set({ downloads: cleaned });
    }
  });

  function persist() {
    const { downloads } = get();
    setItem(KEYS.DOWNLOADS_META, downloads);
  }

  return {
    // State
    downloads: {},

    // Actions
    queueDownload: (songId: string, fileSize: number, songTitle: string = 'Unknown', songArtist: string = 'Unknown', artworkUrl: string | null = null, duration: number = 0) => {
      set((state) => ({
        downloads: {
          ...state.downloads,
          [songId]: {
            songId,
            songTitle,
            songArtist,
            artworkUrl,
            duration,
            status: 'queued' as DownloadStatus,
            progress: 0,
            localUri: null,
            fileSize,
            downloadedAt: null,
            error: null,
          },
        },
      }));
      persist();
    },

    updateProgress: (songId: string, progress: number) => {
      set((state) => {
        const existing = state.downloads[songId];
        if (!existing) return state;
        return {
          downloads: {
            ...state.downloads,
            [songId]: {
              ...existing,
              status: 'downloading' as DownloadStatus,
              progress: Math.min(Math.max(progress, 0), 1),
            },
          },
        };
      });
      // Don't persist on every progress update to avoid I/O thrashing
    },

    completeDownload: (songId: string, localUri: string) => {
      set((state) => {
        const existing = state.downloads[songId];
        if (!existing) return state;
        return {
          downloads: {
            ...state.downloads,
            [songId]: {
              ...existing,
              status: 'completed' as DownloadStatus,
              progress: 1,
              localUri,
              downloadedAt: new Date().toISOString(),
              error: null,
            },
          },
        };
      });
      persist();
    },

    failDownload: (songId: string, error: string) => {
      set((state) => {
        const existing = state.downloads[songId];
        if (!existing) return state;
        return {
          downloads: {
            ...state.downloads,
            [songId]: {
              ...existing,
              status: 'failed' as DownloadStatus,
              error,
            },
          },
        };
      });
      persist();
    },

    removeDownload: (songId: string) => {
      set((state) => {
        const { [songId]: _removed, ...rest } = state.downloads;
        return { downloads: rest };
      });
      persist();
    },

    removeAllDownloads: () => {
      set({ downloads: {} });
      persist();
    },

    isDownloaded: (songId: string): boolean => {
      const info = get().downloads[songId];
      return info?.status === 'completed' && info.localUri !== null;
    },

    getLocalUri: (songId: string): string | null => {
      const info = get().downloads[songId];
      if (info?.status === 'completed') {
        return info.localUri;
      }
      return null;
    },

    getTotalSize: (): number => {
      const { downloads } = get();
      return Object.values(downloads)
        .filter((d) => d.status === 'completed')
        .reduce((total, d) => total + d.fileSize, 0);
    },
  };
});
