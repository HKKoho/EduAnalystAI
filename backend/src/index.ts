/**
 * Edu-Analyst AI Backend
 * FastAPI-style Express.js application for educational video analysis
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config, validateConfig } from './config.js';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';
import { disconnectDatabase } from './services/databaseService.js';

// Validate configuration on startup
validateConfig();

const app: Express = express();

// ============================================================================
// Middleware
// ============================================================================

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Rate limiting for /api/analyze endpoint
const analysisLimiter = rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitRequests,
  message: {
    status: 'error',
    error: 'Rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to analyze endpoint
app.use('/api/analyze', analysisLimiter);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Routes
// ============================================================================

// Auth routes
app.use('/api/auth', authRouter);

// API routes
app.use('/api', apiRouter);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: config.appName,
    version: '1.0.0',
    description: 'Educational video analysis API',
    endpoints: {
      health: 'GET /api/health',
      analyze: 'POST /api/analyze',
      history: 'GET /api/history',
      analysis: 'GET /api/analysis/:id',
    },
  });
});

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    error: 'Endpoint not found',
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    status: 'error',
    error: config.nodeEnv === 'development'
      ? err.message
      : 'An internal server error occurred',
  });
});

// ============================================================================
// Server Startup
// ============================================================================

const server = app.listen(config.port, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║   🎓 Edu-Analyst AI Backend                                ║');
  console.log('║                                                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║   Server:     http://localhost:${config.port.toString().padEnd(25)}║`);
  console.log(`║   Environment: ${config.nodeEnv.padEnd(29)}║`);
  console.log(`║   LLM Model:   ${config.geminiModel.padEnd(29)}║`);
  console.log(`║   Cache:       ${(config.cacheEnabled ? 'Enabled' : 'Disabled').padEnd(29)}║`);
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await disconnectDatabase();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await disconnectDatabase();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
