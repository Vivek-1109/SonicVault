import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import type { User, Device, AuthTokens, LoginResponse } from '../types/index.js';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '90d';

export function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function generateRefreshToken(userId: string, deviceId: string): string {
  return jwt.sign({ userId, deviceId }, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

export async function login(
  email: string,
  password: string,
  deviceName: string
): Promise<LoginResponse> {
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email) as User | undefined;

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  const deviceId = uuidv4();
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id, deviceId);

  // Store hashed refresh token in devices table
  const refreshTokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);

  db.prepare(
    `INSERT INTO devices (id, userId, deviceName, refreshTokenHash, lastSeen, createdAt)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(deviceId, user.id, deviceName, refreshTokenHash);

  return {
    accessToken,
    refreshToken,
    deviceId,
    user: { id: user.id, email: user.email },
  };
}

export async function refreshTokens(
  refreshToken: string,
  deviceId: string
): Promise<AuthTokens> {
  // Verify the JWT structure first
  let decoded: { userId: string; deviceId: string };
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      userId: string;
      deviceId: string;
    };
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  if (decoded.deviceId !== deviceId) {
    throw new AppError('Device ID mismatch', 401);
  }

  // Verify the device exists
  const device = db
    .prepare('SELECT * FROM devices WHERE id = ?')
    .get(deviceId) as Device | undefined;

  if (!device) {
    throw new AppError('Device not found. Please log in again.', 401);
  }

  // Verify the refresh token hash matches
  const tokenValid = await bcrypt.compare(refreshToken, device.refreshTokenHash);
  if (!tokenValid) {
    // Possible token reuse attack — revoke the device
    db.prepare('DELETE FROM devices WHERE id = ?').run(deviceId);
    throw new AppError('Invalid refresh token. Device has been revoked for security.', 401);
  }

  // Generate new tokens (rotation)
  const newAccessToken = generateAccessToken(decoded.userId);
  const newRefreshToken = generateRefreshToken(decoded.userId, deviceId);
  const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, SALT_ROUNDS);

  // Update the device with new hash and lastSeen
  db.prepare(
    `UPDATE devices SET refreshTokenHash = ?, lastSeen = datetime('now') WHERE id = ?`
  ).run(newRefreshTokenHash, deviceId);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

export function logout(deviceId: string, userId: string): void {
  const result = db.prepare('DELETE FROM devices WHERE id = ? AND userId = ?').run(deviceId, userId);
  if (result.changes === 0) {
    throw new AppError('Device not found or unauthorized', 404);
  }
}

export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(userId) as User | undefined;

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const passwordValid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!passwordValid) {
    throw new AppError('Current password is incorrect', 401);
  }

  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  const changePasswordTx = db.transaction(() => {
    // Update password hash
    db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(
      newPasswordHash,
      userId
    );
    // Revoke all devices (force re-login everywhere)
    db.prepare('DELETE FROM devices WHERE userId = ?').run(userId);
  });

  changePasswordTx();
}

export function verifyRefreshToken(
  token: string
): { userId: string; deviceId: string } {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as {
      userId: string;
      deviceId: string;
    };
    // Verify the device still exists
    const device = db
      .prepare('SELECT id FROM devices WHERE id = ?')
      .get(decoded.deviceId) as { id: string } | undefined;

    if (!device) {
      throw new AppError('Device has been revoked', 401);
    }
    return decoded;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid or expired refresh token', 401);
  }
}

export async function createAdminUser(
  email: string,
  password: string
): Promise<void> {
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email) as { id: string } | undefined;

  if (existing) {
    // Update password if it changed
    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as User;
    const isSame = await bcrypt.compare(password, user.passwordHash);
    if (!isSame) {
      const newHash = await bcrypt.hash(password, SALT_ROUNDS);
      db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(
        newHash,
        user.id
      );
      console.log('🔑 Admin password updated.');
    }
    return;
  }

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  db.prepare(
    `INSERT INTO users (id, email, passwordHash, createdAt) VALUES (?, ?, ?, datetime('now'))`
  ).run(id, email, passwordHash);

  console.log(`👤 Admin user created: ${email}`);
}
