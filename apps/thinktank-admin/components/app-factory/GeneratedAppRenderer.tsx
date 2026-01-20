'use client';

import React, { useState, useCallback } from 'react';
import { Sparkles, ThumbsUp, ThumbsDown } from 'lucide-react';
import { GeneratedCalculator } from './GeneratedCalculator';
import { AppViewToggle, ViewTransition } from './AppViewToggle';

interface UIInput {
  id: string;
  label: string;
  type: 'text' | 'number' | 'slider' | 'select' | 'checkbox' | 'date' | 'color';
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: unknown }[];
  required?: boolean;
}

interface UIOutput {
  id: string;
  label: string;
  type: 'text' | 'number' | 'chart' | 'table';
  format?: string;
}

interface UIComponentSchema {
  id: string;
  type: 'chart' | 'table' | 'calculator' | 'form' | 'timeline' | 'comparison' | 'diagram' | 'map' | 'kanban' | 'calendar' | 'code_editor' | 'markdown_viewer' | 'image_gallery' | 'custom';
  title: string;
  description?: string;
  data: unknown;
  interactive: boolean;
  inputs?: UIInput[];
  outputs?: UIOutput[];
  width?: 'small' | 'medium' | 'large' | 'full';
  config: Record<string, unknown>;
}

interface GeneratedApp {
  id: string;
  title: string;
  description: string;
  components: UIComponentSchema[];
  layout: 'single' | 'grid' | 'tabs' | 'stack';
  initialState: Record<string, unknown>;
  computeLogic: { outputId: string; formula: string; dependencies: string[] }[];
  isInteractive: boolean;
}

interface GeneratedAppRendererProps {
  textResponse: string;
  app?: GeneratedApp;
  hasApp: boolean;
  recommendedView?: 'text' | 'app' | 'split';
  onViewChange?: (view: 'text' | 'app' | 'split') => void;
  onInteraction?: (appId: string, componentId: string, inputId: string, value: unknown) => void;
  onFeedback?: (appId: string, rating: 'up' | 'down') => void;
}

