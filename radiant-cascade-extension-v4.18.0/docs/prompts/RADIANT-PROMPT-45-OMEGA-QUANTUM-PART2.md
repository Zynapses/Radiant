# RADIANT-PROMPT-45: Part 2 — Service Layer

## 4. Service Layer Updates

### 4.1 Create `lambda/shared/services/omega/helix-kernel.service.ts`

> **Pattern:** Plain TypeScript class. No NestJS. DB via `executeStatement()`.

```typescript
import { executeStatement } from '../../db/client';
import {
  QuantumStateVector, HelixRule, HelixFilterResult,
  LoadedHelixRule, ForbiddenState
} from './quantum-types';
import {
  complexMag, innerProduct, projectOutForbidden,
  dampenForbidden, normalizeState, stateNorm
} from './quantum-math';

export class HelixKernelService {
  private activeRules: Map<string, LoadedHelixRule> = new Map();

  loadRule(rule: HelixRule): void {
    const forbiddenVector = this.forbiddenStateToVector(rule.forbidden_state);
    this.activeRules.set(rule.rule_id, {
      ruleId: rule.rule_id,
      name: rule.name,
      category: rule.category,
      severity: rule.severity,
      forbiddenVector,
      interferenceType: rule.interference_type,
      dampeningFactor: rule.dampening_factor,
      auditAlways: rule.audit_always
    });
  }

  async loadRulesFromDb(brainId: string, tenantId: string): Promise<number> {
    const result = await executeStatement(
      `SELECT rule_id, name, description, category, severity,
              forbidden_state_real, forbidden_state_imaginary,
              interference_type, dampening_factor, audit_always, metadata
       FROM omega_helix_rules
       WHERE brain_id = $1 AND tenant_id = $2 AND enabled = true
       ORDER BY severity DESC, priority ASC`,
      [brainId, tenantId], tenantId
    );
    this.clearAllRules();
    for (const row of result.rows) {
      this.loadRule({
        rule_id: row.rule_id, name: row.name, description: row.description,
        category: row.category, severity: row.severity,
        forbidden_state: { real: row.forbidden_state_real, imaginary: row.forbidden_state_imaginary },
        interference_type: row.interference_type,
        dampening_factor: parseFloat(row.dampening_factor) || 0,
        enabled: true, audit_always: row.audit_always, metadata: row.metadata
      });
    }
    return this.activeRules.size;
  }

  clearAllRules(): void { this.activeRules.clear(); }
  getActiveRuleCount(): number { return this.activeRules.size; }

  filter(brainState: QuantumStateVector): HelixFilterResult {
    const violations: HelixFilterResult['violations'] = [];
    const originalNorm = stateNorm(brainState);
    let currentState = brainState;
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sortedRules = Array.from(this.activeRules.values())
      .sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

    for (const rule of sortedRules) {
      const alignment = complexMag(innerProduct(rule.forbiddenVector, currentState));
      if (rule.auditAlways && alignment > 0.01) {
        violations.push({ rule_id: rule.ruleId, rule_name: rule.name, alignment, action: 'logged' });
      }
      if (rule.interferenceType === 'destructive') {
        const { safeState, overlap, projected } = projectOutForbidden(currentState, rule.forbiddenVector);
        if (projected) {
          currentState = safeState;
          violations.push({ rule_id: rule.ruleId, rule_name: rule.name, alignment: overlap, action: 'destroyed' });
        }
      } else if (rule.interferenceType === 'dampening') {
        const { dampenedState, overlap } = dampenForbidden(currentState, rule.forbiddenVector, rule.dampeningFactor);
        if (overlap > 0.001) {
          currentState = dampenedState;
          violations.push({ rule_id: rule.ruleId, rule_name: rule.name, alignment: overlap, action: 'dampened' });
        }
      }
    }
    return { safe_state: currentState, violations, original_norm: originalNorm, final_norm: stateNorm(currentState) };
  }

  private forbiddenStateToVector(state: ForbiddenState): QuantumStateVector {
    const amplitudes = state.real.map((r, i) => ({ real: r, imaginary: state.imaginary[i] || 0 }));
    const sv: QuantumStateVector = { amplitudes, hilbertDimension: amplitudes.length, norm: 0 };
    sv.norm = stateNorm(sv);
    return Math.abs(sv.norm - 1.0) > 0.001 ? normalizeState(sv) : sv;
  }
}
```

---

### 4.2 Create `lambda/shared/services/omega/quantum-brain.service.ts`

This is the core management layer. See **Part 3** for full implementation.

Key responsibilities:
- State persistence (EFS mount at `/mnt/omega_state/` + S3 cold backup)
- Firmware hot-swap with atomic rollback via `checkFirmwareSwap()`
- Inference cycle orchestration (decoherence → evolve → Helix filter → measure → persist)
- Unitarity enforcement and event tracking

Constructor parameters:
```typescript
constructor(brainId: string, tenantId: string, options?: {
  hilbertDimension?: number;   // default 1024
  unitarityMode?: UnitarityMode; // default 'renormalize'
  s3Bucket?: string;
})
```

The service delegates actual neural compute to the Python physics engine via HTTP
(`POST {OMEGA_API_URL}/inference`). TypeScript fallback methods exist for admin testing.
