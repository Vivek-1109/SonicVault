// ─── Core Data Models ───────────────────────────────────────────────

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  trackNumber: number | null;
  duration: number; // seconds
  fileSize: number; // bytes
  r2ObjectKey: string;
  artworkUrl: string | null;
  needsReview: number;
  checksum: string | null;
  createdAt: string;
  updatedAt: string;
  // Local-only fields
  localUri?: string;
}

export interface LocalAudioAsset {
  id: string;
  uri: string;
  filename: string;
  mimeType?: string;
  duration?: number;
  size?: number;
  albumId?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  coverArtR2Key: string | null;
  songCount: number;
  totalDuration: number;
  createdAt: string;
  updatedAt: string;
  songs?: PlaylistSong[];
}

export interface PlaylistSong {
  songId: string;
  position: number;
  addedAt: string;
  song?: Song;
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  year: number | null;
  coverArtR2Key: string | null;
  songCount: number;
  totalDuration: number;
  songs?: Song[];
}

export interface Artist {
  name: string;
  songCount: number;
  albumCount: number;
  albums?: Album[];
}

export interface Device {
  id: string;
  userId: string;
  deviceName: string;
  lastSeen: string;
  createdAt: string;
}

// ─── API Response Types ─────────────────────────────────────────────

export interface SyncResponse {
  songs: Song[];
  playlists: Playlist[];
  favorites: string[]; // song IDs
  deletedSongIds: string[];     // backend sends these directly
  deletedPlaylistIds: string[]; // backend sends these directly
  serverTimestamp: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
}

export interface StreamUrlResponse {
  url: string;
  expiresAt: string;
}

export interface DownloadUrlResponse {
  url: string;
  expiresAt: string;
  filename: string;
  fileSize: number;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// ─── Auth State ─────────────────────────────────────────────────────

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricsEnabled: boolean;
  deviceId: string | null;
  userEmail: string | null;
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  setBiometrics: (enabled: boolean) => Promise<void>;
  initialize: () => Promise<void>;
}

// ─── Player State ───────────────────────────────────────────────────

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  currentSong: Song | null;
  queue: Song[];
  originalQueue: Song[]; // pre-shuffle order
  currentIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  positionMs: number;
  durationMs: number;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  volume: number;
  seekCommand: number | null;
}

export interface PlayerActions {
  playSong: (song: Song, queue?: Song[], startIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  seekTo: (positionMs: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  removeSongFromLibrary: (songId: string) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsBuffering: (buffering: boolean) => void;
  setPosition: (positionMs: number) => void;
  setDuration: (durationMs: number) => void;
  clearSeekCommand: () => void;
}

// ─── Download State ─────────────────────────────────────────────────

export type DownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed';

export interface DownloadInfo {
  songId: string;
  songTitle: string;
  songArtist: string;
  artworkUrl: string | null;
  duration: number;
  status: DownloadStatus;
  progress: number; // 0-1
  localUri: string | null;
  fileSize: number;
  downloadedAt: string | null;
  error: string | null;
}

export interface StorageStats {
  songs: { count: number; size: number };
  playlists: { count: number };
  dbSize: number;
  totalSize: number;
}

export interface DownloadState {
  downloads: Record<string, DownloadInfo>;
}

export interface DownloadActions {
  queueDownload: (songId: string, fileSize: number, songTitle?: string, songArtist?: string, artworkUrl?: string | null, duration?: number) => void;
  updateProgress: (songId: string, progress: number) => void;
  completeDownload: (songId: string, localUri: string) => void;
  failDownload: (songId: string, error: string) => void;
  removeDownload: (songId: string) => void;
  removeAllDownloads: () => void;
  isDownloaded: (songId: string) => boolean;
  getLocalUri: (songId: string) => string | null;
  getTotalSize: () => number;
}

// ─── Navigation Types ───────────────────────────────────────────────

export type RootStackParamList = {
  '(tabs)': undefined;
  'login': undefined;
  'player': undefined;
  'album/[name]': { name: string };
  'artist/[name]': { name: string };
  'playlist/[id]': { id: string };
  'search': undefined;
  'downloads': undefined;
  'settings': undefined;
};

export type TabParamList = {
  index: undefined;
  library: undefined;
  playlists: undefined;
  settings: undefined;
};
