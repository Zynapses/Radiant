'use client';

import {
  useGlobalBrainRounds,
  useCreateRound,
  useTriggerAveraging,
} from '@/lib/hooks/use-global-brain';
import {
  Activity,
  Play,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { useState } from 'react';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    collecting: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    aggregating: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  };
  const icons: Record<string, React.ElementType> = {
    collecting: Clock,
    aggregating: Loader2,
    completed: CheckCircle2,
    failed: XCircle,
  };
  const Icon = icons[status] || Clock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      <Icon className={`h-3 w-3 ${status === 'aggregating' ? 'animate-spin' : ''}`} />
      {status}
    </span>
  );
}

export default function GlobalBrainRoundsPage() {
  const { data: rounds, isLoading } = useGlobalBrainRounds();
  const createRound = useCreateRound();
  const triggerAveraging = useTriggerAveraging();
  const [newRoundType, setNewRoundType] = useState('omega_qnode');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Federated Learning Rounds
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage gradient collection and federated averaging rounds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={newRoundType}
            onChange={(e) => setNewRoundType(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm bg-background"
          >
            <option value="omega_qnode">OMEGA Q-Node</option>
            <option value="cortex_networks">CORTEX Networks</option>
            <option value="full">Full</option>
          </select>
          <button
            onClick={() => createRound.mutate({ round_type: newRoundType })}
            disabled={createRound.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {createRound.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New Round
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading rounds...</div>
      ) : !rounds || rounds.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No federated learning rounds yet. Create one to start collecting gradients.
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => (
            <div key={round.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Round #{round.round_number}</span>
                      <StatusBadge status={round.status} />
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{round.round_type}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Target: {round.target_participants} participants</span>
                      <span>Actual: {round.actual_participants}</span>
                      <span>Started: {new Date(round.started_at).toLocaleDateString()}</span>
                      {round.completed_at && <span>Completed: {new Date(round.completed_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
                {round.status === 'collecting' && (
                  <button
                    onClick={() => triggerAveraging.mutate(round.id)}
                    disabled={triggerAveraging.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {triggerAveraging.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    Run Averaging
                  </button>
                )}
              </div>
              {round.quality_metrics && (
                <div className="mt-3 pt-3 border-t flex gap-4 text-xs text-muted-foreground">
                  {Object.entries(round.quality_metrics).map(([key, val]) => (
                    <span key={key}>{key.replace(/_/g, ' ')}: <span className="font-mono">{typeof val === 'number' ? val.toFixed(4) : String(val)}</span></span>
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
