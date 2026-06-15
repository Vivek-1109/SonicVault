import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateParams } from '../middleware/validate.js';
import { idParamSchema } from '../types/index.js';
import * as deviceService from '../services/deviceService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/devices - list all devices
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const devices = deviceService.getDevicesByUserId(req.user!.userId);
    res.status(200).json({ devices });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/devices/:id - revoke device
router.delete(
  '/:id',
  validateParams(idParamSchema),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const device = deviceService.getDeviceById(req.params.id as string);
      if (!device) {
        return next(new AppError('Device not found', 404));
      }
      if (device.userId !== req.user!.userId) {
        return next(new AppError('Unauthorized', 403));
      }
      deviceService.revokeDevice(req.params.id as string);
      res.status(200).json({ message: 'Device revoked' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
