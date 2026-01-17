/**
 * Simple in-memory cache with TTL support
 * For production, consider using Redis
 */

import crypto from 'crypto';

interface CacheEntry<T> {
  value: T;
  createdAt: number;
  ttl: number; // milliseconds
}

interface CacheStats {
  totalEntries: number;
  validEntries: number;
  maxEntries: number;
}

export class CacheManager<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTtl: number;
  private maxEntries: number;

  constructor(options: { defaultTtl?: number; maxEntries?: number } = {}) {
    this.defaultTtl = options.defaultTtl || 3600000; // 1 hour in ms
    this.maxEntries = options.maxEntries || 100;
  }

  /**
   * Generate a cache key from content using SHA256
   */
  static generateKey(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Check if an entry has expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.createdAt > entry.ttl;
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      ttl: ttl || this.defaultTtl,
    });
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    console.log('Cache cleared');
  }

  /**
   * Evict the oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get cache statistics
   */
  stats(): CacheStats {
    let validEntries = 0;

    for (const entry of this.cache.values()) {
      if (!this.isExpired(entry)) {
        validEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      maxEntries: this.maxEntries,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`Cache cleanup: removed ${removed} expired entries`);
    }

    return removed;
  }
}

// Global cache instance for analysis results
let cacheInstance: CacheManager<string> | null = null;

export function getCache(options?: { defaultTtl?: number; maxEntries?: number }): CacheManager<string> {
  if (!cacheInstance) {
    cacheInstance = new CacheManager<string>(options);
  }
  return cacheInstance;
}

export default CacheManager;
