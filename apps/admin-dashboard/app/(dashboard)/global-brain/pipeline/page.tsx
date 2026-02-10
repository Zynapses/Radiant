'use client';

import {
  useGlobalBrainPipelines,
  useCreatePipeline,
  useTriggerPipeline,
} from '@/lib/hooks/use-global-brain';
import {
  Database,
  Play,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
} from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    scheduled: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    collecting_rounds: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    averaging: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    building_cartridge: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    validating: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    publishing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  const icons: Record<string, React.ElementType> = {
    completed: CheckCircle2,
    failed: XCircle,
    scheduled: Clock,
  };
  const Icon = icons[status] || Loader2;
  const isSpinning = !['completed', 'failed', 'scheduled'].includes(status);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      <Icon className={`h-3 w-3 ${isSpinning ? 'animate-spin' : ''}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function GlobalBrainPipelinePage() {
  const { data: pipelines, isLoading } = useGlobalBrainPipelines();
  const createPipeline = useCreatePipeline();
  const triggerPipeline = useTriggerPipeline();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Cartridge Generation Pipeline
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate base .RADz cartridges from federated averaging results.
          </p>
        </div>
        <button
          onClick={() => createPipeline.mutate({ pipeline_type: 'base' })}
          disabled={createPipeline.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {createPipeline.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Schedule Pipeline
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading pipelines...</div>
      ) : !pipelines || pipelines.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No cartridge pipelines yet. Schedule one to generate a base cartridge from completed rounds.
        </div>
      ) : (
        <div className="space-y-3">
          {pipelines.map((p) => (
            <div key={p.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold capitalize">{p.pipeline_type} Pipeline</span>
                      <StatusBadge status={p.status} />
                      {p.target_version && (
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">v{p.target_version}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      {p.scheduled_for && <span>Scheduled: {new Date(p.scheduled_for).toLocaleDateString()}</span>}
                      {p.started_at && <span>Started: {new Date(p.started_at).toLocaleDateString()}</span>}
                      {p.completed_at && <span>Completed: {new Date(p.completed_at).toLocaleDateString()}</span>}
                      {p.output_cartridge_id && <span>Output: <code className="font-mono">{p.output_cartridge_id.slice(0, 8)}...</code></span>}
                    </div>
                  </div>
                </div>
                {p.status === 'scheduled' && (
                  <button
                    onClick={() => triggerPipeline.mutate(p.id)}
                    disabled={triggerPipeline.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {triggerPipeline.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    Run Pipeline
                  </button>
                )}
              </div>
              {p.progress && Object.keys(p.progress).length > 0 && (
                <div className="mt-3 pt-3 border-t flex gap-4 text-xs text-muted-foreground">
                  {Object.entries(p.progress).map(([key, val]) => (
                    <span key={key}>{key.replace(/_/g, ' ')}: <span className="font-mono">{String(val)}</span></span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
