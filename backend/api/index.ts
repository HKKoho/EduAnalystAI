import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { IncomingForm, Fields, Files, File } from 'formidable';
import { promises as fs } from 'fs';

// Disable body parsing - we need raw body for formidable
export const config = {
  api: {
    bodyParser: false,
  },
};

// Valid word count options
const VALID_WORD_COUNTS = [150, 250, 300, 500, 1000];

// Supported file types
const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const SUPPORTED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/flac'];
const SUPPORTED_DOCUMENT_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

// Helper functions
function successResponse(result: any) {
  return { status: 'success', result, error: null };
}

function errorResponse(message: string) {
  return { status: 'error', result: null, error: message };
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Get Gemini client
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

// Parse form data
async function parseForm(req: VercelRequest): Promise<{ fields: Fields; files: Files }> {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      maxFileSize: 25 * 1024 * 1024, // 25MB
      keepExtensions: true,
    });
    form.parse(req as any, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

// CORS headers
function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    // Health check
    if (path === '/api/health' && req.method === 'GET') {
      return res.json({
        status: 'healthy',
        version: '1.0.0',
        llm_provider: 'gemini',
        cache_enabled: false,
      });
    }

    // Root
    if (path === '/' && req.method === 'GET') {
      return res.json({
        name: 'Edu-Analyst AI API',
        status: 'running',
        endpoints: {
          health: 'GET /api/health',
          analyze: 'POST /api/analyze',
          analyzeImage: 'POST /api/analyze-image',
          analyzeAudio: 'POST /api/analyze-audio',
          summarizeDocument: 'POST /api/summarize-document',
        }
      });
    }

    // Analyze text
    if (path === '/api/analyze' && req.method === 'POST') {
      const body = req.body as any;
      const { input, wordCount, language } = body;

      if (!input) {
        return res.status(400).json(errorResponse('Input is required'));
      }

      const genAI = getGeminiClient();
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

      return res.json(successResponse({
        title: 'Educational Analysis',
        author: 'Edu-Analyst AI',
        markdown: response,
        timestamp: Date.now(),
        url: '',
        analysis_id: generateId(),
      }));
    }

    // Analyze image
    if (path === '/api/analyze-image' && req.method === 'POST') {
      const { fields, files } = await parseForm(req);

      const fileArray = files.file;
      const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;

      if (!file) {
        return res.status(400).json(errorResponse('No file uploaded. Please upload a PNG, JPG, GIF, or WebP image.'));
      }

      const mimetype = file.mimetype || '';
      if (!SUPPORTED_IMAGE_TYPES.includes(mimetype)) {
        return res.status(400).json(errorResponse(`Unsupported file type: ${mimetype}. Supported types: PNG, JPG, GIF, WebP`));
      }

      const wordCountField = fields.wordCount;
      const wordCount = parseInt(Array.isArray(wordCountField) ? wordCountField[0] : wordCountField || '300') || 300;

      const languageField = fields.language;
      const language = (Array.isArray(languageField) ? languageField[0] : languageField) === 'zh-TW' ? 'zh-TW' : undefined;

      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const languageInstruction = language === 'zh-TW'
        ? `\n\n**Language Requirement:** You MUST write your entire analysis in Traditional Chinese (繁體中文).`
        : '';

      const prompt = `## Role
You are an expert Educational Visual Analyst specializing in extracting educational insights from images.

## Task
Analyze this image and provide an educational summary of approximately ${wordCount} words.${languageInstruction}

## Output Format
### Visual Overview
Describe what is shown in the image.

### Key Educational Concepts
Identify and explain the main educational concepts.

### Learning Points
List 3-5 specific things a student could learn from this visual.

### Context & Applications
Explain how this visual content relates to real-world learning.

### Study Tips
Provide tips on how to effectively use or remember this information.`;

      const fileBuffer = await fs.readFile(file.filepath);
      const base64Image = fileBuffer.toString('base64');

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: mimetype,
            data: base64Image,
          },
        },
        prompt,
      ]);

      const analysis = result.response.text();

      // Cleanup temp file
      await fs.unlink(file.filepath).catch(() => {});

      return res.json(successResponse({
        title: `Image Analysis: ${file.originalFilename || 'image'}`,
        author: 'Edu-Analyst AI',
        markdown: analysis,
        timestamp: Date.now(),
        url: '',
        analysis_id: generateId(),
      }));
    }

    // Analyze audio
    if (path === '/api/analyze-audio' && req.method === 'POST') {
      const { fields, files } = await parseForm(req);

      const fileArray = files.file;
      const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;

      if (!file) {
        return res.status(400).json(errorResponse('No file uploaded. Please upload an MP3, WAV, OGG, or M4A audio file.'));
      }

      const mimetype = file.mimetype || '';
      const filename = file.originalFilename || 'audio';
      const fileExtension = filename.toLowerCase().split('.').pop();
      const isValidMimeType = SUPPORTED_AUDIO_TYPES.includes(mimetype);
      const isValidExtension = ['mp3', 'wav', 'ogg', 'webm', 'm4a', 'flac', 'mp4'].includes(fileExtension || '');

      if (!isValidMimeType && !isValidExtension) {
        return res.status(400).json(errorResponse(`Unsupported file type: ${mimetype}. Supported types: MP3, WAV, OGG, M4A, FLAC`));
      }

      const wordCountField = fields.wordCount;
      const wordCount = parseInt(Array.isArray(wordCountField) ? wordCountField[0] : wordCountField || '300') || 300;

      const languageField = fields.language;
      const language = (Array.isArray(languageField) ? languageField[0] : languageField) === 'zh-TW' ? 'zh-TW' : undefined;

      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const languageInstruction = language === 'zh-TW'
        ? `\n\n**Language Requirement:** You MUST write your entire analysis in Traditional Chinese (繁體中文).`
        : '';

      const prompt = `## Role
You are an expert Educational Audio Analyst specializing in analyzing spoken educational content.

## Task
Transcribe and analyze this audio, providing an educational summary of approximately ${wordCount} words.${languageInstruction}

## Audio Information
**File Name:** ${filename}

## Output Format
### Audio Transcript Summary
A brief overview of what was discussed.

### Key Topics Covered
The main topics or subjects discussed.

### Important Points
- Key facts, concepts, or arguments presented

### Key Terminology
Important terms or definitions introduced.

### Learning Outcomes
What a listener could learn from this audio.

### Practical Applications
How the knowledge can be applied.

### Summary
A concise summary of the main message.`;

      const fileBuffer = await fs.readFile(file.filepath);
      const base64Audio = fileBuffer.toString('base64');

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: mimetype || 'audio/mpeg',
            data: base64Audio,
          },
        },
        { text: prompt },
      ]);

      const analysis = result.response.text();

      // Cleanup temp file
      await fs.unlink(file.filepath).catch(() => {});

      return res.json(successResponse({
        title: `Audio Analysis: ${filename}`,
        author: 'Edu-Analyst AI',
        markdown: analysis,
        timestamp: Date.now(),
        url: '',
        analysis_id: generateId(),
      }));
    }

    // Summarize document
    if (path === '/api/summarize-document' && req.method === 'POST') {
      const { fields, files } = await parseForm(req);

      const fileArray = files.file;
      const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;

      if (!file) {
        return res.status(400).json(errorResponse('No file uploaded. Please upload a PDF, DOCX, or TXT file.'));
      }

      const mimetype = file.mimetype || '';
      const filename = file.originalFilename || 'document';
      const fileExtension = filename.toLowerCase().split('.').pop();
      const isValidMimeType = SUPPORTED_DOCUMENT_TYPES.includes(mimetype);
      const isValidExtension = ['pdf', 'docx', 'txt'].includes(fileExtension || '');

      if (!isValidMimeType && !isValidExtension) {
        return res.status(400).json(errorResponse(`Unsupported file type: ${mimetype}. Supported types: PDF, DOCX, TXT`));
      }

      const wordCountField = fields.wordCount;
      const wordCount = parseInt(Array.isArray(wordCountField) ? wordCountField[0] : wordCountField || '300') || 300;

      const languageField = fields.language;
      const language = (Array.isArray(languageField) ? languageField[0] : languageField) === 'zh-TW' ? 'zh-TW' : undefined;

      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const languageInstruction = language === 'zh-TW'
        ? `\n\n**Language Requirement:** You MUST write your entire summary in Traditional Chinese (繁體中文).`
        : '';

      const prompt = `## Role
You are an expert Document Summarizer specializing in creating educational summaries.

## Task
Summarize this document in approximately ${wordCount} words, focusing on educational value.${languageInstruction}

## Document Information
**File Name:** ${filename}

## Output Format
### Document Overview
Brief description of the document type and purpose.

### Executive Summary
The main points and conclusions.

### Key Concepts
Important concepts, ideas, or arguments.

### Important Details
- Specific facts, data, or evidence presented

### Conclusions & Takeaways
Main conclusions and what readers should remember.

### Further Reading Suggestions
Related topics to explore.`;

      const fileBuffer = await fs.readFile(file.filepath);

      let result;
      if (fileExtension === 'txt' || mimetype === 'text/plain') {
        const documentContent = fileBuffer.toString('utf-8');
        result = await model.generateContent(`${prompt}\n\n## Document Content\n${documentContent}`);
      } else {
        const base64Doc = fileBuffer.toString('base64');
        result = await model.generateContent([
          {
            inlineData: {
              mimeType: mimetype || 'application/pdf',
              data: base64Doc,
            },
          },
          prompt,
        ]);
      }

      const summary = result.response.text();

      // Cleanup temp file
      await fs.unlink(file.filepath).catch(() => {});

      return res.json(successResponse({
        title: `Document Summary: ${filename}`,
        author: 'Edu-Analyst AI',
        markdown: summary,
        timestamp: Date.now(),
        url: '',
        analysis_id: generateId(),
      }));
    }

    // 404
    return res.status(404).json(errorResponse('Not found'));

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json(errorResponse(error instanceof Error ? error.message : 'An error occurred'));
  }
}
