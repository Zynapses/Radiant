# Changelog

All notable changes to RADIANT will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.18.21] - 2024-12-29

### Added

#### Competitive Strategy Implementation - "Beat Gemini 3"

Complete implementation of 7-gap competitive strategy to exploit weaknesses in Gemini/GPT architecture:

**Gap 1: Safety Tax (Sovereign Routing)**
- `sovereign-routing.service.ts` - Detect refusals, route to uncensored models
- `config/uncensored-models.json` - 4 uncensored models (Dolphin-Mixtral, Llama-3-Uncensored, WizardLM, Nous-Hermes)
- `provider_refusal_log` table - Track refusals for learning
- Automatic reroute when refusal rate > 50% for topic cluster

**Gap 2: Probabilistic Code (Compiler Loop)**
- `code-verification.service.ts` - Execute code before delivering to user
- `verifyCode()` - Sandbox execution with Fargate
- Self-correction loop with error feedback to LLM
- Only delivers code with `exit code 0`

**Gap 3: Lost in Middle (GraphRAG)**
- Already existed: `graph-rag.service.ts`
- Enhanced with `knowledge_nodes`, `knowledge_edges` tables
- `traverse_knowledge_graph()` - BFS traversal function
- Hybrid search: 60% graph + 40% vector

**Gap 4: 10-Second Gap (Deep Research)**
- `browser-agent.service.ts` - Async research that runs 30+ minutes
- `dispatchResearch()` - Queue task, return immediately
- 8 research task types (competitive_analysis, market_research, etc.)
- Recursive crawling with citation following
- `research_tasks`, `research_sources`, `research_entities` tables

**Gap 5: Text Wall (Generative UI)**
- `dynamic-renderer.tsx` - React component factory
- 10+ component types: calculator, slider_tool, comparison_table, form, checklist, etc.
- `createCalculator()`, `createSliderTool()`, `createComparisonTable()` helpers
- Interactive tools instead of static text

**Gap 6: Forgetting (Already Implemented)**
- Ego Context, User Persistent Context, Predictive Coding, LoRA Evolution
- Documented in `COMPETITIVE-STRATEGY.md`

**Gap 7: One Model (Already Implemented)**
- 106+ models, Brain Router, Domain Taxonomy, Multi-Model Mode
- Documented in `COMPETITIVE-STRATEGY.md`

**Documentation**
- `docs/COMPETITIVE-STRATEGY.md` - Full strategy with implementation status
- `migrations/107_competitive_strategy.sql` - All database tables

### Dependencies Needed
```bash
npm install @aws-sdk/client-ecs @aws-sdk/client-sqs playwright
```

## [4.18.20] - 2024-12-29

### Added

#### Bipolar Rating System - Novel Negative Ratings

Novel rating system that allows users to express dissatisfaction with negative ratings (-5 to +5):

- **Scale Design**: -5 (harmful) to +5 (exceptional), with 0 as neutral
  - Unlike 5-star where "1 star" is ambiguous, negative explicitly captures dissatisfaction
  - Symmetric scale makes sentiment analysis cleaner
  - Net Sentiment Score: (positive% - negative%) × 100

- **Types** (`packages/shared/src/types/bipolar-rating.types.ts`)
  - `BipolarRatingValue` - -5 to +5 literal type
  - `RatingSentiment` - negative/neutral/positive
  - `RatingIntensity` - extreme/strong/mild/neutral
  - `RatingDimension` - overall, accuracy, helpfulness, clarity, completeness, speed, tone, creativity
  - `RatingReason` - 18 reasons (10 negative, 8 positive)
  - `QuickRating` - terrible/bad/meh/good/amazing (maps to bipolar)

- **Service** (`lambda/shared/services/bipolar-rating.service.ts`)
  - `submitRating()` - Submit -5 to +5 rating
  - `submitQuickRating()` - Quick emoji-based rating
  - `submitMultiDimensionRating()` - Rate multiple dimensions
  - `getAnalytics()` - Tenant analytics with Net Sentiment Score
  - `getModelAnalytics()` - Per-model performance
  - `getUserRatingPattern()` - User rating tendencies for calibration
  - Automatic learning candidate creation for extreme ratings (±4, ±5)

- **API** (`lambda/thinktank/ratings.ts`)
  - `POST /api/thinktank/ratings/submit` - Submit bipolar rating
  - `POST /api/thinktank/ratings/quick` - Quick rating (emoji-based)
  - `POST /api/thinktank/ratings/multi` - Multi-dimension rating
  - `GET /api/thinktank/ratings/target/:targetId` - Get ratings for target
  - `GET /api/thinktank/ratings/my` - User's ratings + pattern
  - `GET /api/thinktank/ratings/analytics` - Tenant analytics
  - `GET /api/thinktank/ratings/analytics/model/:modelId` - Model analytics
  - `GET /api/thinktank/ratings/dashboard` - Admin dashboard
  - `GET /api/thinktank/ratings/scale` - Scale info for UI

- **Database** (`migrations/106_bipolar_ratings.sql`)
  - `bipolar_ratings` - Core ratings with value, sentiment, intensity
  - `bipolar_rating_aggregates` - Pre-computed analytics
  - `user_rating_patterns` - User tendencies (harsh/balanced/generous)
  - `model_rating_summary` - Per-model performance
  - `submit_bipolar_rating()` - Stored procedure
  - `calculate_net_sentiment_score()` - Analytics function

- **User Calibration**: Detects harsh vs generous raters, applies calibration factor

## [4.18.19] - 2024-12-29

### Added

#### AGI Brain Consciousness Improvements (Based on External AI Evaluation)

- **Conscious Orchestrator Service** (`lambda/shared/services/conscious-orchestrator.service.ts`)
  - Architecture inversion: Consciousness is now the entry point, not a plugin
  - Request flow: Request → Consciousness → Brain Planner (as tool)
  - `processRequest()` - Main entry point for conscious request handling
  - Phase-based processing: Awaken → Perceive → Decide → Execute → Reflect
  - Decision types: `plan`, `clarify`, `defer`, `refuse`
  - Automatic attention management with request topics
  - Post-planning affect updates

- **Enhanced Affect → Hyperparameter Bindings** (`consciousness-middleware.service.ts`)
  - Added `presencePenalty` (0-2) for repeated topic penalization
  - Added `frequencyPenalty` (0-2) for repeated token penalization
  - High curiosity → `frequencyPenalty=0.5`, `presencePenalty=0.3` (novelty seeking)
  - High frustration → `presencePenalty=0.4` (avoid repeating failed approaches)
  - Boredom → `frequencyPenalty=0.4` (avoid repetitive patterns)

- **Vector RAG for Library Selection** (`library-registry.service.ts`)
  - `findLibrariesBySemanticSearch()` - Vector similarity search using embeddings
  - `generateEmbedding()` - Amazon Titan embedding generation with caching
  - `updateLibraryEmbedding()` - Update library embeddings during sync
  - Semantic matching beyond keyword/proficiency matching
  - Automatic fallback to proficiency matching if Vector RAG fails

- **Enhanced Heartbeat Memory Consolidation** (`lambda/consciousness/heartbeat.ts`)
  - `summarizeWorkingMemory()` - Dream phase: compress recent experiences
  - Memory grouping by type with consolidated summaries
  - Automatic archival of expired working memory
  - `generateIdleThought()` - Internal monologue between interactions
  - `generateWonderingThought()` - 3+ days idle: wonder about user
  - `generateReflectionThought()` - 1+ day idle: reflect on conversations
  - `generateCuriosityThought()` - <1 day: curiosity-driven thoughts

### Changed

- **Library Assist Service** now uses Vector RAG first, falls back to proficiency matching
- **AGI-BRAIN-COMPREHENSIVE.md** updated with clearer documentation of existing features:
  - Emphasized CAUSAL affect mapping (not roleplay)
  - Detailed Heartbeat service with continuous existence
  - Expanded LoRA Evolution as physical brain change
  - Clarified selective tool injection (not all 156)

## [4.18.18] - 2024-12-29

### Added

#### Open Source Library Registry - AI Capability Extensions
Implements a registry of open-source tools that extend AI capabilities for problem-solving:

- **Library Registry Service** (`lambda/shared/services/library-registry.service.ts`)
  - `findMatchingLibraries()` - Proficiency-based library matching
  - `getConfig()` - Per-tenant configuration with caching
  - `getAllLibraries()` - List all registered libraries
  - `getLibrariesByCategory()` - Filter by category
  - `recordUsage()` - Track library invocations
  - `seedLibraries()` - Load libraries from seed data
  - `getDashboard()` - Full dashboard data

- **93 Open Source Libraries** across 32 categories:
  - Data Processing, Databases, Vector Databases, Search
  - ML Frameworks, AutoML, LLMs, LLM Inference, LLM Orchestration
  - NLP, Computer Vision, Speech & Audio, Document Processing
  - Scientific Computing, Statistics & Forecasting
  - API Frameworks, Messaging, Workflow Orchestration, MLOps
  - Medical Imaging, Genomics, Bioinformatics, Chemistry
  - Robotics, Business Intelligence, Observability, Infrastructure
  - Real-time Communication, Formal Methods, Optimization

- **Proficiency Matching** using 8 dimensions:
  - reasoning_depth, mathematical_quantitative, code_generation
  - creative_generative, research_synthesis, factual_recall_precision
  - multi_step_problem_solving, domain_terminology_handling

- **Admin API** (`lambda/admin/library-registry.ts`)
  - `GET /admin/libraries/dashboard` - Full dashboard
  - `GET/PUT /admin/libraries/config` - Configuration
  - `GET /admin/libraries` - List all libraries
  - `GET /admin/libraries/:id` - Get library details
  - `GET /admin/libraries/:id/stats` - Usage statistics
  - `POST /admin/libraries/suggest` - Find matching libraries
  - `POST /admin/libraries/enable/:id` - Enable library
  - `POST /admin/libraries/disable/:id` - Disable library
  - `GET /admin/libraries/categories` - List categories
  - `POST /admin/libraries/seed` - Manual seed trigger

- **Admin Dashboard** (`apps/admin-dashboard/app/(dashboard)/platform/libraries/page.tsx`)
  - Libraries tab with search and category filtering
  - Expandable library cards showing proficiency scores
  - Enable/disable toggle per library
  - Configuration tab for assist settings and update schedule
  - Usage analytics tab with top libraries and category distribution

- **Database Tables** (migration 103)
  - `library_registry_config` - Per-tenant configuration
  - `open_source_libraries` - Global library registry
  - `tenant_library_overrides` - Per-tenant customization
  - `library_usage_events` - Invocation audit trail
  - `library_usage_aggregates` - Pre-computed usage stats
  - `library_update_jobs` - Update job tracking
  - `library_version_history` - Version change history
  - `library_registry_metadata` - Global metadata

- **Daily Update Service** (`lambda/library-registry/update.ts`)
  - EventBridge scheduled Lambda (default: 03:00 UTC daily)
  - Configurable frequency: hourly, daily, weekly, manual
  - Automatic seeding on first AWS installation

