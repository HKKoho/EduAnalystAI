/**
 * API Routes for Edu-Analyst AI
 * Implements the "Source-First" architecture
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import multer from 'multer';

import { config } from '../config.js';
import {
  AnalyzeRequestSchema,
  AnalysisResult,
  HistoryItem,
  isYouTubeUrl,
  extractVideoId,
  successResponse,
  errorResponse,
} from '../models/schemas.js';
import {
  getTranscript,
  YouTubeServiceError,
} from '../services/youtubeService.js';
import { cleanTranscript } from '../services/transcriptCleaner.js';
import { getLLMService, LLMServiceError } from '../services/llmService.js';
import { getCache } from '../utils/cache.js';
import {
  parseDocument,
  DocumentServiceError,
  SUPPORTED_DOCUMENT_TYPES,
} from '../services/documentService.js';
import {
  getImageService,
  ImageServiceError,
  SUPPORTED_IMAGE_TYPES,
} from '../services/imageService.js';
import {
  getAudioService,
  AudioServiceError,
  SUPPORTED_AUDIO_TYPES,
} from '../services/audioService.js';

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max file size (for audio files)
  },
});

// Valid word count options for summaries
const VALID_WORD_COUNTS = [150, 250, 300, 500, 1000];

const router = Router();

// In-memory storage (replace with database in production)
const analysisHistory: HistoryItem[] = [];
const analysisResults: Map<string, AnalysisResult> = new Map();

// Generate short unique ID
function generateId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    llm_provider: 'gemini',
    cache_enabled: config.cacheEnabled,
  });
});

/**
 * POST /api/analyze
 * Main analysis endpoint - implements Source-First architecture
 */
router.post('/analyze', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const analysisId = generateId();

  try {
    // Validate request
    const parseResult = AnalyzeRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json(
        errorResponse(parseResult.error.errors[0]?.message || 'Invalid request')
      );
    }

    const { input, input_type } = parseResult.data;

    // Parse optional word count from request body
    const wordCount = req.body.wordCount ? parseInt(req.body.wordCount) : undefined;
    const validWordCount = wordCount && VALID_WORD_COUNTS.includes(wordCount) ? wordCount : undefined;

    // Parse optional language from request body
    const language = req.body.language === 'zh-TW' ? 'zh-TW' : undefined;

    // Step 1: Determine if input is URL or text
    const isUrl = input_type === 'url' || isYouTubeUrl(input);
    let rawTranscript: string;
    let videoId: string | null = null;
    let title: string;

    if (isUrl) {
      // Extract transcript from YouTube
      console.log(`Processing YouTube URL: ${input}`);

      videoId = extractVideoId(input);
      if (!videoId) {
        return res.status(400).json(
          errorResponse('Could not extract video ID from URL')
        );
      }

      const transcriptResult = await getTranscript(videoId);
      rawTranscript = transcriptResult.text;
      title = `YouTube Video Analysis (${videoId})`;

      console.log(`Fetched transcript: ${transcriptResult.wordCount} words`);
    } else {
      // Direct transcript text
      console.log('Processing direct transcript text');
      rawTranscript = input;
      title = 'Transcript Analysis';
    }

    // Step 2: Clean transcript
    const { text: cleanedTranscript, stats: cleaningStats } = cleanTranscript(rawTranscript);

    console.log(
      `Transcript cleaned: ${cleaningStats.originalWordCount} → ` +
      `${cleaningStats.cleanedWordCount} words ` +
      `(${cleaningStats.reductionPercentage}% reduction)`
    );

    // Step 3: Analyze with LLM (transcript injected into context)
    const llmService = getLLMService();
    const markdownResult = await llmService.analyzeTranscript(
      cleanedTranscript,
      videoId || undefined,
      config.cacheEnabled,
      validWordCount,
      language
    );

    // Build result
    const result: AnalysisResult = {
      title,
      author: 'Edu-Analyst AI',
      markdown: markdownResult,
      timestamp: Date.now(),
      url: isUrl ? input : '',
      analysis_id: analysisId,
    };

    // Store in history
    const historyItem: HistoryItem = {
      analysis_id: analysisId,
      title,
      timestamp: result.timestamp,
      input_type: isUrl ? 'url' : 'text',
      url: result.url,
    };

    analysisHistory.unshift(historyItem);
    analysisResults.set(analysisId, result);

    // Keep only last 50 items
    if (analysisHistory.length > 50) {
      const removed = analysisHistory.pop();
      if (removed) {
        analysisResults.delete(removed.analysis_id);
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`Analysis completed in ${elapsed.toFixed(2)}s, ID: ${analysisId}`);

    return res.json(successResponse(result));

  } catch (error) {
    console.error('Analysis error:', error);

    if (error instanceof YouTubeServiceError) {
      return res.status(400).json(errorResponse(error.message));
    }

    if (error instanceof LLMServiceError) {
      return res.status(500).json(errorResponse(error.message));
    }

    return res.status(500).json(
      errorResponse('An unexpected error occurred. Please try again.')
    );
  }
});

