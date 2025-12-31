// RADIANT v4.18.55 - Domain-Aware Converter Selector
// AGI Brain integration for intelligent file format conversion
// Selects appropriate libraries and strategies based on domain context

import {
  DomainFormat,
  DomainCategory,
  LibraryRecommendation,
  ConversionStrategy,
  findFormatByExtension,
  findFormatByMimeType,
  getRecommendedLibrary,
  ALL_DOMAIN_FORMATS,
} from './domain-formats';

import { convertCadFile, detectCadFormat } from './cad-converter';

// ============================================================================
// Types
// ============================================================================

export interface DomainConversionRequest {
  tenantId: string;
  userId: string;
  filename: string;
  mimeType: string;
  content: Buffer;
  userDomain?: DomainCategory;    // User's primary domain (from profile)
  conversationContext?: string;    // What the user is discussing
  targetProvider: string;
}

export interface DomainConversionResult {
  success: boolean;
  text: string;
  format: string;
  domain: DomainCategory | 'general';
  strategy: string;
  libraryUsed?: string;
  metadata: Record<string, unknown>;
  aiDescriptionPrompt?: string;
  tokenEstimate: number;
  warnings?: string[];
  error?: string;
}

export interface ConversionPlan {
  format: DomainFormat;
  selectedStrategy: ConversionStrategy;
  selectedLibrary: LibraryRecommendation;
  fallbackStrategies: ConversionStrategy[];
  requiresExternalService: boolean;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
}

// ============================================================================
// AGI Brain Integration
// ============================================================================

/**
 * AGI Brain calls this to determine how to handle a domain-specific file
 * Returns a conversion plan that the brain can execute or delegate
 */
export function planDomainConversion(
  filename: string,
  mimeType: string,
  userDomain?: DomainCategory,
  conversationContext?: string
): ConversionPlan | null {
  // Find the format
  const format = findFormatByExtension(filename) || findFormatByMimeType(mimeType);
  
  if (!format) {
    return null; // Not a domain-specific format
  }

  // Get recommended library
  const library = getRecommendedLibrary(format);
  if (!library) {
    return null;
  }

  // Select best strategy based on context
  const selectedStrategy = selectBestStrategy(format, userDomain, conversationContext);
  const fallbackStrategies = format.conversionStrategies.filter(s => s !== selectedStrategy);

  // Determine if external service is required
  const requiresExternalService = 
    !!library.systemBinary || 
    library.name.includes('API') ||
    format.complexity === 'complex';

  return {
    format,
    selectedStrategy,
    selectedLibrary: library,
    fallbackStrategies,
    requiresExternalService,
    estimatedComplexity: format.complexity,
  };
}

/**
 * Select the best conversion strategy based on context
 */
function selectBestStrategy(
  format: DomainFormat,
  userDomain?: DomainCategory,
  conversationContext?: string
): ConversionStrategy {
  const strategies = format.conversionStrategies;
  
  if (strategies.length === 0) {
    return {
      strategy: 'ai_describe',
      outputFormat: 'text',
      preserves: ['conceptual understanding'],
      loses: ['technical details'],
    };
  }

  // If user is in the same domain, prefer technical extraction
  if (userDomain === format.domain) {
    // Find the most detailed extraction strategy
    const technicalStrategy = strategies.find(s => 
      s.strategy.includes('extract') || 
      s.strategy.includes('parse') ||
      s.strategy.includes('analyze')
    );
    if (technicalStrategy) return technicalStrategy;
  }

  // If conversation mentions visualization or preview
  if (conversationContext?.toLowerCase().includes('preview') ||
      conversationContext?.toLowerCase().includes('view') ||
      conversationContext?.toLowerCase().includes('show')) {
    const visualStrategy = strategies.find(s => 
      s.strategy.includes('render') || 
      s.strategy.includes('preview') ||
      s.outputFormat === 'image'
    );
    if (visualStrategy) return visualStrategy;
  }

  // If conversation mentions data or export
  if (conversationContext?.toLowerCase().includes('data') ||
      conversationContext?.toLowerCase().includes('export') ||
      conversationContext?.toLowerCase().includes('convert')) {
    const dataStrategy = strategies.find(s => 
      s.outputFormat === 'json' || 
      s.outputFormat === 'csv' ||
      s.strategy.includes('export')
    );
    if (dataStrategy) return dataStrategy;
  }

  // Default to first strategy (usually the most common use case)
  return strategies[0];
}