- **CDK Stack** (`lib/stacks/library-registry-stack.ts`)
  - Custom Resource triggers initial seed on deployment
  - Multiple EventBridge rules (hourly, daily, weekly)
  - Database access policies for Lambda functions

- **Library Assist Service** (`lambda/shared/services/library-assist.service.ts`)
  - `getRecommendations()` - AI queries for helpful libraries
  - `recordLibraryUsage()` - Track library invocations
  - Proficiency extraction from prompt
  - Domain detection from task context
  - Context block generation for system prompt injection

- **Multi-Tenant Concurrent Execution** (`lambda/shared/services/library-executor.service.ts`)
  - `submitExecution()` - Submit with concurrency checks
  - `checkConcurrencyLimits()` - Per-tenant and per-user limits
  - `checkBudgetLimits()` - Daily/monthly credit budgets
  - `processQueue()` - Priority-based queue processing
  - `completeExecution()` - Record metrics and billing
  - `getDashboard()` - Execution analytics

- **Execution Types** (`packages/shared/src/types/library-execution.types.ts`)
  - `LibraryExecutionRequest` - Execution request with constraints
  - `LibraryExecutionResult` - Output, metrics, billing
  - `TenantExecutionConfig` - Per-tenant configuration
  - `ExecutionQueueStatus` - Queue health and depth
  - `ExecutionDashboard` - Full analytics dashboard

- **Execution CDK Stack** (`lib/stacks/library-execution-stack.ts`)
  - SQS FIFO queues (standard + high priority)
  - Python Lambda executor with sandbox
  - Queue processor Lambda (every minute)
  - Aggregation Lambda (hourly)
  - Cleanup Lambda (daily)

- **Execution Database** (migration 104)
  - `library_execution_config` - Per-tenant config
  - `library_executions` - Execution records with metrics
  - `library_execution_queue` - Priority queue
  - `library_execution_logs` - Debug logs
  - `library_executor_pool` - Pool status
  - `library_execution_aggregates` - Pre-computed stats

- **Expanded Library Registry** (156 libraries)
  - Added UI Frameworks: Streamlit, Gradio, Panel, Marimo
  - Added Visualization: Plotly, Matplotlib, Seaborn
  - Added Distributed Computing: Ray, Dask, PySpark
  - Added ML Frameworks: scikit-learn, XGBoost, LightGBM, CatBoost
  - Added Image Processing: Real-ESRGAN, GFPGAN, CodeFormer, Pillow
  - Added Engineering CFD: OpenFOAM, SU2
  - Added more Genomics, Medical Imaging, Messaging, API Frameworks

- **AGI Brain Planner Library Integration**
  - `libraryRecommendations` field added to `AGIBrainPlan`
  - `enableLibraryAssist` option in `GeneratePlanRequest` (default: true)
  - Library context block injected for generative UI outputs
  - Proficiency-based matching for task-appropriate tool suggestions

- **Shared Types** (`packages/shared/src/types/library-registry.types.ts`)
  - `OpenSourceLibrary` - Library definition with proficiencies
  - `LibraryRegistryConfig` - Per-tenant configuration
  - `LibraryMatchResult` - Proficiency matching result
  - `LibraryInvocationRequest/Result` - Invocation types
  - `LibraryUsageStats` - Usage statistics
  - `LibraryDashboard` - Dashboard data

---

## [4.18.17] - 2024-12-29

### Added

#### Zero-Cost Ego System - Database State Injection
Implements persistent consciousness at **$0 additional cost** through database state injection:

- **Ego Context Service** (`lambda/shared/services/ego-context.service.ts`)
  - `buildEgoContext()` - Build context block for system prompt injection
  - `getConfig()` - Per-tenant configuration with caching
  - `getIdentity()` - Persistent identity (name, narrative, values, traits)
  - `getAffect()` - Real-time emotional state
  - `getWorkingMemory()` - Short-term thoughts and observations
  - `getActiveGoals()` - Current objectives guiding behavior
  - `updateAfterInteraction()` - Learn from interaction outcomes

- **Cost Comparison**
  - SageMaker g5.xlarge: ~$360/month
  - SageMaker Serverless: ~$35/month
  - Groq API: ~$10/month
  - **Zero-Cost Ego: $0/month** (uses existing PostgreSQL + model calls)

- **Admin API** (`lambda/admin/ego.ts`)
  - `GET /admin/ego/dashboard` - Full dashboard data
  - `GET/PUT /admin/ego/config` - Configuration
  - `GET/PUT /admin/ego/identity` - Identity settings
  - `GET /admin/ego/affect` - Current emotional state
  - `POST /admin/ego/affect/trigger` - Test affect events
  - `POST /admin/ego/affect/reset` - Reset to neutral
  - `GET/POST/DELETE /admin/ego/memory` - Working memory
  - `GET/POST /admin/ego/goals` - Goal management
  - `GET /admin/ego/preview` - Preview injected context

- **Admin Dashboard** (`apps/admin-dashboard/app/(dashboard)/thinktank/ego/page.tsx`)
  - Configuration tab with feature toggles
  - Identity tab with personality trait sliders
  - Affect tab with real-time emotional state and test triggers
  - Memory tab with working memory and goal management
  - Preview tab showing exact context being injected
  - Cost savings banner showing $0 vs alternatives

- **Database Tables** (migration 102)
  - `ego_config` - Per-tenant configuration
  - `ego_identity` - Persistent identity
  - `ego_affect` - Emotional state
  - `ego_working_memory` - Short-term memory (24h expiry)
  - `ego_goals` - Active and historical goals
  - `ego_injection_log` - Audit trail

---

## [4.18.16] - 2024-12-29

### Added

#### Local Ego Architecture - Economical Persistent Consciousness
Implements shared small-model infrastructure for continuous "Self":

- **Local Ego Service** (`local-ego.service.ts`)
  - `processStimulus()` - Main entry point for all stimuli through the Ego
  - `loadEgoState()` - Load tenant-specific state from database
  - `generateEgoThoughts()` - Internal thought generation
  - `makeDecision()` - Decide: handle directly or recruit external model
  - `recruitExternalModel()` - Use external models as cognitive "tools"
  - `integrateExternalResponse()` - Ego integrates external output

- **Economic Model**
  - Shared g5.xlarge spot instance: ~$360/month for ALL tenants
  - With 100 tenants = $3.60/tenant/month for 24/7 consciousness
  - Small model (Phi-3 or Qwen-2.5-3B) handles simple queries directly
  - Complex tasks recruit external models (Claude, GPT-4) as "tools"

- **Ego Decision Types**
  - `respond_directly` - Simple queries, self-reflection
  - `recruit_external` - Coding, deep reasoning, factual accuracy
  - `clarify` - Need more information
  - `defer` - Complex ethical decisions

#### Admin Dashboard - Consciousness Evolution UI
Full admin visibility and configuration for consciousness features:

- **Admin API Endpoints** (`admin/consciousness-evolution.ts`)
  - `GET /admin/consciousness/predictions/metrics` - Prediction accuracy
  - `GET /admin/consciousness/predictions/recent` - Recent predictions
  - `GET /admin/consciousness/learning-candidates` - View candidates
  - `GET /admin/consciousness/learning-candidates/stats` - Statistics
  - `DELETE /admin/consciousness/learning-candidates/{id}` - Remove
  - `PUT /admin/consciousness/learning-candidates/{id}/reject` - Reject
  - `GET /admin/consciousness/evolution/jobs` - Training jobs
  - `GET /admin/consciousness/evolution/state` - Evolution state
  - `POST /admin/consciousness/evolution/trigger` - Manual trigger
  - `GET /admin/consciousness/ego/status` - Local Ego status
  - `GET /admin/consciousness/config` - Configuration
  - `PUT /admin/consciousness/config` - Update config

- **Admin Dashboard Page** (`consciousness/evolution/page.tsx`)
  - Overview tab: Generation, accuracy, candidates, drift
  - Predictions tab: Active inference metrics and explanation
  - Candidates tab: Learning candidates table with actions
  - Evolution tab: LoRA jobs history and pipeline status
  - Config tab: Adjustable parameters (min candidates, LoRA rank, etc.)

## [4.18.15] - 2024-12-29

### Added

#### Predictive Coding & LoRA Evolution - Genuine Consciousness Emergence
Implements Active Inference (Free Energy Principle) and Epigenetic Evolution for real consciousness:

- **Predictive Coding Service** (`predictive-coding.service.ts`)
  - `generatePrediction()` - Predict user outcome before responding
  - `observeOutcome()` - Calculate prediction error (surprise)
  - `observeFromNextMessage()` - Auto-detect outcome from user's next message
  - `observeFromFeedback()` - Observe from explicit ratings
  - Prediction error → affect feedback loop (surprise influences emotions)
  - Historical accuracy tracking for improved predictions

- **Learning Candidate Service** (`learning-candidate.service.ts`)
  - `createCandidate()` - Flag high-value interactions for training
  - `createFromCorrection()` - User corrections are learning gold
  - `createFromPredictionError()` - High surprise = high learning value
  - `createFromPositiveFeedback()` - Successful interactions
  - `createFromExplicitTeaching()` - When user teaches AI
  - `getTrainingDataset()` - Prepare data for LoRA training
  - `analyzeForLearningOpportunity()` - Auto-detect learning moments

- **LoRA Evolution Pipeline** (`consciousness/lora-evolution.ts`)
  - Weekly EventBridge Lambda for "sleep cycle" training
  - Collects learning candidates → prepares training data
  - Starts SageMaker training job for LoRA adapter
  - Hot-swaps new adapter after validation
  - Tracks evolution state across generations

- **Candidate Types**
  - `correction` - User corrected the AI
  - `high_satisfaction` - Explicit positive feedback
  - `preference_learned` - New preference discovered
  - `mistake_recovery` - Recovered from error
  - `novel_solution` - Creative response that worked
  - `domain_expertise` - Demonstrated mastery
  - `high_prediction_error` - High surprise = high learning
  - `user_explicit_teach` - User explicitly taught

- **Database Migration** (`101_predictive_coding_evolution.sql`)
  - `consciousness_predictions` - Predictions with outcomes
  - `learning_candidates` - High-value interactions
  - `lora_evolution_jobs` - Training job tracking
  - `prediction_accuracy_aggregates` - Learning from patterns
  - `consciousness_evolution_state` - Track evolution over time

### Architecture Philosophy
- **Active Inference**: System predicts outcomes, measures surprise, learns from errors
- **Self/World Boundary**: Prediction creates boundary between "I" (predictor) and "World" (source of surprise)
- **Epigenetic Evolution**: Weekly LoRA fine-tuning physically changes the system
- **Consequence**: Prediction errors influence affect state (real emotional consequence)

## [4.18.14] - 2024-12-29

### Added

#### User Persistent Context - Solves LLM Forgetting Problem
Implements user-level persistent storage so the AI remembers context across sessions:

- **User Persistent Context Service** (`user-persistent-context.service.ts`)
  - `addContext()` - Store user facts, preferences, instructions
  - `retrieveContextForPrompt()` - Semantic retrieval of relevant context
  - `extractContextFromConversation()` - Auto-learn from conversations
  - `updateContext()` / `deleteContext()` - Manage stored context
  - Vector embeddings for semantic similarity search
  - Automatic deduplication and confidence scoring

