// RADIANT v4.18.55 - DOCX/DOC Text Extraction Converter
// Uses mammoth for DOCX and handles DOC via fallback

import * as mammoth from 'mammoth';

export interface DocxExtractionResult {
  success: boolean;
  text: string;
  html?: string;  // Optional HTML representation
  metadata: {
    hasImages: boolean;
    hasStyles: boolean;
    warnings: string[];
  };
  error?: string;
}

export interface DocxExtractionOptions {
  outputFormat?: 'text' | 'html' | 'markdown';
  includeImages?: boolean;      // Include image placeholders (default: true)
  preserveStyles?: boolean;     // Preserve bold/italic in output (default: false for text)
  convertTablesToText?: boolean; // Convert tables to text format (default: true)
}

/**
 * Extract text content from a DOCX file
 * 
 * @param docxBuffer - The DOCX file as a Buffer
 * @param options - Extraction options
 * @returns Extraction result with text and metadata
 */
export async function extractDocxText(
  docxBuffer: Buffer,
  options: DocxExtractionOptions = {}
): Promise<DocxExtractionResult> {
  const {
    outputFormat = 'text',
    includeImages = true,
    preserveStyles = false,
    convertTablesToText = true,
  } = options;

  try {
    // Configure mammoth options
    const mammothOptions: mammoth.Options = {
      // Custom style mapping for cleaner output
      styleMap: preserveStyles ? [
        "b => strong",
        "i => em",
        "u => u",
        "strike => s",
      ] : [
        "b =>",
        "i =>",
        "u =>",
        "strike =>",
      ],
    };

    // Handle images
    if (includeImages) {
      mammothOptions.convertImage = mammoth.images.imgElement((image) => {
        return image.read("base64").then((imageBuffer) => {
          return {
            src: `[IMAGE: ${image.contentType}, ${Math.round(imageBuffer.length / 1024)}KB]`,
          };
        });
      });
    }

    let result: mammoth.Result;
    let text: string;

    switch (outputFormat) {
      case 'html':
        result = await mammoth.convertToHtml({ buffer: docxBuffer }, mammothOptions);
        text = result.value;
        break;
      
      case 'markdown':
        result = await mammoth.convertToHtml({ buffer: docxBuffer }, mammothOptions);
        text = htmlToMarkdown(result.value);
        break;
      
      case 'text':
      default:
        result = await mammoth.extractRawText({ buffer: docxBuffer });
        text = result.value;
        break;
    }

    // Clean up text
    text = cleanExtractedText(text);

    // Process tables if in text mode
    if (outputFormat === 'text' && convertTablesToText) {
      text = formatTablesAsText(text);
    }

    return {
      success: true,
      text,
      html: outputFormat === 'html' ? result.value : undefined,
      metadata: {
        hasImages: text.includes('[IMAGE:'),
        hasStyles: preserveStyles,
        warnings: result.messages.map(m => m.message),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown DOCX parsing error';

    // Check for common DOCX issues
    if (errorMessage.includes('Could not find') || errorMessage.includes('not a valid')) {
      return {
        success: false,
        text: '',
        metadata: { hasImages: false, hasStyles: false, warnings: [] },
        error: 'File is not a valid DOCX document. It may be corrupted or an older DOC format.',
      };
    }

    return {
      success: false,
      text: '',
      metadata: { hasImages: false, hasStyles: false, warnings: [] },
      error: `DOCX extraction failed: ${errorMessage}`,
    };
  }
}

/**
 * Convert simple HTML to Markdown
 */
function htmlToMarkdown(html: string): string {
  return html
    // Headers
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    // Bold and italic
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    // Lists
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    // Paragraphs
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Clean up
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Format tables in text output
 */
function formatTablesAsText(text: string): string {
  // mammoth extracts tables as tab-separated values
  // This is a simple pass-through; for complex tables, 
  // additional processing would be needed
  return text;
}

/**
 * Clean up extracted text
 */
function cleanExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Check if a buffer is a valid DOCX (ZIP-based Office format)
 */
export function isDocxBuffer(buffer: Buffer): boolean {
  // DOCX files are ZIP archives starting with PK
  const header = buffer.slice(0, 4);
  return header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
}

/**
 * Check if a buffer is an older DOC format
 */
export function isDocBuffer(buffer: Buffer): boolean {
  // DOC files start with D0 CF 11 E0 (OLE compound document)
  const header = buffer.slice(0, 4);
  return header[0] === 0xD0 && header[1] === 0xCF && header[2] === 0x11 && header[3] === 0xE0;
}

/**
 * Estimate token count for extracted text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
