import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateParams, validateQuery } from '../middleware/validate.js';
import { idParamSchema, songsQuerySchema } from '../types/index.js';
import * as songService from '../services/songService.js';
import * as r2Service from '../services/r2Service.js';

const router = Router();

// GET /api/songs/:id/artwork - get artwork image via redirect (PUBLIC endpoint)
router.get(
  '/:id/artwork',
  validateParams(idParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const song = songService.getSongById(req.params.id as string);
      if (!song.artworkUrl) {
        return res.status(404).send('No artwork');
      }
      
      // If it's already an absolute URL (legacy), redirect to it (even if expired)
      if (song.artworkUrl.startsWith('http')) {
         return res.redirect(song.artworkUrl);
      }
      
      const url = await r2Service.getArtworkUrl(song.artworkUrl);
      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }
);

// All routes below require authentication
router.use(authenticateToken);

// GET /api/songs - list all songs (supports ?since=ISO for delta sync)
router.get(
  '/',
  validateQuery(songsQuerySchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { since } = req.query as { since?: string };
      const songs = since
        ? songService.getSongsSince(since)
        : songService.getAllSongs();
      res.status(200).json({ songs });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/songs/:id - get single song
router.get(
  '/:id',
  validateParams(idParamSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const song = songService.getSongById(req.params.id as string);
      res.status(200).json(song);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/songs/:id/stream-url - get signed streaming URL
router.get(
  '/:id/stream-url',
  validateParams(idParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const song = songService.getSongById(req.params.id as string);
      const url = await r2Service.getStreamUrl(song.r2ObjectKey);
      res.status(200).json({ url, expiresIn: 300 });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/songs/:id/download-url - get signed download URL
router.get(
  '/:id/download-url',
  validateParams(idParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const song = songService.getSongById(req.params.id as string);
      const ext = song.r2ObjectKey.split('.').pop() || 'mp3';
      const filename = `${song.artist} - ${song.title}.${ext}`;
      const url = await r2Service.getDownloadUrl(song.r2ObjectKey, filename);
      res.status(200).json({ url, filename, expiresIn: 300 });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
