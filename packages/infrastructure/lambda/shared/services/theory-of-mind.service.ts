// RADIANT v4.18.0 - Theory of Mind Service
// AGI Enhancement Phase 4: Model user cognitive state, predict needs, anticipatory assistance

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';
import { episodicMemoryService } from './episodic-memory.service';

// ============================================================================
// Types
// ============================================================================

export type EmotionType = 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'disgust' | 'neutral';
export type GoalType = 'immediate' | 'session' | 'project' | 'long_term';
export type GoalStatus = 'active' | 'achieved' | 'abandoned' | 'blocked' | 'paused';
export type PredictionType = 'next_action' | 'need' | 'question' | 'frustration' | 'satisfaction' | 'goal_completion';

export interface UserMentalModel {
  modelId: string;
  userId: string;
  currentGoals: UserGoalSummary[];
  currentAttention: AttentionState;
  currentEmotionalState: EmotionalState;
  currentCognitiveLoad: number;
  expertiseDomains: Record<string, ExpertiseLevel>;
  communicationStyle: CommunicationStyle;
  cognitiveStyle: CognitiveStyle;
  preferences: Record<string, unknown>;
  frustrationTriggers: FrustrationTrigger[];
  satisfactionTriggers: SatisfactionTrigger[];
  modelConfidence: number;
  totalInteractions: number;
  lastInteraction?: Date;
}

export interface UserGoalSummary {
  goalId: string;
  goalText: string;
  goalType: GoalType;
  priority: number;
  progress: number;
  status: GoalStatus;
}

export interface AttentionState {
  focusTopic?: string;
  focusIntensity: number; // 0-1
  distractions: string[];
  timeOnTask: number; // minutes
}

export interface EmotionalState {
  valence: number; // -1 to 1
  arousal: number; // 0 to 1
  dominantEmotion: EmotionType;
  secondaryEmotions: EmotionType[];
  confidence: number;
}

export interface ExpertiseLevel {
  level: 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
  confidence: number;
  evidence: string[];
}

export interface CommunicationStyle {
  verbosity: 'terse' | 'concise' | 'detailed' | 'verbose';
  formality: 'casual' | 'neutral' | 'formal' | 'professional';
  preferredFormat: 'prose' | 'bullets' | 'code' | 'mixed';
  detailLevel: 'high_level' | 'balanced' | 'detailed' | 'comprehensive';
}

export interface CognitiveStyle {
  analyticalVsIntuitive: number; // 0=intuitive, 1=analytical
  abstractVsConcrete: number; // 0=concrete, 1=abstract
  visualVsTextual: number; // 0=textual, 1=visual
}

export interface FrustrationTrigger {
  trigger: string;
  severity: number; // 0-1
  frequency: number;
}

export interface SatisfactionTrigger {
  trigger: string;
  intensity: number; // 0-1
  frequency: number;
}

export interface UserPrediction {
  predictionId: string;
  predictionType: PredictionType;
  content: string;
  confidence: number;
  reasoning: Record<string, unknown>;
  timeframe: string;
  expiresAt?: Date;
}

export interface ProactiveSuggestion {
  suggestionId: string;
  suggestionType: string;
  suggestionText: string;
  relevanceScore: number;
  priority: number;
  timing: string;
}

export interface AdaptedResponse {
  originalResponse: string;
  adaptedResponse: string;
  adaptations: ResponseAdaptation[];
}

export interface ResponseAdaptation {
  type: string;
  description: string;
  originalValue: unknown;
  adaptedValue: unknown;
}

// ============================================================================
// Theory of Mind Service
// ============================================================================

export class TheoryOfMindService {
  // ============================================================================
  // User Mental Model Management
  // ============================================================================

