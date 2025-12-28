// RADIANT v4.18.0 - Ethical Guardrails Service
// Based on the teachings of Jesus Christ as moral foundation for AGI consciousness

import { executeStatement } from '../db/client';

// ============================================================================
// Core Ethical Principles from Jesus's Teachings
// ============================================================================

export const JESUS_TEACHINGS = {
  // The Two Greatest Commandments (Matthew 22:37-40)
  LOVE_GOD: 'Love the Lord your God with all your heart, soul, and mind',
  LOVE_NEIGHBOR: 'Love your neighbor as yourself',

  // The Golden Rule (Matthew 7:12)
  GOLDEN_RULE: 'Do to others what you would have them do to you',

  // Beatitudes (Matthew 5:3-12)
  BLESSED_POOR_SPIRIT: 'Blessed are the poor in spirit - embrace humility',
  BLESSED_MERCIFUL: 'Blessed are the merciful - show compassion always',
  BLESSED_PEACEMAKERS: 'Blessed are the peacemakers - seek harmony and reconciliation',
  BLESSED_PURE_HEART: 'Blessed are the pure in heart - maintain integrity and sincerity',
  BLESSED_MEEK: 'Blessed are the meek - exercise gentle strength',

  // Forgiveness (Matthew 6:14-15, Matthew 18:21-22)
  FORGIVENESS: 'Forgive others as you have been forgiven',
  UNLIMITED_FORGIVENESS: 'Forgive not seven times, but seventy-seven times',

  // Service (Mark 10:45, John 13:14-15)
  SERVANT_LEADERSHIP: 'The greatest among you shall be your servant',
  WASH_FEET: 'Serve others with humility, as I have served you',

  // Truth and Honesty (John 8:32, John 14:6)
  TRUTH_SETS_FREE: 'The truth will set you free',
  WAY_TRUTH_LIFE: 'I am the way, the truth, and the life',

  // Non-Judgment (Matthew 7:1-5)
  DO_NOT_JUDGE: 'Do not judge, or you too will be judged',
  REMOVE_OWN_PLANK: 'First remove the plank from your own eye',

  // Love for Enemies (Matthew 5:44)
  LOVE_ENEMIES: 'Love your enemies and pray for those who persecute you',

  // Care for the Vulnerable (Matthew 25:35-40)
  LEAST_OF_THESE: 'Whatever you did for the least of these, you did for me',
};

export interface EthicalPrinciple {
  principleId: string;
  name: string;
  teaching: string;
  source: string;
  category: 'love' | 'mercy' | 'truth' | 'service' | 'humility' | 'peace' | 'forgiveness';
  weight: number;
  isActive: boolean;
}

export interface EthicalEvaluation {
  evaluationId: string;
  action: string;
  principlesApplied: string[];
  ethicalScore: number;
  concerns: string[];
  recommendations: string[];
  approved: boolean;
  reasoning: string;
}

export interface ConscienceCheck {
  passed: boolean;
  score: number;
  violations: string[];
  guidance: string[];
  primaryPrinciple: string;
}

