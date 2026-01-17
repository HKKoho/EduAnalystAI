/**
 * Transcript cleaning and optimization utilities
 * Removes filler words and optimizes text for LLM token efficiency
 */

export interface CleaningStats {
  originalWordCount: number;
  cleanedWordCount: number;
  wordsRemoved: number;
  reductionPercentage: number;
}

export interface CleaningResult {
  text: string;
  stats: CleaningStats;
}

// Common filler words and phrases to remove
const FILLER_WORDS = new Set([
  // English fillers
  'um', 'uh', 'umm', 'uhh', 'er', 'err', 'ah', 'ahh',
  'like', 'basically', 'literally', 'actually', 'honestly',
  'right', 'okay',
]);

// Filler phrases (checked separately)
const FILLER_PHRASES = [
  'you know',
  'i mean',
  'sort of',
  'kind of',
  'okay so',
  'so yeah',
  'yeah so',
  'and yeah',
  'you know what i mean',
  'if you know what i mean',
  'you know what i\'m saying',
  'know what i\'m saying',
  'at the end of the day',
  'to be honest with you',
  'to be perfectly honest',
  'in my opinion',
];

// YouTube-specific phrases to remove (intro/outro)
const YOUTUBE_PHRASES = [
  'hey guys',
  'hey everyone',
  'what\'s up guys',
  'don\'t forget to subscribe',
  'hit that subscribe button',
  'smash that like button',
  'ring the bell',
  'link in the description',
  'check out the link below',
  'welcome back to my channel',
  'welcome back to the channel',
  'thanks for watching',
  'thank you for watching',
  'see you in the next video',
  'see you in the next one',
  'let me know in the comments',
  'subscribe to my channel',
  'subscribe to the channel',
];

// Patterns for cleaning up auto-generated transcript artifacts
const CLEANUP_PATTERNS: [RegExp, string][] = [
  [/\[.*?\]/g, ''],           // Remove [Music], [Applause], etc.
  [/\(.*?\)/g, ''],           // Remove (inaudible), (laughs), etc.
  [/♪.*?♪/g, ''],             // Remove music notation
  [/\s+/g, ' '],              // Normalize whitespace
];

export interface CleanerOptions {
  aggressive?: boolean;  // Also remove intro/outro phrases
}

/**
 * Clean and optimize transcript text
 */
export function cleanTranscript(
  text: string,
  options: CleanerOptions = {}
): CleaningResult {
  const { aggressive = true } = options;

  if (!text) {
    return {
      text: '',
      stats: {
        originalWordCount: 0,
        cleanedWordCount: 0,
        wordsRemoved: 0,
        reductionPercentage: 0,
      },
    };
  }

  const originalWordCount = text.split(/\s+/).filter(Boolean).length;

  // Step 1: Normalize to lowercase for processing
  let cleaned = text.toLowerCase();

  // Step 2: Apply cleanup patterns (brackets, music notation, etc.)
  for (const [pattern, replacement] of CLEANUP_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // Step 3: Remove filler phrases (longer phrases first to avoid partial matches)
  const sortedPhrases = [...FILLER_PHRASES].sort((a, b) => b.length - a.length);
  for (const phrase of sortedPhrases) {
    const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  }

  // Step 4: Remove YouTube-specific phrases if aggressive mode
  if (aggressive) {
    const sortedYouTubePhrases = [...YOUTUBE_PHRASES].sort((a, b) => b.length - a.length);
    for (const phrase of sortedYouTubePhrases) {
      const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'gi');
      cleaned = cleaned.replace(regex, '');
    }
  }

  // Step 5: Remove individual filler words
  const words = cleaned.split(/\s+/).filter(Boolean);
  const filteredWords = words.filter(word => {
    const cleanWord = word.replace(/[.,!?;:'"]/g, '').toLowerCase();
    return !FILLER_WORDS.has(cleanWord);
  });

  // Step 6: Rejoin and normalize whitespace
  cleaned = filteredWords.join(' ').replace(/\s+/g, ' ').trim();

  // Step 7: Restore proper sentence casing
  cleaned = capitalizeAfterPeriods(cleaned);

  // Calculate statistics
  const cleanedWordCount = cleaned.split(/\s+/).filter(Boolean).length;
  const wordsRemoved = originalWordCount - cleanedWordCount;
  const reductionPercentage = originalWordCount > 0
    ? Math.round((wordsRemoved / originalWordCount) * 10000) / 100
    : 0;

  console.log(
    `Transcript cleaned: ${originalWordCount} → ${cleanedWordCount} words ` +
    `(${reductionPercentage}% reduction)`
  );

  return {
    text: cleaned,
    stats: {
      originalWordCount,
      cleanedWordCount,
      wordsRemoved,
      reductionPercentage,
    },
  };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Capitalize first letter after periods
 */
function capitalizeAfterPeriods(text: string): string {
  return text
    .split('. ')
    .map(sentence => {
      if (!sentence) return sentence;
      return sentence.charAt(0).toUpperCase() + sentence.slice(1);
    })
    .join('. ');
}

/**
 * Estimate token count for text
 * Rough estimate: ~1.3 tokens per word for English
 */
export function estimateTokens(text: string): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * 1.3);
}

/**
 * Split transcript into chunks if it exceeds max token limit
 */
export function chunkTranscript(text: string, maxTokens: number = 100000): string[] {
  const estimatedTokens = estimateTokens(text);

  if (estimatedTokens <= maxTokens) {
    return [text];
  }

  // Calculate approximate words per chunk
  const wordsPerChunk = Math.floor(maxTokens / 1.3);

  // Split into sentences
  const sentences = text.split(/(?<=[.!?])\s+/);

  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).filter(Boolean).length;

    if (currentWordCount + sentenceWords > wordsPerChunk && currentChunk.length > 0) {
      // Save current chunk and start new one
      chunks.push(currentChunk.join(' '));
      currentChunk = [sentence];
      currentWordCount = sentenceWords;
    } else {
      currentChunk.push(sentence);
      currentWordCount += sentenceWords;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  console.log(`Transcript split into ${chunks.length} chunks`);
  return chunks;
}

export default {
  cleanTranscript,
  estimateTokens,
  chunkTranscript,
};