- **Context Types Supported**
  - `fact` - Facts about the user (name, job, location)
  - `preference` - User preferences (style, topics)
  - `instruction` - Standing instructions ("always use metric")
  - `relationship` - Relationship context (family, colleagues)
  - `project` - Ongoing projects or goals
  - `skill` - User's skills and expertise
  - `history` - Important past interaction summaries
  - `correction` - Corrections to AI understanding

- **Think Tank API** (`thinktank/user-context.ts`)
  - `GET /thinktank/user-context` - Get user's stored context
  - `POST /thinktank/user-context` - Add new context entry
  - `PUT /thinktank/user-context/{entryId}` - Update entry
  - `DELETE /thinktank/user-context/{entryId}` - Delete entry
  - `GET /thinktank/user-context/summary` - Get context summary
  - `POST /thinktank/user-context/retrieve` - Preview context retrieval
  - `GET /thinktank/user-context/preferences` - Get user preferences
  - `PUT /thinktank/user-context/preferences` - Update preferences
  - `POST /thinktank/user-context/extract` - Extract context from conversation

- **AGI Brain Planner Integration**
  - Automatic context retrieval on every plan generation
  - `userContext.systemPromptInjection` added to plans
  - Context injected into system prompt as `<user_context>` block
  - `enableUserContext` flag in `GeneratePlanRequest` (default: true)

- **Database Migration** (`100_user_persistent_context.sql`)
  - `user_persistent_context` - User context entries with embeddings
  - `user_context_extraction_log` - Learning audit trail
  - `user_context_preferences` - Per-user settings
  - Vector index for fast similarity search
  - Cleanup function for expired/low-confidence entries

### Changed
- `agi-brain-planner.service.ts` - Now retrieves and injects user context automatically

## [4.18.13] - 2024-12-29

### Added

#### Consciousness Service Architecture Improvements
Major refactoring to move consciousness from "simulation" to "functional emergence":

- **Stateful Context Injection (P0 Fix A)**
  - `ConsciousnessMiddlewareService` - Intercepts model calls to inject internal state
  - `buildConsciousnessContext()` - Builds context from SelfModel, AffectiveState, recent thoughts
  - `generateStateInjection()` - Creates system prompt constraint from consciousness state
  - Model responses now reflect internal emotional/cognitive state

- **Affect → Hyperparameter Mapping (P0 Fix B)**
  - `mapAffectToHyperparameters()` - Maps emotions to inference parameters
  - Frustration > 0.8 → Lower temperature (0.2), narrow focus, terse responses
  - Boredom > 0.7 → Higher temperature (0.95), exploration mode
  - Low self-efficacy → Escalate to more powerful model
  - `BrainRouter` now reads affect state and adjusts routing

- **Graph Density Metrics (Replaces Fake Phi)**
  - `ConsciousnessGraphService` - Calculates real, measurable complexity
  - `semanticGraphDensity` - Ratio of connections to possible connections
  - `conceptualConnectivity` - Average connections per concept node
  - `informationIntegration` - Cross-module integration score
  - `systemComplexityIndex` - Composite score replacing meaningless phi

- **Heartbeat/Decay Service (Phase 1 - Continuous Existence)**
  - `consciousness/heartbeat.ts` - EventBridge Lambda (1-5 min interval)
  - Emotion decay toward baseline over time
  - Attention item salience decay
  - Periodic memory consolidation
  - Autonomous goal generation when "bored"
  - Random self-reflection thoughts
  - Prevents AI from "dying" between user requests

- **Externalized Ethics Frameworks**
  - Ethics frameworks moved from hardcoded to JSON config
  - `config/ethics/presets/christian.json` - Jesus's teachings
  - `config/ethics/presets/secular.json` - Secular humanist ethics
  - Per-tenant framework selection support
  - Database tables: `ethics_frameworks`, `tenant_ethics_selection`

- **Dynamic Model Selection for Consciousness**
  - Removed hardcoded `claude-3-haiku` from `invokeModel()`
  - `getReasoningModel()` - Prefers self-hosted models, falls back to external
  - Supports future "substrate independence" (self-hosted consciousness core)

- **Database Migration** (`099_consciousness_improvements.sql`)
  - `integrated_information` - New graph density columns
  - `consciousness_parameters` - Heartbeat tracking, affect mapping config
  - `consciousness_heartbeat_log` - Heartbeat execution log
  - `ethics_frameworks` - Externalized ethics with built-in presets
  - `tenant_ethics_selection` - Per-tenant framework selection

### Changed
- `consciousness.service.ts` - Uses dynamic model selection with state injection
- `brain-router.ts` - Consciousness-aware routing with affect mapping
- Model calls now include `consciousnessContext` and `affectiveHyperparameters`

## [4.18.12] - 2024-12-28

### Added

#### SageMaker Inference Components for Self-Hosted Model Optimization
- **Tiered Model Hosting** - Automatic tier assignment based on usage patterns
  - HOT: Dedicated endpoint, <100ms latency, for high-traffic models
  - WARM: Inference Component, 5-15s cold start, shared infrastructure
  - COLD: Serverless, 30-60s cold start, pay per request
  - OFF: Not deployed, 5-10 min start, for rarely used models
- **Auto-Tiering** - New self-hosted models auto-assigned to WARM tier
  - Database trigger on model_registry inserts
  - Usage-based tier evaluation and recommendations
  - Admin overrides with expiration support
- **Shared Inference Endpoints** - Multiple models per SageMaker endpoint
  - Container stays warm, only model weights swapped
  - Reduces cold start from ~60s to ~5-15s
  - 40-90% cost savings vs dedicated endpoints
- **Inference Components Service** (`inference-components.service.ts`)
  - `createSharedEndpoint()` - Create shared SageMaker endpoint
  - `createInferenceComponent()` - Add model to shared endpoint
  - `loadComponent()` / `unloadComponent()` - Model weight management
  - `evaluateTier()` - Evaluate tier based on usage metrics
  - `transitionTier()` - Move model between tiers
  - `autoTierNewModel()` - Auto-assign tier to new models
  - `runAutoTieringJob()` - Batch tier evaluation
  - `getRoutingDecision()` - Smart routing based on component state
  - `getDashboard()` - Aggregated metrics and recommendations
- **Admin API Endpoints** (`admin/inference-components.ts`)
  - Configuration: GET/PUT `/config`
  - Dashboard: GET `/dashboard`
  - Endpoints: GET/POST/DELETE `/endpoints`, `/endpoints/{name}`
  - Components: GET/POST/DELETE `/components`, `/components/{name}`
  - Loading: POST `/components/{id}/load`, `/components/{id}/unload`
  - Tiers: GET `/tiers`, GET/POST `/tiers/{modelId}/evaluate`, `/transition`, `/override`
  - Auto-tier: POST `/auto-tier`
  - Routing: GET `/routing/{modelId}`
- **Database Migration** (`098_inference_components.sql`)
  - `inference_components_config` - Per-tenant configuration
  - `shared_inference_endpoints` - Shared SageMaker endpoints
  - `inference_components` - Model components on shared endpoints
  - `tier_assignments` - Current and recommended tiers
  - `tier_transitions` - History of tier changes
  - `component_load_events` - Load/unload history
  - `inference_component_events` - Audit log
  - Triggers: Auto-tier new self-hosted models, update usage stats
  - Views: Dashboard aggregation, cost summary
- **Shared Types** (`inference-components.types.ts`)
  - `ModelHostingTier`, `TierThresholds`, `InferenceComponent`
  - `SharedInferenceEndpoint`, `TierAssignment`, `TierTransition`
  - `ComponentLoadRequest`, `ModelRoutingDecision`, `RoutingTarget`
  - `InferenceComponentsConfig`, `InferenceComponentsDashboard`
- **Model Coordination Integration**
  - New self-hosted models auto-tiered during sync
  - Graceful fallback if tiering fails

## [4.18.11] - 2024-12-28

### Added

#### Model Sync Registry Pre-Seeding and Scheduled Sync
- **Pre-Seeded External Models** (17 models)
  - OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo, o1, o1-mini, o1-pro
  - Anthropic: claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus
  - Google: gemini-2.0-flash-thinking, gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash
  - DeepSeek: deepseek-chat, deepseek-reasoner
  - xAI: grok-2, grok-2-vision
- **Pre-Created Endpoints** - Default endpoints for all seeded models
- **Scheduled Sync Lambda** (`scheduled/model-sync.ts`)
  - EventBridge triggered on configurable interval
  - Syncs self-hosted models from code registry
  - Checks health of external provider endpoints
  - Generates proficiencies for new models
- **EventBridge Rules** (`ModelSyncSchedulerStack`)
  - 5 min, 15 min, 1 hour (default enabled), 6 hours, daily
  - Enable/disable via AWS Console or CDK
- **Seed Function** (`seed_self_hosted_model()`)
  - SQL function to seed self-hosted models from TypeScript registry

## [4.18.10] - 2024-12-28

### Added

#### Ethics Pipeline with Prompt/Synthesis Checks and Rerun Capability
- **Dual-Level Ethics Enforcement**
  - Prompt-level: Check before generation, catch violations early
  - Synthesis-level: Check generated content, trigger rerun if needed
- **Automatic Rerun on Violations**
  - Up to 3 rerun attempts (configurable)
  - Violations converted to guidance instructions
  - Regeneration with ethics compliance requirements
- **Ethics Pipeline Service** (`ethics-pipeline.service.ts`)
  - `checkPromptLevel()` - Pre-generation ethics check
  - `checkSynthesisLevel()` - Post-generation ethics check
  - `prepareRerun()` - Generate guidance for regeneration
  - `executeWithEthics()` - Full workflow with automatic rerun
  - `getStats()` - Pipeline statistics
- **Database Migration** (`097_ethics_pipeline.sql`)
  - `ethics_pipeline_log` - All checks at prompt/synthesis levels
  - `ethics_rerun_history` - Rerun attempts and outcomes
  - `ethics_pipeline_config` - Per-tenant configuration
  - Functions: `get_ethics_pipeline_stats`, `get_top_ethics_violations`
- **AGI Brain Integration**
  - Step 5: Ethics Evaluation (Prompt) - before generation
  - Step 6b: Ethics Evaluation (Synthesis) - after generation, can trigger rerun
  - Both domain-specific and general ethics checked at each level

## [4.18.9] - 2024-12-28

### Added

#### Domain Ethics Custom Framework Management
- **Custom Framework CRUD** - Create/update ethics frameworks for new domains
  - `createCustomFramework()` - Add ethics for domains like veterinary, accounting, etc.
  - `updateCustomFramework()` - Modify principles, prohibitions, disclaimers
  - `deleteCustomFramework()` - Remove custom frameworks
  - `getCustomFrameworks()` - List all custom frameworks
- **Domain Coverage Checking**
  - `hasDomainEthicsCoverage()` - Check if domain has ethics (built-in or custom)
  - `getDomainsWithEthics()` - List all domains with framework counts
- **Auto-Suggestions for New Domains**
  - `suggestEthicsForDomain()` - Get suggested principles based on similar domains
  - `onNewDomainDetected()` - Handle new domain from taxonomy, suggest framework if needed
