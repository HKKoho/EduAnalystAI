/**
 * Zod schemas for request/response validation
 * These schemas align with the frontend TypeScript types
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const AnalysisStatusEnum = z.enum([
  'idle',
  'fetching_transcript',
  'analyzing_content',
  'summarizing',
  'completed',
  'error',
]);

export type AnalysisStatus = z.infer<typeof AnalysisStatusEnum>;

// ============================================================================
// Request Schemas
// ============================================================================

export const AnalyzeRequestSchema = z.object({
  input: z
    .string()
    .min(1, 'Input cannot be empty')
    .max(500000, 'Input too long'),
  input_type: z.enum(['url', 'text']).default('url'),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const AnalysisResultSchema = z.object({
  title: z.string(),
  author: z.string().default('Edu-Analyst AI'),
  markdown: z.string(),
  timestamp: z.number(),
  url: z.string().default(''),
  analysis_id: z.string(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const AnalyzeResponseSchema = z.object({
  status: z.enum(['success', 'error']),
  result: AnalysisResultSchema.nullable(),
  error: z.string().nullable(),
});

export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

export const HealthResponseSchema = z.object({
  status: z.string(),
  version: z.string(),
  llm_provider: z.string(),
  cache_enabled: z.boolean(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const HistoryItemSchema = z.object({
  analysis_id: z.string(),
  title: z.string(),
  timestamp: z.number(),
  input_type: z.enum(['url', 'text']),
  url: z.string().default(''),
});

export type HistoryItem = z.infer<typeof HistoryItemSchema>;

export const HistoryResponseSchema = z.object({
  analyses: z.array(HistoryItemSchema),
});

export type HistoryResponse = z.infer<typeof HistoryResponseSchema>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * YouTube URL patterns for validation
 */
const YOUTUBE_PATTERNS = [
  /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
  /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
  /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+/,
  /^(https?:\/\/)?(www\.)?youtube\.com\/v\/[\w-]+/,
];

/**
 * Check if input looks like a YouTube URL
 */
export function isYouTubeUrl(input: string): boolean {
  return YOUTUBE_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Extract YouTube video ID from URL
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([\w-]{11})/,
    /^([\w-]{11})$/, // Just the video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Create a successful response
 */
export function successResponse(result: AnalysisResult): AnalyzeResponse {
  return {
    status: 'success',
    result,
    error: null,
  };
}

/**
 * Create an error response
 */
export function errorResponse(error: string): AnalyzeResponse {
  return {
    status: 'error',
    result: null,
    error,
  };
}
