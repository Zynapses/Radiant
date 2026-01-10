// RADIANT v4.18.55 - Archive Decompression Converter
// Extracts and processes contents of ZIP, TAR, GZ archives

import AdmZip from 'adm-zip';
import * as tar from 'tar';
import * as zlib from 'zlib';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

export interface ArchiveExtractionResult {
  success: boolean;
  contents: ArchiveEntry[];
  text: string;           // Combined text content
  metadata: {
    archiveType: string;
    fileCount: number;
    totalSize: number;
    textFilesCount: number;
    binaryFilesCount: number;
    directoryCount: number;
  };
  error?: string;
}

export interface ArchiveEntry {
  path: string;
  type: 'file' | 'directory';
  size: number;
  isText: boolean;
  content?: string;       // Content if text file
  mimeType?: string;
  compressed?: boolean;
}

export interface ArchiveExtractionOptions {
  extractText?: boolean;       // Extract text content from files (default: true)
  maxFileSize?: number;        // Max size per file to extract (default: 5MB)
  maxTotalSize?: number;       // Max total extraction size (default: 50MB)
  maxFiles?: number;           // Max files to process (default: 100)
  includePatterns?: string[];  // Glob patterns to include
  excludePatterns?: string[];  // Glob patterns to exclude
  textExtensions?: string[];   // Extensions to treat as text
}

// Default text file extensions
const DEFAULT_TEXT_EXTENSIONS = [
  '.txt', '.md', '.json', '.xml', '.html', '.htm', '.css', '.js', '.ts',
  '.jsx', '.tsx', '.py', '.rb', '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.go', '.rs', '.php', '.sh', '.bash', '.zsh', '.yml', '.yaml',
  '.toml', '.ini', '.cfg', '.conf', '.env', '.gitignore', '.dockerfile',
  '.sql', '.graphql', '.proto', '.csv', '.log', '.svg', '.tex', '.rtf',
];

// Supported archive formats
export const SUPPORTED_ARCHIVE_FORMATS = ['zip', 'tar', 'gz', 'tgz', 'tar.gz'] as const;
export type SupportedArchiveFormat = typeof SUPPORTED_ARCHIVE_FORMATS[number];

/**
 * Extract contents from an archive
 * 
 * @param archiveBuffer - The archive file as a Buffer
 * @param filename - Original filename (for format detection)
 * @param options - Extraction options
 * @returns Extraction result with contents and metadata
 */
