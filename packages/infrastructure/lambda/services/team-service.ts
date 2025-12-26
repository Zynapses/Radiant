// RADIANT v4.18.0 - Team Service
// Re-exports from shared/services for backward compatibility
// Primary implementation is in shared/services/team-service.ts

export { TeamService } from '../shared/services/team-service';

// Legacy types for backward compatibility
export type PlanType = 'family' | 'team' | 'enterprise';
export type MemberRole = 'owner' | 'admin' | 'member';

export interface TeamCreate {
  name: string;
  type: PlanType;
  maxMembers: number;
  totalTokensMonthly: number;
  sharedPool?: boolean;
  billingEmail?: string;
}

export interface TeamPlan {
  id: string;
  tenantId: string;
  planName: string;
  planType: PlanType;
  ownerId: string;
  maxMembers: number;
  totalTokensMonthly: number;
  sharedPool: boolean;
  billingEmail: string | null;
  stripeSubscriptionId: string | null;
  isActive: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: MemberRole;
  tokenAllocation: number | null;
  tokensUsedThisPeriod: number;
  invitedBy: string | null;
  invitedAt: Date;
  acceptedAt: Date | null;
  isActive: boolean;
  email?: string;
  displayName?: string;
}

export interface TeamUsageStats {
  teamId: string;
  planName: string;
  totalTokensMonthly: number;
  tokensUsed: number;
  tokensRemaining: number;
  members: {
    userId: string;
    email: string;
    displayName: string | null;
    role: MemberRole;
    tokensUsed: number;
    allocation: number | null;
  }[];
}
