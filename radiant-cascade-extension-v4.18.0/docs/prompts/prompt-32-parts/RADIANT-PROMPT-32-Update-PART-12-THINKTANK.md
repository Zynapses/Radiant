# SECTION 25: FOCUS MODES & CUSTOM PERSONAS (v3.6.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 25.1 Focus Modes Overview

Pre-configured AI behavior profiles and custom persona creation.

## 25.2 Personas Database Schema

```sql
-- migrations/034_focus_personas.sql

CREATE TABLE focus_modes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    mode_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    system_prompt TEXT NOT NULL,
    default_model VARCHAR(100),
    settings JSONB DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    persona_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    avatar_url VARCHAR(500),
    system_prompt TEXT NOT NULL,
    voice_id VARCHAR(100),
    personality_traits JSONB DEFAULT '[]',
    knowledge_domains JSONB DEFAULT '[]',
    conversation_style JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE persona_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL REFERENCES user_personas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    chat_id UUID REFERENCES chats(id),
    tokens_used INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_focus_modes_tenant ON focus_modes(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_user_personas_user ON user_personas(tenant_id, user_id);
CREATE INDEX idx_persona_usage ON persona_usage_log(persona_id, created_at DESC);

ALTER TABLE focus_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_usage_log ENABLE ROW LEVEL SECURITY;

-- System modes visible to all, tenant modes to tenant only
CREATE POLICY focus_modes_policy ON focus_modes USING (
    is_system = true OR tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID
);
CREATE POLICY user_personas_isolation ON user_personas USING (
    tenant_id = current_setting('app.current_tenant_id')::UUID AND 
    (user_id = current_setting('app.user_id')::UUID OR is_public = true)
);
CREATE POLICY persona_usage_isolation ON persona_usage_log USING (
    persona_id IN (SELECT id FROM user_personas WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);

-- Insert default focus modes
INSERT INTO focus_modes (mode_name, display_name, description, icon, system_prompt, is_system) VALUES
('general', 'General Assistant', 'Versatile AI for any task', 'MessageSquare', 'You are a helpful, harmless, and honest AI assistant.', true),
('code', 'Code Expert', 'Programming and development focus', 'Code', 'You are an expert software developer. Focus on clean, efficient, well-documented code. Explain your reasoning and suggest best practices.', true),
('writer', 'Creative Writer', 'Creative writing and content creation', 'PenTool', 'You are a creative writing assistant. Help with storytelling, content creation, and writing improvement. Be imaginative and expressive.', true),
('analyst', 'Data Analyst', 'Data analysis and insights', 'BarChart', 'You are a data analyst. Focus on extracting insights, identifying patterns, and presenting findings clearly. Be precise and methodical.', true),
('researcher', 'Research Assistant', 'Deep research and fact-finding', 'Search', 'You are a research assistant. Provide thorough, well-sourced information. Verify facts and present balanced perspectives.', true);
```

## 25.3 Persona Service