export async function extractArchive(
  archiveBuffer: Buffer,
  filename: string,
  options: ArchiveExtractionOptions = {}
): Promise<ArchiveExtractionResult> {
  const {
    extractText = true,
    maxFileSize = 5 * 1024 * 1024,      // 5MB per file
    maxTotalSize = 50 * 1024 * 1024,    // 50MB total
    maxFiles = 100,
    includePatterns,
    excludePatterns = ['node_modules/**', '.git/**', '__pycache__/**', '*.pyc'],
    textExtensions = DEFAULT_TEXT_EXTENSIONS,
  } = options;

  try {
    const format = detectArchiveFormat(archiveBuffer, filename);
    if (!format) {
      return {
        success: false,
        contents: [],
        text: '',
        metadata: createEmptyMetadata(),
        error: 'Unsupported or unrecognized archive format',
      };
    }

    let entries: ArchiveEntry[];

    switch (format) {
      case 'zip':
        entries = await extractZip(archiveBuffer, {
          extractText,
          maxFileSize,
          maxTotalSize,
          maxFiles,
          includePatterns,
          excludePatterns,
          textExtensions,
        });
        break;

      case 'tar':
      case 'tgz':
      case 'tar.gz':
        entries = await extractTar(archiveBuffer, format, {
          extractText,
          maxFileSize,
          maxTotalSize,
          maxFiles,
          includePatterns,
          excludePatterns,
          textExtensions,
        });
        break;

      case 'gz':
        entries = await extractGzip(archiveBuffer, filename, {
          extractText,
          maxFileSize,
          textExtensions,
        });
        break;

      default:
        return {
          success: false,
          contents: [],
          text: '',
          metadata: createEmptyMetadata(),
          error: `Unsupported archive format: ${format}`,
        };
    }

    // Generate combined text output
    const textContent = generateTextOutput(entries, format);

    // Calculate metadata
    const metadata = {
      archiveType: format,
      fileCount: entries.filter(e => e.type === 'file').length,
      totalSize: entries.reduce((sum, e) => sum + e.size, 0),
      textFilesCount: entries.filter(e => e.isText && e.content).length,
      binaryFilesCount: entries.filter(e => e.type === 'file' && !e.isText).length,
      directoryCount: entries.filter(e => e.type === 'directory').length,
    };

    return {
      success: true,
      contents: entries,
      text: textContent,
      metadata,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown archive error';
    return {
      success: false,
      contents: [],
      text: '',
      metadata: createEmptyMetadata(),
      error: `Archive extraction failed: ${errorMessage}`,
    };
  }
}

/**
 * Extract ZIP archive
 */
async function extractZip(
  buffer: Buffer,
  options: ArchiveExtractionOptions
): Promise<ArchiveEntry[]> {
  const zip = new AdmZip(buffer);
  const zipEntries = zip.getEntries();
  const entries: ArchiveEntry[] = [];

  let processedCount = 0;
  let totalSize = 0;

  for (const entry of zipEntries) {
    // Check limits
    if (processedCount >= (options.maxFiles || 100)) break;
    if (totalSize >= (options.maxTotalSize || 50 * 1024 * 1024)) break;

    const entryPath = entry.entryName;

    // Apply exclude patterns
    if (options.excludePatterns && shouldExclude(entryPath, options.excludePatterns)) {
      continue;
    }

    // Apply include patterns
    if (options.includePatterns && !shouldInclude(entryPath, options.includePatterns)) {
      continue;
    }

    if (entry.isDirectory) {
      entries.push({
        path: entryPath,
        type: 'directory',
        size: 0,
        isText: false,
      });
    } else {
      const size = entry.header.size;
      const ext = path.extname(entryPath).toLowerCase();
      const isText = isTextFile(entryPath, options.textExtensions || DEFAULT_TEXT_EXTENSIONS);

      let content: string | undefined;

      if (options.extractText && isText && size <= (options.maxFileSize || 5 * 1024 * 1024)) {
        try {
          const data = entry.getData();
          content = data.toString('utf-8');
        } catch {
          content = undefined;
        }
      }

      entries.push({
        path: entryPath,
        type: 'file',
        size,
        isText,
        content,
        mimeType: getMimeType(ext),
      });

      totalSize += size;
    }

    processedCount++;
  }

  return entries;
}

/**
 * Extract TAR archive (with optional gzip)
 */
async function extractTar(
  buffer: Buffer,
  format: string,
  options: ArchiveExtractionOptions
): Promise<ArchiveEntry[]> {
  const tempDir = path.join(os.tmpdir(), `radiant-tar-${uuidv4()}`);
  const entries: ArchiveEntry[] = [];

  try {
    // Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });

    // Decompress if gzipped
    let tarBuffer = buffer;
    if (format === 'tgz' || format === 'tar.gz') {
      tarBuffer = zlib.gunzipSync(buffer);
    }

    // Write tar to temp file
    const tarPath = path.join(tempDir, 'archive.tar');
    fs.writeFileSync(tarPath, tarBuffer);

    // Extract tar
    const extractDir = path.join(tempDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });

    await tar.extract({
      file: tarPath,
      cwd: extractDir,
    });

    // Read extracted files
    let processedCount = 0;
    let totalSize = 0;

    const processDirectory = (dirPath: string, relativePath: string = '') => {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const item of items) {
        if (processedCount >= (options.maxFiles || 100)) return;
        if (totalSize >= (options.maxTotalSize || 50 * 1024 * 1024)) return;

        const fullPath = path.join(dirPath, item.name);
        const entryPath = path.join(relativePath, item.name);

        // Apply filters
        if (options.excludePatterns && shouldExclude(entryPath, options.excludePatterns)) {
          continue;
        }

        if (item.isDirectory()) {
          entries.push({
            path: entryPath + '/',
            type: 'directory',
            size: 0,
            isText: false,
          });
          processDirectory(fullPath, entryPath);
        } else {
          const stats = fs.statSync(fullPath);
          const isText = isTextFile(entryPath, options.textExtensions || DEFAULT_TEXT_EXTENSIONS);

          let content: string | undefined;

          if (options.extractText && isText && stats.size <= (options.maxFileSize || 5 * 1024 * 1024)) {
            try {
              content = fs.readFileSync(fullPath, 'utf-8');
            } catch {
              content = undefined;
            }
          }

          entries.push({
            path: entryPath,
            type: 'file',
            size: stats.size,
            isText,
            content,
            mimeType: getMimeType(path.extname(entryPath)),
          });

          totalSize += stats.size;
        }

        processedCount++;
      }
    };

    processDirectory(extractDir);

    return entries;
  } finally {
    // Cleanup
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Extract single gzipped file
 */
async function extractGzip(
  buffer: Buffer,
  filename: string,
  options: ArchiveExtractionOptions
): Promise<ArchiveEntry[]> {
  try {
    const decompressed = zlib.gunzipSync(buffer);

    // Remove .gz extension for the actual filename
    const actualFilename = filename.replace(/\.gz$/i, '');
    const isText = isTextFile(actualFilename, options.textExtensions || DEFAULT_TEXT_EXTENSIONS);

    let content: string | undefined;
    if (options.extractText && isText && decompressed.length <= (options.maxFileSize || 5 * 1024 * 1024)) {
      content = decompressed.toString('utf-8');
    }

    return [{
      path: actualFilename,
      type: 'file',
      size: decompressed.length,
      isText,
      content,
      compressed: true,
      mimeType: getMimeType(path.extname(actualFilename)),
    }];
  } catch (error) {
    throw new Error(`Gzip decompression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate text output from archive contents
 */
function generateTextOutput(entries: ArchiveEntry[], archiveType: string): string {
  const parts: string[] = [];

  parts.push(`**Archive Contents** (${archiveType.toUpperCase()})`);
  parts.push('');

  // File tree
  parts.push('**File Structure:**');
  parts.push('```');
  for (const entry of entries.slice(0, 50)) {
    const prefix = entry.type === 'directory' ? '📁 ' : '📄 ';
    const size = entry.type === 'file' ? ` (${formatSize(entry.size)})` : '';
    parts.push(`${prefix}${entry.path}${size}`);
  }
  if (entries.length > 50) {
    parts.push(`... and ${entries.length - 50} more items`);
  }
  parts.push('```');
  parts.push('');

  // Text file contents
  const textFiles = entries.filter(e => e.isText && e.content);
  if (textFiles.length > 0) {
    parts.push('**File Contents:**');
    parts.push('');

    for (const file of textFiles.slice(0, 20)) {
      const ext = path.extname(file.path).slice(1) || 'txt';
      parts.push(`### ${file.path}`);
      parts.push('');
      parts.push('```' + ext);
      
      // Truncate long files
      const content = file.content || '';
      if (content.length > 5000) {
        parts.push(content.substring(0, 5000));
        parts.push(`\n... (truncated, ${content.length} total characters)`);
      } else {
        parts.push(content);
      }
      
      parts.push('```');
      parts.push('');
    }

    if (textFiles.length > 20) {
      parts.push(`*${textFiles.length - 20} more text files not shown*`);
    }
  }

  return parts.join('\n');
}

/**
 * Check if file should be excluded based on patterns
 */
function shouldExclude(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (matchGlob(filePath, pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if file should be included based on patterns
 */
function shouldInclude(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (matchGlob(filePath, pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Simple glob pattern matching
 */
function matchGlob(filePath: string, pattern: string): boolean {
  // Convert glob to regex
  const regex = new RegExp(
    '^' +
    pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.') +
    '$'
  );
  return regex.test(filePath);
}

/**
 * Check if file is a text file based on extension
 */
function isTextFile(filePath: string, textExtensions: string[]): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return textExtensions.includes(ext);
}

/**
 * Get MIME type from extension
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    '.py': 'text/x-python',
    '.java': 'text/x-java',
    '.c': 'text/x-c',
    '.cpp': 'text/x-c++',
    '.go': 'text/x-go',
    '.rs': 'text/x-rust',
    '.rb': 'text/x-ruby',
    '.php': 'text/x-php',
    '.sql': 'application/sql',
    '.csv': 'text/csv',
    '.yml': 'application/x-yaml',
    '.yaml': 'application/x-yaml',
  };
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Format file size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Detect archive format from buffer and filename
 */
export function detectArchiveFormat(buffer: Buffer, filename: string): SupportedArchiveFormat | null {
  const header = buffer.slice(0, 10);

  // ZIP: PK (0x50 0x4B)
  if (header[0] === 0x50 && header[1] === 0x4B) {
    return 'zip';
  }

  // GZIP: 1F 8B
  if (header[0] === 0x1F && header[1] === 0x8B) {
    // Check if it's a .tar.gz or .tgz
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.endsWith('.tar.gz') || lowerFilename.endsWith('.tgz')) {
      return 'tar.gz';
    }
    return 'gz';
  }

  // TAR: Check for ustar at offset 257
  if (buffer.length >= 265) {
    const ustar = buffer.slice(257, 262).toString('ascii');
    if (ustar === 'ustar') {
      return 'tar';
    }
  }

  // Fall back to extension
  const ext = filename.toLowerCase();
  if (ext.endsWith('.zip')) return 'zip';
  if (ext.endsWith('.tar')) return 'tar';
  if (ext.endsWith('.tar.gz') || ext.endsWith('.tgz')) return 'tar.gz';
  if (ext.endsWith('.gz')) return 'gz';

  return null;
}

/**
 * Create empty metadata object
 */
function createEmptyMetadata() {
  return {
    archiveType: 'unknown',
    fileCount: 0,
    totalSize: 0,
    textFilesCount: 0,
    binaryFilesCount: 0,
    directoryCount: 0,
  };
}

/**
 * Estimate token count for archive text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
