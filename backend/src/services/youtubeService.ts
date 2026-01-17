/**
 * YouTube transcript extraction service
 * Fetches transcripts by extracting caption URLs from video pages
 */

export interface TranscriptResult {
  text: string;
  videoId: string;
  wordCount: number;
}

export class YouTubeServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YouTubeServiceError';
  }
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractVideoId(url: string): string {
  if (!url) {
    throw new YouTubeServiceError('URL cannot be empty');
  }

  const cleanUrl = url.trim();

  // Pattern to match various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([\w-]{11})/,
    /^([\w-]{11})$/, // Just the video ID
  ];

  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern);
    if (match) {
      return match[1];
    }
  }

  throw new YouTubeServiceError(`Could not extract video ID from URL: ${url}`);
}

/**
 * Decode XML/HTML entities
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\\n/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

/**
 * Fetch transcript for a YouTube video
 */
export async function getTranscript(videoId: string): Promise<TranscriptResult> {
  try {
    console.log(`Fetching transcript for video: ${videoId}`);

    // Step 1: Fetch the video page to get caption track URLs
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageResponse = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!pageResponse.ok) {
      throw new YouTubeServiceError(`Failed to fetch video page: ${pageResponse.status}`);
    }

    const html = await pageResponse.text();

    // Step 2: Extract ytInitialPlayerResponse which contains caption data
    const playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
    if (!playerMatch) {
      throw new YouTubeServiceError(
        `Could not extract video data. The video may be unavailable or region-restricted.`
      );
    }

    let playerData: any;
    try {
      playerData = JSON.parse(playerMatch[1]);
    } catch {
      throw new YouTubeServiceError('Failed to parse video data');
    }

    // Check if video is playable
    const playabilityStatus = playerData?.playabilityStatus?.status;
    if (playabilityStatus === 'ERROR' || playabilityStatus === 'UNPLAYABLE') {
      const reason = playerData?.playabilityStatus?.reason || 'Video unavailable';
      throw new YouTubeServiceError(reason);
    }

    // Step 3: Get caption tracks
    const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      throw new YouTubeServiceError(
        `No captions available for video ${videoId}. To analyze this video: 1) Open it on YouTube, 2) Click "..." below the video, 3) Select "Show transcript", 4) Copy and paste the transcript into the text input field.`
      );
    }

    console.log(`Found ${captionTracks.length} caption track(s)`);

    // Prefer English captions, but fall back to first available
    let selectedTrack = captionTracks.find((t: any) =>
      t.languageCode === 'en' || t.languageCode?.startsWith('en')
    ) || captionTracks[0];

    const captionUrl = selectedTrack.baseUrl;
    if (!captionUrl) {
      throw new YouTubeServiceError('Could not find caption URL');
    }

    console.log(`Fetching captions (${selectedTrack.languageCode || 'unknown language'})...`);

    // Step 4: Fetch the captions XML
    const captionResponse = await fetch(captionUrl);
    if (!captionResponse.ok) {
      throw new YouTubeServiceError(`Failed to fetch captions: ${captionResponse.status}`);
    }

    const captionXml = await captionResponse.text();

    // Step 5: Parse the XML to extract text
    const textMatches = captionXml.match(/<text[^>]*>([^<]*)<\/text>/g);
    if (!textMatches || textMatches.length === 0) {
      throw new YouTubeServiceError(
        `YouTube's caption API is currently unavailable. To analyze this video: 1) Open it on YouTube, 2) Click "..." below the video, 3) Select "Show transcript", 4) Copy and paste the transcript into the text input field.`
      );
    }

    const transcriptText = textMatches
      .map(match => {
        const textContent = match.replace(/<[^>]+>/g, '');
        return decodeEntities(textContent);
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!transcriptText) {
      throw new YouTubeServiceError('Transcript is empty');
    }

    const wordCount = transcriptText.split(/\s+/).length;
    console.log(`Fetched transcript: ${wordCount} words`);

    return {
      text: transcriptText,
      videoId,
      wordCount,
    };
  } catch (error) {
    if (error instanceof YouTubeServiceError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error fetching transcript for ${videoId}:`, error);
    throw new YouTubeServiceError(
      `Failed to fetch transcript: ${message}. Try pasting the transcript text directly instead.`
    );
  }
}

/**
 * Convenience function to fetch transcript directly from URL
 */
export async function getTranscriptFromUrl(url: string): Promise<TranscriptResult> {
  const videoId = extractVideoId(url);
  return getTranscript(videoId);
}

export default {
  extractVideoId,
  getTranscript,
  getTranscriptFromUrl,
};