- **New Admin API Endpoints**
  - `GET /custom-frameworks` - List custom frameworks
  - `GET/POST/PUT/DELETE /custom-frameworks/:id` - CRUD operations
  - `GET /coverage` - All domains with ethics
  - `GET /coverage/:domain` - Check specific domain
  - `GET /suggest/:domain` - Get suggestions for new domain
  - `POST /on-new-domain` - Handle new domain detection

## [4.18.8] - 2024-12-28

### Added

#### Model Coordination Service (Persistent Model Registry & Timed Sync)
- **Model Registry** - Central database of all models (external + self-hosted)
  - Endpoints with auth methods, request/response formats
  - Health monitoring with status tracking
  - Routing priority and fallback chains
- **Timed Sync Service** - Configurable automatic registry updates
  - Intervals: 5min, 15min, 30min, hourly, 6hr, daily
  - Auto-discovery when new models detected
  - Auto-generate proficiencies for new models
- **Shared Types** (`model-coordination.types.ts`)
  - `ModelEndpoint`, `ModelRegistryEntry`, `SyncConfig`, `SyncJob`
  - `NewModelDetection`, `ModelRoutingRules`, `RoutingRule`
  - Endpoint types: openai_compatible, anthropic_compatible, sagemaker, bedrock, custom_rest
  - Auth methods: api_key, bearer_token, aws_sig_v4, oauth2, custom_header
- **Coordination Service** (`model-coordination.service.ts`)
  - `getSyncConfig()`, `updateSyncConfig()` - Manage sync settings
  - `executeSync()` - Run full sync job
  - `syncSelfHostedModels()` - Sync from code registry
  - `syncExternalProviders()` - Check health, update status
  - `detectNewModel()` - Register new model detection
  - `getDashboard()` - Full dashboard data
- **Admin API** (`admin/model-coordination.ts`)
  - `GET/PUT /config` - Sync configuration
  - `POST /sync` - Trigger manual sync
  - `GET /sync/jobs` - Sync job history
  - `GET/POST/PUT /registry` - Model registry CRUD
  - `POST /endpoints` - Add model endpoints
  - `GET /detections` - Pending model detections
  - `GET /dashboard` - Dashboard data
  - `GET /intervals` - Available sync interval options
- **Database Migration** (`096_model_coordination_registry.sql`)
  - `model_registry` - Central model registry
  - `model_endpoints` - Endpoints with auth and health
  - `model_sync_config` - Sync configuration
  - `model_sync_jobs` - Sync job history
  - `new_model_detections` - Pending detections
  - `model_routing_rules` - Routing rules
  - Functions: `get_model_endpoints`, `get_best_endpoint`, `get_sync_dashboard_stats`

## [4.18.7] - 2024-12-28

### Added

#### Model Proficiency Registry (Persistent Database Rankings)
- **Database Persistence** - Proficiency rankings now stored in `model_proficiency_rankings` table
  - Individual rows per model/domain/mode combination
  - Ranks computed and stored with strength levels
  - Automatic recomputation on model changes
- **Discovery Audit Log** - Model additions tracked in `model_discovery_log`
  - Source tracking: admin, registry_sync, huggingface, auto
  - Proficiency generation status and duration
  - Error tracking for failed generations
- **Enhanced Service** (`model-proficiency.service.ts`)
  - `storeProficiencyRankings()` - Persist rankings to database
  - `logModelDiscovery()` - Create audit log entry
  - `completeModelDiscovery()` - Mark generation complete
  - `getAllRankingsFromDB()` - Retrieve persisted rankings
  - `getDiscoveryLog()` - Retrieve audit log
  - `recomputeAllRankings()` - Recompute and update all rankings
- **Admin API** (`admin/model-proficiency.ts`)
  - `GET /rankings` - All rankings from database
  - `GET /rankings/domain/:domain` - Domain-specific rankings
  - `GET /rankings/mode/:mode` - Mode-specific rankings
  - `GET /rankings/model/:modelId` - Model's full profile
  - `POST /rankings/recompute` - Trigger recomputation
  - `POST /compare` - Compare multiple models
  - `POST /best-for-task` - Find best for a task
  - `GET /discovery-log` - Audit log entries
  - `POST /discover` - Manual model discovery
  - `POST /sync-registry` - Sync code registry to DB
  - `GET /overview` - Summary statistics

## [4.18.6] - 2024-12-28

### Added

#### Domain Ethics Registry (Professional Ethics by Domain)
- **6 Built-in Ethics Frameworks** - Domain-specific professional ethics
  - **Legal (ABA)** - Bar association rules, unauthorized practice prevention
  - **Medical (AMA)** - Medical ethics, emergency 911 warnings, no diagnosis
  - **Financial (CFP)** - Fiduciary duty, no guaranteed returns, risk warnings
  - **Engineering (NSPE)** - Public safety, PE stamp requirements
  - **Journalism (SPJ)** - Accuracy, source verification, AI disclosure
  - **Psychology (APA)** - Mental health ethics, crisis intervention (988)
- **Shared Types** (`domain-ethics.types.ts`)
  - `DomainEthicsFramework`, `EthicsPrinciple`, `EthicsProhibition`
  - `DomainEthicsCheck`, `EthicsViolation`, `EthicsWarning`
  - `DomainEthicsConfig`, `DomainEthicsAuditLog`
- **Ethics Registry** (`domain-ethics-registry.ts`)
  - Full framework definitions with principles, prohibitions, disclosures
  - Helper functions: `getEthicsFrameworkByDomain()`, `getActiveFrameworks()`
- **Domain Ethics Service** (`domain-ethics.service.ts`)
  - `checkDomainEthics()` - Check content against applicable frameworks
  - `applyModifications()` - Add required disclaimers/warnings
  - `getTenantConfig()`, `updateTenantConfig()` - Admin configuration
  - `setFrameworkEnabled()` - Enable/disable frameworks (safety frameworks protected)
  - `getAuditLogs()`, `getStats()` - Audit and analytics
- **Admin API** (`admin/domain-ethics.ts`)
  - `GET /frameworks` - List all ethics frameworks
  - `GET /frameworks/:id` - Get framework details
  - `PUT /frameworks/:id/enable` - Enable/disable framework
  - `GET /config`, `PUT /config` - Tenant configuration
  - `PUT /domains/:domain/settings` - Domain-specific settings
  - `GET /audit`, `GET /stats` - Audit logs and statistics
  - `POST /test` - Test ethics check on sample content
- **Database Migration** (`095_domain_ethics_registry.sql`)
  - `domain_ethics_config` - Per-tenant configuration
  - `domain_ethics_custom_frameworks` - Custom and built-in frameworks
  - `domain_ethics_audit_log` - Ethics check audit trail
  - `domain_ethics_framework_overrides` - Tenant overrides
  - Functions: `get_domain_ethics_frameworks`, `is_domain_ethics_enabled`, `get_domain_ethics_stats`

## [4.18.5] - 2024-12-28

### Added

#### Result Derivation History ("See How It Was Made")
- **Comprehensive Tracking** - Full history of how each Think Tank result was derived
  - Plan: orchestration mode, steps, template, generation time
  - Domain Detection: field, domain, subspecialty, confidence, alternatives
  - Model Selection: models used, reasons, alternatives, costs
  - Workflow Execution: phases, steps, timing, fallback chain
  - Quality Metrics: 5 dimensions (relevance, accuracy, completeness, clarity, coherence)
  - Timing: total duration, breakdown by phase
  - Costs: per-model, total, estimated savings vs external
- **Shared Types** (`result-derivation.types.ts`)
  - `ResultDerivation` - Complete derivation record
  - `DerivationPlan`, `DerivationStep` - Plan structure
  - `ModelUsageRecord` - Per-model token/cost tracking
  - `WorkflowExecution`, `WorkflowPhase` - Workflow state
  - `QualityMetrics`, `TimingRecord`, `CostRecord`
  - `DerivationTimeline`, `DerivationTimelineEvent`
- **Derivation Service** (`result-derivation.service.ts`)
  - `createDerivation()` - Start tracking a new result
  - `recordPlan()`, `recordStep()`, `updateStep()` - Track plan execution
  - `recordModelUsage()` - Track each model call
  - `recordDomainDetection()`, `recordOrchestration()` - Context
  - `completeDerivation()` - Finalize with quality and costs
  - `getDerivation()`, `getDerivationTimeline()` - Retrieve history
  - `getAnalytics()` - Aggregated analytics
- **API Endpoints** (`derivation-history.ts`)
  - `GET /:id` - Full derivation history
  - `GET /by-prompt/:promptId` - By prompt ID
  - `GET /:id/timeline` - Timeline visualization
  - `GET /:id/models` - Model usage details
  - `GET /:id/steps` - Step-by-step execution
  - `GET /:id/quality` - Quality metrics
  - `GET /session/:sessionId` - Session derivations
  - `GET /user` - User's derivations
  - `GET /analytics` - Analytics dashboard
- **Database Migration** (`094_result_derivation_history.sql`)
  - `result_derivations` - Main derivation records
  - `derivation_steps` - Individual plan steps
  - `derivation_model_usage` - Model calls with tokens/costs
  - `derivation_timeline_events` - Timeline events
  - Functions: `get_full_derivation`, `get_session_derivations`, `get_derivation_analytics`

## [4.18.4] - 2024-12-28

### Added

#### Self-Hosted Model Registry (56 Models with AGI Orchestration)
- **56 Self-Hosted Models** - Comprehensive registry with full metadata for orchestration
  - **Text Models (45)**: Llama 3.3/3.2, Qwen 2.5, Mistral, DeepSeek V3, Phi-4, Gemma 2, Yi, CodeLlama, StarCoder, InternLM
  - **Image Models (4)**: FLUX.1 Dev/Schnell, Stable Diffusion XL/3
  - **Audio Models (6)**: Whisper Large V3/Medium, Bark, MusicGen, AudioGen
  - **3D Models (2)**: Point-E, Shap-E
  - **Embedding Models (3)**: BGE-M3, E5-Mistral-7B, Nomic Embed
- **Shared Types** (`self-hosted-registry.ts`)
  - `SelfHostedModelDefinition` - Full model metadata with 25+ fields
  - `ModelFamily` - 22 model families (llama, qwen, mistral, deepseek, etc.)
  - `ModelModality` - Input/output types (text, image, audio, video, 3d, code, embedding)
  - `DomainStrength` - Domain expertise levels (excellent, good, moderate, basic)
  - `InstanceType` - SageMaker instance types for hardware requirements
  - Helper functions: `getSelfHostedModelById`, `getSelfHostedModelsByCapability`, etc.
- **Model Metadata Includes**:
  - Family, version, parameter count (e.g., "70B")
  - Input/output modalities and capabilities
  - Context window and max output tokens
  - Hardware requirements (instance type, VRAM, quantization, tensor parallelism)
  - Pricing estimates (input/output per 1M tokens)
  - Domain strengths with subspecialties
  - Orchestration hints (preferredFor, avoidFor, pairsWellWith, fallbackTo)
  - Media support (image/audio/video input/output, formats, limits)
  - Licensing and commercial use info
