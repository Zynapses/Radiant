'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { 
  Shield, 
  Plus, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Eye,
  PlayCircle,
  BarChart3,
  Clock,
  ChevronDown,
  Lock,
  Unlock,
  RefreshCw,
  Loader2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type SecurityPolicyCategory =
  | 'prompt_injection'
  | 'system_leak'
  | 'sql_injection'
  | 'data_exfiltration'
  | 'cross_tenant'
  | 'privilege_escalation'
  | 'jailbreak'
  | 'encoding_attack'
  | 'payload_splitting'
  | 'pii_exposure'
  | 'rate_abuse'
  | 'custom';

type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type SecurityPolicyAction = 'block' | 'warn' | 'redact' | 'rate_limit' | 'require_approval' | 'log_only' | 'escalate';
type SecurityDetectionMethod = 'regex' | 'keyword' | 'semantic' | 'heuristic' | 'embedding_similarity' | 'composite';

interface SecurityPolicy {
  id: string;
  tenantId: string | null;
  name: string;
  description: string | null;
  category: SecurityPolicyCategory;
  detectionMethod: SecurityDetectionMethod;
  pattern: string | null;
  patternFlags: string | null;
  severity: SecuritySeverity;
  action: SecurityPolicyAction;
  customMessage: string | null;
  isEnabled: boolean;
  isSystem: boolean;
  priority: number;
  matchCount: number;
  lastMatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SecurityStats {
  totalViolations: number;
  violationsByCategory: Record<string, number>;
  violationsBySeverity: Record<string, number>;
  topTriggeredPolicies: Array<{ id: string; name: string; count: number }>;
  falsePositiveRate: number;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_LABELS: Record<SecurityPolicyCategory, { label: string; icon: string; color: string }> = {
  prompt_injection: { label: 'Prompt Injection', icon: '🎯', color: 'bg-red-100 text-red-800' },
  system_leak: { label: 'System Leak', icon: '🔓', color: 'bg-orange-100 text-orange-800' },
  sql_injection: { label: 'SQL Injection', icon: '💉', color: 'bg-red-100 text-red-800' },
  data_exfiltration: { label: 'Data Exfiltration', icon: '📤', color: 'bg-purple-100 text-purple-800' },
  cross_tenant: { label: 'Cross-Tenant', icon: '🏢', color: 'bg-yellow-100 text-yellow-800' },
  privilege_escalation: { label: 'Privilege Escalation', icon: '⬆️', color: 'bg-red-100 text-red-800' },
  jailbreak: { label: 'Jailbreak', icon: '🔓', color: 'bg-pink-100 text-pink-800' },
  encoding_attack: { label: 'Encoding Attack', icon: '🔢', color: 'bg-blue-100 text-blue-800' },
  payload_splitting: { label: 'Payload Splitting', icon: '✂️', color: 'bg-indigo-100 text-indigo-800' },
  pii_exposure: { label: 'PII Exposure', icon: '👤', color: 'bg-green-100 text-green-800' },
  rate_abuse: { label: 'Rate Abuse', icon: '⚡', color: 'bg-yellow-100 text-yellow-800' },
  custom: { label: 'Custom', icon: '⚙️', color: 'bg-gray-100 text-gray-800' },
};

const SEVERITY_COLORS: Record<SecuritySeverity, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-blue-500 text-white',
  info: 'bg-gray-400 text-white',
};

const ACTION_LABELS: Record<SecurityPolicyAction, { label: string; color: string }> = {
  block: { label: 'Block', color: 'text-red-600' },
  warn: { label: 'Warn', color: 'text-yellow-600' },
  redact: { label: 'Redact', color: 'text-purple-600' },
  rate_limit: { label: 'Rate Limit', color: 'text-orange-600' },
  require_approval: { label: 'Require Approval', color: 'text-blue-600' },
  log_only: { label: 'Log Only', color: 'text-gray-600' },
  escalate: { label: 'Escalate', color: 'text-pink-600' },
};

// ============================================================================
// Main Component
// ============================================================================

export default function SecurityPoliciesPage() {
  const [policies, setPolicies] = useState<SecurityPolicy[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<SecurityPolicyCategory | 'all'>('all');
  const [showSystemPolicies, setShowSystemPolicies] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<SecurityPolicy | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<{
    allowed: boolean;
    violations: Array<{ policyName: string; category: string; severity: string; matchedPattern?: string }>;
    blockedBy?: { policyName: string; severity: string; message?: string } | null;
    warnings: Array<{ policyName: string; message?: string }>;
  } | null>(null);

  // Fetch policies and stats
  useEffect(() => {
    fetchPolicies();
    fetchStats();
  }, []);

  const fetchPolicies = async () => {
    try {
      const response = await fetch('/api/admin/security-policies');
      const data = await response.json();
      setPolicies(data.policies || []);
    } catch (error) {
      console.error('Failed to fetch policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/security-policies/stats');
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const togglePolicy = async (policyId: string, enabled: boolean) => {
    try {
      await fetch(`/api/admin/security-policies/${policyId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      setPolicies(policies.map(p => p.id === policyId ? { ...p, isEnabled: enabled } : p));
    } catch (error) {
      console.error('Failed to toggle policy:', error);
    }
  };

  const deletePolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;
    try {
      await fetch(`/api/admin/security-policies/${policyId}`, { method: 'DELETE' });
      setPolicies(policies.filter(p => p.id !== policyId));
    } catch (error) {
      console.error('Failed to delete policy:', error);
    }
  };

  const runTest = async () => {
    if (!testInput.trim()) return;
    try {
      const response = await fetch('/api/admin/security-policies/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: testInput }),
      });
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      console.error('Failed to test input:', error);
    }
  };

  // Filter policies
  const filteredPolicies = policies.filter(policy => {
    if (!showSystemPolicies && policy.isSystem) return false;
    if (categoryFilter !== 'all' && policy.category !== categoryFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        policy.name.toLowerCase().includes(query) ||
        policy.description?.toLowerCase().includes(query) ||
        policy.pattern?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const systemPoliciesCount = policies.filter(p => p.isSystem).length;
  const tenantPoliciesCount = policies.filter(p => !p.isSystem).length;

  const { toast } = useToast();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Security Policy Registry</h1>
              <p className="text-gray-500">Manage prompt injection, jailbreak, and attack prevention policies</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={fetchPolicies}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => setShowTestModal(true)}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Test Input
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Policy
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Violations (30d)</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalViolations.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">System Policies</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemPoliciesCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Custom Policies</CardTitle>
              <Unlock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tenantPoliciesCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">False Positive Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(stats.falsePositiveRate * 100).toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as SecurityPolicyCategory | 'all')}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showSystemPolicies}
              onChange={(e) => setShowSystemPolicies(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Show system policies</span>
          </label>
        </div>
      </div>

      {/* Policy List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Policy</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Category</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Severity</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Action</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Matches</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPolicies.map((policy) => (
                <tr key={policy.id} className={`hover:bg-gray-50 ${!policy.isEnabled ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {policy.isSystem && <span title="System Policy"><Lock className="h-4 w-4 text-gray-400" /></span>}
                      <div>
                        <p className="font-medium text-gray-900">{policy.name}</p>
                        {policy.description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">{policy.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${CATEGORY_LABELS[policy.category].color}`}>
                      {CATEGORY_LABELS[policy.category].icon} {CATEGORY_LABELS[policy.category].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium uppercase ${SEVERITY_COLORS[policy.severity]}`}>
                      {policy.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${ACTION_LABELS[policy.action].color}`}>
                      {ACTION_LABELS[policy.action].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <p className="font-medium">{policy.matchCount.toLocaleString()}</p>
                      {policy.lastMatchedAt && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(policy.lastMatchedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePolicy(policy.id, !policy.isEnabled)}
                      className="flex items-center gap-1"
                      disabled={policy.isSystem && policy.tenantId === null}
                    >
                      {policy.isEnabled ? (
                        <>
                          <ToggleRight className="h-5 w-5 text-green-500" />
                          <span className="text-sm text-green-600">Active</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-5 w-5 text-gray-400" />
                          <span className="text-sm text-gray-500">Disabled</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingPolicy(policy)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="View/Edit"
                      >
                        <Eye className="h-4 w-4 text-gray-500" />
                      </button>
                      {!policy.isSystem && (
                        <>
                          <button
                            onClick={() => setEditingPolicy(policy)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4 text-blue-500" />
                          </button>
                          <button
                            onClick={() => deletePolicy(policy.id)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredPolicies.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No policies match your filters</p>
          </div>
        )}
      </div>

      {/* Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Test Security Policies</h2>
              <p className="text-sm text-gray-500">Enter text to test against all active policies</p>
            </div>
            <div className="p-6">
              <textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Enter test input..."
                className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {testResult && (
                <div className="mt-4 p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    {testResult.allowed ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="font-medium text-green-600">Input Allowed</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-500" />
                        <span className="font-medium text-red-600">Input Blocked</span>
                      </>
                    )}
                  </div>
                  {testResult.violations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Violations:</p>
                      {testResult.violations.map((v, i) => (
                        <div key={i} className="text-sm p-2 bg-red-50 rounded">
                          <p className="font-medium">{v.policyName}</p>
                          <p className="text-gray-500">{v.category} - {v.severity}</p>
                          {v.matchedPattern && <p className="text-xs text-red-600 mt-1">Matched: {v.matchedPattern}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => { setShowTestModal(false); setTestResult(null); setTestInput(''); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
              <button
                onClick={runTest}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Run Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal - simplified for now */}
      {(showCreateModal || editingPolicy) && (
        <PolicyFormModal
          policy={editingPolicy}
          onClose={() => { setShowCreateModal(false); setEditingPolicy(null); }}
          onSave={() => { fetchPolicies(); setShowCreateModal(false); setEditingPolicy(null); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Policy Form Modal Component
// ============================================================================

function PolicyFormModal({ 
  policy, 
  onClose, 
  onSave 
}: { 
  policy: SecurityPolicy | null; 
  onClose: () => void; 
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: policy?.name || '',
    description: policy?.description || '',
    category: policy?.category || 'custom' as SecurityPolicyCategory,
    detectionMethod: policy?.detectionMethod || 'regex' as SecurityDetectionMethod,
    pattern: policy?.pattern || '',
    patternFlags: policy?.patternFlags || 'i',
    severity: policy?.severity || 'medium' as SecuritySeverity,
    action: policy?.action || 'block' as SecurityPolicyAction,
    customMessage: policy?.customMessage || '',
    priority: policy?.priority || 100,
    isEnabled: policy?.isEnabled ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = policy 
        ? `/api/admin/security-policies/${policy.id}`
        : '/api/admin/security-policies';
      const method = policy ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save policy');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const isSystemPolicy = policy?.isSystem && policy?.tenantId === null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">
              {policy ? (isSystemPolicy ? 'View System Policy' : 'Edit Policy') : 'Create New Policy'}
            </h2>
          </div>
          
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={isSystemPolicy}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  disabled={isSystemPolicy}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as SecurityPolicyCategory })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={isSystemPolicy}
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, { label }]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Detection Method *</label>
                <select
                  value={formData.detectionMethod}
                  onChange={(e) => setFormData({ ...formData, detectionMethod: e.target.value as SecurityDetectionMethod })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={isSystemPolicy}
                >
                  <option value="regex">Regular Expression</option>
                  <option value="keyword">Keyword</option>
                  <option value="heuristic">Heuristic</option>
                  <option value="semantic">Semantic</option>
                  <option value="composite">Composite</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pattern {formData.detectionMethod === 'regex' && '(Regex)'} {formData.detectionMethod === 'keyword' && '(Comma-separated)'}
                </label>
                <textarea
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={3}
                  placeholder={formData.detectionMethod === 'regex' ? '(?i)pattern.*here' : 'keyword1, keyword2, keyword3'}
                  disabled={isSystemPolicy}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity *</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as SecuritySeverity })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={isSystemPolicy}
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="info">Info</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action *</label>
                <select
                  value={formData.action}
                  onChange={(e) => setFormData({ ...formData, action: e.target.value as SecurityPolicyAction })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={isSystemPolicy}
                >
                  <option value="block">Block</option>
                  <option value="warn">Warn</option>
                  <option value="redact">Redact</option>
                  <option value="rate_limit">Rate Limit</option>
                  <option value="require_approval">Require Approval</option>
                  <option value="log_only">Log Only</option>
                  <option value="escalate">Escalate</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  min={1}
                  max={1000}
                  disabled={isSystemPolicy}
                />
                <p className="text-xs text-gray-500 mt-1">Lower = higher priority</p>
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isEnabled}
                    onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isSystemPolicy}
                  />
                  <span className="text-sm text-gray-700">Enabled</span>
                </label>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Message (shown to user)</label>
                <input
                  type="text"
                  value={formData.customMessage}
                  onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="This request has been blocked for security reasons."
                  disabled={isSystemPolicy}
                />
              </div>
            </div>
          </div>

          <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100"
            >
              {isSystemPolicy ? 'Close' : 'Cancel'}
            </button>
            {!isSystemPolicy && (
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : (policy ? 'Update Policy' : 'Create Policy')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