// ============================================================================
// Main Conversion Function
// ============================================================================

/**
 * Execute domain-specific file conversion
 * This is the main entry point for the AGI Brain
 */
export async function convertDomainFile(
  request: DomainConversionRequest
): Promise<DomainConversionResult> {
  const { filename, mimeType, content, userDomain, conversationContext, targetProvider } = request;

  // First, check if it's a CAD file we can handle directly
  const cadFormat = detectCadFormat(content, filename);
  if (cadFormat) {
    const cadResult = await convertCadFile(content, filename);
    
    if (cadResult.success) {
      const format = findFormatByExtension(filename);
      return {
        success: true,
        text: cadResult.text,
        format: cadFormat,
        domain: 'mechanical_engineering',
        strategy: 'extract_geometry',
        metadata: cadResult.metadata,
        aiDescriptionPrompt: format?.aiDescriptionPrompt,
        tokenEstimate: Math.ceil(cadResult.text.length / 4),
      };
    } else {
      return {
        success: false,
        text: '',
        format: cadFormat,
        domain: 'mechanical_engineering',
        strategy: 'extract_geometry',
        metadata: {},
        tokenEstimate: 0,
        error: cadResult.error,
      };
    }
  }

  // Check for other domain formats
  const format = findFormatByExtension(filename) || findFormatByMimeType(mimeType);
  
  if (!format) {
    return {
      success: false,
      text: '',
      format: 'unknown',
      domain: 'general',
      strategy: 'none',
      metadata: {},
      tokenEstimate: 0,
      error: 'File format not recognized as a domain-specific format',
    };
  }

  // Plan the conversion
  const plan = planDomainConversion(filename, mimeType, userDomain, conversationContext);
  
  if (!plan) {
    return {
      success: false,
      text: '',
      format: format.format,
      domain: format.domain,
      strategy: 'none',
      metadata: {},
      tokenEstimate: 0,
      error: 'No suitable conversion strategy found',
    };
  }

  // Generate a description of what we found
  const description = generateFormatDescription(format, plan, content.length);
  
  return {
    success: true,
    text: description,
    format: format.format,
    domain: format.domain,
    strategy: plan.selectedStrategy.strategy,
    libraryUsed: plan.selectedLibrary.name,
    metadata: {
      fileSize: content.length,
      complexity: format.complexity,
      recommendedLibrary: plan.selectedLibrary.name,
      npmPackage: plan.selectedLibrary.npmPackage,
      pythonPackage: plan.selectedLibrary.pythonPackage,
      capabilities: plan.selectedLibrary.capabilities,
    },
    aiDescriptionPrompt: format.aiDescriptionPrompt,
    tokenEstimate: Math.ceil(description.length / 4),
    warnings: plan.requiresExternalService 
      ? [`Full conversion requires ${plan.selectedLibrary.name} (${plan.selectedLibrary.systemBinary || plan.selectedLibrary.pythonPackage || plan.selectedLibrary.npmPackage})`]
      : undefined,
  };
}

/**
 * Generate a description of the domain-specific file
 */
