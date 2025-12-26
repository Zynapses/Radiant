import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeStatement } from '../db/client';

type StepType = 'decompose' | 'reason' | 'execute' | 'verify' | 'synthesize';

interface ReasoningProblem {
  tenantId: string;
  userId: string;
  problem: string;
  domain?: string;
  maxSteps?: number;
  tools?: string[];
}

interface ReasoningStep {
  stepNumber: number;
  type: StepType;
  description: string;
  reasoning: string;
  result: string;
  confidence: number;
  tokensUsed: number;
}

interface ReasoningResult {
  sessionId: string;
  solution: string;
  steps: ReasoningStep[];
  confidence: number;
  totalTokens: number;
  totalCost: number;
}

export class ReasoningEngine {
  private bedrock: BedrockRuntimeClient;

  constructor() {
    this.bedrock = new BedrockRuntimeClient({});
  }

  async solve(problem: ReasoningProblem): Promise<ReasoningResult> {
    const sessionResult = await executeStatement(
      `INSERT INTO thinktank_sessions (tenant_id, user_id, problem_summary, domain)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: problem.tenantId } },
        { name: 'userId', value: { stringValue: problem.userId } },
        { name: 'problemSummary', value: { stringValue: problem.problem.substring(0, 500) } },
        { name: 'domain', value: problem.domain ? { stringValue: problem.domain } : { isNull: true } },
      ]
    );

    const sessionId = String((sessionResult.rows[0] as Record<string, unknown>)?.id || '');
    const steps: ReasoningStep[] = [];
    let totalTokens = 0;

    // Step 1: Decompose problem
    const decomposition = await this.decomposeProblem(problem.problem);
    const decomposeStep = await this.recordStep(sessionId, 1, 'decompose', decomposition);
    steps.push(decomposeStep);
    totalTokens += decomposition.tokens;

    // Steps 2-N: Solve each sub-problem
    const maxSteps = problem.maxSteps || 10;
    for (let i = 0; i < decomposition.subProblems.length && i < maxSteps - 2; i++) {
      const subProblem = decomposition.subProblems[i];

      // Reason about approach
      const reasoning = await this.reason(subProblem, steps);
      const reasonStep = await this.recordStep(sessionId, steps.length + 1, 'reason', reasoning);
      steps.push(reasonStep);
      totalTokens += reasoning.tokens;

      // Execute solution
      const execution = await this.execute(subProblem, reasoning.approach, problem.tools);
      const execStep = await this.recordStep(sessionId, steps.length + 1, 'execute', execution);
      steps.push(execStep);
      totalTokens += execution.tokens;
    }

    // Final step: Synthesize solution
    const synthesis = await this.synthesize(problem.problem, steps);
    const synthStep = await this.recordStep(sessionId, steps.length + 1, 'synthesize', synthesis);
    steps.push(synthStep);
    totalTokens += synthesis.tokens;

    // Calculate metrics
    const totalCost = totalTokens * 0.00001;
    const avgConfidence = steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;

    await executeStatement(
      `UPDATE thinktank_sessions
       SET total_steps = $2, avg_confidence = $3, solution_found = true,
           total_tokens = $4, total_cost = $5, completed_at = NOW()
       WHERE id = $1`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'totalSteps', value: { longValue: steps.length } },
        { name: 'avgConfidence', value: { doubleValue: avgConfidence } },
        { name: 'totalTokens', value: { longValue: totalTokens } },
        { name: 'totalCost', value: { doubleValue: totalCost } },
      ]
    );

    return {
      sessionId,
      solution: synthesis.result,
      steps,
      confidence: avgConfidence,
      totalTokens,
      totalCost,
    };
  }

  async getSession(sessionId: string): Promise<unknown> {
    const result = await executeStatement(
      `SELECT * FROM thinktank_sessions WHERE id = $1`,
      [{ name: 'sessionId', value: { stringValue: sessionId } }]
    );
    return result.rows[0];
  }

  async getSessionSteps(sessionId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM thinktank_steps WHERE session_id = $1 ORDER BY step_number`,
      [{ name: 'sessionId', value: { stringValue: sessionId } }]
    );
    return result.rows;
  }

  private async decomposeProblem(problem: string): Promise<{
    subProblems: string[];
    complexity: string;
    tokens: number;
    description: string;
    reasoning: string;
    result: string;
    confidence: number;
  }> {
    const response = await this.invokeModel(
      `Decompose this problem into smaller sub-problems:

Problem: ${problem}

Return JSON: { "subProblems": ["sub1", "sub2", ...], "complexity": "low|medium|high" }`
    );

    const subProblems = (response.subProblems as string[] | undefined) || [problem];
    return {
      subProblems,
      complexity: (response.complexity as string) || 'medium',
      tokens: (response.tokens as number) || 500,
      description: 'Problem decomposition',
      reasoning: `Identified ${subProblems.length} sub-problems`,
      result: JSON.stringify(subProblems),
      confidence: 0.9,
    };
  }

