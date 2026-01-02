// RADIANT v4.18.55 - Image Description & OCR Converter
// Uses vision models for description and AWS Textract for OCR

import { TextractClient, DetectDocumentTextCommand, AnalyzeDocumentCommand, FeatureType } from '@aws-sdk/client-textract';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';

export interface ImageDescriptionResult {
  success: boolean;
  description: string;
  metadata: {
    width: number;
    height: number;
    format: string;
    hasText: boolean;
    dominantColors?: string[];
    model: string;
  };
  error?: string;
}

export interface OcrResult {
  success: boolean;
  text: string;
  blocks: TextBlock[];
  metadata: {
    width: number;
    height: number;
    confidence: number;
    wordCount: number;
    lineCount: number;
    hasHandwriting: boolean;
  };
  error?: string;
}

export interface TextBlock {
  type: 'LINE' | 'WORD' | 'TABLE' | 'FORM';
  text: string;
  confidence: number;
  boundingBox?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface ImageDescriptionOptions {
  model?: 'gpt-4-vision' | 'claude-3-vision' | 'llava' | 'self-hosted';
  detail?: 'low' | 'high' | 'auto';
  maxTokens?: number;
  prompt?: string;           // Custom description prompt
  includeOcr?: boolean;      // Also run OCR on the image
}

export interface OcrOptions {
  detectTables?: boolean;    // Detect and extract tables
  detectForms?: boolean;     // Detect form key-value pairs
  language?: string;         // Hint for language detection
  minConfidence?: number;    // Minimum confidence threshold (0-100)
}

// Supported image formats
export const SUPPORTED_IMAGE_FORMATS = [
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'svg'
] as const;

export type SupportedImageFormat = typeof SUPPORTED_IMAGE_FORMATS[number];

/**
 * Describe image content using a vision model
 * 
 * @param imageBuffer - The image file as a Buffer
 * @param filename - Original filename
 * @param options - Description options
 * @returns Description result with text and metadata
 */
export async function describeImage(
  imageBuffer: Buffer,
  filename: string,
  options: ImageDescriptionOptions = {}
): Promise<ImageDescriptionResult> {
  const {
    model = 'gpt-4-vision',
    detail = 'auto',
    maxTokens = 500,
    prompt,
    includeOcr = false,
  } = options;

  try {
    // Get image metadata
    const imageInfo = await getImageInfo(imageBuffer);

    // Resize if too large (vision APIs have size limits)
    let processedBuffer = imageBuffer;
    if (imageInfo.width > 2048 || imageInfo.height > 2048) {
      processedBuffer = await resizeImage(imageBuffer, 2048, 2048);
    }

    // Convert to base64
    const base64Image = processedBuffer.toString('base64');
    const mimeType = getMimeType(filename);

    // Get description from appropriate model
    let description: string;
    
    switch (model) {
      case 'gpt-4-vision':
        description = await describeWithOpenAI(base64Image, mimeType, { detail, maxTokens, prompt });
        break;
      case 'claude-3-vision':
        description = await describeWithAnthropic(base64Image, mimeType, { maxTokens, prompt });
        break;
      case 'llava':
      case 'self-hosted':
        description = await describeWithSelfHosted(base64Image, mimeType, { maxTokens, prompt });
        break;
      default:
        description = await describeWithOpenAI(base64Image, mimeType, { detail, maxTokens, prompt });
    }

    // Optionally include OCR text
    if (includeOcr) {
      const ocrResult = await extractTextFromImage(imageBuffer, filename);
      if (ocrResult.success && ocrResult.text) {
        description += `\n\n[Text detected in image]:\n${ocrResult.text}`;
      }
    }

    return {
      success: true,
      description,
      metadata: {
        width: imageInfo.width,
        height: imageInfo.height,
        format: imageInfo.format,
        hasText: description.toLowerCase().includes('text') || includeOcr,
        model,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      description: '',
      metadata: { width: 0, height: 0, format: 'unknown', hasText: false, model },
      error: `Image description failed: ${errorMessage}`,
    };
  }
}

/**
 * Extract text from image using AWS Textract
 */
export async function extractTextFromImage(
  imageBuffer: Buffer,
  filename: string,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const {
    detectTables = false,
    detectForms = false,
    minConfidence = 50,
  } = options;

  try {
    const textract = new TextractClient({});
    const imageInfo = await getImageInfo(imageBuffer);

    // Resize if too large for Textract (5MB limit, 10000x10000 pixels)
    let processedBuffer = imageBuffer;
    if (imageBuffer.length > 5 * 1024 * 1024 || imageInfo.width > 10000 || imageInfo.height > 10000) {
      processedBuffer = await resizeImage(imageBuffer, 4000, 4000);
    }

    // Convert to supported format (JPEG or PNG)
    if (!['png', 'jpg', 'jpeg'].includes(imageInfo.format)) {
      processedBuffer = await sharp(processedBuffer).png().toBuffer();
    }

    let response;

    if (detectTables || detectForms) {
      // Use AnalyzeDocument for tables/forms
      const featureTypes: FeatureType[] = [];
      if (detectTables) featureTypes.push(FeatureType.TABLES);
      if (detectForms) featureTypes.push(FeatureType.FORMS);

      response = await textract.send(new AnalyzeDocumentCommand({
        Document: { Bytes: processedBuffer },
        FeatureTypes: featureTypes,
      }));
    } else {
      // Use DetectDocumentText for simple text extraction
      response = await textract.send(new DetectDocumentTextCommand({
        Document: { Bytes: processedBuffer },
      }));
    }

    // Process blocks
    const blocks: TextBlock[] = [];
    const lines: string[] = [];
    let totalConfidence = 0;
    let confidenceCount = 0;
    let hasHandwriting = false;

    for (const block of response.Blocks || []) {
      if (block.Confidence && block.Confidence < minConfidence) continue;

      if (block.BlockType === 'LINE' && block.Text) {
        lines.push(block.Text);
        blocks.push({
          type: 'LINE',
          text: block.Text,
          confidence: block.Confidence || 0,
          boundingBox: block.Geometry?.BoundingBox ? {
            left: block.Geometry.BoundingBox.Left || 0,
            top: block.Geometry.BoundingBox.Top || 0,
            width: block.Geometry.BoundingBox.Width || 0,
            height: block.Geometry.BoundingBox.Height || 0,
          } : undefined,
        });
      }

      if (block.Confidence) {
        totalConfidence += block.Confidence;
        confidenceCount++;
      }

      // Check for handwriting indicator
      if (block.TextType === 'HANDWRITING') {
        hasHandwriting = true;
      }
    }

    const text = lines.join('\n');
    const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    return {
      success: true,
      text,
      blocks,
      metadata: {
        width: imageInfo.width,
        height: imageInfo.height,
        confidence: avgConfidence,
        wordCount: text.split(/\s+/).filter(w => w).length,
        lineCount: lines.length,
        hasHandwriting,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown OCR error';
    return {
      success: false,
      text: '',
      blocks: [],
      metadata: {
        width: 0,
        height: 0,
        confidence: 0,
        wordCount: 0,
        lineCount: 0,
        hasHandwriting: false,
      },
      error: `OCR extraction failed: ${errorMessage}`,
    };
  }
}

/**
 * Describe image using OpenAI GPT-4 Vision
 */
async function describeWithOpenAI(
  base64Image: string,
  mimeType: string,
  options: { detail: string; maxTokens: number; prompt?: string }
): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const systemPrompt = options.prompt || 
    'Describe this image in detail. Include what you see, any text visible, colors, composition, and relevant context.';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: options.detail,
              },
            },
          ],
        },
      ],
      max_tokens: options.maxTokens,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
  }

  const result = await response.json() as { choices: Array<{ message: { content: string } }> };
  return result.choices[0]?.message?.content || 'No description generated';
}