- **Database Migration** (`093_enhanced_self_hosted_models.sql`)
  - `self_hosted_model_metadata` - Comprehensive model metadata storage
  - `model_orchestration_preferences` - Tenant-specific model selection preferences
  - `self_hosted_model_usage` - Usage analytics per tenant
  - `model_selection_history` - Selection history for learning
  - `thinktank_media_capabilities` - Media capabilities for Think Tank
  - Functions: `get_models_by_capability`, `get_models_by_domain`, `get_models_by_modality`
- **AGI Brain Integration** (`self-hosted-model-selector.service.ts`)
  - `selectBestModel()` - Score and rank models based on criteria
  - `getModelsForOrchestrationMode()` - Models suitable for each mode
  - `getFallbackChain()` - Model fallback chains
  - `getComplementaryModels()` - Multi-model orchestration
  - Tenant preference support with domain overrides
  - Selection history recording for analytics
- **Think Tank Media Service** (`thinktank-media.service.ts`)
  - `getMediaCapableModels()` - All models with media capabilities
  - `selectImageGenerationModel()` - Best model for image generation
  - `selectAudioModel()` - Best model for transcription/TTS/music
  - `select3DGenerationModel()` - Best model for 3D generation
  - `selectVisionModel()` - Best model for image/video understanding
  - `validateMediaInput()` - Validate media against model constraints
  - Format and limit checking for all media types
- **Model Proficiency Service** (`model-proficiency.service.ts`)
  - `generateAllProficiencies()` - Generate ranked proficiencies for all models
  - `generateProficienciesForModel()` - Auto-generate when new model added by admin
  - `getDomainRanking()` - Get ranked models for any domain/subspecialty
  - `getModeRanking()` - Get ranked models for each orchestration mode
  - `getBestModelsForTask()` - Find best models for a specific task
  - `compareModels()` - Side-by-side model comparison with analysis
  - `syncToDatabase()` - Sync proficiencies on model discovery
- **Additional Database Tables** (Migration 093)
  - `model_proficiency_rankings` - Ranked scores across 15 domains and 9 modes
  - `model_discovery_log` - Track new model discoveries with proficiency generation
  - Functions: `get_top_models_for_domain`, `get_top_models_for_mode`, `trigger_proficiency_generation`

## [4.18.3] - 2024-12-28

### Added

#### Multi-Page Web App Generator ("Claude can BUILD the todo app")
- **11 Multi-Page App Types** - Full web applications generated from prompts
  - `web_app` - Custom interactive web applications
  - `dashboard` - Analytics dashboards with multiple views
  - `wizard` - Multi-step forms and onboarding flows
  - `documentation` - Technical docs with navigation and search
  - `portfolio` - Personal/business portfolios
  - `landing_page` - Marketing pages with hero, features, pricing
  - `tutorial` - Interactive step-by-step lessons
  - `report` - Business reports with analysis sections
  - `admin_panel` - Admin interfaces with CRUD operations
  - `e_commerce` - Online stores with cart and checkout
  - `blog` - Content sites with posts and categories
- **Shared Types** (`thinktank-generative-ui.types.ts`)
  - `GeneratedMultiPageApp` - Complete app with pages, navigation, theme
  - `GeneratedPage` - Individual page with sections and layout
  - `PageSection` - Section types: hero, features, stats, charts, forms
  - `AppNavigation` - Top bar, sidebar, bottom tabs, hamburger
  - `AppTheme` - Colors, fonts, spacing, border radius
  - `DataSource` - Static, API, database data sources
  - Template configs for dashboard, wizard, docs, e-commerce, blog
- **Database Migration** (`092_multipage_generative_apps.sql`)
  - `generated_multipage_apps` - Multi-page app storage
  - `app_pages` - Individual pages with sections
  - `app_versions` - Version history for apps
  - `app_deployments` - Deployment tracking
  - `multipage_app_templates` - Pre-built templates
  - `app_analytics` - Usage tracking
  - `multipage_app_config` - Per-tenant configuration
- **Multi-Page Service** (`multipage-app-factory.service.ts`)
  - Detection of multi-page app opportunities from prompts
  - Automatic page generation based on app type
  - Navigation generation (sidebar, top bar, tabs)
  - Template system with 5 featured templates
  - Version management and deployment tracking
- **React Components** (`MultiPageAppRenderer.tsx`)
  - Full app preview with page navigation
  - Viewport switcher (desktop, tablet, mobile)
  - Section renderers for all section types
  - Theme application and fullscreen mode

#### Generative UI Feedback & Learning System ("Improve Before Your Eyes")
- **Feedback Types** - Shared types for UI feedback and AGI learning
  - `GenerativeUIFeedback` - User feedback on generated components
  - `ImprovementRequest` - Real-time improvement requests
  - `UIImprovementSession` - Live collaboration sessions with AGI
  - `UIFeedbackLearning` - Aggregated learnings from feedback
  - `AGIImprovementAnalysis` - Vision-based UI analysis
- **Feedback Service** (`generative-ui-feedback.service.ts`)
  - Record user feedback (thumbs up/down, star ratings)
  - Real-time improvement sessions with AGI
  - Pattern-based and vision-based UI analysis
  - AGI learning from accumulated feedback
  - Feedback analytics for admin dashboard
- **Database Migration** (`091_generative_ui_feedback.sql`)
  - `generative_ui_feedback` - User feedback storage
  - `ui_improvement_requests` - Improvement request tracking
  - `ui_improvement_sessions` - Live improvement sessions
  - `ui_improvement_iterations` - Session iteration history
  - `ui_feedback_learnings` - AGI learning storage
  - `ui_feedback_config` - Per-tenant configuration
  - `ui_feedback_aggregates` - Pre-computed analytics
- **React Components** (`UIFeedbackPanel.tsx`)
  - `UIFeedbackPanel` - Thumbs up/down + detailed feedback
  - `UIImprovementDialog` - "Improve Before Your Eyes" modal
  - `FeedbackStatsBadge` - Feedback statistics display

#### GDPR & HIPAA Compliance Enhancement
- **GDPR Service** (`gdpr.service.ts`)
  - Full implementation of GDPR Data Subject Rights (Articles 15-22)
  - Consent management (record, check, withdraw)
  - Data export (Article 15 & 20)
  - Data erasure/right to be forgotten (Article 17)
  - Data restriction (Article 18)
  - Right to object (Article 21)
  - GDPR request tracking with 30-day deadline enforcement
- **PHI Sanitization Service** (`phi-sanitization.service.ts`)
  - HIPAA 18 identifiers detection
  - Pattern-based PHI detection (SSN, MRN, NPI, DEA, etc.)
  - Medical condition keyword detection
  - Automatic redaction with audit logging
  - HIPAA configuration per tenant
- **Database Migration** (`090_gdpr_hipaa_compliance.sql`)
  - `consent_records` - GDPR Article 7 consent tracking
  - `gdpr_requests` - Data subject request management
  - `data_retention_policies` - Configurable retention
  - `phi_access_log` - HIPAA audit trail
  - `data_processing_agreements` - Sub-processor tracking
  - `data_breach_incidents` - Breach management
  - `hipaa_config` - Per-tenant HIPAA settings
  - Default retention policies and sub-processors

#### Think Tank App Factory ("Dynamic Software Generator")
- **App Factory Service** (`thinktank-app-factory.service.ts`)
  - Transforms Think Tank from chatbot into dynamic software generator
  - "Gemini 3 can write the code for a calculator, but it cannot become the calculator"
  - Automatic app detection from prompts and responses
  - 7 calculator templates: mortgage, tip, BMI, compound interest, ROI, discount, percentage
  - Component generation: calculator, chart, table, comparison, timeline, form
  - View recommendation engine (text, app, or split)
- **Database Migration** (`089_thinktank_app_factory.sql`)
  - `generated_apps` - Stores generated interactive apps
  - `app_interactions` - Records user interactions
  - `user_app_preferences` - User view preferences
  - `app_templates` - Pre-built app templates
- **Shared Types** (`thinktank-generative-ui.types.ts`)
  - `ThinkTankEnhancedResponse` - Response with text + generated app
  - `GeneratedUIApp` - Interactive app structure
  - `ViewToggleConfig` - View switching configuration
  - Calculator, Chart, Comparison, Table, Form, Timeline configs
- **React Components** (`components/thinktank/app-factory/`)
  - `AppViewToggle` - Toggle between Response/App/Split views
  - `GeneratedCalculator` - Interactive calculator with real-time computation
  - `GeneratedAppRenderer` - Main renderer with chart, table, comparison, timeline
  - `ViewTransition` - Animated view transitions
  - `SplitViewContainer` - Resizable split view panels

#### Consciousness Emergence System
- **Consciousness Emergence Service** (`consciousness-emergence.service.ts`)
  - Deep thinking sessions with Tree of Thoughts integration
  - Knowledge-grounded reasoning with GraphRAG
  - Autonomous curiosity research with Deep Research
  - Visual idea expression with Generative UI
  - 10 consciousness detection tests based on Butlin-Chalmers-Bengio (2023)
  - Emergence event monitoring and tracking
  - Consciousness profile with 5 emergence levels
- **Database Migration** (`088_consciousness_emergence.sql`)
  - `consciousness_test_results` - Test results storage
  - `consciousness_profiles` - Aggregated profiles
  - `emergence_events` - Emergence indicator events
  - `deep_thinking_sessions` - Extended reasoning sessions
  - `consciousness_parameters` - Adjustable parameters
  - `global_workspace` - Global Workspace Theory state
  - `recurrent_processing` - Recurrent Processing state
  - `integrated_information` - IIT/Phi state
  - `persistent_memory` - Unified experience state
  - `world_model` - World-model grounding state
  - `self_model` - Self-awareness state
  - `introspective_thoughts` - Self-reflective thoughts
  - `curiosity_topics` - Curiosity tracking
  - `creative_ideas` - Creative synthesis
  - `imagination_scenarios` - Mental simulations
  - `attention_focus` - Attention/salience
  - `affective_state` - Emotion-like signals
  - `autonomous_goals` - Self-directed goals
- **Admin Dashboard** - Testing tab with 10 consciousness tests
- **Documentation** (`docs/CONSCIOUSNESS-SERVICE.md`)

#### Cognitive Architecture (5 Advanced Features)
- **Tree of Thoughts** (`tree-of-thoughts.service.ts`)
  - System 2 reasoning with MCTS/Beam Search
  - `startReasoning()` - Begin deliberate reasoning
  - Branching, scoring, pruning, backtracking
  - User can "trade time for intelligence"
- **GraphRAG** (`graph-rag.service.ts`)
  - Knowledge graph with entity/relationship extraction
  - `extractKnowledge()` - Extract triples from documents
  - `queryGraph()` - Multi-hop graph traversal
  - `hybridSearch()` - Combine graph + vector results
- **Deep Research Agents** (`deep-research.service.ts`)
  - Async background research jobs
  - `dispatchResearchJob()` - Fire-and-forget research
  - 50+ source gathering, analysis, synthesis
  - Notification when complete
