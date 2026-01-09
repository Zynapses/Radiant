'use client';

/**
 * Error Boundary Component
 * 
 * RADIANT v5.2.1 - Production Hardening
 * 
 * Catches JavaScript errors anywhere in the component tree,
 * logs errors, and displays a fallback UI instead of crashing.
 */

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI to render on error */
  fallback?: ReactNode;
  /** Whether to show detailed error info (dev mode) */
  showDetails?: boolean;
  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Component name for logging context */
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

// ============================================================================
// Error Boundary Component
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console
    console.error('[ErrorBoundary] Caught error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      componentName: this.props.componentName,
    });

    // Store error info for display
    this.setState({ errorInfo });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, send to error tracking service
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      this.reportError(error, errorInfo);
    }
  }

  private reportError(error: Error, errorInfo: React.ErrorInfo): void {
    // Send to error tracking service (e.g., Sentry, CloudWatch)
    try {
      fetch('/api/admin/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          componentName: this.props.componentName,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {
        // Silently fail - don't cause more errors
      });
    } catch {
      // Ignore errors in error reporting
    }
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <DashboardErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          showDetails={this.props.showDetails}
          componentName={this.props.componentName}
          onReset={this.handleReset}
          onReload={this.handleReload}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// Default Error Fallback UI
// ============================================================================

interface DashboardErrorFallbackProps {
  error?: Error;
  errorInfo?: React.ErrorInfo;
  showDetails?: boolean;
  componentName?: string;
  onReset: () => void;
  onReload: () => void;
  onGoHome: () => void;
}

function DashboardErrorFallback({
  error,
  errorInfo,
  showDetails,
  componentName,
  onReset,
  onReload,
  onGoHome,
}: DashboardErrorFallbackProps) {
  const isDev = process.env.NODE_ENV === 'development';
  const shouldShowDetails = showDetails ?? isDev;

  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-red-200 dark:border-red-800 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Something went wrong
            </h2>
            {componentName && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Error in: {componentName}
              </p>
            )}
          </div>
        </div>

        {/* Error Message */}
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <button
            onClick={onReload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>
          <button
            onClick={onGoHome}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </button>
        </div>

        {/* Error Details (dev mode) */}
        {shouldShowDetails && error && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1">
              <Bug className="w-4 h-4" />
              Technical Details
            </summary>
            <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded-md overflow-auto max-h-64">
              <p className="text-xs font-mono text-red-600 dark:text-red-400 mb-2">
                {error.name}: {error.message}
              </p>
              {error.stack && (
                <pre className="text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {error.stack}
                </pre>
              )}
              {errorInfo?.componentStack && (
                <>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-3 mb-1">
                    Component Stack:
                  </p>
                  <pre className="text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {errorInfo.componentStack}
                  </pre>
                </>
              )}
            </div>
          </details>
        )}

        {/* Support Info */}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
          If this problem persists, please contact support with error ID:{' '}
          <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
            {Date.now().toString(36)}
          </code>
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Page-Level Error Boundary Wrapper
// ============================================================================

interface PageErrorBoundaryProps {
  children: ReactNode;
  pageName: string;
}

export function PageErrorBoundary({ children, pageName }: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      componentName={pageName}
      onError={(error, errorInfo) => {
        console.error(`[${pageName}] Page error:`, error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================================================
// Section-Level Error Boundary (less intrusive)
// ============================================================================

interface SectionErrorBoundaryProps {
  children: ReactNode;
  sectionName: string;
  fallbackHeight?: string;
}

export function SectionErrorBoundary({ 
  children, 
  sectionName,
  fallbackHeight = '200px',
}: SectionErrorBoundaryProps) {
  return (
    <ErrorBoundary
      componentName={sectionName}
      fallback={
        <div 
          className="flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
          style={{ minHeight: fallbackHeight }}
        >
          <div className="text-center p-4">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Failed to load {sectionName}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Reload page
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default ErrorBoundary;
