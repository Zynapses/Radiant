// ============================================================================
// RADIANT v5.52.5 - Interface Access Control Cedar Policies
// 
// These policies enforce that agents and services can ONLY access RADIANT
// resources through the defined interfaces (API, MCP, A2A).
// 
// No direct database access is permitted for external agents.
// ============================================================================

// ============================================================================
// 1. API Interface Policies
// ============================================================================

// Allow API key holders to access REST endpoints
permit (
  principal,
  action in [Action::"api:invoke", Action::"api:read", Action::"api:write"],
  resource
)
when {
  principal.interface_type == "api" || principal.interface_type == "all"
}
unless {
  !principal.is_active ||
  (principal.expires_at != "" && principal.expires_at < context.current_time)
};

// Deny API access for MCP-only keys
forbid (
  principal,
  action in [Action::"api:invoke", Action::"api:read", Action::"api:write"],
  resource
)
when {
  principal.interface_type == "mcp"
};

// Deny API access for A2A-only keys
forbid (
  principal,
  action in [Action::"api:invoke", Action::"api:read", Action::"api:write"],
  resource
)
when {
  principal.interface_type == "a2a"
};

// ============================================================================
// 2. MCP Interface Policies
// ============================================================================

// Allow MCP key holders to invoke tools
permit (
  principal,
  action in [Action::"mcp:tool_invoke", Action::"mcp:resource_read", Action::"mcp:resource_subscribe"],
  resource
)
when {
  principal.interface_type == "mcp" || principal.interface_type == "all"
}
unless {
  !principal.is_active ||
  (principal.expires_at != "" && principal.expires_at < context.current_time)
};

// MCP tool restrictions - only allowed tools
permit (
  principal,
  action == Action::"mcp:tool_invoke",
  resource
)
when {
  principal.interface_type == "mcp" &&
  principal.mcp_allowed_tools.contains(resource.tool_name)
};

// Deny MCP access for API-only keys
forbid (
  principal,
  action in [Action::"mcp:tool_invoke", Action::"mcp:resource_read"],
  resource
)
when {
  principal.interface_type == "api"
};

// Deny MCP access for A2A-only keys
forbid (
  principal,
  action in [Action::"mcp:tool_invoke", Action::"mcp:resource_read"],
  resource
)
when {
  principal.interface_type == "a2a"
};

// ============================================================================
// 3. A2A Interface Policies
// ============================================================================

// Allow A2A key holders to perform agent operations
permit (
  principal,
  action in [
    Action::"a2a:register",
    Action::"a2a:discover",
    Action::"a2a:message",
    Action::"a2a:broadcast",
    Action::"a2a:subscribe",
    Action::"a2a:heartbeat",
    Action::"a2a:acquire_lock",
    Action::"a2a:release_lock",
    Action::"a2a:task_start",
    Action::"a2a:task_update",
    Action::"a2a:task_complete"
  ],
  resource
)
when {
  principal.interface_type == "a2a" || principal.interface_type == "all"
}
unless {
  !principal.is_active ||
  (principal.expires_at != "" && principal.expires_at < context.current_time)
};

// A2A requires mTLS by default
permit (
  principal,
  action in [Action::"a2a:register", Action::"a2a:message", Action::"a2a:acquire_lock"],
  resource
)
when {
  principal.interface_type == "a2a" &&
  context.mtls_verified == true
};

// Deny A2A access without mTLS when required
forbid (
  principal,
  action in [Action::"a2a:register", Action::"a2a:message", Action::"a2a:acquire_lock"],
  resource
)
when {
  principal.interface_type == "a2a" &&
  principal.a2a_mtls_required == true &&
  context.mtls_verified != true
};

// A2A agent type restrictions
permit (
  principal,
  action == Action::"a2a:register",
  resource
)
when {
  principal.interface_type == "a2a" &&
  (principal.a2a_allowed_agent_types.size() == 0 ||
   principal.a2a_allowed_agent_types.contains(context.agent_type))
};

// Deny A2A access for API-only keys
forbid (
  principal,
  action in [Action::"a2a:register", Action::"a2a:message", Action::"a2a:broadcast"],
  resource
)
when {
  principal.interface_type == "api"
};

// Deny A2A access for MCP-only keys
forbid (
  principal,
  action in [Action::"a2a:register", Action::"a2a:message", Action::"a2a:broadcast"],
  resource
)
when {
  principal.interface_type == "mcp"
};

// ============================================================================
// 4. Database Access Policies - CRITICAL SECURITY
// ============================================================================

// FORBID all direct database access from external agents
forbid (
  principal,
  action in [
    Action::"db:connect",
    Action::"db:query",
    Action::"db:insert",
    Action::"db:update",
    Action::"db:delete",
    Action::"db:execute"
  ],
  resource
)
when {
  principal.type == "Agent" &&
  !principal.internal
};

// FORBID direct database access from any interface key
forbid (
  principal,
  action in [
    Action::"db:connect",
    Action::"db:query",
    Action::"db:insert",
    Action::"db:update",
    Action::"db:delete"
  ],
  resource
)
when {
  principal.interface_type in ["api", "mcp", "a2a", "all"]
};

// Only internal services can access database directly
permit (
  principal,
  action in [Action::"db:query", Action::"db:execute"],
  resource
)
when {
  principal.type == "Service" &&
  principal.internal == true &&
  principal.tenant_id == resource.tenant_id
};

// ============================================================================
// 5. Cross-Interface Restrictions
// ============================================================================

// Prevent interface escalation - an API key cannot be used as MCP
forbid (
  principal,
  action,
  resource
)
when {
  context.requested_interface != principal.interface_type &&
  principal.interface_type != "all"
};

// Rate limiting per interface
forbid (
  principal,
  action,
  resource
)
when {
  context.rate_limit_exceeded == true
};

// ============================================================================
// 6. Tenant Isolation
// ============================================================================

// Enforce tenant isolation - keys can only access their own tenant's resources
forbid (
  principal,
  action,
  resource
)
when {
  principal.tenant_id != resource.tenant_id
}
unless {
  principal.type == "Service" && principal.internal == true
};

// ============================================================================
// 7. Scope-Based Access Control
// ============================================================================

// API scopes must include required scope for action
permit (
  principal,
  action == Action::"api:invoke",
  resource
)
when {
  principal.scopes.containsAny(resource.required_scopes)
};

// Deny if missing required scope
forbid (
  principal,
  action == Action::"api:invoke",
  resource
)
when {
  !principal.scopes.containsAny(resource.required_scopes)
};

// ============================================================================
// 8. Endpoint Restrictions
// ============================================================================

// Allow access to endpoint if in allowed list (or no restrictions)
permit (
  principal,
  action in [Action::"api:invoke", Action::"api:read", Action::"api:write"],
  resource
)
when {
  principal.allowed_endpoints.size() == 0 ||
  principal.allowed_endpoints.contains(context.endpoint)
};

// Deny access to endpoint if in denied list
forbid (
  principal,
  action in [Action::"api:invoke", Action::"api:read", Action::"api:write"],
  resource
)
when {
  principal.denied_endpoints.contains(context.endpoint)
};
