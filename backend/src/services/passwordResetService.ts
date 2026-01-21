/**
 * Password Reset Service for Edu-Analyst AI
 * Handles password reset token generation and validation
 */

import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from './databaseService.js';
import { sendPasswordResetEmail } from './emailService.js';
import { updatePassword } from './userService.js';
import { revokeAllUserTokens } from './authService.js';

const RESET_TOKEN_EXPIRY_HOURS = 1;

export class PasswordResetError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PasswordResetError';
  }
}

/**
 * Request a password reset - generates token and sends email
 */
export async function requestPasswordReset(email: string): Promise<boolean> {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new PasswordResetError('Database not configured', 'DB_NOT_CONFIGURED');
  }

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    console.log(`Password reset requested for non-existent email: ${email}`);
    return true;
  }

  // Invalidate any existing reset tokens for this user
  await prisma.passwordReset.updateMany({
    where: {
      userId: user.id,
      used: false,
    },
    data: {
      used: true,
    },
  });

  // Generate a new reset token
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.passwordReset.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  // Send the reset email
  await sendPasswordResetEmail(user.email, token, user.name || undefined);

  return true;
}

/**
 * Verify a password reset token
 */
export async function verifyResetToken(token: string): Promise<{ userId: string; email: string } | null> {
  const prisma = getPrismaClient();
  if (!prisma) {
    return null;
  }

  const resetRecord = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetRecord) {
    return null;
  }

  // Check if already used
  if (resetRecord.used) {
    return null;
  }

  // Check if expired
  if (resetRecord.expiresAt < new Date()) {
    return null;
  }

  return {
    userId: resetRecord.userId,
    email: resetRecord.user.email,
  };
}

/**
 * Reset password using a valid token
 */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new PasswordResetError('Database not configured', 'DB_NOT_CONFIGURED');
  }

  // Verify the token
  const tokenInfo = await verifyResetToken(token);
  if (!tokenInfo) {
    throw new PasswordResetError('Invalid or expired reset token', 'INVALID_TOKEN');
  }

  // Update the password
  await updatePassword(tokenInfo.userId, newPassword);

  // Mark the token as used
  await prisma.passwordReset.update({
    where: { token },
    data: { used: true },
  });

  // Revoke all existing refresh tokens (log out from all devices)
  await revokeAllUserTokens(tokenInfo.userId);

  return true;
}

/**
 * Clean up expired and used password reset tokens
 */
export async function cleanupResetTokens(): Promise<number> {
  const prisma = getPrismaClient();
  if (!prisma) {
    return 0;
  }

  const result = await prisma.passwordReset.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { used: true },
      ],
    },
  });

  return result.count;
}
