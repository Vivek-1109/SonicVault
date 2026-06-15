import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import { parseBuffer } from 'music-metadata';
import { authenticateToken } from '../middleware/auth.js';
import { adminLimiter } from '../middleware/rateLimiter.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  updateSongSchema,
  idParamSchema,
  uploadUrlSchema,
  searchQuerySchema,
} from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import * as songService from '../services/songService.js';
import * as r2Service from '../services/r2Service.js';
import db from '../config/database.js';
import type { StorageStats } from '../types/index.js';

const router = Router();

// All admin routes require authentication and have rate limiting
router.use(authenticateToken);
router.use(adminLimiter);

// Setup multer for file uploads
const tmpDir = path.resolve(os.tmpdir(), 'sonicvault_uploads');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tmpDir);
  },
  filename: (_req, _file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(_file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a',
      'audio/aac',
      'audio/flac',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp3|m4a|aac|flac|wav|ogg|webm)$/i)) {
      cb(null, true);
    } else {
      cb(new AppError('Only audio files are allowed', 400));
    }
  },
});

const artworkUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only JPEG, PNG, and WebP images are allowed', 400));
    }
  },
});

/**
 * Clean up a temporary file.
 */
function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    console.error(`Failed to clean up temp file: ${filePath}`);
  }
}

/**
 * Parse a filename to extract title and artist when ID3 tags are missing.
 * Handles patterns like: "Artist - Title.mp3", "Title.mp3"
 */
function parseFilename(filename: string): { title: string; artist: string } {
  const nameWithoutExt = path.basename(filename, path.extname(filename));

  // Try "Artist - Title" pattern
  const dashMatch = nameWithoutExt.match(/^(.+?)\s*-\s*(.+)$/);
  if (dashMatch) {
    return {
      artist: dashMatch[1]!.trim(),
      title: dashMatch[2]!.trim(),
    };
  }

  return {
    title: nameWithoutExt.trim(),
    artist: 'Unknown Artist',
  };
}

// POST /api/admin/songs/upload - multipart upload
router.post(
  '/songs/upload',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    if (!file) {
      next(new AppError('No audio file provided', 400));
      return;
    }

    try {
      const providedFilename =
        typeof req.body?.filename === 'string' && req.body.filename.trim().length > 0
          ? path.basename(req.body.filename.trim())
          : undefined;
      const providedMimeType =
        typeof req.body?.mimeType === 'string' && req.body.mimeType.trim().length > 0
          ? req.body.mimeType.trim()
          : undefined;
      const originalFilename = providedFilename || file.originalname;
      const uploadMimeType = providedMimeType || file.mimetype || 'application/octet-stream';

      // Read the uploaded file
      const fileBuffer = fs.readFileSync(file.path);
      const fileSize = fileBuffer.length;

      // Parse ID3 tags
      let title: string | undefined;
      let artist: string | undefined;
      let album: string | null = null;
      let genre: string | null = null;
      let duration = 0;
      let trackNumber: number | null = null;
      let artworkBuffer: Buffer | null = null;
      let artworkMime: string | null = null;
      let needsReview = 0;

      try {
        const metadata = await parseBuffer(fileBuffer, {
          mimeType: uploadMimeType as `${string}/${string}`,
        });

        title = metadata.common.title || undefined;
        artist = metadata.common.artist || undefined;
        album = metadata.common.album || null;
        duration = Math.round(metadata.format.duration || 0);
        trackNumber = metadata.common.track?.no ?? null;

        // Get genre
        if (metadata.common.genre && metadata.common.genre.length > 0) {
          genre = metadata.common.genre[0] ?? null;
        }

        // Extract embedded artwork
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          const picture = metadata.common.picture[0]!;
          artworkBuffer = Buffer.from(picture.data);
          artworkMime = picture.format;
        }
      } catch (parseError) {
        console.warn('Failed to parse ID3 tags:', parseError);
      }

      // If title or artist missing, parse from filename
      if (!title || !artist) {
        const parsed = parseFilename(originalFilename);
        title = title || parsed.title;
        artist = artist || parsed.artist;
        needsReview = 1;
      }

      // Generate R2 keys
      const songId = uuidv4();
      const ext = path.extname(originalFilename) || path.extname(file.originalname) || '.mp3';
      const r2ObjectKey = `music/${songId}${ext}`;

      // Upload audio file to R2
      await r2Service.uploadBuffer(r2ObjectKey, fileBuffer, uploadMimeType);

      // Upload artwork if extracted
      let artworkUrl: string | null = null;
      if (artworkBuffer && artworkMime) {
        const artworkExt = artworkMime.includes('png') ? '.png' : '.jpg';
        const artworkKey = `artwork/${songId}${artworkExt}`;
        await r2Service.uploadBuffer(artworkKey, artworkBuffer, artworkMime);
        artworkUrl = artworkKey;
      }

      // Save metadata to database
      const song = songService.createSong({
        title,
        artist,
        album,
        genre,
        duration,
        artworkUrl,
        r2ObjectKey,
        fileSize,
        needsReview,
        trackNumber,
      });

      res.status(201).json(song);
    } catch (error) {
      next(error);
    } finally {
      // Clean up temp file
      cleanupFile(file.path);
    }
  }
);

