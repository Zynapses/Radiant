// RADIANT v4.18.0 - Library Registry Update Service
// EventBridge scheduled Lambda for daily library updates
// Runs at configurable time (default: 03:00 UTC daily)

import { libraryRegistryService } from '../shared/services/library-registry.service';
import { executeStatement } from '../shared/db/client';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// Seed data will be loaded dynamically
// Located at: config/library-registry/seed-libraries.json

export interface UpdateJobResult {
  jobId: string;
  status: 'completed' | 'failed';
  librariesChecked: number;
  librariesUpdated: number;
  newLibrariesAdded: number;
  errors: string[];
  durationMs: number;
}

interface LibrarySeedData {
  id: string;
  name: string;
  category: string;
  license: string;
  license_note?: string;
  repo: string;
  description: string;
  beats: string[];
  stars: number;
  languages: string[];
  domains: string[];
  proficiencies: {
    reasoning_depth: number;
    mathematical_quantitative: number;
    code_generation: number;
    creative_generative: number;
    research_synthesis: number;
    factual_recall_precision: number;
    multi_step_problem_solving: number;
    domain_terminology_handling: number;
  };
}

// ============================================================================
// Update Handler
// ============================================================================

export const handler = async (event: unknown): Promise<UpdateJobResult> => {
  const startTime = Date.now();
  logger.info('Library registry update started', { event });

  const jobId = crypto.randomUUID();
  const errors: string[] = [];
  let librariesChecked = 0;
  let librariesUpdated = 0;
  let newLibrariesAdded = 0;

  try {
    // Create job record
    await executeStatement(
      `INSERT INTO library_update_jobs (job_id, status, job_type, started_at)
       VALUES ($1, 'running', 'scheduled', NOW())`,
      [{ name: 'jobId', value: { stringValue: jobId } }]
    );

    // Load seed data from S3 or bundled file
    const libraries = await loadSeedData();

    librariesChecked = libraries.length;

    // Seed/update libraries
    const result = await libraryRegistryService.seedLibraries(libraries);
    librariesUpdated = result.updated;
    newLibrariesAdded = result.added;

    // Update all tenant configs with next update time
    await updateNextUpdateTimes();

    // Update job record with success
    await executeStatement(
      `UPDATE library_update_jobs 
       SET status = 'completed', completed_at = NOW(),
           libraries_checked = $2, libraries_updated = $3, 
           new_libraries_added = $4, errors = $5
       WHERE job_id = $1`,
      [
        { name: 'jobId', value: { stringValue: jobId } },
        { name: 'librariesChecked', value: { longValue: librariesChecked } },
        { name: 'librariesUpdated', value: { longValue: librariesUpdated } },
        { name: 'newLibrariesAdded', value: { longValue: newLibrariesAdded } },
        { name: 'errors', value: { stringValue: JSON.stringify(errors) } },
      ]
    );

    const durationMs = Date.now() - startTime;
    logger.info('Library registry update completed', {
      jobId,
      librariesChecked,
      librariesUpdated,
      newLibrariesAdded,
      durationMs,
    });

    return {
      jobId,
      status: 'completed',
      librariesChecked,
      librariesUpdated,
      newLibrariesAdded,
      errors,
      durationMs,
    } as UpdateJobResult;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMessage);
    logger.error('Library registry update failed', { error, jobId });

    // Update job record with failure
    await executeStatement(
      `UPDATE library_update_jobs 
       SET status = 'failed', completed_at = NOW(),
           libraries_checked = $2, errors = $3
       WHERE job_id = $1`,
      [
        { name: 'jobId', value: { stringValue: jobId } },
        { name: 'librariesChecked', value: { longValue: librariesChecked } },
        { name: 'errors', value: { stringValue: JSON.stringify(errors) } },
      ]
    );

    return {
      jobId,
      status: 'failed',
      librariesChecked,
      librariesUpdated: 0,
      newLibrariesAdded: 0,
      errors,
      durationMs: Date.now() - startTime,
    } as UpdateJobResult;
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

async function updateNextUpdateTimes(): Promise<void> {
  // Calculate next update time for each tenant based on their frequency
  await executeStatement(
    `UPDATE library_registry_config 
     SET last_update_at = NOW(),
         next_update_at = CASE update_frequency
           WHEN 'hourly' THEN NOW() + INTERVAL '1 hour'
           WHEN 'daily' THEN NOW() + INTERVAL '1 day'
           WHEN 'weekly' THEN NOW() + INTERVAL '1 week'
           ELSE NULL
         END
     WHERE auto_update_enabled = true`,
    []
  );
}

// ============================================================================
// Load Seed Data
// ============================================================================

async function loadSeedData(): Promise<LibrarySeedData[]> {
  // In production, this would load from S3 or bundled asset
  // For now, we'll use the bundled seed data
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const seedData = require('../../config/library-registry/seed-libraries.json');
    return seedData.tools as LibrarySeedData[];
  } catch {
    logger.warn('Could not load seed data from file, using empty array');
    return [];
  }
}

// ============================================================================
// Manual Trigger Handler (for admin API)
// ============================================================================

export async function triggerManualUpdate(): Promise<UpdateJobResult> {
  return handler({ source: 'manual' });
}

// ============================================================================
// Seed on First Install Handler (CDK Custom Resource compatible)
// ============================================================================

interface CloudFormationCustomResourceEvent {
  RequestType: 'Create' | 'Update' | 'Delete';
  ServiceToken: string;
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  ResourceType: string;
  LogicalResourceId: string;
  ResourceProperties: Record<string, unknown>;
  OldResourceProperties?: Record<string, unknown>;
}

interface CustomResourceResponse {
  Status: 'SUCCESS' | 'FAILED';
  PhysicalResourceId: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
  Data?: Record<string, unknown>;
  Reason?: string;
}

export const seedOnInstall = async (
  event: CloudFormationCustomResourceEvent
): Promise<CustomResourceResponse> => {
  logger.info('Library seed Custom Resource triggered', { 
    requestType: event.RequestType,
    resourceProperties: event.ResourceProperties,
  });

  const baseResponse: CustomResourceResponse = {
    Status: 'SUCCESS',
    PhysicalResourceId: 'radiant-library-seed',
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  };

  // On Delete, just return success (nothing to clean up)
  if (event.RequestType === 'Delete') {
    logger.info('Delete request, nothing to do');
    return baseResponse;
  }

  try {
    // Check if any libraries exist
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM open_source_libraries`,
      []
    );

    const count = Number((result.rows[0] as Record<string, unknown>)?.count) || 0;

    if (count === 0) {
      logger.info('No libraries found, running initial seed');
      const updateResult = await handler({ source: 'install' });
      
      return {
        ...baseResponse,
        Data: {
          message: `Seeded ${updateResult.newLibrariesAdded} libraries`,
          librariesAdded: updateResult.newLibrariesAdded,
          jobId: updateResult.jobId,
        },
      };
    }

    logger.info('Libraries already exist, skipping seed', { count });
    return {
      ...baseResponse,
      Data: {
        message: `Skipped seed, ${count} libraries already exist`,
        existingCount: count,
        skipped: true,
      },
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Library seed failed', { error });
    
    return {
      ...baseResponse,
      Status: 'FAILED',
      Reason: errorMessage,
    };
  }
};