/**
 * Describe image using Anthropic Claude Vision
 */
async function describeWithAnthropic(
  base64Image: string,
  mimeType: string,
  options: { maxTokens: number; prompt?: string }
): Promise<string> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const systemPrompt = options.prompt || 
    'Describe this image in detail. Include what you see, any text visible, colors, composition, and relevant context.';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: options.maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image,
              },
            },
            { type: 'text', text: systemPrompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorBody}`);
  }

  const result = await response.json() as { content: Array<{ text: string }> };
  return result.content[0]?.text || 'No description generated';
}

/**
 * Describe image using self-hosted LLaVA or similar
 */
async function describeWithSelfHosted(
  base64Image: string,
  mimeType: string,
  options: { maxTokens: number; prompt?: string }
): Promise<string> {
  const endpointUrl = process.env.VISION_ENDPOINT_URL;
  if (!endpointUrl) {
    throw new Error('VISION_ENDPOINT_URL not configured for self-hosted vision');
  }

  const systemPrompt = options.prompt || 
    'Describe this image in detail. Include what you see, any text visible, colors, composition, and relevant context.';

  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: base64Image,
      prompt: systemPrompt,
      max_tokens: options.maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`Vision endpoint error: ${response.status}`);
  }

  const result = await response.json() as { description: string };
  return result.description || 'No description generated';
}

/**
 * Get image metadata using sharp
 */
async function getImageInfo(buffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
}> {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
    };
  } catch {
    return { width: 0, height: 0, format: 'unknown' };
  }
}

/**
 * Resize image maintaining aspect ratio
 */
async function resizeImage(
  buffer: Buffer,
  maxWidth: number,
  maxHeight: number
): Promise<Buffer> {
  return sharp(buffer)
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer();
}

/**
 * Get MIME type for image file
 */
function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'svg': 'image/svg+xml',
  };
  return mimeTypes[ext || ''] || 'image/png';
}

/**
 * Detect image format from buffer
 */
export function detectImageFormat(buffer: Buffer): SupportedImageFormat | null {
  const header = buffer.slice(0, 12);

  // PNG: 89 50 4E 47
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
    return 'jpeg';
  }

  // GIF: GIF87a or GIF89a
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
    return 'gif';
  }

  // WebP: RIFF....WEBP
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
    if (header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
      return 'webp';
    }
  }

  // BMP: BM
  if (header[0] === 0x42 && header[1] === 0x4D) {
    return 'bmp';
  }

  // TIFF: 49 49 or 4D 4D
  if ((header[0] === 0x49 && header[1] === 0x49) || (header[0] === 0x4D && header[1] === 0x4D)) {
    return 'tiff';
  }

  // SVG: starts with < (text-based)
  if (header[0] === 0x3C) {
    const headerStr = buffer.slice(0, 100).toString('utf-8').toLowerCase();
    if (headerStr.includes('<svg') || headerStr.includes('<!doctype svg')) {
      return 'svg';
    }
  }

  return null;
}

/**
 * Estimate token count for description
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
