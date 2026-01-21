/**
 * Authentication Middleware for Edu-Analyst AI
 * Protects routes that require authentication
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../services/authService.js';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Middleware to require authentication
 * Extracts and verifies JWT from Authorization header
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      status: 'error',
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  // Expect "Bearer <token>" format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      status: 'error',
      error: 'Invalid authorization format. Use: Bearer <token>',
      code: 'INVALID_AUTH_FORMAT',
    });
    return;
  }

  const token = parts[1];
  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({
      status: 'error',
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  // Attach user info to request
  req.user = payload;
  next();
}

/**
 * Optional auth middleware - attaches user if token present, but doesn't require it
 * Useful for routes that behave differently for authenticated vs anonymous users
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      const payload = verifyAccessToken(token);
      if (payload) {
        req.user = payload;
      }
    }
  }

  next();
}
