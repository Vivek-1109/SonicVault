-- Initial database schema for Sonic Vault

-- Users table (single admin user)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Songs table
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  genre TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  artworkUrl TEXT,
  r2ObjectKey TEXT NOT NULL UNIQUE,
  fileSize INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  needsReview INTEGER NOT NULL DEFAULT 0,
  trackNumber INTEGER,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Playlists table
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  artworkUrl TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Playlist songs junction table
CREATE TABLE IF NOT EXISTS playlist_songs (
  playlistId TEXT NOT NULL,
  songId TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  addedAt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (playlistId, songId),
  FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE
);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
  userId TEXT NOT NULL,
  songId TEXT NOT NULL,
  addedAt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (userId, songId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE
);

-- Recently played table
CREATE TABLE IF NOT EXISTS recently_played (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  songId TEXT NOT NULL,
  playedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE
);

-- Devices table (stores refresh token hashes)
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  deviceName TEXT NOT NULL,
  refreshTokenHash TEXT NOT NULL,
  lastSeen TEXT NOT NULL DEFAULT (datetime('now')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Deleted records table for delta sync support
CREATE TABLE IF NOT EXISTS deleted_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tableName TEXT NOT NULL,
  recordId TEXT NOT NULL,
  deletedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album);
CREATE INDEX IF NOT EXISTS idx_songs_updatedAt ON songs(updatedAt);
CREATE INDEX IF NOT EXISTS idx_songs_r2ObjectKey ON songs(r2ObjectKey);
CREATE INDEX IF NOT EXISTS idx_songs_needsReview ON songs(needsReview);

CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlistId ON playlist_songs(playlistId);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_songId ON playlist_songs(songId);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_position ON playlist_songs(playlistId, position);

CREATE INDEX IF NOT EXISTS idx_favorites_userId ON favorites(userId);
CREATE INDEX IF NOT EXISTS idx_favorites_songId ON favorites(songId);

CREATE INDEX IF NOT EXISTS idx_recently_played_userId ON recently_played(userId);
CREATE INDEX IF NOT EXISTS idx_recently_played_playedAt ON recently_played(playedAt);
CREATE INDEX IF NOT EXISTS idx_recently_played_userId_playedAt ON recently_played(userId, playedAt);

CREATE INDEX IF NOT EXISTS idx_devices_userId ON devices(userId);

CREATE INDEX IF NOT EXISTS idx_deleted_records_tableName ON deleted_records(tableName);
CREATE INDEX IF NOT EXISTS idx_deleted_records_deletedAt ON deleted_records(deletedAt);
CREATE INDEX IF NOT EXISTS idx_deleted_records_tableName_deletedAt ON deleted_records(tableName, deletedAt);
