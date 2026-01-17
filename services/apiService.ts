/**
 * API Service for Edu-Analyst AI
 * Communicates with the FastAPI backend for educational video analysis.
 *
 * This replaces direct Gemini API calls with backend API calls,
 * implementing the "Source-First" architecture where the backend
 * handles transcript extraction and LLM context injection.
 */

import { AnalysisStatus, AnalysisResult } from "../types";

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Language type
export type Language = "en" | "zh-TW";

// Types matching backend schemas
interface AnalyzeRequest {
  input: string;
  input_type: "url" | "text";
  wordCount?: number;
  language?: Language;
}

interface AnalyzeResponse {
  status: "success" | "error";
  result: {
    title: string;
    author: string;
    markdown: string;
    timestamp: number;
    url: string;
    analysis_id: string;
  } | null;
  error: string | null;
}

interface HistoryItem {
  analysis_id: string;
  title: string;
  timestamp: number;
  input_type: "url" | "text";
  url: string;
}

interface HistoryResponse {
  analyses: HistoryItem[];
}

interface HealthResponse {
  status: string;
  version: string;
  llm_provider: string;
  cache_enabled: boolean;
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * API Service class for backend communication
 */
export class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if the backend API is healthy
   */
  async checkHealth(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/api/health`);

    if (!response.ok) {
      throw new ApiError("Backend API is not available", response.status);
    }

    return response.json();
  }

  /**
   * Analyze YouTube video or transcript text
   *
   * @param input - YouTube URL or transcript text
   * @param isUrl - Whether the input is a URL
   * @param onStatusChange - Callback for status updates
   * @param wordCount - Optional target word count for the analysis
   * @param language - Optional language for the analysis output
   * @returns The markdown analysis result
   */
  async analyze(
    input: string,
    isUrl: boolean,
    onStatusChange: (status: AnalysisStatus) => void,
    wordCount?: WordCountOption,
    language?: Language
  ): Promise<AnalysisResult> {
    // Update status: fetching transcript
    onStatusChange(AnalysisStatus.FETCHING);

    const requestBody: AnalyzeRequest = {
      input: input.trim(),
      input_type: isUrl ? "url" : "text",
      wordCount: wordCount,
      language: language,
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      // Update status: analyzing content
      onStatusChange(AnalysisStatus.ANALYZING);

      // Handle rate limiting
      if (response.status === 429) {
        throw new ApiError(
          "Rate limit exceeded. Please wait a moment before trying again.",
          429
        );
      }

      // Handle server errors
      if (response.status >= 500) {
        throw new ApiError(
          "Server error. Please try again later.",
          response.status
        );
      }

      const data: AnalyzeResponse = await response.json();

      // Handle API-level errors
      if (data.status === "error" || !data.result) {
        throw new ApiError(
          data.error || "Analysis failed. Please try again.",
          response.status,
          data.error || undefined
        );
      }

      // Update status: summarizing
      onStatusChange(AnalysisStatus.SUMMARIZING);

      // Return the result in the format expected by the frontend
      return {
        title: data.result.title,
        author: data.result.author,
        markdown: data.result.markdown,
        timestamp: data.result.timestamp,
        url: data.result.url,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new ApiError(
          "Cannot connect to the server. Please check if the backend is running.",
          0
        );
      }

      throw new ApiError(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    }
  }

  /**
   * Get analysis history
   *
   * @param limit - Maximum number of items to return
   * @returns List of recent analyses
   */
  async getHistory(limit: number = 10): Promise<HistoryItem[]> {
    const response = await fetch(
      `${this.baseUrl}/api/history?limit=${limit}`
    );

    if (!response.ok) {
      throw new ApiError("Failed to fetch history", response.status);
    }

    const data: HistoryResponse = await response.json();
    return data.analyses;
  }

  /**
   * Get a specific analysis by ID
   *
   * @param analysisId - The analysis ID
   * @returns The analysis result
   */
  async getAnalysis(analysisId: string): Promise<AnalysisResult> {
    const response = await fetch(
      `${this.baseUrl}/api/analysis/${analysisId}`
    );

    if (response.status === 404) {
      throw new ApiError("Analysis not found", 404);
    }

    if (!response.ok) {
      throw new ApiError("Failed to fetch analysis", response.status);
    }

    const data: AnalyzeResponse = await response.json();

    if (!data.result) {
      throw new ApiError("Analysis data is missing");
    }

    return {
      title: data.result.title,
      author: data.result.author,
      markdown: data.result.markdown,
      timestamp: data.result.timestamp,
      url: data.result.url,
    };
  }

  /**
   * Delete an analysis from history
   *
   * @param analysisId - The analysis ID to delete
   */
  async deleteAnalysis(analysisId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/history/${analysisId}`,
      { method: "DELETE" }
    );

    if (response.status === 404) {
      throw new ApiError("Analysis not found", 404);
    }

    if (!response.ok) {
      throw new ApiError("Failed to delete analysis", response.status);
    }
  }
}

