// RADIANT v4.18.55 - PDF Text Extraction Converter
// Uses pdf-parse for reliable PDF text extraction

import pdfParse from 'pdf-parse';

export interface PdfExtractionResult {
  success: boolean;
  text: string;
  metadata: {
    pageCount: number;
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
    encrypted: boolean;
    version?: string;
  };
  error?: string;
}

export interface PdfExtractionOptions {
  maxPages?: number;           // Limit pages to extract (default: all)
  preserveFormatting?: boolean; // Try to preserve layout (default: false)
  includePageBreaks?: boolean;  // Add page break markers (default: true)
}

/**
 * Extract text content from a PDF file
 * 
 * @param pdfBuffer - The PDF file as a Buffer
 * @param options - Extraction options
 * @returns Extraction result with text and metadata
 */
export async function extractPdfText(
  pdfBuffer: Buffer,
  options: PdfExtractionOptions = {}
): Promise<PdfExtractionResult> {
  const {
    maxPages,
    preserveFormatting = false,
    includePageBreaks = true,
  } = options;

  try {
    // Configure pdf-parse options
    const parseOptions: pdfParse.Options = {
      // Custom page render function for formatting control
      pagerender: preserveFormatting ? preserveFormattingRender : undefined,
      // Limit pages if specified
      max: maxPages || 0,
    };

    const data = await pdfParse(pdfBuffer, parseOptions);

    // Process extracted text
    let text = data.text;

    // Add page break markers if requested
    if (includePageBreaks && data.numpages > 1) {
      // pdf-parse doesn't provide page boundaries directly,
      // so we estimate based on content length
      const avgPageLength = text.length / data.numpages;
      const pages: string[] = [];
      
      for (let i = 0; i < data.numpages; i++) {
        const start = Math.floor(i * avgPageLength);
        const end = Math.floor((i + 1) * avgPageLength);
        pages.push(text.slice(start, end));
      }
      
      text = pages.join('\n\n--- Page Break ---\n\n');
    }

    // Clean up text
    text = cleanExtractedText(text);

    return {
      success: true,
      text,
      metadata: {
        pageCount: data.numpages,
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
        creator: data.info?.Creator,
        producer: data.info?.Producer,
        creationDate: data.info?.CreationDate,
        modificationDate: data.info?.ModDate,
        encrypted: data.info?.IsAcroFormPresent || false,
        version: data.version,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown PDF parsing error';
    
    // Check for common PDF issues
    if (errorMessage.includes('password')) {
      return {
        success: false,
        text: '',
        metadata: { pageCount: 0, encrypted: true },
        error: 'PDF is password protected. Please provide an unencrypted PDF.',
      };
    }

    if (errorMessage.includes('Invalid') || errorMessage.includes('corrupt')) {
      return {
        success: false,
        text: '',
        metadata: { pageCount: 0, encrypted: false },
        error: 'PDF file appears to be corrupted or invalid.',
      };
    }

    return {
      success: false,
      text: '',
      metadata: { pageCount: 0, encrypted: false },
      error: `PDF extraction failed: ${errorMessage}`,
    };
  }
}

/**
 * Custom render function that tries to preserve formatting
 */
function preserveFormattingRender(pageData: any): Promise<string> {
  return pageData.getTextContent().then((textContent: any) => {
    let lastY: number | null = null;
    let text = '';

    for (const item of textContent.items) {
      if (lastY !== null && Math.abs(lastY - item.transform[5]) > 5) {
        // New line detected based on Y position change
        text += '\n';
      } else if (lastY !== null) {
        // Same line, add space between items
        text += ' ';
      }
      text += item.str;
      lastY = item.transform[5];
    }

    return text;
  });
}

/**
 * Clean up extracted text by removing excessive whitespace
 */
function cleanExtractedText(text: string): string {
  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove excessive blank lines (more than 2)
    .replace(/\n{3,}/g, '\n\n')
    // Remove trailing whitespace on each line
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    // Trim overall
    .trim();
}

/**
 * Estimate token count for extracted text
 * Uses rough estimate of ~4 characters per token
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if a buffer is a valid PDF
 */
export function isPdfBuffer(buffer: Buffer): boolean {
  // PDF files start with %PDF-
  const header = buffer.slice(0, 5).toString('ascii');
  return header === '%PDF-';
}

/**
 * Get PDF info without full text extraction (faster)
 */
export async function getPdfInfo(pdfBuffer: Buffer): Promise<{
  pageCount: number;
  title?: string;
  author?: string;
  encrypted: boolean;
}> {
  try {
    const data = await pdfParse(pdfBuffer, { max: 1 });
    return {
      pageCount: data.numpages,
      title: data.info?.Title,
      author: data.info?.Author,
      encrypted: data.info?.IsAcroFormPresent || false,
    };
  } catch {
    return {
      pageCount: 0,
      encrypted: false,
    };
  }
}
