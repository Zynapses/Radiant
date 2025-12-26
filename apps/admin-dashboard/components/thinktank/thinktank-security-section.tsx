'use client';

/**
 * Think Tank Security Section
 * Displays Think Tank security status and controls in the Security page
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Brain,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Key,
  Users,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  FileWarning,
  Globe,
  Server,
} from 'lucide-react';
import Link from 'next/link';

interface ThinkTankStatus {
  installed: boolean;
  version: string | null;
  dataRetained: boolean;
  uninstallDate: string | null;
}

interface ThinkTankSecurityConfig {
  dataEncryptionEnabled: boolean;
  auditLoggingEnabled: boolean;
  ipWhitelistEnabled: boolean;
  mfaRequired: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  dataRetentionDays: number;
  piiMaskingEnabled: boolean;
  exportRestricted: boolean;
}

// Mock security config - in production, fetch from API
const mockSecurityConfig: ThinkTankSecurityConfig = {
  dataEncryptionEnabled: true,
  auditLoggingEnabled: true,
  ipWhitelistEnabled: false,
  mfaRequired: true,
  sessionTimeout: 30,
  maxLoginAttempts: 5,
  dataRetentionDays: 365,
  piiMaskingEnabled: true,
  exportRestricted: false,
};

export function ThinkTankSecuritySection() {
  const { data: status, isLoading } = useQuery<ThinkTankStatus>({
    queryKey: ['thinktank', 'status'],
    queryFn: () => fetch('/api/admin/thinktank/status').then(r => r.json()),
  });

  const isViewOnly = !status?.installed && status?.dataRetained;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            <CardTitle>Think Tank Security</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status?.installed && !status?.dataRetained) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Think Tank Security</CardTitle>
          </div>
          <CardDescription>AI Conversation Platform Security</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Think Tank is not installed.</p>
            <p className="text-sm">Security settings will appear here once installed.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            <div>
              <CardTitle>Think Tank Security</CardTitle>
              <CardDescription>Security configuration for AI conversations</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isViewOnly && (
              <Badge variant="secondary">
                <Eye className="h-3 w-3 mr-1" />
                View Only
              </Badge>
            )}
            <Badge variant={mockSecurityConfig.dataEncryptionEnabled ? 'default' : 'destructive'}>
              <ShieldCheck className="h-3 w-3 mr-1" />
              {mockSecurityConfig.dataEncryptionEnabled ? 'Encrypted' : 'Not Encrypted'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Security Status Overview */}
        <div className="grid grid-cols-4 gap-4">
          <SecurityStatusItem
            icon={Lock}
            label="Encryption"
            enabled={mockSecurityConfig.dataEncryptionEnabled}
          />
          <SecurityStatusItem
            icon={FileWarning}
            label="Audit Logs"
            enabled={mockSecurityConfig.auditLoggingEnabled}
          />
          <SecurityStatusItem
            icon={Key}
            label="MFA Required"
            enabled={mockSecurityConfig.mfaRequired}
          />
          <SecurityStatusItem
            icon={EyeOff}
            label="PII Masking"
            enabled={mockSecurityConfig.piiMaskingEnabled}
          />
        </div>

        <Separator />

        {/* Security Settings */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm">Security Settings</h4>
          
          <div className="space-y-3">
            <SecurityToggle
              icon={Lock}
              label="Data Encryption"
              description="Encrypt all conversation data at rest"
              checked={mockSecurityConfig.dataEncryptionEnabled}
              disabled={isViewOnly}
            />
            <SecurityToggle
              icon={FileWarning}
              label="Audit Logging"
              description="Log all user actions and API calls"
              checked={mockSecurityConfig.auditLoggingEnabled}
              disabled={isViewOnly}
            />
            <SecurityToggle
              icon={Globe}
              label="IP Whitelist"
              description="Restrict access to specific IP addresses"
              checked={mockSecurityConfig.ipWhitelistEnabled}
              disabled={isViewOnly}
            />
            <SecurityToggle
              icon={Key}
              label="Require MFA"
              description="Require multi-factor authentication for all users"
              checked={mockSecurityConfig.mfaRequired}
              disabled={isViewOnly}
            />
            <SecurityToggle
              icon={EyeOff}
              label="PII Masking"
              description="Automatically mask sensitive personal information"
              checked={mockSecurityConfig.piiMaskingEnabled}
              disabled={isViewOnly}
            />
            <SecurityToggle
              icon={Server}
              label="Export Restrictions"
              description="Prevent data export without admin approval"
              checked={mockSecurityConfig.exportRestricted}
              disabled={isViewOnly}
            />
          </div>
        </div>

        <Separator />

        {/* Data Retention */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Data Retention</h4>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Conversation History Retention</p>
              <p className="text-xs text-muted-foreground">
                How long to keep conversation data before automatic deletion
              </p>
            </div>
            <Badge variant="outline">{mockSecurityConfig.dataRetentionDays} days</Badge>
          </div>
        </div>

        {/* Security Alerts */}
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-800 dark:text-amber-200">
                Security Recommendation
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Enable IP Whitelist to restrict Think Tank access to trusted networks only.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" size="sm" asChild>
            <Link href="/security/audit-logs?service=thinktank">
              View Audit Logs
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/thinktank/settings">
              All Settings
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityStatusItem({
  icon: Icon,
  label,
  enabled,
}: {
  icon: typeof Shield;
  label: string;
  enabled: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg border ${enabled ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-muted border-muted'}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${enabled ? 'text-green-600' : 'text-muted-foreground'}`} />
        {enabled ? (
          <CheckCircle className="h-3 w-3 text-green-600" />
        ) : (
          <AlertTriangle className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
      <p className={`text-xs font-medium ${enabled ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}`}>
        {label}
      </p>
    </div>
  );
}

function SecurityToggle({
  icon: Icon,
  label,
  description,
  checked,
  disabled,
}: {
  icon: typeof Shield;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <Label className="text-sm">{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} disabled={disabled} />
    </div>
  );
}
