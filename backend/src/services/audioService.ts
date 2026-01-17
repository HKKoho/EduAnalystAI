/**
 * Audio service for transcription and educational analysis
 * Uses Google Gemini's multimodal capabilities
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';

export class AudioServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioServiceError';
  }
}

export const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg',      // MP3
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/flac',
];

export interface AudioAnalysisResult {
  analysis: string;
  fileName: string;
  mimeType: string;
}

export class AudioService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    if (!config.geminiApiKey) {
      throw new AudioServiceError('GEMINI_API_KEY is not configured');
    }
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
  }

  /**
   * Build the educational analysis prompt for audio content
   */
  private buildAnalysisPrompt(fileName: string, targetWordCount: number, language?: string): string {
    const languageInstruction = language === 'zh-TW'
      ? `\n\n**Language Requirement:** You MUST write your entire analysis in Traditional Chinese (繁體中文). All section headers, content, and explanations must be in Traditional Chinese.`
      : '';

    const finalInstruction = language === 'zh-TW'
      ? ' 請使用繁體中文撰寫完整分析報告。'
      : '';

    return `## Role
You are an expert Educational Audio Analyst specializing in analyzing spoken educational content, lectures, podcasts, and audio learning materials.

## Task
First, transcribe the audio content, then analyze it and provide an educational summary of approximately ${targetWordCount} words. Focus on extracting key educational concepts and learning points.${languageInstruction}

## Audio Information
**File Name:** ${fileName}

## Output Format
Provide a structured educational analysis including:

### Audio Transcript Summary
A brief overview of what was discussed in the audio.

### Key Topics Covered
The main topics, themes, or subjects discussed in the audio.

### Important Points
- Bulleted list of the most important facts, concepts, or arguments presented
- Focus on information that would be valuable for learning

### Key Terminology
Important terms, definitions, or concepts introduced or explained.

### Learning Outcomes
What a listener could learn from this audio content.

### Practical Applications
How the knowledge from this audio can be applied in real-world situations.

### Summary
A concise summary of the audio's main message and educational value.

## Constraints
- Keep your response to approximately ${targetWordCount} words
- Focus on educational value and learning outcomes
- Use clear, accessible language
- Be objective and accurate
- If the audio quality is poor or content is unclear, note this explicitly${finalInstruction}`;
  }

  /**
   * Analyze audio file for educational content
   */
  async analyzeAudio(
    audioBuffer: Buffer,
    mimeType: string,
    fileName: string,
    targetWordCount: number = 300,
    language?: string
  ): Promise<AudioAnalysisResult> {
    const startTime = Date.now();

    try {
      console.log(`Analyzing audio: ${fileName} (${mimeType})${language === 'zh-TW' ? ' [Traditional Chinese]' : ''}`);

      // Convert buffer to base64
      const base64Audio = audioBuffer.toString('base64');

      // Build the prompt
      const prompt = this.buildAnalysisPrompt(fileName, targetWordCount, language);

      // Create the model with multimodal capabilities
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Send audio with prompt
      const response = await model.generateContent([
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio,
          },
        },
        { text: prompt },
      ]);

      const result = response.response.text();

      if (!result) {
        throw new AudioServiceError('Gemini returned empty response for audio analysis');
      }

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`Audio analysis completed in ${elapsed.toFixed(2)}s`);

      return {
        analysis: result,
        fileName,
        mimeType,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Audio analysis error:', error);
      throw new AudioServiceError(`Audio analysis failed: ${message}`);
    }
  }
}

// Singleton instance
let audioServiceInstance: AudioService | null = null;

export function getAudioService(): AudioService {
  if (!audioServiceInstance) {
    audioServiceInstance = new AudioService();
  }
  return audioServiceInstance;
}

export default AudioService;
