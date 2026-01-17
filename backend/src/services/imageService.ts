/**
 * Image Service for multimodal analysis
 * Handles image processing and sends to Gemini for visual analysis
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';

export class ImageServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageServiceError';
  }
}

export interface ImageAnalysisResult {
  analysis: string;
  fileName: string;
  wordCount: number;
}

export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
];

export const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

/**
 * Build the educational image analysis prompt
 */
function buildImageAnalysisPrompt(targetWordCount: number, language?: string): string {
  const languageInstruction = language === 'zh-TW'
    ? `\n\n**Language Requirement:** You MUST write your entire analysis in Traditional Chinese (繁體中文). All section headers, content, and explanations must be in Traditional Chinese.`
    : '';

  const finalInstruction = language === 'zh-TW'
    ? ' 請使用繁體中文撰寫完整分析報告。'
    : '';

  return `## Role
You are an expert Educational Visual Analyst specializing in extracting educational insights from images, diagrams, charts, and visual content.

## Task
Analyze this image and provide an educational summary that would help students or learners understand the content. Your analysis should be approximately ${targetWordCount} words.${languageInstruction}

## Output Format
Provide a structured educational analysis including:

### Visual Overview
Describe what is shown in the image (diagram, chart, photograph, illustration, etc.)

### Key Educational Concepts
Identify and explain the main educational concepts, ideas, or information conveyed by the image.

### Learning Points
List 3-5 specific things a student could learn from this visual.

### Context & Applications
Explain how this visual content relates to real-world learning or practical applications.

### Study Tips
Provide brief tips on how to effectively use or remember the information in this image.

## Constraints
- Keep your response to approximately ${targetWordCount} words
- Focus on educational value and learning outcomes
- Use clear, accessible language suitable for students
- Be objective and accurate in your descriptions${finalInstruction}`;
}

export class ImageService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    if (!config.geminiApiKey) {
      throw new ImageServiceError('GEMINI_API_KEY is not configured');
    }
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
  }

  /**
   * Analyze an image using Gemini's multimodal capabilities
   */
  async analyzeImage(
    imageBuffer: Buffer,
    mimeType: string,
    fileName: string,
    targetWordCount: number = 300,
    language?: string
  ): Promise<ImageAnalysisResult> {
    const startTime = Date.now();

    try {
      console.log(`Analyzing image: ${fileName} (${mimeType})${language === 'zh-TW' ? ' [Traditional Chinese]' : ''}`);

      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');

      // Build the prompt
      const prompt = buildImageAnalysisPrompt(targetWordCount, language);

      // Get the generative model (gemini-2.5-flash supports vision)
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Call Gemini with multimodal content
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Image,
          },
        },
        prompt,
      ]);

      const response = await result.response;
      const analysis = response.text();

      if (!analysis) {
        throw new ImageServiceError('Gemini returned empty response for image analysis');
      }

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`Image analysis completed in ${elapsed.toFixed(2)}s`);

      const actualWordCount = analysis.split(/\s+/).filter(Boolean).length;

      return {
        analysis,
        fileName,
        wordCount: actualWordCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Image analysis error:', error);
      throw new ImageServiceError(`Image analysis failed: ${message}`);
    }
  }
}

// Singleton instance
let imageServiceInstance: ImageService | null = null;

export function getImageService(): ImageService {
  if (!imageServiceInstance) {
    imageServiceInstance = new ImageService();
  }
  return imageServiceInstance;
}
