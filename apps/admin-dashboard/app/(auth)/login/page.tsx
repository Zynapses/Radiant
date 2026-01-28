'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/hooks';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield } from 'lucide-react';
import { MFAEnrollmentGate, MFAVerificationPrompt } from '@/components/mfa';

type AuthStep = 'credentials' | 'mfa_enroll' | 'mfa_verify';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authStep, setAuthStep] = useState<AuthStep>('credentials');
  const [mfaRemainingAttempts, setMfaRemainingAttempts] = useState<number | undefined>();
  const [mfaLockoutUntil, setMfaLockoutUntil] = useState<string | undefined>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const result = await login(email, password);
      
      if (result?.mfaRequired) {
        if (!result.mfaEnrolled) {
          setAuthStep('mfa_enroll');
        } else if (!result.deviceTrusted) {
          setAuthStep('mfa_verify');
        } else {
          router.push('/');
        }
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.login.error'));
    }
  };

  const handleMFAVerify = async (code: string, type: 'totp' | 'backup', rememberDevice: boolean) => {
    try {
      const response = await fetch('/api/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, type, rememberDevice }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.remainingAttempts !== undefined) {
          setMfaRemainingAttempts(data.remainingAttempts);
        }
        if (data.lockoutUntil) {
          setMfaLockoutUntil(data.lockoutUntil);
        }
        throw new Error(data.error || t('auth.mfa.verify.error_failed'));
      }

      router.push('/');
    } catch (err) {
      throw err;
    }
  };

  const handleMFAEnrollmentComplete = () => {
    router.push('/');
  };

  if (authStep === 'mfa_enroll') {
    return <MFAEnrollmentGate email={email} onEnrollmentComplete={handleMFAEnrollmentComplete} />;
  }

  if (authStep === 'mfa_verify') {
    return (
      <MFAVerificationPrompt
        onVerify={handleMFAVerify}
        onCancel={() => setAuthStep('credentials')}
        remainingAttempts={mfaRemainingAttempts}
        lockoutUntil={mfaLockoutUntil}
        allowRememberDevice={true}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-radiant-100 dark:bg-radiant-900">
            <Shield className="h-6 w-6 text-radiant-600 dark:text-radiant-400" />
          </div>
          <CardTitle className="text-2xl font-bold">{t('auth.login.title')}</CardTitle>
          <CardDescription>
            {t('auth.login.description')}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.login.email_label')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.login.email_placeholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.login.password_label')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('auth.login.submit_button')}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      <div className="flex gap-2">
        <a
          href="/thinktank-admin/simulator"
          className="flex-1 text-center py-3 px-4 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-sm font-medium"
        >
          {t('auth.login.think_tank_demo')}
        </a>
        <a
          href="/radiant-admin/simulator"
          className="flex-1 text-center py-3 px-4 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-sm font-medium"
        >
          {t('auth.login.radiant_demo')}
        </a>
      </div>
    </div>
  );
}