// PUT /api/admin/songs/:id - update song metadata
router.put(
  '/songs/:id',
  validateParams(idParamSchema),
  validateBody(updateSongSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const song = songService.updateSong(req.params.id as string, req.body);
      res.status(200).json(song);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/admin/songs/:id - delete song + R2 object
router.delete(
  '/songs/:id',
  validateParams(idParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const song = songService.getSongById(req.params.id as string);

      // Delete from R2
      try {
        await r2Service.deleteObject(song.r2ObjectKey);
      } catch (r2Error) {
        console.error('Failed to delete R2 object:', r2Error);
        // Continue with DB deletion even if R2 deletion fails
      }

      // Delete artwork from R2 if it exists
      if (song.artworkUrl && !song.artworkUrl.startsWith('http')) {
        try {
          await r2Service.deleteObject(song.artworkUrl);
        } catch (error) {
          console.error('Failed to delete artwork:', error);
        }
      }

      // Delete from database
      songService.deleteSong(req.params.id as string);

      res.status(200).json({ message: 'Song deleted' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/admin/upload-url - get presigned URL for direct R2 upload
router.post(
  '/upload-url',
  validateBody(uploadUrlSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { filename, contentType } = req.body;
      const ext = path.extname(filename) || '.mp3';
      const key = `music/${uuidv4()}${ext}`;
      const url = await r2Service.getUploadUrl(key, contentType);

      res.status(200).json({
        uploadUrl: url,
        r2ObjectKey: key,
        expiresIn: 3600,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/admin/artwork-upload - multipart artwork upload
router.post(
  '/artwork-upload',
  artworkUpload.single('artwork'),
  async (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    if (!file) {
      next(new AppError('No artwork file provided', 400));
      return;
    }

    try {
      const fileBuffer = fs.readFileSync(file.path);
      const artworkId = uuidv4();
      const ext = path.extname(file.originalname) || '.jpg';
      const artworkKey = `artwork/${artworkId}${ext}`;

      await r2Service.uploadBuffer(artworkKey, fileBuffer, file.mimetype);

      res.status(201).json({
        artworkUrl: artworkKey,
        r2ObjectKey: artworkKey,
      });
    } catch (error) {
      next(error);
    } finally {
      if (file) {
        cleanupFile(file.path);
      }
    }
  }
);

// GET /api/admin/storage - get storage stats
router.get(
  '/storage',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const songStats = db
        .prepare(
          'SELECT COUNT(*) as totalSongs, COALESCE(SUM(fileSize), 0) as totalSizeBytes FROM songs'
        )
        .get() as { totalSongs: number; totalSizeBytes: number };

      const playlistCount = db
        .prepare('SELECT COUNT(*) as count FROM playlists')
        .get() as { count: number };

      const favoriteCount = db
        .prepare('SELECT COUNT(*) as count FROM favorites')
        .get() as { count: number };

      const stats: StorageStats = {
        totalSongs: songStats.totalSongs,
        totalSizeBytes: songStats.totalSizeBytes,
        totalPlaylists: playlistCount.count,
        totalFavorites: favoriteCount.count,
      };

      res.status(200).json(stats);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/admin/songs/search?q=query - search songs
router.get(
  '/songs/search',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query.q as string;
      if (!q || q.trim().length === 0) {
        throw new AppError('Search query is required', 400);
      }
      const songs = songService.searchSongs(q.trim());
      res.status(200).json({ songs });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
