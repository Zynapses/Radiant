// RADIANT v4.18.55 - Video Frame Extraction & Description Converter
// Extracts key frames and describes them using vision models

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { describeImage } from './image-converter';

export interface VideoDescriptionResult {
  success: boolean;
  description: string;
  frames: FrameDescription[];
  metadata: {
    duration: number;        // seconds
    width: number;
    height: number;
    fps: number;
    codec: string;
    frameCount: number;
    model: string;
  };
  error?: string;
}

export interface FrameDescription {
  timestamp: number;      // seconds
  description: string;
  imageUrl?: string;      // Signed URL to frame image
}

export interface VideoDescriptionOptions {
  model?: 'gpt-4-vision' | 'claude-3-vision' | 'llava' | 'self-hosted';
  frameInterval?: number;      // Extract frame every N seconds (default: 10)
  maxFrames?: number;          // Maximum frames to extract (default: 10)
  includeAudioTranscript?: boolean;  // Also transcribe audio track
  detail?: 'low' | 'high';     // Vision API detail level
  storeFrames?: boolean;       // Store extracted frames in S3
}

// Supported video formats
export const SUPPORTED_VIDEO_FORMATS = [
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'm4v'
] as const;

export type SupportedVideoFormat = typeof SUPPORTED_VIDEO_FORMATS[number];

/**
 * Extract frames from video and describe them
 * 
 * @param videoBuffer - The video file as a Buffer
 * @param filename - Original filename
 * @param options - Description options
 * @returns Description result with frame descriptions
 */
export async function describeVideo(
  videoBuffer: Buffer,
  filename: string,
  options: VideoDescriptionOptions = {}
): Promise<VideoDescriptionResult> {
  const {
    model = 'gpt-4-vision',
    frameInterval = 10,
    maxFrames = 10,
    includeAudioTranscript = false,
    detail = 'low',
    storeFrames = false,
  } = options;

  const tempDir = path.join(os.tmpdir(), `radiant-video-${uuidv4()}`);
  
  try {
    // Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Write video to temp file
    const videoPath = path.join(tempDir, filename);
    fs.writeFileSync(videoPath, videoBuffer);

    // Get video metadata
    const metadata = await getVideoMetadata(videoPath);
    
    // Calculate frame extraction points
    const frameTimes = calculateFrameTimes(
      metadata.duration,
      frameInterval,
      maxFrames
    );

    // Extract frames
    const frameBuffers = await extractFrames(videoPath, frameTimes, tempDir);

    // Describe each frame
    const frameDescriptions: FrameDescription[] = [];
    
    for (let i = 0; i < frameBuffers.length; i++) {
      const frameBuffer = frameBuffers[i];
      const timestamp = frameTimes[i];
      
      const result = await describeImage(
        frameBuffer,
        `frame_${i}.jpg`,
        {
          model,
          detail,
          maxTokens: 200,
          prompt: `This is frame ${i + 1} of ${frameBuffers.length} from a video at timestamp ${formatTimestamp(timestamp)}. Briefly describe what you see in this frame.`,
        }
      );

      let imageUrl: string | undefined;
      
      // Optionally store frame in S3
      if (storeFrames && result.success) {
        imageUrl = await storeFrameInS3(frameBuffer, filename, i, timestamp);
      }

      frameDescriptions.push({
        timestamp,
        description: result.success ? result.description : 'Frame description failed',
        imageUrl,
      });
    }

    // Combine descriptions into narrative
    const combinedDescription = generateVideoNarrative(
      frameDescriptions,
      metadata,
      includeAudioTranscript
    );

    // Cleanup temp files
    cleanupTempDir(tempDir);

    return {
      success: true,
      description: combinedDescription,
      frames: frameDescriptions,
      metadata: {
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        fps: metadata.fps,
        codec: metadata.codec,
        frameCount: frameDescriptions.length,
        model,
      },
    };
  } catch (error) {
    // Cleanup on error
    cleanupTempDir(tempDir);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown video processing error';
    return {
      success: false,
      description: '',
      frames: [],
      metadata: {
        duration: 0,
        width: 0,
        height: 0,
        fps: 0,
        codec: 'unknown',
        frameCount: 0,
        model,
      },
      error: `Video description failed: ${errorMessage}`,
    };
  }
}

/**
 * Get video metadata using ffprobe
 */
async function getVideoMetadata(videoPath: string): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err: any, data: any) => {
      if (err) {
        reject(new Error(`Failed to probe video: ${err.message}`));
        return;
      }

      const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
      
      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      // Parse frame rate (could be "30/1" or "29.97")
      let fps = 30;
      if (videoStream.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/');
        fps = parts.length === 2 
          ? parseInt(parts[0]) / parseInt(parts[1])
          : parseFloat(videoStream.r_frame_rate);
      }

      resolve({
        duration: parseFloat(data.format.duration || '0'),
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        fps,
        codec: videoStream.codec_name || 'unknown',
      });
    });
  });
}