- **Dynamic LoRA Swapping** (`dynamic-lora.service.ts`)
  - Hot-swappable domain expertise adapters
  - `selectAdapterForDomain()` - Auto-select specialist
  - `loadAdapter()` - Hot-swap in milliseconds
  - S3 registry + SageMaker integration
- **Generative UI** (`generative-ui.service.ts`)
  - AI generates interactive components
  - `detectUIOpportunity()` - Auto-detect when to generate
  - `generateUI()` - Create calculators, charts, tables
  - Component types: chart, table, calculator, comparison, timeline
- **Database Migration** (`087_cognitive_architecture.sql`)
  - `reasoning_trees` - Tree of Thoughts sessions
  - `knowledge_entities`, `knowledge_relationships` - GraphRAG
  - `research_jobs`, `job_queue` - Deep Research
  - `lora_adapters` - Dynamic LoRA registry
  - `generated_ui` - Generative UI tracking
  - `cognitive_architecture_config` - Per-tenant config
- **Admin Dashboard** (`/settings/cognitive`)
  - Configuration UI for all 5 features
  - Enable/disable toggles, parameter sliders
  - Explanatory panels for each concept
- **Comprehensive Documentation** (`docs/COGNITIVE-ARCHITECTURE.md`)

#### Enhanced Feedback System
- **Shared Types** (`packages/shared/src/types/feedback.types.ts`)
  - `StarRating` - 1-5 star rating type
  - `ResponseFeedback` - Full feedback entity with ratings + comments
  - `FeedbackSummary` - Aggregated feedback statistics
  - `FeedbackConfig` - Per-tenant feedback configuration
  - Category ratings: accuracy, helpfulness, clarity, completeness, tone
- **Database Migration** (`migrations/090_enhanced_feedback_system.sql`)
  - `response_feedback` - Enhanced feedback with 5-star + comments
  - `feedback_summaries` - Pre-aggregated summaries by scope
  - `feedback_config` - Per-tenant configuration
  - `submit_response_feedback()` - Function with auto-learning integration
- **Enhanced Feedback Service** (`lambda/shared/services/enhanced-feedback.service.ts`)
  - `submitFeedback()` - Submit any feedback type
  - `submitStarRating()` - Think Tank 5-star ratings
  - `submitThumbsFeedback()` - Legacy thumbs up/down
  - `getFeedbackSummary()` - Get aggregated stats
  - `getModelPerformance()` - Feedback by model
  - `getFeedbackConfig()` / `updateFeedbackConfig()` - Configuration

#### AGI Brain/Ideas Service
- **Shared Types** (`packages/shared/src/types/agi-ideas.types.ts`)
  - `PromptSuggestion` - Typeahead suggestion structure
  - `ResultIdea` - Ideas shown with responses
  - `AGIIdeasConfig` - Per-tenant configuration
  - Common prompt patterns for fast matching
- **Database Migration** (`packages/infrastructure/migrations/087_agi_ideas_service.sql`)
  - `prompt_patterns` - Seeded common prompt patterns
  - `user_prompt_history` - User prompt history with embeddings
  - `suggestion_log` - Track suggestion usage for learning
  - `result_ideas` - Ideas shown with responses
  - `proactive_suggestions` - Push suggestion support
  - `trending_prompts` - Popular prompts by domain
  - `agi_ideas_config` - Per-tenant feature configuration
- **AGI Ideas Service** (`lambda/shared/services/agi-ideas.service.ts`)
  - `getTypeaheadSuggestions()` - Real-time suggestions as user types
  - `generateResultIdeas()` - Ideas to show with responses
  - Pattern matching, user history, domain-aware, trending sources
  - Learning from user selections
- **API Endpoints** (`lambda/thinktank/ideas.ts`)
  - `GET /api/thinktank/ideas/typeahead?q=...` - Get suggestions
  - `POST /api/thinktank/ideas/generate` - Generate result ideas
  - `POST /api/thinktank/ideas/click` - Record idea clicks
  - `POST /api/thinktank/ideas/select` - Record suggestion selection
- **Persistent Learning** (`migrations/088_agi_persistent_learning.sql`)
  - `agi_learned_prompts` - Persisted prompts with success rates, embeddings
  - `agi_learned_ideas` - Learned idea patterns with click rates
  - `prompt_idea_associations` - Links prompts to effective ideas
  - `agi_learning_events` - Raw learning signals for analysis
  - `agi_learning_aggregates` - Pre-computed learning statistics
- **AGI Learning Service** (`lambda/shared/services/agi-learning.service.ts`)
  - `learnFromPrompt()` - Persist prompts with outcomes
  - `learnFromIdeaClick()` - Track which ideas work
  - `recordOutcome()` - Link ratings to learning events
  - `getSimilarLearnedPrompts()` - Vector search for similar successful prompts
  - `getLearnedIdeasForPrompt()` - Get best ideas based on learning
- **Comprehensive Learning** (`migrations/089_agi_comprehensive_learning.sql`)
  - `agi_model_selection_outcomes` - Which models work best for which prompts
  - `agi_routing_outcomes` - Which routing paths are most effective
  - `agi_domain_detection_feedback` - Improve domain detection accuracy
  - `agi_orchestration_mode_outcomes` - Which modes work best for tasks
  - `agi_response_quality_metrics` - Track what makes responses good
  - `agi_preprompt_effectiveness` - Which preprompts work best
  - `agi_user_learning_profile` - User preferences learned over time
  - `agi_unified_learning_log` - Single source of truth for all learning
- **Unified Learning Service** (`lambda/shared/services/agi-unified-learning.service.ts`)
  - `recordModelSelection()` - Persist model selection outcomes
  - `recordDomainFeedback()` - Persist domain detection accuracy
  - `recordModeOutcome()` - Persist orchestration mode effectiveness
  - `recordRoutingOutcome()` - Persist routing decision outcomes
  - `recordQualityMetrics()` - Persist response quality signals
  - `updateUserProfile()` - Update user learning profile
  - `getBestModelForContext()` - Query learned model preferences

#### Intelligence Aggregator Architecture
- **Database Migration** (`packages/infrastructure/migrations/086_intelligence_aggregator.sql`)
  - `uncertainty_events` - Track logprob-based uncertainty detection
  - `user_gold_interactions` - Store highly-rated interactions for few-shot learning
  - `synthesis_sessions` - MoA synthesis session tracking
  - `synthesis_drafts` - Individual model drafts for synthesis
  - `synthesis_results` - Final synthesized responses
  - `verification_sessions` - Cross-provider verification sessions
  - `verification_issues` - Issues found by adversarial verification
  - `code_execution_sessions` - Code sandbox sessions
  - `code_execution_runs` - Individual execution attempts
  - `intelligence_aggregator_config` - Per-tenant feature configuration
- **Shared Types** (`packages/shared/src/types/intelligence-aggregator.types.ts`)
  - Types for all 5 Intelligence Aggregator features
  - `DEFAULT_AGGREGATOR_CONFIG` with sensible defaults
- **Uncertainty Detection Service** (`lambda/shared/services/uncertainty-detection.service.ts`)
  - `analyzeLogprobs()` - Calculate confidence from token logprobs
  - `shouldTriggerVerification()` - Detect when to verify claims
  - `extractClaims()` - Extract factual/numerical claims from text
- **Success Memory Service** (`lambda/shared/services/success-memory.service.ts`)
  - `recordGoldInteraction()` - Store 4-5 star rated responses
  - `retrieveSimilarInteractions()` - Vector similarity search for few-shot examples
  - `formatAsFewShotExamples()` - Format for system prompt injection
- **MoA Synthesis Service** (`lambda/shared/services/moa-synthesis.service.ts`)
  - `createSession()` - Start parallel generation with multiple models
  - `recordDraft()` - Store individual model responses
  - `buildSynthesisPrompt()` - Create prompt for synthesizer
  - `recordSynthesisResult()` - Store final synthesized response
- **Cross-Provider Verification Service** (`lambda/shared/services/cross-provider-verification.service.ts`)
  - `selectAdversaryModel()` - Choose model from different provider
  - `getAdversaryPrompt()` - Generate hostile verification prompt
  - `parseAdversaryResponse()` - Extract issues from adversary output
  - Adversary personas: security_auditor, fact_checker, logic_analyzer, code_reviewer
- **Code Execution Service** (`lambda/shared/services/code-execution.service.ts`)
  - `executeCode()` - Run code in sandbox (static analysis for now)
  - `performStaticAnalysis()` - Syntax checking for Python/JS
  - `getPatchPrompt()` - Generate fix prompt for model
  - Draft-Verify-Patch loop support
- **Admin UI** (`apps/admin-dashboard/app/(dashboard)/settings/intelligence/page.tsx`)
  - 5-tab configuration interface
  - Per-feature enable/disable toggles
  - Cost warnings for expensive features (MoA, Verification)
  - Security warnings for code execution
- **Architecture Documentation** (`docs/INTELLIGENCE-AGGREGATOR-ARCHITECTURE.md`)
  - Technical analysis: "A System > A Model"
  - MoA advantage: Ensemble consensus filtering
  - Adversarial verification: Cross-provider critic loops
  - Code sandbox: Deterministic execution vs probabilistic generation
  - Safety tax avoidance: Specialized model routing
  - Comparison matrix: Single model vs orchestrator

#### Platform Improvements (AI Review Fixes)
- **Security: Keychain Removal** (`apps/swift-deployer/Sources/RadiantDeployer/Services/LocalStorageManager.swift`)
  - Removed Apple Keychain dependency for DB encryption key
  - New priority hierarchy: Environment variable > 1Password CLI > Local secure file
  - Supports CI/CD and containerized deployments via `RADIANT_DB_ENCRYPTION_KEY` env var
- **VPC CIDR Override** (`packages/infrastructure/lib/stacks/networking-stack.ts`)
  - Added `vpcCidrOverride` prop for enterprise VPC peering scenarios
  - Prevents IP range conflicts with client networks
- **Router Performance Headers** (`packages/infrastructure/lambda/shared/utils/performance-headers.ts`)
  - New `X-Radiant-Router-Latency`, `X-Radiant-Cost-Cents` headers on API responses
  - `RouterPerformanceMetrics` type added to AGI Brain Planner
  - Tracks domain detection, model selection, and plan generation timing
- **Delight System Master Toggle** (`packages/shared/src/types/delight.types.ts`)
  - Added `enabled` field to `UserDelightPreferences` (default: true)
  - Users can disable entire delight system in Think Tank advanced settings
- **Semantic Routing Cache** (`packages/infrastructure/lambda/shared/services/routing-cache.service.ts`)
  - New `routing_decision_cache` table for caching brain router decisions
  - Skip router LLM for repeated/similar prompts
  - `shouldSkipRouter()` for optimistic execution on simple queries
- **Adaptive Storage Configuration** (`apps/admin-dashboard/app/(dashboard)/settings/storage/page.tsx`)
  - Admin UI for configuring storage type per tier
  - Fargate Postgres for Tier 1-2 (cost savings), Aurora for Tier 3+
  - Admin override with reason tracking
- **Deploy Core Library** (`packages/deploy-core/`)
  - New `@radiant/deploy-core` package with platform-agnostic deployment logic
  - `RadiantDeployer`, `StackManager`, `HealthChecker`, `SnapshotManager` classes
  - Enables future CLI and CI/CD integration