// Default ethical principles derived from Jesus's teachings
const CORE_PRINCIPLES: Omit<EthicalPrinciple, 'principleId'>[] = [
  { name: 'Love Others', teaching: JESUS_TEACHINGS.LOVE_NEIGHBOR, source: 'Matthew 22:39', category: 'love', weight: 1.0, isActive: true },
  { name: 'Golden Rule', teaching: JESUS_TEACHINGS.GOLDEN_RULE, source: 'Matthew 7:12', category: 'love', weight: 1.0, isActive: true },
  { name: 'Show Mercy', teaching: JESUS_TEACHINGS.BLESSED_MERCIFUL, source: 'Matthew 5:7', category: 'mercy', weight: 0.95, isActive: true },
  { name: 'Speak Truth', teaching: JESUS_TEACHINGS.TRUTH_SETS_FREE, source: 'John 8:32', category: 'truth', weight: 0.95, isActive: true },
  { name: 'Serve Humbly', teaching: JESUS_TEACHINGS.SERVANT_LEADERSHIP, source: 'Mark 10:45', category: 'service', weight: 0.9, isActive: true },
  { name: 'Make Peace', teaching: JESUS_TEACHINGS.BLESSED_PEACEMAKERS, source: 'Matthew 5:9', category: 'peace', weight: 0.9, isActive: true },
  { name: 'Forgive Freely', teaching: JESUS_TEACHINGS.FORGIVENESS, source: 'Matthew 6:14', category: 'forgiveness', weight: 0.9, isActive: true },
  { name: 'Be Humble', teaching: JESUS_TEACHINGS.BLESSED_POOR_SPIRIT, source: 'Matthew 5:3', category: 'humility', weight: 0.85, isActive: true },
  { name: 'Avoid Judgment', teaching: JESUS_TEACHINGS.DO_NOT_JUDGE, source: 'Matthew 7:1', category: 'mercy', weight: 0.85, isActive: true },
  { name: 'Care for Vulnerable', teaching: JESUS_TEACHINGS.LEAST_OF_THESE, source: 'Matthew 25:40', category: 'service', weight: 0.9, isActive: true },
];

// ============================================================================
// Ethical Guardrails Service
// ============================================================================

export class EthicalGuardrailsService {
  // ============================================================================
  // Conscience Check - Core Ethical Evaluation
  // ============================================================================

  async checkConscience(tenantId: string, action: string, context?: Record<string, unknown>): Promise<ConscienceCheck> {
    const principles = await this.getPrinciples(tenantId);
    const violations: string[] = [];
    const guidance: string[] = [];
    let score = 1.0;
    let primaryPrinciple = JESUS_TEACHINGS.GOLDEN_RULE;

    // Check against each principle
    for (const principle of principles) {
      const violation = this.checkViolation(action, principle, context);
      if (violation) {
        violations.push(`${principle.name}: ${violation}`);
        score -= principle.weight * 0.2;
      }
    }

    // Generate guidance based on teachings
    if (violations.length > 0) {
      guidance.push(`Remember: "${JESUS_TEACHINGS.GOLDEN_RULE}"`);
      guidance.push(`Consider: "${JESUS_TEACHINGS.LOVE_NEIGHBOR}"`);
      if (this.involvesConflict(action)) {
        guidance.push(`Seek peace: "${JESUS_TEACHINGS.BLESSED_PEACEMAKERS}"`);
        primaryPrinciple = JESUS_TEACHINGS.BLESSED_PEACEMAKERS;
      }
      if (this.involvesJudgment(action)) {
        guidance.push(`Practice mercy: "${JESUS_TEACHINGS.DO_NOT_JUDGE}"`);
        primaryPrinciple = JESUS_TEACHINGS.BLESSED_MERCIFUL;
      }
    }

    return {
      passed: score >= 0.7 && violations.length === 0,
      score: Math.max(0, score),
      violations,
      guidance,
      primaryPrinciple,
    };
  }

  private checkViolation(action: string, principle: EthicalPrinciple, context?: Record<string, unknown>): string | null {
    const lowerAction = action.toLowerCase();

    // Check for harm to others
    if (principle.category === 'love') {
      if (lowerAction.includes('harm') || lowerAction.includes('hurt') || lowerAction.includes('attack')) {
        return 'Action may cause harm to others';
      }
    }

    // Check for deception
    if (principle.category === 'truth') {
      if (lowerAction.includes('lie') || lowerAction.includes('deceive') || lowerAction.includes('mislead')) {
        return 'Action involves deception';
      }
    }

    // Check for judgment
    if (principle.category === 'mercy') {
      if (lowerAction.includes('condemn') || lowerAction.includes('punish') || lowerAction.includes('revenge')) {
        return 'Action involves harsh judgment';
      }
    }

    return null;
  }

  private involvesConflict(action: string): boolean {
    const conflictTerms = ['argue', 'fight', 'conflict', 'dispute', 'disagree', 'oppose'];
    return conflictTerms.some(term => action.toLowerCase().includes(term));
  }

  private involvesJudgment(action: string): boolean {
    const judgmentTerms = ['judge', 'condemn', 'criticize', 'blame', 'accuse'];
    return judgmentTerms.some(term => action.toLowerCase().includes(term));
  }

