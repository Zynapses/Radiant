// RADIANT v4.18.0 - Library Assist Service
// Integration point for AI models to query and use open-source libraries
// AI models/modes use this to decide if libraries are helpful in solving problems

import { libraryRegistryService, LibraryMatchResult, Library } from './library-registry.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// Proficiency scores matching the library registry schema
interface ProficiencyScores {
  reasoning_depth: number;
  mathematical_quantitative: number;
  code_generation: number;
  creative_generative: number;
  research_synthesis: number;
  factual_recall_precision: number;
  multi_step_problem_solving: number;
  domain_terminology_handling: number;
}

// ============================================================================
// Types
// ============================================================================

export interface LibraryAssistContext {
  tenantId: string;
  userId: string;
  conversationId?: string;
  requestId: string;
  prompt: string;
  detectedDomain?: string;
  taskType?: string;
}

export interface LibraryRecommendation {
  library: Library;
  matchScore: number;
  reason: string;
  suggestedUsage: string;
  codeExample?: string;
}

export interface LibraryAssistResult {
  enabled: boolean;
  recommendations: LibraryRecommendation[];
  totalMatched: number;
  processingTimeMs: number;
  contextBlock?: string;
}

export interface LibraryInvocationContext {
  tenantId: string;
  userId: string;
  libraryId: string;
  invocationType: 'code_generation' | 'data_processing' | 'analysis' | 'transformation' | 'search' | 'inference' | 'optimization' | 'simulation';
  input: unknown;
  conversationId?: string;
  requestId?: string;
}

export interface LibraryInvocationResult {
  success: boolean;
  output?: unknown;
  codeGenerated?: string;
  error?: string;
  executionTimeMs: number;
}

// ============================================================================
// Proficiency Extraction from Prompt
// ============================================================================

const PROFICIENCY_KEYWORDS: Record<keyof ProficiencyScores, string[]> = {
  reasoning_depth: ['analyze', 'explain', 'why', 'how', 'understand', 'deduce', 'infer', 'logic'],
  mathematical_quantitative: ['calculate', 'compute', 'math', 'statistics', 'numerical', 'formula', 'equation', 'data'],
  code_generation: ['code', 'program', 'implement', 'function', 'script', 'algorithm', 'debug', 'refactor'],
  creative_generative: ['create', 'generate', 'design', 'imagine', 'compose', 'write', 'story', 'art'],
  research_synthesis: ['research', 'summarize', 'compare', 'review', 'literature', 'sources', 'findings'],
  factual_recall_precision: ['what is', 'define', 'fact', 'accurate', 'precise', 'exact', 'correct'],
  multi_step_problem_solving: ['step by step', 'plan', 'workflow', 'process', 'pipeline', 'orchestrate'],
  domain_terminology_handling: ['technical', 'jargon', 'domain', 'specialized', 'terminology', 'expert'],
};

function extractProficienciesFromPrompt(prompt: string): Partial<ProficiencyScores> {
  const lowerPrompt = prompt.toLowerCase();
  const proficiencies: Partial<ProficiencyScores> = {};

  for (const [key, keywords] of Object.entries(PROFICIENCY_KEYWORDS)) {
    const matchCount = keywords.filter(kw => lowerPrompt.includes(kw)).length;
    if (matchCount > 0) {
      // Scale based on keyword matches (1-3 keywords = low, 4+ = high)
      const score = Math.min(3 + matchCount * 2, 10);
      proficiencies[key as keyof ProficiencyScores] = score;
    }
  }

  return proficiencies;
}

// ============================================================================
// Domain Detection
// ============================================================================

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  artificial_intelligence: ['ai', 'ml', 'machine learning', 'neural', 'model', 'training', 'inference', 'nlp', 'llm'],
  computer_science: ['code', 'programming', 'algorithm', 'database', 'api', 'server', 'software'],
  business: ['analytics', 'dashboard', 'report', 'sales', 'customer', 'revenue', 'forecast', 'kpi'],
  sciences: ['experiment', 'hypothesis', 'research', 'scientific', 'data analysis', 'statistics'],
  engineering: ['design', 'simulation', 'cad', 'mechanical', 'electrical', 'system'],
  medicine_healthcare: ['medical', 'health', 'patient', 'clinical', 'diagnosis', 'treatment', 'imaging'],
  mathematics: ['math', 'equation', 'proof', 'theorem', 'calculus', 'algebra', 'optimization'],
};

function detectDomainFromPrompt(prompt: string): string[] {
  const lowerPrompt = prompt.toLowerCase();
  const domains: string[] = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(kw => lowerPrompt.includes(kw))) {
      domains.push(domain);
    }
  }

  return domains.length > 0 ? domains : ['all'];
}

// ============================================================================
// Library Assist Service
// ============================================================================

class LibraryAssistService {
  
