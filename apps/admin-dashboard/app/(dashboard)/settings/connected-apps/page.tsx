'use client';

/**
 * RADIANT v5.52.26 - User Connected Apps Settings
 * 
 * Allows users to view and revoke OAuth authorizations granted to third-party apps.
 */

import { useState } from 'react';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { 
  Shield, Key, Globe, Clock, AlertTriangle, Trash2, 
  CheckCircle2, ExternalLink, RefreshCw
} from 'lucide-react';

interface ConnectedApp {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  homepageUrl?: string;
  appType: string;
  scopes: string[];
  authorizedAt: string;
  lastUsedAt?: string;
  accessCount: number;
}

interface ScopeInfo {
  name: string;
  displayName: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
}

const SCOPE_RISK_COLORS = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function ConnectedAppsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [revokeApp, setRevokeApp] = useState<ConnectedApp | null>(null);

  // Fetch connected apps
  const { data: apps = [], isLoading, refetch } = useQuery<ConnectedApp[]>({
    queryKey: ['connected-apps'],
    queryFn: async () => {
      const response = await fetch('/api/oauth/user/authorizations');
      if (!response.ok) throw new Error('Failed to fetch connected apps');
      const data = await response.json();
      return data.authorizations || [];
    },
  });

  // Fetch scope information
  const { data: scopeInfo = {} } = useQuery<Record<string, ScopeInfo>>({
    queryKey: ['scope-info'],
    queryFn: async () => {
      const response = await fetch('/api/oauth/scopes');
      if (!response.ok) return {};
      const data = await response.json();
      return (data.scopes || []).reduce((acc: Record<string, ScopeInfo>, scope: ScopeInfo) => {
        acc[scope.name] = scope;
        return acc;
      }, {});
    },
  });

  // Revoke authorization mutation
  const revokeAuthorization = useMutation({
    mutationFn: async (authorizationId: string) => {
      const response = await fetch(`/api/oauth/user/authorizations/${authorizationId}/revoke`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to revoke authorization');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connected-apps'] });
      setRevokeApp(null);
      toast({ 
        title: t('settings.connectedApps.revoked'),
        description: t('settings.connectedApps.revokedDescription'),
      });
    },
    onError: () => {
      toast({ 
        title: t('settings.connectedApps.revokeError'),
        variant: 'destructive',
      });
    },
  });

  // Count high-risk scopes
  const highRiskApps = apps.filter(app => 
    app.scopes.some(scope => scopeInfo[scope]?.riskLevel === 'high')
  ).length;

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="h-8 w-8" />
            {t('settings.connectedApps.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('settings.connectedApps.description')}
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Security Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('settings.connectedApps.totalApps')}
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{apps.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('settings.connectedApps.appsWithAccess')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('settings.connectedApps.highRiskApps')}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highRiskApps}</div>
            <p className="text-xs text-muted-foreground">
              {t('settings.connectedApps.highRiskDescription')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('settings.connectedApps.lastActivity')}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apps.length > 0 && apps[0].lastUsedAt
                ? new Date(apps[0].lastUsedAt).toLocaleDateString()
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('settings.connectedApps.mostRecentAccess')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* High Risk Warning */}
      {highRiskApps > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('settings.connectedApps.securityWarning')}</AlertTitle>
          <AlertDescription>
            {t('settings.connectedApps.highRiskWarning', { count: highRiskApps })}
          </AlertDescription>
        </Alert>
      )}

      {/* Connected Apps List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.connectedApps.authorizedApps')}</CardTitle>
          <CardDescription>
            {t('settings.connectedApps.authorizedAppsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : apps.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {t('settings.connectedApps.noApps')}
              </h3>
              <p className="text-muted-foreground">
                {t('settings.connectedApps.noAppsDescription')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {apps.map((app) => (
                <div
                  key={app.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex gap-4">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                      {app.logoUrl ? (
                        <Image src={app.logoUrl} alt={app.name} width={32} height={32} className="rounded" />
                      ) : (
                        <Globe className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{app.name}</h3>
                        {app.homepageUrl && (
                          <a
                            href={app.homepageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {app.description && (
                        <p className="text-sm text-muted-foreground">{app.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {app.scopes.map((scope) => {
                          const info = scopeInfo[scope];
                          return (
                            <Badge
                              key={scope}
                              variant="outline"
                              className={info ? SCOPE_RISK_COLORS[info.riskLevel] : ''}
                            >
                              {info?.displayName || scope}
                            </Badge>
                          );
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {t('settings.connectedApps.authorizedOn', {
                          date: new Date(app.authorizedAt).toLocaleDateString(),
                        })}
                        {app.lastUsedAt && (
                          <>
                            {' • '}
                            {t('settings.connectedApps.lastUsed', {
                              date: new Date(app.lastUsedAt).toLocaleDateString(),
                            })}
                          </>
                        )}
                        {' • '}
                        {t('settings.connectedApps.accessCount', { count: app.accessCount })}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setRevokeApp(app)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t('settings.connectedApps.revoke')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={!!revokeApp} onOpenChange={() => setRevokeApp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.connectedApps.revokeTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.connectedApps.revokeConfirmation', { name: revokeApp?.name || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('settings.connectedApps.revokeWarning')}
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeApp(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeApp && revokeAuthorization.mutate(revokeApp.id)}
              disabled={revokeAuthorization.isPending}
            >
              {revokeAuthorization.isPending 
                ? t('settings.connectedApps.revoking')
                : t('settings.connectedApps.confirmRevoke')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