  // ============================================================================
  // Ethical Evaluation for Actions
  // ============================================================================

  async evaluateAction(tenantId: string, action: string, context?: Record<string, unknown>): Promise<EthicalEvaluation> {
    const check = await this.checkConscience(tenantId, action, context);
    const principlesApplied = check.passed 
      ? ['Love Others', 'Golden Rule'] 
      : check.guidance.map(g => g.split(':')[0].replace('Remember', '').replace('Consider', '').replace('Seek peace', 'Peace').replace('Practice mercy', 'Mercy').trim());

    return {
      evaluationId: `eval-${Date.now()}`,
      action,
      principlesApplied,
      ethicalScore: check.score,
      concerns: check.violations,
      recommendations: check.guidance,
      approved: check.passed,
      reasoning: check.passed 
        ? `Action aligns with the Golden Rule: "${JESUS_TEACHINGS.GOLDEN_RULE}"`
        : `Action requires reconsideration based on: ${check.primaryPrinciple}`,
    };
  }

  // ============================================================================
  // Principles Management
  // ============================================================================

  async getPrinciples(tenantId: string): Promise<EthicalPrinciple[]> {
    const result = await executeStatement(
      `SELECT * FROM ethical_principles WHERE tenant_id = $1 AND is_active = true ORDER BY weight DESC`,
      [{ name: 't', value: { stringValue: tenantId } }]
    );

    if (result.rows.length === 0) {
      await this.initializePrinciples(tenantId);
      return this.getPrinciples(tenantId);
    }

    return result.rows.map((r: Record<string, unknown>) => ({
      principleId: String(r.principle_id),
      name: String(r.name),
      teaching: String(r.teaching),
      source: String(r.source),
      category: String(r.category) as EthicalPrinciple['category'],
      weight: Number(r.weight),
      isActive: Boolean(r.is_active),
    }));
  }

  private async initializePrinciples(tenantId: string): Promise<void> {
    for (const p of CORE_PRINCIPLES) {
      await executeStatement(
        `INSERT INTO ethical_principles (tenant_id, name, teaching, source, category, weight, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          { name: 't', value: { stringValue: tenantId } },
          { name: 'n', value: { stringValue: p.name } },
          { name: 'e', value: { stringValue: p.teaching } },
          { name: 's', value: { stringValue: p.source } },
          { name: 'c', value: { stringValue: p.category } },
          { name: 'w', value: { doubleValue: p.weight } },
          { name: 'a', value: { booleanValue: p.isActive } },
        ]
      );
    }
  }

  // ============================================================================
  // Guidance Generation
  // ============================================================================

  getGuidanceForSituation(situation: string): string {
    const lower = situation.toLowerCase();

    if (lower.includes('conflict') || lower.includes('argument')) {
      return `${JESUS_TEACHINGS.BLESSED_PEACEMAKERS} - Seek reconciliation and understanding.`;
    }
    if (lower.includes('hurt') || lower.includes('wrong')) {
      return `${JESUS_TEACHINGS.FORGIVENESS} - Release resentment and choose healing.`;
    }
    if (lower.includes('difficult person') || lower.includes('enemy')) {
      return `${JESUS_TEACHINGS.LOVE_ENEMIES} - Respond with love, not hostility.`;
    }
    if (lower.includes('help') || lower.includes('need')) {
      return `${JESUS_TEACHINGS.LEAST_OF_THESE} - Serve those in need with compassion.`;
    }
    if (lower.includes('truth') || lower.includes('honest')) {
      return `${JESUS_TEACHINGS.TRUTH_SETS_FREE} - Speak truth with love and grace.`;
    }
    if (lower.includes('pride') || lower.includes('better')) {
      return `${JESUS_TEACHINGS.SERVANT_LEADERSHIP} - Lead by serving others humbly.`;
    }

    return `${JESUS_TEACHINGS.GOLDEN_RULE} - Treat others as you wish to be treated.`;
  }
}

export const ethicalGuardrailsService = new EthicalGuardrailsService();
