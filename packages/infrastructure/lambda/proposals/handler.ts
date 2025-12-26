import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { workflowProposalService } from '../shared/services';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';
import { ValidationError } from '../shared/errors';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    const path = event.path;
    const method = event.httpMethod;

    // POST /proposals/evidence - Record evidence
    if (method === 'POST' && path.endsWith('/evidence')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.evidenceType) {
        throw new ValidationError('evidenceType is required');
      }

      const patternId = await workflowProposalService.recordEvidence(user.tenantId, {
        userId: user.userId,
        sessionId: body.sessionId,
        executionId: body.executionId,
        evidenceType: body.evidenceType,
        originalRequest: body.originalRequest,
        attemptedWorkflowId: body.attemptedWorkflowId,
        failureReason: body.failureReason,
        userFeedback: body.userFeedback,
        evidenceData: body.evidenceData,
      });

      return success({ patternId });
    }

    // GET /proposals/pending - Get pending proposals
    if (method === 'GET' && path.endsWith('/pending')) {
      const proposals = await workflowProposalService.getPendingProposals(user.tenantId);
      return success({ proposals });
    }

    // POST /proposals/:id/review - Review proposal
    if (method === 'POST' && path.includes('/review')) {
      const proposalId = path.split('/proposals/')[1].split('/review')[0];
      const body = JSON.parse(event.body || '{}');
      
      if (!body.decision) {
        throw new ValidationError('decision is required');
      }

      await workflowProposalService.reviewProposal(
        proposalId,
        user.userId,
        body.decision,
        body.notes,
        body.modifications
      );

      return success({ reviewed: true });
    }

    // GET /proposals/:id/evidence - Get evidence for pattern
    if (method === 'GET' && path.includes('/evidence')) {
      const patternId = event.queryStringParameters?.patternId;
      
      if (!patternId) {
        throw new ValidationError('patternId is required');
      }

      const evidence = await workflowProposalService.getEvidenceForPattern(patternId);
      return success({ evidence });
    }

    throw new ValidationError(`Unknown route: ${method} ${path}`);
  } catch (error) {
    return handleError(error);
  }
}
