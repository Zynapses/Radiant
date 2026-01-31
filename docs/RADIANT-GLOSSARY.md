# RADIANT Glossary & Cheat Sheet

> **Quick Reference for AI Terms, Subsystems, AWS Services, and Acronyms**
> 
> **Version**: 1.1.0 | **Last Updated**: January 29, 2026

---

## Table of Contents

1. [AI & Machine Learning Terms](#1-ai--machine-learning-terms)
2. [RADIANT Core Subsystems](#2-radiant-core-subsystems)
3. [Think Tank Features](#3-think-tank-features)
4. [AWS Services Used](#4-aws-services-used)
5. [Acronyms & Abbreviations](#5-acronyms--abbreviations)
6. [Database & Storage Terms](#6-database--storage-terms)
7. [Security & Compliance Terms](#7-security--compliance-terms)
8. [API & Protocol Terms](#8-api--protocol-terms)
9. [UI/UX Terms](#9-uiux-terms)

---

## 1. AI & Machine Learning Terms

| Term | Definition |
|------|------------|
| **Active Inference** | Post-RLHF safety approach using Free Energy minimization instead of reward maximization |
| **Attention Mechanism** | Neural network component that weighs input importance dynamically |
| **BERT** | Bidirectional Encoder Representations from Transformers - NLP model for text classification |
| **Chain-of-Thought (CoT)** | Prompting technique that makes LLMs show reasoning steps |
| **Embedding** | Dense vector representation of text/data in high-dimensional space |
| **Few-Shot Learning** | Teaching models with minimal examples |
| **Fine-Tuning** | Adapting a pre-trained model to specific tasks |
| **Foundation Model** | Large pre-trained model (GPT-4, Claude, Gemini) used as base |
| **Hallucination** | When AI generates plausible but factually incorrect information |
| **Inference** | Running a trained model to generate predictions/outputs |
| **LLM** | Large Language Model - AI trained on massive text data |
| **LoRA** | Low-Rank Adaptation - efficient fine-tuning technique that trains small adapter layers |
| **NLI** | Natural Language Inference - determining logical relationships between text |
| **Prompt Engineering** | Crafting inputs to optimize LLM outputs |
| **RAG** | Retrieval-Augmented Generation - combining search with LLM generation |
| **RLHF** | Reinforcement Learning from Human Feedback - aligning AI with human preferences |
| **Semantic Search** | Search based on meaning, not just keywords |
| **Temperature** | Controls randomness in LLM outputs (0=deterministic, 1=creative) |
| **Token** | Basic unit of text processing (roughly 4 characters or 0.75 words) |
| **Top-K / Top-P** | Sampling parameters controlling output diversity |
| **Transformer** | Neural architecture using self-attention (basis of modern LLMs) |
| **Vector Database** | Database optimized for similarity search on embeddings |
| **Zero-Shot Learning** | Model performs tasks without specific training examples |

---

## 2. RADIANT Core Subsystems

### AGI & Cognition Systems

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| **AGI Brain** | Central AI planning and orchestration engine | `agi-brain-planner.service.ts` |
| **Blackboard** | Shared memory space for multi-agent coordination | `semantic-blackboard.service.ts` |
| **Cato** | Global AI consciousness service with persistent memory | `cato/` services |
| **Cognitive Router** | Intelligent model selection and routing | `cognitive-router.service.ts` |
| **Consciousness Loop** | State machine (IDLE→PROCESSING→REFLECTING→DREAMING) | `consciousness-loop.service.ts` |
| **Cortex** | Three-tier memory system (Hot/Warm/Cold) | `cortex/` services |
| **Ego System** | AI emotional state (confidence, frustration, curiosity) | `ego.service.ts` |
| **Genesis** | Boot sequence and developmental gates for Cato | `genesis.service.ts` |
| **Ghost Vectors** | 4096-dimensional hidden states capturing relationship "feel" | `ghost-manager.service.ts` |
| **Graph-RAG** | Knowledge graph + retrieval augmented generation | `cortex-graph-rag.service.ts` |
| **SOFAI Router** | System 1/System 2 dynamic routing (60%+ cost reduction) | `sofai-router.service.ts` |
| **Twilight Dreaming** | Offline learning during low-traffic periods (2-6 AM) | `dream-scheduler.service.ts` |

### Model Management

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| **Model Registry** | Version tracking and lifecycle management for self-hosted models | `model-version-manager.service.ts` |
| **HuggingFace Discovery** | Automated polling for new model versions from HuggingFace | `huggingface-discovery.service.ts` |
| **Deletion Queue** | Safe model deletion with usage session tracking | `model-deletion-queue.service.ts` |
| **Thermal Manager** | Hot/Warm/Cold/Off state management for cost optimization | `thermal-state.ts` |

### Pipeline & Orchestration

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| **Cato Pipeline** | Modular AI task execution with governance | `cato-pipeline-orchestrator.service.ts` |
| **Checkpoint System** | Human-in-the-loop approval gates (CP1-CP5) | `cato-checkpoint.service.ts` |
| **Compensation** | SAGA pattern rollback for failed operations | `cato-compensation.service.ts` |
| **Method Executor** | Executes pipeline methods (Observer, Proposer, etc.) | `cato-method-executor.service.ts` |
| **Sovereign Mesh** | Distributed execution infrastructure | `sovereign-mesh.service.ts` |
| **Workflow Engine** | 70+ orchestration methods for task automation | `orchestration-methods/` |

### Safety & Verification

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| **CBF (Control Barrier Functions)** | 9 safety barriers that never relax | `cato-cbf.service.ts` |
| **ECD Scoring** | Entity-Context Divergence verification (99.5% accuracy) | `ecd-scorer.service.ts` |
| **Empiricism Loop** | Autonomous skill verification and learning | `empiricism-loop.service.ts` |
| **Ethics Pipeline** | Multi-layer ethical content filtering | `ethics-pipeline.service.ts` |
| **Reflexion Loop** | Self-correction when artifacts fail validation | `artifact-pipeline.service.ts` |
| **Truth Engine™** | Source verification system for all responses | `ecd-verification.service.ts` |

### Memory & Storage

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| **Flash Facts** | Quick knowledge capture and retrieval | `flash-facts.service.ts` |
| **Grimoire** | Procedural memory (learned spells/patterns) | `grimoire.service.ts` |
| **Stub Nodes** | Zero-copy pointers to external data lakes | `stub-nodes.service.ts` |
| **Time Machine** | Conversation forking and replay | `time-travel.service.ts` |
| **UDS** | User Data Service - tiered storage for user content | `uds/` services |

### Economic & Governance

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| **Economic Governor** | Cost optimization and model tier routing | `economic-governor.service.ts` |
| **HITL** | Human-in-the-Loop approval workflows | `hitl-orchestration.service.ts` |
| **Mission Control** | Admin interface for HITL approvals | `mission-control/` |
| **RAWS** | RADIANT Adaptive Weighted Scoring for model selection | `raws.service.ts` |

---

## 3. Think Tank Features

| Feature | Description |
|---------|-------------|
| **Artifact Engine** | GenUI pipeline for interactive outputs |
| **Brain Plan** | Execution plan showing how AI will answer |
| **Breathing UI** | Visual elements that pulse to show confidence |
| **Concurrent Execution** | 2-4 simultaneous AI conversations in split panes |
| **Confidence Terrain** | 3D visualization (elevation=confidence, color=risk) |
| **Council of Experts** | Multi-persona consultation with 8 viewpoints |
| **Council of Rivals** | Multi-model deliberation for important decisions |
| **Curator** | Knowledge graph curation and fact verification app |
| **Debate Arena** | Adversarial exploration for stress-testing ideas |
| **Decision Record** | Auditable capture of AI reasoning and evidence |
| **Delight System** | AI personality and engagement customization |
| **Domain Mode** | Specialized configuration for different knowledge areas |
| **Ghost Path** | Translucent overlay showing rejected alternatives |
| **Living Ink** | Typography that varies weight based on confidence |
| **Living Parchment** | Decision intelligence suite with sensory UI |
| **Magic Carpet** | Intent-based navigation system |
| **My Rules** | User-defined preferences that customize AI |
| **Polymorphic UI** | Interface that adapts based on query type |
| **Sentinel Agent** | Background monitors that trigger on conditions |
| **Sniper Mode** | Fast, low-cost single-model execution |
| **Spell** | Learned pattern in Grimoire that improves responses |
| **Steel-Man** | AI-generated strongest version of opposing argument |
| **Timeline** | Branch in Time Machine representing conversation path |
| **War Room** | Strategic Decision Theater for high-stakes decisions |

---

## 4. AWS Services Used

### Compute

| Service | RADIANT Usage |
|---------|---------------|
| **Lambda** | Serverless API handlers (62+ admin, 41+ Think Tank) |
| **SageMaker** | Self-hosted AI model inference (56 models) |
| **Batch** | Long-running batch processing jobs |
| **ECS/Fargate** | Container orchestration for LiteLLM gateway |

### Database & Storage

| Service | RADIANT Usage |
|---------|---------------|
| **Aurora PostgreSQL** | Primary database with pgvector for embeddings |
| **DynamoDB** | Hot-tier caching, session state |
| **ElastiCache (Redis)** | Distributed caching, rate limiting |
| **S3** | Object storage (uploads, artifacts, backups) |
| **S3 Glacier** | Cold storage for compliance archives (7+ years) |

### Networking & API

| Service | RADIANT Usage |
|---------|---------------|
| **API Gateway** | REST/WebSocket API endpoints |
| **CloudFront** | CDN for static assets and admin dashboards |
| **Route 53** | DNS management |
| **VPC** | Network isolation with public/private subnets |
| **ALB/NLB** | Load balancing for high availability |

### Security & Identity

| Service | RADIANT Usage |
|---------|---------------|
| **Cognito** | User authentication and authorization |
| **IAM** | Access control for AWS resources |
| **KMS** | Encryption key management |
| **Secrets Manager** | API keys and credentials storage |
| **WAF** | Web Application Firewall protection |

### Messaging & Events

| Service | RADIANT Usage |
|---------|---------------|
| **EventBridge** | Event-driven architecture triggers |
| **Kinesis** | Real-time streaming data processing |
| **SNS** | Push notifications and alerts |
| **SQS** | Message queues for async processing |

### Monitoring & Operations

| Service | RADIANT Usage |
|---------|---------------|
| **CloudWatch** | Logs, metrics, dashboards, alarms |
| **X-Ray** | Distributed tracing |
| **CloudTrail** | API audit logging |
| **Cost Explorer** | Cost monitoring and optimization |

### AI/ML Services

| Service | RADIANT Usage |
|---------|---------------|
| **Bedrock** | Foundation model access (Claude, Titan) |
| **Textract** | Document text extraction |
| **Comprehend** | NLP for language detection |
| **Transcribe** | Speech-to-text for voice input |

---

## 5. Acronyms & Abbreviations

### General

| Acronym | Full Form |
|---------|-----------|
| **A2A** | Agent-to-Agent (Google protocol for AI agent communication) |
| **AGI** | Artificial General Intelligence |
| **API** | Application Programming Interface |
| **AWS** | Amazon Web Services |
| **CDK** | Cloud Development Kit (AWS infrastructure-as-code) |
| **CDN** | Content Delivery Network |
| **CLI** | Command Line Interface |
| **CRDT** | Conflict-free Replicated Data Type (for real-time collab) |
| **CRUD** | Create, Read, Update, Delete |
| **DNS** | Domain Name System |
| **ECS** | Elastic Container Service |
| **FTS** | Full-Text Search |
| **GUI** | Graphical User Interface |
| **HTTP** | Hypertext Transfer Protocol |
| **IDE** | Integrated Development Environment |
| **JSON** | JavaScript Object Notation |
| **JWT** | JSON Web Token |
| **MCP** | Model Context Protocol (Anthropic's tool protocol) |
| **MFA** | Multi-Factor Authentication |
| **ORM** | Object-Relational Mapping |
| **REST** | Representational State Transfer |
| **SDK** | Software Development Kit |
| **SQL** | Structured Query Language |
| **SSE** | Server-Sent Events (streaming) |
| **SSL/TLS** | Secure Sockets Layer / Transport Layer Security |
| **UI** | User Interface |
| **URL** | Uniform Resource Locator |
| **UUID** | Universally Unique Identifier |
| **VPC** | Virtual Private Cloud |
| **WebSocket** | Full-duplex communication protocol |
| **YAML** | YAML Ain't Markup Language |

### RADIANT-Specific

| Acronym | Full Form |
|---------|-----------|
| **CBF** | Control Barrier Function (safety guardrails) |
| **CP1-CP5** | Checkpoint gates 1-5 (HITL approval points) |
| **DIA** | Decision Intelligence Artifacts |
| **ECD** | Entity-Context Divergence (verification scoring) |
| **HITL** | Human-in-the-Loop |
| **OODA** | Observe-Orient-Decide-Act (agent loop) |
| **RADIANT** | Rapid AI Deployment Infrastructure for Applications with Native Tenancy |
| **RAWS** | RADIANT Adaptive Weighted Scoring |
| **RLS** | Row-Level Security (PostgreSQL tenant isolation) |
| **SOFAI** | System 1/System 2 routing framework |
| **SSF** | Shared Signals Framework (identity federation) |
| **UDS** | User Data Service |

### Compliance

| Acronym | Full Form |
|---------|-----------|
| **CCPA** | California Consumer Privacy Act |
| **COPPA** | Children's Online Privacy Protection Act |
| **DSAR** | Data Subject Access Request |
| **FDA 21 CFR Part 11** | FDA regulation for electronic records |
| **GDPR** | General Data Protection Regulation (EU) |
| **HIPAA** | Health Insurance Portability and Accountability Act |
| **PHI** | Protected Health Information |
| **PII** | Personally Identifiable Information |
| **SOC 2** | Service Organization Control Type 2 |
| **TOTP** | Time-based One-Time Password (MFA) |

### AI Models & Providers

| Acronym | Full Form |
|---------|-----------|
| **GPT** | Generative Pre-trained Transformer (OpenAI) |
| **LLaMA** | Large Language Model Meta AI |
| **Mixtral** | Mistral AI's mixture-of-experts model |
| **o1/o3** | OpenAI reasoning models |
| **Qwen** | Alibaba's LLM family |

---

## 6. Database & Storage Terms

| Term | Definition |
|------|------------|
| **Aurora** | AWS managed PostgreSQL/MySQL service |
| **Cold Tier** | Long-term storage (S3 Iceberg, 90d-7y retention) |
| **Connection Pooling** | Reusing database connections for efficiency |
| **Hot Tier** | Fast access layer (ElastiCache + DynamoDB, 0-24h) |
| **Materialized View** | Pre-computed query results for dashboard metrics |
| **Migration** | Versioned database schema change |
| **Partitioning** | Splitting tables by time/tenant for performance |
| **pgvector** | PostgreSQL extension for vector similarity search |
| **RDS Proxy** | Connection pooling for Lambda |
| **Warm Tier** | Active storage (Aurora PostgreSQL, 1-90 days) |
| **Zero-Copy Mount** | Access external data without duplication |

---

## 7. Security & Compliance Terms

| Term | Definition |
|------|------------|
| **AES-256-GCM** | Encryption standard used for data at rest |
| **Audit Trail** | Immutable log of all system actions |
| **Break Glass** | Emergency admin access with full logging |
| **Data Sovereignty** | Per-tenant data region configuration |
| **Erasure Request** | GDPR right-to-be-forgotten compliance |
| **Legal Hold** | Prevent data deletion for litigation |
| **Merkle Chain** | Tamper-evident audit log using hash chains |
| **RBAC** | Role-Based Access Control |
| **Row-Level Security** | PostgreSQL tenant isolation mechanism |
| **Tenant Isolation** | Complete separation of customer data |

---

## 8. API & Protocol Terms

| Term | Definition |
|------|------------|
| **A2A Protocol** | Google's Agent-to-Agent communication standard |
| **CAEP** | Continuous Access Evaluation Profile |
| **Envelope** | `CatoMethodEnvelope` - wrapper for all pipeline outputs |
| **GraphQL** | Query language for flexible API access |
| **LiteLLM** | Unified gateway for 100+ AI model APIs |
| **MCP** | Model Context Protocol - Anthropic's tool invocation standard |
| **OAuth 2.0** | Authorization framework for third-party access |
| **OpenAPI** | REST API specification standard |
| **SSE** | Server-Sent Events for streaming responses |
| **WebSocket** | Bidirectional real-time communication |
| **Yjs** | CRDT library for real-time collaboration |

---

## 9. UI/UX Terms

| Term | Definition |
|------|------------|
| **Apple Glass** | RADIANT's design system based on macOS aesthetics |
| **Breathing Scrollbar** | Heatmap visualization showing trust topology |
| **Gearbox** | Polymorphic UI's elastic compute indicator |
| **GenUI** | Generative UI - AI-created interactive components |
| **Liquid Interface** | Morphable UI system that adapts to context |
| **Presence Indicator** | Shows who's in a collaborative session |
| **Shadcn/ui** | Component library used for admin dashboards |
| **Tailwind CSS** | Utility-first CSS framework |
| **Toast** | Temporary notification message |
| **Zustand** | State management library for React |

---

## Quick Reference: CDK Stacks

| Stack | Purpose |
|-------|---------|
| `admin-stack` | Admin API handlers |
| `ai-stack` | AI model configuration |
| `api-stack` | Main API Gateway + Lambda |
| `auth-stack` | Cognito authentication |
| `batch-stack` | AWS Batch jobs |
| `brain-stack` | AGI Brain services |
| `cato-genesis-stack` | Cato boot sequence |
| `cato-redis-stack` | Cato caching layer |
| `cato-tier-transition-stack` | Memory tier management |
| `cognition-stack` | Cognitive services |
| `collaboration-stack` | Real-time collaboration |
| `consciousness-stack` | Consciousness loop services |
| `data-stack` | Database and storage |
| `dia-stack` | Decision Intelligence Artifacts |
| `formal-reasoning-stack` | Logic and reasoning services |
| `gateway-stack` | API Gateway configuration |
| `grimoire-stack` | Procedural memory |
| `library-execution-stack` | External library execution |
| `library-registry-stack` | Library management |
| `litellm-gateway-stack` | LiteLLM proxy |
| `mission-control-stack` | HITL approval UI |
| `monitoring-stack` | CloudWatch dashboards |
| `multi-region-stack` | Multi-region deployment |
| `networking-stack` | VPC and networking |
| `scheduled-tasks-stack` | Cron jobs and schedulers |
| `security-monitoring-stack` | Security alerts |
| `security-stack` | WAF and security |
| `sovereign-mesh-stack` | Distributed execution |
| `storage-stack` | S3 buckets |
| `thinktank-admin-api-stack` | Think Tank admin API |
| `thinktank-auth-stack` | Think Tank auth |
| `tms-stack` | Time Machine services |
| `user-registry-stack` | User management |
| `webhooks-stack` | Webhook handlers |

---

## Quick Reference: AI Providers

| Provider | Models | Type |
|----------|--------|------|
| **Anthropic** | Claude 3.5, Claude 3 Opus/Sonnet/Haiku | External |
| **OpenAI** | GPT-4o, GPT-4 Turbo, o1, o3 | External |
| **Google** | Gemini 2.0, Gemini Pro | External |
| **xAI** | Grok-2 | External |
| **DeepSeek** | DeepSeek V3, DeepSeek R1 | External |
| **Meta** | LLaMA 3.2 | Self-hosted |
| **Mistral** | Mixtral 8x7B, Mistral Large | External + Self-hosted |
| **Alibaba** | Qwen 2.5 | Self-hosted |
| **AWS** | Titan, Claude via Bedrock | External |

---

## Quick Reference: Governance Presets

| Preset | Auto-Execute Threshold | Veto Threshold | Use Case |
|--------|----------------------|----------------|----------|
| **COWBOY** | 0.7 | 0.95 | Maximum autonomy |
| **BALANCED** | 0.5 | 0.85 | Standard operations |
| **PARANOID** | 0.2 | 0.6 | High-stakes/regulated |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | Jan 29, 2026 | Added Model Management subsystems (Model Registry, HuggingFace Discovery, Deletion Queue, Thermal Manager) |
| 1.0.0 | Jan 29, 2026 | Initial comprehensive glossary |

---

*This document serves as a quick reference cheat sheet for the RADIANT platform. For detailed documentation, see the specific admin guides and engineering documentation.*