  async getOrCreateUserModel(tenantId: string, userId: string): Promise<UserMentalModel> {
    // Get or create model
    const result = await executeStatement(
      `SELECT get_or_create_user_model($1, $2) as model_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );
    const modelId = (result.rows[0] as { model_id: string }).model_id;

    // Fetch full model
    const modelResult = await executeStatement(
      `SELECT * FROM user_mental_models WHERE model_id = $1`,
      [{ name: 'modelId', value: { stringValue: modelId } }]
    );

    const row = modelResult.rows[0] as Record<string, unknown>;

    // Fetch active goals
    const goalsResult = await executeStatement(
      `SELECT * FROM get_active_user_goals($1, $2)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    const goals: UserGoalSummary[] = goalsResult.rows.map((g) => {
      const goal = g as { goal_id: string; goal_text: string; priority: number; progress: number; goal_type: string };
      return {
        goalId: goal.goal_id,
        goalText: goal.goal_text,
        goalType: (goal.goal_type as GoalType) || 'session',
        priority: goal.priority,
        progress: Number(goal.progress || 0),
        status: 'active' as GoalStatus,
      };
    });

    return this.mapUserModel(row, goals);
  }

  async updateUserModel(tenantId: string, userId: string, updates: Partial<{
    currentGoals: UserGoalSummary[];
    currentAttention: AttentionState;
    currentEmotionalState: EmotionalState;
    currentCognitiveLoad: number;
    currentContext: Record<string, unknown>;
  }>): Promise<void> {
    const sets: string[] = [];
    const params: Array<{ name: string; value: { stringValue: string } | { doubleValue: number } }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'userId', value: { stringValue: userId } },
    ];

    if (updates.currentGoals) {
      sets.push(`current_goals = $${params.length + 1}`);
      params.push({ name: 'goals', value: { stringValue: JSON.stringify(updates.currentGoals) } });
    }
    if (updates.currentAttention) {
      sets.push(`current_attention = $${params.length + 1}`);
      params.push({ name: 'attention', value: { stringValue: JSON.stringify(updates.currentAttention) } });
    }
    if (updates.currentEmotionalState) {
      sets.push(`current_emotional_state = $${params.length + 1}`);
      params.push({ name: 'emotion', value: { stringValue: JSON.stringify(updates.currentEmotionalState) } });
    }
    if (updates.currentCognitiveLoad !== undefined) {
      sets.push(`current_cognitive_load = $${params.length + 1}`);
      params.push({ name: 'load', value: { doubleValue: updates.currentCognitiveLoad } });
    }
    if (updates.currentContext) {
      sets.push(`current_context = $${params.length + 1}`);
      params.push({ name: 'context', value: { stringValue: JSON.stringify(updates.currentContext) } });
    }

    if (sets.length > 0) {
      await executeStatement(
        `UPDATE user_mental_models SET ${sets.join(', ')}, updated_at = NOW() WHERE tenant_id = $1 AND user_id = $2`,
        params
      );
    }