  private async reason(
    subProblem: string,
    previousSteps: ReasoningStep[]
  ): Promise<{
    approach: string;
    tokens: number;
    description: string;
    reasoning: string;
    result: string;
    confidence: number;
  }> {
    const context = previousSteps.map((s) => s.result).join('\n');

    const response = await this.invokeModel(
      `Given context:
${context}

Reason about how to solve: ${subProblem}

Return JSON: { "approach": "description", "confidence": 0.0-1.0 }`
    );

    const approach = (response.approach as string) || 'Direct approach';
    return {
      approach,
      tokens: (response.tokens as number) || 300,
      description: `Reasoning about: ${subProblem.substring(0, 50)}`,
      reasoning: approach,
      result: approach,
      confidence: (response.confidence as number) || 0.8,
    };
  }

  private async execute(
    subProblem: string,
    approach: string,
    tools?: string[]
  ): Promise<{
    tokens: number;
    description: string;
    reasoning: string;
    result: string;
    confidence: number;
  }> {
    const response = await this.invokeModel(
      `Execute this approach to solve the sub-problem:

Sub-problem: ${subProblem}
Approach: ${approach}
Available tools: ${tools?.join(', ') || 'none'}

Return JSON: { "result": "solution", "confidence": 0.0-1.0 }`
    );

    return {
      tokens: (response.tokens as number) || 400,
      description: 'Executing solution',
      reasoning: approach,
      result: (response.result as string) || 'Solution applied',
      confidence: (response.confidence as number) || 0.8,
    };
  }

  private async synthesize(
    originalProblem: string,
    steps: ReasoningStep[]
  ): Promise<{
    tokens: number;
    description: string;
    reasoning: string;
    result: string;
    confidence: number;
  }> {
    const stepResults = steps.map((s) => s.result).join('\n');

    const response = await this.invokeModel(
      `Synthesize a final solution from these steps:

Original problem: ${originalProblem}

Step results:
${stepResults}

Return JSON: { "solution": "complete solution", "confidence": 0.0-1.0 }`
    );

    return {
      tokens: (response.tokens as number) || 500,
      description: 'Synthesizing final solution',
      reasoning: 'Combining all step results',
      result: (response.solution as string) || 'Solution synthesized',
      confidence: (response.confidence as number) || 0.85,
    };
  }

  private async recordStep(
    sessionId: string,
    stepNumber: number,
    stepType: StepType,
    data: { description: string; reasoning: string; result: string; confidence: number; tokens: number }
  ): Promise<ReasoningStep> {
    await executeStatement(
      `INSERT INTO thinktank_steps 
       (session_id, step_number, step_type, description, reasoning, result, confidence, tokens_used)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'stepNumber', value: { longValue: stepNumber } },
        { name: 'stepType', value: { stringValue: stepType } },
        { name: 'description', value: { stringValue: data.description } },
        { name: 'reasoning', value: { stringValue: data.reasoning } },
        { name: 'result', value: { stringValue: data.result } },
        { name: 'confidence', value: { doubleValue: data.confidence } },
        { name: 'tokensUsed', value: { longValue: data.tokens } },
      ]
    );

    return {
      stepNumber,
      type: stepType,
      description: data.description,
      reasoning: data.reasoning,
      result: data.result,
      confidence: data.confidence,
      tokensUsed: data.tokens,
    };
  }

  private async invokeModel(prompt: string): Promise<Record<string, unknown> & { tokens: number }> {
    try {
      const response = await this.bedrock.send(
        new InvokeModelCommand({
          modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
          body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }],
          }),
          contentType: 'application/json',
        })
      );

      const result = JSON.parse(new TextDecoder().decode(response.body));
      const text = result.content?.[0]?.text || '{}';
      const tokens = result.usage?.input_tokens + result.usage?.output_tokens || 500;

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return { ...JSON.parse(jsonMatch[0]), tokens };
        }
      } catch (error) {
        // JSON extraction failed, continue to fallback
      }

      return { result: text, tokens };
    } catch (error) {
      console.error('Model invocation error:', error);
      return { error: 'Model invocation failed', tokens: 0 };
    }
  }
}

export const reasoningEngine = new ReasoningEngine();
