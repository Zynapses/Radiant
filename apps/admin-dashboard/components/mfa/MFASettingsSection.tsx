'use client';

/**
 * RADIANT v5.52.29 - MFA Settings Section (PROMPT-41B + PROMPT-41D i18n)
 * 
 * Settings panel for managing MFA configuration, backup codes, and trusted devices.
 * Now with full i18n support for 18 languages including RTL.
 */

import { useState, useEffect, useCallback } from 'react';
import { Shield, Key, Smartphone, Trash2, AlertTriangle, Check, Copy, Loader2, RefreshCw, Monitor } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useRTL } from '@/hooks/useRTL';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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

interface MFAStatus {
  enabled: boolean;
  enrolledAt?: string;
  method?: string;
  backupCodesRemaining: number;
  trustedDevices: TrustedDevice[];
  isRequired: boolean;
  canDisable: boolean;
}

interface TrustedDevice {
  id: string;
  deviceName: string;
  trustedAt: string;
  lastUsedAt?: string;
  expiresAt: string;
  current: boolean;
}

export function MFASettingsSection() {
  const { t } = useTranslation('auth');
  const { dir, isRTL } = useRTL();
  
  const [status, setStatus] = useState<MFAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/mfa/status');
      if (!response.ok) throw new Error(t('mfa.settings.error_load'));
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.settings.error_load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const regenerateBackupCodes = async () => {
    setRegeneratingCodes(true);
    try {
      const response = await fetch('/api/mfa/backup-codes/regenerate', {
        method: 'POST',
      });
      if (!response.ok) throw new Error(t('mfa.settings.error_regenerate'));
      const data = await response.json();
      setBackupCodes(data.codes);
      setShowBackupCodes(true);
      fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.settings.error_regenerate'));
    } finally {
      setRegeneratingCodes(false);
    }
  };

  const revokeDevice = async (deviceId: string) => {
    setRevoking(deviceId);
    try {
      const response = await fetch(`/api/mfa/devices/${deviceId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(t('mfa.settings.error_revoke'));
      fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.settings.error_revoke'));
    } finally {
      setRevoking(null);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setBackupCodesCopied(true);
    setTimeout(() => setBackupCodesCopied(false), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <CardContent className="py-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error || t('mfa.settings.error_load')}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between" dir={dir}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{t('mfa.settings.title')}</CardTitle>
                <CardDescription>
                  {status.isRequired
                    ? t('mfa.settings.required_role')
                    : t('mfa.settings.description')}
                </CardDescription>
              </div>
            </div>
            <Badge variant={status.enabled ? 'default' : 'secondary'}>
              {status.enabled ? t('mfa.settings.enabled') : t('mfa.settings.disabled')}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {status.enabled && (
            <>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{t('mfa.settings.authenticator_app')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('mfa.settings.enabled_on', { date: status.enrolledAt ? formatDate(status.enrolledAt) : '' })}
                    </p>
                  </div>
                </div>
                <Check className="h-5 w-5 text-green-600" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{t('mfa.settings.backup_codes')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('mfa.settings.codes_remaining', { count: status.backupCodesRemaining })}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={regenerateBackupCodes}
                    disabled={regeneratingCodes}
                  >
                    {regeneratingCodes ? (
                      <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    ) : (
                      <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    )}
                    {t('mfa.settings.regenerate')}
                  </Button>
                </div>

                {status.backupCodesRemaining <= 3 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {t('mfa.settings.low_codes_warning', { count: status.backupCodesRemaining })}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {status.trustedDevices.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-muted-foreground" />
                    <p className="font-medium">{t('mfa.settings.trusted_devices')}</p>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('mfa.settings.device')}</TableHead>
                        <TableHead>{t('mfa.settings.trusted')}</TableHead>
                        <TableHead>{t('mfa.settings.last_used')}</TableHead>
                        <TableHead>{t('mfa.settings.expires')}</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {status.trustedDevices.map((device) => (
                        <TableRow key={device.id}>
                          <TableCell className="font-medium">
                            {device.deviceName}
                            {device.current && (
                              <Badge variant="outline" className={isRTL ? 'mr-2' : 'ml-2'}>{t('mfa.settings.current')}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(device.trustedAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {device.lastUsedAt ? formatDate(device.lastUsedAt) : t('mfa.settings.never')}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(device.expiresAt)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => revokeDevice(device.id)}
                              disabled={revoking === device.id}
                            >
                              {revoking === device.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {!status.canDisable && (
                <p className="text-sm text-muted-foreground">
                  {t('mfa.settings.cannot_disable')}
                </p>
              )}
            </>
          )}

          {!status.enabled && (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                {t('mfa.settings.not_enabled')}
              </p>
              {status.isRequired && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {t('mfa.settings.required_prompt')}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('mfa.settings.new_codes_title')}</DialogTitle>
            <DialogDescription>
              {t('mfa.settings.new_codes_description')}
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('mfa.settings.codes_shown_once')}
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-lg">
            {backupCodes.map((code, i) => (
              <code key={i} className="text-sm font-mono text-center py-1 preserve-ltr" dir="ltr">
                {code}
              </code>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={copyBackupCodes}>
              {backupCodesCopied ? <Check className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> : <Copy className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />}
              {backupCodesCopied ? t('mfa.enrollment.copied') : t('mfa.enrollment.copy_all')}
            </Button>
            <Button onClick={() => setShowBackupCodes(false)}>{t('common.done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
