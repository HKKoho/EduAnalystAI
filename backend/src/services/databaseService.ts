/**
 * Database Service for Edu-Analyst AI
 * Handles all database operations using Prisma
 */

import { PrismaClient, InputType, SourceType } from '@prisma/client';

// Check if database is configured
export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

// Singleton Prisma client
let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient | null {
  if (!isDatabaseConfigured()) {
    console.warn('DATABASE_URL not configured - database features disabled');
    return null;
  }
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prisma;
}

// Disconnect on shutdown
export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

// Types for creating analyses
export interface CreateAnalysisInput {
  title: string;
  author?: string;
  inputType: InputType;
  language?: string;
  wordCount?: number;
  sourceUrl?: string;
  videoId?: string;
  sourceText: string;
  sourceType: SourceType;
  fileName?: string;
  markdown: string;
  fileSize?: number;
  mimeType?: string;
  userId?: string;
}

export interface AnalysisRecord {
  id: string;
  createdAt: Date;
  title: string;
  author: string;
  inputType: InputType;
  language: string | null;
  wordCount: number | null;
  sourceUrl: string | null;
  videoId: string | null;
  sourceText: string;
  sourceType: SourceType;
  fileName: string | null;
  markdown: string;
  fileSize: number | null;
  mimeType: string | null;
  userId: string | null;
}

export interface HistoryItem {
  id: string;
  title: string;
  createdAt: Date;
  inputType: InputType;
  sourceType: SourceType;
  sourceUrl: string | null;
}

/**
 * Database Service class
 */
export class DatabaseService {
  private prisma: PrismaClient | null;
  private enabled: boolean;

  constructor() {
    this.prisma = getPrismaClient();
    this.enabled = this.prisma !== null;
    if (!this.enabled) {
      console.warn('DatabaseService: Running without database persistence');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Create a new analysis record
   */
  async createAnalysis(input: CreateAnalysisInput): Promise<AnalysisRecord | null> {
    if (!this.prisma) return null;

    const analysis = await this.prisma.analysis.create({
      data: {
        title: input.title,
        author: input.author || 'Edu-Analyst AI',
        inputType: input.inputType,
        language: input.language,
        wordCount: input.wordCount,
        sourceUrl: input.sourceUrl,
        videoId: input.videoId,
        sourceText: input.sourceText,
        sourceType: input.sourceType,
        fileName: input.fileName,
        markdown: input.markdown,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        userId: input.userId,
      },
    });

    return analysis;
  }

  /**
   * Get an analysis by ID
   * If userId is provided, verifies ownership
   */
  async getAnalysis(id: string, userId?: string): Promise<AnalysisRecord | null> {
    if (!this.prisma) return null;

    const analysis = await this.prisma.analysis.findUnique({
      where: { id },
    });

    // If userId provided, verify ownership
    if (analysis && userId && analysis.userId !== userId) {
      return null;
    }

    return analysis;
  }

  /**
   * Get analysis history (paginated)
   * If userId is provided, only returns that user's analyses
   */
  async getHistory(limit: number = 50, offset: number = 0, userId?: string): Promise<HistoryItem[]> {
    if (!this.prisma) return [];

    const where = userId ? { userId } : {};

    const analyses = await this.prisma.analysis.findMany({
      where,
      select: {
        id: true,
        title: true,
        createdAt: true,
        inputType: true,
        sourceType: true,
        sourceUrl: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return analyses;
  }

  /**
   * Get total count of analyses
   * If userId is provided, only counts that user's analyses
   */
  async getAnalysisCount(userId?: string): Promise<number> {
    if (!this.prisma) return 0;

    const where = userId ? { userId } : {};
    return this.prisma.analysis.count({ where });
  }

  /**
   * Delete an analysis by ID
   * If userId is provided, verifies ownership before deleting
   */
  async deleteAnalysis(id: string, userId?: string): Promise<boolean> {
    if (!this.prisma) return false;

    try {
      // If userId provided, verify ownership first
      if (userId) {
        const analysis = await this.prisma.analysis.findUnique({
          where: { id },
          select: { userId: true },
        });

        if (!analysis || analysis.userId !== userId) {
          return false;
        }
      }

      await this.prisma.analysis.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Search analyses by title or content
   */
  async searchAnalyses(query: string, limit: number = 20): Promise<HistoryItem[]> {
    if (!this.prisma) return [];
    const analyses = await this.prisma.analysis.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { markdown: { contains: query, mode: 'insensitive' } },
          { sourceText: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        inputType: true,
        sourceType: true,
        sourceUrl: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return analyses;
  }

  /**
   * Get analyses by type
   */
  async getAnalysesByType(inputType: InputType, limit: number = 50): Promise<HistoryItem[]> {
    if (!this.prisma) return [];
    const analyses = await this.prisma.analysis.findMany({
      where: { inputType },
      select: {
        id: true,
        title: true,
        createdAt: true,
        inputType: true,
        sourceType: true,
        sourceUrl: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return analyses;
  }

  /**
   * Clear all analyses (use with caution)
   */
  async clearAllAnalyses(): Promise<number> {
    if (!this.prisma) return 0;
    const result = await this.prisma.analysis.deleteMany();
    return result.count;
  }
}

// Singleton instance
let databaseService: DatabaseService | null = null;

export function getDatabaseService(): DatabaseService {
  if (!databaseService) {
    databaseService = new DatabaseService();
  }
  return databaseService;
}

// Re-export types from Prisma
export { InputType, SourceType } from '@prisma/client';
