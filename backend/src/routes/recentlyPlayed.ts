import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { recordPlaySchema } from '../types/index.js';
import db from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Song } from '../types/index.js';

interface RecentlyPlayedRow {
  id: number;
  userId: string;
  songId: string;
  playedAt: string;
}

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/recently-played - last 50
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const rows = db
      .prepare(
        `SELECT rp.id, rp.songId, rp.playedAt, s.*
         FROM recently_played rp
         INNER JOIN songs s ON rp.songId = s.id
         WHERE rp.userId = ?
         ORDER BY rp.playedAt DESC
         LIMIT 50`
      )
      .all(userId) as (RecentlyPlayedRow & Song)[];

    const recentlyPlayed = rows.map((row) => ({
      playedAt: row.playedAt,
      song: {
        id: row.songId,
        title: row.title,
        artist: row.artist,
        album: row.album,
        genre: row.genre,
        duration: row.duration,
        artworkUrl: row.artworkUrl,
        r2ObjectKey: row.r2ObjectKey,
        fileSize: row.fileSize,
        checksum: row.checksum,
        needsReview: row.needsReview,
        trackNumber: row.trackNumber,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    }));

    res.status(200).json({ recentlyPlayed });
  } catch (error) {
    next(error);
  }
});

// POST /api/recently-played - record play
router.post(
  '/',
  validateBody(recordPlaySchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { songId } = req.body;

      // Verify song exists
      const song = db
        .prepare('SELECT id FROM songs WHERE id = ?')
        .get(songId) as { id: string } | undefined;

      if (!song) {
        throw new AppError('Song not found', 404);
      }

      db.prepare(
        `INSERT INTO recently_played (userId, songId, playedAt) VALUES (?, ?, datetime('now'))`
      ).run(userId, songId);

      // Trim to keep only the latest 200 entries per user
      db.prepare(
        `DELETE FROM recently_played
         WHERE userId = ? AND id NOT IN (
           SELECT id FROM recently_played WHERE userId = ? ORDER BY playedAt DESC LIMIT 200
         )`
      ).run(userId, userId);

      res.status(201).json({ message: 'Play recorded' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
