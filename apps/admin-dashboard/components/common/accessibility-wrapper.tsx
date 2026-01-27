'use client';

/**
 * Accessibility Wrapper Component
 * Provides aria-live regions and accessibility enhancements for dashboard pages
 */

import * as React from 'react';

interface AccessibilityWrapperProps {
  children: React.ReactNode;
  pageTitle: string;
  loadingMessage?: string;
  errorMessage?: string;
  successMessage?: string;
  isLoading?: boolean;
}

/**
 * Wraps dashboard content with accessibility features:
 * - aria-live regions for dynamic content announcements
 * - Skip links for keyboard navigation
 * - Loading state announcements
 * - Error state announcements
 */
export function AccessibilityWrapper({
  children,
  pageTitle,
  loadingMessage,
  errorMessage,
  successMessage,
  isLoading = false,
}: AccessibilityWrapperProps) {
  const [announcement, setAnnouncement] = React.useState('');

  // Announce page title on mount
  React.useEffect(() => {
    setAnnouncement(`${pageTitle} page loaded`);
  }, [pageTitle]);

  // Announce loading state changes
  React.useEffect(() => {
    if (isLoading && loadingMessage) {
      setAnnouncement(loadingMessage);
    }
  }, [isLoading, loadingMessage]);

  // Announce errors
  React.useEffect(() => {
    if (errorMessage) {
      setAnnouncement(`Error: ${errorMessage}`);
    }
  }, [errorMessage]);

  // Announce success
  React.useEffect(() => {
    if (successMessage) {
      setAnnouncement(successMessage);
    }
  }, [successMessage]);

  return (
    <>
      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>

      {/* Polite announcements for non-urgent updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Assertive announcements for urgent updates (errors) */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {errorMessage}
      </div>

      {/* Main content area */}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}

/**
 * Hook for announcing dynamic content changes
 */
export function useAnnouncement() {
  const [announcement, setAnnouncement] = React.useState('');

  const announce = React.useCallback((message: string) => {
    // Clear first to ensure re-announcement of same message
    setAnnouncement('');
    setTimeout(() => setAnnouncement(message), 100);
  }, []);

  return {
    announcement,
    announce,
    AnnouncementRegion: () => (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    ),
  };
}

/**
 * Loading state component with accessibility
 */
export function AccessibleLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex items-center justify-center p-8"
    >
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3" />
      <span>{message}</span>
    </div>
  );
}

/**
 * Error state component with accessibility
 */
export function AccessibleError({ 
  title = 'Error',
  message,
  onRetry,
}: { 
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="p-4 border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 rounded-lg"
    >
      <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
        {title}
      </h2>
      <p className="mt-1 text-red-700 dark:text-red-300">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

/**
 * Data table with accessibility enhancements
 */
export function AccessibleDataTable({
  caption,
  headers,
  children,
  sortColumn,
  sortDirection,
}: {
  caption: string;
  headers: { key: string; label: string; sortable?: boolean }[];
  children: React.ReactNode;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
}) {
  return (
    <table className="w-full border-collapse" role="grid">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {headers.map((header) => (
            <th
              key={header.key}
              scope="col"
              aria-sort={
                sortColumn === header.key
                  ? sortDirection === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : undefined
              }
              className="text-left p-3 border-b font-medium"
            >
              {header.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export default AccessibilityWrapper;