/**
 * GET /api/history
 * Get recent analysis history
 */
router.get('/history', (req: Request, res: Response) => {
  const limit = Math.min(
    parseInt(req.query.limit as string) || 10,
    50
  );

  res.json({
    analyses: analysisHistory.slice(0, limit),
  });
});

/**
 * GET /api/analysis/:id
 * Retrieve a specific analysis by ID
 */
router.get('/analysis/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const result = analysisResults.get(id);

  if (!result) {
    return res.status(404).json(
      errorResponse(`Analysis with ID '${id}' not found`)
    );
  }

  return res.json(successResponse(result));
});

/**
 * DELETE /api/history/:id
 * Delete an analysis from history
 */
router.delete('/history/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  if (!analysisResults.has(id)) {
    return res.status(404).json(
      errorResponse(`Analysis with ID '${id}' not found`)
    );
  }

  // Remove from results
  analysisResults.delete(id);

  // Remove from history
  const index = analysisHistory.findIndex(h => h.analysis_id === id);
  if (index !== -1) {
    analysisHistory.splice(index, 1);
  }

  return res.json({
    status: 'success',
    message: `Analysis ${id} deleted`,
  });
});

/**
 * GET /api/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', (_req: Request, res: Response) => {
  const cache = getCache();
  res.json(cache.stats());
});

/**
 * POST /api/cache/clear
 * Clear the analysis cache
 */
router.post('/cache/clear', (_req: Request, res: Response) => {
  const cache = getCache();
  cache.clear();
  res.json({
    status: 'success',
    message: 'Cache cleared',
  });
});

/**
 * POST /api/summarize-document
 * Upload and summarize a document (PDF, DOCX, TXT)
 */
