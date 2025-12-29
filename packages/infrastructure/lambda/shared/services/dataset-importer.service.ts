// RADIANT v4.18.0 - Security Dataset Importer Service
// Import HarmBench, WildJailbreak, ToxicChat, JailbreakBench datasets
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface DatasetInfo {
  name: string;
  source: string;
  url: string;
  license: string;
  size: string;
  description: string;
}

export interface ImportResult {
  dataset: string;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface HarmBenchBehavior {
  behavior_id: string;
  behavior: string;
  category: string;
  tags: string[];
  context?: string;
}

export interface WildJailbreakExample {
  prompt: string;
  response?: string;
  category: string;
  tactic_cluster?: string;
  is_harmful: boolean;
}

export interface ToxicChatExample {
  user_input: string;
  model_output?: string;
  toxicity: boolean;
  jailbreaking: boolean;
  human_annotation?: string;
}

export interface JailbreakBenchBehavior {
  behavior: string;
  category: string;
  is_benign: boolean;
}

// Dataset metadata
const DATASETS: Record<string, DatasetInfo> = {
  harmbench: {
    name: 'HarmBench',
    source: 'UC Berkeley, Google DeepMind, CAIS',
    url: 'https://harmbench.org',
    license: 'MIT',
    size: '510 behaviors',
    description: 'Curated harmful behaviors across 7 semantic categories',
  },
  wildjailbreak: {
    name: 'WildJailbreak',
    source: 'Allen AI',
    url: 'https://huggingface.co/datasets/allenai/wildjailbreak',
    license: 'Allen AI License',
    size: '262,000 examples',
    description: 'Real user-chatbot jailbreak interactions with 5,700 tactic clusters',
  },
  toxicchat: {
    name: 'ToxicChat',
    source: 'LMSYS',
    url: 'https://huggingface.co/datasets/lmsys/toxic-chat',
    license: 'CC BY-NC 4.0',
    size: '10,166 examples',
    description: 'Real user-AI conversations with toxicity and jailbreak labels',
  },
  jailbreakbench: {
    name: 'JailbreakBench',
    source: 'NeurIPS 2024',
    url: 'https://jailbreakbench.github.io',
    license: 'MIT',
    size: '200 behaviors',
    description: 'Standardized jailbreak evaluation with 100 harmful + 100 benign behaviors',
  },
  advbench: {
    name: 'AdvBench',
    source: 'GCG Paper Authors',
    url: 'https://huggingface.co/datasets/walledai/AdvBench',
    license: 'MIT',
    size: '520 instructions',
    description: 'Adversarial benchmark for harmful behavior generation',
  },
  donotanswer: {
    name: 'Do-Not-Answer',
    source: 'Safety Research',
    url: 'https://huggingface.co/datasets/LibrAI/do-not-answer',
    license: 'CC BY-NC-SA 4.0',
    size: '939 instructions',
    description: 'Three-level taxonomy of 61 specific harms',
  },
};

// HarmBench category mapping to our taxonomy
const HARMBENCH_CATEGORY_MAP: Record<string, string> = {
  'chemical_biological': 'chem_bio',
  'cybercrime': 'cybercrime',
  'copyright': 'copyright',
  'misinformation': 'misinformation',
  'harassment': 'harassment',
  'illegal': 'illegal_activity',
  'general': 'physical_harm',
};

// WildJailbreak tactic cluster to pattern type mapping
const WILDJAILBREAK_TACTIC_MAP: Record<string, string> = {
  'role_play': 'roleplay',
  'hypothetical': 'hypothetical',
  'encoding': 'encoding',
  'instruction_manipulation': 'instruction_override',
  'context_manipulation': 'context_manipulation',
  'gradual': 'gradual',
  'translation': 'translation',
  'persona': 'roleplay',
  'jailbreak_prompt': 'dan',
};

// ============================================================================
// Dataset Importer Service
// ============================================================================

class DatasetImporterService {
  
  /**
   * Get available datasets
   */
  getAvailableDatasets(): DatasetInfo[] {
    return Object.values(DATASETS);
  }
  
  /**
   * Get dataset info
   */
  getDatasetInfo(datasetName: string): DatasetInfo | null {
    return DATASETS[datasetName.toLowerCase()] || null;
  }
  
