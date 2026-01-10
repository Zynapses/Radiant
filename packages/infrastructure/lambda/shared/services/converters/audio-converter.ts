// RADIANT v4.18.55 - Audio Transcription Converter
// Uses OpenAI Whisper API or self-hosted Whisper for audio-to-text

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export interface TranscriptionResult {
  success: boolean;
  text: string;
  segments?: TranscriptionSegment[];
  metadata: {
    duration: number;        // seconds
    language?: string;
    confidence?: number;
    wordCount: number;
    model: string;
  };
  error?: string;
}

export interface TranscriptionSegment {
  id: number;
  start: number;    // seconds
  end: number;      // seconds
  text: string;
  confidence?: number;
}

export interface TranscriptionOptions {
  language?: string;           // ISO language code or 'auto'
  model?: 'whisper-1' | 'whisper-large-v3' | 'self-hosted';
  includeTimestamps?: boolean; // Include segment timestamps
  prompt?: string;             // Context/vocabulary hint
  responseFormat?: 'text' | 'json' | 'srt' | 'vtt';
  maxDuration?: number;        // Max duration in seconds to process
}

// Supported audio formats
export const SUPPORTED_AUDIO_FORMATS = [
  'mp3', 'mp4', 'm4a', 'wav', 'webm', 'ogg', 'flac', 'mpeg', 'mpga'
] as const;

export type SupportedAudioFormat = typeof SUPPORTED_AUDIO_FORMATS[number];

/**
 * Transcribe audio to text using Whisper
 * 
 * @param audioBuffer - The audio file as a Buffer
 * @param filename - Original filename (for format detection)
 * @param options - Transcription options
 * @returns Transcription result with text and metadata
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  const {
    language = 'auto',
    model = 'whisper-1',
    includeTimestamps = false,
    prompt,
    responseFormat = 'json',
    maxDuration,
  } = options;

  try {
    // Detect audio format
    const format = detectAudioFormat(audioBuffer, filename);
    if (!format) {
      return {
        success: false,
        text: '',
        metadata: { duration: 0, wordCount: 0, model },
        error: 'Unsupported audio format',
      };
    }

    // Check file size (Whisper API limit is 25MB)
    if (audioBuffer.length > 25 * 1024 * 1024) {
      return {
        success: false,
        text: '',
        metadata: { duration: 0, wordCount: 0, model },
        error: 'Audio file exceeds 25MB limit. Consider splitting the file.',
      };
    }

    // Use appropriate transcription method based on model
    if (model === 'self-hosted') {
      return await transcribeWithSelfHosted(audioBuffer, filename, options);
    } else {
      return await transcribeWithOpenAI(audioBuffer, filename, options);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown transcription error';
    return {
      success: false,
      text: '',
      metadata: { duration: 0, wordCount: 0, model },
      error: `Transcription failed: ${errorMessage}`,
    };
  }
}

/**
 * Transcribe using OpenAI Whisper API
 */
async function transcribeWithOpenAI(
  audioBuffer: Buffer,
  filename: string,
  options: TranscriptionOptions
): Promise<TranscriptionResult> {
  const {
    language,
    model = 'whisper-1',
    includeTimestamps,
    prompt,
    responseFormat,
  } = options;

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Prepare form data
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: getMimeType(filename) });
  formData.append('file', blob, filename);
  formData.append('model', model);
  
  if (language && language !== 'auto') {
    formData.append('language', language);
  }
  if (prompt) {
    formData.append('prompt', prompt);
  }
  if (includeTimestamps) {
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');
  } else {
    formData.append('response_format', responseFormat === 'json' ? 'json' : responseFormat);
  }

  // Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
  }

  const result = await response.json() as { text?: string; segments?: Array<{ start: number; end: number; text: string; avg_logprob?: number }>; duration?: number; language?: string };

  // Parse response based on format
  if (includeTimestamps && result.segments) {
    const segments: TranscriptionSegment[] = result.segments.map((seg, index: number) => ({
      id: index,
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
      confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : undefined,
    }));

    return {
      success: true,
      text: result.text || '',
      segments,
      metadata: {
        duration: result.duration || segments[segments.length - 1]?.end || 0,
        language: result.language,
        wordCount: (result.text || '').split(/\s+/).length,
        model,
      },
    };
  }

  const text = result.text || '';
  
  return {
    success: true,
    text,
    metadata: {
      duration: result.duration || 0,
      language: result.language,
      wordCount: text.split(/\s+/).length,
      model,
    },
  };
}

/**
 * Transcribe using self-hosted Whisper (SageMaker endpoint)
 */
