/**
 * Authentication API Service for Edu-Analyst AI
 * Handles all authentication-related API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  status: 'success' | 'error';
  user?: User;
  tokens?: AuthTokens;
  message?: string;
  error?: string;
  code?: string;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

// Token storage keys
const ACCESS_TOKEN_KEY = 'edu_analyst_access_token';
const REFRESH_TOKEN_KEY = 'edu_analyst_refresh_token';
const USER_KEY = 'edu_analyst_user';

/**
 * Store authentication tokens
 */
export function storeTokens(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

/**
 * Get stored access token
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Get stored refresh token
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Store user info
 */
export function storeUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Get stored user info
 */
export function getStoredUser(): User | null {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Clear all stored auth data
 */
export function clearAuthData(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Register a new user
 */
export async function register(
  email: string,
  password: string,
  name?: string
): Promise<{ user: User; tokens: AuthTokens }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  const data: AuthResponse = await response.json();

  if (data.status === 'error' || !data.user || !data.tokens) {
    throw new AuthApiError(
      data.error || 'Registration failed',
      data.code,
      response.status
    );
  }

  storeTokens(data.tokens);
  storeUser(data.user);

  return { user: data.user, tokens: data.tokens };
}

/**
 * Login with email and password
 */
export async function login(
  email: string,
  password: string
): Promise<{ user: User; tokens: AuthTokens }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data: AuthResponse = await response.json();

  if (data.status === 'error' || !data.user || !data.tokens) {
    throw new AuthApiError(
      data.error || 'Login failed',
      data.code,
      response.status
    );
  }

  storeTokens(data.tokens);
  storeUser(data.user);

  return { user: data.user, tokens: data.tokens };
}

/**
 * Logout - revoke refresh token
 */
export async function logout(): Promise<void> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  if (accessToken && refreshToken) {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore errors during logout
    }
  }

  clearAuthData();
}

/**
 * Refresh the access token
 */
export async function refreshAccessToken(): Promise<AuthTokens | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data: AuthResponse = await response.json();

    if (data.status === 'error' || !data.tokens) {
      clearAuthData();
      return null;
    }

    storeTokens(data.tokens);
    return data.tokens;
  } catch {
    clearAuthData();
    return null;
  }
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<User | null> {
  const accessToken = getAccessToken();
  if (!accessToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401) {
      // Try to refresh
      const newTokens = await refreshAccessToken();
      if (!newTokens) return null;

      // Retry with new token
      const retryResponse = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${newTokens.accessToken}` },
      });

      if (!retryResponse.ok) {
        clearAuthData();
        return null;
      }

      const retryData: AuthResponse = await retryResponse.json();
      if (retryData.user) {
        storeUser(retryData.user);
        return retryData.user;
      }
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const data: AuthResponse = await response.json();
    if (data.user) {
      storeUser(data.user);
      return data.user;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Request password reset email
 */
export async function forgotPassword(email: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data: AuthResponse = await response.json();

  if (data.status === 'error') {
    throw new AuthApiError(
      data.error || 'Failed to send reset email',
      data.code,
      response.status
    );
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });

  const data: AuthResponse = await response.json();

  if (data.status === 'error') {
    throw new AuthApiError(
      data.error || 'Failed to reset password',
      data.code,
      response.status
    );
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