/**
 * Calculate evenly distributed frame extraction times
 */
function calculateFrameTimes(
  duration: number,
  interval: number,
  maxFrames: number
): number[] {
  const times: number[] = [];
  
  // Always include first frame
  times.push(0);
  
  // Calculate how many frames we can extract at the given interval
  const intervalFrames = Math.floor(duration / interval);
  const actualFrames = Math.min(intervalFrames, maxFrames - 1);
  
  if (actualFrames > 0) {
    const actualInterval = duration / (actualFrames + 1);
    for (let i = 1; i <= actualFrames; i++) {
      times.push(i * actualInterval);
    }
  }
  
  return times;
}

/**
 * Extract frames at specified timestamps
 */
async function extractFrames(
  videoPath: string,
  timestamps: number[],
  outputDir: string
): Promise<Buffer[]> {
  const frameBuffers: Buffer[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const timestamp = timestamps[i];
    const outputPath = path.join(outputDir, `frame_${i}.jpg`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .frames(1)
        .outputOptions([
          '-vf', 'scale=1280:-1',  // Max width 1280, maintain aspect ratio
          '-q:v', '2',             // High quality JPEG
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(new Error(`Frame extraction failed: ${err.message}`)))
        .run();
    });

    // Read frame into buffer
    const frameBuffer = fs.readFileSync(outputPath);
    frameBuffers.push(frameBuffer);
  }

  return frameBuffers;
}

/**
 * Store frame image in S3
 */
async function storeFrameInS3(
  frameBuffer: Buffer,
  originalFilename: string,
  frameIndex: number,
  timestamp: number
): Promise<string> {
  const s3 = new S3Client({});
  const bucketName = process.env.FILE_CONVERSION_BUCKET || 'radiant-files';
  const videoId = uuidv4();
  const s3Key = `video-frames/${videoId}/frame_${frameIndex}_${Math.round(timestamp)}s.jpg`;

  await s3.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    Body: frameBuffer,
    ContentType: 'image/jpeg',
    Metadata: {
      originalVideo: originalFilename,
      frameIndex: frameIndex.toString(),
      timestamp: timestamp.toString(),
    },
  }));

  // Return signed URL
  const url = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
  }), { expiresIn: 3600 });

  return url;
}

/**
 * Generate narrative description from frame descriptions
 */
function generateVideoNarrative(
  frames: FrameDescription[],
  metadata: { duration: number; width: number; height: number },
  includeAudioNote: boolean
): string {
  const parts: string[] = [];

  // Video overview
  parts.push(`**Video Overview** (${formatDuration(metadata.duration)}, ${metadata.width}x${metadata.height})`);
  parts.push('');

  // Frame-by-frame description
  parts.push('**Frame Analysis:**');
  parts.push('');

  for (const frame of frames) {
    parts.push(`**[${formatTimestamp(frame.timestamp)}]** ${frame.description}`);
    parts.push('');
  }

  // Summary
  parts.push('**Summary:**');
  
  // Generate a simple summary based on first and last frames
  if (frames.length > 0) {
    const firstFrame = frames[0];
    const lastFrame = frames[frames.length - 1];
    
    parts.push(`The video begins with: ${truncate(firstFrame.description, 100)}`);
    
    if (frames.length > 1) {
      parts.push(`The video ends with: ${truncate(lastFrame.description, 100)}`);
    }
  }

  if (includeAudioNote) {
    parts.push('');
    parts.push('*Note: Audio transcription was requested but not included in this analysis.*');
  }

  return parts.join('\n');
}

/**
 * Format timestamp as HH:MM:SS
 */
function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${mins}:${pad(secs)}`;
}

/**
 * Format duration in human-readable form
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} seconds`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  }
}

/**
 * Pad number with leading zero
 */
function pad(num: number): string {
  return num.toString().padStart(2, '0');
}

/**
 * Truncate text to specified length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Clean up temporary directory
 */
function cleanupTempDir(dirPath: string): void {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Detect video format from buffer
 */
export function detectVideoFormat(buffer: Buffer): SupportedVideoFormat | null {
  const header = buffer.slice(0, 12);

  // MP4: ftyp
  if (header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70) {
    return 'mp4';
  }

  // WebM: 1A 45 DF A3
  if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) {
    return 'webm';
  }

  // AVI: RIFF....AVI
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
    if (header[8] === 0x41 && header[9] === 0x56 && header[10] === 0x49) {
      return 'avi';
    }
  }

  // MOV: moov or free or mdat
  if (header[4] === 0x6D && header[5] === 0x6F && header[6] === 0x6F && header[7] === 0x76) {
    return 'mov';
  }

  // FLV: FLV
  if (header[0] === 0x46 && header[1] === 0x4C && header[2] === 0x56) {
    return 'flv';
  }

  // MKV: 1A 45 DF A3 (same as WebM but different content)
  // WebM is a subset of MKV

  return null;
}

/**
 * Estimate token count for video description
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
