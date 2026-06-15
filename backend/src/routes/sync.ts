import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { syncQuerySchema } from '../types/index.js';
import * as songService from '../services/songService.js';
import * as playlistService from '../services/playlistService.js';
import db from '../config/database.js';
import type { SyncResponse, Favorite } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/sync?since=ISO - delta sync
router.get(
  '/',
  validateQuery(syncQuerySchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { since } = req.query as { since?: string };
      const serverTimestamp = new Date().toISOString();

      if (since) {
        // Delta sync: only return changes since the given timestamp
        const songs = songService.getSongsSince(since);
        const playlists = playlistService.getPlaylistsSince(since);

        // Get favorites (always return full set for simplicity)
        const favorites = db
          .prepare(
            'SELECT songId FROM favorites WHERE userId = ? ORDER BY addedAt DESC'
          )
          .all(userId) as Pick<Favorite, 'songId'>[];

        // Get deleted records since the timestamp
        const deletedSongs = db
          .prepare(
            `SELECT recordId FROM deleted_records WHERE tableName = 'songs' AND deletedAt > ?`
          )
          .all(since) as { recordId: string }[];

        const deletedPlaylists = db
          .prepare(
            `SELECT recordId FROM deleted_records WHERE tableName = 'playlists' AND deletedAt > ?`
          )
          .all(since) as { recordId: string }[];

        const response: SyncResponse = {
          songs,
          playlists,
          favorites: favorites.map((f) => f.songId),
          deletedSongIds: deletedSongs.map((d) => d.recordId),
          deletedPlaylistIds: deletedPlaylists.map((d) => d.recordId),
          serverTimestamp,
        };

        res.status(200).json(response);
      } else {
        // Full sync: return entire library
        const songs = songService.getAllSongs();
        const playlists = playlistService.getAllPlaylists();

        const favorites = db
          .prepare(
            'SELECT songId FROM favorites WHERE userId = ? ORDER BY addedAt DESC'
          )
          .all(userId) as Pick<Favorite, 'songId'>[];

        const response: SyncResponse = {
          songs,
          playlists,
          favorites: favorites.map((f) => f.songId),
          deletedSongIds: [],
          deletedPlaylistIds: [],
          serverTimestamp,
        };

        res.status(200).json(response);
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;
