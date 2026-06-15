import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  idParamSchema,
  playlistSongParamSchema,
  createPlaylistSchema,
  updatePlaylistSchema,
  addSongToPlaylistSchema,
  reorderPlaylistSchema,
} from '../types/index.js';
import * as playlistService from '../services/playlistService.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/playlists - list all playlists with song counts
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const playlists = playlistService.getAllPlaylists();
    res.status(200).json({ playlists });
  } catch (error) {
    next(error);
  }
});

// GET /api/playlists/:id - get playlist with songs
router.get(
  '/:id',
  validateParams(idParamSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const playlist = playlistService.getPlaylistById(req.params.id as string);
      res.status(200).json(playlist);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/playlists - create playlist
router.post(
  '/',
  validateBody(createPlaylistSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, artworkUrl } = req.body;
      const playlist = playlistService.createPlaylist(name, artworkUrl);
      res.status(201).json(playlist);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/playlists/:id - update playlist
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updatePlaylistSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const playlist = playlistService.updatePlaylist(req.params.id as string, req.body);
      res.status(200).json(playlist);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/playlists/:id - delete playlist
router.delete(
  '/:id',
  validateParams(idParamSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      playlistService.deletePlaylist(req.params.id as string);
      res.status(200).json({ message: 'Playlist deleted' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/playlists/:id/songs - add song to playlist
router.post(
  '/:id/songs',
  validateParams(idParamSchema),
  validateBody(addSongToPlaylistSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      playlistService.addSongToPlaylist(req.params.id as string, req.body.songId);
      res.status(201).json({ message: 'Song added to playlist' });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/playlists/:id/songs/:songId - remove song from playlist
router.delete(
  '/:id/songs/:songId',
  validateParams(playlistSongParamSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      playlistService.removeSongFromPlaylist(req.params.id as string, req.params.songId as string);
      res.status(200).json({ message: 'Song removed from playlist' });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/playlists/:id/reorder - reorder playlist songs
router.put(
  '/:id/reorder',
  validateParams(idParamSchema),
  validateBody(reorderPlaylistSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      playlistService.reorderPlaylistSongs(req.params.id as string, req.body.songIds);
      res.status(200).json({ message: 'Playlist reordered' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
