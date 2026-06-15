import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateParams } from '../middleware/validate.js';
import { songIdParamSchema } from '../types/index.js';
import db from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Favorite } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/favorites - list favorite songIds
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const favorites = db
      .prepare(
        'SELECT songId FROM favorites WHERE userId = ? ORDER BY addedAt DESC'
      )
      .all(userId) as Pick<Favorite, 'songId'>[];

    const songIds = favorites.map((f) => f.songId);
    res.status(200).json({ favorites: songIds });
  } catch (error) {
    next(error);
  }
});

// POST /api/favorites/:songId - add favorite
router.post(
  '/:songId',
  validateParams(songIdParamSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { songId } = req.params;

      // Verify song exists
      const song = db
        .prepare('SELECT id FROM songs WHERE id = ?')
        .get(songId) as { id: string } | undefined;

      if (!song) {
        throw new AppError('Song not found', 404);
      }

      // Check if already favorited
      const existing = db
        .prepare(
          'SELECT userId FROM favorites WHERE userId = ? AND songId = ?'
        )
        .get(userId, songId);

      if (existing) {
        res.status(200).json({ message: 'Song is already in favorites' });
        return;
      }

      db.prepare(
        `INSERT INTO favorites (userId, songId, addedAt) VALUES (?, ?, datetime('now'))`
      ).run(userId, songId);

      res.status(201).json({ message: 'Song added to favorites' });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/favorites/:songId - remove favorite
router.delete(
  '/:songId',
  validateParams(songIdParamSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { songId } = req.params;

      const result = db
        .prepare('DELETE FROM favorites WHERE userId = ? AND songId = ?')
        .run(userId, songId);

      if (result.changes === 0) {
        throw new AppError('Song not found in favorites', 404);
      }

      res.status(200).json({ message: 'Song removed from favorites' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
