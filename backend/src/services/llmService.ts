/**
 * LLM service for educational content analysis
 * Uses Google Gemini API via @google/generative-ai SDK
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { config } from '../config.js';
import { CacheManager, getCache } from '../utils/cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class LLMServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMServiceError';
  }
}

export class LLMService {
  private genAI: GoogleGenerativeAI;
  private cache: CacheManager<string>;
  private systemPrompt: string | null = null;

  constructor() {
    if (!config.geminiApiKey) {
      throw new LLMServiceError('GEMINI_API_KEY is not configured');
    }

    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.cache = getCache({ defaultTtl: config.cacheTtl });
  }

  /**
   * Load the system prompt from file
   */
  private loadSystemPrompt(): string {
    if (this.systemPrompt) {
      return this.systemPrompt;
    }

    try {
      const promptPath = join(__dirname, '..', 'prompts', 'analyst_v2.txt');
      this.systemPrompt = readFileSync(promptPath, 'utf-8');
    } catch {
      console.warn('System prompt file not found, using default');
      this.systemPrompt = this.getDefaultPrompt();
    }

    return this.systemPrompt;
  }

  /**
   * Get the default system prompt if file is not found
   */
  private getDefaultPrompt(): string {
    return `## Role
You are an elite Educational Content Analyst specializing in transforming video transcripts into comprehensive academic resources.

## Task Definition
Your objective is to analyze the provided **YouTube Video Transcript**. You are to treat this transcript as the primary source of truth. Your goal is to synthesize this raw spoken content into a structured academic overview.

## Definitions and Specifications
- **Transcript Content:** The raw text provided to you representing the spoken word of the video.
- **Educational Analysis Summary:** A markdown-formatted document containing structured analysis.

## Output Format
Generate a professional markdown dashboard with the following sections:

### 1. Executive Summary
A concise 2-3 paragraph overview of the video's main thesis and key takeaways.

### 2. Key Learning Objectives
Bulleted list of 3-5 specific learning outcomes viewers should achieve.

### 3. Core Concepts Deep Dive
Detailed breakdown of main concepts with:
- Definition
- Context/explanation
- Real-world applications

### 4. Critical Arguments & Evidence
Analysis of the presenter's main arguments:
- Central claims made
- Evidence or examples provided
- Logical structure of arguments

### 5. Educational Value Assessment
Evaluate the pedagogical quality:
- Target audience level (beginner/intermediate/advanced)
- Teaching methodology used
- Strengths and potential gaps

### 6. Practical Applications
Specific ways viewers can apply the knowledge:
- Immediate action items
- Long-term implementation strategies
- Related skills to develop

### 7. Further Learning Resources
Suggest related topics and areas for deeper exploration based on the content.

## Constraints
- Use ONLY the information provided in the transcript
- Do not hallucinate or add external facts not present in the source
- Maintain academic objectivity and professional tone
- If content is unclear or insufficient, note this explicitly`;
  }

  /**
   * Build the full prompt with transcript injected
   */
  private buildAnalysisPrompt(transcript: string, videoId?: string, targetWordCount?: number, language?: string): string {
    const systemPrompt = this.loadSystemPrompt();

    const videoContext = videoId
      ? `\n\n**Video Reference:** https://youtube.com/watch?v=${videoId}\n`
      : '';

    const wordCountInstruction = targetWordCount
      ? `\n\n**Important:** Keep your analysis to approximately ${targetWordCount} words total while maintaining the key sections and educational value.\n`
      : '';

    const languageInstruction = language === 'zh-TW'
      ? `\n\n**Language Requirement:** You MUST write your entire analysis in Traditional Chinese (繁體中文). All section headers, content, and explanations must be in Traditional Chinese.\n`
      : '';

    return `${systemPrompt}${wordCountInstruction}${languageInstruction}

---

## Transcript Content${videoContext}

<transcript>
${transcript}
</transcript>

---

Please analyze this transcript following the output format specified above. Ensure your analysis is thorough, objective, and academically rigorous.${language === 'zh-TW' ? ' 請使用繁體中文撰寫完整分析報告。' : ''}`;
  }

  /**
   * Analyze a transcript and generate educational summary
   */
  async analyzeTranscript(
    transcript: string,
    videoId?: string,
    useCache: boolean = true,
    targetWordCount?: number,
    language?: string
  ): Promise<string> {
    // Generate cache key (include word count and language to differentiate cached versions)
    const cacheKey = CacheManager.generateKey(
      transcript.slice(0, 1000) + (videoId || '') + (targetWordCount || '') + (language || '')
    );

    // Check cache first
    if (useCache && config.cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log(`Returning cached analysis for key: ${cacheKey}`);
        return cached;
      }
    }

    // Build the full prompt
    const prompt = this.buildAnalysisPrompt(transcript, videoId, targetWordCount, language);

    const startTime = Date.now();

    try {
      console.log(`Calling Gemini API with model: gemini-2.5-flash`);

      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const response = await model.generateContent(prompt);
      const result = response.response.text();

      if (!result) {
        throw new LLMServiceError('Gemini returned empty response');
      }

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`Analysis completed in ${elapsed.toFixed(2)}s`);

      // Cache the result
      if (useCache && config.cacheEnabled) {
        this.cache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Gemini API error:', error);
      throw new LLMServiceError(`Analysis failed: ${message}`);
    }
  }

  /**
   * Estimate the cost of analyzing a transcript
   */
  estimateCost(transcript: string): {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  } {
    // Rough token estimate (1.3 tokens per word)
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const inputTokens = Math.ceil(wordCount * 1.3);
    const outputTokens = 2000; // Estimated output

    // Gemini 1.5 Flash pricing (as of 2024)
    const inputCost = (inputTokens / 1_000_000) * 0.075;
    const outputCost = (outputTokens / 1_000_000) * 0.3;

    return {
      inputTokens,
      outputTokens,
      estimatedCostUsd: Math.round((inputCost + outputCost) * 10000) / 10000,
    };
  }

  /**
   * Build prompt for document summarization
   */
  private buildDocumentSummaryPrompt(text: string, fileName: string, targetWordCount: number, language?: string): string {
    const languageInstruction = language === 'zh-TW'
      ? `\n\n**Language Requirement:** You MUST write your entire summary in Traditional Chinese (繁體中文). All section headers, content, and explanations must be in Traditional Chinese.`
      : '';

    const finalInstruction = language === 'zh-TW'
      ? ' 請使用繁體中文撰寫完整摘要報告。'
      : '';

    return `## Role
You are an expert Educational Document Analyst specializing in summarizing educational materials, academic papers, and learning resources.

## Task
Analyze the following document and provide an educational summary of approximately ${targetWordCount} words. Focus on extracting key educational concepts and learning points.${languageInstruction}

## Document Information
**File Name:** ${fileName}

## Output Format
Provide a structured educational summary including:

### Document Overview
A brief description of what type of document this is and its main purpose.

### Key Concepts
The main educational concepts, theories, or ideas presented in the document.

### Important Points
- Bulleted list of the most important facts, findings, or arguments
- Focus on information that would be valuable for learning

### Learning Outcomes
What a student could learn from this document.

### Summary
A concise summary of the document's main message and educational value.

## Constraints
- Keep your response to approximately ${targetWordCount} words
- Focus on educational value and learning outcomes
- Use clear, accessible language
- Be objective and accurate

---

## Document Content

<document>
${text}
</document>

---

Please provide your educational summary following the format above.${finalInstruction}`;
  }

  /**
   * Summarize a document for educational purposes
   */
  async summarizeDocument(
    text: string,
    fileName: string,
    targetWordCount: number = 300,
    language?: string
  ): Promise<string> {
    const startTime = Date.now();

    try {
      console.log(`Summarizing document: ${fileName}${language === 'zh-TW' ? ' (Traditional Chinese)' : ''}`);

      const prompt = this.buildDocumentSummaryPrompt(text, fileName, targetWordCount, language);

      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const response = await model.generateContent(prompt);
      const result = response.response.text();

      if (!result) {
        throw new LLMServiceError('Gemini returned empty response for document summary');
      }

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`Document summarization completed in ${elapsed.toFixed(2)}s`);

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Document summarization error:', error);
      throw new LLMServiceError(`Document summarization failed: ${message}`);
    }
  }
}

// Singleton instance
let llmServiceInstance: LLMService | null = null;

export function getLLMService(): LLMService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService();
  }
  return llmServiceInstance;
}

export default LLMService;