  /**
   * Get library recommendations for a given prompt/task
   * Called by AI models during problem-solving to see if libraries can help
   */
  async getRecommendations(context: LibraryAssistContext): Promise<LibraryAssistResult> {
    const startTime = Date.now();

    try {
      // Check if library assist is enabled for this tenant
      const config = await libraryRegistryService.getConfig(context.tenantId);
      
      if (!config.libraryAssistEnabled) {
        return {
          enabled: false,
          recommendations: [],
          totalMatched: 0,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Extract proficiencies from the prompt
      const requiredProficiencies = extractProficienciesFromPrompt(context.prompt);
      
      // Detect domains from the prompt
      const domains = context.detectedDomain 
        ? [context.detectedDomain] 
        : detectDomainFromPrompt(context.prompt);

      // Try Vector RAG first for semantic matching
      let matches = await libraryRegistryService.findLibrariesBySemanticSearch(
        context.tenantId,
        context.prompt,
        { maxResults: config.maxLibrariesPerRequest, minSimilarity: 0.5 }
      );

      // Fall back to proficiency matching if Vector RAG returns no results
      if (matches.length === 0) {
        logger.debug('Vector RAG returned no results, falling back to proficiency matching');
        matches = await libraryRegistryService.findMatchingLibraries(
          context.tenantId,
          requiredProficiencies,
          { domains, maxResults: config.maxLibrariesPerRequest }
        );
      } else {
        logger.debug('Vector RAG found libraries', { count: matches.length });
      }

      // Transform to recommendations with usage suggestions
      const recommendations = matches.map(match => this.toRecommendation(match, context));

      // Build context block for system prompt injection
      const contextBlock = this.buildContextBlock(recommendations);

      return {
        enabled: true,
        recommendations,
        totalMatched: matches.length,
        processingTimeMs: Date.now() - startTime,
        contextBlock: recommendations.length > 0 ? contextBlock : undefined,
      };

    } catch (error) {
      logger.error('Library assist failed', { error, context });
      return {
        enabled: true,
        recommendations: [],
        totalMatched: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Record that a library was used to help solve a problem
   */
  async recordLibraryUsage(
    context: LibraryInvocationContext,
    result: LibraryInvocationResult
  ): Promise<void> {
    try {
      await libraryRegistryService.recordUsage(
        context.tenantId,
        context.userId,
        context.libraryId,
        context.invocationType,
        result.success,
        result.executionTimeMs,
        {
          errorMessage: result.error,
          conversationId: context.conversationId,
          requestId: context.requestId,
        }
      );
    } catch (error) {
      logger.error('Failed to record library usage', { error, context });
    }
  }

  /**
   * Get a specific library by ID for direct use
   */
  async getLibrary(libraryId: string): Promise<Library | null> {
    return libraryRegistryService.getLibrary(libraryId);
  }

  /**
   * Get all libraries in a category
   */
  async getLibrariesByCategory(category: string): Promise<Library[]> {
    return libraryRegistryService.getLibrariesByCategory(category);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private toRecommendation(match: LibraryMatchResult, context: LibraryAssistContext): LibraryRecommendation {
    const suggestedUsage = this.generateUsageSuggestion(match.library, context);
    const codeExample = this.generateCodeExample(match.library, context);

    return {
      library: match.library,
      matchScore: match.matchScore,
      reason: match.reason,
      suggestedUsage,
      codeExample,
    };
  }

  private generateUsageSuggestion(library: Library, context: LibraryAssistContext): string {
    const taskType = context.taskType || 'this task';
    
    const categoryUsages: Record<string, string> = {
      'Data Processing': `Use ${library.name} for efficient data manipulation and transformation`,
      'Databases': `Query and store data using ${library.name}`,
      'Vector Databases': `Store and search embeddings with ${library.name}`,
      'Search': `Implement search functionality using ${library.name}`,
      'ML Frameworks': `Build and train models with ${library.name}`,
      'LLM Orchestration': `Orchestrate LLM workflows using ${library.name}`,
      'NLP': `Process and analyze text with ${library.name}`,
      'Computer Vision': `Process images/video using ${library.name}`,
      'Scientific Computing': `Perform numerical computations with ${library.name}`,
      'Statistics & Forecasting': `Analyze data and forecast with ${library.name}`,
      'Optimization': `Solve optimization problems using ${library.name}`,
    };

    return categoryUsages[library.category] || `Use ${library.name} for ${taskType}`;
  }

  private generateCodeExample(library: Library, _context: LibraryAssistContext): string | undefined {
    // Generate simple code examples for common libraries
    const examples: Record<string, string> = {
      polars: `import polars as pl\ndf = pl.read_csv("data.csv")\nresult = df.filter(pl.col("value") > 100).group_by("category").agg(pl.mean("value"))`,
      duckdb: `import duckdb\nconn = duckdb.connect()\nresult = conn.execute("SELECT * FROM 'data.parquet' WHERE value > 100").fetchdf()`,
      numpy: `import numpy as np\narr = np.array([1, 2, 3, 4, 5])\nmean = np.mean(arr)`,
      pytorch: `import torch\nmodel = torch.nn.Linear(10, 1)\noutput = model(torch.randn(32, 10))`,
      langchain: `from langchain.chains import LLMChain\nfrom langchain.prompts import PromptTemplate\nchain = LLMChain(llm=llm, prompt=prompt)`,
      spacy: `import spacy\nnlp = spacy.load("en_core_web_sm")\ndoc = nlp("Analyze this text.")\nentities = [(ent.text, ent.label_) for ent in doc.ents]`,
      whisper: `import whisper\nmodel = whisper.load_model("base")\nresult = model.transcribe("audio.mp3")`,
      opencv: `import cv2\nimg = cv2.imread("image.jpg")\ngray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)`,
    };

    return examples[library.libraryId];
  }

  private buildContextBlock(recommendations: LibraryRecommendation[]): string {
    if (recommendations.length === 0) return '';

    const lines = [
      '<available_libraries>',
      'The following open-source libraries are available to help solve this problem:',
      '',
    ];

    for (const rec of recommendations) {
      lines.push(`- **${rec.library.name}** (${rec.library.category})`);
      lines.push(`  ${rec.library.description}`);
      lines.push(`  ${rec.suggestedUsage}`);
      if (rec.codeExample) {
        lines.push('  ```python');
        lines.push(`  ${rec.codeExample.split('\n').join('\n  ')}`);
        lines.push('  ```');
      }
      lines.push('');
    }

    lines.push('</available_libraries>');

    return lines.join('\n');
  }
}

export const libraryAssistService = new LibraryAssistService();
