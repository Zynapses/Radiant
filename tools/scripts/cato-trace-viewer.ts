#!/usr/bin/env npx ts-node
/**
 * Cato Pipeline Trace Viewer CLI
 * 
 * Interactive CLI tool for viewing and debugging pipeline executions.
 * 
 * Usage:
 *   npx ts-node tools/scripts/cato-trace-viewer.ts --pipeline <id>
 *   npx ts-node tools/scripts/cato-trace-viewer.ts --recent
 *   npx ts-node tools/scripts/cato-trace-viewer.ts --watch
 */

import { Pool } from 'pg';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

const statusColors: Record<string, string> = {
  PENDING: colors.dim,
  RUNNING: colors.blue,
  CHECKPOINT_WAITING: colors.yellow,
  COMPLETED: colors.green,
  FAILED: colors.red,
  CANCELLED: colors.dim,
  ROLLED_BACK: colors.magenta,
};

const riskColors: Record<string, string> = {
  NONE: colors.dim,
  LOW: colors.green,
  MEDIUM: colors.yellow,
  HIGH: colors.red,
  CRITICAL: colors.bgRed + colors.white,
};

interface PipelineExecution {
  id: string;
  tenant_id: string;
  status: string;
  template_id?: string;
  governance_preset: string;
  original_request: Record<string, unknown>;
  methods_executed: string[];
  current_method?: string;
  current_sequence: number;
  total_cost_cents: number;
  total_duration_ms: number;
  total_tokens: number;
  error?: { code: string; message: string };
  trace_id: string;
  started_at: string;
  completed_at?: string;
}

interface MethodEnvelope {
  envelope_id: string;
  sequence: number;
  source_method_id: string;
  source_method_name: string;
  source_method_type: string;
  output_type: string;
  output_summary: string;
  confidence_score: number;
  risk_signals: Array<{ signalType: string; severity: string; description: string }>;
  duration_ms: number;
  cost_cents: number;
  tokens_used: number;
  timestamp: string;
}

interface CheckpointDecision {
  id: string;
  checkpoint_type: string;
  checkpoint_name: string;
  status: string;
  trigger_reason: string;
  decision?: string;
  decided_by?: string;
  decision_time_ms?: number;
}

