'use client';

/**
 * Radiant Admin Simulator
 * v1.0 - Comprehensive platform administration simulation
 * 
 * 16 Admin Views covering:
 * - Tenants, Models, Providers, Billing
 * - Security, Infrastructure, Deployments, Audit
 * - Cato Safety, Consciousness, Experiments
 * - Compliance, Geographic, Localization
 * - Analytics Dashboard
 */

import React, { useState } from 'react';
import {
  Activity, Building2, Cpu, Cloud, CreditCard, Server, Rocket, Shield,
  ScrollText, Brain, Sparkles, FlaskConical, CheckCircle, Globe, Languages,
  BarChart3, Users, TrendingUp, Check, X,
  Play, Pause, RefreshCw, Save, Filter, MoreHorizontal,
  Plus, Download, Zap,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { AdminViewType } from './types';

import {
  MOCK_TENANTS,
  MOCK_TENANT_STATS,
  MOCK_MODELS,
  MOCK_MODEL_STATS,
  MOCK_PROVIDERS,
  MOCK_PROVIDER_STATS,
  MOCK_INVOICES,
  MOCK_BILLING_STATS,
  MOCK_PRICING_TIERS,
  MOCK_SECURITY_EVENTS,
  DEFAULT_SECURITY_CONFIG,
  MOCK_SECURITY_STATS,
  MOCK_INFRA_SERVICES,
  MOCK_INFRA_STATS,
  MOCK_DEPLOYMENTS,
  MOCK_DEPLOYMENT_STATS,
  MOCK_AUDIT_LOGS,
  MOCK_AUDIT_STATS,
  MOCK_PLATFORM_METRICS,
  MOCK_USAGE_BY_MODEL,
  MOCK_USAGE_BY_TENANT,
  DEFAULT_CATO_CONFIG,
  MOCK_CATO_STATS,
  DEFAULT_CONSCIOUSNESS_CONFIG,
  MOCK_CONSCIOUSNESS_STATS,
  MOCK_EXPERIMENTS,
  MOCK_EXPERIMENT_STATS,
  MOCK_COMPLIANCE_STATUS,
  MOCK_COMPLIANCE_STATS,
  MOCK_REGIONS,
  MOCK_GEOGRAPHIC_STATS,
  MOCK_LANGUAGES,
  MOCK_LOCALIZATION_STATS,
  NAV_SECTIONS,
} from './mock-data';

// Icon mapping
const ICONS: Record<string, React.ElementType> = {
  Activity, Building2, Cpu, Cloud, CreditCard, Server, Rocket, Shield,
  ScrollText, Brain, Sparkles, FlaskConical, CheckCircle, Globe, Languages, BarChart3,
};

export default function RadiantAdminSimulatorPage() {
  const [currentView, setCurrentView] = useState<AdminViewType>('overview');
  const [isSimulating, setIsSimulating] = useState(false);
  const [_searchQuery, _setSearchQuery] = useState('');
  void _searchQuery; void _setSearchQuery; // Reserved for search functionality

  // ============================================================================
  // Overview Dashboard
  // ============================================================================
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monthly Recurring Revenue</CardDescription>
            <CardTitle className="text-3xl text-green-600">${(MOCK_BILLING_STATS.mrr / 1000).toFixed(0)}K</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm text-green-600">
              <TrendingUp className="h-4 w-4" />
              +{(MOCK_BILLING_STATS.revenueGrowth * 100).toFixed(0)}% growth
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Tenants</CardDescription>
            <CardTitle className="text-3xl">{MOCK_TENANT_STATS.totalTenants}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {MOCK_TENANT_STATS.activeToday} active today
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>API Calls Today</CardDescription>
            <CardTitle className="text-3xl">{(MOCK_PLATFORM_METRICS.totalApiCalls / 1000000).toFixed(1)}M</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              {MOCK_PLATFORM_METRICS.avgResponseTime}ms avg
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Infrastructure Cost</CardDescription>
            <CardTitle className="text-3xl">${(MOCK_INFRA_STATS.monthlyInfraCost / 1000).toFixed(0)}K/mo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Server className="h-4 w-4" />
              {MOCK_INFRA_STATS.healthyServices}/{MOCK_INFRA_STATS.totalServices} healthy
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Provider Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_PROVIDERS.slice(0, 4).map((provider) => (
              <div key={provider.id} className="flex items-center justify-between">
                <span className="text-sm">{provider.name}</span>
                <Badge variant={provider.status === 'healthy' ? 'default' : 'destructive'}>
                  {provider.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Active Alerts</span>
              <Badge variant="destructive">{MOCK_SECURITY_STATS.activeSecurityAlerts}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Failed Logins Today</span>
              <Badge variant="secondary">{MOCK_SECURITY_STATS.failedLoginsToday}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">MFA Adoption</span>
              <Badge variant="outline">{(MOCK_SECURITY_STATS.mfaAdoptionRate * 100).toFixed(0)}%</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Recent Deployments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_DEPLOYMENTS.slice(0, 3).map((deploy) => (
              <div key={deploy.id} className="flex items-center justify-between">
                <span className="text-sm font-mono">{deploy.version}</span>
                <Badge variant={
                  deploy.status === 'success' ? 'default' :
                  deploy.status === 'in_progress' ? 'secondary' :
                  'destructive'
                }>
                  {deploy.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Top Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Models by Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_USAGE_BY_MODEL.slice(0, 5).map((model) => (
              <div key={model.modelId} className="flex items-center justify-between">
                <span className="text-sm">{model.modelName}</span>
                <div className="text-right">
                  <div className="text-sm font-medium">{(model.invocations / 1000000).toFixed(1)}M calls</div>
                  <div className="text-xs text-muted-foreground">${(model.cost / 1000).toFixed(1)}K</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Tenants by Spend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_USAGE_BY_TENANT.map((tenant) => (
              <div key={tenant.tenantId} className="flex items-center justify-between">
                <span className="text-sm">{tenant.tenantName}</span>
                <div className="text-right">
                  <div className="text-sm font-medium">${tenant.cost.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{tenant.activeUsers} users</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ============================================================================
  // Tenants View
  // ============================================================================
  const renderTenantsView = () => (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Tenants</CardDescription><CardTitle className="text-2xl">{MOCK_TENANT_STATS.totalTenants}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Active Today</CardDescription><CardTitle className="text-2xl">{MOCK_TENANT_STATS.activeToday}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Trial Conversion</CardDescription><CardTitle className="text-2xl text-green-600">{(MOCK_TENANT_STATS.trialConversions * 100).toFixed(0)}%</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Churn Rate</CardDescription><CardTitle className="text-2xl text-red-600">{(MOCK_TENANT_STATS.churnRate * 100).toFixed(1)}%</CardTitle></CardHeader></Card>
      </div>

      {/* Tenant List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tenants</CardTitle>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Tenant</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MOCK_TENANTS.map((tenant) => (
              <div key={tenant.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{tenant.name}</div>
                    <div className="text-sm text-muted-foreground">{tenant.primaryContact}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">${tenant.monthlySpend.toLocaleString()}/mo</div>
                    <div className="text-xs text-muted-foreground">{tenant.userCount} users</div>
                  </div>
                  <Badge variant={tenant.status === 'active' ? 'default' : tenant.status === 'trial' ? 'secondary' : 'destructive'}>
                    {tenant.status}
                  </Badge>
                  <Badge variant="outline">{tenant.tier}</Badge>
                  <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Models View
  // ============================================================================
  const renderModelsView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Models</CardDescription><CardTitle className="text-2xl">{MOCK_MODEL_STATS.totalModels}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Active Models</CardDescription><CardTitle className="text-2xl">{MOCK_MODEL_STATS.activeModels}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total Invocations</CardDescription><CardTitle className="text-2xl">{(MOCK_MODEL_STATS.totalInvocations / 1000000).toFixed(1)}M</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Avg Cost/Request</CardDescription><CardTitle className="text-2xl">${MOCK_MODEL_STATS.avgCostPerRequest.toFixed(4)}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Model Registry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {MOCK_MODELS.slice(0, 10).map((model) => (
              <div key={model.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Switch checked={model.isEnabled} />
                  <div>
                    <div className="font-medium">{model.name}</div>
                    <div className="text-sm text-muted-foreground">{model.provider} • {model.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <div>${model.inputCostPer1k}/1k in • ${model.outputCostPer1k}/1k out</div>
                    <div className="text-muted-foreground">{model.avgLatencyMs}ms • {(model.contextWindow / 1000)}k ctx</div>
                  </div>
                  <Badge variant={model.status === 'active' ? 'default' : 'secondary'}>{model.status}</Badge>
                  <div className="flex gap-1">
                    {model.supportsVision && <Badge variant="outline" className="text-xs">Vision</Badge>}
                    {model.supportsFunctions && <Badge variant="outline" className="text-xs">Functions</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Providers View
  // ============================================================================
  const renderProvidersView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Providers</CardDescription><CardTitle className="text-2xl">{MOCK_PROVIDER_STATS.totalProviders}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Healthy</CardDescription><CardTitle className="text-2xl text-green-600">{MOCK_PROVIDER_STATS.healthyProviders}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Monthly Spend</CardDescription><CardTitle className="text-2xl">${(MOCK_PROVIDER_STATS.totalSpendThisMonth / 1000).toFixed(0)}K</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Avg Error Rate</CardDescription><CardTitle className="text-2xl">{(MOCK_PROVIDER_STATS.avgErrorRate * 100).toFixed(2)}%</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Provider Status</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {MOCK_PROVIDERS.map((provider) => (
              <div key={provider.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${provider.status === 'healthy' ? 'bg-green-500' : provider.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                    <div className="font-medium">{provider.name}</div>
                  </div>
                  <Badge variant={provider.status === 'healthy' ? 'default' : 'destructive'}>{provider.status}</Badge>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Latency:</span> {provider.avgLatencyMs}ms</div>
                  <div><span className="text-muted-foreground">Error Rate:</span> {(provider.errorRate * 100).toFixed(2)}%</div>
                  <div><span className="text-muted-foreground">Usage:</span> {provider.currentUsage}/{provider.rateLimitPerMinute}/min</div>
                  <div><span className="text-muted-foreground">Spend:</span> ${(provider.monthlySpend / 1000).toFixed(0)}K/mo</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Billing View
  // ============================================================================
  const renderBillingView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>MRR</CardDescription><CardTitle className="text-2xl text-green-600">${(MOCK_BILLING_STATS.mrr / 1000).toFixed(0)}K</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>ARR</CardDescription><CardTitle className="text-2xl">${(MOCK_BILLING_STATS.arr / 1000000).toFixed(1)}M</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Pending Invoices</CardDescription><CardTitle className="text-2xl">{MOCK_BILLING_STATS.pendingInvoices}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Overdue</CardDescription><CardTitle className="text-2xl text-red-600">${(MOCK_BILLING_STATS.overdueAmount / 1000).toFixed(0)}K</CardTitle></CardHeader></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MOCK_INVOICES.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{invoice.tenantName}</div>
                    <div className="text-sm text-muted-foreground">Due: {invoice.dueDate}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-bold">${invoice.amount.toLocaleString()}</div>
                    <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'overdue' ? 'destructive' : 'secondary'}>
                      {invoice.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pricing Tiers</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MOCK_PRICING_TIERS.map((tier) => (
                <div key={tier.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {tier.name}
                      {tier.isPopular && <Badge variant="secondary">Popular</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">{tier.includedCredits.toLocaleString()} credits</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">${tier.monthlyPrice}/mo</div>
                    <div className="text-xs text-muted-foreground">${tier.annualPrice}/yr</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ============================================================================
  // Security View
  // ============================================================================
  const renderSecurityView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Active Alerts</CardDescription><CardTitle className="text-2xl text-red-600">{MOCK_SECURITY_STATS.activeSecurityAlerts}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Failed Logins Today</CardDescription><CardTitle className="text-2xl">{MOCK_SECURITY_STATS.failedLoginsToday}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Suspicious Activity</CardDescription><CardTitle className="text-2xl text-yellow-600">{MOCK_SECURITY_STATS.suspiciousActivities}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>MFA Adoption</CardDescription><CardTitle className="text-2xl text-green-600">{(MOCK_SECURITY_STATS.mfaAdoptionRate * 100).toFixed(0)}%</CardTitle></CardHeader></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Security Events</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MOCK_SECURITY_EVENTS.map((event) => (
                <div key={event.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={event.severity === 'critical' || event.severity === 'high' ? 'destructive' : event.severity === 'medium' ? 'secondary' : 'outline'}>
                      {event.severity}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                  </div>
                  <div className="text-sm">{event.details}</div>
                  <div className="text-xs text-muted-foreground mt-1">IP: {event.ipAddress}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Security Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>MFA Required</Label>
              <Switch checked={DEFAULT_SECURITY_CONFIG.mfaRequired} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Session Timeout</Label>
              <span className="text-sm">{DEFAULT_SECURITY_CONFIG.sessionTimeoutMinutes} minutes</span>
            </div>
            <div className="flex items-center justify-between">
              <Label>Max Login Attempts</Label>
              <span className="text-sm">{DEFAULT_SECURITY_CONFIG.maxLoginAttempts}</span>
            </div>
            <div className="flex items-center justify-between">
              <Label>API Key Rotation</Label>
              <span className="text-sm">{DEFAULT_SECURITY_CONFIG.apiKeyRotationDays} days</span>
            </div>
            <div className="flex items-center justify-between">
              <Label>Audit Log Retention</Label>
              <span className="text-sm">{DEFAULT_SECURITY_CONFIG.auditLogRetentionDays} days</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // ============================================================================
  // Infrastructure View
  // ============================================================================
  const renderInfrastructureView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Services</CardDescription><CardTitle className="text-2xl">{MOCK_INFRA_STATS.totalServices}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Healthy</CardDescription><CardTitle className="text-2xl text-green-600">{MOCK_INFRA_STATS.healthyServices}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Monthly Cost</CardDescription><CardTitle className="text-2xl">${(MOCK_INFRA_STATS.monthlyInfraCost / 1000).toFixed(0)}K</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Lambda Invocations</CardDescription><CardTitle className="text-2xl">{(MOCK_INFRA_STATS.totalLambdaInvocations / 1000000).toFixed(0)}M</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Services</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MOCK_INFRA_SERVICES.map((service) => (
              <div key={service.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${service.status === 'running' ? 'bg-green-500' : service.status === 'scaling' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
                  <div>
                    <div className="font-medium">{service.name}</div>
                    <div className="text-sm text-muted-foreground">{service.type} • {service.region}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  {service.cpuUtilization !== undefined && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">CPU:</span> {service.cpuUtilization}%
                    </div>
                  )}
                  {service.memoryUtilization !== undefined && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Memory:</span> {service.memoryUtilization}%
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Cost:</span> ${service.costPerHour.toFixed(2)}/hr
                  </div>
                  <Badge variant={service.status === 'running' ? 'default' : 'secondary'}>{service.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Deployments View
  // ============================================================================
  const renderDeploymentsView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Deployments</CardDescription><CardTitle className="text-2xl">{MOCK_DEPLOYMENT_STATS.totalDeployments}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Success Rate</CardDescription><CardTitle className="text-2xl text-green-600">{(MOCK_DEPLOYMENT_STATS.successRate * 100).toFixed(0)}%</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>This Week</CardDescription><CardTitle className="text-2xl">{MOCK_DEPLOYMENT_STATS.deploymentsThisWeek}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Avg Deploy Time</CardDescription><CardTitle className="text-2xl">{MOCK_DEPLOYMENT_STATS.avgDeploymentTime}m</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Deployments</CardTitle>
            <Button size="sm"><Rocket className="h-4 w-4 mr-2" />New Deploy</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MOCK_DEPLOYMENTS.map((deploy) => (
              <div key={deploy.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold">{deploy.version}</span>
                    <Badge variant="outline">{deploy.environment}</Badge>
                  </div>
                  <Badge variant={deploy.status === 'success' ? 'default' : deploy.status === 'in_progress' ? 'secondary' : 'destructive'}>
                    {deploy.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  By {deploy.deployedBy} • {deploy.startedAt}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {deploy.changes.map((change, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{change}</Badge>
                  ))}
                </div>
                {deploy.rollbackAvailable && (
                  <Button variant="outline" size="sm" className="mt-3">
                    <RefreshCw className="h-3 w-3 mr-2" />Rollback
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Audit View
  // ============================================================================
  const renderAuditView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Events</CardDescription><CardTitle className="text-2xl">{(MOCK_AUDIT_STATS.totalEvents / 1000000).toFixed(1)}M</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Events Today</CardDescription><CardTitle className="text-2xl">{MOCK_AUDIT_STATS.eventsToday.toLocaleString()}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Unique Users</CardDescription><CardTitle className="text-2xl">{MOCK_AUDIT_STATS.uniqueUsers}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Top Action</CardDescription><CardTitle className="text-2xl capitalize">{MOCK_AUDIT_STATS.topActions[0]?.action}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Audit Logs</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="Search logs..." className="w-64" />
              <Button variant="outline"><Filter className="h-4 w-4 mr-2" />Filter</Button>
              <Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {MOCK_AUDIT_LOGS.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="capitalize">{log.action}</Badge>
                  <span className="font-medium">{log.userName}</span>
                  <span className="text-muted-foreground">{log.details}</span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>{log.ipAddress}</span>
                  <span>{log.timestamp}</span>
                  {log.success ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Analytics View
  // ============================================================================
  const renderAnalyticsView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total API Calls</CardDescription><CardTitle className="text-2xl">{(MOCK_PLATFORM_METRICS.totalApiCalls / 1000000).toFixed(1)}M</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Avg Response Time</CardDescription><CardTitle className="text-2xl">{MOCK_PLATFORM_METRICS.avgResponseTime}ms</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Error Rate</CardDescription><CardTitle className="text-2xl">{(MOCK_PLATFORM_METRICS.errorRate * 100).toFixed(2)}%</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Active Users</CardDescription><CardTitle className="text-2xl">{MOCK_PLATFORM_METRICS.activeUsers.toLocaleString()}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Analytics Dashboard</CardTitle></CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Interactive charts render here</p>
            <p className="text-sm">Connected to real metrics in production</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Cato Safety View
  // ============================================================================
  const renderCatoView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Safety Checks</CardDescription><CardTitle className="text-2xl">{(MOCK_CATO_STATS.totalSafetyChecks / 1000000).toFixed(1)}M</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>CBF Violations</CardDescription><CardTitle className="text-2xl text-yellow-600">{MOCK_CATO_STATS.cbfViolations.toLocaleString()}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Human Escalations</CardDescription><CardTitle className="text-2xl">{MOCK_CATO_STATS.escalationsToHuman}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Avg Confidence</CardDescription><CardTitle className="text-2xl text-green-600">{(MOCK_CATO_STATS.avgConfidenceScore * 100).toFixed(0)}%</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Cato Safety Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Safety Layers</Label>
                <Switch checked={DEFAULT_CATO_CONFIG.safetyLayersEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Precision Governor</Label>
                <Switch checked={DEFAULT_CATO_CONFIG.precisionGovernorEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Veto System</Label>
                <Switch checked={DEFAULT_CATO_CONFIG.vetoEnabled} />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Default Mood</Label>
                <Select defaultValue={DEFAULT_CATO_CONFIG.defaultMood}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">⚖️ Balanced</SelectItem>
                    <SelectItem value="scout">🔍 Scout</SelectItem>
                    <SelectItem value="sage">🧙 Sage</SelectItem>
                    <SelectItem value="spark">✨ Spark</SelectItem>
                    <SelectItem value="guide">🧭 Guide</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>CBF Enforcement</Label>
                <Select defaultValue={DEFAULT_CATO_CONFIG.cbfEnforcementMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enforce">Enforce</SelectItem>
                    <SelectItem value="monitor">Monitor Only</SelectItem>
                    <SelectItem value="off">Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Consciousness View
  // ============================================================================
  const renderConsciousnessView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Memory Items</CardDescription><CardTitle className="text-2xl">{(MOCK_CONSCIOUSNESS_STATS.totalMemoryItems / 1000000).toFixed(1)}M</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Brain Plans</CardDescription><CardTitle className="text-2xl">{(MOCK_CONSCIOUSNESS_STATS.brainPlansGenerated / 1000).toFixed(0)}K</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Metacognition Events</CardDescription><CardTitle className="text-2xl">{(MOCK_CONSCIOUSNESS_STATS.metacognitionEvents / 1000).toFixed(0)}K</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Retrieval Confidence</CardDescription><CardTitle className="text-2xl">{(MOCK_CONSCIOUSNESS_STATS.avgRetrievalConfidence * 100).toFixed(0)}%</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Consciousness Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Ghost Memory</Label>
                <Switch checked={DEFAULT_CONSCIOUSNESS_CONFIG.ghostMemoryEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Brain Planner</Label>
                <Switch checked={DEFAULT_CONSCIOUSNESS_CONFIG.brainPlannerEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Metacognition</Label>
                <Switch checked={DEFAULT_CONSCIOUSNESS_CONFIG.metacognitionEnabled} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Empiricism</Label>
                <Switch checked={DEFAULT_CONSCIOUSNESS_CONFIG.empiricismEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Formal Reasoning</Label>
                <Switch checked={DEFAULT_CONSCIOUSNESS_CONFIG.formalReasoningEnabled} />
              </div>
              <div>
                <Label>Memory Retention: {DEFAULT_CONSCIOUSNESS_CONFIG.memoryRetentionDays} days</Label>
                <Slider defaultValue={[DEFAULT_CONSCIOUSNESS_CONFIG.memoryRetentionDays]} max={365} step={1} className="mt-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Experiments View
  // ============================================================================
  const renderExperimentsView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Experiments</CardDescription><CardTitle className="text-2xl">{MOCK_EXPERIMENT_STATS.totalExperiments}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Active</CardDescription><CardTitle className="text-2xl text-green-600">{MOCK_EXPERIMENT_STATS.activeExperiments}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Completed</CardDescription><CardTitle className="text-2xl">{MOCK_EXPERIMENT_STATS.completedExperiments}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Avg Lift</CardDescription><CardTitle className="text-2xl text-green-600">+{(MOCK_EXPERIMENT_STATS.avgLift * 100).toFixed(0)}%</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>A/B Experiments</CardTitle>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />New Experiment</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {MOCK_EXPERIMENTS.map((exp) => (
              <div key={exp.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{exp.name}</div>
                  <Badge variant={exp.status === 'running' ? 'default' : exp.status === 'completed' ? 'secondary' : 'outline'}>
                    {exp.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{exp.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex gap-2">
                    {exp.variants.map((v) => (
                      <Badge key={v.id} variant="outline">{v.name}: {v.weight}%</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-4">
                    <span>{exp.participantCount.toLocaleString()} participants</span>
                    <span className={exp.confidence >= 0.95 ? 'text-green-600' : 'text-muted-foreground'}>
                      {(exp.confidence * 100).toFixed(0)}% confidence
                    </span>
                    {exp.currentWinner && <Badge variant="default">Winner: {exp.currentWinner}</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Compliance View
  // ============================================================================
  const renderComplianceView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Frameworks</CardDescription><CardTitle className="text-2xl">{MOCK_COMPLIANCE_STATS.frameworksCovered}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Open Issues</CardDescription><CardTitle className="text-2xl text-yellow-600">{MOCK_COMPLIANCE_STATS.openIssues}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Overall Score</CardDescription><CardTitle className="text-2xl text-green-600">{MOCK_COMPLIANCE_STATS.overallScore}%</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Last Audit</CardDescription><CardTitle className="text-2xl">{MOCK_COMPLIANCE_STATS.lastAuditDate}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Compliance Frameworks</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MOCK_COMPLIANCE_STATUS.map((comp) => (
              <div key={comp.framework} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Badge variant={comp.status === 'compliant' ? 'default' : comp.status === 'in_progress' ? 'secondary' : 'destructive'}>
                    {comp.framework}
                  </Badge>
                  <span className="capitalize">{comp.status.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-muted-foreground">Last: {comp.lastAudit}</span>
                  <span className="text-muted-foreground">Next: {comp.nextAudit}</span>
                  {comp.issues > 0 && <Badge variant="destructive">{comp.issues} issues</Badge>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Geographic View
  // ============================================================================
  const renderGeographicView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Regions</CardDescription><CardTitle className="text-2xl">{MOCK_GEOGRAPHIC_STATS.totalRegions}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Active</CardDescription><CardTitle className="text-2xl text-green-600">{MOCK_GEOGRAPHIC_STATS.activeRegions}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Data Residency</CardDescription><CardTitle className="text-2xl">{MOCK_GEOGRAPHIC_STATS.tenantsWithDataResidency}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Avg Latency</CardDescription><CardTitle className="text-2xl">{MOCK_GEOGRAPHIC_STATS.avgGlobalLatency}ms</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Regions</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MOCK_REGIONS.map((region) => (
              <div key={region.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{region.name}</div>
                    <div className="text-sm text-muted-foreground">{region.code}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-sm">{region.tenantCount} tenants</div>
                  <div className="text-sm">{region.latencyMs}ms</div>
                  {region.dataResidency && <Badge variant="outline">Data Residency</Badge>}
                  <Badge variant={region.status === 'active' ? 'default' : 'secondary'}>{region.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Localization View
  // ============================================================================
  const renderLocalizationView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Languages</CardDescription><CardTitle className="text-2xl">{MOCK_LOCALIZATION_STATS.totalLanguages}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Enabled</CardDescription><CardTitle className="text-2xl text-green-600">{MOCK_LOCALIZATION_STATS.enabledLanguages}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total Strings</CardDescription><CardTitle className="text-2xl">{MOCK_LOCALIZATION_STATS.totalStrings.toLocaleString()}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Avg Progress</CardDescription><CardTitle className="text-2xl">{MOCK_LOCALIZATION_STATS.avgTranslationProgress}%</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Languages</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MOCK_LANGUAGES.map((lang) => (
              <div key={lang.code} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Switch checked={lang.isEnabled} />
                  <div>
                    <div className="font-medium">{lang.name}</div>
                    <div className="text-sm text-muted-foreground">{lang.nativeName} {lang.isRTL && '(RTL)'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 w-64">
                  <Progress value={lang.translationProgress} className="flex-1" />
                  <span className="text-sm w-12 text-right">{lang.translationProgress}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Render Content
  // ============================================================================
  const renderContent = () => {
    switch (currentView) {
      case 'overview': return renderOverview();
      case 'tenants': return renderTenantsView();
      case 'models': return renderModelsView();
      case 'providers': return renderProvidersView();
      case 'billing': return renderBillingView();
      case 'security': return renderSecurityView();
      case 'infrastructure': return renderInfrastructureView();
      case 'deployments': return renderDeploymentsView();
      case 'audit': return renderAuditView();
      case 'analytics': return renderAnalyticsView();
      case 'cato': return renderCatoView();
      case 'consciousness': return renderConsciousnessView();
      case 'experiments': return renderExperimentsView();
      case 'compliance': return renderComplianceView();
      case 'geographic': return renderGeographicView();
      case 'localization': return renderLocalizationView();
      default: return null;
    }
  };

  // ============================================================================
  // Main Layout
  // ============================================================================
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">Radiant Admin</h1>
          <p className="text-xs text-muted-foreground">Platform Simulator</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-4">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {section.title}
              </div>
              {section.items.map((item) => {
                const Icon = ICONS[item.icon] || Activity;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id as AdminViewType)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                      currentView === item.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </div>
                    {item.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Simulation Controls */}
        <div className="p-4 border-t space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Simulation</Label>
          <Button 
            variant={isSimulating ? 'destructive' : 'default'} 
            className="w-full"
            onClick={() => setIsSimulating(!isSimulating)}
          >
            {isSimulating ? <><Pause className="h-4 w-4 mr-2" />Stop</> : <><Play className="h-4 w-4 mr-2" />Start</>}
          </Button>
          <Button variant="outline" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />Reset
          </Button>
          <Button variant="outline" className="w-full">
            <Save className="h-4 w-4 mr-2" />Export
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
