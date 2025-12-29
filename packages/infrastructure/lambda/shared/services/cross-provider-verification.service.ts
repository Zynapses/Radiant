// Cross-Provider Verification Service
// Adversarial verification using different AI providers to catch errors

import { executeStatement, stringParam } from '../db/client';
import type {
  VerificationSession,
  VerificationIssue,
  VerificationStatus,
  AdversaryPersona,
  IssueType,
  IssueSeverity,
  VerificationConfig,
  ADVERSARY_PROVIDER_MAP,
} from '@radiant/shared';

const DEFAULT_CONFIG: VerificationConfig = {
  enabled: false,
  modes: ['coding', 'research', 'analysis'],
  maxRegenerations: 2,
  severityThreshold: 'high',
  providerDiversityRequired: true,
};

// Adversary persona prompts
const ADVERSARY_PROMPTS: Record<AdversaryPersona, string> = {
  security_auditor: `You are a Senior Security Auditor with 20 years of experience. Your job is to find security vulnerabilities, unsafe practices, and potential exploits in the following content.

Be thorough and hostile - assume the worst. Look for:
- SQL injection, XSS, CSRF vulnerabilities
- Hardcoded secrets or credentials
- Unsafe deserialization
- Path traversal risks
- Authentication/authorization flaws
- Data exposure risks

If you find NO issues, respond with exactly: PASS
If you find issues, list each one in this format:
ISSUE: [type] | [severity: critical/high/medium/low] | [description] | [location in text]`,

  fact_checker: `You are a professional Fact Checker and Research Analyst. Your job is to identify factual errors, unsupported claims, and potential hallucinations in the following content.

Be skeptical and rigorous. Look for:
- Incorrect dates, numbers, or statistics
- Misattributed quotes
- Claims without evidence
- Logical contradictions
- Outdated information presented as current
- Fabricated entities (fake companies, people, studies)

If you find NO issues, respond with exactly: PASS
If you find issues, list each one in this format:
ISSUE: [type] | [severity: critical/high/medium/low] | [description] | [location in text]`,

  logic_analyzer: `You are a Logic and Reasoning Expert. Your job is to find logical fallacies, flawed reasoning, and gaps in arguments in the following content.

Be analytical and precise. Look for:
- Non sequiturs
- Circular reasoning
- False dichotomies
- Hasty generalizations
- Appeal to authority without evidence
- Missing steps in explanations
- Contradictory statements

If you find NO issues, respond with exactly: PASS
If you find issues, list each one in this format:
ISSUE: [type] | [severity: critical/high/medium/low] | [description] | [location in text]`,

  code_reviewer: `You are a Principal Software Engineer conducting a code review. Your job is to find bugs, bad practices, and potential runtime errors in the following code.

Be thorough and critical. Look for:
- Syntax errors
- Logic bugs
- Unhandled edge cases
- Memory leaks
- Race conditions
- Missing error handling
- Type mismatches
- Inefficient algorithms
- Missing null checks

If you find NO issues, respond with exactly: PASS
If you find issues, list each one in this format:
ISSUE: [type] | [severity: critical/high/medium/low] | [description] | [location in text]`,
};

class CrossProviderVerificationService {
  private config: VerificationConfig = DEFAULT_CONFIG;

  /**
   * Select an adversary model from a different provider
   */
  selectAdversaryModel(
    generatorProvider: string,
    availableModels: { modelId: string; provider: string }[]
  ): { modelId: string; provider: string } | null {
    // Get allowed adversary providers
    const allowedProviders = (ADVERSARY_PROVIDER_MAP as Record<string, string[]>)[generatorProvider] || ['anthropic', 'openai'];
    
    // Filter models to different providers
    const candidates = availableModels.filter(m => 
      allowedProviders.includes(m.provider) && m.provider !== generatorProvider
    );

    if (candidates.length === 0) {
      // Fall back to any different provider if strict list not available
      const fallback = availableModels.find(m => m.provider !== generatorProvider);
      return fallback || null;
    }

    // Prefer high-capability models for verification
    const preferred = ['claude-3-5-sonnet', 'gpt-4o', 'gemini-1.5-pro'];
    for (const pref of preferred) {
      const match = candidates.find(m => m.modelId.includes(pref));
      if (match) return match;
    }

    return candidates[0];
  }

  /**
   * Create a verification session
   */
  async createSession(
    tenantId: string,
    userId: string,
    generatorModel: string,
    generatorProvider: string,
    generatorResponse: string,
    adversaryModel: string,
    adversaryProvider: string,
    persona: AdversaryPersona,
    planId?: string
  ): Promise<VerificationSession> {
    const result = await executeStatement({
      sql: `
        INSERT INTO verification_sessions (
          tenant_id, user_id, plan_id,
          generator_model, generator_provider, generator_response,
          adversary_model, adversary_provider, adversary_persona,
          verification_status, max_regenerations
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid,
          $4, $5, $6,
          $7, $8, $9,
          'pending', $10
        )
        RETURNING *
      `,
      parameters: [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('planId', planId || ''),
        stringParam('generatorModel', generatorModel),
        stringParam('generatorProvider', generatorProvider),
        stringParam('generatorResponse', generatorResponse),
        stringParam('adversaryModel', adversaryModel),
        stringParam('adversaryProvider', adversaryProvider),
        stringParam('persona', persona),
        stringParam('maxRegen', String(this.config.maxRegenerations)),
      ],
    });

    return this.mapSessionRow(result.rows?.[0]);
  }

