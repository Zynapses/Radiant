# Phase 2: Core Infrastructure

**Estimated Lines**: ~13,600  
**Estimated Time**: 2-3 AI-assisted hours  
**Dependencies**: Phase 1 complete

## Sections

### Section 3: CDK AI & API Stacks
**File**: `docs/sections/section-03-cdk-ai-api.md`  
- AI Gateway Stack
- SageMaker Endpoints Stack
- API Gateway Extensions
- Lambda Authorizers

### Section 4: Lambda Functions - Core
**File**: `docs/sections/section-04-lambda-core.md`  
- Chat Handler
- Streaming Handler
- Model Router
- Usage Tracker

### Section 5: Lambda Functions - Admin & Billing
**File**: `docs/sections/section-05-lambda-admin.md`  
- Admin API Handlers
- Billing Webhook Handler
- Usage Aggregator

### Section 6: Self-Hosted Models
**File**: `docs/sections/section-06-self-hosted.md`  
- SageMaker Inference Containers
- Model Warm-up Lambda
- Thermal State Manager

### Section 7: Database Schema
**File**: `docs/sections/section-07-database.md`  
- 140+ table definitions
- RLS policies
- Stored procedures
- Migration scripts

## Verification

```bash
cd radiant-infrastructure
npx cdk synth --all
npm run test
```
