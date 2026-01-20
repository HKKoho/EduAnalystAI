/**
 * API Routes for Edu-Analyst AI
 * Implements the "Source-First" architecture
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';

import { config } from '../config.js';
import {
  AnalyzeRequestSchema,
  AnalysisResult,
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
import {
  getDatabaseService,
  InputType,
  SourceType,
} from '../services/databaseService.js';

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

// Get database service instance
const db = getDatabaseService();

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

    // Save to database
    const savedAnalysis = await db.createAnalysis({
      title,
      inputType: isUrl ? InputType.url : InputType.text,
      language: language,
      wordCount: validWordCount,
      sourceUrl: isUrl ? input : undefined,
      videoId: videoId || undefined,
      sourceText: cleanedTranscript,
      sourceType: isUrl ? SourceType.youtube_transcript : SourceType.direct_text,
      markdown: markdownResult,
    });

    // Build result for response
    const result: AnalysisResult = {
      title,
      author: 'Edu-Analyst AI',
      markdown: markdownResult,
      timestamp: savedAnalysis.createdAt.getTime(),
      url: isUrl ? input : '',
      analysis_id: savedAnalysis.id,
    };

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`Analysis completed in ${elapsed.toFixed(2)}s, ID: ${savedAnalysis.id}`);

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
router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(
      parseInt(req.query.limit as string) || 10,
      50
    );
    const offset = parseInt(req.query.offset as string) || 0;

    const analyses = await db.getHistory(limit, offset);
    const total = await db.getAnalysisCount();

    return res.json({
      analyses: analyses.map(a => ({
        analysis_id: a.id,
        title: a.title,
        timestamp: a.createdAt.getTime(),
        input_type: a.inputType,
        url: a.sourceUrl || '',
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('History fetch error:', error);
    return res.status(500).json(errorResponse('Failed to fetch history'));
  }
});

/**
 * GET /api/analysis/:id
 * Retrieve a specific analysis by ID (includes source content)
 */
router.get('/analysis/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const analysis = await db.getAnalysis(id);

    if (!analysis) {
      return res.status(404).json(
        errorResponse(`Analysis with ID '${id}' not found`)
      );
    }

    return res.json({
      status: 'success',
      result: {
        title: analysis.title,
        author: analysis.author,
        markdown: analysis.markdown,
        timestamp: analysis.createdAt.getTime(),
        url: analysis.sourceUrl || '',
        analysis_id: analysis.id,
        // Include source content for full record
        source: {
          text: analysis.sourceText,
          type: analysis.sourceType,
          fileName: analysis.fileName,
          videoId: analysis.videoId,
          wordCount: analysis.wordCount,
          language: analysis.language,
          fileSize: analysis.fileSize,
          mimeType: analysis.mimeType,
        },
      },
      error: null,
    });
  } catch (error) {
    console.error('Analysis fetch error:', error);
    return res.status(500).json(errorResponse('Failed to fetch analysis'));
  }
});

/**
 * DELETE /api/history/:id
 * Delete an analysis from history
 */
router.delete('/history/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteAnalysis(id);

    if (!deleted) {
      return res.status(404).json(
        errorResponse(`Analysis with ID '${id}' not found`)
      );
    }

    return res.json({
      status: 'success',
      message: `Analysis ${id} deleted`,
    });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json(errorResponse('Failed to delete analysis'));
  }
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

      // Determine source type based on file extension
      const fileExt = parsedDoc.fileName.toLowerCase().split('.').pop();
      let sourceType: SourceType;
      if (fileExt === 'pdf') {
        sourceType = SourceType.pdf_document;
      } else if (fileExt === 'docx') {
        sourceType = SourceType.docx_document;
      } else {
        sourceType = SourceType.txt_document;
      }

      // Save to database
      const savedAnalysis = await db.createAnalysis({
        title: `Document Summary: ${parsedDoc.fileName}`,
        inputType: InputType.document,
        language: language,
        wordCount: wordCount,
        sourceText: parsedDoc.text,
        sourceType: sourceType,
        fileName: parsedDoc.fileName,
        markdown: summary,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      });

      // Build result for response
      const result: AnalysisResult = {
        title: `Document Summary: ${parsedDoc.fileName}`,
        author: 'Edu-Analyst AI',
        markdown: summary,
        timestamp: savedAnalysis.createdAt.getTime(),
        url: '',
        analysis_id: savedAnalysis.id,
      };

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`Document summarization completed in ${elapsed.toFixed(2)}s, ID: ${savedAnalysis.id}`);

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

      // Save to database (store base64 of image as source)
      const savedAnalysis = await db.createAnalysis({
        title: `Image Analysis: ${analysisResult.fileName}`,
        inputType: InputType.image,
        language: language,
        wordCount: wordCount,
        sourceText: `[Image file: ${analysisResult.fileName}]`, // Description instead of actual data
        sourceType: SourceType.image_file,
        fileName: analysisResult.fileName,
        markdown: analysisResult.analysis,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      });

      // Build result for response
      const result: AnalysisResult = {
        title: `Image Analysis: ${analysisResult.fileName}`,
        author: 'Edu-Analyst AI',
        markdown: analysisResult.analysis,
        timestamp: savedAnalysis.createdAt.getTime(),
        url: '',
        analysis_id: savedAnalysis.id,
      };

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`Image analysis completed in ${elapsed.toFixed(2)}s, ID: ${savedAnalysis.id}`);

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

      // Save to database
      const savedAnalysis = await db.createAnalysis({
        title: `Audio Analysis: ${analysisResult.fileName}`,
        inputType: InputType.audio,
        language: language,
        wordCount: wordCount,
        sourceText: `[Audio file: ${analysisResult.fileName}]`, // Description instead of actual data
        sourceType: SourceType.audio_file,
        fileName: analysisResult.fileName,
        markdown: analysisResult.analysis,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      });

      // Build result for response
      const result: AnalysisResult = {
        title: `Audio Analysis: ${analysisResult.fileName}`,
        author: 'Edu-Analyst AI',
        markdown: analysisResult.analysis,
        timestamp: savedAnalysis.createdAt.getTime(),
        url: '',
        analysis_id: savedAnalysis.id,
      };

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`Audio analysis completed in ${elapsed.toFixed(2)}s, ID: ${savedAnalysis.id}`);

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
