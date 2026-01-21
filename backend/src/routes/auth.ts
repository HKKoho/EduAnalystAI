/**
 * Authentication Routes for Edu-Analyst AI
 * Handles user registration, login, logout, and password reset
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createUser, loginUser, getUserById, UserServiceError } from '../services/userService.js';
import { rotateRefreshToken, revokeRefreshToken } from '../services/authService.js';
import { requestPasswordReset, resetPassword, PasswordResetError } from '../services/passwordResetService.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * POST /api/auth/register
 * Create a new user account
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        error: parseResult.error.errors[0]?.message || 'Invalid request',
        code: 'VALIDATION_ERROR',
      });
    }

    const { email, password, name } = parseResult.data;
    const result = await createUser({ email, password, name });

    return res.status(201).json({
      status: 'success',
      user: result.user,
      tokens: result.tokens,
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      const statusCode = error.code === 'EMAIL_EXISTS' ? 409 : 400;
      return res.status(statusCode).json({
        status: 'error',
        error: error.message,
        code: error.code,
      });
    }

    console.error('Registration error:', error);
    return res.status(500).json({
      status: 'error',
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        error: parseResult.error.errors[0]?.message || 'Invalid request',
        code: 'VALIDATION_ERROR',
      });
    }

    const { email, password } = parseResult.data;
    const result = await loginUser(email, password);

    return res.json({
      status: 'success',
      user: result.user,
      tokens: result.tokens,
    });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return res.status(401).json({
        status: 'error',
        error: error.message,
        code: error.code,
      });
    }

    console.error('Login error:', error);
    return res.status(500).json({
      status: 'error',
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/auth/logout
 * Revoke the refresh token
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    return res.json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      status: 'error',
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Get a new access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const parseResult = RefreshSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        error: parseResult.error.errors[0]?.message || 'Invalid request',
        code: 'VALIDATION_ERROR',
      });
    }

    const { refreshToken } = parseResult.data;
    const result = await rotateRefreshToken(refreshToken);

    if (!result) {
      return res.status(401).json({
        status: 'error',
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    return res.json({
      status: 'success',
      tokens: result.tokens,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({
      status: 'error',
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.user!.userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    return res.json({
      status: 'success',
      user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({
      status: 'error',
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request a password reset email
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const parseResult = ForgotPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        error: parseResult.error.errors[0]?.message || 'Invalid request',
        code: 'VALIDATION_ERROR',
      });
    }

    const { email } = parseResult.data;
    await requestPasswordReset(email);

    // Always return success to prevent email enumeration
    return res.json({
      status: 'success',
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      status: 'error',
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using token from email
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const parseResult = ResetPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        error: parseResult.error.errors[0]?.message || 'Invalid request',
        code: 'VALIDATION_ERROR',
      });
    }

    const { token, password } = parseResult.data;
    await resetPassword(token, password);

    return res.json({
      status: 'success',
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    if (error instanceof PasswordResetError) {
      return res.status(400).json({
        status: 'error',
        error: error.message,
        code: error.code,
      });
    }

    if (error instanceof UserServiceError) {
      return res.status(400).json({
        status: 'error',
        error: error.message,
        code: error.code,
      });
    }

    console.error('Reset password error:', error);
    return res.status(500).json({
      status: 'error',
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