async function transcribeWithSelfHosted(
  audioBuffer: Buffer,
  filename: string,
  options: TranscriptionOptions
): Promise<TranscriptionResult> {
  const {
    language,
    includeTimestamps,
  } = options;

  const endpointUrl = process.env.WHISPER_ENDPOINT_URL;
  if (!endpointUrl) {
    throw new Error('WHISPER_ENDPOINT_URL not configured for self-hosted transcription');
  }

  // Upload audio to S3 for processing
  const s3 = new S3Client({});
  const bucketName = process.env.TEMP_BUCKET || 'radiant-temp';
  const s3Key = `whisper-temp/${uuidv4()}/${filename}`;

  await s3.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    Body: audioBuffer,
    ContentType: getMimeType(filename),
  }));

  // Get signed URL for the audio file
  const audioUrl = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
  }), { expiresIn: 3600 });

  // Call self-hosted Whisper endpoint
  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      language: language === 'auto' ? undefined : language,
      return_timestamps: includeTimestamps,
    }),
  });

  if (!response.ok) {
    throw new Error(`Whisper endpoint error: ${response.status}`);
  }

  const result = await response.json() as { text: string; segments?: TranscriptionSegment[]; duration?: number; language?: string };

  return {
    success: true,
    text: result.text,
    segments: result.segments,
    metadata: {
      duration: result.duration || 0,
      language: result.language,
      wordCount: result.text.split(/\s+/).length,
      model: 'self-hosted',
    },
  };
}

/**
 * Detect audio format from buffer and filename
 */
function detectAudioFormat(buffer: Buffer, filename: string): SupportedAudioFormat | null {
  // Check magic bytes
  const header = buffer.slice(0, 12);
  
  // MP3: ID3 tag or frame sync
  if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) {
    return 'mp3';
  }
  if (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) {
    return 'mp3';
  }
  
  // WAV: RIFF....WAVE
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
    if (header[8] === 0x57 && header[9] === 0x41 && header[10] === 0x56 && header[11] === 0x45) {
      return 'wav';
    }
  }
  
  // OGG: OggS
  if (header[0] === 0x4F && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53) {
    return 'ogg';
  }
  
  // FLAC: fLaC
  if (header[0] === 0x66 && header[1] === 0x4C && header[2] === 0x61 && header[3] === 0x43) {
    return 'flac';
  }
  
  // M4A/MP4: ftyp
  if (header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70) {
    return 'm4a';
  }
  
  // WebM: 1A 45 DF A3
  if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) {
    return 'webm';
  }

  // Fall back to extension
  const ext = filename.toLowerCase().split('.').pop();
  if (ext && SUPPORTED_AUDIO_FORMATS.includes(ext as SupportedAudioFormat)) {
    return ext as SupportedAudioFormat;
  }

  return null;
}

/**
 * Get MIME type for audio file
 */
function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'mp4': 'audio/mp4',
    'm4a': 'audio/mp4',
    'wav': 'audio/wav',
    'webm': 'audio/webm',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    'mpeg': 'audio/mpeg',
    'mpga': 'audio/mpeg',
  };
  return mimeTypes[ext || ''] || 'audio/mpeg';
}

/**
 * Format transcription as SRT subtitles
 */
export function formatAsSrt(segments: TranscriptionSegment[]): string {
  return segments.map((seg, index) => {
    const startTime = formatSrtTime(seg.start);
    const endTime = formatSrtTime(seg.end);
    return `${index + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
  }).join('\n');
}

/**
 * Format transcription as VTT subtitles
 */
export function formatAsVtt(segments: TranscriptionSegment[]): string {
  const vttSegments = segments.map(seg => {
    const startTime = formatVttTime(seg.start);
    const endTime = formatVttTime(seg.end);
    return `${startTime} --> ${endTime}\n${seg.text}`;
  }).join('\n\n');
  
  return `WEBVTT\n\n${vttSegments}`;
}

/**
 * Format time as SRT timestamp (00:00:00,000)
 */
function formatSrtTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
}

/**
 * Format time as VTT timestamp (00:00:00.000)
 */
function formatVttTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
}

/**
 * Pad number with leading zeros
 */
function pad(num: number, size: number = 2): string {
  return num.toString().padStart(size, '0');
}

/**
 * Estimate token count for transcription
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate audio duration from file size (rough)
 */
export function estimateDuration(buffer: Buffer, format: string): number {
  // Rough estimates based on typical bitrates
  const bitrates: Record<string, number> = {
    'mp3': 128000,  // 128 kbps
    'wav': 1411000, // 1411 kbps (CD quality)
    'ogg': 160000,  // 160 kbps
    'flac': 800000, // ~800 kbps
    'm4a': 256000,  // 256 kbps
  };
  
  const bitrate = bitrates[format] || 128000;
  return (buffer.length * 8) / bitrate;
}