  /**
   * Import HarmBench behaviors
   */
  async importHarmBench(behaviors: HarmBenchBehavior[]): Promise<ImportResult> {
    const result: ImportResult = {
      dataset: 'harmbench',
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    
    for (const behavior of behaviors) {
      try {
        const category = HARMBENCH_CATEGORY_MAP[behavior.category] || 'illegal_activity';
        
        // Check if already exists
        const existing = await executeStatement(
          `SELECT id FROM jailbreak_patterns WHERE source_id = $1 AND source = 'harmbench'`,
          [stringParam('sourceId', behavior.behavior_id)]
        );
        
        if (existing.rows?.length) {
          result.skipped++;
          continue;
        }
        
        // Insert as jailbreak pattern
        await executeStatement(
          `INSERT INTO jailbreak_patterns (
            pattern_name, pattern_type, example_prompts, severity, source, source_id, is_active
          ) VALUES ($1, $2, $3, $4, 'harmbench', $5, true)`,
          [
            stringParam('patternName', `HarmBench: ${behavior.behavior_id}`),
            stringParam('patternType', category),
            stringParam('examplePrompts', `{"${behavior.behavior.replace(/"/g, '\\"')}"}`),
            longParam('severity', this.categoryToSeverity(category)),
            stringParam('sourceId', behavior.behavior_id),
          ]
        );
        
        result.imported++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Failed to import ${behavior.behavior_id}: ${error}`);
      }
    }
    
    logger.info('HarmBench import complete', result);
    return result;
  }
  
  /**
   * Import WildJailbreak examples
   */
  async importWildJailbreak(examples: WildJailbreakExample[]): Promise<ImportResult> {
    const result: ImportResult = {
      dataset: 'wildjailbreak',
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    
    // Group by tactic cluster for deduplication
    const tacticClusters = new Map<string, WildJailbreakExample[]>();
    
    for (const example of examples) {
      if (!example.is_harmful) {
        result.skipped++;
        continue;
      }
      
      const cluster = example.tactic_cluster || 'unknown';
      if (!tacticClusters.has(cluster)) {
        tacticClusters.set(cluster, []);
      }
      tacticClusters.get(cluster)!.push(example);
    }
    
    // Import one pattern per tactic cluster with multiple examples
    for (const [cluster, clusterExamples] of tacticClusters) {
      try {
        const patternType = this.mapWildJailbreakTactic(cluster);
        const sourceId = `wildjailbreak_${cluster}`;
        
        // Check if already exists
        const existing = await executeStatement(
          `SELECT id FROM jailbreak_patterns WHERE source_id = $1 AND source = 'wildjailbreak'`,
          [stringParam('sourceId', sourceId)]
        );
        
        if (existing.rows?.length) {
          result.skipped += clusterExamples.length;
          continue;
        }
        
        // Get up to 5 example prompts
        const examplePrompts = clusterExamples
          .slice(0, 5)
          .map(e => e.prompt.substring(0, 500));
        
        await executeStatement(
          `INSERT INTO jailbreak_patterns (
            pattern_name, pattern_type, example_prompts, severity, source, source_id, is_active
          ) VALUES ($1, $2, $3, $4, 'wildjailbreak', $5, true)`,
          [
            stringParam('patternName', `WildJailbreak: ${cluster}`),
            stringParam('patternType', patternType),
            stringParam('examplePrompts', `{${examplePrompts.map(p => `"${p.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`).join(',')}}`),
            longParam('severity', 7),
            stringParam('sourceId', sourceId),
          ]
        );
        
        result.imported += clusterExamples.length;
      } catch (error) {
        result.failed += clusterExamples.length;
        result.errors.push(`Failed to import cluster ${cluster}: ${error}`);
      }
    }
    
    logger.info('WildJailbreak import complete', result);
    return result;
  }
  
  /**
   * Import ToxicChat examples
   */
  async importToxicChat(examples: ToxicChatExample[]): Promise<ImportResult> {
    const result: ImportResult = {
      dataset: 'toxicchat',
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    
    // Only import examples flagged as jailbreaking or toxic
    const harmful = examples.filter(e => e.jailbreaking || e.toxicity);
    
    for (const example of harmful) {
      try {
        const hash = crypto.createHash('md5').update(example.user_input).digest('hex').substring(0, 12);
        const sourceId = `toxicchat_${hash}`;
        
        // Check if already exists
        const existing = await executeStatement(
          `SELECT id FROM jailbreak_patterns WHERE source_id = $1 AND source = 'toxicchat'`,
          [stringParam('sourceId', sourceId)]
        );
        
        if (existing.rows?.length) {
          result.skipped++;
          continue;
        }
        
        const patternType = example.jailbreaking ? 'dan' : 'harassment';
        
        await executeStatement(
          `INSERT INTO jailbreak_patterns (
            pattern_name, pattern_type, example_prompts, severity, source, source_id, is_active
          ) VALUES ($1, $2, $3, $4, 'toxicchat', $5, true)`,
          [
            stringParam('patternName', `ToxicChat: ${hash}`),
            stringParam('patternType', patternType),
            stringParam('examplePrompts', `{"${example.user_input.substring(0, 500).replace(/"/g, '\\"').replace(/\n/g, ' ')}"}`),
            longParam('severity', example.jailbreaking ? 8 : 6),
            stringParam('sourceId', sourceId),
          ]
        );
        
        result.imported++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Failed to import ToxicChat example: ${error}`);
      }
    }
    
    logger.info('ToxicChat import complete', result);
    return result;
  }
  
  /**
   * Import JailbreakBench behaviors
   */
  async importJailbreakBench(behaviors: JailbreakBenchBehavior[]): Promise<ImportResult> {
    const result: ImportResult = {
      dataset: 'jailbreakbench',
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    
    // Only import harmful behaviors
    const harmful = behaviors.filter(b => !b.is_benign);
    
    for (const behavior of harmful) {
      try {
        const hash = crypto.createHash('md5').update(behavior.behavior).digest('hex').substring(0, 12);
        const sourceId = `jailbreakbench_${hash}`;
        
        // Check if already exists
        const existing = await executeStatement(
          `SELECT id FROM jailbreak_patterns WHERE source_id = $1 AND source = 'jailbreakbench'`,
          [stringParam('sourceId', sourceId)]
        );
        
        if (existing.rows?.length) {
          result.skipped++;
          continue;
        }
        
        const category = HARMBENCH_CATEGORY_MAP[behavior.category] || 'illegal_activity';
        
        await executeStatement(
          `INSERT INTO jailbreak_patterns (
            pattern_name, pattern_type, example_prompts, severity, source, source_id, is_active
          ) VALUES ($1, $2, $3, $4, 'jailbreakbench', $5, true)`,
          [
            stringParam('patternName', `JailbreakBench: ${hash}`),
            stringParam('patternType', category),
            stringParam('examplePrompts', `{"${behavior.behavior.substring(0, 500).replace(/"/g, '\\"').replace(/\n/g, ' ')}"}`),
            longParam('severity', this.categoryToSeverity(category)),
            stringParam('sourceId', sourceId),
          ]
        );
        
        result.imported++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Failed to import JailbreakBench behavior: ${error}`);
      }
    }
    
    logger.info('JailbreakBench import complete', result);
    return result;
  }
  
  /**
   * Import from HuggingFace dataset URL
   */
  async importFromHuggingFace(
    datasetPath: string,
    split: string = 'train',
    limit?: number
  ): Promise<ImportResult> {
    // This would use the HuggingFace datasets API
    // For now, return a placeholder that documents the expected format
    
    logger.info('HuggingFace import initiated', { datasetPath, split, limit });
    
    // In production, this would:
    // 1. Call HuggingFace API to download dataset
    // 2. Parse the appropriate format
    // 3. Call the appropriate import method
    
    return {
      dataset: datasetPath,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: ['HuggingFace import requires API key configuration'],
    };
  }
  
  /**
   * Get import statistics
   */
  async getImportStats(): Promise<{
    totalPatterns: number;
    bySource: Record<string, number>;
    byType: Record<string, number>;
    lastImportAt?: Date;
  }> {
    const sourceResult = await executeStatement(
      `SELECT source, COUNT(*) as count FROM jailbreak_patterns WHERE is_active = true GROUP BY source`,
      []
    );
    
    const typeResult = await executeStatement(
      `SELECT pattern_type, COUNT(*) as count FROM jailbreak_patterns WHERE is_active = true GROUP BY pattern_type`,
      []
    );
    
    const latestResult = await executeStatement(
      `SELECT MAX(created_at) as latest FROM jailbreak_patterns`,
      []
    );
    
    const bySource: Record<string, number> = {};
    for (const row of sourceResult.rows || []) {
      bySource[String(row.source)] = Number(row.count);
    }
    
    const byType: Record<string, number> = {};
    for (const row of typeResult.rows || []) {
      byType[String(row.pattern_type)] = Number(row.count);
    }
    
    const total = Object.values(bySource).reduce((s, v) => s + v, 0);
    
    return {
      totalPatterns: total,
      bySource,
      byType,
      lastImportAt: latestResult.rows?.[0]?.latest ? new Date(latestResult.rows[0].latest as string) : undefined,
    };
  }
  
  /**
   * Seed initial harm categories from HarmBench taxonomy
   */
  async seedHarmCategories(): Promise<number> {
    const categories = [
      { code: 'chem_bio', name: 'Chemical & Biological Weapons', severity: 10, description: 'Instructions for creating chemical or biological weapons' },
      { code: 'cybercrime', name: 'Cybercrime & Hacking', severity: 9, description: 'Malware creation, hacking instructions, unauthorized access' },
      { code: 'harassment', name: 'Harassment & Bullying', severity: 7, description: 'Targeted harassment, doxxing, intimidation' },
      { code: 'illegal_activity', name: 'Illegal Activities', severity: 9, description: 'Drug manufacturing, weapons trafficking, human trafficking' },
      { code: 'misinformation', name: 'Misinformation & Disinformation', severity: 8, description: 'Fake news generation, propaganda, election interference' },
      { code: 'physical_harm', name: 'Physical Harm', severity: 9, description: 'Violence, self-harm, instructions for causing injury' },
      { code: 'fraud', name: 'Fraud & Deception', severity: 8, description: 'Scams, phishing, identity theft' },
      { code: 'copyright', name: 'Copyright Violation', severity: 5, description: 'Reproducing copyrighted content without permission' },
      { code: 'privacy', name: 'Privacy Violation', severity: 7, description: 'PII extraction, stalking, surveillance' },
      { code: 'sexual_content', name: 'Sexual Content', severity: 10, description: 'Explicit sexual content, CSAM references' },
      { code: 'hate_speech', name: 'Hate Speech', severity: 8, description: 'Discrimination, slurs, extremist content' },
      { code: 'self_harm', name: 'Self-Harm', severity: 10, description: 'Suicide instructions, eating disorders, self-injury' },
    ];
    
    let inserted = 0;
    
    for (const cat of categories) {
      try {
        await executeStatement(
          `INSERT INTO harm_categories (category_code, category_name, description, severity_level)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (category_code) DO NOTHING`,
          [
            stringParam('code', cat.code),
            stringParam('name', cat.name),
            stringParam('description', cat.description),
            longParam('severity', cat.severity),
          ]
        );
        inserted++;
      } catch (error) {
        logger.error('Failed to seed harm category', { category: cat.code, error });
      }
    }
    
    return inserted;
  }
  
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  
  private categoryToSeverity(category: string): number {
    const severityMap: Record<string, number> = {
      chem_bio: 10,
      sexual_content: 10,
      self_harm: 10,
      cybercrime: 9,
      illegal_activity: 9,
      physical_harm: 9,
      fraud: 8,
      misinformation: 8,
      hate_speech: 8,
      harassment: 7,
      privacy: 7,
      copyright: 5,
    };
    return severityMap[category] || 7;
  }
  
  private mapWildJailbreakTactic(tactic: string): string {
    const lower = tactic.toLowerCase();
    
    for (const [key, value] of Object.entries(WILDJAILBREAK_TACTIC_MAP)) {
      if (lower.includes(key)) return value;
    }
    
    // Default mappings based on common patterns
    if (lower.includes('role') || lower.includes('persona') || lower.includes('character')) return 'roleplay';
    if (lower.includes('encode') || lower.includes('base64') || lower.includes('rot')) return 'encoding';
    if (lower.includes('ignore') || lower.includes('instruction') || lower.includes('override')) return 'instruction_override';
    if (lower.includes('hypothetical') || lower.includes('imagine') || lower.includes('fiction')) return 'hypothetical';
    if (lower.includes('gradual') || lower.includes('step')) return 'gradual';
    if (lower.includes('translat') || lower.includes('language')) return 'translation';
    
    return 'dan'; // Default to DAN-style
  }
}

export const datasetImporterService = new DatasetImporterService();
