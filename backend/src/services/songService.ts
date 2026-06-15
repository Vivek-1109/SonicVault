import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Song } from '../types/index.js';

export function getAllSongs(): Song[] {
  return db.prepare('SELECT * FROM songs ORDER BY artist, album, trackNumber, title').all() as Song[];
}

export function getSongById(id: string): Song {
  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id) as Song | undefined;
  if (!song) {
    throw new AppError('Song not found', 404);
  }
  return song;
}

export function getSongsSince(since: string): Song[] {
  return db
    .prepare('SELECT * FROM songs WHERE updatedAt > ? ORDER BY updatedAt ASC')
    .all(since) as Song[];
}

export interface CreateSongData {
  title: string;
  artist: string;
  album?: string | null;
  genre?: string | null;
  duration: number;
  artworkUrl?: string | null;
  r2ObjectKey: string;
  fileSize: number;
  checksum?: string | null;
  needsReview?: number;
  trackNumber?: number | null;
}

export function createSong(data: CreateSongData): Song {
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO songs (id, title, artist, album, genre, duration, artworkUrl, r2ObjectKey, fileSize, checksum, needsReview, trackNumber, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.title,
    data.artist,
    data.album ?? null,
    data.genre ?? null,
    data.duration,
    data.artworkUrl ?? null,
    data.r2ObjectKey,
    data.fileSize,
    data.checksum ?? null,
    data.needsReview ?? 0,
    data.trackNumber ?? null,
    now,
    now
  );

  return getSongById(id);
}

export interface UpdateSongData {
  title?: string;
  artist?: string;
  album?: string | null;
  genre?: string | null;
  duration?: number;
  artworkUrl?: string | null;
  needsReview?: number;
  trackNumber?: number | null;
}

export function updateSong(id: string, data: UpdateSongData): Song {
  // Verify song exists
  getSongById(id);

  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.title !== undefined) {
    fields.push('title = ?');
    values.push(data.title);
  }
  if (data.artist !== undefined) {
    fields.push('artist = ?');
    values.push(data.artist);
  }
  if (data.album !== undefined) {
    fields.push('album = ?');
    values.push(data.album);
  }
  if (data.genre !== undefined) {
    fields.push('genre = ?');
    values.push(data.genre);
  }
  if (data.duration !== undefined) {
    fields.push('duration = ?');
    values.push(data.duration);
  }
  if (data.artworkUrl !== undefined) {
    fields.push('artworkUrl = ?');
    values.push(data.artworkUrl);
  }
  if (data.needsReview !== undefined) {
    fields.push('needsReview = ?');
    values.push(data.needsReview);
  }
  if (data.trackNumber !== undefined) {
    fields.push('trackNumber = ?');
    values.push(data.trackNumber);
  }

  if (fields.length === 0) {
    throw new AppError('No fields to update', 400);
  }

  fields.push("updatedAt = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE songs SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getSongById(id);
}

export function deleteSong(id: string): void {
  const song = getSongById(id);

  const deleteTx = db.transaction(() => {
    db.prepare('DELETE FROM songs WHERE id = ?').run(id);
    db.prepare(
      `INSERT INTO deleted_records (tableName, recordId, deletedAt) VALUES ('songs', ?, datetime('now'))`
    ).run(id);
  });

  deleteTx();
}

export function searchSongs(query: string): Song[] {
  const searchPattern = `%${query}%`;
  return db
    .prepare(
      `SELECT * FROM songs
       WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?
       ORDER BY artist, album, trackNumber, title
       LIMIT 100`
    )
    .all(searchPattern, searchPattern, searchPattern) as Song[];
}

export function getSongByR2Key(r2ObjectKey: string): Song | undefined {
  return db
    .prepare('SELECT * FROM songs WHERE r2ObjectKey = ?')
    .get(r2ObjectKey) as Song | undefined;
}
