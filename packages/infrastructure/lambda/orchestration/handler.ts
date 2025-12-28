import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { neuralOrchestrationService, domainTaxonomyService } from '../shared/services';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';
import { ValidationError } from '../shared/errors';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    const path = event.path;
    const method = event.httpMethod;

    // POST /orchestration/match-patterns - Find matching patterns
    if (method === 'POST' && path.endsWith('/match-patterns')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.query) {
        throw new ValidationError('query is required');
      }

      const patterns = await neuralOrchestrationService.findMatchingPatterns(
        body.query,
        body.limit || 5,
        body.minSimilarity || 0.7
      );

      return success({ patterns });
    }

    // POST /orchestration/match-workflows - Find matching workflows
    if (method === 'POST' && path.endsWith('/match-workflows')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.query) {
        throw new ValidationError('query is required');
      }

      const workflows = await neuralOrchestrationService.findMatchingWorkflows(
        body.query,
        body.limit || 5,
        body.minSimilarity || 0.7
      );

      return success({ workflows });
    }

    // POST /orchestration/select - Select best orchestration
    if (method === 'POST' && path.endsWith('/select')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.query || !body.taskType) {
        throw new ValidationError('query and taskType are required');
      }

      const selection = await neuralOrchestrationService.selectOrchestration(
        user.tenantId,
        user.userId,
        body.query,
        body.taskType,
        body.constraints
      );

      return success(selection);
    }

    // GET /orchestration/user-model - Get user neural model
    if (method === 'GET' && path.endsWith('/user-model')) {
      const model = await neuralOrchestrationService.getOrCreateUserNeuralModel(
        user.tenantId,
        user.userId
      );

      return success(model);
    }

    // POST /orchestration/user-preferences - Update user preferences
    if (method === 'POST' && path.endsWith('/user-preferences')) {
      const body = JSON.parse(event.body || '{}');

      await neuralOrchestrationService.updateUserPreferences(
        user.tenantId,
        user.userId,
        {
          modelId: body.modelId,
          modelScore: body.modelScore,
          patternId: body.patternId,
          workflowId: body.workflowId,
        }
      );

      return success({ updated: true });
    }

    // GET /orchestration/pattern-categories - Get pattern categories
    if (method === 'GET' && path.endsWith('/pattern-categories')) {
      const categories = await neuralOrchestrationService.getPatternCategories();
      return success({ categories });
    }

    // GET /orchestration/workflow-categories - Get workflow categories
    if (method === 'GET' && path.endsWith('/workflow-categories')) {
      const categories = await neuralOrchestrationService.getWorkflowCategories();
      return success({ categories });
    }

    // GET /orchestration/patterns/:categoryId - Get patterns by category
    if (method === 'GET' && path.includes('/patterns/')) {
      const categoryId = path.split('/patterns/')[1];
      const patterns = await neuralOrchestrationService.getPatternsByCategory(categoryId);
      return success({ patterns });
    }

    // GET /orchestration/workflows/:categoryId - Get workflows by category
    if (method === 'GET' && path.includes('/workflows/')) {
      const categoryId = path.split('/workflows/')[1];
      const workflows = await neuralOrchestrationService.getWorkflowsByCategory(categoryId);
      return success({ workflows });
    }

    // POST /orchestration/record-pattern-usage - Record pattern usage
    if (method === 'POST' && path.endsWith('/record-pattern-usage')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.patternId) {
        throw new ValidationError('patternId is required');
      }

      await neuralOrchestrationService.recordPatternUsage(body.patternId, body.satisfactionScore);
      return success({ recorded: true });
    }

    // POST /orchestration/record-workflow-usage - Record workflow usage
    if (method === 'POST' && path.endsWith('/record-workflow-usage')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.workflowId) {
        throw new ValidationError('workflowId is required');
      }

      await neuralOrchestrationService.recordWorkflowUsage(body.workflowId, body.qualityScore);
      return success({ recorded: true });
    }

    // POST /orchestration/domain-aware-select - Domain-aware orchestration selection
    if (method === 'POST' && path.endsWith('/domain-aware-select')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.query) {
        throw new ValidationError('query is required');
      }

      // Step 1: Detect domain from prompt
      const domainResult = await domainTaxonomyService.detectDomain(body.query, {
        include_subspecialties: true,
        min_confidence: body.minDomainConfidence || 0.3,
        manual_override: body.domainOverride,
      });

      // Step 2: Get matching models based on domain proficiencies
      const matchingModels = await domainTaxonomyService.getMatchingModels(
        domainResult.merged_proficiencies,
        {
          max_models: body.maxModels || 5,
          min_match_score: body.minMatchScore || 50,
          include_self_hosted: body.includeSelfHosted ?? true,
        }
      );

      // Step 3: Find matching patterns/workflows
      const [patterns, workflows] = await Promise.all([
        neuralOrchestrationService.findMatchingPatterns(body.query, 3, 0.5),
        neuralOrchestrationService.findMatchingWorkflows(body.query, 3, 0.5),
      ]);

      // Step 4: Determine recommended mode based on proficiencies
      const proficiencies = domainResult.merged_proficiencies;
      let recommendedMode = 'thinking';
      if (proficiencies.reasoning_depth >= 9 && proficiencies.multi_step_problem_solving >= 9) {
        recommendedMode = 'extended_thinking';
      } else if (proficiencies.creative_generative >= 8) {
        recommendedMode = 'creative';
      } else if (proficiencies.code_generation >= 8) {
        recommendedMode = 'coding';
      } else if (proficiencies.research_synthesis >= 8) {
        recommendedMode = 'research';
      }

      const primaryModel = matchingModels.find(m => m.recommended) || matchingModels[0];

      return success({
        domain_detection: {
          primary_field: domainResult.primary_field ? {
            id: domainResult.primary_field.field_id,
            name: domainResult.primary_field.field_name,
            icon: domainResult.primary_field.field_icon,
          } : null,
          primary_domain: domainResult.primary_domain ? {
            id: domainResult.primary_domain.domain_id,
            name: domainResult.primary_domain.domain_name,
            icon: domainResult.primary_domain.domain_icon,
          } : null,
          primary_subspecialty: domainResult.primary_subspecialty ? {
            id: domainResult.primary_subspecialty.subspecialty_id,
            name: domainResult.primary_subspecialty.subspecialty_name,
          } : null,
          confidence: domainResult.detection_confidence,
          method: domainResult.detection_method,
        },
        proficiencies: domainResult.merged_proficiencies,
        model_selection: {
          primary_model: primaryModel?.model_id || 'anthropic/claude-3-5-sonnet-20241022',
          match_score: primaryModel?.match_score || 70,
          strengths: primaryModel?.strengths || [],
          weaknesses: primaryModel?.weaknesses || [],
          alternatives: matchingModels.slice(1, 4).map(m => ({
            model_id: m.model_id,
            match_score: m.match_score,
          })),
        },
        orchestration: {
          recommended_mode: recommendedMode,
          patterns: patterns.slice(0, 2),
          workflows: workflows.slice(0, 2),
        },
        processing_time_ms: domainResult.processing_time_ms,
      });
    }

    throw new ValidationError(`Unknown route: ${method} ${path}`);
  } catch (error) {
    return handleError(error);
  }
}
