'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Users,
  Brain,
  BookOpen,
  Settings,
  Plus,
  UserPlus,
  ChevronRight,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentRegistryEntry {
  id: string;
  agentKey: string;
  displayName: string;
  description?: string;
  iconName?: string;
  capabilities: string[];
  defaultPermissions: Record<string, boolean>;
}

interface TenantRole {
  id: string;
  roleKey: string;
  displayName: string;
  description?: string;
  isSystemRole: boolean;
  permissions: Record<string, boolean>;
  agentAccess: string[];
}

interface UserWithAccess {
  userId: string;
  roles: string[];
  agents: string[];
}

const agentIcons: Record<string, React.ReactNode> = {
  Brain: <Brain className="h-5 w-5" />,
  BookOpen: <BookOpen className="h-5 w-5" />,
  Shield: <Shield className="h-5 w-5" />,
};

async function fetchAgentRegistry(): Promise<AgentRegistryEntry[]> {
  const res = await fetch('/api/admin/agents/registry');
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

async function fetchTenantRoles(): Promise<TenantRole[]> {
  const res = await fetch('/api/admin/agents/roles');
  if (!res.ok) throw new Error('Failed to fetch roles');
  return res.json();
}

async function fetchUsersWithAccess(): Promise<UserWithAccess[]> {
  const res = await fetch('/api/admin/agents/users');
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

async function initializeRoles(): Promise<TenantRole[]> {
  const res = await fetch('/api/admin/agents/initialize-roles', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to initialize roles');
  return res.json();
}

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentRegistryEntry | null>(null);
  const [selectedRole, setSelectedRole] = useState<TenantRole | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ['agent-registry'],
    queryFn: fetchAgentRegistry,
  });

  const { data: roles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ['tenant-roles'],
    queryFn: fetchTenantRoles,
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users-with-access'],
    queryFn: fetchUsersWithAccess,
  });

  const initMutation = useMutation({
    mutationFn: initializeRoles,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-roles'] });
    },
  });

  const agentStats = agents.map((agent) => ({
    ...agent,
    userCount: users.filter((u) => u.agents.includes(agent.displayName)).length,
  }));

  if (loadingAgents || loadingRoles) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Access Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage user access to RADIANT agents (Think Tank, Curator, etc.)
          </p>
        </div>
        <div className="flex gap-2">
          {roles.length === 0 && (
            <button
              onClick={() => initMutation.mutate()}
              disabled={initMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              <Settings className="h-4 w-4" />
              Initialize Roles
            </button>
          )}
          <button
            onClick={() => setShowRoleModal(true)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg font-medium hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
            New Role
          </button>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {agentStats.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent)}
            className={cn(
              'p-4 rounded-xl border bg-card text-left hover:border-primary transition-colors',
              selectedAgent?.id === agent.id && 'border-primary ring-1 ring-primary'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {agentIcons[agent.iconName || 'Shield'] || <Shield className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-semibold">{agent.displayName}</h3>
                  <p className="text-xs text-muted-foreground">{agent.agentKey}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
              {agent.description}
            </p>
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <div className="flex items-center gap-1 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{agent.userCount} users</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {agent.capabilities.length} capabilities
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Roles Panel */}
        <div className="rounded-xl border bg-card">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">Tenant Roles</h2>
            <span className="text-xs text-muted-foreground">{roles.length} roles</span>
          </div>
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={cn(
                  'w-full p-4 text-left hover:bg-accent/50 transition-colors',
                  selectedRole?.id === role.id && 'bg-accent'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{role.displayName}</span>
                      {role.isSystemRole && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">
                          System
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {role.description || role.roleKey}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">{role.agentAccess.length} agents</div>
                    <div className="text-xs text-muted-foreground">
                      {Object.keys(role.permissions).length} perms
                    </div>
                  </div>
                </div>
                {role.agentAccess.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {role.agentAccess.map((agent) => (
                      <span
                        key={agent}
                        className="px-2 py-0.5 text-xs rounded-full bg-muted"
                      >
                        {agent}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
            {roles.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No roles configured</p>
                <p className="text-sm mt-1">Click &quot;Initialize Roles&quot; to create default roles</p>
              </div>
            )}
          </div>
        </div>

        {/* Selected Role/Agent Details */}
        <div className="rounded-xl border bg-card">
          {selectedRole ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">{selectedRole.displayName}</h2>
                <button
                  onClick={() => setSelectedRole(null)}
                  className="p-1 hover:bg-accent rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Agent Access</h3>
                  <div className="space-y-2">
                    {agents.map((agent) => {
                      const hasAccess = selectedRole.agentAccess.includes(agent.agentKey);
                      return (
                        <div
                          key={agent.id}
                          className={cn(
                            'flex items-center justify-between p-2 rounded-lg border',
                            hasAccess ? 'border-green-500/30 bg-green-500/5' : 'border-transparent bg-muted/50'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded bg-muted">
                              {agentIcons[agent.iconName || 'Shield'] || <Shield className="h-4 w-4" />}
                            </div>
                            <span className="text-sm font-medium">{agent.displayName}</span>
                          </div>
                          {hasAccess ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Permissions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedRole.permissions).map(([key, value]) => (
                      <div
                        key={key}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded text-sm',
                          value ? 'bg-green-500/10' : 'bg-red-500/10'
                        )}
                      >
                        {value ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <X className="h-3 w-3 text-red-500" />
                        )}
                        <span className="text-xs">{key.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {!selectedRole.isSystemRole && (
                  <div className="pt-4 border-t flex gap-2">
                    <button className="flex-1 py-2 px-4 border rounded-lg text-sm hover:bg-accent">
                      Edit Role
                    </button>
                    <button className="py-2 px-4 border border-red-500/30 text-red-500 rounded-lg text-sm hover:bg-red-500/10">
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : selectedAgent ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {agentIcons[selectedAgent.iconName || 'Shield'] || <Shield className="h-5 w-5" />}
                  </div>
                  <div>
                    <h2 className="font-semibold">{selectedAgent.displayName}</h2>
                    <p className="text-xs text-muted-foreground">{selectedAgent.agentKey}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="p-1 hover:bg-accent rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                {selectedAgent.description}
              </p>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Capabilities</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedAgent.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="px-2 py-1 text-xs rounded-full bg-muted"
                      >
                        {cap.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Default Permissions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedAgent.defaultPermissions).map(([key, value]) => (
                      <div
                        key={key}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded text-sm',
                          value ? 'bg-green-500/10' : 'bg-muted'
                        )}
                      >
                        {value ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <X className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="text-xs">{key.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Roles with Access</h3>
                  <div className="space-y-1">
                    {roles
                      .filter((r) => r.agentAccess.includes(selectedAgent.agentKey))
                      .map((role) => (
                        <div
                          key={role.id}
                          className="flex items-center justify-between p-2 rounded bg-muted/50"
                        >
                          <span className="text-sm">{role.displayName}</span>
                          {role.isSystemRole && (
                            <span className="text-[10px] text-muted-foreground">System</span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
              <Settings className="h-12 w-12 opacity-30 mb-3" />
              <p>Select a role or agent to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Users with Access */}
      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Users with Agent Access</h2>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-accent">
            <UserPlus className="h-4 w-4" />
            Grant Access
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-sm font-medium">User ID</th>
                <th className="text-left p-3 text-sm font-medium">Roles</th>
                <th className="text-left p-3 text-sm font-medium">Agents</th>
                <th className="text-right p-3 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.userId} className="hover:bg-muted/30">
                  <td className="p-3">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {user.userId.slice(0, 8)}...
                    </code>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {user.agents.map((agent) => (
                        <span
                          key={agent}
                          className="px-2 py-0.5 text-xs rounded-full bg-muted"
                        >
                          {agent}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <button className="text-xs text-primary hover:underline">
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No users with agent access yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
