'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ThinkTankError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ThinkTankError]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <Card className="max-w-md w-full border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Failed to load Think Tank
          </CardTitle>
          <CardDescription>
            An error occurred while loading Think Tank data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <p className="text-sm font-mono bg-muted p-2 rounded text-destructive">
              {error.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={reset} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Button onClick={() => window.history.back()} variant="ghost" size="sm">
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
