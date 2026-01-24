/**
 * Cortex Entrance Exam Service
 * Curator verification workflow for SME knowledge validation
 */

import { randomUUID } from 'crypto';
import type {
  EntranceExam,
  ExamQuestion,
  ExamSubmission,
  ExamResult,
  CorrectedFact,
  ExamQuestionType,
  ExamStatus,
  GoldenRuleCreateRequest,
} from '@radiant/shared';
import { GoldenRulesService } from './golden-rules.service';

interface DbClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

interface ExamGenerateRequest {
  tenantId: string;
  domainId: string;
  domainPath: string;
  questionCount?: number;
  passingScore?: number;
  timeoutMinutes?: number;
  assignedTo?: string;
}

export class EntranceExamService {
  private goldenRulesService: GoldenRulesService;

  constructor(private db: DbClient) {
    this.goldenRulesService = new GoldenRulesService(db);
  }

  /**
   * Generate an entrance exam for a domain
   */
  async generateExam(request: ExamGenerateRequest): Promise<EntranceExam> {
    const questionCount = request.questionCount || 10;
    
    // Get facts from the domain to generate questions
    const factsResult = await this.db.query(
      `SELECT * FROM cortex_graph_nodes 
       WHERE tenant_id = $1 
       AND node_type IN ('fact', 'procedure', 'entity')
       AND metadata->>'domainId' = $2
       ORDER BY RANDOM()
       LIMIT $3`,
      [request.tenantId, request.domainId, questionCount * 2] // Get more than needed for filtering
    );

    const questions: ExamQuestion[] = [];
    for (const row of factsResult.rows) {
      if (questions.length >= questionCount) break;
      
      const r = row as Record<string, unknown>;
      const question = await this.generateQuestion(r);
      if (question) {
        questions.push(question);
      }
    }

    const result = await this.db.query(
      `INSERT INTO cortex_entrance_exams (
        tenant_id, domain_id, domain_path, questions, passing_score,
        timeout_minutes, assigned_to, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *`,
      [
        request.tenantId,
        request.domainId,
        request.domainPath,
        JSON.stringify(questions),
        request.passingScore || 80,
        request.timeoutMinutes || 60,
        request.assignedTo || null,
      ]
    );

    return this.mapRowToExam(result.rows[0]);
  }

  /**
   * Start an exam (assign to user and begin timer)
   */
  async startExam(examId: string, userId: string): Promise<EntranceExam> {
    const result = await this.db.query(
      `UPDATE cortex_entrance_exams 
       SET status = 'in_progress', assigned_to = $1, started_at = NOW()
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [userId, examId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Exam not found or already started: ${examId}`);
    }

