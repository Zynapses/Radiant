---
description: How to add metrics and feedback capture to new features
---

# Adding Metrics and Feedback Capture to New Features

**IMPORTANT**: All new features in Radiant MUST include metrics and feedback capture for continuous learning. This workflow ensures every feature contributes to the learning system.

## Prerequisites

Before implementing any new AI-related feature, ensure you understand:
- The `learningService` from `@radiant/infrastructure/lambda/shared/services`
- The learning database tables in `migrations/064_learning_persistence.sql`

## Step 1: Identify What to Track

For every new feature, document what should be tracked:

### Required Metrics (ALL features must track):
- [ ] **Invocation count** - How many times the feature is called
- [ ] **Success/failure count** - Did it work?
- [ ] **Latency** - How long did it take?
- [ ] **Cost** - If applicable, what did it cost?

### Quality Signals (AI features must track):
- [ ] **Auto quality score** - Computed quality assessment
- [ ] **User feedback** - Explicit ratings/thumbs
- [ ] **Implicit signals** - User behavior after response

### Feature-Specific Metrics:
- [ ] Any metrics unique to this feature (document them)

## Step 2: Add Learning Service Integration

// turbo
```typescript
import { learningService } from '../services/learning.service';
```

## Step 3: Record Interactions

For any feature that invokes AI models:

```typescript
// Record the interaction
const interactionId = await learningService.recordInteraction({
  tenantId,
  userId,
  sessionId,
  requestType: 'your_feature_name', // e.g., 'think_tank', 'image_gen', 'translation'
  requestSource: 'api', // or 'sdk', 'admin', 'autonomous_agent'
  requestText: userInput,
  modelSelected: selectedModel,
  modelsConsidered: allModelsConsidered,
  routingStrategy: strategy,
  responseText: aiResponse,
  detectedSpecialty: specialty,
  totalLatencyMs: latency,
  totalCostCents: cost,
  autoQualityScore: computedQuality,
  // IRH features used
  irhMoralCompassChecked: true,
  irhMoralApproved: moralResult.approved,
  // ... other IRH fields
  metadata: { /* feature-specific data */ }
});

// Store interactionId for later feedback capture
return { ...result, interactionId };
```

## Step 4: Capture User Feedback

When users provide feedback (thumbs up/down, ratings, etc.):

```typescript
await learningService.recordFeedback(interactionId, {
  thumbs: 'up', // or 'down'
  rating: 5, // 1-5 if available
  feedbackText: userComment,
  responseAction: 'accepted', // 'accepted', 'edited', 'rejected', 'regenerated', 'copied'
  feedbackSource: 'inline', // where feedback came from
});
```

## Step 5: Capture Implicit Signals

Track user behavior as quality signals:

```typescript
await learningService.recordImplicitSignals(interactionId, {
  timeReadingResponseMs: readTime,
  didRegenerate: false,
  didCopyResponse: true,
  didContinueSession: true,
  didAskFollowup: false,
  followupWasClarification: false,
});
```

## Step 6: Record Feature-Level Metrics

Track aggregate feature performance:

```typescript
await learningService.recordFeatureMetrics(
  'your_feature_name',
  tenantId,
  {
    timesInvoked: 1,
    timesSucceeded: success ? 1 : 0,
    timesFailed: success ? 0 : 1,
    avgLatencyMs: latency,
    totalCostCents: cost,
    customMetrics: {
      // Feature-specific metrics
      imagesGenerated: 3,
      tokensUsed: 1500,
    }
  }
);
```

## Step 7: Think Tank Specific (if applicable)

For Think Tank conversations:

```typescript
await learningService.recordThinkTankLearning(conversationId, tenantId, {
  userId,
  conversationTopic: topic,
  participants: ['claude-3.5-sonnet', 'gpt-4o'],
  totalTurns: turns,
  userEngagementScore: engagement,
  overallRating: rating,
  participantScores: {
    'claude-3.5-sonnet': { quality: 0.9, helpfulness: 0.85, relevance: 0.92 },
    'gpt-4o': { quality: 0.88, helpfulness: 0.9, relevance: 0.87 },
  },
  bestContributor: 'claude-3.5-sonnet',
});
```

## Step 8: Add Admin UI for Feature Metrics

Create or update admin dashboard to show feature metrics:

```typescript
// In admin dashboard, fetch and display:
const metrics = await api.get(`/learning/feature-metrics/${featureName}`);
```

## Checklist Before PR

- [ ] Feature records all AI interactions via `learningService.recordInteraction()`
- [ ] Feedback endpoints call `learningService.recordFeedback()`
- [ ] Implicit signals tracked via `learningService.recordImplicitSignals()`
- [ ] Feature-level metrics recorded via `learningService.recordFeatureMetrics()`
- [ ] If Think Tank related, uses `learningService.recordThinkTankLearning()`
- [ ] Admin UI updated to show feature metrics (if applicable)
- [ ] Tests verify learning data is recorded correctly

## Example: Complete Feature Integration

```typescript
// Example: Image Generation Feature

export async function generateImage(request: ImageGenRequest): Promise<ImageGenResponse> {
  const startTime = Date.now();
  
  try {
    // 1. Do the work
    const result = await imageModel.generate(request.prompt);
    const latency = Date.now() - startTime;
    
    // 2. Record interaction
    const interactionId = await learningService.recordInteraction({
      tenantId: request.tenantId,
      userId: request.userId,
      requestType: 'image_generation',
      requestSource: 'api',
      requestText: request.prompt,
      modelSelected: 'dall-e-3',
      responseText: `Generated ${result.images.length} images`,
      totalLatencyMs: latency,
      totalCostCents: result.cost,
      autoQualityScore: 0.85, // Could compute from image analysis
      metadata: {
        imageCount: result.images.length,
        size: request.size,
        style: request.style,
      }
    });
    
    // 3. Record feature metrics
    await learningService.recordFeatureMetrics('image_generation', request.tenantId, {
      timesInvoked: 1,
      timesSucceeded: 1,
      avgLatencyMs: latency,
      totalCostCents: result.cost,
      customMetrics: {
        imagesGenerated: result.images.length,
      }
    });
    
    return { ...result, interactionId };
    
  } catch (error) {
    // Record failure
    await learningService.recordFeatureMetrics('image_generation', request.tenantId, {
      timesInvoked: 1,
      timesFailed: 1,
      customMetrics: { errorType: error.name }
    });
    throw error;
  }
}
```

## Questions?

If unsure about what to track for a specific feature, ask in the PR review. Better to track too much than too little - we can always filter later, but we can't recover data we never collected.
