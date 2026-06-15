import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Playlist, PlaylistWithCount, PlaylistWithSongs, Song } from '../types/index.js';

export function getAllPlaylists(): PlaylistWithCount[] {
  return db
    .prepare(
      `SELECT p.*, COUNT(ps.songId) as songCount
       FROM playlists p
       LEFT JOIN playlist_songs ps ON p.id = ps.playlistId
       GROUP BY p.id
       ORDER BY p.name`
    )
    .all() as PlaylistWithCount[];
}

export function getPlaylistById(id: string): PlaylistWithSongs {
  const playlist = db
    .prepare('SELECT * FROM playlists WHERE id = ?')
    .get(id) as Playlist | undefined;

  if (!playlist) {
    throw new AppError('Playlist not found', 404);
  }

  const songs = db
    .prepare(
      `SELECT s.* FROM songs s
       INNER JOIN playlist_songs ps ON s.id = ps.songId
       WHERE ps.playlistId = ?
       ORDER BY ps.position ASC`
    )
    .all(id) as Song[];

  return { ...playlist, songs };
}

export function createPlaylist(name: string, artworkUrl?: string | null): Playlist {
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO playlists (id, name, artworkUrl, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, name, artworkUrl ?? null, now, now);

  const playlist = db
    .prepare('SELECT * FROM playlists WHERE id = ?')
    .get(id) as Playlist;
  return playlist;
}

export function updatePlaylist(
  id: string,
  data: { name?: string; artworkUrl?: string | null }
): Playlist {
  // Verify exists
  const existing = db
    .prepare('SELECT * FROM playlists WHERE id = ?')
    .get(id) as Playlist | undefined;

  if (!existing) {
    throw new AppError('Playlist not found', 404);
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.artworkUrl !== undefined) {
    fields.push('artworkUrl = ?');
    values.push(data.artworkUrl);
  }

  if (fields.length === 0) {
    throw new AppError('No fields to update', 400);
  }

  fields.push("updatedAt = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE playlists SET ${fields.join(', ')} WHERE id = ?`).run(
    ...values
  );

  return db.prepare('SELECT * FROM playlists WHERE id = ?').get(id) as Playlist;
}

export function deletePlaylist(id: string): void {
  const existing = db
    .prepare('SELECT id FROM playlists WHERE id = ?')
    .get(id) as { id: string } | undefined;

  if (!existing) {
    throw new AppError('Playlist not found', 404);
  }

  const deleteTx = db.transaction(() => {
    db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
    db.prepare(
      `INSERT INTO deleted_records (tableName, recordId, deletedAt) VALUES ('playlists', ?, datetime('now'))`
    ).run(id);
  });

  deleteTx();
}

export function addSongToPlaylist(playlistId: string, songId: string): void {
  // Verify playlist exists
  const playlist = db
    .prepare('SELECT id FROM playlists WHERE id = ?')
    .get(playlistId) as { id: string } | undefined;

  if (!playlist) {
    throw new AppError('Playlist not found', 404);
  }

  // Verify song exists
  const song = db
    .prepare('SELECT id FROM songs WHERE id = ?')
    .get(songId) as { id: string } | undefined;

  if (!song) {
    throw new AppError('Song not found', 404);
  }

  // Check if already in playlist
  const existing = db
    .prepare(
      'SELECT playlistId FROM playlist_songs WHERE playlistId = ? AND songId = ?'
    )
    .get(playlistId, songId);

  if (existing) {
    throw new AppError('Song is already in this playlist', 409);
  }

  // Get max position
  const maxPos = db
    .prepare(
      'SELECT COALESCE(MAX(position), -1) as maxPos FROM playlist_songs WHERE playlistId = ?'
    )
    .get(playlistId) as { maxPos: number };

  const addTx = db.transaction(() => {
    db.prepare(
      `INSERT INTO playlist_songs (playlistId, songId, position, addedAt)
       VALUES (?, ?, ?, datetime('now'))`
    ).run(playlistId, songId, maxPos.maxPos + 1);

    db.prepare(
      `UPDATE playlists SET updatedAt = datetime('now') WHERE id = ?`
    ).run(playlistId);
  });

  addTx();
}

export function removeSongFromPlaylist(
  playlistId: string,
  songId: string
): void {
  const existing = db
    .prepare(
      'SELECT position FROM playlist_songs WHERE playlistId = ? AND songId = ?'
    )
    .get(playlistId, songId) as { position: number } | undefined;

  if (!existing) {
    throw new AppError('Song not found in this playlist', 404);
  }

  const removeTx = db.transaction(() => {
    // Delete the entry
    db.prepare(
      'DELETE FROM playlist_songs WHERE playlistId = ? AND songId = ?'
    ).run(playlistId, songId);

    // Reorder remaining songs
    db.prepare(
      `UPDATE playlist_songs
       SET position = position - 1
       WHERE playlistId = ? AND position > ?`
    ).run(playlistId, existing.position);

    db.prepare(
      `UPDATE playlists SET updatedAt = datetime('now') WHERE id = ?`
    ).run(playlistId);
  });

  removeTx();
}

export function reorderPlaylistSongs(
  playlistId: string,
  songIds: string[]
): void {
  // Verify playlist exists
  const playlist = db
    .prepare('SELECT id FROM playlists WHERE id = ?')
    .get(playlistId) as { id: string } | undefined;

  if (!playlist) {
    throw new AppError('Playlist not found', 404);
  }

  // Verify all songs are in the playlist
  const currentSongs = db
    .prepare('SELECT songId FROM playlist_songs WHERE playlistId = ?')
    .all(playlistId) as { songId: string }[];

  const currentSongIds = new Set(currentSongs.map((s) => s.songId));

  for (const songId of songIds) {
    if (!currentSongIds.has(songId)) {
      throw new AppError(`Song ${songId} is not in this playlist`, 400);
    }
  }

  if (songIds.length !== currentSongs.length) {
    throw new AppError(
      'Song list must contain all songs in the playlist',
      400
    );
  }

  const reorderTx = db.transaction(() => {
    const updateStmt = db.prepare(
      'UPDATE playlist_songs SET position = ? WHERE playlistId = ? AND songId = ?'
    );

    for (let i = 0; i < songIds.length; i++) {
      updateStmt.run(i, playlistId, songIds[i]);
    }

    db.prepare(
      `UPDATE playlists SET updatedAt = datetime('now') WHERE id = ?`
    ).run(playlistId);
  });

  reorderTx();
}

export function getPlaylistsSince(since: string): PlaylistWithCount[] {
  return db
    .prepare(
      `SELECT p.*, COUNT(ps.songId) as songCount
       FROM playlists p
       LEFT JOIN playlist_songs ps ON p.id = ps.playlistId
       WHERE p.updatedAt > ?
       GROUP BY p.id
       ORDER BY p.name`
    )
    .all(since) as PlaylistWithCount[];
}
