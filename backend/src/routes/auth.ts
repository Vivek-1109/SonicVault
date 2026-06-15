import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  changePasswordSchema,
} from '../types/index.js';
import * as authService from '../services/authService.js';

const router = Router();

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, deviceName } = req.body;
      const result = await authService.login(email, password, deviceName);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  validateBody(refreshSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken, deviceId } = req.body;
      const tokens = await authService.refreshTokens(refreshToken, deviceId);
      res.status(200).json(tokens);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/logout (authenticated)
router.post(
  '/logout',
  authenticateToken,
  validateBody(logoutSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { deviceId } = req.body;
      authService.logout(deviceId, req.user!.userId);
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/change-password (authenticated)
router.post(
  '/change-password',
  authenticateToken,
  validateBody(changePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body;
      await authService.changePassword(
        req.user!.userId,
        oldPassword,
        newPassword
      );
      res.status(200).json({
        message:
          'Password changed successfully. All devices have been logged out.',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
