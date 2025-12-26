import { executeStatement } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

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
  async createTeam(tenantId: string, ownerId: string, team: TeamCreate): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO team_plans (
         tenant_id, plan_name, plan_type, owner_id, max_members,
         total_tokens_monthly, shared_pool, billing_email,
         current_period_start, current_period_end
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW() + INTERVAL '1 month')
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'planName', value: { stringValue: team.name } },
        { name: 'planType', value: { stringValue: team.type } },
        { name: 'ownerId', value: { stringValue: ownerId } },
        { name: 'maxMembers', value: { longValue: team.maxMembers } },
        { name: 'totalTokensMonthly', value: { longValue: team.totalTokensMonthly } },
        { name: 'sharedPool', value: { booleanValue: team.sharedPool ?? true } },
        { name: 'billingEmail', value: team.billingEmail ? { stringValue: team.billingEmail } : { isNull: true } },
      ]
    );

    const teamId = String((result.rows[0] as Record<string, unknown>)?.id || '');

    // Add owner as first member
    await this.addMember(teamId, ownerId, 'owner');

    return teamId;
  }

  async getTeam(teamId: string): Promise<unknown> {
    const result = await executeStatement(
      `SELECT id, tenant_id, plan_name, plan_type, owner_id, max_members,
              total_tokens_monthly, shared_pool, billing_email, stripe_subscription_id,
              is_active, current_period_start, current_period_end, created_at
       FROM team_plans WHERE id = $1`,
      [{ name: 'teamId', value: { stringValue: teamId } }]
    );
    return result.rows[0];
  }

  async getUserTeams(userId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT tp.id, tp.tenant_id, tp.plan_name, tp.plan_type, tp.owner_id, tp.max_members,
              tp.total_tokens_monthly, tp.shared_pool, tp.billing_email, tp.is_active, tp.created_at
       FROM team_plans tp
       JOIN team_members tm ON tp.id = tm.team_id
       WHERE tm.user_id = $1 AND tm.is_active = true AND tp.is_active = true`,
      [{ name: 'userId', value: { stringValue: userId } }]
    );
    return result.rows;
  }

  async addMember(teamId: string, userId: string, role: MemberRole = 'member', invitedBy?: string): Promise<string> {
    const team = (await this.getTeam(teamId)) as Record<string, unknown>;
    const memberCount = await this.getMemberCount(teamId);

    if (memberCount >= (team.max_members as number)) {
      throw new Error('Team member limit reached');
    }

    const result = await executeStatement(
      `INSERT INTO team_members (team_id, user_id, role, invited_by, accepted_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $3 = 'owner' THEN NOW() ELSE NULL END)
       RETURNING id`,
      [
        { name: 'teamId', value: { stringValue: teamId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'role', value: { stringValue: role } },
        { name: 'invitedBy', value: invitedBy ? { stringValue: invitedBy } : { isNull: true } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>)?.id || '');
  }

  async getMembers(teamId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT tm.id, tm.team_id, tm.user_id, tm.role, tm.token_allocation,
              tm.tokens_used_this_period, tm.invited_by, tm.invited_at, tm.accepted_at,
              tm.is_active, u.email, u.display_name 
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1 AND tm.is_active = true
       ORDER BY tm.role, tm.invited_at`,
      [{ name: 'teamId', value: { stringValue: teamId } }]
    );
    return result.rows;
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    const member = await this.getMember(teamId, userId);
    if ((member as Record<string, unknown>)?.role === 'owner') {
      throw new Error('Cannot remove team owner');
    }

    await executeStatement(
      `UPDATE team_members SET is_active = false WHERE team_id = $1 AND user_id = $2`,
      [
        { name: 'teamId', value: { stringValue: teamId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );
  }

  async updateMemberRole(teamId: string, userId: string, role: MemberRole): Promise<void> {
    if (role === 'owner') {
      throw new Error('Cannot change role to owner');
    }

    await executeStatement(
      `UPDATE team_members SET role = $3 WHERE team_id = $1 AND user_id = $2`,
      [
        { name: 'teamId', value: { stringValue: teamId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'role', value: { stringValue: role } },
      ]
    );
  }

  async createInvitation(teamId: string, email: string, role: MemberRole, invitedBy: string): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await executeStatement(
      `INSERT INTO team_invitations (team_id, email, role, invited_by, token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        { name: 'teamId', value: { stringValue: teamId } },
        { name: 'email', value: { stringValue: email } },
        { name: 'role', value: { stringValue: role } },
        { name: 'invitedBy', value: { stringValue: invitedBy } },
        { name: 'token', value: { stringValue: token } },
        { name: 'expiresAt', value: { stringValue: expiresAt.toISOString() } },
      ]
    );

    return token;
  }

  async acceptInvitation(token: string, userId: string): Promise<string> {
    const inviteResult = await executeStatement(
      `SELECT * FROM team_invitations 
       WHERE token = $1 AND expires_at > NOW() AND accepted_at IS NULL`,
      [{ name: 'token', value: { stringValue: token } }]
    );

    if (inviteResult.rows.length === 0) {
      throw new Error('Invalid or expired invitation');
    }

    const invite = inviteResult.rows[0] as Record<string, unknown>;
    const teamId = String(invite.team_id);
    const role = invite.role as MemberRole;

    // Add member
    const memberId = await this.addMember(teamId, userId, role, String(invite.invited_by));

    // Mark invitation as accepted
    await executeStatement(
      `UPDATE team_invitations SET accepted_at = NOW() WHERE token = $1`,
      [{ name: 'token', value: { stringValue: token } }]
    );

    return memberId;
  }

  async recordUsage(teamId: string, memberId: string, tokensUsed: number, model: string): Promise<void> {
    await executeStatement(
      `INSERT INTO team_usage_log (team_id, member_id, tokens_used, model)
       VALUES ($1, $2, $3, $4)`,
      [
        { name: 'teamId', value: { stringValue: teamId } },
        { name: 'memberId', value: { stringValue: memberId } },
        { name: 'tokensUsed', value: { longValue: tokensUsed } },
        { name: 'model', value: { stringValue: model } },
      ]
    );

    // Update team and member token counts
    await executeStatement(
      `UPDATE team_plans SET tokens_used_this_period = tokens_used_this_period + $2 WHERE id = $1`,
      [
        { name: 'teamId', value: { stringValue: teamId } },
        { name: 'tokensUsed', value: { longValue: tokensUsed } },
      ]
    );

    await executeStatement(
      `UPDATE team_members SET tokens_used_this_period = tokens_used_this_period + $2 WHERE id = $1`,
      [
        { name: 'memberId', value: { stringValue: memberId } },
        { name: 'tokensUsed', value: { longValue: tokensUsed } },
      ]
    );
  }

  async getUsageStats(teamId: string): Promise<unknown> {
    const result = await executeStatement(
      `SELECT 
         SUM(tokens_used) as total_tokens,
         COUNT(*) as total_requests,
         COUNT(DISTINCT member_id) as active_members
       FROM team_usage_log
       WHERE team_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [{ name: 'teamId', value: { stringValue: teamId } }]
    );
    return result.rows[0];
  }

  private async getMember(teamId: string, userId: string): Promise<unknown> {
    const result = await executeStatement(
      `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND is_active = true`,
      [
        { name: 'teamId', value: { stringValue: teamId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );
    return result.rows[0];
  }

  private async getMemberCount(teamId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM team_members WHERE team_id = $1 AND is_active = true`,
      [{ name: 'teamId', value: { stringValue: teamId } }]
    );
    return parseInt(String((result.rows[0] as Record<string, unknown>)?.count ?? 0), 10);
  }
}

export const teamService = new TeamService();
