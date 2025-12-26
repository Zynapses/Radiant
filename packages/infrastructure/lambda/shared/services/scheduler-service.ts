import { executeStatement, toSqlParams } from '../db/client';
import type { SqlParameter } from '@aws-sdk/client-rds-data';
import {
  EventBridgeClient,
  PutRuleCommand,
  PutTargetsCommand,
  DeleteRuleCommand,
  RemoveTargetsCommand,
} from '@aws-sdk/client-eventbridge';

const eventBridge = new EventBridgeClient({});
const SCHEDULER_LAMBDA_ARN = process.env.SCHEDULER_LAMBDA_ARN;

export type ScheduleType = 'once' | 'cron' | 'interval';
export type OutputDestination = 'email' | 'webhook' | 'storage';

export interface ScheduleCreate {
  name: string;
  prompt: string;
  model: string;
  type: ScheduleType;
  cronExpression?: string;
  runAt?: Date;
  intervalMinutes?: number;
  timezone?: string;
  maxRuns?: number;
  notificationEmail?: string;
  outputDestination?: OutputDestination;
}

export interface ScheduledPrompt {
  id: string;
  tenantId: string;
  userId: string;
  promptName: string;
  promptText: string;
  model: string;
  scheduleType: ScheduleType;
  cronExpression?: string;
  runAt?: Date;
  timezone: string;
  isActive: boolean;
  maxRuns?: number;
  runCount: number;
  lastRun?: Date;
  nextRun?: Date;
  notificationEmail?: string;
  outputDestination: OutputDestination;
  createdAt: Date;
}

