// RADIANT Rate Limiting Policies v1.0
// Enforce rate limits based on principal tier and resource constraints

// =============================================================================
// TOOL RATE LIMITING
// =============================================================================

// FORBID tool execution when rate limit context indicates exhaustion
@id("rate-limit-tool-exhausted")
forbid (
  principal,
  action == Radiant::Action::"tool:execute",
  resource is Radiant::Tool
)
when {
  context has rateLimitRemaining &&
  context.rateLimitRemaining <= 0
};

// =============================================================================
// MODEL TOKEN LIMITING
// =============================================================================

// FORBID model invocation when estimated tokens exceed budget
@id("token-budget-exceeded")
forbid (
  principal,
  action == Radiant::Action::"model:invoke",
  resource is Radiant::Model
)
when {
  context has estimatedTokens &&
  context has tokenBudget &&
  context.estimatedTokens > context.tokenBudget
};

// FORBID premium models for free tier users
@id("premium-model-tier-check")
forbid (
  principal is Radiant::User,
  action == Radiant::Action::"model:invoke",
  resource is Radiant::Model
)
when {
  resource.tier == "premium" &&
  principal.parent.tier == "free"
};

// FORBID premium models for basic tier agents
@id("premium-model-agent-tier-check")
forbid (
  principal is Radiant::Agent,
  action == Radiant::Action::"model:invoke",
  resource is Radiant::Model
)
when {
  resource.tier == "premium" &&
  principal.tier == "basic"
};

// =============================================================================
// SESSION LIMITS
// =============================================================================

// FORBID session creation when concurrent limit reached
@id("concurrent-session-limit")
forbid (
  principal,
  action == Radiant::Action::"session:create",
  resource is Radiant::Session
)
when {
  context has concurrentSessions &&
  context has maxConcurrentSessions &&
  context.concurrentSessions >= context.maxConcurrentSessions
};

// =============================================================================
// COST CONTROLS
// =============================================================================

// FORBID expensive models when tenant is over budget
@id("tenant-budget-exceeded")
forbid (
  principal,
  action == Radiant::Action::"model:invoke",
  resource is Radiant::Model
)
when {
  context has tenantMonthlySpend &&
  context has tenantMonthlyBudget &&
  context.tenantMonthlySpend >= context.tenantMonthlyBudget &&
  resource.costPerToken > 100  // Only block expensive models (>$0.10/1K tokens)
};
