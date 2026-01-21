/**
 * Authentication Service for Edu-Analyst AI
 * Handles JWT generation, password hashing, and token management
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { getPrismaClient } from './databaseService.js';

const SALT_ROUNDS = 12;

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT access token
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtAccessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Generate a JWT refresh token and store it in the database
 */
export async function generateRefreshToken(userId: string): Promise<string> {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new Error('Database not configured');
  }

  const token = uuidv4();

  // Parse refresh token expiry (e.g., "7d" -> 7 days)
  const expiresIn = config.jwtRefreshExpiresIn;
  const match = expiresIn.match(/^(\d+)([dhms])$/);
  let expiresMs = 7 * 24 * 60 * 60 * 1000; // Default 7 days

  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case 'd': expiresMs = value * 24 * 60 * 60 * 1000; break;
      case 'h': expiresMs = value * 60 * 60 * 1000; break;
      case 'm': expiresMs = value * 60 * 1000; break;
      case 's': expiresMs = value * 1000; break;
    }
  }

  const expiresAt = new Date(Date.now() + expiresMs);

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
}

/**
 * Generate both access and refresh tokens
 */
export async function generateAuthTokens(userId: string, email: string): Promise<AuthTokens> {
  const accessToken = generateAccessToken({ userId, email });
  const refreshToken = await generateRefreshToken(userId);

  return { accessToken, refreshToken };
}

/**
 * Verify a JWT access token
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify and consume a refresh token (token rotation)
 * Returns a new token pair if valid, null otherwise
 */
export async function rotateRefreshToken(oldToken: string): Promise<{ tokens: AuthTokens; userId: string; email: string } | null> {
  const prisma = getPrismaClient();
  if (!prisma) {
    return null;
  }

  // Find the refresh token
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: oldToken },
    include: { user: true },
  });

  if (!storedToken) {
    return null;
  }

  // Check if expired
  if (storedToken.expiresAt < new Date()) {
    // Delete expired token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    return null;
  }

  // Delete the old token (single use)
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  // Generate new tokens
  const tokens = await generateAuthTokens(storedToken.userId, storedToken.user.email);

  return {
    tokens,
    userId: storedToken.userId,
    email: storedToken.user.email,
  };
}

/**
 * Revoke a refresh token
 */
export async function revokeRefreshToken(token: string): Promise<boolean> {
  const prisma = getPrismaClient();
  if (!prisma) {
    return false;
  }

  try {
    await prisma.refreshToken.delete({ where: { token } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user (e.g., for password change)
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) {
    return;
  }

  await prisma.refreshToken.deleteMany({ where: { userId } });
}

/**
 * Clean up expired refresh tokens (should be run periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const prisma = getPrismaClient();
  if (!prisma) {
    return 0;
  }

  const result = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  return result.count;
}