function generateFormatDescription(
  format: DomainFormat,
  plan: ConversionPlan,
  fileSize: number
): string {
  const parts: string[] = [];

  parts.push(`**Domain-Specific File Detected**`);
  parts.push('');
  parts.push(`**Format:** ${format.format.toUpperCase()}`);
  parts.push(`**Domain:** ${formatDomainName(format.domain)}${format.subDomain ? ` (${format.subDomain})` : ''}`);
  parts.push(`**Description:** ${format.description}`);
  parts.push('');

  parts.push('**File Information:**');
  parts.push(`- Size: ${formatFileSize(fileSize)}`);
  parts.push(`- Complexity: ${plan.estimatedComplexity}`);
  parts.push(`- Binary Format: ${format.binaryFormat ? 'Yes' : 'No'}`);
  parts.push('');

  parts.push('**Recommended Processing:**');
  parts.push(`- Library: ${plan.selectedLibrary.name}`);
  if (plan.selectedLibrary.npmPackage) {
    parts.push(`- NPM Package: \`${plan.selectedLibrary.npmPackage}\``);
  }
  if (plan.selectedLibrary.pythonPackage) {
    parts.push(`- Python Package: \`${plan.selectedLibrary.pythonPackage}\``);
  }
  if (plan.selectedLibrary.systemBinary) {
    parts.push(`- System Binary: \`${plan.selectedLibrary.systemBinary}\``);
  }
  parts.push(`- Capabilities: ${plan.selectedLibrary.capabilities.join(', ')}`);
  parts.push('');

  parts.push('**Conversion Strategy:**');
  parts.push(`- Strategy: ${plan.selectedStrategy.strategy}`);
  parts.push(`- Output Format: ${plan.selectedStrategy.outputFormat}`);
  parts.push(`- Preserves: ${plan.selectedStrategy.preserves.join(', ')}`);
  if (plan.selectedStrategy.loses.length > 0) {
    parts.push(`- May Lose: ${plan.selectedStrategy.loses.join(', ')}`);
  }
  parts.push('');

  if (format.aiDescriptionPrompt) {
    parts.push('**AI Analysis Prompt:**');
    parts.push(`"${format.aiDescriptionPrompt}"`);
  }

  return parts.join('\n');
}

/**
 * Format domain name for display
 */
function formatDomainName(domain: DomainCategory): string {
  return domain
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ============================================================================
// AGI Brain Helper Functions
// ============================================================================

/**
 * Get all supported domain formats
 */
export function getSupportedDomainFormats(): {
  domain: DomainCategory;
  formats: { format: string; extensions: string[]; description: string }[];
}[] {
  const byDomain = new Map<DomainCategory, DomainFormat[]>();
  
  for (const format of ALL_DOMAIN_FORMATS) {
    if (!byDomain.has(format.domain)) {
      byDomain.set(format.domain, []);
    }
    byDomain.get(format.domain)!.push(format);
  }

  return Array.from(byDomain.entries()).map(([domain, formats]) => ({
    domain,
    formats: formats.map(f => ({
      format: f.format,
      extensions: f.extensions,
      description: f.description,
    })),
  }));
}

/**
 * Check if a file is a domain-specific format
 */
export function isDomainSpecificFile(filename: string, mimeType?: string): boolean {
  return !!(findFormatByExtension(filename) || (mimeType && findFormatByMimeType(mimeType)));
}

/**
 * Get AI description prompt for a format
 */
export function getAiDescriptionPrompt(filename: string): string | undefined {
  const format = findFormatByExtension(filename);
  return format?.aiDescriptionPrompt;
}

/**
 * Get required dependencies for a format
 */
export function getRequiredDependencies(filename: string): {
  npm?: string[];
  python?: string[];
  system?: string[];
} {
  const format = findFormatByExtension(filename);
  if (!format) return {};

  const npm: string[] = [];
  const python: string[] = [];
  const system: string[] = [];

  for (const lib of format.recommendedLibraries) {
    if (lib.npmPackage) npm.push(lib.npmPackage);
    if (lib.pythonPackage) python.push(lib.pythonPackage);
    if (lib.systemBinary) system.push(lib.systemBinary);
  }

  return {
    npm: npm.length > 0 ? npm : undefined,
    python: python.length > 0 ? python : undefined,
    system: system.length > 0 ? system : undefined,
  };
}
