import { z } from 'zod';

// ─── Database Models ────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  duration: number;
  artworkUrl: string | null;
  r2ObjectKey: string;
  fileSize: number;
  checksum: string | null;
  needsReview: number;
  trackNumber: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  artworkUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistWithCount extends Playlist {
  songCount: number;
}

export interface PlaylistWithSongs extends Playlist {
  songs: Song[];
}

export interface PlaylistSong {
  playlistId: string;
  songId: string;
  position: number;
  addedAt: string;
}

export interface Favorite {
  userId: string;
  songId: string;
  addedAt: string;
}

export interface RecentlyPlayed {
  id: number;
  userId: string;
  songId: string;
  playedAt: string;
}

export interface Device {
  id: string;
  userId: string;
  deviceName: string;
  refreshTokenHash: string;
  lastSeen: string;
  createdAt: string;
}

export interface DeletedRecord {
  id: number;
  tableName: string;
  recordId: string;
  deletedAt: string;
}

// ─── Request / Response Types ───────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  deviceId: string;
  user: { id: string; email: string };
}

export interface SyncResponse {
  songs: Song[];
  playlists: PlaylistWithCount[];
  favorites: string[];
  deletedSongIds: string[];
  deletedPlaylistIds: string[];
  serverTimestamp: string;
}

export interface StorageStats {
  totalSongs: number;
  totalSizeBytes: number;
  totalPlaylists: number;
  totalFavorites: number;
}

// ─── Express Augmentation ───────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
      };
    }
  }
}

// ─── Zod Schemas ────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  deviceName: z.string().min(1, 'Device name is required').max(100),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
  deviceId: z.string().uuid('Invalid device ID'),
});

export const logoutSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const createSongSchema = z.object({
  title: z.string().min(1).max(500),
  artist: z.string().min(1).max(500),
  album: z.string().max(500).nullable().optional(),
  genre: z.string().max(100).nullable().optional(),
  duration: z.number().int().min(0),
  artworkUrl: z.string().url().nullable().optional(),
  r2ObjectKey: z.string().min(1),
  fileSize: z.number().int().min(0),
  checksum: z.string().nullable().optional(),
  needsReview: z.number().int().min(0).max(1).optional(),
  trackNumber: z.number().int().min(0).nullable().optional(),
});

export const updateSongSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  artist: z.string().min(1).max(500).optional(),
  album: z.string().max(500).nullable().optional(),
  genre: z.string().max(100).nullable().optional(),
  duration: z.number().int().min(0).optional(),
  artworkUrl: z.string().url().nullable().optional(),
  needsReview: z.number().int().min(0).max(1).optional(),
  trackNumber: z.number().int().min(0).nullable().optional(),
});

export const createPlaylistSchema = z.object({
  name: z.string().min(1, 'Playlist name is required').max(200),
  artworkUrl: z.string().url().nullable().optional(),
});

export const updatePlaylistSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  artworkUrl: z.string().url().nullable().optional(),
});

export const addSongToPlaylistSchema = z.object({
  songId: z.string().uuid('Invalid song ID'),
});

export const reorderPlaylistSchema = z.object({
  songIds: z.array(z.string().uuid()).min(1, 'At least one song ID required'),
});

export const recordPlaySchema = z.object({
  songId: z.string().uuid('Invalid song ID'),
});

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const songIdParamSchema = z.object({
  songId: z.string().uuid('Invalid song ID format'),
});

export const playlistSongParamSchema = z.object({
  id: z.string().uuid('Invalid playlist ID'),
  songId: z.string().uuid('Invalid song ID'),
});

export const syncQuerySchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
});

export const songsQuerySchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
});

export const uploadUrlSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').max(200),
});
