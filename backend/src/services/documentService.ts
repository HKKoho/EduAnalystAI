/**
 * Document Service for PDF and Word file parsing
 * Extracts text content from uploaded documents for educational analysis
 */

import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

// Get the default export from pdf-parse
const pdf = (pdfParse as any).default || pdfParse;

export class DocumentServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentServiceError';
  }
}

export interface ParsedDocument {
  text: string;
  wordCount: number;
  pageCount?: number;
  fileName: string;
}

/**
 * Parse PDF file and extract text content
 */
export async function parsePDF(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  try {
    const data = await pdf(buffer);
    const text = data.text.trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    return {
      text,
      wordCount,
      pageCount: data.numpages,
      fileName,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new DocumentServiceError(`Failed to parse PDF: ${message}`);
  }
}

/**
 * Parse Word document (.docx) and extract text content
 */
export async function parseWord(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    return {
      text,
      wordCount,
      fileName,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new DocumentServiceError(`Failed to parse Word document: ${message}`);
  }
}

/**
 * Parse plain text file
 */
export function parseText(buffer: Buffer, fileName: string): ParsedDocument {
  const text = buffer.toString('utf-8').trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    text,
    wordCount,
    fileName,
  };
}

/**
 * Parse document based on file extension
 */
export async function parseDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ParsedDocument> {
  const extension = fileName.toLowerCase().split('.').pop();

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return parsePDF(buffer, fileName);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === 'docx'
  ) {
    return parseWord(buffer, fileName);
  }

  if (mimeType === 'text/plain' || extension === 'txt') {
    return parseText(buffer, fileName);
  }

  throw new DocumentServiceError(
    `Unsupported file type: ${mimeType}. Supported types: PDF, DOCX, TXT`
  );
}

export const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export const SUPPORTED_DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.txt'];