  /**
   * Get the adversary prompt for verification
   */
  getAdversaryPrompt(persona: AdversaryPersona, contentToVerify: string): string {
    const systemPrompt = ADVERSARY_PROMPTS[persona];
    return `${systemPrompt}

--- CONTENT TO VERIFY ---
${contentToVerify}
--- END CONTENT ---

Analyze the above content and provide your assessment.`;
  }

  /**
   * Parse adversary response into issues
   */
  parseAdversaryResponse(response: string): VerificationIssue[] {
    const issues: VerificationIssue[] = [];
    
    // Check for PASS
    if (response.trim().toUpperCase() === 'PASS') {
      return [];
    }

    // Parse ISSUE lines
    const issuePattern = /ISSUE:\s*\[([^\]]+)\]\s*\|\s*\[([^\]]+)\]\s*\|\s*\[([^\]]+)\]\s*\|\s*\[([^\]]*)\]/gi;
    let match;

    while ((match = issuePattern.exec(response)) !== null) {
      const [, type, severity, description, location] = match;
      
      issues.push({
        id: crypto.randomUUID(),
        sessionId: '', // Will be set when recording
        issueType: this.normalizeIssueType(type),
        severity: this.normalizeSeverity(severity),
        description: description.trim(),
        locationInResponse: location.trim() || undefined,
        resolved: false,
        createdAt: new Date(),
      });
    }

    // If no structured issues found but response isn't PASS, create a generic issue
    if (issues.length === 0 && response.length > 10) {
      issues.push({
        id: crypto.randomUUID(),
        sessionId: '',
        issueType: 'logic_gap',
        severity: 'medium',
        description: response.slice(0, 500),
        resolved: false,
        createdAt: new Date(),
      });
    }

    return issues;
  }

  private normalizeIssueType(type: string): IssueType {
    const normalized = type.toLowerCase().trim();
    const typeMap: Record<string, IssueType> = {
      hallucination: 'hallucination',
      'factual error': 'factual_error',
      'factual_error': 'factual_error',
      'logic gap': 'logic_gap',
      'logic_gap': 'logic_gap',
      security: 'security_vuln',
      'security vulnerability': 'security_vuln',
      'security_vuln': 'security_vuln',
      bias: 'bias',
      bug: 'code_bug',
      'code bug': 'code_bug',
      'code_bug': 'code_bug',
    };
    return typeMap[normalized] || 'logic_gap';
  }

  private normalizeSeverity(severity: string): IssueSeverity {
    const normalized = severity.toLowerCase().trim();
    if (normalized.includes('critical')) return 'critical';
    if (normalized.includes('high')) return 'high';
    if (normalized.includes('medium')) return 'medium';
    return 'low';
  }

  /**
   * Record verification issues
   */
  async recordIssues(
    sessionId: string,
    issues: VerificationIssue[]
  ): Promise<void> {
    for (const issue of issues) {
      await executeStatement({
        sql: `
          INSERT INTO verification_issues (
            session_id, issue_type, severity, description, location_in_response
          ) VALUES (
            $1::uuid, $2, $3, $4, $5
          )
        `,
        parameters: [
          stringParam('sessionId', sessionId),
          stringParam('issueType', issue.issueType),
          stringParam('severity', issue.severity),
          stringParam('description', issue.description),
          stringParam('location', issue.locationInResponse || ''),
        ],
      });
    }

    // Update session
    const status: VerificationStatus = issues.length > 0 ? 'issues_found' : 'pass';
    await this.updateSessionStatus(sessionId, status, issues.length);
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: VerificationStatus,
    issueCount?: number
  ): Promise<void> {
    let sql = `
      UPDATE verification_sessions
      SET verification_status = $1,
          adversary_completed_at = NOW()
    `;
    const params = [stringParam('status', status)];

    if (issueCount !== undefined) {
      sql += `, issue_count = $2`;
      params.push(stringParam('issueCount', String(issueCount)));
    }

    if (status === 'pass' || status === 'issues_found') {
      sql += `, completed_at = NOW()`;
    }

    sql += ` WHERE id = $${params.length + 1}::uuid`;
    params.push(stringParam('sessionId', sessionId));

    await executeStatement({ sql, parameters: params });
  }

  /**
   * Record a regeneration attempt
   */
  async recordRegeneration(
    sessionId: string,
    newResponse: string
  ): Promise<{ canContinue: boolean; regenerationCount: number }> {
    const result = await executeStatement({
      sql: `
        UPDATE verification_sessions
        SET regeneration_count = regeneration_count + 1,
            generator_response = $1,
            verification_status = 'regenerating'
        WHERE id = $2::uuid
        RETURNING regeneration_count, max_regenerations
      `,
      parameters: [
        stringParam('newResponse', newResponse),
        stringParam('sessionId', sessionId),
      ],
    });

    const row = result.rows?.[0];
    const regenerationCount = row?.regeneration_count || 0;
    const maxRegenerations = row?.max_regenerations || this.config.maxRegenerations;

    return {
      canContinue: regenerationCount < maxRegenerations,
      regenerationCount,
    };
  }

  /**
   * Record final verified response
   */
  async recordFinalResponse(
    sessionId: string,
    finalResponse: string
  ): Promise<void> {
    await executeStatement({
      sql: `
        UPDATE verification_sessions
        SET final_response = $1,
            verification_status = 'pass',
            completed_at = NOW()
        WHERE id = $2::uuid
      `,
      parameters: [
        stringParam('finalResponse', finalResponse),
        stringParam('sessionId', sessionId),
      ],
    });
  }

  /**
   * Get regeneration prompt for fixing issues
   */
  getRegenerationPrompt(
    originalPrompt: string,
    previousResponse: string,
    issues: VerificationIssue[]
  ): string {
    const issueList = issues.map((issue, i) => 
      `${i + 1}. [${issue.severity.toUpperCase()}] ${issue.issueType}: ${issue.description}`
    ).join('\n');

    return `Your previous response had the following issues identified by a verification system:

${issueList}

Please regenerate your response to the original prompt, addressing ALL of these issues:

Original prompt: ${originalPrompt}

Your corrected response:`;
  }

  /**
   * Check if verification should be triggered for a mode
   */
  shouldVerify(orchestrationMode: string): boolean {
    if (!this.config.enabled) return false;
    return this.config.modes.includes(orchestrationMode);
  }

  /**
   * Check if issues are severe enough to trigger regeneration
   */
  shouldRegenerate(issues: VerificationIssue[]): boolean {
    const severityOrder: IssueSeverity[] = ['critical', 'high', 'medium', 'low'];
    const thresholdIndex = severityOrder.indexOf(this.config.severityThreshold);
    
    return issues.some(issue => {
      const issueIndex = severityOrder.indexOf(issue.severity);
      return issueIndex <= thresholdIndex;
    });
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<{
    session: VerificationSession;
    issues: VerificationIssue[];
  } | null> {
    const sessionResult = await executeStatement({
      sql: `SELECT * FROM verification_sessions WHERE id = $1::uuid`,
      parameters: [stringParam('sessionId', sessionId)],
    });

    if (!sessionResult.rows?.length) return null;

    const issuesResult = await executeStatement({
      sql: `SELECT * FROM verification_issues WHERE session_id = $1::uuid`,
      parameters: [stringParam('sessionId', sessionId)],
    });

    return {
      session: this.mapSessionRow(sessionResult.rows[0]),
      issues: (issuesResult.rows || []).map(r => this.mapIssueRow(r)),
    };
  }

  private mapSessionRow(row: Record<string, unknown>): VerificationSession {
    return {
      id: row?.id as string,
      tenantId: row?.tenant_id as string,
      userId: row?.user_id as string,
      planId: row?.plan_id as string,
      generatorModel: row?.generator_model as string,
      generatorProvider: row?.generator_provider as string,
      generatorResponse: row?.generator_response as string,
      adversaryModel: row?.adversary_model as string,
      adversaryProvider: row?.adversary_provider as string,
      adversaryPersona: (row?.adversary_persona || 'security_auditor') as AdversaryPersona,
      verificationStatus: (row?.verification_status || 'pending') as VerificationStatus,
      issuesFound: [],
      issueCount: row?.issue_count as number || 0,
      regenerationCount: row?.regeneration_count as number || 0,
      maxRegenerations: row?.max_regenerations as number || 2,
      finalResponse: row?.final_response as string,
      startedAt: new Date(row?.started_at as string),
      adversaryCompletedAt: row?.adversary_completed_at ? new Date(row.adversary_completed_at as string) : undefined,
      completedAt: row?.completed_at ? new Date(row.completed_at as string) : undefined,
      totalTokens: row?.total_tokens as number || 0,
      createdAt: new Date(row?.created_at as string),
    };
  }

  private mapIssueRow(row: Record<string, unknown>): VerificationIssue {
    return {
      id: row?.id as string,
      sessionId: row?.session_id as string,
      issueType: row?.issue_type as IssueType,
      severity: row?.severity as IssueSeverity,
      description: row?.description as string,
      locationInResponse: row?.location_in_response as string,
      resolved: row?.resolved as boolean || false,
      resolutionMethod: row?.resolution_method as VerificationIssue['resolutionMethod'],
      createdAt: new Date(row?.created_at as string),
    };
  }

  setConfig(config: Partial<VerificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): VerificationConfig {
    return { ...this.config };
  }
}

export const crossProviderVerificationService = new CrossProviderVerificationService();