export function GeneratedAppRenderer({
  textResponse,
  app,
  hasApp,
  recommendedView = 'app',
  onViewChange,
  onInteraction,
  onFeedback,
}: GeneratedAppRendererProps) {
  const [activeView, setActiveView] = useState<'text' | 'app' | 'split'>(
    hasApp ? recommendedView : 'text'
  );

  const handleViewChange = useCallback((view: 'text' | 'app' | 'split') => {
    setActiveView(view);
    onViewChange?.(view);
  }, [onViewChange]);

  const handleInteraction = useCallback((componentId: string, inputId: string, value: unknown) => {
    if (app) {
      onInteraction?.(app.id, componentId, inputId, value);
    }
  }, [app, onInteraction]);

  const textContent = (
    <div className="prose dark:prose-invert max-w-none">
      <div dangerouslySetInnerHTML={{ __html: formatMarkdown(textResponse) }} />
    </div>
  );

  const appContent = app ? (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {app.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFeedback?.(app.id, 'up')}
            className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
            title="This app is helpful"
          >
            <ThumbsUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => onFeedback?.(app.id, 'down')}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="This app needs improvement"
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={getLayoutClasses(app.layout, app.components.length)}>
        {app.components.map(component => (
          <ComponentRenderer
            key={component.id}
            component={component}
            onInteraction={(inputId, value) => handleInteraction(component.id, inputId, value)}
          />
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-3">
      {hasApp && (
        <div className="flex justify-end">
          <AppViewToggle
            activeView={activeView}
            onViewChange={handleViewChange}
            hasApp={hasApp}
            appTitle={app?.title}
          />
        </div>
      )}

      {hasApp ? (
        <ViewTransition
          activeView={activeView}
          textContent={textContent}
          appContent={appContent}
        />
      ) : (
        textContent
      )}
    </div>
  );
}

function ComponentRenderer({
  component,
  onInteraction,
}: {
  component: UIComponentSchema;
  onInteraction: (inputId: string, value: unknown) => void;
}) {
  switch (component.type) {
    case 'calculator':
      return (
        <GeneratedCalculator
          id={component.id}
          title={component.title}
          description={component.description}
          inputs={component.inputs || []}
          outputs={component.outputs || []}
          formula={(component.config as { formula?: string })?.formula || 'generic'}
          config={component.config}
          onInteraction={onInteraction}
        />
      );

    case 'chart':
      return <ChartComponent component={component} />;

    case 'table':
      return <TableComponent component={component} />;

    case 'comparison':
      return <ComparisonComponent component={component} />;

    case 'timeline':
      return <TimelineComponent component={component} />;

    default:
      return (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Unsupported component type: &quot;{component.type}&quot;
          </p>
        </div>
      );
  }
}

function ChartComponent({ component }: { component: UIComponentSchema }) {
  const data = component.data as { dataPoints?: { label: string; value: number }[] };
  const config = component.config as { chartType?: string; colors?: string[] };
  const dataPoints = data?.dataPoints || [];
  const maxValue = Math.max(...dataPoints.map(d => d.value), 1);
  const colors = config?.colors || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{component.title}</h3>
      
      {config?.chartType === 'pie' ? (
        <div className="flex items-center justify-center gap-8">
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              {dataPoints.reduce((acc, point, i) => {
                const total = dataPoints.reduce((sum, p) => sum + p.value, 0);
                const percentage = (point.value / total) * 100;
                const offset = acc.offset;
                acc.elements.push(
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={colors[i % colors.length]}
                    strokeWidth="20"
                    strokeDasharray={`${percentage * 2.51} 251`}
                    strokeDashoffset={-offset * 2.51}
                  />
                );
                acc.offset += percentage;
                return acc;
              }, { elements: [] as React.ReactNode[], offset: 0 }).elements}
            </svg>
          </div>
          <div className="space-y-2">
            {dataPoints.map((point, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="text-sm text-gray-600 dark:text-gray-400">{point.label}</span>
                <span className="text-sm font-medium">{point.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {dataPoints.map((point, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{point.label}</span>
                <span className="font-medium">{point.value.toLocaleString()}</span>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(point.value / maxValue) * 100}%`,
                    backgroundColor: colors[i % colors.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TableComponent({ component }: { component: UIComponentSchema }) {
  const data = component.data as { headers?: string[]; rows?: Record<string, unknown>[] };
  const headers = data?.headers || [];
  const rows = data?.rows || [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">{component.title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {headers.map((header, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                {headers.map((header, j) => (
                  <td key={j} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {String(row[header] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComparisonComponent({ component }: { component: UIComponentSchema }) {
  const data = component.data as { items?: Record<string, unknown>[]; features?: string[] };
  const items = data?.items || [];
  const features = data?.features || [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">{component.title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Feature</th>
              {items.map((item, i) => (
                <th key={i} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  {String(item.name || `Option ${i + 1}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {features.map((feature, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{feature}</td>
                {items.map((item, j) => (
                  <td key={j} className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                    {String(item[feature] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TimelineComponent({ component }: { component: UIComponentSchema }) {
  const data = component.data as { events?: { date: string; title: string; description?: string }[] };
  const events = data?.events || [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{component.title}</h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-6">
          {events.map((event, i) => (
            <div key={i} className="relative pl-10">
              <div className="absolute left-2 w-5 h-5 rounded-full bg-purple-500 border-4 border-white dark:border-gray-800" />
              <div>
                <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">{event.date}</span>
                <h4 className="font-medium text-gray-900 dark:text-white">{event.title}</h4>
                {event.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{event.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getLayoutClasses(layout: string, count: number): string {
  switch (layout) {
    case 'grid':
      return `grid gap-4 ${count === 2 ? 'grid-cols-2' : count >= 3 ? 'grid-cols-3' : ''}`;
    case 'stack':
      return 'space-y-4';
    case 'tabs':
      return '';
    default:
      return '';
  }
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">$1</code>')
    .replace(/\n/g, '<br />');
}

export default GeneratedAppRenderer;
