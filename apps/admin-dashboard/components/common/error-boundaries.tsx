'use client';

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createLogger } from '@/lib/logging';

const logger = createLogger('ErrorBoundary');

/**
 * Comprehensive Error Boundary System
 * 
 * Provides multiple levels of error boundaries for different use cases:
 * - AppErrorBoundary: Top-level app boundary with full page fallback
 * - PageErrorBoundary: Page-level boundary with navigation options
 * - SectionErrorBoundary: Section-level boundary for isolated components
 * - QueryErrorBoundary: For React Query error handling
 */

// ============================================================================
// ERROR CONTEXT
// ============================================================================

interface ErrorContextValue {
  reportError: (error: Error, context?: Record<string, unknown>) => void;
}

const ErrorContext = React.createContext<ErrorContextValue>({
  reportError: () => {},
});

export const useErrorReporting = () => React.useContext(ErrorContext);

// ============================================================================
// BASE ERROR BOUNDARY
// ============================================================================

interface BaseErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: ErrorFallbackProps) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface BaseErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
  onReset: () => void;
}

class BaseErrorBoundary extends Component<BaseErrorBoundaryProps, BaseErrorBoundaryState> {
  constructor(props: BaseErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<BaseErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Report to error tracking
    logger.error('Caught error in boundary', error, {
      componentStack: errorInfo.componentStack,
    });
    
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      const fallbackProps: ErrorFallbackProps = {
        error: this.state.error,
        errorInfo: this.state.errorInfo,
        onRetry: this.handleRetry,
        onReset: this.handleReset,
      };

      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(fallbackProps);
      }
      
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <DefaultErrorFallback {...fallbackProps} />;
    }

    return this.props.children;
  }
}

// ============================================================================
// FALLBACK COMPONENTS
// ============================================================================

function DefaultErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  return (
    <Card className="border-destructive/50 m-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Something went wrong
        </CardTitle>
        <CardDescription>
          An error occurred while rendering this component
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
          {error?.message || 'An unexpected error occurred'}
        </p>
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

function FullPageErrorFallback({ error, onRetry, onReset }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Application Error</CardTitle>
          <CardDescription>
            Something went wrong. Our team has been notified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && error && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Error details
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                {error.stack || error.message}
              </pre>
            </details>
          )}
          <div className="flex gap-2 justify-center">
            <Button onClick={onRetry} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
            <Button onClick={() => window.location.href = '/'}>
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PageErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="max-w-md w-full border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Page Error
          </CardTitle>
          <CardDescription>
            This page encountered an error and could not load properly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && error && (
            <p className="text-sm font-mono bg-muted p-2 rounded text-destructive">
              {error.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={onRetry} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
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

function SectionErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  return (
    <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5">
      <div className="flex items-start gap-3">
        <Bug className="h-5 w-5 text-destructive mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">
            This section failed to load
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {error?.message || 'An error occurred'}
          </p>
          <Button onClick={onRetry} variant="ghost" size="sm" className="mt-2 h-7 px-2">
            <RefreshCw className="mr-1 h-3 w-3" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SPECIALIZED ERROR BOUNDARIES
// ============================================================================

/**
 * Top-level error boundary for the entire application.
 * Shows a full-page error screen.
 */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <BaseErrorBoundary fallback={(props) => <FullPageErrorFallback {...props} />}>
      {children}
    </BaseErrorBoundary>
  );
}

/**
 * Page-level error boundary.
 * Shows an error within the page layout.
 */
export function PageErrorBoundary({ 
  children,
  onError,
}: { 
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) {
  return (
    <BaseErrorBoundary 
      fallback={(props) => <PageErrorFallback {...props} />}
      onError={onError}
    >
      {children}
    </BaseErrorBoundary>
  );
}

/**
 * Section-level error boundary for isolated components.
 * Shows a compact inline error.
 */
export function SectionErrorBoundary({ 
  children,
  fallback,
}: { 
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <BaseErrorBoundary 
      fallback={fallback || ((props) => <SectionErrorFallback {...props} />)}
    >
      {children}
    </BaseErrorBoundary>
  );
}

/**
 * Error boundary specifically for data fetching components.
 * Integrates well with React Query.
 */
export function QueryErrorBoundary({ 
  children,
  queryKey,
}: { 
  children: ReactNode;
  queryKey?: string;
}) {
  const handleError = (error: Error) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[QueryError${queryKey ? ` ${queryKey}` : ''}]`, error);
    }
  };

  return (
    <BaseErrorBoundary 
      fallback={(props) => (
        <SectionErrorFallback {...props} />
      )}
      onError={handleError}
    >
      {children}
    </BaseErrorBoundary>
  );
}

// ============================================================================
// ERROR BOUNDARY PROVIDER
// ============================================================================

interface ErrorBoundaryProviderProps {
  children: ReactNode;
  onError?: (error: Error, context?: Record<string, unknown>) => void;
}

/**
 * Provider that wraps the app and provides error reporting context.
 */
export function ErrorBoundaryProvider({ children, onError }: ErrorBoundaryProviderProps) {
  const reportError = React.useCallback((error: Error, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorReport]', error, context);
    }
    onError?.(error, context);
  }, [onError]);

  return (
    <ErrorContext.Provider value={{ reportError }}>
      <AppErrorBoundary>
        {children}
      </AppErrorBoundary>
    </ErrorContext.Provider>
  );
}

// Re-export the original ErrorBoundary for backward compatibility
export { BaseErrorBoundary as ErrorBoundary };
