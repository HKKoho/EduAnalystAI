/**
 * User Service for Edu-Analyst AI
 * Handles user CRUD operations
 */

import { getPrismaClient } from './databaseService.js';
import { hashPassword, verifyPassword, generateAuthTokens, AuthTokens } from './authService.js';

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export interface LoginResult {
  user: UserInfo;
  tokens: AuthTokens;
}

export class UserServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'UserServiceError';
  }
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<LoginResult> {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new UserServiceError('Database not configured', 'DB_NOT_CONFIGURED');
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existingUser) {
    throw new UserServiceError('A user with this email already exists', 'EMAIL_EXISTS');
  }

  // Validate password
  if (input.password.length < 8) {
    throw new UserServiceError('Password must be at least 8 characters', 'PASSWORD_TOO_SHORT');
  }

  // Hash password and create user
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
    },
  });

  // Generate tokens
  const tokens = await generateAuthTokens(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    tokens,
  };
}

/**
 * Authenticate a user with email and password
 */
export async function loginUser(email: string, password: string): Promise<LoginResult> {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new UserServiceError('Database not configured', 'DB_NOT_CONFIGURED');
  }

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    throw new UserServiceError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new UserServiceError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Generate tokens
  const tokens = await generateAuthTokens(user.id, user.email);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    tokens,
  };
}

/**
 * Get a user by ID
 */
export async function getUserById(userId: string): Promise<UserInfo | null> {
  const prisma = getPrismaClient();
  if (!prisma) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

/**
 * Get a user by email
 */
export async function getUserByEmail(email: string): Promise<UserInfo | null> {
  const prisma = getPrismaClient();
  if (!prisma) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

/**
 * Update a user's password
 */
export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new UserServiceError('Database not configured', 'DB_NOT_CONFIGURED');
  }

  if (newPassword.length < 8) {
    throw new UserServiceError('Password must be at least 8 characters', 'PASSWORD_TOO_SHORT');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId: string, data: { name?: string }): Promise<UserInfo> {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new UserServiceError('Database not configured', 'DB_NOT_CONFIGURED');
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

/**
 * Delete a user and all their data
 */
export async function deleteUser(userId: string): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new UserServiceError('Database not configured', 'DB_NOT_CONFIGURED');
  }

  // Cascade delete will handle refresh tokens and analyses
  await prisma.user.delete({
    where: { id: userId },
  });
}