    return this.mapRowToExam(result.rows[0]);
  }

  /**
   * Submit an answer to an exam question
   */
  async submitAnswer(submission: ExamSubmission): Promise<void> {
    await this.db.query(
      `INSERT INTO cortex_exam_submissions (
        exam_id, question_id, answer, is_verified, correction, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (exam_id, question_id) 
      DO UPDATE SET answer = $3, is_verified = $4, correction = $5, notes = $6, submitted_at = NOW()`,
      [
        submission.examId,
        submission.questionId,
        submission.answer,
        submission.isVerified,
        submission.correction || null,
        submission.notes || null,
      ]
    );
  }

  /**
   * Complete an exam and process results
   */
  async completeExam(examId: string, tenantId: string, userId: string): Promise<ExamResult> {
    const exam = await this.getExam(examId, tenantId);
    if (!exam) {
      throw new Error(`Exam not found: ${examId}`);
    }

    // Get all submissions
    const submissionsResult = await this.db.query(
      `SELECT * FROM cortex_exam_submissions WHERE exam_id = $1`,
      [examId]
    );

    const submissions = new Map<string, ExamSubmission>();
    for (const row of submissionsResult.rows) {
      const r = row as Record<string, unknown>;
      submissions.set(r.question_id as string, {
        examId: r.exam_id as string,
        questionId: r.question_id as string,
        answer: r.answer as string,
        isVerified: r.is_verified as boolean,
        correction: r.correction as string | undefined,
        notes: r.notes as string | undefined,
      });
    }

    // Calculate score and process corrections
    let correctAnswers = 0;
    const verifiedFacts: string[] = [];
    const correctedFacts: CorrectedFact[] = [];
    const goldenRulesCreated: string[] = [];

    for (const question of exam.questions) {
      const submission = submissions.get(question.id);
      if (!submission) continue;

      if (submission.isVerified) {
        correctAnswers++;
        verifiedFacts.push(question.id);
        
        // Mark fact as verified in Chain of Custody
        await this.goldenRulesService.verifyFact(question.id, tenantId, userId);
      } else if (submission.correction) {
        // Create correction and Golden Rule
        correctedFacts.push({
          questionId: question.id,
          originalStatement: question.statement,
          correctedStatement: submission.correction,
        });

        // Create Golden Rule to override incorrect information
        const ruleRequest: GoldenRuleCreateRequest = {
          tenantId,
          ruleType: 'force_override',
          condition: question.statement,
          override: submission.correction,
          reason: `Corrected during Entrance Exam by ${userId}. Notes: ${submission.notes || 'None'}`,
        };
        
        const rule = await this.goldenRulesService.createRule(ruleRequest, userId);
        goldenRulesCreated.push(rule.id);
      }
    }

    const score = Math.round((correctAnswers / exam.questions.length) * 100);
    const passed = score >= exam.passingScore;
    const status: ExamStatus = passed ? 'passed' : 'failed';

    // Update exam status
    await this.db.query(
      `UPDATE cortex_entrance_exams 
       SET status = $1, completed_at = NOW(), score = $2
       WHERE id = $3`,
      [status, score, examId]
    );

    return {
      examId,
      passed,
      score,
      totalQuestions: exam.questions.length,
      correctAnswers,
      verifiedFacts,
      correctedFacts,
      goldenRulesCreated,
    };
  }

  /**
   * Get exam by ID
   */
  async getExam(examId: string, tenantId: string): Promise<EntranceExam | null> {
    const result = await this.db.query(
      `SELECT * FROM cortex_entrance_exams WHERE id = $1 AND tenant_id = $2`,
      [examId, tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToExam(result.rows[0]);
  }

  /**
   * List exams for a tenant
   */
  async listExams(
    tenantId: string,
    options: { status?: ExamStatus; assignedTo?: string; domainId?: string } = {}
  ): Promise<EntranceExam[]> {
    let sql = `SELECT * FROM cortex_entrance_exams WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];

    if (options.status) {
      params.push(options.status);
      sql += ` AND status = $${params.length}`;
    }
    if (options.assignedTo) {
      params.push(options.assignedTo);
      sql += ` AND assigned_to = $${params.length}`;
    }
    if (options.domainId) {
      params.push(options.domainId);
      sql += ` AND domain_id = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await this.db.query(sql, params);
    return result.rows.map((row) => this.mapRowToExam(row));
  }

  /**
   * Check for expired exams and mark them
   */
  async checkExpiredExams(): Promise<number> {
    const result = await this.db.query(
      `UPDATE cortex_entrance_exams 
       SET status = 'expired'
       WHERE status = 'in_progress'
       AND started_at + (timeout_minutes * INTERVAL '1 minute') < NOW()
       RETURNING id`
    );

    return result.rows.length;
  }

  /**
   * Generate a question from a graph node
   */
  private async generateQuestion(node: Record<string, unknown>): Promise<ExamQuestion | null> {
    const nodeType = node.node_type as string;
    const label = node.label as string;
    const properties = (node.properties as Record<string, unknown>) || {};
    
    let type: ExamQuestionType;
    let statement: string;
    
    switch (nodeType) {
      case 'fact':
        type = 'verify';
        statement = label;
        break;
      case 'procedure':
        type = 'verify';
        statement = `The procedure "${label}" is correct as documented.`;
        break;
      case 'entity':
        type = 'verify';
        statement = `${label} ${properties.description || 'exists in the system'}`;
        break;
      default:
        return null;
    }

    return {
      id: randomUUID(),
      type,
      statement,
      source: node.source as string || 'Unknown',
      sourceLocation: properties.location as string,
      confidence: (node.confidence as number) || 0.8,
      aiReasoning: properties.reasoning as string,
    };
  }

  private mapRowToExam(row: unknown): EntranceExam {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      tenantId: r.tenant_id as string,
      domainId: r.domain_id as string,
      domainPath: r.domain_path as string,
      questions: (r.questions as ExamQuestion[]) || [],
      passingScore: r.passing_score as number,
      timeoutMinutes: r.timeout_minutes as number,
      status: r.status as ExamStatus,
      assignedTo: r.assigned_to as string | undefined,
      startedAt: r.started_at ? new Date(r.started_at as string) : undefined,
      completedAt: r.completed_at ? new Date(r.completed_at as string) : undefined,
      score: r.score as number | undefined,
      createdAt: new Date(r.created_at as string),
    };
  }
}