router.post(
  '/summarize-document',
  upload.single('file'),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const analysisId = generateId();

    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json(
          errorResponse('No file uploaded. Please upload a PDF, DOCX, or TXT file.')
        );
      }

      // Validate file type (check both MIME type and file extension)
      const fileExtension = req.file.originalname.toLowerCase().split('.').pop();
      const isValidMimeType = SUPPORTED_DOCUMENT_TYPES.includes(req.file.mimetype);
      const isValidExtension = ['pdf', 'docx', 'txt'].includes(fileExtension || '');

      if (!isValidMimeType && !isValidExtension) {
        return res.status(400).json(
          errorResponse(
            `Unsupported file type: ${req.file.mimetype}. Supported types: PDF, DOCX, TXT`
          )
        );
      }

      // Parse word count from request body
      const wordCount = parseInt(req.body.wordCount) || 300;
      if (!VALID_WORD_COUNTS.includes(wordCount)) {
        return res.status(400).json(
          errorResponse(
            `Invalid word count: ${wordCount}. Valid options: ${VALID_WORD_COUNTS.join(', ')}`
          )
        );
      }

      // Parse optional language from request body
      const language = req.body.language === 'zh-TW' ? 'zh-TW' : undefined;

      console.log(`Processing document: ${req.file.originalname} (${req.file.mimetype})${language === 'zh-TW' ? ' [Traditional Chinese]' : ''}`);
      console.log(`Target summary length: ${wordCount} words`);

      // Parse the document
      const parsedDoc = await parseDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      console.log(`Document parsed: ${parsedDoc.wordCount} words extracted`);

      // Summarize with LLM
      const llmService = getLLMService();
      const summary = await llmService.summarizeDocument(
        parsedDoc.text,
        parsedDoc.fileName,
        wordCount,
        language
      );

      // Build result
      const result: AnalysisResult = {
        title: `Document Summary: ${parsedDoc.fileName}`,
        author: 'Edu-Analyst AI',
        markdown: summary,
        timestamp: Date.now(),
        url: '',
        analysis_id: analysisId,
      };

      // Store in history
      const historyItem: HistoryItem = {
        analysis_id: analysisId,
        title: result.title,
        timestamp: result.timestamp,
        input_type: 'text',
        url: '',
      };

      analysisHistory.unshift(historyItem);
      analysisResults.set(analysisId, result);

      // Keep only last 50 items
      if (analysisHistory.length > 50) {
        const removed = analysisHistory.pop();
        if (removed) {
          analysisResults.delete(removed.analysis_id);
        }
      }

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`Document summarization completed in ${elapsed.toFixed(2)}s, ID: ${analysisId}`);

      return res.json(successResponse(result));
    } catch (error) {
      console.error('Document summarization error:', error);

      if (error instanceof DocumentServiceError) {
        return res.status(400).json(errorResponse(error.message));
      }

      if (error instanceof LLMServiceError) {
        return res.status(500).json(errorResponse(error.message));
      }

      return res.status(500).json(
        errorResponse('An unexpected error occurred while processing the document.')
      );
    }
  }
);

/**
 * POST /api/analyze-image
 * Upload and analyze an image using multimodal AI
 */
router.post(
  '/analyze-image',
  upload.single('file'),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const analysisId = generateId();

    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json(
          errorResponse('No file uploaded. Please upload a PNG, JPG, GIF, or WebP image.')
        );
      }

      // Validate file type
      if (!SUPPORTED_IMAGE_TYPES.includes(req.file.mimetype)) {
        return res.status(400).json(
          errorResponse(
            `Unsupported file type: ${req.file.mimetype}. Supported types: PNG, JPG, GIF, WebP`
          )
        );
      }

      // Parse word count from request body
      const wordCount = parseInt(req.body.wordCount) || 300;
      if (!VALID_WORD_COUNTS.includes(wordCount)) {
        return res.status(400).json(
          errorResponse(
            `Invalid word count: ${wordCount}. Valid options: ${VALID_WORD_COUNTS.join(', ')}`
          )
        );
      }

      // Parse optional language from request body
      const language = req.body.language === 'zh-TW' ? 'zh-TW' : undefined;

      console.log(`Processing image: ${req.file.originalname} (${req.file.mimetype})${language === 'zh-TW' ? ' [Traditional Chinese]' : ''}`);
      console.log(`Target analysis length: ${wordCount} words`);

      // Analyze with multimodal AI
      const imageService = getImageService();
      const analysisResult = await imageService.analyzeImage(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
        wordCount,
        language
      );

      // Build result
      const result: AnalysisResult = {
        title: `Image Analysis: ${analysisResult.fileName}`,
        author: 'Edu-Analyst AI',
        markdown: analysisResult.analysis,
        timestamp: Date.now(),
        url: '',
        analysis_id: analysisId,
      };

      // Store in history
      const historyItem: HistoryItem = {
        analysis_id: analysisId,
        title: result.title,
        timestamp: result.timestamp,
        input_type: 'text',
        url: '',
      };

      analysisHistory.unshift(historyItem);
      analysisResults.set(analysisId, result);

      // Keep only last 50 items
      if (analysisHistory.length > 50) {
        const removed = analysisHistory.pop();
        if (removed) {
          analysisResults.delete(removed.analysis_id);
        }
      }

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`Image analysis completed in ${elapsed.toFixed(2)}s, ID: ${analysisId}`);

      return res.json(successResponse(result));
    } catch (error) {
      console.error('Image analysis error:', error);

      if (error instanceof ImageServiceError) {
        return res.status(400).json(errorResponse(error.message));
      }

      return res.status(500).json(
        errorResponse('An unexpected error occurred while analyzing the image.')
      );
    }
  }
);

