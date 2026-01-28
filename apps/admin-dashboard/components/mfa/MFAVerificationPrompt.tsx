'use client';

/**
 * RADIANT v5.52.29 - MFA Verification Prompt (PROMPT-41B + PROMPT-41D i18n)
 * 
 * Modal dialog for MFA code entry during login.
 * Now with full i18n support for 18 languages including RTL.
 */

import { useState } from 'react';
import { Shield, Key, AlertTriangle, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/useTranslation';
import { useRTL } from '@/hooks/useRTL';

interface MFAVerificationPromptProps {
  onVerify: (code: string, type: 'totp' | 'backup', rememberDevice: boolean) => Promise<void>;
  onCancel?: () => void;
  remainingAttempts?: number;
  lockoutUntil?: string;
  allowRememberDevice?: boolean;
}

export function MFAVerificationPrompt({
  onVerify,
  onCancel,
  remainingAttempts,
  lockoutUntil,
  allowRememberDevice = true,
}: MFAVerificationPromptProps) {
  const { t } = useTranslation('auth');
  const { dir, isRTL } = useRTL();
  
  const [code, setCode] = useState('');
  const [codeType, setCodeType] = useState<'totp' | 'backup'>('totp');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [_lockoutCountdown, _setLockoutCountdown] = useState<number | null>(null);
  void _lockoutCountdown; void _setLockoutCountdown; // Reserved for lockout countdown display

  const isLockedOut = lockoutUntil && new Date(lockoutUntil) > new Date();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLockedOut) return;
    
    const normalizedCode = code.replace(/[-\s]/g, '');
    if (codeType === 'totp' && normalizedCode.length !== 6) {
      setError(t('mfa.verify.error_invalid_totp'));
      return;
    }
    if (codeType === 'backup' && normalizedCode.length < 8) {
      setError(t('mfa.verify.error_invalid_backup'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onVerify(normalizedCode, codeType, rememberDevice);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.verify.error_failed'));
    } finally {
      setLoading(false);
    }
  };

  const formatLockoutTime = () => {
    if (!lockoutUntil) return '';
    const remaining = Math.max(0, Math.ceil((new Date(lockoutUntil).getTime() - Date.now()) / 1000));
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir={dir}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{codeType === 'totp' ? t('mfa.verify.title') : t('mfa.verify.title_backup')}</CardTitle>
          <CardDescription>
            {codeType === 'totp' ? t('mfa.verify.description') : t('mfa.verify.description_backup')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLockedOut && (
            <Alert variant="destructive" className="mb-4">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                {t('mfa.verify.lockout_message', { time: formatLockoutTime() })}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Tabs value={codeType} onValueChange={(v) => setCodeType(v as 'totp' | 'backup')}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="totp" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t('mfa.verify.tab_authenticator')}
                </TabsTrigger>
                <TabsTrigger value="backup" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  {t('mfa.verify.tab_backup')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="totp" className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  {t('mfa.verify.totp_instruction')}
                </p>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest font-mono"
                  disabled={isLockedOut || loading}
                  autoFocus
                />
              </TabsContent>

              <TabsContent value="backup" className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  {t('mfa.verify.backup_instruction')}
                </p>
                <Input
                  type="text"
                  placeholder="XXXX-XXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="text-center text-xl tracking-wider font-mono"
                  disabled={isLockedOut || loading}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">
                  {t('mfa.verify.backup_once_warning')}
                </p>
              </TabsContent>
            </Tabs>

            {allowRememberDevice && (
              <div className="flex items-center space-x-2 mt-4">
                <Checkbox
                  id="remember-device"
                  checked={rememberDevice}
                  onCheckedChange={(checked) => setRememberDevice(checked === true)}
                  disabled={isLockedOut || loading}
                />
                <Label htmlFor="remember-device" className="text-sm text-muted-foreground cursor-pointer">
                  {t('mfa.verify.remember_device')}
                </Label>
              </div>
            )}

            {remainingAttempts !== undefined && remainingAttempts < 3 && !isLockedOut && (
              <p className="text-sm text-amber-600 text-center mt-4">
                {t('mfa.verify.attempts_remaining', { count: remainingAttempts })}
              </p>
            )}

            <div className="flex gap-2 mt-6">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={loading}>
                  {t('common.cancel')}
                </Button>
              )}
              <Button
                type="submit"
                className="flex-1"
                disabled={isLockedOut || loading || code.length === 0}
              >
                {loading ? <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} /> : null}
                {t('mfa.verify.button')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
