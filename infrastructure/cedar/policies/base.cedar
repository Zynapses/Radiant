// RADIANT Base Authorization Policies v1.0
// Core security policies for Multi-Protocol Gateway

// =============================================================================
// TENANT ISOLATION (CRITICAL - NEVER DISABLE)
// =============================================================================

// FORBID all cross-tenant access - this is the foundational security policy
@id("deny-cross-tenant-tool")
forbid (
  principal,
  action in [Radiant::Action::"tool:read", Radiant::Action::"tool:execute"],
  resource
)
when {
  principal.parent != resource.parent
};

@id("deny-cross-tenant-model")
forbid (
  principal,
  action in [Radiant::Action::"model:invoke", Radiant::Action::"model:stream"],
  resource
)
when {
  context.tenantId != principal.parent.name
};

// =============================================================================
// TOOL ACCESS POLICIES
// =============================================================================

// Users can read any tool in their tenant
@id("user-tool-read")
permit (
  principal is Radiant::User,
  action == Radiant::Action::"tool:read",
  resource is Radiant::Tool
)
when {
  principal.active &&
  principal.scopes.contains("tool:read")
};

// Users can execute non-destructive, non-sensitive tools with proper scopes
@id("user-tool-execute-safe")
permit (
  principal is Radiant::User,
  action == Radiant::Action::"tool:execute",
  resource is Radiant::Tool
)
when {
  principal.active &&
  principal.scopes.contains("tool:execute") &&
  !resource.destructive &&
  !resource.sensitive &&
  resource.requiredScopes.containsAll(principal.scopes)
};

// Power users can execute destructive tools
@id("power-user-tool-execute-destructive")
permit (
  principal is Radiant::User,
  action == Radiant::Action::"tool:execute",
  resource is Radiant::Tool
)
when {
  principal.active &&
  principal.role in ["power_user", "admin", "super_admin"] &&
  principal.scopes.contains("tool:execute") &&
  !resource.sensitive
};

// Agents can read tools in their namespace
@id("agent-tool-read-namespace")
permit (
  principal is Radiant::Agent,
  action == Radiant::Action::"tool:read",
  resource is Radiant::Tool
)
when {
  principal.active &&
  principal.scopes.contains("tool:read") &&
  (resource.namespace == principal.namespace || resource.namespace == "public")
};

// Agents can execute tools in their namespace
@id("agent-tool-execute-namespace")
permit (
  principal is Radiant::Agent,
  action == Radiant::Action::"tool:execute",
  resource is Radiant::Tool
)
when {
  principal.active &&
  principal.scopes.contains("tool:execute") &&
  resource.namespace == principal.namespace &&
  resource.requiredScopes.containsAll(principal.scopes)
};

// Premium agents can execute public tools
@id("premium-agent-tool-execute-public")
permit (
  principal is Radiant::Agent,
  action == Radiant::Action::"tool:execute",
  resource is Radiant::Tool
)
when {
  principal.active &&
  principal.tier == "premium" &&
  resource.namespace == "public" &&
  !resource.sensitive
};

// =============================================================================
// MODEL ACCESS POLICIES
// =============================================================================

// Users can invoke models matching their tier
@id("user-model-invoke")
permit (
  principal is Radiant::User,
  action == Radiant::Action::"model:invoke",
  resource is Radiant::Model
)
when {
  principal.active &&
  principal.scopes.contains("model:invoke")
};

// Agents can invoke models matching their tier
@id("agent-model-invoke-tier")
permit (
  principal is Radiant::Agent,
  action == Radiant::Action::"model:invoke",
  resource is Radiant::Model
)
when {
  principal.active &&
  principal.scopes.contains("model:invoke") &&
  (
    resource.tier == "free" ||
    (resource.tier == "standard" && principal.tier in ["standard", "premium"]) ||
    (resource.tier == "premium" && principal.tier == "premium")
  )
};

// Streaming requires explicit scope
@id("model-stream-scope")
permit (
  principal,
  action == Radiant::Action::"model:stream",
  resource is Radiant::Model
)
when {
  principal.active &&
  principal.scopes.contains("model:stream")
};

// =============================================================================
// SESSION POLICIES
// =============================================================================

// Any active principal can create sessions
@id("session-create")
permit (
  principal,
  action == Radiant::Action::"session:create",
  resource is Radiant::Session
)
when {
  principal.active
};

// Session resume requires matching tenant
@id("session-resume")
permit (
  principal,
  action == Radiant::Action::"session:resume",
  resource is Radiant::Session
)
when {
  principal.active &&
  context.tenantId == principal.parent.name
};

// =============================================================================
// ADMIN POLICIES
// =============================================================================

// Super admins can do everything
@id("super-admin-all")
permit (
  principal is Radiant::User,
  action,
  resource
)
when {
  principal.role == "super_admin" &&
  principal.active
};

// Admins can configure their tenant
@id("admin-configure-tenant")
permit (
  principal is Radiant::User,
  action == Radiant::Action::"admin:configure",
  resource is Radiant::Tenant
)
when {
  principal.role in ["admin", "super_admin"] &&
  principal.active &&
  principal.parent == resource
};

// Only super_admin can impersonate
@id("super-admin-impersonate")
permit (
  principal is Radiant::User,
  action == Radiant::Action::"admin:impersonate",
  resource is Radiant::Tenant
)
when {
  principal.role == "super_admin" &&
  principal.active
};

// =============================================================================
// SENSITIVE RESOURCE PROTECTION
// =============================================================================

// FORBID access to sensitive tools without explicit label
@id("deny-sensitive-without-label")
forbid (
  principal,
  action == Radiant::Action::"tool:execute",
  resource is Radiant::Tool
)
when {
  resource.sensitive &&
  !principal.labels.contains("sensitive-access")
};

// FORBID inactive principals
@id("deny-inactive")
forbid (
  principal,
  action,
  resource
)
when {
  !principal.active
};

// =============================================================================
// INTERNAL SERVICES
// =============================================================================

// Internal services have elevated access
@id("internal-service-all")
permit (
  principal is Radiant::Service,
  action,
  resource
)
when {
  principal.internal &&
  principal.active
};
