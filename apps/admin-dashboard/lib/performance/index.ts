/**
 * Performance Profiling Infrastructure
 * 
 * Provides comprehensive performance monitoring for the admin dashboard:
 * - Page load timing
 * - Component render timing
 * - API call latency
 * - Memory usage tracking
 * - Core Web Vitals
 */

import { createLogger } from '@/lib/logging';

const logger = createLogger('Performance');

// ============================================================================
// TYPES
// ============================================================================

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'score';
  timestamp: number;
  context?: Record<string, unknown>;
}

interface WebVitals {
  FCP?: number;  // First Contentful Paint
  LCP?: number;  // Largest Contentful Paint
  FID?: number;  // First Input Delay
  CLS?: number;  // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
  INP?: number;  // Interaction to Next Paint
}

interface APIMetrics {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  size?: number;
}

// ============================================================================
// PERFORMANCE COLLECTOR
// ============================================================================

class PerformanceCollector {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 1000;
  private readonly flushInterval = 30000; // 30 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initWebVitals();
      this.startPeriodicFlush();
    }
  }

  private initWebVitals(): void {
    // First Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              this.record('FCP', entry.startTime, 'ms');
            }
          }
        });
        paintObserver.observe({ entryTypes: ['paint'] });

        // Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.record('LCP', lastEntry.startTime, 'ms');
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Layout Shift
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // @ts-expect-error - LayoutShift entry type
            if (!entry.hadRecentInput) {
              // @ts-expect-error - LayoutShift entry type
              clsValue += entry.value;
            }
          }
          this.record('CLS', clsValue, 'score');
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // @ts-expect-error - PerformanceEventTiming entry type
            this.record('FID', entry.processingStart - entry.startTime, 'ms');
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

      } catch (e) {
        logger.warn('Failed to initialize Web Vitals observers', { error: String(e) });
      }
    }

    // Navigation timing
    if (typeof window !== 'undefined' && window.performance?.timing) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const timing = window.performance.timing;
          this.record('TTFB', timing.responseStart - timing.navigationStart, 'ms');
          this.record('DOMContentLoaded', timing.domContentLoadedEventEnd - timing.navigationStart, 'ms');
          this.record('PageLoad', timing.loadEventEnd - timing.navigationStart, 'ms');
        }, 0);
      });
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  record(name: string, value: number, unit: PerformanceMetric['unit'], context?: Record<string, unknown>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      context,
    };

    this.metrics.push(metric);

    // Prevent memory issues
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics / 2);
    }

    // Log significant metrics
    if (name === 'LCP' || name === 'FID' || name === 'CLS') {
      logger.info(`Web Vital: ${name}`, { value, unit });
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getWebVitals(): WebVitals {
    const vitals: WebVitals = {};
    
    for (const metric of this.metrics) {
      if (metric.name === 'FCP') vitals.FCP = metric.value;
      if (metric.name === 'LCP') vitals.LCP = metric.value;
      if (metric.name === 'FID') vitals.FID = metric.value;
      if (metric.name === 'CLS') vitals.CLS = metric.value;
      if (metric.name === 'TTFB') vitals.TTFB = metric.value;
      if (metric.name === 'INP') vitals.INP = metric.value;
    }

    return vitals;
  }

  flush(): void {
    if (this.metrics.length === 0) return;

    const metricsToSend = [...this.metrics];
    this.metrics = [];

    // Send to analytics endpoint (implement as needed)
    logger.debug('Flushing performance metrics', { count: metricsToSend.length });

    // Could POST to /api/analytics/performance
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
  }
}

// ============================================================================
// API TIMING
// ============================================================================

export function measureAPI<T>(
  endpoint: string,
  method: string,
  request: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  return request()
    .then((response) => {
      const duration = performance.now() - startTime;
      performanceCollector?.record('API', duration, 'ms', {
        endpoint,
        method,
        status: 'success',
      });
      return response;
    })
    .catch((error) => {
      const duration = performance.now() - startTime;
      performanceCollector?.record('API', duration, 'ms', {
        endpoint,
        method,
        status: 'error',
        error: String(error),
      });
      throw error;
    });
}

// ============================================================================
// COMPONENT TIMING
// ============================================================================

export function measureRender(componentName: string): () => void {
  const startTime = performance.now();

  return () => {
    const duration = performance.now() - startTime;
    performanceCollector?.record('Render', duration, 'ms', {
      component: componentName,
    });
  };
}

// ============================================================================
// REACT HOOK
// ============================================================================

export function usePerformance(componentName: string) {
  if (typeof window === 'undefined') {
    return { recordMetric: () => {}, getVitals: () => ({}) };
  }

  return {
    recordMetric: (name: string, value: number, unit: PerformanceMetric['unit'] = 'ms') => {
      performanceCollector?.record(`${componentName}:${name}`, value, unit);
    },
    getVitals: () => performanceCollector?.getWebVitals() ?? {},
  };
}

// ============================================================================
// MEMORY MONITORING
// ============================================================================

interface MemoryInfo {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
}

export function getMemoryUsage(): MemoryInfo {
  if (typeof window !== 'undefined' && 'memory' in performance) {
    const memory = (performance as unknown as { memory: MemoryInfo }).memory;
    return {
      usedJSHeapSize: memory?.usedJSHeapSize,
      totalJSHeapSize: memory?.totalJSHeapSize,
    };
  }
  return {};
}

// ============================================================================
// EXPORT
// ============================================================================

export const performanceCollector = typeof window !== 'undefined' 
  ? new PerformanceCollector() 
  : null;

export function reportPerformance(): void {
  if (!performanceCollector) return;
  
  const vitals = performanceCollector.getWebVitals();
  const memory = getMemoryUsage();

  logger.info('Performance Report', {
    vitals,
    memory,
    metricsCount: performanceCollector.getMetrics().length,
  });
}

export default performanceCollector;
