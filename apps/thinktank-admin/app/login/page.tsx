'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { Zap, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle error from URL params (e.g., admin_access_denied redirect)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'admin_access_denied') {
      setError('Your session has expired or you no longer have administrator privileges. Please sign in again.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login({ email, password, tenantId });
      router.push('/');
    } catch (err: any) {
      // Handle specific admin access denied error
      if (err.code === 'ADMIN_ACCESS_DENIED') {
        setError('This portal requires administrator privileges. Only TenantAdmin and SuperAdmin users can access Think Tank Admin.');
      } else {
        setError(err.message || 'Login failed');
      }
    }
  };

  return (
    <div className="w-full max-w-md p-8">
      <div className="bg-card rounded-2xl shadow-2xl p-8 border border-border">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Think Tank</h1>
            <p className="text-sm text-muted-foreground">Administration</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="tenantId" className="block text-sm font-medium mb-2">
              Organization ID
            </label>
            <input
              id="tenantId"
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="your-organization"
              required
              className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <a href="/forgot-password" className="text-primary hover:underline">
            Forgot password?
          </a>
        </div>

        {/* Admin-only notice */}
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-amber-500">
            <ShieldAlert className="h-4 w-4" />
            <span>Administrator access only</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            This portal is restricted to TenantAdmin and SuperAdmin users.
            Regular users should access Think Tank at <a href="https://app.thinktank.ai" className="text-primary hover:underline">app.thinktank.ai</a>
          </p>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        Authentication via Radiant API • Admin role validated on every request
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Suspense fallback={
        <div className="w-full max-w-md p-8">
          <div className="bg-card rounded-2xl shadow-2xl p-8 border border-border flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
