import db from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Device } from '../types/index.js';

export function getDevicesByUserId(userId: string): Omit<Device, 'refreshTokenHash'>[] {
  const devices = db
    .prepare(
      'SELECT id, userId, deviceName, lastSeen, createdAt FROM devices WHERE userId = ? ORDER BY lastSeen DESC'
    )
    .all(userId) as Omit<Device, 'refreshTokenHash'>[];
  return devices;
}

export function getDeviceById(id: string): Device | undefined {
  return db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as
    | Device
    | undefined;
}

export function updateLastSeen(deviceId: string): void {
  db.prepare(`UPDATE devices SET lastSeen = datetime('now') WHERE id = ?`).run(
    deviceId
  );
}

export function revokeDevice(deviceId: string): void {
  const result = db.prepare('DELETE FROM devices WHERE id = ?').run(deviceId);
  if (result.changes === 0) {
    throw new AppError('Device not found', 404);
  }
}

export function revokeAllDevices(userId: string): void {
  db.prepare('DELETE FROM devices WHERE userId = ?').run(userId);
}