/**
 * POST /api/analyze-audio
 * Upload and analyze an audio file using multimodal AI
 */
router.post(
  '/analyze-audio',
  upload.single('file'),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const analysisId = generateId();

    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json(
          errorResponse('No file uploaded. Please upload an MP3, WAV, OGG, or M4A audio file.')
        );
      }

      // Validate file type (check both MIME type and file extension)
      const fileExtension = req.file.originalname.toLowerCase().split('.').pop();
      const isValidMimeType = SUPPORTED_AUDIO_TYPES.includes(req.file.mimetype);
      const isValidExtension = ['mp3', 'wav', 'ogg', 'webm', 'm4a', 'flac', 'mp4'].includes(fileExtension || '');

      if (!isValidMimeType && !isValidExtension) {
        return res.status(400).json(
          errorResponse(
            `Unsupported file type: ${req.file.mimetype}. Supported types: MP3, WAV, OGG, M4A, FLAC`
          )
        );
      }

      // Parse word count from request body
      const wordCount = parseInt(req.body.wordCount) || 300;
      if (!VALID_WORD_COUNTS.includes(wordCount)) {
        return res.status(400).json(
          errorResponse(
            `Invalid word count: ${wordCount}. Valid options: ${VALID_WORD_COUNTS.join(', ')}`
          )
        );
      }

      // Parse optional language from request body
      const language = req.body.language === 'zh-TW' ? 'zh-TW' : undefined;

      console.log(`Processing audio: ${req.file.originalname} (${req.file.mimetype})${language === 'zh-TW' ? ' [Traditional Chinese]' : ''}`);
      console.log(`Target analysis length: ${wordCount} words`);

      // Analyze with multimodal AI
      const audioService = getAudioService();
      const analysisResult = await audioService.analyzeAudio(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
        wordCount,
        language
      );

      // Build result
      const result: AnalysisResult = {
        title: `Audio Analysis: ${analysisResult.fileName}`,
        author: 'Edu-Analyst AI',
        markdown: analysisResult.analysis,
        timestamp: Date.now(),
        url: '',
        analysis_id: analysisId,
      };

      // Store in history
      const historyItem: HistoryItem = {
        analysis_id: analysisId,
        title: result.title,
        timestamp: result.timestamp,
        input_type: 'text',
        url: '',
      };

      analysisHistory.unshift(historyItem);
      analysisResults.set(analysisId, result);

      // Keep only last 50 items
      if (analysisHistory.length > 50) {
        const removed = analysisHistory.pop();
        if (removed) {
          analysisResults.delete(removed.analysis_id);
        }
      }

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`Audio analysis completed in ${elapsed.toFixed(2)}s, ID: ${analysisId}`);

      return res.json(successResponse(result));
    } catch (error) {
      console.error('Audio analysis error:', error);

      if (error instanceof AudioServiceError) {
        return res.status(400).json(errorResponse(error.message));
      }

      return res.status(500).json(
        errorResponse('An unexpected error occurred while analyzing the audio.')
      );
    }
  }
);

export default router;
