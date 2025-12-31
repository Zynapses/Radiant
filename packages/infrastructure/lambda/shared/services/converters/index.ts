// RADIANT v4.18.55 - File Converters Index
// Re-exports all converter modules for easy importing

// PDF Converter
export {
  extractPdfText,
  isPdfBuffer,
  getPdfInfo,
  estimateTokens as estimatePdfTokens,
  type PdfExtractionResult,
  type PdfExtractionOptions,
} from './pdf-converter';

// CAD/3D Converter (STEP, STL, OBJ, DXF, GLTF)
export {
  convertCadFile,
  convertStl,
  convertObj,
  convertStep,
  convertDxf,
  convertGltf,
  detectCadFormat,
  estimateTokens as estimateCadTokens,
  type CadConversionResult,
  type CadMetadata,
  type CadConversionOptions,
} from './cad-converter';

// Domain-Specific Formats Registry
export {
  ALL_DOMAIN_FORMATS,
  MECHANICAL_ENGINEERING_FORMATS,
  ELECTRICAL_ENGINEERING_FORMATS,
  MEDICAL_FORMATS,
  SCIENTIFIC_FORMATS,
  GEOSPATIAL_FORMATS,
  LEGAL_FORMATS,
  BIOINFORMATICS_FORMATS,
  findFormatByExtension,
  findFormatByMimeType,
  getFormatsForDomain,
  getRecommendedLibrary,
  isDomainFormat,
  type DomainFormat,
  type DomainCategory,
  type LibraryRecommendation,
  type ConversionStrategy,
} from './domain-formats';

// Domain-Aware Converter Selector (AGI Brain Integration)
export {
  convertDomainFile,
  planDomainConversion,
  getSupportedDomainFormats,
  isDomainSpecificFile,
  getAiDescriptionPrompt,
  getRequiredDependencies,
  type DomainConversionRequest,
  type DomainConversionResult,
  type ConversionPlan,
} from './domain-converter-selector';

// DOCX/DOC Converter
export {
  extractDocxText,
  isDocxBuffer,
  isDocBuffer,
  estimateTokens as estimateDocxTokens,
  type DocxExtractionResult,
  type DocxExtractionOptions,
} from './docx-converter';

// Excel/CSV Converter
export {
  extractExcelData,
  parseCsv,
  isExcelBuffer,
  estimateTokens as estimateExcelTokens,
  type ExcelExtractionResult,
  type ExcelExtractionOptions,
  type SheetData,
} from './excel-converter';

// Audio Transcription Converter
export {
  transcribeAudio,
  formatAsSrt,
  formatAsVtt,
  estimateTokens as estimateAudioTokens,
  estimateDuration,
  SUPPORTED_AUDIO_FORMATS,
  type TranscriptionResult,
  type TranscriptionOptions,
  type TranscriptionSegment,
  type SupportedAudioFormat,
} from './audio-converter';

// Image Description & OCR Converter
export {
  describeImage,
  extractTextFromImage,
  detectImageFormat,
  estimateTokens as estimateImageTokens,
  SUPPORTED_IMAGE_FORMATS,
  type ImageDescriptionResult,
  type ImageDescriptionOptions,
  type OcrResult,
  type OcrOptions,
  type TextBlock,
  type SupportedImageFormat,
} from './image-converter';

// Video Description Converter
export {
  describeVideo,
  detectVideoFormat,
  estimateTokens as estimateVideoTokens,
  SUPPORTED_VIDEO_FORMATS,
  type VideoDescriptionResult,
  type VideoDescriptionOptions,
  type FrameDescription,
  type SupportedVideoFormat,
} from './video-converter';

// Archive Decompression Converter
export {
  extractArchive,
  detectArchiveFormat,
  estimateTokens as estimateArchiveTokens,
  SUPPORTED_ARCHIVE_FORMATS,
  type ArchiveExtractionResult,
  type ArchiveExtractionOptions,
  type ArchiveEntry,
  type SupportedArchiveFormat,
} from './archive-converter';