class CatoTraceViewer {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'radiant',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });
  }

  async viewPipeline(pipelineId: string): Promise<void> {
    console.log(`\n${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}  CATO PIPELINE TRACE VIEWER${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

    // Get pipeline execution
    const execResult = await this.pool.query(
      'SELECT * FROM cato_pipeline_executions WHERE id = $1',
      [pipelineId]
    );

    if (execResult.rows.length === 0) {
      console.log(`${colors.red}Pipeline not found: ${pipelineId}${colors.reset}`);
      return;
    }

    const execution: PipelineExecution = execResult.rows[0];
    this.printExecutionHeader(execution);

    // Get envelopes
    const envResult = await this.pool.query(
      'SELECT * FROM cato_pipeline_envelopes WHERE pipeline_id = $1 ORDER BY sequence',
      [pipelineId]
    );
    const envelopes: MethodEnvelope[] = envResult.rows;

    // Get checkpoints
    const cpResult = await this.pool.query(
      'SELECT * FROM cato_checkpoint_decisions WHERE pipeline_id = $1 ORDER BY triggered_at',
      [pipelineId]
    );
    const checkpoints: CheckpointDecision[] = cpResult.rows;

    // Print method chain
    console.log(`\n${colors.bold}METHOD EXECUTION CHAIN${colors.reset}`);
    console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);

    for (const envelope of envelopes) {
      this.printEnvelope(envelope);
    }

    // Print checkpoints
    if (checkpoints.length > 0) {
      console.log(`\n${colors.bold}CHECKPOINTS${colors.reset}`);
      console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
      for (const cp of checkpoints) {
        this.printCheckpoint(cp);
      }
    }

    // Print risk summary
    const allRiskSignals = envelopes.flatMap(e => e.risk_signals || []);
    if (allRiskSignals.length > 0) {
      console.log(`\n${colors.bold}RISK SIGNALS${colors.reset}`);
      console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
      for (const signal of allRiskSignals) {
        const color = riskColors[signal.severity] || colors.reset;
        console.log(`  ${color}[${signal.severity}]${colors.reset} ${signal.signalType}: ${signal.description}`);
      }
    }

    // Print summary
    console.log(`\n${colors.bold}SUMMARY${colors.reset}`);
    console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
    console.log(`  Methods executed: ${envelopes.length}`);
    console.log(`  Total duration: ${execution.total_duration_ms}ms`);
    console.log(`  Total cost: $${(execution.total_cost_cents / 100).toFixed(4)}`);
    console.log(`  Total tokens: ${execution.total_tokens}`);
    console.log(`  Checkpoints triggered: ${checkpoints.length}`);

    if (execution.error) {
      console.log(`\n${colors.red}${colors.bold}ERROR${colors.reset}`);
      console.log(`  ${colors.red}Code: ${execution.error.code}${colors.reset}`);
      console.log(`  ${colors.red}Message: ${execution.error.message}${colors.reset}`);
    }

    console.log(`\n${colors.dim}Trace ID: ${execution.trace_id}${colors.reset}`);
    console.log();
  }

  async listRecent(limit: number = 10): Promise<void> {
    console.log(`\n${colors.bold}${colors.cyan}RECENT PIPELINE EXECUTIONS${colors.reset}\n`);

    const result = await this.pool.query(
      'SELECT * FROM cato_pipeline_executions ORDER BY started_at DESC LIMIT $1',
      [limit]
    );

    if (result.rows.length === 0) {
      console.log(`${colors.dim}No executions found${colors.reset}`);
      return;
    }

    console.log(`${'ID'.padEnd(40)} ${'Status'.padEnd(20)} ${'Preset'.padEnd(10)} ${'Cost'.padEnd(8)} ${'Duration'.padEnd(10)} Started`);
    console.log(`${colors.dim}${'─'.repeat(110)}${colors.reset}`);

    for (const exec of result.rows) {
      const statusColor = statusColors[exec.status] || colors.reset;
      console.log(
        `${exec.id.padEnd(40)} ` +
        `${statusColor}${exec.status.padEnd(20)}${colors.reset} ` +
        `${exec.governance_preset.padEnd(10)} ` +
        `$${(exec.total_cost_cents / 100).toFixed(2).padEnd(7)} ` +
        `${(exec.total_duration_ms + 'ms').padEnd(10)} ` +
        `${new Date(exec.started_at).toLocaleString()}`
      );
    }
    console.log();
  }

  async watchPipelines(): Promise<void> {
    console.log(`\n${colors.bold}${colors.cyan}WATCHING PIPELINE EXECUTIONS${colors.reset}`);
    console.log(`${colors.dim}Press Ctrl+C to stop${colors.reset}\n`);

    let lastSeen = new Date().toISOString();

    const check = async () => {
      const result = await this.pool.query(
        `SELECT * FROM cato_pipeline_executions 
         WHERE started_at > $1 OR (status = 'RUNNING' OR status = 'CHECKPOINT_WAITING')
         ORDER BY started_at DESC LIMIT 20`,
        [lastSeen]
      );

      for (const exec of result.rows) {
        const statusColor = statusColors[exec.status] || colors.reset;
        console.log(
          `${colors.dim}[${new Date().toLocaleTimeString()}]${colors.reset} ` +
          `${exec.id.substring(0, 8)}... ` +
          `${statusColor}${exec.status}${colors.reset} ` +
          `${exec.current_method || exec.methods_executed[exec.methods_executed.length - 1] || 'starting'}`
        );
      }

      if (result.rows.length > 0) {
        lastSeen = result.rows[0].started_at;
      }
    };

    await check();
    setInterval(check, 2000);
  }

  private printExecutionHeader(execution: PipelineExecution): void {
    const statusColor = statusColors[execution.status] || colors.reset;
    
    console.log(`${colors.bold}Pipeline: ${execution.id}${colors.reset}`);
    console.log(`  Status: ${statusColor}${execution.status}${colors.reset}`);
    console.log(`  Preset: ${execution.governance_preset}`);
    if (execution.template_id) {
      console.log(`  Template: ${execution.template_id}`);
    }
    console.log(`  Started: ${new Date(execution.started_at).toLocaleString()}`);
    if (execution.completed_at) {
      console.log(`  Completed: ${new Date(execution.completed_at).toLocaleString()}`);
    }
  }

  private printEnvelope(envelope: MethodEnvelope): void {
    const methodTypeSymbol = this.getMethodTypeSymbol(envelope.source_method_type);
    const hasRisks = (envelope.risk_signals || []).length > 0;
    
    console.log(`\n  ${colors.bold}${envelope.sequence + 1}. ${methodTypeSymbol} ${envelope.source_method_name}${colors.reset}`);
    console.log(`     ${colors.dim}${envelope.source_method_id}${colors.reset}`);
    console.log(`     Output: ${envelope.output_type}`);
    console.log(`     Summary: ${envelope.output_summary.substring(0, 80)}${envelope.output_summary.length > 80 ? '...' : ''}`);
    console.log(`     Confidence: ${(envelope.confidence_score * 100).toFixed(0)}%`);
    console.log(`     ${colors.dim}Duration: ${envelope.duration_ms}ms | Cost: $${(envelope.cost_cents / 100).toFixed(4)} | Tokens: ${envelope.tokens_used}${colors.reset}`);
    
    if (hasRisks) {
      const maxSeverity = (envelope.risk_signals || []).reduce((max, s) => {
        const order = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
        return order.indexOf(s.severity) > order.indexOf(max) ? s.severity : max;
      }, 'NONE');
      const color = riskColors[maxSeverity] || colors.reset;
      console.log(`     ${color}⚠ ${(envelope.risk_signals || []).length} risk signal(s)${colors.reset}`);
    }
  }

  private printCheckpoint(checkpoint: CheckpointDecision): void {
    const statusSymbol = checkpoint.status === 'DECIDED' ? '✓' : checkpoint.status === 'PENDING' ? '⏳' : '✗';
    const statusColor = checkpoint.status === 'DECIDED' ? colors.green : checkpoint.status === 'PENDING' ? colors.yellow : colors.red;
    
    console.log(`\n  ${statusColor}${statusSymbol}${colors.reset} ${colors.bold}${checkpoint.checkpoint_name}${colors.reset} (${checkpoint.checkpoint_type})`);
    console.log(`     Reason: ${checkpoint.trigger_reason}`);
    if (checkpoint.decision) {
      console.log(`     Decision: ${checkpoint.decision} by ${checkpoint.decided_by || 'unknown'}`);
      if (checkpoint.decision_time_ms) {
        console.log(`     ${colors.dim}Decision time: ${checkpoint.decision_time_ms}ms${colors.reset}`);
      }
    }
  }

  private getMethodTypeSymbol(methodType: string): string {
    const symbols: Record<string, string> = {
      OBSERVER: '👁',
      PROPOSER: '📋',
      CRITIC: '🛡',
      VALIDATOR: '⚖',
      EXECUTOR: '⚡',
      DECIDER: '🧠',
      ROUTER: '🔀',
      PLANNER: '📝',
    };
    return symbols[methodType] || '•';
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);
  const viewer = new CatoTraceViewer();

  try {
    if (args.includes('--help') || args.includes('-h')) {
      console.log(`
Cato Pipeline Trace Viewer

Usage:
  cato-trace-viewer --pipeline <id>   View a specific pipeline execution
  cato-trace-viewer --recent [n]      List recent executions (default: 10)
  cato-trace-viewer --watch           Watch for new executions

Options:
  --help, -h                          Show this help message

Environment Variables:
  DB_HOST                             Database host (default: localhost)
  DB_PORT                             Database port (default: 5432)
  DB_NAME                             Database name (default: radiant)
  DB_USER                             Database user (default: postgres)
  DB_PASSWORD                         Database password
`);
      return;
    }

    if (args.includes('--pipeline') || args.includes('-p')) {
      const idx = args.indexOf('--pipeline') !== -1 ? args.indexOf('--pipeline') : args.indexOf('-p');
      const pipelineId = args[idx + 1];
      if (!pipelineId) {
        console.error('Error: Pipeline ID required');
        process.exit(1);
      }
      await viewer.viewPipeline(pipelineId);
    } else if (args.includes('--recent') || args.includes('-r')) {
      const idx = args.indexOf('--recent') !== -1 ? args.indexOf('--recent') : args.indexOf('-r');
      const limit = parseInt(args[idx + 1]) || 10;
      await viewer.listRecent(limit);
    } else if (args.includes('--watch') || args.includes('-w')) {
      await viewer.watchPipelines();
      // Keep running until Ctrl+C
      await new Promise(() => {});
    } else {
      await viewer.listRecent(10);
    }
  } finally {
    await viewer.close();
  }
}

main().catch(console.error);