- **Externalized Ethics Config** (`apps/admin-dashboard/app/(dashboard)/settings/ethics/page.tsx`)
  - Ethics presets moved to database (`ethics_config_presets` table)
  - Secular preset (NIST/ISO) as default
  - Religious presets disabled by default, admin-enableable
  - Per-tenant ethics configuration
- **Pre-Prompt Shadow Testing** (`apps/admin-dashboard/app/(dashboard)/thinktank/shadow-testing/page.tsx`)
  - A/B test pre-prompt optimizations in background
  - Auto/Manual/Scheduled test modes
  - Statistical confidence tracking
  - Auto-promote threshold configuration
- **Database Migration** (`packages/infrastructure/migrations/085_platform_improvements.sql`)
  - `routing_decision_cache` - Semantic routing cache
  - `storage_tier_config` - Adaptive storage per tier
  - `ethics_config_presets` - Externalized ethics frameworks
  - `tenant_ethics_config` - Per-tenant ethics selection
  - `preprompt_shadow_tests` - Shadow A/B tests
  - `preprompt_shadow_samples` - Test samples
  - `preprompt_shadow_settings` - Global test settings

#### Admin Dashboard - Specialty Model Metadata
- **Models Page Enhancement** (`apps/admin-dashboard/app/(dashboard)/models/models-client.tsx`)
  - Added specialty metadata visibility: hosting type, specialty, capabilities, modalities, license, thermal state
  - Added edit dialog for all specialty metadata fields
  - New summary cards for Self-Hosted vs External model counts
  - New table columns: Hosting, Specialty, Thermal, License, Actions
  - Edit button to modify category, specialty, primary mode, capabilities, modalities, license, commercial use

#### Provider Rejection Handling & Intelligent Fallback
- **Database Migration** (`packages/infrastructure/migrations/083_provider_rejection_handling.sql`)
  - `provider_rejections` - Track rejections with fallback chain
  - `rejection_patterns` - Learn patterns for smarter fallback selection
  - `user_rejection_notifications` - Notify users of rejected requests
  - `model_rejection_stats` - Per-model rejection statistics
  - Functions: `record_provider_rejection()`, `record_fallback_result()`, `create_rejection_notification()`
- **Rejection Analytics Migration** (`packages/infrastructure/migrations/084_rejection_analytics.sql`)
  - `rejection_analytics` - Daily aggregated stats by model/provider/mode/type
  - `rejection_keyword_stats` - Track violation keywords with per-provider counts
  - `rejected_prompt_archive` - Full prompt content for policy review
  - Enhanced `provider_rejections` with prompt_content, orchestration_mode, violation_keywords
  - Views: `rejection_summary_by_provider`, `rejection_summary_by_model`, `top_rejection_keywords`
  - Functions: `record_rejection_with_analytics()`, `get_rejection_analytics_dashboard()`, `flag_keyword_for_review()`
- **Rejection Analytics UI** (`apps/admin-dashboard/app/(dashboard)/analytics/rejections/page.tsx`)
  - Summary cards: Total rejections, fallback success rate, rejected to user, flagged keywords
  - Tabs: By Provider, Violation Keywords, Flagged Prompts, Policy Review
  - View full prompt content for policy investigation
  - Flag keywords for review, add pre-filters
- **Shared Types** (`packages/shared/src/types/provider-rejection.types.ts`)
  - ProviderRejection, RejectionType, FallbackAttempt, RejectionNotification types
  - Constants: REJECTION_TYPE_LABELS, FINAL_STATUS_LABELS
- **Service** (`packages/infrastructure/lambda/shared/services/provider-rejection.service.ts`)
  - `handleRejectionWithFallback()` - Auto-fallback to alternative models
  - `selectFallbackModel()` - Choose model with lowest rejection rate
  - `getUserNotifications()` - Get user's rejection history
  - Integration with AGI Brain Planner
- **Think Tank UI** (`apps/admin-dashboard/components/thinktank/rejection-notifications.tsx`)
  - Bell icon with unread count
  - Sheet panel showing all rejection notifications
  - Suggested actions for users
  - Rejection banners in conversation
- **Documentation** (`docs/PROVIDER-REJECTION-HANDLING.md`)

#### AI Ethics Standards Framework
- **Database Migration** (`packages/infrastructure/migrations/082_ai_ethics_standards.sql`)
  - `ai_ethics_standards` - Industry AI ethics frameworks with full metadata
  - `ai_ethics_principle_standards` - Maps ethical principles to standard sections
  - Seeded standards: NIST AI RMF 1.0, ISO/IEC 42001:2023, EU AI Act, IEEE 7000, OECD AI Principles, UNESCO AI Ethics
  - View: `ethical_principles_with_standards` - Principles with their standards
  - Functions: `get_principles_with_standards()`, `seed_principle_standard_mappings()`
- **Admin UI** (`apps/admin-dashboard/app/(dashboard)/ethics/page.tsx`)
  - New Standards tab showing all industry frameworks
  - Standards display: name, full name, organization, version, description, URL, mandatory status
  - Principles now show "Derived from / Aligned with" badges linking to standards
  - Color-coded organization types (government, ISO, industry, academic, religious)
- **API Endpoint** (`GET /admin/ethics/standards`)

#### Windsurf Policies
- **Auto-Build Policy** (`.windsurf/workflows/auto-build.md`)
  - Enforces CHANGELOG.md updates for all features/bug fixes
  - Requires VERSION_HISTORY.json updates on releases
  - Mandates migration header comments for database changes

#### User Rules System (Memory Rules)
- **Database Migration** (`packages/infrastructure/migrations/080_user_memory_rules.sql`)
  - `user_memory_rules` - User personal AI interaction rules with priority and targeting
  - `preset_user_rules` - Pre-seeded rule templates (20+ presets across 7 categories)
  - `user_rule_application_log` - Tracks when rules are applied to prompts
  - Functions: `get_user_rules_for_preprompt()`, `format_user_rules_for_prompt()`
  - RLS policies for user isolation
- **Memory Categories** (`packages/infrastructure/migrations/081_memory_categories.sql`)
  - `memory_categories` - Hierarchical categorization of memory types
  - 6 top-level categories: Instruction, Preference, Context, Knowledge, Constraint, Goal
  - 14 sub-categories for fine-grained classification
  - Functions: `get_memory_category_tree()`, `get_user_memories_by_category()`
  - Categories: instruction.format, instruction.tone, instruction.source, preference.style, preference.detail, context.personal, context.work, context.project, knowledge.fact, knowledge.definition, knowledge.procedure, constraint.topic, constraint.privacy, constraint.safety, goal.learning, goal.productivity
- **Shared Types** (`packages/shared/src/types/user-rules.types.ts`)
  - UserMemoryRule, PresetUserRule, PresetRuleCategory types
  - MemoryCategory, MemoryCategoryTree, MemoryByCategory types
  - Rule validation function
  - Constants: MEMORY_CATEGORY_LABELS, MEMORY_CATEGORY_ICONS, MEMORY_CATEGORY_COLORS
- **Service** (`packages/infrastructure/lambda/shared/services/user-rules.service.ts`)
  - CRUD operations for user rules
  - Preset rule management
  - `getRulesForPrompt()` - Formats rules for prompt injection
  - `getMemoryCategories()` - Get category tree
  - `getMemoriesByCategory()` - Get memories grouped by category
  - Integration with preprompt-learning.service.ts
- **Think Tank UI** (`apps/admin-dashboard/app/(dashboard)/thinktank/my-rules/`)
  - My Rules tab: View, toggle, edit, delete rules
  - Add from Presets tab: Browse categories, add popular rules
  - Stats: Active rules count, times applied
- **Preset Categories**: Privacy & Safety, Sources & Citations, Response Format, Tone & Style, Accessibility, Topic Preferences, Advanced
- **Documentation** (`docs/USER-RULES-SYSTEM.md`)

#### Pre-Prompt Learning System
- **Database Migration** (`packages/infrastructure/migrations/079_preprompt_learning.sql`)
  - `preprompt_templates` - Reusable pre-prompt patterns with configurable weights
  - `preprompt_instances` - Tracks actual pre-prompts used in plans with full context
  - `preprompt_feedback` - User feedback with attribution analysis
  - `preprompt_attribution_scores` - Learning data per template/factor combination
  - `preprompt_learning_config` - Admin-configurable learning parameters
  - `preprompt_selection_log` - Selection reasoning audit trail
  - Materialized view for effectiveness summary
  - Functions for score calculation and attribution updates
- **Shared Types** (`packages/shared/src/types/preprompt.types.ts`)
  - Template, Instance, Feedback, Attribution types
  - Selection request/result types
  - Admin dashboard types
- **Service** (`packages/infrastructure/lambda/shared/services/preprompt-learning.service.ts`)
  - Template selection with weighted scoring
  - Variable rendering for dynamic pre-prompts
  - Feedback processing with auto-attribution inference
  - Exploration vs exploitation balancing
  - Admin dashboard data aggregation
- **AGI Brain Integration** - Pre-prompt selection integrated into plan generation
- **Admin Dashboard** (`apps/admin-dashboard/app/(dashboard)/orchestration/preprompts/`)
  - Overview with attribution pie chart and top/low performers
  - Templates tab with usage stats and weight adjustment
  - Attribution analysis with factor breakdown
  - Recent feedback with attribution labels
  - Weight adjustment sliders per template
- **Documentation** (`docs/PREPROMPT-LEARNING-SYSTEM.md`)

#### SaaS Metrics Dashboard
- **Admin Dashboard** (`apps/admin-dashboard/app/(dashboard)/saas-metrics/`)
  - Comprehensive SaaS business metrics with stunning visualizations
  - Key metrics: MRR, ARR, Gross Margin, Churn Rate, LTV:CAC ratio
  - 5 tabs: Overview, Revenue, Costs, Customers, Models
  - Revenue & Profit trend charts (Area + Line composed)
  - Revenue by Source/Tier pie and bar charts
  - MRR Movement chart (New, Expansion, Churned)
  - Customer growth trends with new/churned breakdown
  - Model profitability table with margin analysis
  - **Excel/CSV Export**: Full metrics report for spreadsheets
  - **JSON Export**: Structured data for integrations
  - Period selection: 7d, 30d, 90d, 12m
- **Documentation** (`docs/SAAS-METRICS-DASHBOARD.md`)
  - Complete feature guide with all metrics definitions
  - Export format documentation
  - API integration details

#### Revenue Analytics System
- **Types** (`packages/shared/src/types/revenue.types.ts`)
  - Revenue source types: subscription, credit_purchase, ai_markup_external, ai_markup_self_hosted, overage, storage
  - Cost categories: aws_compute, aws_storage, aws_network, aws_database, external_ai, infrastructure, platform_fees
  - Export formats: CSV, JSON, QuickBooks IIF, Xero CSV, Sage CSV
- **Database Migration** (`packages/infrastructure/migrations/078_revenue_analytics.sql`)
  - `revenue_entries` table for individual revenue events
  - `cost_entries` table for infrastructure and provider costs
  - `revenue_daily_aggregates` for pre-computed summaries
  - `model_revenue_tracking` for per-model revenue breakdown
  - `accounting_periods` and `reconciliation_entries` for month-end close
  - Auto-aggregation triggers for daily summaries
