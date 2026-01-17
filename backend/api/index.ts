import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Inline the essential services to avoid ESM import issues
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'https://edu-analyst-ai.vercel.app',
    /\.vercel\.app$/,
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    llm_provider: 'gemini',
  });
});

// Main analyze endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { input, input_type, wordCount, language } = req.body;

    if (!input) {
      return res.status(400).json({ status: 'error', error: 'Input is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ status: 'error', error: 'API key not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });

    const languageInstruction = language === 'zh-TW'
      ? '\n\nIMPORTANT: Write your entire response in Traditional Chinese (繁體中文).\n'
      : '';

    const wordCountInstruction = wordCount
      ? `\n\nKeep your analysis to approximately ${wordCount} words.\n`
      : '';

    const prompt = `You are an Educational Content Analyst. Analyze the following content and provide a structured educational summary.${languageInstruction}${wordCountInstruction}

Content to analyze:
${input}

Provide:
1. Executive Summary
2. Key Learning Objectives
3. Core Concepts
4. Critical Arguments & Evidence
5. Practical Applications
6. Further Learning Suggestions`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    return res.json({
      status: 'success',
      result: {
        title: 'Educational Analysis',
        author: 'Edu-Analyst AI',
        markdown: response,
        timestamp: Date.now(),
        url: '',
        analysis_id: Math.random().toString(36).slice(2, 10),
      }
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Analysis failed'
    });
  }
});

// Root
app.get('/', (_req, res) => {
  res.json({ name: 'Edu-Analyst AI API', status: 'running' });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ status: 'error', error: 'Not found' });
});

// Vercel handler
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