export interface ScheduledPromptRun {
  id: string;
  promptId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
  tokensUsed?: number;
  cost?: number;
  latencyMs?: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export class SchedulerService {
  constructor() {
    // EventBridge integration handled by CDK stack
  }

  async createSchedule(tenantId: string, userId: string, schedule: ScheduleCreate): Promise<string> {
    const nextRun = this.calculateNextRun(schedule);

    const result = await executeStatement(
      `INSERT INTO scheduled_prompts (
         tenant_id, user_id, prompt_name, prompt_text, model, schedule_type,
         cron_expression, run_at, timezone, max_runs, next_run,
         notification_email, output_destination
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'promptName', value: { stringValue: schedule.name } },
        { name: 'promptText', value: { stringValue: schedule.prompt } },
        { name: 'model', value: { stringValue: schedule.model } },
        { name: 'scheduleType', value: { stringValue: schedule.type } },
        { name: 'cronExpression', value: schedule.cronExpression ? { stringValue: schedule.cronExpression } : { isNull: true } },
        { name: 'runAt', value: schedule.runAt ? { stringValue: schedule.runAt.toISOString() } : { isNull: true } },
        { name: 'timezone', value: { stringValue: schedule.timezone || 'UTC' } },
        { name: 'maxRuns', value: schedule.maxRuns ? { longValue: schedule.maxRuns } : { isNull: true } },
        { name: 'nextRun', value: nextRun ? { stringValue: nextRun.toISOString() } : { isNull: true } },
        { name: 'notificationEmail', value: schedule.notificationEmail ? { stringValue: schedule.notificationEmail } : { isNull: true } },
        { name: 'outputDestination', value: { stringValue: schedule.outputDestination || 'email' } },
      ]
    );

    const promptId = String((result.rows[0] as Record<string, unknown>)?.id || '');

    if (schedule.type === 'cron' && schedule.cronExpression) {
      await this.createEventBridgeRule(promptId, schedule.cronExpression);
    }

    return promptId;
  }

  async executeScheduledPrompt(promptId: string): Promise<string> {
    const prompt = await this.getScheduledPrompt(promptId);
    if (!prompt || !prompt.isActive) {
      throw new Error('Scheduled prompt not found or inactive');
    }

    const runResult = await executeStatement(
      `INSERT INTO scheduled_prompt_runs (prompt_id, status, started_at)
       VALUES ($1, 'running', NOW())
       RETURNING id`,
      [{ name: 'promptId', value: { stringValue: promptId } }]
    );

    const runId = String((runResult.rows[0] as Record<string, unknown>)?.id || '');

    try {
      const startTime = Date.now();
      const output = await this.executePrompt(prompt.promptText, prompt.model);
      const latencyMs = Date.now() - startTime;

      await executeStatement(
        `UPDATE scheduled_prompt_runs
         SET status = 'completed', output = $2, latency_ms = $3, completed_at = NOW()
         WHERE id = $1`,
        [
          { name: 'runId', value: { stringValue: runId } },
          { name: 'output', value: { stringValue: output } },
          { name: 'latencyMs', value: { longValue: latencyMs } },
        ]
      );

      const nextRun = this.calculateNextRun({
        type: prompt.scheduleType,
        cronExpression: prompt.cronExpression,
        name: '',
        prompt: '',
        model: '',
      });

      await executeStatement(
        `UPDATE scheduled_prompts
         SET last_run = NOW(), run_count = run_count + 1, next_run = $2
         WHERE id = $1`,
        [
          { name: 'promptId', value: { stringValue: promptId } },
          { name: 'nextRun', value: nextRun ? { stringValue: nextRun.toISOString() } : { isNull: true } },
        ]
      );

      if (prompt.maxRuns && prompt.runCount + 1 >= prompt.maxRuns) {
        await executeStatement(
          `UPDATE scheduled_prompts SET is_active = false WHERE id = $1`,
          [{ name: 'promptId', value: { stringValue: promptId } }]
        );
      }

      return runId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await executeStatement(
        `UPDATE scheduled_prompt_runs
         SET status = 'failed', error_message = $2, completed_at = NOW()
         WHERE id = $1`,
        [
          { name: 'runId', value: { stringValue: runId } },
          { name: 'errorMessage', value: { stringValue: errorMessage } },
        ]
      );

      throw error;
    }
  }

  async getScheduledPrompt(promptId: string): Promise<ScheduledPrompt | null> {
    const result = await executeStatement(`SELECT * FROM scheduled_prompts WHERE id = $1`, [
      { name: 'promptId', value: { stringValue: promptId } },
    ]);

    return result.rows.length > 0 ? (result.rows[0] as unknown as ScheduledPrompt) : null;
  }

  async getUserSchedules(tenantId: string, userId: string): Promise<ScheduledPrompt[]> {
    const result = await executeStatement(
      `SELECT sp.*, 
              (SELECT COUNT(*) FROM scheduled_prompt_runs WHERE prompt_id = sp.id) as total_runs,
              (SELECT status FROM scheduled_prompt_runs WHERE prompt_id = sp.id ORDER BY created_at DESC LIMIT 1) as last_status
       FROM scheduled_prompts sp
       WHERE sp.tenant_id = $1 AND sp.user_id = $2
       ORDER BY sp.created_at DESC`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    return result.rows as unknown as ScheduledPrompt[];
  }

  async getScheduleRuns(promptId: string, limit: number = 20): Promise<ScheduledPromptRun[]> {
    const result = await executeStatement(
      `SELECT * FROM scheduled_prompt_runs
       WHERE prompt_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [
        { name: 'promptId', value: { stringValue: promptId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows as unknown as ScheduledPromptRun[];
  }

  async pauseSchedule(promptId: string): Promise<void> {
    await executeStatement(
      `UPDATE scheduled_prompts SET is_active = false WHERE id = $1`,
      [{ name: 'promptId', value: { stringValue: promptId } }]
    );

    await this.deleteEventBridgeRule(promptId);
  }

  async resumeSchedule(promptId: string): Promise<void> {
    const prompt = await this.getScheduledPrompt(promptId);
    if (!prompt) throw new Error('Scheduled prompt not found');

    const nextRun = this.calculateNextRun({
      type: prompt.scheduleType,
      cronExpression: prompt.cronExpression,
      name: '',
      prompt: '',
      model: '',
    });

    await executeStatement(
      `UPDATE scheduled_prompts SET is_active = true, next_run = $2 WHERE id = $1`,
      [
        { name: 'promptId', value: { stringValue: promptId } },
        { name: 'nextRun', value: nextRun ? { stringValue: nextRun.toISOString() } : { isNull: true } },
      ]
    );

    if (prompt.scheduleType === 'cron' && prompt.cronExpression) {
      await this.createEventBridgeRule(promptId, prompt.cronExpression);
    }
  }

  async deleteSchedule(promptId: string): Promise<void> {
    await this.deleteEventBridgeRule(promptId);
    await executeStatement(`DELETE FROM scheduled_prompts WHERE id = $1`, [
      { name: 'promptId', value: { stringValue: promptId } },
    ]);
  }

  async updateSchedule(promptId: string, updates: Partial<ScheduleCreate>): Promise<void> {
    const setClauses: string[] = [];
    const params: SqlParameter[] = [
      { name: 'promptId', value: { stringValue: promptId } },
    ];
    let paramIndex = 2;

    if (updates.name !== undefined) {
      setClauses.push(`prompt_name = $${paramIndex++}`);
      params.push({ name: 'name', value: { stringValue: updates.name } });
    }
    if (updates.prompt !== undefined) {
      setClauses.push(`prompt_text = $${paramIndex++}`);
      params.push({ name: 'prompt', value: { stringValue: updates.prompt } });
    }
    if (updates.model !== undefined) {
      setClauses.push(`model = $${paramIndex++}`);
      params.push({ name: 'model', value: { stringValue: updates.model } });
    }
    if (updates.cronExpression !== undefined) {
      setClauses.push(`cron_expression = $${paramIndex++}`);
      params.push({ name: 'cronExpression', value: { stringValue: updates.cronExpression } });
    }
    if (updates.notificationEmail !== undefined) {
      setClauses.push(`notification_email = $${paramIndex++}`);
      params.push({ name: 'notificationEmail', value: { stringValue: updates.notificationEmail } });
    }

    if (setClauses.length === 0) return;

    await executeStatement(
      `UPDATE scheduled_prompts SET ${setClauses.join(', ')} WHERE id = $1`,
      params
    );
  }

  async getDueSchedules(): Promise<ScheduledPrompt[]> {
    const result = await executeStatement(
      `SELECT * FROM scheduled_prompts
       WHERE is_active = true AND next_run <= NOW()
       ORDER BY next_run ASC
       LIMIT 100`,
      []
    );

    return result.rows as unknown as ScheduledPrompt[];
  }

  private calculateNextRun(schedule: ScheduleCreate): Date | null {
    if (schedule.type === 'once' && schedule.runAt) {
      return new Date(schedule.runAt);
    }

    if (schedule.type === 'cron' && schedule.cronExpression) {
      return this.getNextCronRun(schedule.cronExpression);
    }

    if (schedule.type === 'interval' && schedule.intervalMinutes) {
      return new Date(Date.now() + schedule.intervalMinutes * 60 * 1000);
    }

    return null;
  }

  private getNextCronRun(cronExpression: string): Date {
    const parts = cronExpression.split(' ');
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    now.setSeconds(0);
    now.setMilliseconds(0);
    return now;
  }

  private async createEventBridgeRule(promptId: string, cronExpression: string): Promise<void> {
    const ruleName = `radiant-schedule-${promptId}`;

    try {
      await eventBridge.send(
        new PutRuleCommand({
          Name: ruleName,
          ScheduleExpression: `cron(${cronExpression})`,
          State: 'ENABLED',
          Description: `RADIANT scheduled prompt: ${promptId}`,
        })
      );

      if (SCHEDULER_LAMBDA_ARN) {
        await eventBridge.send(
          new PutTargetsCommand({
            Rule: ruleName,
            Targets: [
              {
                Id: 'scheduled-prompt-target',
                Arn: SCHEDULER_LAMBDA_ARN,
                Input: JSON.stringify({ promptId }),
              },
            ],
          })
        );
      }
    } catch (error) {
      console.error(`Failed to create EventBridge rule for prompt ${promptId}:`, error);
      throw error;
    }
  }

  private async deleteEventBridgeRule(promptId: string): Promise<void> {
    const ruleName = `radiant-schedule-${promptId}`;

    try {
      await eventBridge.send(
        new RemoveTargetsCommand({
          Rule: ruleName,
          Ids: ['scheduled-prompt-target'],
        })
      );

      await eventBridge.send(
        new DeleteRuleCommand({
          Name: ruleName,
        })
      );
    } catch (error) {
      // Rule may not exist, log but don't throw
      console.warn(`Failed to delete EventBridge rule for prompt ${promptId}:`, error);
    }
  }

  private async executePrompt(prompt: string, model: string): Promise<string> {
    const aiServiceUrl = process.env.AI_SERVICE_URL || process.env.LITELLM_ENDPOINT;
    const aiServiceKey = process.env.AI_SERVICE_API_KEY || process.env.LITELLM_API_KEY;

    if (!aiServiceUrl) {
      throw new Error('AI_SERVICE_URL not configured');
    }

    const response = await fetch(`${aiServiceUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(aiServiceKey && { 'Authorization': `Bearer ${aiServiceKey}` }),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI service error: ${response.status} - ${error}`);
    }

    const result = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return result.choices?.[0]?.message?.content || '';
  }
}

export const schedulerService = new SchedulerService();
