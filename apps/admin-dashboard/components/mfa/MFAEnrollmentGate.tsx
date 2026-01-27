'use client';

/**
 * RADIANT v5.52.29 - MFA Enrollment Gate (PROMPT-41B + PROMPT-41D i18n)
 * 
 * Full-screen overlay that forces MFA enrollment for required roles.
 * Cannot be dismissed or bypassed.
 * Now with full i18n support for 18 languages including RTL.
 */

import { useState } from 'react';
import { Shield, Smartphone, Copy, Check, AlertTriangle, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/hooks/useTranslation';
import { useRTL } from '@/hooks/useRTL';
interface MFAEnrollmentGateProps {
  email: string;
  onEnrollmentComplete: (backupCodes: string[]) => void;
}

type EnrollmentStep = 'intro' | 'scan' | 'verify' | 'backup' | 'complete';

export function MFAEnrollmentGate({ email, onEnrollmentComplete }: MFAEnrollmentGateProps) {
  const { t } = useTranslation('auth');
  const { dir, isRTL } = useRTL();
  
  const [step, setStep] = useState<EnrollmentStep>('intro');
  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);

  const startEnrollment = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/mfa/enroll/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start enrollment');
      }
      
      setSecret(data.secret);
      setUri(data.uri);
      if (data.qrCodeDataUrl) {
        setQrCodeDataUrl(data.qrCodeDataUrl);
      }
      setStep('scan');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start enrollment');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/mfa/enroll/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }
      
      setBackupCodes(data.backupCodes);
      setStep('backup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setBackupCodesCopied(true);
    setTimeout(() => setBackupCodesCopied(false), 2000);
  };

  const completeEnrollment = () => {
    setStep('complete');
    onEnrollmentComplete(backupCodes);
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4" dir={dir}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{t('mfa.enrollment.title')}</CardTitle>
          <CardDescription>
            {t('mfa.enrollment.description')}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === 'intro' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {t('mfa.enrollment.what_you_need')}
              </p>
              <div className={`flex items-center gap-3 p-3 rounded-lg bg-muted ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-medium">{t('mfa.enrollment.recommended_apps')}</p>
                  <p className="text-muted-foreground">{t('mfa.enrollment.app_google')}, {t('mfa.enrollment.app_microsoft')}, {t('mfa.enrollment.app_1password')}, {t('mfa.enrollment.app_authy')}</p>
                </div>
              </div>
              <Button onClick={startEnrollment} className="w-full" disabled={loading}>
                {loading ? <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} /> : null}
                {t('mfa.enrollment.get_started')}
              </Button>
            </div>
          )}

          {step === 'scan' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {t('mfa.enrollment.scan_qr_description')}
              </p>
              
              {qrCodeDataUrl ? (
                <div className="flex justify-center">
                  <Image 
                    src={qrCodeDataUrl} 
                    alt="MFA QR Code" 
                    width={200} 
                    height={200} 
                    className="rounded-lg border" 
                    unoptimized 
                  />
                </div>
              ) : uri ? (
                <div className="flex justify-center p-4">
                  <div className="text-center text-sm text-muted-foreground">
                    <p>{t('mfa.enrollment.cant_scan')}</p>
                  </div>
                </div>
              ) : null}
              
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">
                  {t('mfa.enrollment.enter_manually')}
                </p>
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all preserve-ltr" dir="ltr">
                    {secret}
                  </code>
                  <Button variant="outline" size="icon" onClick={copySecret}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <Button onClick={() => setStep('verify')} className="w-full">
                {t('mfa.enrollment.continue')}
              </Button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {t('mfa.enrollment.verify_description')}
              </p>
              
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono preserve-ltr"
                dir="ltr"
                autoFocus
              />
              
              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Button variant="outline" onClick={() => setStep('scan')} className="flex-1">
                  {t('mfa.enrollment.back')}
                </Button>
                <Button onClick={verifyCode} className="flex-1" disabled={loading || verificationCode.length !== 6}>
                  {loading ? <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} /> : null}
                  {t('mfa.enrollment.verify')}
                </Button>
              </div>
            </div>
          )}

          {step === 'backup' && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('mfa.enrollment.backup_warning')}
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-lg">
                {backupCodes.map((code, i) => (
                  <code key={i} className="text-sm font-mono text-center py-1 preserve-ltr" dir="ltr">
                    {code}
                  </code>
                ))}
              </div>
              
              <Button variant="outline" onClick={copyBackupCodes} className="w-full">
                {backupCodesCopied ? <Check className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> : <Copy className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                {backupCodesCopied ? t('mfa.enrollment.copied') : t('mfa.enrollment.copy_all')}
              </Button>
              
              <Button onClick={completeEnrollment} className="w-full">
                {t('mfa.enrollment.saved_checkbox')}
              </Button>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <p className="font-medium">{t('mfa.enrollment.setup_complete')}</p>
              <p className="text-sm text-muted-foreground">
                {t('mfa.enrollment.description')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