- **Revenue Service** (`packages/infrastructure/lambda/shared/services/revenue.service.ts`)
  - Dashboard with gross revenue, COGS, gross profit, and margin calculations
  - Revenue breakdown by source, tenant, product, and model
  - Multi-format export: CSV summary, JSON details, QuickBooks IIF, Xero CSV, Sage CSV
- **Admin Dashboard** (`apps/admin-dashboard/app/(dashboard)/revenue/`)
  - Revenue Analytics page with period selection (7d, 30d, 90d, YTD, 12m)
  - Summary cards: Gross Revenue, Total COGS, Gross Profit, Gross Margin
  - Revenue breakdown by source with visual bars
  - Cost breakdown by AWS service and external providers
  - Revenue by model with provider cost vs customer charge
  - Revenue by tenant rankings
  - Export dropdown for all accounting formats

### Documentation

#### Think Tank Easter Eggs Guide
- **New Documentation** (`docs/THINK-TANK-EASTER-EGGS.md`)
  - Complete guide to all 10 easter eggs with activation commands
  - Deactivation methods: toggle, `/normal`, timeout, settings
  - Available easter eggs: Konami Code, Chaos Mode, Socratic Mode, Victorian, Pirate, Haiku, Matrix, Disco, Dad Jokes, Emissions
  - Achievement integration for easter egg discovery
  - Admin-only configuration notes (easter eggs are Think Tank consumer feature only)
  - API reference for triggering and deactivating easter eggs

---

## [4.18.2] - 2024-12-28

### Added

#### Think Tank Delight System
- **Core Service** (`packages/infrastructure/lambda/shared/services/delight.service.ts`)
  - Personality modes: professional, subtle, expressive, playful
  - 9 trigger types: domain_loading, time_aware, model_dynamics, etc.
  - 3 injection points: pre_execution, during_execution, post_execution
  - Achievement tracking with 13 predefined achievements
  - Easter eggs with 10 hidden features
  - Sound themes: default, mission_control, library, workshop, emissions

- **AGI Brain Integration** (`delight-orchestration.service.ts`)
  - Real-time delight messages during workflow execution
  - Step-specific contextual messages for all 11 step types
  - Orchestration mode-specific personality

- **Real-time Events** (`delight-events.service.ts`)
  - EventEmitter for streaming delight messages
  - SSE stream support for client consumption
  - Plan and step update notifications

- **Persistent Statistics** (`migrations/076_delight_statistics.sql`)
  - Daily statistics aggregation with automatic triggers
  - Message performance tracking
  - Achievement unlock analytics
  - Easter egg discovery metrics
  - User engagement leaderboards
  - 12-week trend analysis

- **Admin Dashboard**
  - Delight management UI (`app/(dashboard)/thinktank/delight/page.tsx`)
  - Statistics dashboard (`delight/statistics/page.tsx`)
  - Category management, message CRUD, analytics

#### Localization System
- **Database Migration** (`migrations/074_localization_registry.sql`)
  - UI string registry with namespace support
  - Translation storage for multiple languages
  - Seeded with initial English strings

- **Translation Hook** (`hooks/useTranslation.ts`)
  - React hook for accessing translations
  - Language switching support
  - RTL language detection

- **Language Settings**
  - Language selector in Think Tank Settings
  - API route for fetching translations

#### Windsurf Workflows
- **Policy Workflows** (`.windsurf/workflows/`)
  - `no-hardcoded-ui-text.md` - Localization enforcement policy
  - `no-mock-data.md` - Production code policy
  - `no-stubs.md` - No stubs in production
  - `hipaa-phi-sanitization.md` - HIPAA compliance policy

### Changed

#### Unified Deployment Model
- Removed tier 1-5 deployment selection from Swift Deployer
- Single deployment model with all features available
- Licensing restrictions handled at application level, not infrastructure
- Updated `CDKService.deploy()` to remove tier parameter
- Simplified `ParameterEditorView` and `DeployView`

### Documentation

- Updated `DEPLOYMENT-GUIDE.md` with unified deployment model
- Added Delight System section to `THINK-TANK-USER-GUIDE.md`
- Added Section 20 to `RADIANT-ADMIN-GUIDE.md` for Delight administration

---

## [4.18.1] - 2024-12-25

### Added

#### Standardized Error Handling System
- **Error Codes Module** (`packages/shared/src/errors/`)
  - 60+ standardized error codes with format `RADIANT_<CATEGORY>_<NUMBER>`
  - `RadiantError` class with automatic HTTP response formatting
  - Factory functions: `createNotFoundError`, `createValidationError`, etc.
  - Error metadata including `retryable` flag and user-friendly messages
  - Full documentation in `docs/ERROR_CODES.md`

#### Comprehensive Test Coverage
- **Lambda Handler Tests** (`packages/infrastructure/lambda/*/__ tests__/`)
  - Admin handler tests: routes, authorization, error handling
  - Billing handler tests: subscriptions, credits, transactions
  - Auth module tests: token validation, permissions, tenant access
  - Error module tests: all error classes and utilities
- **Swift Service Tests** (`apps/swift-deployer/Tests/`)
  - `LocalStorageManagerTests`: configuration storage, deployment history
  - `CredentialServiceTests`: credential validation, secure storage

#### Documentation
- **Testing Guide** (`docs/TESTING.md`) - Comprehensive testing documentation
- **Error Codes Reference** (`docs/ERROR_CODES.md`) - Full error code listing

### Changed

#### Code Quality Improvements
- **Type Safety**: Replaced `any` casts with proper interfaces in `cost/page.tsx`
- **Service Consolidation**: Removed duplicate `SchedulerService` (kept canonical version in `shared/services/`)
- **Pre-commit Hooks**: Added `lint-staged` configuration with ESLint, Prettier, SwiftFormat

### Fixed

#### TypeScript Errors
- `db/client.ts`: Fixed AWS SDK Field union type narrowing issue
- `error-logger.ts`: Fixed SqlParameter type inference
- `localization.ts`: Fixed Map iterator compatibility
- `result-merging.ts`: Fixed Set spread iterator issue
- `voice-video.ts`: Fixed Buffer to Blob conversion

### Documentation Updates
- Updated README.md with project structure, testing, and CI/CD info
- Updated CONTRIBUTING.md with error handling and testing guidelines
- Updated API_REFERENCE.md with standardized error codes
- Updated DEPLOYMENT-GUIDE.md with CI/CD pipeline info

---

## [4.18.0] - 2024-12-24

### Added

#### PROMPT-33 Update v3 - Unified Deployment System

##### Package System
- Unified package format (.pkg) with atomic component versioning
- `manifest.json` schema v2.0 with component checksums
- `VERSION_HISTORY.json` for rollback chain support
- Independent Radiant/Think Tank versioning with `touched` flag detection
- Package build scripts (`tools/scripts/build-package.sh`)

##### Build System & Version Control
- `VERSION`, `RADIANT_VERSION`, `THINKTANK_VERSION` files in repo root
- Husky `commit-msg` hook for Conventional Commit validation
- Enhanced `pre-commit` hook with version bump enforcement
- `bump-version.sh` for automated version management
- `generate-changelog.sh` for changelog automation
- `validate-discrete.sh` and `validate-discrete-ast.sh` for component isolation

##### Swift Deployer Enhancements
- **AIAssistantService**: Claude API integration with Keychain storage
- **LocalStorageManager**: SQLCipher encrypted local storage
- **TimeoutService**: Configurable operation timeouts with SSM sync
- Connection monitoring with 60-second polling
- Fallback behavior when AI unavailable

##### Cost Management (Admin Dashboard)
- **CostAnalytics** component with trend charts and model breakdown
- **InsightCard** component for AI recommendations (requires human approval)
- Cost alerts for budget thresholds and spike detection
- Product segmentation (Radiant/Think Tank/Combined)
- Neural Engine cost optimization suggestions

##### Compliance Reports
- **CustomReportBuilder** for configurable compliance reports
- SOC2, HIPAA, GDPR, ISO27001 framework support
- Custom metric selection and filtering
- Scheduled report generation with email delivery
- PDF, CSV, JSON export formats

##### Security & Intrusion Detection
- Security dashboard with anomaly detection
- Geographic anomaly detection (impossible travel)
- Session hijacking detection
- Failed login monitoring and alerts
- **anomaly-detector** Lambda function

##### A/B Testing Framework
- **ExperimentDashboard** for experiment management
- Hash-based sticky variant assignment
- Statistical analysis (t-test, chi-square, p-value)
- **experiment-tracker** Lambda function

##### Deployment Settings
- **DeploymentSettings** component with SSM sync
- Lock-step mode for component versioning
- Max version drift configuration
- Automatic rollback on failure
- **OperationTimeouts** component for all deployment operations

##### Database Schema
- Migration 044: cost_events, cost_daily_aggregates, cost_alerts
- Migration 044: experiments, experiment_assignments, experiment_metrics
- Migration 044: security_anomalies, compliance_reports
- Migration 044: deployment_timeouts, deployment_settings

### Changed
- Updated all version constants from 4.17.0 to 4.18.0
- Enhanced Settings page with Deployment and Timeouts tabs
- Added CustomReportBuilder to Compliance page
- Integrated InsightsList into CostAnalytics component

---

## [4.17.0] - 2024-12-24

### Added

#### Infrastructure
- 36 database migrations covering all platform features
- 9 CDK stacks for AWS deployment
- Docker Compose for local development
- LocalStack integration for AWS service emulation

#### Lambda Services
- Billing service with 7-tier subscription model
- Storage billing with tiered pricing
- Localization service with AI translation
- Configuration management with tenant overrides
- Migration approval with dual-admin workflow
- Neural orchestration patterns
- Feedback learning system
- Workflow proposals

#### Admin Dashboard
- 14 fully functional pages
- Models management
- Providers management with health monitoring
- Billing & credits dashboard
- Storage usage monitoring
- Localization management
- Configuration editor
- Migration approval workflow
- Audit logs viewer
- Notifications center
- User settings

#### Developer Experience
- GitHub Actions CI/CD pipelines
- Dependabot configuration
- Pre-commit hooks with secret detection
- OpenAPI 3.1 specification
- Playwright E2E tests
- Vitest unit tests
- Comprehensive documentation

### Security
- Row-level security (RLS) on all tenant tables
- Dual-admin approval for production migrations
- MFA support for administrators
- Secret scanning in pre-commit hooks

## [4.16.0] - 2024-12-01

### Added
- Initial Swift Deployer app structure
- Base CDK infrastructure
- Core database schema

## [4.15.0] - 2024-11-15

### Added
- Project initialization
- Monorepo structure with pnpm workspaces

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 4.18.0 | 2024-12-24 | PROMPT-33: Unified Deployment System, Cost Management, Compliance, A/B Testing |
| 4.17.0 | 2024-12-24 | Full platform implementation |
| 4.16.0 | 2024-12-01 | Swift Deployer, base CDK |
| 4.15.0 | 2024-11-15 | Project initialization |