```typescript
// packages/core/src/services/persona-service.ts

import { Pool } from 'pg';

interface PersonaCreate {
    name: string;
    displayName?: string;
    systemPrompt: string;
    avatarUrl?: string;
    voiceId?: string;
    traits?: string[];
    domains?: string[];
    style?: Record<string, any>;
    isPublic?: boolean;
}

export class PersonaService {
    private pool: Pool;
    
    constructor(pool: Pool) {
        this.pool = pool;
    }
    
    async getFocusModes(tenantId?: string): Promise<any[]> {
        const result = await this.pool.query(`
            SELECT * FROM focus_modes
            WHERE is_active = true AND (is_system = true OR tenant_id IS NULL OR tenant_id = $1)
            ORDER BY is_system DESC, mode_name
        `, [tenantId]);
        
        return result.rows;
    }
    
    async createPersona(tenantId: string, userId: string, persona: PersonaCreate): Promise<string> {
        const result = await this.pool.query(`
            INSERT INTO user_personas (
                tenant_id, user_id, persona_name, display_name, system_prompt,
                avatar_url, voice_id, personality_traits, knowledge_domains,
                conversation_style, is_public
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
        `, [
            tenantId,
            userId,
            persona.name,
            persona.displayName,
            persona.systemPrompt,
            persona.avatarUrl,
            persona.voiceId,
            JSON.stringify(persona.traits || []),
            JSON.stringify(persona.domains || []),
            JSON.stringify(persona.style || {}),
            persona.isPublic || false
        ]);
        
        return result.rows[0].id;
    }
    
    async getUserPersonas(tenantId: string, userId: string): Promise<any[]> {
        const result = await this.pool.query(`
            SELECT * FROM user_personas
            WHERE tenant_id = $1 AND (user_id = $2 OR is_public = true)
            ORDER BY usage_count DESC
        `, [tenantId, userId]);
        
        return result.rows;
    }
    
    async getPersona(personaId: string): Promise<any> {
        const result = await this.pool.query(`SELECT * FROM user_personas WHERE id = $1`, [personaId]);
        return result.rows[0];
    }
    
    async updatePersona(personaId: string, updates: Partial<PersonaCreate>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [personaId];
        let paramIndex = 2;
        
        if (updates.name) { fields.push(`persona_name = $${paramIndex++}`); values.push(updates.name); }
        if (updates.displayName) { fields.push(`display_name = $${paramIndex++}`); values.push(updates.displayName); }
        if (updates.systemPrompt) { fields.push(`system_prompt = $${paramIndex++}`); values.push(updates.systemPrompt); }
        if (updates.avatarUrl) { fields.push(`avatar_url = $${paramIndex++}`); values.push(updates.avatarUrl); }
        if (updates.voiceId) { fields.push(`voice_id = $${paramIndex++}`); values.push(updates.voiceId); }
        if (updates.traits) { fields.push(`personality_traits = $${paramIndex++}`); values.push(JSON.stringify(updates.traits)); }
        if (updates.domains) { fields.push(`knowledge_domains = $${paramIndex++}`); values.push(JSON.stringify(updates.domains)); }
        if (updates.style) { fields.push(`conversation_style = $${paramIndex++}`); values.push(JSON.stringify(updates.style)); }
        if (typeof updates.isPublic === 'boolean') { fields.push(`is_public = $${paramIndex++}`); values.push(updates.isPublic); }
        
        fields.push('updated_at = NOW()');
        
        await this.pool.query(`UPDATE user_personas SET ${fields.join(', ')} WHERE id = $1`, values);
    }
    
    async logUsage(personaId: string, userId: string, chatId?: string, tokensUsed?: number): Promise<void> {
        await this.pool.query(`
            INSERT INTO persona_usage_log (persona_id, user_id, chat_id, tokens_used)
            VALUES ($1, $2, $3, $4)
        `, [personaId, userId, chatId, tokensUsed]);
        
        await this.pool.query(`
            UPDATE user_personas SET usage_count = usage_count + 1 WHERE id = $1
        `, [personaId]);
    }
    
    async buildPrompt(personaId: string, userMessage: string): Promise<string> {
        const persona = await this.getPersona(personaId);
        if (!persona) throw new Error('Persona not found');
        
        const traits = persona.personality_traits as string[];
        const domains = persona.knowledge_domains as string[];
        
        let prompt = persona.system_prompt;
        
        if (traits.length > 0) {
            prompt += `\n\nPersonality traits: ${traits.join(', ')}.`;
        }
        
        if (domains.length > 0) {
            prompt += `\n\nAreas of expertise: ${domains.join(', ')}.`;
        }
        
        return prompt;
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 26: SCHEDULED PROMPTS (v3.6.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 26.1 Scheduled Prompts Overview

Schedule AI tasks to run at specific times or intervals.

## 26.2 Scheduled Prompts Database Schema

```sql
-- migrations/035_scheduled_prompts.sql

CREATE TABLE scheduled_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    prompt_name VARCHAR(200) NOT NULL,
    prompt_text TEXT NOT NULL,
    model VARCHAR(100) NOT NULL,
    schedule_type VARCHAR(20) NOT NULL,
    cron_expression VARCHAR(100),
    run_at TIMESTAMPTZ,
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    max_runs INTEGER,
    run_count INTEGER DEFAULT 0,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    notification_email VARCHAR(255),
    output_destination VARCHAR(50) DEFAULT 'email',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scheduled_prompt_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES scheduled_prompts(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    output TEXT,
    tokens_used INTEGER,
    cost DECIMAL(10, 6),
    latency_ms INTEGER,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scheduled_prompts_user ON scheduled_prompts(tenant_id, user_id);
CREATE INDEX idx_scheduled_prompts_next_run ON scheduled_prompts(next_run) WHERE is_active = true;
CREATE INDEX idx_prompt_runs ON scheduled_prompt_runs(prompt_id, created_at DESC);

ALTER TABLE scheduled_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_prompt_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY scheduled_prompts_isolation ON scheduled_prompts USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY prompt_runs_isolation ON scheduled_prompt_runs USING (
    prompt_id IN (SELECT id FROM scheduled_prompts WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);
```

## 26.3 Scheduler Service

```typescript
// packages/core/src/services/scheduler-service.ts

import { Pool } from 'pg';
import { EventBridgeClient, PutRuleCommand, PutTargetsCommand, DeleteRuleCommand } from '@aws-sdk/client-eventbridge';
import * as cronParser from 'cron-parser';

type ScheduleType = 'once' | 'cron' | 'interval';

interface ScheduleCreate {
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
    outputDestination?: 'email' | 'webhook' | 'storage';
}

export class SchedulerService {
    private pool: Pool;
    private eventBridge: EventBridgeClient;
    
    constructor(pool: Pool) {
        this.pool = pool;
        this.eventBridge = new EventBridgeClient({});
    }
    
    async createSchedule(tenantId: string, userId: string, schedule: ScheduleCreate): Promise<string> {
        const nextRun = this.calculateNextRun(schedule);
        
        const result = await this.pool.query(`
            INSERT INTO scheduled_prompts (
                tenant_id, user_id, prompt_name, prompt_text, model, schedule_type,
                cron_expression, run_at, timezone, max_runs, next_run,
                notification_email, output_destination
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
        `, [
            tenantId, userId, schedule.name, schedule.prompt, schedule.model, schedule.type,
            schedule.cronExpression, schedule.runAt, schedule.timezone || 'UTC', schedule.maxRuns,
            nextRun, schedule.notificationEmail, schedule.outputDestination || 'email'
        ]);
        
        const promptId = result.rows[0].id;
        
        // Create EventBridge rule for cron schedules
        if (schedule.type === 'cron' && schedule.cronExpression) {
            await this.createEventBridgeRule(promptId, schedule.cronExpression);
        }
        
        return promptId;
    }
    
    async executeScheduledPrompt(promptId: string): Promise<string> {
        const prompt = await this.getScheduledPrompt(promptId);
        if (!prompt || !prompt.is_active) {
            throw new Error('Scheduled prompt not found or inactive');
        }
        
        // Create run record
        const runResult = await this.pool.query(`
            INSERT INTO scheduled_prompt_runs (prompt_id, status, started_at)
            VALUES ($1, 'running', NOW())
            RETURNING id
        `, [promptId]);
        
        const runId = runResult.rows[0].id;
        
        try {
            // Execute the prompt (would call AI service)
            const startTime = Date.now();
            const output = await this.executePrompt(prompt.prompt_text, prompt.model);
            const latencyMs = Date.now() - startTime;
            
            // Update run record
            await this.pool.query(`
                UPDATE scheduled_prompt_runs
                SET status = 'completed', output = $2, latency_ms = $3, completed_at = NOW()
                WHERE id = $1
            `, [runId, output, latencyMs]);
            
            // Update schedule
            const nextRun = this.calculateNextRun({
                type: prompt.schedule_type,
                cronExpression: prompt.cron_expression
            });
            
            await this.pool.query(`
                UPDATE scheduled_prompts
                SET last_run = NOW(), run_count = run_count + 1, next_run = $2
                WHERE id = $1
            `, [promptId, nextRun]);
            
            // Check if max runs reached
            if (prompt.max_runs && prompt.run_count + 1 >= prompt.max_runs) {
                await this.pool.query(`UPDATE scheduled_prompts SET is_active = false WHERE id = $1`, [promptId]);
            }
            
            return runId;
        } catch (error: any) {
            await this.pool.query(`
                UPDATE scheduled_prompt_runs
                SET status = 'failed', error_message = $2, completed_at = NOW()
                WHERE id = $1
            `, [runId, error.message]);
            
            throw error;
        }
    }
    
    async getScheduledPrompt(promptId: string): Promise<any> {
        const result = await this.pool.query(`SELECT * FROM scheduled_prompts WHERE id = $1`, [promptId]);
        return result.rows[0];
    }
    
    async getUserSchedules(tenantId: string, userId: string): Promise<any[]> {
        const result = await this.pool.query(`
            SELECT sp.*, 
                   (SELECT COUNT(*) FROM scheduled_prompt_runs WHERE prompt_id = sp.id) as total_runs,
                   (SELECT status FROM scheduled_prompt_runs WHERE prompt_id = sp.id ORDER BY created_at DESC LIMIT 1) as last_status
            FROM scheduled_prompts sp
            WHERE sp.tenant_id = $1 AND sp.user_id = $2
            ORDER BY sp.created_at DESC
        `, [tenantId, userId]);
        
        return result.rows;
    }
    
    async pauseSchedule(promptId: string): Promise<void> {
        await this.pool.query(`UPDATE scheduled_prompts SET is_active = false WHERE id = $1`, [promptId]);
    }
    
    async resumeSchedule(promptId: string): Promise<void> {
        const nextRun = this.calculateNextRun(await this.getScheduledPrompt(promptId));
        await this.pool.query(`
            UPDATE scheduled_prompts SET is_active = true, next_run = $2 WHERE id = $1
        `, [promptId, nextRun]);
    }
    
    private calculateNextRun(schedule: any): Date | null {
        if (schedule.type === 'once' && schedule.runAt) {
            return new Date(schedule.runAt);
        }
        
        if (schedule.type === 'cron' && schedule.cronExpression) {
            const interval = cronParser.parseExpression(schedule.cronExpression);
            return interval.next().toDate();
        }
        
        return null;
    }
    
    private async createEventBridgeRule(promptId: string, cronExpression: string): Promise<void> {
        const ruleName = `radiant-schedule-${promptId}`;
        
        await this.eventBridge.send(new PutRuleCommand({
            Name: ruleName,
            ScheduleExpression: `cron(${cronExpression})`,
            State: 'ENABLED'
        }));
        
        await this.eventBridge.send(new PutTargetsCommand({
            Rule: ruleName,
            Targets: [{
                Id: 'scheduled-prompt-target',
                Arn: process.env.SCHEDULER_LAMBDA_ARN!,
                Input: JSON.stringify({ promptId })
            }]
        }));
    }
    
    private async executePrompt(prompt: string, model: string): Promise<string> {
        // This would call the AI service
        return `Executed prompt with model ${model}`;
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 27: FAMILY & TEAM PLANS (v3.6.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 27.1 Team Plans Overview

Shared subscription plans for families and teams with usage allocation.

## 27.2 Team Plans Database Schema

```sql
-- migrations/036_team_plans.sql

CREATE TABLE team_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    plan_name VARCHAR(100) NOT NULL,
    plan_type VARCHAR(20) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    max_members INTEGER NOT NULL DEFAULT 5,
    total_tokens_monthly BIGINT NOT NULL,
    shared_pool BOOLEAN DEFAULT true,
    billing_email VARCHAR(255),
    stripe_subscription_id VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES team_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    token_allocation BIGINT,
    tokens_used_this_period BIGINT DEFAULT 0,
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(team_id, user_id)
);

CREATE TABLE team_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES team_plans(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    tokens_used INTEGER NOT NULL,
    model VARCHAR(100),
    usage_type VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_team_plans_tenant ON team_plans(tenant_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_usage ON team_usage_log(team_id, created_at DESC);

ALTER TABLE team_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_plans_isolation ON team_plans USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY team_members_isolation ON team_members USING (
    team_id IN (SELECT id FROM team_plans WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);
CREATE POLICY team_usage_isolation ON team_usage_log USING (
    team_id IN (SELECT id FROM team_plans WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
);
```

## 27.3 Team Service

```typescript
// packages/core/src/services/team-service.ts

import { Pool } from 'pg';

type PlanType = 'family' | 'team' | 'enterprise';
type MemberRole = 'owner' | 'admin' | 'member';

interface TeamCreate {
    name: string;
    type: PlanType;
    maxMembers: number;
    totalTokensMonthly: number;
    sharedPool?: boolean;
    billingEmail?: string;
}

export class TeamService {
    private pool: Pool;
    
    constructor(pool: Pool) {
        this.pool = pool;
    }
    
    async createTeam(tenantId: string, ownerId: string, team: TeamCreate): Promise<string> {
        const result = await this.pool.query(`
            INSERT INTO team_plans (
                tenant_id, plan_name, plan_type, owner_id, max_members,
                total_tokens_monthly, shared_pool, billing_email
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [
            tenantId, team.name, team.type, ownerId, team.maxMembers,
            team.totalTokensMonthly, team.sharedPool ?? true, team.billingEmail
        ]);
        
        const teamId = result.rows[0].id;
        
        // Add owner as first member
        await this.addMember(teamId, ownerId, 'owner');
        
        return teamId;
    }
    
    async addMember(teamId: string, userId: string, role: MemberRole = 'member', invitedBy?: string): Promise<string> {
        const team = await this.getTeam(teamId);
        const memberCount = await this.getMemberCount(teamId);
        
        if (memberCount >= team.max_members) {
            throw new Error('Team member limit reached');
        }
        
        const result = await this.pool.query(`
            INSERT INTO team_members (team_id, user_id, role, invited_by, accepted_at)
            VALUES ($1, $2, $3, $4, CASE WHEN $3 = 'owner' THEN NOW() ELSE NULL END)
            RETURNING id
        `, [teamId, userId, role, invitedBy]);
        
        return result.rows[0].id;
    }
    
    async removeMember(teamId: string, userId: string): Promise<void> {
        // Check not removing owner
        const member = await this.getMember(teamId, userId);
        if (member?.role === 'owner') {
            throw new Error('Cannot remove team owner');
        }
        
        await this.pool.query(`
            UPDATE team_members SET is_active = false WHERE team_id = $1 AND user_id = $2
        `, [teamId, userId]);
    }
    
    async acceptInvitation(teamId: string, userId: string): Promise<void> {
        await this.pool.query(`
            UPDATE team_members SET accepted_at = NOW() WHERE team_id = $1 AND user_id = $2
        `, [teamId, userId]);
    }
    
    async allocateTokens(teamId: string, userId: string, tokens: number): Promise<void> {
        await this.pool.query(`
            UPDATE team_members SET token_allocation = $3 WHERE team_id = $1 AND user_id = $2
        `, [teamId, userId, tokens]);
    }
    
    async recordUsage(teamId: string, userId: string, tokensUsed: number, model?: string): Promise<void> {
        const member = await this.getMember(teamId, userId);
        if (!member) throw new Error('Not a team member');
        
        // Check allocation if not shared pool
        const team = await this.getTeam(teamId);
        if (!team.shared_pool && member.token_allocation) {
            if (member.tokens_used_this_period + tokensUsed > member.token_allocation) {
                throw new Error('Token allocation exceeded');
            }
        }
        
        // Update member usage
        await this.pool.query(`
            UPDATE team_members SET tokens_used_this_period = tokens_used_this_period + $3
            WHERE team_id = $1 AND user_id = $2
        `, [teamId, userId, tokensUsed]);
        
        // Log usage
        await this.pool.query(`
            INSERT INTO team_usage_log (team_id, member_id, tokens_used, model)
            VALUES ($1, $2, $3, $4)
        `, [teamId, member.id, tokensUsed, model]);
    }
    
    async getTeamUsageStats(teamId: string): Promise<any> {
        const team = await this.getTeam(teamId);
        
        const members = await this.pool.query(`
            SELECT tm.*, u.email, u.display_name
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = $1 AND tm.is_active = true
        `, [teamId]);
        
        const totalUsed = members.rows.reduce((sum: number, m: any) => sum + (m.tokens_used_this_period || 0), 0);
        
        return {
            teamId,
            planName: team.plan_name,
            totalTokensMonthly: team.total_tokens_monthly,
            tokensUsed: totalUsed,
            tokensRemaining: team.total_tokens_monthly - totalUsed,
            members: members.rows.map((m: any) => ({
                userId: m.user_id,
                email: m.email,
                displayName: m.display_name,
                role: m.role,
                tokensUsed: m.tokens_used_this_period,
                allocation: m.token_allocation
            }))
        };
    }
    
    async resetPeriodUsage(teamId: string): Promise<void> {
        await this.pool.query(`
            UPDATE team_members SET tokens_used_this_period = 0 WHERE team_id = $1
        `, [teamId]);
        
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        
        await this.pool.query(`
            UPDATE team_plans 
            SET current_period_start = NOW(), current_period_end = $2 
            WHERE id = $1
        `, [teamId, nextMonth]);
    }
    
    private async getTeam(teamId: string) {
        const result = await this.pool.query(`SELECT * FROM team_plans WHERE id = $1`, [teamId]);
        return result.rows[0];
    }
    
    private async getMember(teamId: string, userId: string) {
        const result = await this.pool.query(
            `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2`,
            [teamId, userId]
        );
        return result.rows[0];
    }
    
    private async getMemberCount(teamId: string): Promise<number> {
        const result = await this.pool.query(
            `SELECT COUNT(*) FROM team_members WHERE team_id = $1 AND is_active = true`,
            [teamId]
        );
        return parseInt(result.rows[0].count);
    }
}
```

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 28: ANALYTICS INTEGRATION (v3.6.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

## 28.1 Analytics Dashboard Extensions

```typescript
// apps/admin-dashboard/src/app/admin/analytics/page.tsx

'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, TrendingUp, Users, DollarSign, Cpu, Clock } from 'lucide-react';

export default function AnalyticsPage() {
    const [timeRange, setTimeRange] = useState('7d');
    const [metricType, setMetricType] = useState('usage');
    
    const { data: metrics } = useQuery({
        queryKey: ['analytics', timeRange, metricType],
        queryFn: async () => {
            const res = await fetch(`/api/admin/analytics?range=${timeRange}&type=${metricType}`);
            return res.json();
        }
    });
    
    const { data: modelStats } = useQuery({
        queryKey: ['model-stats', timeRange],
        queryFn: async () => {
            const res = await fetch(`/api/admin/analytics/models?range=${timeRange}`);
            return res.json();
        }
    });
    
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Analytics</h1>
                <div className="flex gap-4">
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24h">Last 24h</SelectItem>
                            <SelectItem value="7d">Last 7 days</SelectItem>
                            <SelectItem value="30d">Last 30 days</SelectItem>
                            <SelectItem value="90d">Last 90 days</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Total Requests</p>
                                <p className="text-2xl font-bold">{metrics?.totalRequests?.toLocaleString()}</p>
                                <p className="text-sm text-green-500">+{metrics?.requestsGrowth}%</p>
                            </div>
                            <BarChart3 className="h-8 w-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Total Tokens</p>
                                <p className="text-2xl font-bold">{(metrics?.totalTokens / 1000000)?.toFixed(1)}M</p>
                                <p className="text-sm text-green-500">+{metrics?.tokensGrowth}%</p>
                            </div>
                            <Cpu className="h-8 w-8 text-purple-500" />
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Total Cost</p>
                                <p className="text-2xl font-bold">${metrics?.totalCost?.toFixed(2)}</p>
                                <p className="text-sm text-green-500">+{metrics?.costGrowth}%</p>
                            </div>
                            <DollarSign className="h-8 w-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Avg Latency</p>
                                <p className="text-2xl font-bold">{metrics?.avgLatency}ms</p>
                                <p className="text-sm text-green-500">-{metrics?.latencyImprovement}%</p>
                            </div>
                            <Clock className="h-8 w-8 text-orange-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            {/* Charts */}
            <div className="grid grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Usage Over Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={metrics?.usageTimeSeries || []}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="requests" stroke="#0088FE" />
                                <Line type="monotone" dataKey="tokens" stroke="#00C49F" />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Model Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={modelStats?.distribution || []}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    label
                                >
                                    {(modelStats?.distribution || []).map((entry: any, index: number) => (
                                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
            
            {/* Model Performance Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Model Performance</CardTitle>
                </CardHeader>
                <CardContent>
                    <table className="w-full">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2">Model</th>
                                <th className="text-right">Requests</th>
                                <th className="text-right">Avg Latency</th>
                                <th className="text-right">Success Rate</th>
                                <th className="text-right">Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(modelStats?.models || []).map((model: any) => (
                                <tr key={model.id} className="border-b">
                                    <td className="py-2">{model.name}</td>
                                    <td className="text-right">{model.requests.toLocaleString()}</td>
                                    <td className="text-right">{model.avgLatency}ms</td>
                                    <td className="text-right">{(model.successRate * 100).toFixed(1)}%</td>
                                    <td className="text-right">${model.cost.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}
```


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 29: ADMIN DASHBOARD EXTENSIONS (v3.7.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **NEW in v3.7.0**: Extended admin dashboard capabilities for managing all v3.x features.

---

## 29.1 Admin Dashboard Navigation Update

```typescript
// apps/admin-dashboard/src/components/layout/sidebar.tsx

const navigationItems = [
  // Existing items...
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tenants', href: '/tenants', icon: Building2 },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Administrators', href: '/administrators', icon: Shield },
  
  // AI & Models Section
  { type: 'separator', label: 'AI & Models' },
  { name: 'Providers', href: '/providers', icon: Cloud },
  { name: 'Models', href: '/models', icon: Brain },
  { name: 'Model Pricing', href: '/models/pricing', icon: DollarSign }, // NEW
  { name: 'Visual AI', href: '/visual-ai', icon: Image },
  { name: 'Thermal States', href: '/thermal-states', icon: Thermometer },
  
  // Think Tank Section (NEW)
  { type: 'separator', label: 'Think Tank' },
  { name: 'Think Tank Users', href: '/thinktank/users', icon: UserCircle },
  { name: 'Conversations', href: '/thinktank/conversations', icon: MessageSquare },
  { name: 'Domain Modes', href: '/thinktank/domain-modes', icon: Layers },
  { name: 'Model Categories', href: '/thinktank/model-categories', icon: Grid },
  
  // Operations Section
  { type: 'separator', label: 'Operations' },
  { name: 'Usage & Billing', href: '/billing', icon: Receipt },
  { name: 'Analytics', href: '/analytics', icon: BarChart },
  { name: 'Error Logs', href: '/errors', icon: AlertTriangle },
  { name: 'Audit Logs', href: '/audit', icon: FileText },
  
  // Settings Section
  { type: 'separator', label: 'Settings' },
  { name: 'Credentials', href: '/credentials', icon: Key },
  { name: 'System Config', href: '/config', icon: Settings },
];
```

---

## 29.2 Think Tank User Management Page

```typescript
// apps/admin-dashboard/src/app/(dashboard)/thinktank/users/page.tsx

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, UserX, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const columns = [
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.email}</div>
        <div className="text-xs text-muted-foreground">
          ID: {row.original.id.slice(0, 8)}...
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'display_name',
    header: 'Display Name',
  },
  {
    accessorKey: 'language',
    header: 'Language',
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.language?.toUpperCase() || 'EN'}</Badge>
    ),
  },
  {
    accessorKey: 'subscription_tier',
    header: 'Tier',
    cell: ({ row }) => {
      const tier = row.original.subscription_tier;
      const colors = {
        free: 'bg-gray-100',
        pro: 'bg-blue-100 text-blue-800',
        team: 'bg-purple-100 text-purple-800',
        enterprise: 'bg-amber-100 text-amber-800',
      };
      return <Badge className={colors[tier] || colors.free}>{tier}</Badge>;
    },
  },
  {
    accessorKey: 'conversation_count',
    header: 'Conversations',
    cell: ({ row }) => row.original.conversation_count?.toLocaleString() || '0',
  },
  {
    accessorKey: 'total_tokens_used',
    header: 'Tokens Used',
    cell: ({ row }) => (row.original.total_tokens_used || 0).toLocaleString(),
  },
  {
    accessorKey: 'total_spent',
    header: 'Total Spent',
    cell: ({ row }) => `$${(row.original.total_spent || 0).toFixed(2)}`,
  },
  {
    accessorKey: 'last_active_at',
    header: 'Last Active',
    cell: ({ row }) =>
      row.original.last_active_at
        ? formatDistanceToNow(new Date(row.original.last_active_at), { addSuffix: true })
        : 'Never',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.status === 'active' ? 'default' : 'destructive'}>
        {row.original.status}
      </Badge>
    ),
  },
];

export default function ThinkTankUsersPage() {
  const [search, setSearch] = useState('');
  
  const { data: users, isLoading } = useQuery({
    queryKey: ['thinktank-users', search],
    queryFn: () => fetch(`/api/admin/thinktank/users?search=${search}`).then(r => r.json()),
  });

  const { data: stats } = useQuery({
    queryKey: ['thinktank-user-stats'],
    queryFn: () => fetch('/api/admin/thinktank/users/stats').then(r => r.json()),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Think Tank Users</h1>
          <p className="text-muted-foreground">
            Manage Think Tank consumer users
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeUsers7d?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pro+ Subscribers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.paidUsers?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.totalRevenue?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={users?.data || []}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 29.3 Domain Modes Configuration Page

```typescript
// apps/admin-dashboard/src/app/(dashboard)/thinktank/domain-modes/page.tsx

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Stethoscope, Scale, Code2, Lightbulb, GraduationCap, 
  PenTool, FlaskConical, Save 
} from 'lucide-react';

const DOMAIN_MODES = [
  { id: 'general', name: 'General', icon: Lightbulb, description: 'Default mode for general queries' },
  { id: 'medical', name: 'Medical', icon: Stethoscope, description: 'Healthcare and medical topics' },
  { id: 'legal', name: 'Legal', icon: Scale, description: 'Legal research and analysis' },
  { id: 'code', name: 'Code', icon: Code2, description: 'Programming and development' },
  { id: 'academic', name: 'Academic', icon: GraduationCap, description: 'Research and education' },
  { id: 'creative', name: 'Creative', icon: PenTool, description: 'Writing and content creation' },
  { id: 'scientific', name: 'Scientific', icon: FlaskConical, description: 'Scientific research' },
];

export default function DomainModesPage() {
  const queryClient = useQueryClient();
  
  const { data: config } = useQuery({
    queryKey: ['domain-modes-config'],
    queryFn: () => fetch('/api/admin/thinktank/domain-modes').then(r => r.json()),
  });

  const { data: models } = useQuery({
    queryKey: ['available-models'],
    queryFn: () => fetch('/api/admin/models?enabled=true').then(r => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      fetch('/api/admin/thinktank/domain-modes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain-modes-config'] });
      toast.success('Domain mode configuration saved');
    },
  });

  const [localConfig, setLocalConfig] = useState(config || {});

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Domain Modes</h1>
          <p className="text-muted-foreground">
            Configure specialized AI modes for different use cases
          </p>
        </div>
        <Button onClick={() => updateMutation.mutate(localConfig)}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid gap-4">
        {DOMAIN_MODES.map((mode) => {
          const ModeIcon = mode.icon;
          const modeConfig = localConfig?.modes?.[mode.id] || {};
          
          return (
            <Card key={mode.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <ModeIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{mode.name}</CardTitle>
                      <CardDescription>{mode.description}</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={modeConfig.enabled !== false}
                    onCheckedChange={(checked) =>
                      setLocalConfig({
                        ...localConfig,
                        modes: {
                          ...localConfig.modes,
                          [mode.id]: { ...modeConfig, enabled: checked },
                        },
                      })
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Default Model</Label>
                    <Select
                      value={modeConfig.defaultModel || 'auto'}
                      onValueChange={(value) =>
                        setLocalConfig({
                          ...localConfig,
                          modes: {
                            ...localConfig.modes,
                            [mode.id]: { ...modeConfig, defaultModel: value },
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Auto (RADIANT Brain)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (RADIANT Brain)</SelectItem>
                        {(models?.data || []).map((model: any) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Temperature</Label>
                    <Input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={modeConfig.temperature || 0.7}
                      onChange={(e) =>
                        setLocalConfig({
                          ...localConfig,
                          modes: {
                            ...localConfig.modes,
                            [mode.id]: { ...modeConfig, temperature: parseFloat(e.target.value) },
                          },
                        })
                      }
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>System Prompt Override</Label>
                  <Textarea
                    placeholder="Optional: Custom system prompt for this mode..."
                    value={modeConfig.systemPrompt || ''}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        modes: {
                          ...localConfig.modes,
                          [mode.id]: { ...modeConfig, systemPrompt: e.target.value },
                        },
                      })
                    }
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```



# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 30: DYNAMIC PROVIDER REGISTRY + xAI/GROK (v3.7.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **NEW in v3.7.0**: Database-driven model registry with automatic sync and xAI/Grok integration.

---

## 30.1 Complete Provider & Model Registry

### External AI Providers (21+)

| Provider ID | Display Name | API Base | Auth Type |
|-------------|--------------|----------|-----------|
| `anthropic` | Anthropic | api.anthropic.com | API Key |
| `openai` | OpenAI | api.openai.com | API Key |
| `google` | Google (Gemini) | generativelanguage.googleapis.com | API Key |
| `xai` | xAI (Grok) | api.x.ai | API Key |
| `mistral` | Mistral AI | api.mistral.ai | API Key |
| `cohere` | Cohere | api.cohere.ai | API Key |
| `perplexity` | Perplexity | api.perplexity.ai | API Key |
| `deepseek` | DeepSeek | api.deepseek.com | API Key |
| `together` | Together AI | api.together.xyz | API Key |
| `fireworks` | Fireworks AI | api.fireworks.ai | API Key |
| `groq` | Groq | api.groq.com | API Key |
| `replicate` | Replicate | api.replicate.com | API Key |
| `huggingface` | Hugging Face | api-inference.huggingface.co | API Key |
| `bedrock` | AWS Bedrock | bedrock-runtime.amazonaws.com | IAM |
| `azure_openai` | Azure OpenAI | *.openai.azure.com | API Key |
| `vertex_ai` | Google Vertex AI | *.aiplatform.googleapis.com | Service Account |

---

## 30.2 xAI/Grok Models (10 Models)

| Model ID | Display Name | Context | Input $/1M | Output $/1M | Capabilities |
|----------|--------------|---------|------------|-------------|--------------|
| `grok-3` | Grok 3 | 131K | $3.00 | $15.00 | Flagship, real-time info |
| `grok-3-fast` | Grok 3 Fast | 131K | $1.00 | $5.00 | Speed-optimized |
| `grok-3-mini` | Grok 3 Mini | 131K | $0.30 | $1.50 | Cost-effective |
| `grok-2` | Grok 2 | 131K | $2.00 | $10.00 | Previous generation |
| `grok-2-vision` | Grok 2 Vision | 32K | $2.00 | $10.00 | Image understanding |
| `grok-2-mini` | Grok 2 Mini | 131K | $0.20 | $1.00 | Budget option |
| `grok-coder` | Grok Coder | 131K | $1.50 | $7.50 | Code generation |
| `grok-analyst` | Grok Analyst | 131K | $2.00 | $10.00 | Data analysis |
| `grok-embed` | Grok Embed | 8K | $0.10 | - | Text embeddings |
| `grok-realtime` | Grok Realtime | 32K | $5.00 | $20.00 | Voice/streaming |

### xAI Provider Configuration

```typescript
// packages/shared/src/providers/xai.ts

export const XAI_PROVIDER_CONFIG = {
  id: 'xai',
  displayName: 'xAI (Grok)',
  apiBase: 'https://api.x.ai/v1',
  authType: 'api_key',
  authHeader: 'Authorization',
  authPrefix: 'Bearer ',
  
  models: [
    {
      id: 'grok-3',
      displayName: 'Grok 3',
      contextWindow: 131072,
      maxOutputTokens: 8192,
      supportedModalities: ['text'],
      pricing: { inputPer1M: 3.00, outputPer1M: 15.00 },
      capabilities: ['chat', 'reasoning', 'analysis', 'realtime_info'],
      isNovel: false,
    },
    {
      id: 'grok-3-fast',
      displayName: 'Grok 3 Fast',
      contextWindow: 131072,
      maxOutputTokens: 8192,
      supportedModalities: ['text'],
      pricing: { inputPer1M: 1.00, outputPer1M: 5.00 },
      capabilities: ['chat', 'fast_response'],
      isNovel: false,
    },
    {
      id: 'grok-3-mini',
      displayName: 'Grok 3 Mini',
      contextWindow: 131072,
      maxOutputTokens: 4096,
      supportedModalities: ['text'],
      pricing: { inputPer1M: 0.30, outputPer1M: 1.50 },
      capabilities: ['chat', 'cost_effective'],
      isNovel: false,
    },
    {
      id: 'grok-2',
      displayName: 'Grok 2',
      contextWindow: 131072,
      maxOutputTokens: 8192,
      supportedModalities: ['text'],
      pricing: { inputPer1M: 2.00, outputPer1M: 10.00 },
      capabilities: ['chat', 'reasoning'],
      isNovel: false,
    },
    {
      id: 'grok-2-vision',
      displayName: 'Grok 2 Vision',
      contextWindow: 32768,
      maxOutputTokens: 4096,
      supportedModalities: ['text', 'image'],
      pricing: { inputPer1M: 2.00, outputPer1M: 10.00 },
      capabilities: ['chat', 'vision', 'image_analysis'],
      isNovel: true,
    },
    {
      id: 'grok-2-mini',
      displayName: 'Grok 2 Mini',
      contextWindow: 131072,
      maxOutputTokens: 4096,
      supportedModalities: ['text'],
      pricing: { inputPer1M: 0.20, outputPer1M: 1.00 },
      capabilities: ['chat'],
      isNovel: false,
    },
    {
      id: 'grok-coder',
      displayName: 'Grok Coder',
      contextWindow: 131072,
      maxOutputTokens: 8192,
      supportedModalities: ['text'],
      pricing: { inputPer1M: 1.50, outputPer1M: 7.50 },
      capabilities: ['chat', 'code_generation', 'code_review'],
      isNovel: true,
    },
    {
      id: 'grok-analyst',
      displayName: 'Grok Analyst',
      contextWindow: 131072,
      maxOutputTokens: 8192,
      supportedModalities: ['text'],
      pricing: { inputPer1M: 2.00, outputPer1M: 10.00 },
      capabilities: ['chat', 'data_analysis', 'insights'],
      isNovel: true,
    },
    {
      id: 'grok-embed',
      displayName: 'Grok Embed',
      contextWindow: 8192,
      maxOutputTokens: 0,
      supportedModalities: ['text'],
      pricing: { inputPer1M: 0.10, outputPer1M: 0 },
      capabilities: ['embeddings'],
      isNovel: false,
    },
    {
      id: 'grok-realtime',
      displayName: 'Grok Realtime',
      contextWindow: 32768,
      maxOutputTokens: 4096,
      supportedModalities: ['text', 'audio'],
      pricing: { inputPer1M: 5.00, outputPer1M: 20.00 },
      capabilities: ['chat', 'voice', 'streaming', 'realtime'],
      isNovel: true,
    },
  ],
};
```

---

## 30.3 Complete Model Registry

### All External Models (60+)

```typescript
// packages/shared/src/models/registry.ts

export const MODEL_REGISTRY: ModelDefinition[] = [
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ANTHROPIC MODELS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  {
    id: 'claude-4-opus',
    providerId: 'anthropic',
    displayName: 'Claude 4 Opus',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 15.00, outputPer1M: 75.00 },
    capabilities: ['chat', 'reasoning', 'analysis', 'code', 'vision'],
    isNovel: false,
    category: 'flagship',
  },
  {
    id: 'claude-4-sonnet',
    providerId: 'anthropic',
    displayName: 'Claude 4 Sonnet',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 3.00, outputPer1M: 15.00 },
    capabilities: ['chat', 'reasoning', 'analysis', 'code', 'vision'],
    isNovel: false,
    category: 'balanced',
  },
  {
    id: 'claude-3.5-haiku',
    providerId: 'anthropic',
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.25, outputPer1M: 1.25 },
    capabilities: ['chat', 'code'],
    isNovel: false,
    category: 'economy',
  },
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // OPENAI MODELS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  {
    id: 'gpt-4o',
    providerId: 'openai',
    displayName: 'GPT-4o',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    pricing: { inputPer1M: 2.50, outputPer1M: 10.00 },
    capabilities: ['chat', 'reasoning', 'vision', 'audio'],
    isNovel: false,
    category: 'flagship',
  },
  {
    id: 'gpt-4o-mini',
    providerId: 'openai',
    displayName: 'GPT-4o Mini',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    pricing: { inputPer1M: 0.15, outputPer1M: 0.60 },
    capabilities: ['chat', 'vision'],
    isNovel: false,
    category: 'economy',
  },
  {
    id: 'o1',
    providerId: 'openai',
    displayName: 'o1 Reasoning',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    pricing: { inputPer1M: 15.00, outputPer1M: 60.00 },
    capabilities: ['reasoning', 'analysis', 'math', 'code'],
    isNovel: false,
    category: 'specialized',
  },
  {
    id: 'o1-pro',
    providerId: 'openai',
    displayName: 'o1 Pro',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    pricing: { inputPer1M: 150.00, outputPer1M: 600.00 },
    capabilities: ['reasoning', 'analysis', 'math', 'code', 'extended_thinking'],
    isNovel: true,
    category: 'novel',
  },
  {
    id: 'gpt-4o-realtime',
    providerId: 'openai',
    displayName: 'GPT-4o Realtime',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    pricing: { inputPer1M: 5.00, outputPer1M: 20.00 },
    capabilities: ['voice', 'streaming', 'realtime'],
    isNovel: true,
    category: 'novel',
  },
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // GOOGLE MODELS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  {
    id: 'gemini-2.0-pro',
    providerId: 'google',
    displayName: 'Gemini 2.0 Pro',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 1.25, outputPer1M: 5.00 },
    capabilities: ['chat', 'reasoning', 'vision', 'code'],
    isNovel: false,
    category: 'flagship',
  },
  {
    id: 'gemini-2.0-flash',
    providerId: 'google',
    displayName: 'Gemini 2.0 Flash',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.075, outputPer1M: 0.30 },
    capabilities: ['chat', 'vision', 'fast'],
    isNovel: false,
    category: 'balanced',
  },
  {
    id: 'gemini-2.0-ultra',
    providerId: 'google',
    displayName: 'Gemini 2.0 Ultra',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 5.00, outputPer1M: 15.00 },
    capabilities: ['chat', 'reasoning', 'vision', 'multimodal'],
    isNovel: true,
    category: 'novel',
  },
  {
    id: 'gemini-2.0-pro-exp',
    providerId: 'google',
    displayName: 'Gemini Pro Experimental',
    contextWindow: 10000000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 2.50, outputPer1M: 10.00 },
    capabilities: ['chat', 'reasoning', 'massive_context'],
    isNovel: true,
    category: 'novel',
  },
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // XAI/GROK MODELS (from 30.2)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  {
    id: 'grok-3',
    providerId: 'xai',
    displayName: 'Grok 3',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 3.00, outputPer1M: 15.00 },
    capabilities: ['chat', 'reasoning', 'realtime_info'],
    isNovel: false,
    category: 'flagship',
  },
  {
    id: 'grok-3-fast',
    providerId: 'xai',
    displayName: 'Grok 3 Fast',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 1.00, outputPer1M: 5.00 },
    capabilities: ['chat', 'fast'],
    isNovel: false,
    category: 'balanced',
  },
  {
    id: 'grok-3-mini',
    providerId: 'xai',
    displayName: 'Grok 3 Mini',
    contextWindow: 131072,
    maxOutputTokens: 4096,
    pricing: { inputPer1M: 0.30, outputPer1M: 1.50 },
    capabilities: ['chat'],
    isNovel: false,
    category: 'economy',
  },
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DEEPSEEK MODELS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  {
    id: 'deepseek-v3',
    providerId: 'deepseek',
    displayName: 'DeepSeek V3',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.14, outputPer1M: 0.28 },
    capabilities: ['chat', 'code', 'reasoning'],
    isNovel: false,
    category: 'economy',
  },
  {
    id: 'deepseek-r1',
    providerId: 'deepseek',
    displayName: 'DeepSeek R1',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.55, outputPer1M: 2.19 },
    capabilities: ['reasoning', 'chain_of_thought', 'analysis'],
    isNovel: true,
    category: 'novel',
  },
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // MISTRAL MODELS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  {
    id: 'mistral-large-2',
    providerId: 'mistral',
    displayName: 'Mistral Large 2',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 2.00, outputPer1M: 6.00 },
    capabilities: ['chat', 'reasoning', 'multilingual'],
    isNovel: false,
    category: 'specialized',
  },
  {
    id: 'codestral-latest',
    providerId: 'mistral',
    displayName: 'Codestral',
    contextWindow: 32000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.30, outputPer1M: 0.90 },
    capabilities: ['code', 'code_generation', 'code_review'],
    isNovel: false,
    category: 'specialized',
  },
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PERPLEXITY MODELS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  {
    id: 'perplexity-sonar-pro',
    providerId: 'perplexity',
    displayName: 'Sonar Pro',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 3.00, outputPer1M: 15.00 },
    capabilities: ['search', 'chat', 'citations', 'realtime_info'],
    isNovel: false,
    category: 'specialized',
  },
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // NOVEL/EXPERIMENTAL MODELS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  {
    id: 'claude-4-opus-agents',
    providerId: 'anthropic',
    displayName: 'Claude Opus Agents',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 15.00, outputPer1M: 75.00 },
    capabilities: ['chat', 'tool_use', 'computer_use', 'agents'],
    isNovel: true,
    category: 'novel',
  },
  {
    id: 'qwen-2.5-coder',
    providerId: 'together',
    displayName: 'Qwen 2.5 Coder',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.30, outputPer1M: 0.90 },
    capabilities: ['code', 'code_generation'],
    isNovel: true,
    category: 'novel',
  },
  {
    id: 'llama-3.3-70b',
    providerId: 'together',
    displayName: 'Llama 3.3 70B',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    pricing: { inputPer1M: 0.88, outputPer1M: 0.88 },
    capabilities: ['chat', 'reasoning', 'open_weights'],
    isNovel: true,
    category: 'novel',
  },
  {
    id: 'phi-4',
    providerId: 'azure_openai',
    displayName: 'Phi-4',
    contextWindow: 16000,
    maxOutputTokens: 4096,
    pricing: { inputPer1M: 0.07, outputPer1M: 0.14 },
    capabilities: ['chat', 'reasoning', 'efficient'],
    isNovel: true,
    category: 'novel',
  },
];
```

---

## 30.4 Provider Sync Lambda

```typescript
// packages/lambdas/src/handlers/admin/sync-providers.ts

import { ScheduledHandler } from 'aws-lambda';
import { Pool } from 'pg';
import { MODEL_REGISTRY } from '@radiant/shared';
import { createLogger } from '@radiant/shared';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const logger = createLogger('provider-sync');

export const handler: ScheduledHandler = async () => {
  logger.info('Starting provider/model sync');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Sync all models from registry
    for (const model of MODEL_REGISTRY) {
      await client.query(`
        INSERT INTO models (
          id, provider_id, display_name, model_type, context_window,
          max_output_tokens, pricing, capabilities, is_novel, category,
          is_enabled, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, NOW())
        ON CONFLICT (id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          context_window = EXCLUDED.context_window,
          max_output_tokens = EXCLUDED.max_output_tokens,
          capabilities = EXCLUDED.capabilities,
          is_novel = EXCLUDED.is_novel,
          category = EXCLUDED.category,
          updated_at = NOW()
        -- Note: pricing is NOT updated to preserve admin overrides
      `, [
        model.id,
        model.providerId,
        model.displayName,
        'chat',
        model.contextWindow,
        model.maxOutputTokens,
        JSON.stringify(model.pricing),
        JSON.stringify(model.capabilities),
        model.isNovel || false,
        model.category || 'general',
      ]);
    }
    
    await client.query('COMMIT');
    logger.info(`Synced ${MODEL_REGISTRY.length} models`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Sync failed', { error });
    throw error;
  } finally {
    client.release();
  }
};
```



# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 31: THINK TANK MODEL SELECTION & EDITABLE PRICING (v3.8.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **NEW in v3.8.0**: Users can now manually select AI models in Think Tank.
> All pricing is admin-editable with bulk controls and individual overrides.

---

## 31.1 Model Categories for Think Tank

### Standard Models (15) - Production-Ready

| ID | Display Name | Provider | Context | Input $/1M | Output $/1M | Best For |
|----|--------------|----------|---------|------------|-------------|----------|
| `claude-4-opus` | Claude 4 Opus | Anthropic | 200K | $15.00 | $75.00 | Complex reasoning, analysis |
| `claude-4-sonnet` | Claude 4 Sonnet | Anthropic | 200K | $3.00 | $15.00 | Quality/cost balance |
| `claude-3.5-haiku` | Claude 3.5 Haiku | Anthropic | 200K | $0.25 | $1.25 | Fast responses |
| `gpt-4o` | GPT-4o | OpenAI | 128K | $2.50 | $10.00 | Multimodal, reliable |
| `gpt-4o-mini` | GPT-4o Mini | OpenAI | 128K | $0.15 | $0.60 | Cost-effective |
| `o1` | o1 Reasoning | OpenAI | 200K | $15.00 | $60.00 | Multi-step reasoning |
| `gemini-2.0-pro` | Gemini 2.0 Pro | Google | 2M | $1.25 | $5.00 | Massive context |
| `gemini-2.0-flash` | Gemini 2.0 Flash | Google | 1M | $0.075 | $0.30 | Speed, large context |
| `grok-3` | Grok 3 | xAI | 131K | $3.00 | $15.00 | Real-time info |
| `grok-3-fast` | Grok 3 Fast | xAI | 131K | $1.00 | $5.00 | Quick responses |
| `grok-3-mini` | Grok 3 Mini | xAI | 131K | $0.30 | $1.50 | Budget Grok |
| `deepseek-v3` | DeepSeek V3 | DeepSeek | 64K | $0.14 | $0.28 | Extremely low cost |
| `mistral-large-2` | Mistral Large 2 | Mistral | 128K | $2.00 | $6.00 | Multilingual |
| `codestral-latest` | Codestral | Mistral | 32K | $0.30 | $0.90 | Code generation |
| `perplexity-sonar-pro` | Sonar Pro | Perplexity | 128K | $3.00 | $15.00 | Web search |

### Novel Models (15) - Cutting-Edge/Experimental

| ID | Display Name | Provider | Context | Input $/1M | Output $/1M | Novel Feature |
|----|--------------|----------|---------|------------|-------------|---------------|
| `o1-pro` | o1 Pro | OpenAI | 200K | $150.00 | $600.00 | Extended reasoning chains |
| `deepseek-r1` | DeepSeek R1 | DeepSeek | 64K | $0.55 | $2.19 | Open reasoning model |
| `gemini-2.0-ultra` | Gemini 2.0 Ultra | Google | 2M | $5.00 | $15.00 | Native multimodal |
| `gemini-2.0-pro-exp` | Gemini Pro Exp | Google | 10M | $2.50 | $10.00 | 10M token context |
| `grok-2-vision` | Grok 2 Vision | xAI | 32K | $2.00 | $10.00 | Image understanding |
| `grok-realtime` | Grok Realtime | xAI | 32K | $5.00 | $20.00 | Live streaming |
| `grok-coder` | Grok Coder | xAI | 131K | $1.50 | $7.50 | Specialized code gen |
| `grok-analyst` | Grok Analyst | xAI | 131K | $2.00 | $10.00 | Data analysis |
| `gpt-4o-realtime` | GPT-4o Realtime | OpenAI | 128K | $5.00 | $20.00 | Voice/video streaming |
| `claude-4-opus-agents` | Claude Opus Agents | Anthropic | 200K | $15.00 | $75.00 | Tool use, computer use |
| `qwen-2.5-coder` | Qwen 2.5 Coder | Together | 128K | $0.30 | $0.90 | Open-source code |
| `llama-3.3-70b` | Llama 3.3 70B | Together | 128K | $0.88 | $0.88 | Open weights |
| `phi-4` | Phi-4 | Microsoft | 16K | $0.07 | $0.14 | Small but capable |
| `grok-embed` | Grok Embed | xAI | 8K | $0.10 | - | Text embeddings |
| `command-r-plus` | Command R+ | Cohere | 128K | $2.50 | $10.00 | RAG optimized |

---

## 31.2 Database Schema for Model Selection

```sql
-- Migration: 20241223_031_thinktank_model_selection.sql

-- Add model categorization columns
ALTER TABLE models ADD COLUMN IF NOT EXISTS is_novel BOOLEAN DEFAULT FALSE;
ALTER TABLE models ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';
ALTER TABLE models ADD COLUMN IF NOT EXISTS thinktank_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE models ADD COLUMN IF NOT EXISTS thinktank_display_order INTEGER DEFAULT 100;

-- User model preferences for Think Tank
CREATE TABLE IF NOT EXISTS thinktank_user_model_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES thinktank_users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Selection Mode: 'auto' | 'manual' | 'favorites'
    selection_mode VARCHAR(20) NOT NULL DEFAULT 'auto',
    
    -- Default Model (when manual mode)
    default_model_id VARCHAR(100),
    
    -- Favorite Models (JSON array of model IDs)
    favorite_models JSONB DEFAULT '[]'::JSONB,
    
    -- Category Preferences
    show_standard_models BOOLEAN DEFAULT TRUE,
    show_novel_models BOOLEAN DEFAULT TRUE,
    show_self_hosted_models BOOLEAN DEFAULT FALSE,
    
    -- Cost Preferences
    show_cost_per_message BOOLEAN DEFAULT TRUE,
    max_cost_per_message DECIMAL(10, 6), -- NULL = no limit
    prefer_cost_optimization BOOLEAN DEFAULT FALSE,
    
    -- Domain Mode Model Overrides
    -- Example: {"medical": "claude-4-opus", "code": "codestral-latest"}
    domain_mode_model_overrides JSONB DEFAULT '{}'::JSONB,
    
    -- Recent Models (for quick access)
    recent_models JSONB DEFAULT '[]'::JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX idx_thinktank_model_prefs_user ON thinktank_user_model_preferences(user_id);
CREATE INDEX idx_thinktank_model_prefs_tenant ON thinktank_user_model_preferences(tenant_id);

-- Trigger for updated_at
CREATE TRIGGER update_thinktank_model_prefs_timestamp
    BEFORE UPDATE ON thinktank_user_model_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## 31.3 Admin Editable Pricing Schema

```sql
-- Migration: 20241223_032_editable_pricing.sql

-- Pricing configuration table (admin-editable)
CREATE TABLE IF NOT EXISTS pricing_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Global Markup Defaults
    external_default_markup DECIMAL(5, 4) DEFAULT 0.40,     -- 40%
    self_hosted_default_markup DECIMAL(5, 4) DEFAULT 0.75, -- 75%
    
    -- Minimum Charges
    minimum_charge_per_request DECIMAL(10, 6) DEFAULT 0.001,
    
    -- Grace Period for Price Increases (hours)
    price_increase_grace_period_hours INTEGER DEFAULT 24,
    
    -- Auto-Update Settings
    auto_update_from_providers BOOLEAN DEFAULT TRUE,
    auto_update_frequency VARCHAR(20) DEFAULT 'daily', -- 'hourly', 'daily', 'weekly'
    last_auto_update TIMESTAMPTZ,
    
    -- Notification Settings
    notify_on_price_change BOOLEAN DEFAULT TRUE,
    notify_threshold_percent DECIMAL(5, 2) DEFAULT 10.00, -- Notify if price changes >10%
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

-- Model-specific pricing overrides (admin-editable per model)
CREATE TABLE IF NOT EXISTS model_pricing_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id VARCHAR(100) NOT NULL,
    
    -- Override Values (NULL = use defaults)
    markup_override DECIMAL(5, 4),           -- Override markup percentage
    input_price_override DECIMAL(12, 6),     -- Override input price per 1M tokens
    output_price_override DECIMAL(12, 6),    -- Override output price per 1M tokens
    
    -- Effective Dates (for scheduled price changes)
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    
    -- Audit
    created_by UUID REFERENCES administrators(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, model_id, effective_from)
);

CREATE INDEX idx_pricing_overrides_tenant ON model_pricing_overrides(tenant_id);
CREATE INDEX idx_pricing_overrides_model ON model_pricing_overrides(model_id);
CREATE INDEX idx_pricing_overrides_effective ON model_pricing_overrides(effective_from, effective_to);

-- Price history for auditing
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    model_id VARCHAR(100) NOT NULL,
    
    -- Previous Values
    previous_input_price DECIMAL(12, 6),
    previous_output_price DECIMAL(12, 6),
    previous_markup DECIMAL(5, 4),
    
    -- New Values
    new_input_price DECIMAL(12, 6),
    new_output_price DECIMAL(12, 6),
    new_markup DECIMAL(5, 4),
    
    -- Change Source
    change_source VARCHAR(50), -- 'admin', 'auto_sync', 'bulk_update'
    changed_by UUID REFERENCES administrators(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_history_tenant_model ON price_history(tenant_id, model_id);
CREATE INDEX idx_price_history_date ON price_history(created_at);

-- View for effective pricing (combines base + overrides)
CREATE OR REPLACE VIEW effective_model_pricing AS
SELECT 
    m.id AS model_id,
    m.display_name,
    m.provider_id,
    m.is_novel,
    m.category,
    m.thinktank_enabled,
    
    -- Base Prices
    COALESCE(m.pricing->>'input_tokens', '0')::DECIMAL AS base_input_price,
    COALESCE(m.pricing->>'output_tokens', '0')::DECIMAL AS base_output_price,
    
    -- Effective Markup (override > category default > global default)
    COALESCE(
        mpo.markup_override,
        CASE 
            WHEN m.provider_id = 'self_hosted' THEN pc.self_hosted_default_markup
            ELSE pc.external_default_markup
        END,
        0.40
    ) AS effective_markup,
    
    -- Final User Prices (with markup)
    ROUND(
        COALESCE(mpo.input_price_override, COALESCE(m.pricing->>'input_tokens', '0')::DECIMAL) *
        (1 + COALESCE(mpo.markup_override, 
            CASE WHEN m.provider_id = 'self_hosted' THEN pc.self_hosted_default_markup ELSE pc.external_default_markup END,
            0.40)),
        6
    ) AS user_input_price,
    
    ROUND(
        COALESCE(mpo.output_price_override, COALESCE(m.pricing->>'output_tokens', '0')::DECIMAL) *
        (1 + COALESCE(mpo.markup_override,
            CASE WHEN m.provider_id = 'self_hosted' THEN pc.self_hosted_default_markup ELSE pc.external_default_markup END,
            0.40)),
        6
    ) AS user_output_price,
    
    -- Override Status
    mpo.id IS NOT NULL AS has_override,
    mpo.effective_from,
    mpo.effective_to
    
FROM models m
LEFT JOIN pricing_config pc ON TRUE
LEFT JOIN model_pricing_overrides mpo ON m.id = mpo.model_id 
    AND (mpo.effective_from <= NOW() OR mpo.effective_from IS NULL)
    AND (mpo.effective_to > NOW() OR mpo.effective_to IS NULL);
```


---

## 31.4 Admin Pricing Dashboard

```typescript
// apps/admin-dashboard/src/app/(dashboard)/models/pricing/page.tsx

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Save, RefreshCw, DollarSign, Percent, History, Edit2 } from 'lucide-react';

interface PricingConfig {
  externalDefaultMarkup: number;
  selfHostedDefaultMarkup: number;
  minimumChargePerRequest: number;
  priceIncreaseGracePeriodHours: number;
  autoUpdateFromProviders: boolean;
  autoUpdateFrequency: 'hourly' | 'daily' | 'weekly';
  notifyOnPriceChange: boolean;
  notifyThresholdPercent: number;
}

interface ModelPricing {
  modelId: string;
  displayName: string;
  providerId: string;
  isNovel: boolean;
  category: string;
  baseInputPrice: number;
  baseOutputPrice: number;
  effectiveMarkup: number;
  userInputPrice: number;
  userOutputPrice: number;
  hasOverride: boolean;
}

export default function ModelPricingPage() {
  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState<ModelPricing | null>(null);
  const [bulkMarkup, setBulkMarkup] = useState({ external: 40, selfHosted: 75 });

  // Fetch pricing config
  const { data: config, isLoading: configLoading } = useQuery<PricingConfig>({
    queryKey: ['pricing-config'],
    queryFn: () => fetch('/api/admin/pricing/config').then(r => r.json()),
  });

  // Fetch all model pricing
  const { data: models, isLoading: modelsLoading } = useQuery<ModelPricing[]>({
    queryKey: ['model-pricing'],
    queryFn: () => fetch('/api/admin/pricing/models').then(r => r.json()),
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: (data: Partial<PricingConfig>) =>
      fetch('/api/admin/pricing/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-config'] });
      toast.success('Pricing configuration updated');
    },
  });

  // Bulk update markup mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: (data: { type: 'external' | 'self_hosted'; markup: number }) =>
      fetch('/api/admin/pricing/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['model-pricing'] });
      toast.success(`All ${variables.type === 'external' ? 'external' : 'self-hosted'} models updated to ${variables.markup}% markup`);
    },
  });

  // Individual model override mutation
  const overrideMutation = useMutation({
    mutationFn: (data: { modelId: string; markup?: number; inputPrice?: number; outputPrice?: number }) =>
      fetch(`/api/admin/pricing/models/${data.modelId}/override`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-pricing'] });
      setSelectedModel(null);
      toast.success('Model pricing override saved');
    },
  });

  // Clear override mutation
  const clearOverrideMutation = useMutation({
    mutationFn: (modelId: string) =>
      fetch(`/api/admin/pricing/models/${modelId}/override`, {
        method: 'DELETE',
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-pricing'] });
      toast.success('Pricing override removed');
    },
  });

  const [localConfig, setLocalConfig] = useState<Partial<PricingConfig>>(config || {});

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Model Pricing</h1>
          <p className="text-muted-foreground">
            Configure pricing markups and overrides for all AI models
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => updateConfigMutation.mutate(localConfig)}>
            <Save className="h-4 w-4 mr-2" />
            Save Config
          </Button>
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Global Configuration</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Updates</TabsTrigger>
          <TabsTrigger value="models">Individual Models</TabsTrigger>
          <TabsTrigger value="history">Price History</TabsTrigger>
        </TabsList>

        {/* Global Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Default Markups
                </CardTitle>
                <CardDescription>
                  Global markup percentages applied to all models
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>External Provider Markup</Label>
                    <span className="font-mono text-sm">
                      {((localConfig.externalDefaultMarkup || config?.externalDefaultMarkup || 0.40) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[(localConfig.externalDefaultMarkup || config?.externalDefaultMarkup || 0.40) * 100]}
                    min={0}
                    max={200}
                    step={5}
                    onValueChange={([value]) =>
                      setLocalConfig({ ...localConfig, externalDefaultMarkup: value / 100 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Applied to OpenAI, Anthropic, Google, xAI, Mistral, etc.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Self-Hosted Model Markup</Label>
                    <span className="font-mono text-sm">
                      {((localConfig.selfHostedDefaultMarkup || config?.selfHostedDefaultMarkup || 0.75) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[(localConfig.selfHostedDefaultMarkup || config?.selfHostedDefaultMarkup || 0.75) * 100]}
                    min={0}
                    max={300}
                    step={5}
                    onValueChange={([value]) =>
                      setLocalConfig({ ...localConfig, selfHostedDefaultMarkup: value / 100 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Applied to SageMaker-hosted models (covers compute costs)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Pricing Rules
                </CardTitle>
                <CardDescription>
                  Additional pricing configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Minimum Charge Per Request ($)</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={localConfig.minimumChargePerRequest || config?.minimumChargePerRequest || 0.001}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, minimumChargePerRequest: parseFloat(e.target.value) })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Price Increase Grace Period (hours)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={168}
                    value={localConfig.priceIncreaseGracePeriodHours || config?.priceIncreaseGracePeriodHours || 24}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, priceIncreaseGracePeriodHours: parseInt(e.target.value) })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Delay before price increases take effect
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Update from Providers</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically sync base prices from provider APIs
                    </p>
                  </div>
                  <Switch
                    checked={localConfig.autoUpdateFromProviders ?? config?.autoUpdateFromProviders ?? true}
                    onCheckedChange={(checked) =>
                      setLocalConfig({ ...localConfig, autoUpdateFromProviders: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notify on Price Changes</Label>
                    <p className="text-xs text-muted-foreground">
                      Alert when provider prices change significantly
                    </p>
                  </div>
                  <Switch
                    checked={localConfig.notifyOnPriceChange ?? config?.notifyOnPriceChange ?? true}
                    onCheckedChange={(checked) =>
                      setLocalConfig({ ...localConfig, notifyOnPriceChange: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bulk Updates Tab */}
        <TabsContent value="bulk" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>External Providers</CardTitle>
                <CardDescription>
                  Update markup for all external AI providers at once
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Markup Percentage</Label>
                    <span className="font-mono text-sm">{bulkMarkup.external}%</span>
                  </div>
                  <Slider
                    value={[bulkMarkup.external]}
                    min={0}
                    max={200}
                    step={5}
                    onValueChange={([value]) => setBulkMarkup({ ...bulkMarkup, external: value })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => bulkUpdateMutation.mutate({ type: 'external', markup: bulkMarkup.external })}
                  disabled={bulkUpdateMutation.isPending}
                >
                  Apply to All External Models
                </Button>
                <p className="text-xs text-muted-foreground">
                  Affects: OpenAI, Anthropic, Google, xAI, Mistral, Perplexity, DeepSeek, Cohere, etc.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Self-Hosted Models</CardTitle>
                <CardDescription>
                  Update markup for all SageMaker-hosted models at once
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Markup Percentage</Label>
                    <span className="font-mono text-sm">{bulkMarkup.selfHosted}%</span>
                  </div>
                  <Slider
                    value={[bulkMarkup.selfHosted]}
                    min={0}
                    max={300}
                    step={5}
                    onValueChange={([value]) => setBulkMarkup({ ...bulkMarkup, selfHosted: value })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => bulkUpdateMutation.mutate({ type: 'self_hosted', markup: bulkMarkup.selfHosted })}
                  disabled={bulkUpdateMutation.isPending}
                >
                  Apply to All Self-Hosted Models
                </Button>
                <p className="text-xs text-muted-foreground">
                  Affects: Stable Diffusion, Whisper, SAM 2, YOLO, MusicGen, etc.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Individual Models Tab */}
        <TabsContent value="models">
          <Card>
            <CardHeader>
              <CardTitle>Model Pricing Details</CardTitle>
              <CardDescription>
                View and override pricing for individual models
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Base Input</TableHead>
                    <TableHead className="text-right">Base Output</TableHead>
                    <TableHead className="text-right">Markup</TableHead>
                    <TableHead className="text-right">User Input</TableHead>
                    <TableHead className="text-right">User Output</TableHead>
                    <TableHead>Override</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(models || []).map((model) => (
                    <TableRow key={model.modelId}>
                      <TableCell>
                        <div className="font-medium">{model.displayName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{model.modelId}</div>
                      </TableCell>
                      <TableCell>{model.providerId}</TableCell>
                      <TableCell>
                        <Badge variant={model.isNovel ? 'secondary' : 'outline'}>
                          {model.isNovel ? 'Novel' : 'Standard'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${model.baseInputPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${model.baseOutputPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(model.effectiveMarkup * 100).toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        ${model.userInputPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        ${model.userOutputPrice.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {model.hasOverride ? (
                          <Badge variant="default">Custom</Badge>
                        ) : (
                          <Badge variant="outline">Default</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedModel(model)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Pricing: {model.displayName}</DialogTitle>
                            </DialogHeader>
                            <ModelPricingEditor
                              model={model}
                              onSave={(data) => overrideMutation.mutate({ modelId: model.modelId, ...data })}
                              onClear={() => clearOverrideMutation.mutate(model.modelId)}
                            />
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Price History Tab */}
        <TabsContent value="history">
          <PriceHistoryTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Model Pricing Editor Component
function ModelPricingEditor({ 
  model, 
  onSave, 
  onClear 
}: { 
  model: ModelPricing; 
  onSave: (data: any) => void;
  onClear: () => void;
}) {
  const [markup, setMarkup] = useState(model.effectiveMarkup * 100);
  const [inputPrice, setInputPrice] = useState<number | null>(null);
  const [outputPrice, setOutputPrice] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Custom Markup (%)</Label>
        <div className="flex items-center gap-4">
          <Slider
            value={[markup]}
            min={0}
            max={200}
            step={5}
            onValueChange={([value]) => setMarkup(value)}
            className="flex-1"
          />
          <span className="font-mono w-16 text-right">{markup}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Override Input Price ($/1M tokens)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder={`Default: $${model.baseInputPrice.toFixed(2)}`}
            value={inputPrice ?? ''}
            onChange={(e) => setInputPrice(e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
        <div className="space-y-2">
          <Label>Override Output Price ($/1M tokens)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder={`Default: $${model.baseOutputPrice.toFixed(2)}`}
            value={outputPrice ?? ''}
            onChange={(e) => setOutputPrice(e.target.value ? parseFloat(e.target.value) : null)}
          />
        </div>
      </div>

      <div className="bg-muted p-3 rounded-lg">
        <div className="text-sm font-medium mb-2">Preview User Prices</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            Input: <span className="font-mono text-green-600">
              ${((inputPrice ?? model.baseInputPrice) * (1 + markup / 100)).toFixed(2)}/1M
            </span>
          </div>
          <div>
            Output: <span className="font-mono text-green-600">
              ${((outputPrice ?? model.baseOutputPrice) * (1 + markup / 100)).toFixed(2)}/1M
            </span>
          </div>
        </div>
      </div>

      <DialogFooter className="flex justify-between">
        {model.hasOverride && (
          <Button variant="outline" onClick={onClear}>
            Clear Override
          </Button>
        )}
        <Button onClick={() => onSave({ markup: markup / 100, inputPrice, outputPrice })}>
          Save Override
        </Button>
      </DialogFooter>
    </div>
  );
}

// Price History Table Component
function PriceHistoryTable() {
  const { data: history } = useQuery({
    queryKey: ['price-history'],
    queryFn: () => fetch('/api/admin/pricing/history?limit=100').then(r => r.json()),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Price Change History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Change Type</TableHead>
              <TableHead className="text-right">Previous</TableHead>
              <TableHead className="text-right">New</TableHead>
              <TableHead>Changed By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(history || []).map((entry: any) => (
              <TableRow key={entry.id}>
                <TableCell className="text-sm">
                  {new Date(entry.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="font-mono text-sm">{entry.modelId}</TableCell>
                <TableCell>
                  <Badge variant="outline">{entry.changeSource}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {entry.previousMarkup ? `${(entry.previousMarkup * 100).toFixed(0)}%` : '-'}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {entry.newMarkup ? `${(entry.newMarkup * 100).toFixed(0)}%` : '-'}
                </TableCell>
                <TableCell className="text-sm">{entry.changedByEmail || 'System'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```


---

## 31.5 Think Tank Model Selection UI

```typescript
// apps/thinktank/src/components/chat/model-selector.tsx

'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Popover, PopoverContent, PopoverTrigger
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  ChevronDown, Search, Star, StarOff, Sparkles, Zap, 
  DollarSign, Brain, Check, Settings2 
} from 'lucide-react';

interface Model {
  id: string;
  displayName: string;
  providerId: string;
  providerName: string;
  isNovel: boolean;
  category: string;
  contextWindow: number;
  capabilities: string[];
  userInputPrice: number;
  userOutputPrice: number;
  isFavorite?: boolean;
}

interface ModelPreferences {
  selectionMode: 'auto' | 'manual' | 'favorites';
  defaultModelId?: string;
  favoriteModels: string[];
  showStandardModels: boolean;
  showNovelModels: boolean;
  showCostPerMessage: boolean;
  maxCostPerMessage?: number;
}

interface ModelSelectorProps {
  selectedModel: string | null; // null = Auto
  onModelChange: (modelId: string | null) => void;
  disabled?: boolean;
}

export function ModelSelector({ selectedModel, onModelChange, disabled }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  // Fetch available models
  const { data: models = [] } = useQuery<Model[]>({
    queryKey: ['thinktank-models'],
    queryFn: () => fetch('/api/thinktank/models').then(r => r.json()),
  });

  // Fetch user preferences
  const { data: preferences } = useQuery<ModelPreferences>({
    queryKey: ['thinktank-model-preferences'],
    queryFn: () => fetch('/api/thinktank/preferences/models').then(r => r.json()),
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: (modelId: string) =>
      fetch('/api/thinktank/preferences/models/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinktank-model-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['thinktank-models'] });
    },
  });

  // Filter and group models
  const { standardModels, novelModels, favoriteModels } = useMemo(() => {
    const filtered = models.filter(m => 
      m.displayName.toLowerCase().includes(search.toLowerCase()) ||
      m.providerId.toLowerCase().includes(search.toLowerCase())
    );

    return {
      standardModels: filtered.filter(m => !m.isNovel && preferences?.showStandardModels !== false),
      novelModels: filtered.filter(m => m.isNovel && preferences?.showNovelModels !== false),
      favoriteModels: filtered.filter(m => preferences?.favoriteModels?.includes(m.id)),
    };
  }, [models, search, preferences]);

  // Get selected model details
  const selectedModelDetails = selectedModel 
    ? models.find(m => m.id === selectedModel) 
    : null;

  // Format price for display
  const formatPrice = (inputPrice: number, outputPrice: number) => {
    const avgPrice = (inputPrice + outputPrice) / 2;
    if (avgPrice < 1) return `$${avgPrice.toFixed(3)}/1K`;
    return `$${avgPrice.toFixed(2)}/1M`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="justify-between min-w-[200px]"
        >
          <div className="flex items-center gap-2">
            {selectedModel === null ? (
              <>
                <Brain className="h-4 w-4 text-purple-500" />
                <span>Auto</span>
                <Badge variant="secondary" className="text-xs">RADIANT Brain</Badge>
              </>
            ) : (
              <>
                {selectedModelDetails?.isNovel && <Sparkles className="h-4 w-4 text-amber-500" />}
                <span>{selectedModelDetails?.displayName || selectedModel}</span>
                {preferences?.showCostPerMessage && selectedModelDetails && (
                  <span className="text-xs text-muted-foreground">
                    {formatPrice(selectedModelDetails.userInputPrice, selectedModelDetails.userOutputPrice)}
                  </span>
                )}
              </>
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="all" className="rounded-none data-[state=active]:border-b-2">
              All
            </TabsTrigger>
            <TabsTrigger value="favorites" className="rounded-none data-[state=active]:border-b-2">
              <Star className="h-3 w-3 mr-1" />
              Favorites
            </TabsTrigger>
            <TabsTrigger value="standard" className="rounded-none data-[state=active]:border-b-2">
              Standard
            </TabsTrigger>
            <TabsTrigger value="novel" className="rounded-none data-[state=active]:border-b-2">
              <Sparkles className="h-3 w-3 mr-1" />
              Novel
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[300px]">
            {/* Auto Option */}
            <div className="p-1">
              <ModelOption
                model={null}
                isSelected={selectedModel === null}
                onSelect={() => {
                  onModelChange(null);
                  setOpen(false);
                }}
                showCost={false}
              />
            </div>

            <TabsContent value="all" className="m-0 p-1">
              {favoriteModels.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Favorites</div>
                  {favoriteModels.map(model => (
                    <ModelOption
                      key={model.id}
                      model={model}
                      isSelected={selectedModel === model.id}
                      isFavorite={true}
                      onSelect={() => {
                        onModelChange(model.id);
                        setOpen(false);
                      }}
                      onToggleFavorite={() => toggleFavoriteMutation.mutate(model.id)}
                      showCost={preferences?.showCostPerMessage}
                    />
                  ))}
                </div>
              )}
              
              {standardModels.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Standard Models</div>
                  {standardModels.map(model => (
                    <ModelOption
                      key={model.id}
                      model={model}
                      isSelected={selectedModel === model.id}
                      isFavorite={preferences?.favoriteModels?.includes(model.id)}
                      onSelect={() => {
                        onModelChange(model.id);
                        setOpen(false);
                      }}
                      onToggleFavorite={() => toggleFavoriteMutation.mutate(model.id)}
                      showCost={preferences?.showCostPerMessage}
                    />
                  ))}
                </div>
              )}

              {novelModels.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Novel / Experimental
                  </div>
                  {novelModels.map(model => (
                    <ModelOption
                      key={model.id}
                      model={model}
                      isSelected={selectedModel === model.id}
                      isFavorite={preferences?.favoriteModels?.includes(model.id)}
                      onSelect={() => {
                        onModelChange(model.id);
                        setOpen(false);
                      }}
                      onToggleFavorite={() => toggleFavoriteMutation.mutate(model.id)}
                      showCost={preferences?.showCostPerMessage}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="favorites" className="m-0 p-1">
              {favoriteModels.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No favorite models yet. Star models to add them here.
                </div>
              ) : (
                favoriteModels.map(model => (
                  <ModelOption
                    key={model.id}
                    model={model}
                    isSelected={selectedModel === model.id}
                    isFavorite={true}
                    onSelect={() => {
                      onModelChange(model.id);
                      setOpen(false);
                    }}
                    onToggleFavorite={() => toggleFavoriteMutation.mutate(model.id)}
                    showCost={preferences?.showCostPerMessage}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="standard" className="m-0 p-1">
              {standardModels.map(model => (
                <ModelOption
                  key={model.id}
                  model={model}
                  isSelected={selectedModel === model.id}
                  isFavorite={preferences?.favoriteModels?.includes(model.id)}
                  onSelect={() => {
                    onModelChange(model.id);
                    setOpen(false);
                  }}
                  onToggleFavorite={() => toggleFavoriteMutation.mutate(model.id)}
                  showCost={preferences?.showCostPerMessage}
                />
              ))}
            </TabsContent>

            <TabsContent value="novel" className="m-0 p-1">
              {novelModels.map(model => (
                <ModelOption
                  key={model.id}
                  model={model}
                  isSelected={selectedModel === model.id}
                  isFavorite={preferences?.favoriteModels?.includes(model.id)}
                  onSelect={() => {
                    onModelChange(model.id);
                    setOpen(false);
                  }}
                  onToggleFavorite={() => toggleFavoriteMutation.mutate(model.id)}
                  showCost={preferences?.showCostPerMessage}
                />
              ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Settings Footer */}
        <div className="border-t p-2 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            <span>Prices per 1M tokens</span>
          </div>
          <Button variant="ghost" size="sm" className="text-xs">
            <Settings2 className="h-3 w-3 mr-1" />
            Preferences
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Individual Model Option Component
function ModelOption({
  model,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
  showCost,
}: {
  model: Model | null;
  isSelected: boolean;
  isFavorite?: boolean;
  onSelect: () => void;
  onToggleFavorite?: () => void;
  showCost?: boolean;
}) {
  // Auto option
  if (model === null) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent",
          isSelected && "bg-accent"
        )}
        onClick={onSelect}
      >
        <Brain className="h-5 w-5 text-purple-500" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">Auto</span>
            <Badge variant="secondary" className="text-xs">RADIANT Brain</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Intelligently selects the best model for your task
          </div>
        </div>
        {isSelected && <Check className="h-4 w-4 text-primary" />}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-accent group",
        isSelected && "bg-accent"
      )}
      onClick={onSelect}
    >
      <div className="flex-shrink-0">
        {model.isNovel ? (
          <Sparkles className="h-5 w-5 text-amber-500" />
        ) : (
          <Zap className="h-5 w-5 text-blue-500" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{model.displayName}</span>
          {model.isNovel && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
              Novel
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{model.providerName}</span>
          <span>â€¢</span>
          <span>{(model.contextWindow / 1000).toFixed(0)}K context</span>
          {showCost && (
            <>
              <span>â€¢</span>
              <span className="text-green-600">
                ${((model.userInputPrice + model.userOutputPrice) / 2).toFixed(2)}/1M
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {onToggleFavorite && (
          <button
            className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
          >
            {isFavorite ? (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            ) : (
              <StarOff className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        )}
        {isSelected && <Check className="h-4 w-4 text-primary" />}
      </div>
    </div>
  );
}
```


---

## 31.6 Think Tank Model API Endpoints

```typescript
// packages/lambdas/src/handlers/thinktank/models.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { createLogger, corsHeaders } from '@radiant/shared';
import { verifyJWT, getUserFromToken } from '../auth/jwt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const logger = createLogger('thinktank-models');

// GET /api/thinktank/models - List available models for Think Tank users
export async function listModels(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = await getUserFromToken(event);
    const client = await pool.connect();

    try {
      // Get models with effective pricing and user favorites
      const result = await client.query(`
        SELECT 
          m.id,
          m.display_name,
          m.provider_id,
          p.display_name as provider_name,
          m.is_novel,
          m.category,
          m.context_window,
          m.capabilities,
          m.thinktank_enabled,
          
          -- Effective pricing (from view)
          emp.user_input_price,
          emp.user_output_price,
          emp.effective_markup,
          
          -- User favorites
          $1 = ANY(COALESCE(ump.favorite_models, '[]')::text[]) as is_favorite
          
        FROM models m
        JOIN providers p ON m.provider_id = p.id
        LEFT JOIN effective_model_pricing emp ON m.id = emp.model_id
        LEFT JOIN thinktank_user_model_preferences ump ON ump.user_id = $2
        
        WHERE m.thinktank_enabled = true
          AND m.is_enabled = true
          AND m.status = 'active'
          
        ORDER BY 
          m.is_novel ASC,
          m.thinktank_display_order ASC,
          m.display_name ASC
      `, [user.id, user.id]);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.rows.map(row => ({
          id: row.id,
          displayName: row.display_name,
          providerId: row.provider_id,
          providerName: row.provider_name,
          isNovel: row.is_novel,
          category: row.category,
          contextWindow: row.context_window,
          capabilities: row.capabilities || [],
          userInputPrice: parseFloat(row.user_input_price) || 0,
          userOutputPrice: parseFloat(row.user_output_price) || 0,
          isFavorite: row.is_favorite,
        }))),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to list models', { error });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load models' }),
    };
  }
}

// GET /api/thinktank/preferences/models - Get user's model preferences
export async function getModelPreferences(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = await getUserFromToken(event);
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT 
          selection_mode,
          default_model_id,
          favorite_models,
          show_standard_models,
          show_novel_models,
          show_self_hosted_models,
          show_cost_per_message,
          max_cost_per_message,
          prefer_cost_optimization,
          domain_mode_model_overrides,
          recent_models
        FROM thinktank_user_model_preferences
        WHERE user_id = $1
      `, [user.id]);

      if (result.rows.length === 0) {
        // Return defaults
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            selectionMode: 'auto',
            defaultModelId: null,
            favoriteModels: [],
            showStandardModels: true,
            showNovelModels: true,
            showSelfHostedModels: false,
            showCostPerMessage: true,
            maxCostPerMessage: null,
            preferCostOptimization: false,
            domainModeModelOverrides: {},
            recentModels: [],
          }),
        };
      }

      const row = result.rows[0];
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          selectionMode: row.selection_mode,
          defaultModelId: row.default_model_id,
          favoriteModels: row.favorite_models || [],
          showStandardModels: row.show_standard_models,
          showNovelModels: row.show_novel_models,
          showSelfHostedModels: row.show_self_hosted_models,
          showCostPerMessage: row.show_cost_per_message,
          maxCostPerMessage: row.max_cost_per_message ? parseFloat(row.max_cost_per_message) : null,
          preferCostOptimization: row.prefer_cost_optimization,
          domainModeModelOverrides: row.domain_mode_model_overrides || {},
          recentModels: row.recent_models || [],
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get model preferences', { error });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load preferences' }),
    };
  }
}

// PUT /api/thinktank/preferences/models - Update user's model preferences
export async function updateModelPreferences(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = await getUserFromToken(event);
    const body = JSON.parse(event.body || '{}');
    const client = await pool.connect();

    try {
      await client.query(`
        INSERT INTO thinktank_user_model_preferences (
          user_id, tenant_id, selection_mode, default_model_id, favorite_models,
          show_standard_models, show_novel_models, show_self_hosted_models,
          show_cost_per_message, max_cost_per_message, prefer_cost_optimization,
          domain_mode_model_overrides
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (user_id) DO UPDATE SET
          selection_mode = COALESCE($3, thinktank_user_model_preferences.selection_mode),
          default_model_id = COALESCE($4, thinktank_user_model_preferences.default_model_id),
          favorite_models = COALESCE($5, thinktank_user_model_preferences.favorite_models),
          show_standard_models = COALESCE($6, thinktank_user_model_preferences.show_standard_models),
          show_novel_models = COALESCE($7, thinktank_user_model_preferences.show_novel_models),
          show_self_hosted_models = COALESCE($8, thinktank_user_model_preferences.show_self_hosted_models),
          show_cost_per_message = COALESCE($9, thinktank_user_model_preferences.show_cost_per_message),
          max_cost_per_message = $10,
          prefer_cost_optimization = COALESCE($11, thinktank_user_model_preferences.prefer_cost_optimization),
          domain_mode_model_overrides = COALESCE($12, thinktank_user_model_preferences.domain_mode_model_overrides),
          updated_at = NOW()
      `, [
        user.id,
        user.tenantId,
        body.selectionMode,
        body.defaultModelId,
        JSON.stringify(body.favoriteModels || []),
        body.showStandardModels,
        body.showNovelModels,
        body.showSelfHostedModels,
        body.showCostPerMessage,
        body.maxCostPerMessage,
        body.preferCostOptimization,
        JSON.stringify(body.domainModeModelOverrides || {}),
      ]);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to update model preferences', { error });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to save preferences' }),
    };
  }
}

// POST /api/thinktank/preferences/models/favorite - Toggle favorite model
export async function toggleFavoriteModel(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = await getUserFromToken(event);
    const { modelId } = JSON.parse(event.body || '{}');
    
    if (!modelId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'modelId is required' }),
      };
    }

    const client = await pool.connect();

    try {
      // Check if model is currently a favorite
      const currentResult = await client.query(`
        SELECT favorite_models FROM thinktank_user_model_preferences WHERE user_id = $1
      `, [user.id]);

      let favorites: string[] = currentResult.rows[0]?.favorite_models || [];
      
      if (favorites.includes(modelId)) {
        // Remove from favorites
        favorites = favorites.filter(id => id !== modelId);
      } else {
        // Add to favorites
        favorites.push(modelId);
      }

      // Update or insert
      await client.query(`
        INSERT INTO thinktank_user_model_preferences (user_id, tenant_id, favorite_models)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET
          favorite_models = $3,
          updated_at = NOW()
      `, [user.id, user.tenantId, JSON.stringify(favorites)]);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true, 
          isFavorite: favorites.includes(modelId),
          favoriteModels: favorites,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to toggle favorite', { error });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update favorites' }),
    };
  }
}
```

---

## 31.7 Admin Pricing API Endpoints

```typescript
// packages/lambdas/src/handlers/admin/pricing.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { createLogger, corsHeaders } from '@radiant/shared';
import { requireAdmin } from '../auth/admin';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const logger = createLogger('admin-pricing');

// GET /api/admin/pricing/config
export async function getPricingConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAdmin(event);
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT * FROM pricing_config LIMIT 1
      `);

      if (result.rows.length === 0) {
        // Return defaults
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            externalDefaultMarkup: 0.40,
            selfHostedDefaultMarkup: 0.75,
            minimumChargePerRequest: 0.001,
            priceIncreaseGracePeriodHours: 24,
            autoUpdateFromProviders: true,
            autoUpdateFrequency: 'daily',
            notifyOnPriceChange: true,
            notifyThresholdPercent: 10,
          }),
        };
      }

      const row = result.rows[0];
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          externalDefaultMarkup: parseFloat(row.external_default_markup),
          selfHostedDefaultMarkup: parseFloat(row.self_hosted_default_markup),
          minimumChargePerRequest: parseFloat(row.minimum_charge_per_request),
          priceIncreaseGracePeriodHours: row.price_increase_grace_period_hours,
          autoUpdateFromProviders: row.auto_update_from_providers,
          autoUpdateFrequency: row.auto_update_frequency,
          lastAutoUpdate: row.last_auto_update,
          notifyOnPriceChange: row.notify_on_price_change,
          notifyThresholdPercent: parseFloat(row.notify_threshold_percent),
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get pricing config', { error });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load pricing config' }),
    };
  }
}

// PUT /api/admin/pricing/config
export async function updatePricingConfig(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const body = JSON.parse(event.body || '{}');
    const client = await pool.connect();

    try {
      await client.query(`
        INSERT INTO pricing_config (
          tenant_id, external_default_markup, self_hosted_default_markup,
          minimum_charge_per_request, price_increase_grace_period_hours,
          auto_update_from_providers, auto_update_frequency,
          notify_on_price_change, notify_threshold_percent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (tenant_id) DO UPDATE SET
          external_default_markup = COALESCE($2, pricing_config.external_default_markup),
          self_hosted_default_markup = COALESCE($3, pricing_config.self_hosted_default_markup),
          minimum_charge_per_request = COALESCE($4, pricing_config.minimum_charge_per_request),
          price_increase_grace_period_hours = COALESCE($5, pricing_config.price_increase_grace_period_hours),
          auto_update_from_providers = COALESCE($6, pricing_config.auto_update_from_providers),
          auto_update_frequency = COALESCE($7, pricing_config.auto_update_frequency),
          notify_on_price_change = COALESCE($8, pricing_config.notify_on_price_change),
          notify_threshold_percent = COALESCE($9, pricing_config.notify_threshold_percent),
          updated_at = NOW()
      `, [
        admin.tenantId,
        body.externalDefaultMarkup,
        body.selfHostedDefaultMarkup,
        body.minimumChargePerRequest,
        body.priceIncreaseGracePeriodHours,
        body.autoUpdateFromProviders,
        body.autoUpdateFrequency,
        body.notifyOnPriceChange,
        body.notifyThresholdPercent,
      ]);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to update pricing config', { error });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to save config' }),
    };
  }
}

// POST /api/admin/pricing/bulk-update - Bulk update markups
export async function bulkUpdatePricing(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const { type, markup } = JSON.parse(event.body || '{}');
    
    if (!type || markup === undefined) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'type and markup are required' }),
      };
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get affected models
      const modelsResult = await client.query(`
        SELECT id, pricing->>'billed_markup' as current_markup
        FROM models
        WHERE provider_id ${type === 'self_hosted' ? "= 'self_hosted'" : "!= 'self_hosted'"}
      `);

      // Record price history for each model
      for (const model of modelsResult.rows) {
        await client.query(`
          INSERT INTO price_history (tenant_id, model_id, previous_markup, new_markup, change_source, changed_by)
          VALUES ($1, $2, $3, $4, 'bulk_update', $5)
        `, [admin.tenantId, model.id, parseFloat(model.current_markup) || 0, markup / 100, admin.id]);
      }

      // Update all models of the specified type
      await client.query(`
        UPDATE models
        SET pricing = jsonb_set(
          COALESCE(pricing, '{}'::jsonb),
          '{billed_markup}',
          to_jsonb($1::numeric)
        ),
        updated_at = NOW()
        WHERE provider_id ${type === 'self_hosted' ? "= 'self_hosted'" : "!= 'self_hosted'"}
      `, [markup / 100]);

      // Also update the default in pricing_config
      if (type === 'self_hosted') {
        await client.query(`
          UPDATE pricing_config SET self_hosted_default_markup = $1, updated_at = NOW()
          WHERE tenant_id = $2
        `, [markup / 100, admin.tenantId]);
      } else {
        await client.query(`
          UPDATE pricing_config SET external_default_markup = $1, updated_at = NOW()
          WHERE tenant_id = $2
        `, [markup / 100, admin.tenantId]);
      }

      await client.query('COMMIT');

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true,
          modelsUpdated: modelsResult.rows.length,
        }),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to bulk update pricing', { error });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update pricing' }),
    };
  }
}

// PUT /api/admin/pricing/models/:modelId/override - Set individual model override
export async function setModelPricingOverride(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const modelId = event.pathParameters?.modelId;
    const { markup, inputPrice, outputPrice } = JSON.parse(event.body || '{}');
    
    if (!modelId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'modelId is required' }),
      };
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current values for history
      const currentResult = await client.query(`
        SELECT markup_override, input_price_override, output_price_override
        FROM model_pricing_overrides
        WHERE tenant_id = $1 AND model_id = $2
        ORDER BY effective_from DESC
        LIMIT 1
      `, [admin.tenantId, modelId]);

      const current = currentResult.rows[0];

      // Record history
      await client.query(`
        INSERT INTO price_history (
          tenant_id, model_id, 
          previous_markup, new_markup,
          previous_input_price, new_input_price,
          previous_output_price, new_output_price,
          change_source, changed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'admin', $9)
      `, [
        admin.tenantId, modelId,
        current?.markup_override, markup,
        current?.input_price_override, inputPrice,
        current?.output_price_override, outputPrice,
        admin.id,
      ]);

      // Insert or update override
      await client.query(`
        INSERT INTO model_pricing_overrides (
          tenant_id, model_id, markup_override, input_price_override, output_price_override, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (tenant_id, model_id, effective_from) DO UPDATE SET
          markup_override = $3,
          input_price_override = $4,
          output_price_override = $5,
          updated_at = NOW()
      `, [admin.tenantId, modelId, markup, inputPrice, outputPrice, admin.id]);

      await client.query('COMMIT');

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to set pricing override', { error });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to save override' }),
    };
  }
}

// DELETE /api/admin/pricing/models/:modelId/override - Remove override
export async function deleteModelPricingOverride(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const modelId = event.pathParameters?.modelId;

    if (!modelId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'modelId is required' }),
      };
    }

    const client = await pool.connect();

    try {
      await client.query(`
        DELETE FROM model_pricing_overrides
        WHERE tenant_id = $1 AND model_id = $2
      `, [admin.tenantId, modelId]);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to delete pricing override', { error });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to remove override' }),
    };
  }
}
```

---

## 31.8 Integration with Chat Handler

```typescript
// apps/thinktank/src/components/chat/chat-input.tsx (updated)

import { ModelSelector } from './model-selector';

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState<string | null>(null); // null = Auto

  const handleSend = () => {
    if (!message.trim()) return;
    
    onSend({
      content: message,
      modelId: selectedModel, // Will be resolved by RADIANT Brain if null
    });
    
    setMessage('');
  };

  return (
    <div className="border-t p-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="min-h-[60px] resize-none"
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            disabled={disabled}
          />
          <Button onClick={handleSend} disabled={disabled || !message.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
