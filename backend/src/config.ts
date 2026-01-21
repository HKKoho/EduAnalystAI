/**
 * Application configuration
 * Loads environment variables with defaults
 */

import dotenv from 'dotenv';

// Load .env file
dotenv.config();

export interface Config {
  // API Keys
  geminiApiKey: string;

  // LLM Configuration
  geminiModel: string;
  temperature: number;
  topP: number;
  maxOutputTokens: number;

  // Application Settings
  appName: string;
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  frontendUrl: string;

  // Rate Limiting
  rateLimitRequests: number;
  rateLimitWindow: number; // milliseconds

  // Caching
  cacheEnabled: boolean;
  cacheTtl: number; // milliseconds

  // JWT Configuration
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;

  // SMTP Configuration
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
}

function parseArray(value: string | undefined, defaultValue: string[]): string[] {
  if (!value) return defaultValue;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseFloat_(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

export const config: Config = {
  // API Keys
  geminiApiKey: process.env.GEMINI_API_KEY || '',

  // LLM Configuration
  geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  temperature: parseFloat_(process.env.TEMPERATURE, 0.3),
  topP: parseFloat_(process.env.TOP_P, 0.9),
  maxOutputTokens: parseNumber(process.env.MAX_OUTPUT_TOKENS, 8192),

  // Application Settings
  appName: process.env.APP_NAME || 'Edu-Analyst AI',
  port: parseNumber(process.env.PORT, 8000),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: parseArray(process.env.CORS_ORIGINS, [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'https://edu-analyst-ai.vercel.app',
    'https://edu-analyst-ai-api.vercel.app',
  ]),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Rate Limiting
  rateLimitRequests: parseNumber(process.env.RATE_LIMIT_REQUESTS, 10),
  rateLimitWindow: parseNumber(process.env.RATE_LIMIT_WINDOW, 60) * 1000, // convert to ms

  // Caching
  cacheEnabled: parseBoolean(process.env.CACHE_ENABLED, true),
  cacheTtl: parseNumber(process.env.CACHE_TTL, 3600) * 1000, // convert to ms

  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-jwt-refresh-secret-change-in-production',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // SMTP Configuration
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseNumber(process.env.SMTP_PORT, 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  smtpFrom: process.env.SMTP_FROM || 'noreply@edu-analyst.ai',
};

/**
 * Validate required configuration
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.geminiApiKey) {
    errors.push('GEMINI_API_KEY is required');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    // Don't exit in serverless environment
    if (process.env.VERCEL !== '1') {
      process.exit(1);
    }
  }
}

export default config;