// Export a singleton instance for convenience
export const apiService = new ApiService();

/**
 * Legacy-compatible analyze function
 * Drop-in replacement for the old GeminiAnalyzer.analyze method
 */
export async function analyzeContent(
  input: string,
  isUrl: boolean,
  onStatusChange: (status: AnalysisStatus) => void
): Promise<string> {
  const result = await apiService.analyze(input, isUrl, onStatusChange);
  return result.markdown;
}

// Valid word count options for summaries
export const WORD_COUNT_OPTIONS = [150, 250, 300, 500, 1000] as const;
export type WordCountOption = (typeof WORD_COUNT_OPTIONS)[number];

/**
 * Upload and summarize a document (PDF, DOCX, TXT)
 */
export async function summarizeDocument(
  file: File,
  wordCount: WordCountOption,
  onStatusChange: (status: AnalysisStatus) => void,
  language?: Language
): Promise<AnalysisResult> {
  onStatusChange(AnalysisStatus.FETCHING);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("wordCount", wordCount.toString());
  if (language) {
    formData.append("language", language);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/summarize-document`, {
      method: "POST",
      body: formData,
    });

    onStatusChange(AnalysisStatus.ANALYZING);

    if (response.status === 429) {
      throw new ApiError(
        "Rate limit exceeded. Please wait a moment before trying again.",
        429
      );
    }

    if (response.status >= 500) {
      throw new ApiError("Server error. Please try again later.", response.status);
    }

    const data: AnalyzeResponse = await response.json();

    if (data.status === "error" || !data.result) {
      throw new ApiError(
        data.error || "Document summarization failed. Please try again.",
        response.status,
        data.error || undefined
      );
    }

    onStatusChange(AnalysisStatus.SUMMARIZING);

    return {
      title: data.result.title,
      author: data.result.author,
      markdown: data.result.markdown,
      timestamp: data.result.timestamp,
      url: data.result.url,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new ApiError(
        "Cannot connect to the server. Please check if the backend is running.",
        0
      );
    }

    throw new ApiError(
      error instanceof Error ? error.message : "An unexpected error occurred"
    );
  }
}

/**
 * Upload and analyze an image using multimodal AI
 */
export async function analyzeImage(
  file: File,
  wordCount: WordCountOption,
  onStatusChange: (status: AnalysisStatus) => void,
  language?: Language
): Promise<AnalysisResult> {
  onStatusChange(AnalysisStatus.FETCHING);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("wordCount", wordCount.toString());
  if (language) {
    formData.append("language", language);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze-image`, {
      method: "POST",
      body: formData,
    });

    onStatusChange(AnalysisStatus.ANALYZING);

    if (response.status === 429) {
      throw new ApiError(
        "Rate limit exceeded. Please wait a moment before trying again.",
        429
      );
    }

    if (response.status >= 500) {
      throw new ApiError("Server error. Please try again later.", response.status);
    }

    const data: AnalyzeResponse = await response.json();

    if (data.status === "error" || !data.result) {
      throw new ApiError(
        data.error || "Image analysis failed. Please try again.",
        response.status,
        data.error || undefined
      );
    }

    onStatusChange(AnalysisStatus.SUMMARIZING);

    return {
      title: data.result.title,
      author: data.result.author,
      markdown: data.result.markdown,
      timestamp: data.result.timestamp,
      url: data.result.url,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new ApiError(
        "Cannot connect to the server. Please check if the backend is running.",
        0
      );
    }

    throw new ApiError(
      error instanceof Error ? error.message : "An unexpected error occurred"
    );
  }
}

/**
 * Upload and analyze an audio file using multimodal AI
 */
export async function analyzeAudio(
  file: File,
  wordCount: WordCountOption,
  onStatusChange: (status: AnalysisStatus) => void,
  language?: Language
): Promise<AnalysisResult> {
  onStatusChange(AnalysisStatus.FETCHING);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("wordCount", wordCount.toString());
  if (language) {
    formData.append("language", language);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze-audio`, {
      method: "POST",
      body: formData,
    });

    onStatusChange(AnalysisStatus.ANALYZING);

    if (response.status === 429) {
      throw new ApiError(
        "Rate limit exceeded. Please wait a moment before trying again.",
        429
      );
    }

    if (response.status >= 500) {
      throw new ApiError("Server error. Please try again later.", response.status);
    }

    const data: AnalyzeResponse = await response.json();

    if (data.status === "error" || !data.result) {
      throw new ApiError(
        data.error || "Audio analysis failed. Please try again.",
        response.status,
        data.error || undefined
      );
    }

    onStatusChange(AnalysisStatus.SUMMARIZING);

    return {
      title: data.result.title,
      author: data.result.author,
      markdown: data.result.markdown,
      timestamp: data.result.timestamp,
      url: data.result.url,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new ApiError(
        "Cannot connect to the server. Please check if the backend is running.",
        0
      );
    }

    throw new ApiError(
      error instanceof Error ? error.message : "An unexpected error occurred"
    );
  }
}