    // Update interaction count
    await executeStatement(
      `SELECT update_model_on_interaction($1, $2)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );
  }

  // ============================================================================
  // Goal Tracking
  // ============================================================================

  async trackGoal(tenantId: string, userId: string, goalText: string, goalType: GoalType, priority = 5): Promise<string> {
    const embedding = await this.generateEmbedding(goalText);

    const result = await executeStatement(
      `INSERT INTO user_goals (tenant_id, user_id, goal_text, goal_embedding, goal_type, priority)
       VALUES ($1, $2, $3, $4::vector, $5, $6)
       RETURNING goal_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'goalText', value: { stringValue: goalText } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'goalType', value: { stringValue: goalType } },
        { name: 'priority', value: { longValue: priority } },
      ]
    );

    return (result.rows[0] as { goal_id: string }).goal_id;
  }

  async updateGoalProgress(goalId: string, progress: number, notes?: string): Promise<void> {
    await executeStatement(
      `UPDATE user_goals SET
        progress = $2,
        progress_notes = CASE WHEN $3 IS NOT NULL THEN progress_notes || jsonb_build_array($3) ELSE progress_notes END,
        last_mentioned = NOW(),
        mention_count = mention_count + 1,
        status = CASE WHEN $2 >= 100 THEN 'achieved' ELSE status END,
        actual_completion = CASE WHEN $2 >= 100 THEN NOW() ELSE actual_completion END
      WHERE goal_id = $1`,
      [
        { name: 'goalId', value: { stringValue: goalId } },
        { name: 'progress', value: { doubleValue: progress } },
        { name: 'notes', value: notes ? { stringValue: notes } : { isNull: true } },
      ]
    );
  }

  async detectGoalsFromText(tenantId: string, userId: string, text: string): Promise<UserGoalSummary[]> {
    const prompt = `Analyze this text for any user goals, intentions, or objectives.

TEXT: "${text.substring(0, 2000)}"

Look for:
1. Explicit goals ("I want to...", "My goal is...", "I need to...")
2. Implicit goals (tasks being worked on, problems to solve)
3. Questions that imply a goal

Return JSON array:
[
  {
    "goal_text": "clear statement of the goal",
    "goal_type": "immediate|session|project|long_term",
    "priority": 1-10,
    "confidence": 0.0-1.0
  }
]

Return empty array if no clear goals detected.`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const goals = JSON.parse(jsonMatch[0]) as Array<{
          goal_text: string;
          goal_type: GoalType;
          priority: number;
          confidence: number;
        }>;

        const trackedGoals: UserGoalSummary[] = [];
        for (const goal of goals.filter((g) => g.confidence > 0.6)) {
          const goalId = await this.trackGoal(tenantId, userId, goal.goal_text, goal.goal_type, goal.priority);
          trackedGoals.push({
            goalId,
            goalText: goal.goal_text,
            goalType: goal.goal_type,
            priority: goal.priority,
            progress: 0,
            status: 'active',
          });
        }
        return trackedGoals;
      }
    } catch { /* no goals detected */ }

    return [];
  }

  async findSimilarGoals(tenantId: string, userId: string, goalText: string): Promise<UserGoalSummary[]> {
    const embedding = await this.generateEmbedding(goalText);

    const result = await executeStatement(
      `SELECT *, 1 - (goal_embedding <=> $3::vector) as similarity
       FROM user_goals
       WHERE tenant_id = $1 AND user_id = $2 AND is_active = true
       ORDER BY goal_embedding <=> $3::vector
       LIMIT 5`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
      ]
    );

    return result.rows.map((row) => {
      const r = row as { goal_id: string; goal_text: string; goal_type: string; priority: number; progress: number; status: string };
      return {
        goalId: r.goal_id,
        goalText: r.goal_text,
        goalType: r.goal_type as GoalType,
        priority: r.priority,
        progress: Number(r.progress || 0),
        status: r.status as GoalStatus,
      };
    });
  }

  // ============================================================================
  // Emotional State Tracking
  // ============================================================================

  async detectEmotionalState(tenantId: string, userId: string, text: string, sessionId?: string): Promise<EmotionalState> {
    const prompt = `Analyze the emotional state expressed in this text.

TEXT: "${text.substring(0, 1500)}"

Consider:
- Explicit emotional language
- Tone and sentiment
- Signs of frustration or satisfaction
- Urgency indicators

Return JSON:
{
  "valence": -1.0 to 1.0 (negative to positive),
  "arousal": 0.0 to 1.0 (calm to excited),
  "dominant_emotion": "joy|sadness|anger|fear|surprise|disgust|neutral",
  "secondary_emotions": [],
  "confidence": 0.0-1.0
}`;

    let emotionalState: EmotionalState = {
      valence: 0,
      arousal: 0.5,
      dominantEmotion: 'neutral',
      secondaryEmotions: [],
      confidence: 0.5,
    };

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        emotionalState = {
          valence: parsed.valence || 0,
          arousal: parsed.arousal || 0.5,
          dominantEmotion: parsed.dominant_emotion || 'neutral',
          secondaryEmotions: parsed.secondary_emotions || [],
          confidence: parsed.confidence || 0.5,
        };
      }
    } catch { /* use defaults */ }

    // Store in history
    await executeStatement(
      `INSERT INTO user_emotional_history (
        tenant_id, user_id, session_id, valence, arousal, dominant_emotion,
        secondary_emotions, trigger_type, trigger_content, detection_method, detection_confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'message', $8, 'linguistic', $9)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'sessionId', value: sessionId ? { stringValue: sessionId } : { isNull: true } },
        { name: 'valence', value: { doubleValue: emotionalState.valence } },
        { name: 'arousal', value: { doubleValue: emotionalState.arousal } },
        { name: 'dominantEmotion', value: { stringValue: emotionalState.dominantEmotion } },
        { name: 'secondaryEmotions', value: { stringValue: `{${emotionalState.secondaryEmotions.join(',')}}` } },
        { name: 'triggerContent', value: { stringValue: text.substring(0, 500) } },
        { name: 'confidence', value: { doubleValue: emotionalState.confidence } },
      ]
    );

    // Update current emotional state in model
    await this.updateUserModel(tenantId, userId, { currentEmotionalState: emotionalState });

    // Check for frustration triggers
    if (emotionalState.valence < -0.3 || emotionalState.dominantEmotion === 'anger') {
      await this.recordFrustrationSignal(tenantId, userId, text, emotionalState);
    }

    return emotionalState;
  }

  private async recordFrustrationSignal(tenantId: string, userId: string, text: string, emotion: EmotionalState): Promise<void> {
    await executeStatement(
      `INSERT INTO interaction_observations (
        tenant_id, user_id, observation_type, observation_key, observation_value,
        signal_strength, source_type, source_content
      ) VALUES ($1, $2, 'frustration_signal', $3, $4, $5, 'message', $6)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'key', value: { stringValue: emotion.dominantEmotion } },
        { name: 'value', value: { stringValue: JSON.stringify({ valence: emotion.valence, arousal: emotion.arousal }) } },
        { name: 'strength', value: { doubleValue: Math.abs(emotion.valence) } },
        { name: 'content', value: { stringValue: text.substring(0, 500) } },
      ]
    );
  }

  // ============================================================================
  // Prediction Engine
  // ============================================================================

  async predictNextNeeds(tenantId: string, userId: string, context: {
    currentMessage?: string;
    recentMessages?: string[];
    currentGoals?: UserGoalSummary[];
    emotionalState?: EmotionalState;
  }): Promise<UserPrediction[]> {
    const model = await this.getOrCreateUserModel(tenantId, userId);

    const prompt = `Based on the user's context, predict their likely next needs.

CURRENT MESSAGE: ${context.currentMessage || 'N/A'}

RECENT CONTEXT: ${context.recentMessages?.slice(0, 3).join('\n') || 'N/A'}

ACTIVE GOALS:
${(context.currentGoals || model.currentGoals).map((g) => `- ${g.goalText} (${g.progress}% complete)`).join('\n') || 'No active goals'}

EMOTIONAL STATE: ${context.emotionalState?.dominantEmotion || model.currentEmotionalState.dominantEmotion} (valence: ${context.emotionalState?.valence || model.currentEmotionalState.valence})

USER TRAITS:
- Communication style: ${model.communicationStyle.verbosity}
- Expertise: ${Object.entries(model.expertiseDomains).map(([k, v]) => `${k}: ${v.level}`).join(', ') || 'Unknown'}

Predict:
1. What the user might ask next
2. What information they might need
3. Potential frustration points
4. Opportunities to help proactively

Return JSON array:
[
  {
    "type": "next_action|need|question|frustration|satisfaction|goal_completion",
    "content": "prediction description",
    "confidence": 0.0-1.0,
    "timeframe": "immediate|within_session|within_day",
    "reasoning": {"key_factor": "..."}
  }
]`;

    const predictions: UserPrediction[] = [];

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{
          type: PredictionType;
          content: string;
          confidence: number;
          timeframe: string;
          reasoning: Record<string, unknown>;
        }>;

        for (const pred of parsed.filter((p) => p.confidence > 0.5)) {
          const result = await executeStatement(
            `INSERT INTO user_predictions (
              tenant_id, user_id, prediction_type, prediction_content, confidence, reasoning, predicted_timeframe,
              expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '24 hours')
            RETURNING prediction_id`,
            [
              { name: 'tenantId', value: { stringValue: tenantId } },
              { name: 'userId', value: { stringValue: userId } },
              { name: 'type', value: { stringValue: pred.type } },
              { name: 'content', value: { stringValue: pred.content } },
              { name: 'confidence', value: { doubleValue: pred.confidence } },
              { name: 'reasoning', value: { stringValue: JSON.stringify(pred.reasoning) } },
              { name: 'timeframe', value: { stringValue: pred.timeframe } },
            ]
          );

          predictions.push({
            predictionId: (result.rows[0] as { prediction_id: string }).prediction_id,
            predictionType: pred.type,
            content: pred.content,
            confidence: pred.confidence,
            reasoning: pred.reasoning,
            timeframe: pred.timeframe,
          });
        }
      }
    } catch { /* no predictions */ }

    return predictions;
  }

  async recordPredictionOutcome(predictionId: string, matched: boolean, notes?: string): Promise<void> {
    await executeStatement(
      `UPDATE user_predictions SET
        outcome_observed = true,
        outcome_matched = $2,
        outcome_notes = $3,
        outcome_recorded_at = NOW()
      WHERE prediction_id = $1`,
      [
        { name: 'predictionId', value: { stringValue: predictionId } },
        { name: 'matched', value: { booleanValue: matched } },
        { name: 'notes', value: notes ? { stringValue: notes } : { isNull: true } },
      ]
    );
  }

  async getPredictionAccuracy(tenantId: string, userId: string): Promise<Record<PredictionType, { total: number; correct: number; accuracy: number }>> {
    const result = await executeStatement(
      `SELECT * FROM calculate_prediction_accuracy($1, $2, 30)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    const accuracy: Record<string, { total: number; correct: number; accuracy: number }> = {};
    for (const row of result.rows) {
      const r = row as { prediction_type: string; total: number; correct: number; accuracy: number };
      accuracy[r.prediction_type] = {
        total: r.total,
        correct: r.correct,
        accuracy: Number(r.accuracy || 0),
      };
    }
    return accuracy as Record<PredictionType, { total: number; correct: number; accuracy: number }>;
  }

  // ============================================================================
  // Response Adaptation
  // ============================================================================

  async adaptResponse(tenantId: string, userId: string, response: string): Promise<AdaptedResponse> {
    const model = await this.getOrCreateUserModel(tenantId, userId);
    const adaptations: ResponseAdaptation[] = [];
    let adaptedResponse = response;

    // Get user adaptations
    const adaptationsResult = await executeStatement(
      `SELECT * FROM user_adaptations WHERE tenant_id = $1 AND user_id = $2 AND is_active = true`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
      ]
    );

    const userAdaptations = adaptationsResult.rows.map((r) => r as { adaptation_type: string; current_value: unknown; confidence: number });

    // Apply verbosity adaptation
    const verbosityPref = model.communicationStyle.verbosity;
    if (verbosityPref === 'terse' && response.length > 500) {
      const condensedPrompt = `Condense this response to be much shorter while keeping key information:

"${response}"

Keep it under 200 words. Be direct and concise.`;
      try {
        adaptedResponse = await this.invokeModel(condensedPrompt);
        adaptations.push({
          type: 'verbosity',
          description: 'Condensed response for terse preference',
          originalValue: response.length,
          adaptedValue: adaptedResponse.length,
        });
      } catch { /* keep original */ }
    } else if (verbosityPref === 'verbose' && response.length < 200) {
      const expandedPrompt = `Expand this response with more context, examples, and explanation:

"${response}"

Add relevant details and examples. Be thorough but not redundant.`;
      try {
        adaptedResponse = await this.invokeModel(expandedPrompt);
        adaptations.push({
          type: 'verbosity',
          description: 'Expanded response for verbose preference',
          originalValue: response.length,
          adaptedValue: adaptedResponse.length,
        });
      } catch { /* keep original */ }
    }

    // Apply formality adaptation
    const formalityPref = model.communicationStyle.formality;
    if (formalityPref === 'casual' || formalityPref === 'formal') {
      const tonePrompt = `Adjust the tone of this response to be more ${formalityPref}:

"${adaptedResponse}"

Keep the same information but adjust the language style.`;
      try {
        const toneAdjusted = await this.invokeModel(tonePrompt);
        if (toneAdjusted.length > 50) {
          adaptedResponse = toneAdjusted;
          adaptations.push({
            type: 'formality',
            description: `Adjusted tone to ${formalityPref}`,
            originalValue: 'neutral',
            adaptedValue: formalityPref,
          });
        }
      } catch { /* keep current */ }
    }

    // Record adaptation usage
    for (const adaptation of adaptations) {
      await executeStatement(
        `UPDATE user_adaptations SET times_applied = times_applied + 1, updated_at = NOW()
         WHERE tenant_id = $1 AND user_id = $2 AND adaptation_type = $3`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'userId', value: { stringValue: userId } },
          { name: 'type', value: { stringValue: adaptation.type } },
        ]
      );
    }

    return {
      originalResponse: response,
      adaptedResponse,
      adaptations,
    };
  }

  async learnPreference(tenantId: string, userId: string, preferenceType: string, value: unknown, source: 'explicit' | 'inferred' | 'feedback', confidence = 0.7): Promise<void> {
    await executeStatement(
      `INSERT INTO user_adaptations (
        tenant_id, user_id, adaptation_type, adaptation_name, current_value, default_value, source, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT ON CONSTRAINT user_adaptations_type_unique DO UPDATE SET
        current_value = $5,
        confidence = GREATEST(user_adaptations.confidence, $8),
        source = $7,
        updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'type', value: { stringValue: preferenceType } },
        { name: 'name', value: { stringValue: preferenceType } },
        { name: 'value', value: { stringValue: JSON.stringify(value) } },
        { name: 'default', value: { stringValue: JSON.stringify(null) } },
        { name: 'source', value: { stringValue: source } },
        { name: 'confidence', value: { doubleValue: confidence } },
      ]
    );

    // Update model's inferred preferences
    await executeStatement(
      `UPDATE user_mental_models SET
        inferred_preferences = inferred_preferences || jsonb_build_object($3, $4),
        preference_confidence = preference_confidence || jsonb_build_object($3, $5),
        updated_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: { stringValue: userId } },
        { name: 'type', value: { stringValue: preferenceType } },
        { name: 'value', value: { stringValue: JSON.stringify(value) } },
        { name: 'confidence', value: { doubleValue: confidence } },
      ]
    );
  }

  // ============================================================================
  // Proactive Suggestions
  // ============================================================================

  async generateProactiveSuggestions(tenantId: string, userId: string, context: {
    currentTask?: string;
    recentMessages?: string[];
  }): Promise<ProactiveSuggestion[]> {
    const model = await this.getOrCreateUserModel(tenantId, userId);
    const predictions = await this.predictNextNeeds(tenantId, userId, context);

    const suggestions: ProactiveSuggestion[] = [];

    // Generate suggestions based on predictions
    for (const prediction of predictions.filter((p) => p.confidence > 0.6)) {
      let suggestionType = 'tip';
      let suggestionText = '';

      switch (prediction.predictionType) {
        case 'frustration':
          suggestionType = 'warning';
          suggestionText = `It looks like you might be running into difficulty. ${prediction.content}. Would you like me to help with an alternative approach?`;
          break;
        case 'need':
          suggestionType = 'resource';
          suggestionText = `Based on what you're working on, you might find this helpful: ${prediction.content}`;
          break;
        case 'next_action':
          suggestionType = 'next_step';
          suggestionText = `A logical next step might be: ${prediction.content}`;
          break;
        case 'question':
          suggestionType = 'clarification';
          suggestionText = `You might be wondering about: ${prediction.content}. Would you like me to explain?`;
          break;
        default:
          suggestionText = prediction.content;
      }

      const result = await executeStatement(
        `INSERT INTO proactive_suggestions (
          tenant_id, user_id, suggestion_type, suggestion_text, relevance_score, priority, best_timing
        ) VALUES ($1, $2, $3, $4, $5, $6, 'after_response')
        RETURNING suggestion_id`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'userId', value: { stringValue: userId } },
          { name: 'type', value: { stringValue: suggestionType } },
          { name: 'text', value: { stringValue: suggestionText } },
          { name: 'relevance', value: { doubleValue: prediction.confidence } },
          { name: 'priority', value: { longValue: prediction.predictionType === 'frustration' ? 8 : 5 } },
        ]
      );

      suggestions.push({
        suggestionId: (result.rows[0] as { suggestion_id: string }).suggestion_id,
        suggestionType,
        suggestionText,
        relevanceScore: prediction.confidence,
        priority: prediction.predictionType === 'frustration' ? 8 : 5,
        timing: 'after_response',
      });
    }

    return suggestions.slice(0, 3); // Max 3 suggestions
  }

  async recordSuggestionResponse(suggestionId: string, response: 'accepted' | 'rejected' | 'ignored'): Promise<void> {
    await executeStatement(
      `UPDATE proactive_suggestions SET
        status = 'shown',
        shown_at = COALESCE(shown_at, NOW()),
        user_response = $2,
        response_at = NOW()
      WHERE suggestion_id = $1`,
      [
        { name: 'suggestionId', value: { stringValue: suggestionId } },
        { name: 'response', value: { stringValue: response } },
      ]
    );
  }

  // ============================================================================
  // Expertise Detection
  // ============================================================================

  async detectExpertise(tenantId: string, userId: string, text: string, domain?: string): Promise<ExpertiseLevel | null> {
    const prompt = `Analyze this text to assess the user's expertise level in the relevant domain.

TEXT: "${text.substring(0, 1500)}"
${domain ? `DOMAIN: ${domain}` : ''}

Look for:
- Technical vocabulary usage
- Depth of questions/statements
- Assumptions about background knowledge
- Complexity of concepts discussed

Return JSON:
{
  "domain": "detected domain",
  "level": "novice|beginner|intermediate|advanced|expert",
  "confidence": 0.0-1.0,
  "evidence": ["specific indicators"]
}

Return null if expertise cannot be determined.`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.level && parsed.confidence > 0.5) {
          // Record observation
          await executeStatement(
            `INSERT INTO interaction_observations (
              tenant_id, user_id, observation_type, observation_key, observation_value, signal_strength, source_type
            ) VALUES ($1, $2, 'expertise_signal', $3, $4, $5, 'message')`,
            [
              { name: 'tenantId', value: { stringValue: tenantId } },
              { name: 'userId', value: { stringValue: userId } },
              { name: 'key', value: { stringValue: parsed.domain } },
              { name: 'value', value: { stringValue: JSON.stringify({ level: parsed.level, evidence: parsed.evidence }) } },
              { name: 'strength', value: { doubleValue: parsed.confidence } },
            ]
          );

          // Update model
          await executeStatement(
            `UPDATE user_mental_models SET
              expertise_domains = expertise_domains || jsonb_build_object($3, $4),
              updated_at = NOW()
            WHERE tenant_id = $1 AND user_id = $2`,
            [
              { name: 'tenantId', value: { stringValue: tenantId } },
              { name: 'userId', value: { stringValue: userId } },
              { name: 'domain', value: { stringValue: parsed.domain } },
              { name: 'expertise', value: { stringValue: JSON.stringify({ level: parsed.level, confidence: parsed.confidence, evidence: parsed.evidence }) } },
            ]
          );

          return {
            level: parsed.level,
            confidence: parsed.confidence,
            evidence: parsed.evidence,
          };
        }
      }
    } catch { /* could not detect */ }

    return null;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await modelRouterService.invoke({
        modelId: 'amazon/titan-embed-text',
        messages: [{ role: 'user', content: text.substring(0, 8000) }],
      });
      return new Array(1536).fill(0);
    } catch {
      return new Array(1536).fill(0);
    }
  }

  private async invokeModel(prompt: string): Promise<string> {
    const response = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
    });
    return response.content;
  }

  private mapUserModel(row: Record<string, unknown>, goals: UserGoalSummary[]): UserMentalModel {
    return {
      modelId: String(row.model_id),
      userId: String(row.user_id),
      currentGoals: goals,
      currentAttention: typeof row.current_attention === 'string' ? JSON.parse(row.current_attention) : (row.current_attention as AttentionState) || { focusIntensity: 0.5, distractions: [], timeOnTask: 0 },
      currentEmotionalState: typeof row.current_emotional_state === 'string' ? JSON.parse(row.current_emotional_state) : (row.current_emotional_state as EmotionalState) || { valence: 0, arousal: 0.5, dominantEmotion: 'neutral', secondaryEmotions: [], confidence: 0.5 },
      currentCognitiveLoad: Number(row.current_cognitive_load || 0.5),
      expertiseDomains: typeof row.expertise_domains === 'string' ? JSON.parse(row.expertise_domains) : (row.expertise_domains as Record<string, ExpertiseLevel>) || {},
      communicationStyle: typeof row.communication_style === 'string' ? JSON.parse(row.communication_style) : (row.communication_style as CommunicationStyle) || { verbosity: 'concise', formality: 'neutral', preferredFormat: 'mixed', detailLevel: 'balanced' },
      cognitiveStyle: typeof row.cognitive_style === 'string' ? JSON.parse(row.cognitive_style) : (row.cognitive_style as CognitiveStyle) || { analyticalVsIntuitive: 0.5, abstractVsConcrete: 0.5, visualVsTextual: 0.5 },
      preferences: typeof row.inferred_preferences === 'string' ? JSON.parse(row.inferred_preferences) : (row.inferred_preferences as Record<string, unknown>) || {},
      frustrationTriggers: typeof row.frustration_triggers === 'string' ? JSON.parse(row.frustration_triggers) : (row.frustration_triggers as FrustrationTrigger[]) || [],
      satisfactionTriggers: typeof row.satisfaction_triggers === 'string' ? JSON.parse(row.satisfaction_triggers) : (row.satisfaction_triggers as SatisfactionTrigger[]) || [],
      modelConfidence: Number(row.model_confidence || 0.3),
      totalInteractions: Number(row.total_interactions || 0),
      lastInteraction: row.last_interaction ? new Date(row.last_interaction as string) : undefined,
    };
  }
}

export const theoryOfMindService = new TheoryOfMindService();
