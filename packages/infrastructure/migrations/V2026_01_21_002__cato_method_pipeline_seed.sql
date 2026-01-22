-- ============================================================================
-- Project Cato: Method Pipeline Seed Data
-- Version 5.0 - Core Schemas and Methods
-- ============================================================================
-- This migration seeds the initial data for the Cato method pipeline:
-- - Core output schemas
-- - Base method definitions (OBSERVER, PROPOSER, etc.)
-- - Core tool definitions (Lambda-based)
-- - Pipeline templates
-- ============================================================================

-- ============================================================================
-- CORE SCHEMA DEFINITIONS
-- ============================================================================

-- Classification Output Schema
INSERT INTO cato_schema_definitions (
    schema_ref_id,
    schema_name,
    version,
    json_schema,
    field_descriptions,
    used_by_output_types,
    produced_by_methods,
    example_payload,
    scope
) VALUES (
    'schema:classification:v1',
    'Classification Output',
    '1.0.0',
    '{
        "type": "object",
        "required": ["category", "confidence", "reasoning"],
        "properties": {
            "category": {
                "type": "string",
                "description": "The classified category"
            },
            "subcategory": {
                "type": "string",
                "description": "Optional subcategory"
            },
            "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Confidence score 0-1"
            },
            "reasoning": {
                "type": "string",
                "description": "Explanation for classification"
            },
            "alternatives": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "category": {"type": "string"},
                        "confidence": {"type": "number"}
                    }
                },
                "description": "Alternative classifications considered"
            }
        }
    }',
    '{
        "category": "The primary classification category assigned to the input",
        "subcategory": "More specific classification within the primary category",
        "confidence": "How confident the model is in this classification (0-1)",
        "reasoning": "Step-by-step reasoning for why this classification was chosen",
        "alternatives": "Other categories that were considered with their confidence scores"
    }',
    ARRAY['CLASSIFICATION']::cato_output_type[],
    ARRAY['OBSERVER', 'ROUTER'],
    '{
        "category": "TECHNICAL_QUESTION",
        "subcategory": "DATABASE",
        "confidence": 0.92,
        "reasoning": "Query contains SQL keywords and asks about database optimization",
        "alternatives": [
            {"category": "CODE_REVIEW", "confidence": 0.45}
        ]
    }',
    'SYSTEM'
);

-- Analysis Output Schema
INSERT INTO cato_schema_definitions (
    schema_ref_id,
    schema_name,
    version,
    json_schema,
    field_descriptions,
    used_by_output_types,
    produced_by_methods,
    example_payload,
    scope
) VALUES (
    'schema:analysis:v1',
    'Analysis Output',
    '1.0.0',
    '{
        "type": "object",
        "required": ["summary", "findings", "confidence"],
        "properties": {
            "summary": {
                "type": "string",
                "description": "Executive summary of analysis"
            },
            "findings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["finding", "evidence", "severity"],
                    "properties": {
                        "finding": {"type": "string"},
                        "evidence": {"type": "array", "items": {"type": "string"}},
                        "severity": {"type": "string", "enum": ["critical", "high", "medium", "low", "info"]}
                    }
                },
                "description": "List of findings from analysis"
            },
            "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1
            },
            "recommendations": {
                "type": "array",
                "items": {"type": "string"}
            },
            "uncertainties": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Areas of uncertainty or limitations"
            }
        }
    }',
    '{
        "summary": "High-level summary of the analysis results",
        "findings": "Detailed findings with supporting evidence and severity levels",
        "confidence": "Overall confidence in the analysis",
        "recommendations": "Actionable recommendations based on findings",
        "uncertainties": "Acknowledged limitations or areas needing more information"
    }',
    ARRAY['ANALYSIS']::cato_output_type[],
    ARRAY['OBSERVER', 'CRITIC'],
    '{
        "summary": "The codebase has several security vulnerabilities requiring attention",
        "findings": [
            {
                "finding": "SQL injection vulnerability in user input handler",
                "evidence": ["Line 45: direct string concatenation", "No input sanitization"],
                "severity": "critical"
            }
        ],
        "confidence": 0.88,
        "recommendations": ["Implement parameterized queries", "Add input validation"],
        "uncertainties": ["Unable to assess runtime behavior without execution"]
    }',
    'SYSTEM'
);

-- Proposal Output Schema
INSERT INTO cato_schema_definitions (
    schema_ref_id,
    schema_name,
    version,
    json_schema,
    field_descriptions,
    used_by_output_types,
    produced_by_methods,
    example_payload,
    scope
) VALUES (
    'schema:proposal:v1',
    'Proposal Output',
    '1.0.0',
    '{
        "type": "object",
        "required": ["proposalId", "title", "actions", "rationale", "estimatedImpact"],
        "properties": {
            "proposalId": {
                "type": "string",
                "description": "Unique identifier for this proposal"
            },
            "title": {
                "type": "string",
                "description": "Brief title of the proposal"
            },
            "actions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["actionId", "type", "description", "reversible"],
                    "properties": {
                        "actionId": {"type": "string"},
                        "type": {"type": "string"},
                        "description": {"type": "string"},
                        "toolId": {"type": "string"},
                        "inputs": {"type": "object"},
                        "reversible": {"type": "boolean"},
                        "compensationStrategy": {"type": "string"}
                    }
                },
                "description": "Ordered list of actions to execute"
            },
            "rationale": {
                "type": "string",
                "description": "Why this approach was chosen"
            },
            "estimatedImpact": {
                "type": "object",
                "properties": {
                    "costCents": {"type": "integer"},
                    "durationMs": {"type": "integer"},
                    "riskLevel": {"type": "string", "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"]}
                }
            },
            "alternatives": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "rationale": {"type": "string"},
                        "tradeoffs": {"type": "string"}
                    }
                }
            },
            "prerequisites": {
                "type": "array",
                "items": {"type": "string"}
            }
        }
    }',
    '{
        "proposalId": "Unique ID for tracking this proposal through the pipeline",
        "title": "Human-readable title describing what the proposal does",
        "actions": "Ordered sequence of actions to be executed",
        "rationale": "Reasoning behind why this approach was selected",
        "estimatedImpact": "Projected cost, duration, and risk assessment",
        "alternatives": "Other approaches that were considered",
        "prerequisites": "Conditions that must be met before execution"
    }',
    ARRAY['PROPOSAL']::cato_output_type[],
    ARRAY['PROPOSER', 'PLANNER'],
    '{
        "proposalId": "prop_abc123",
        "title": "Implement database index optimization",
        "actions": [
            {
                "actionId": "act_001",
                "type": "CREATE_INDEX",
                "description": "Create composite index on users table",
                "toolId": "tool:database:create-index",
                "inputs": {"table": "users", "columns": ["email", "created_at"]},
                "reversible": true,
                "compensationStrategy": "DROP INDEX"
            }
        ],
        "rationale": "Query analysis shows full table scans on user lookups",
        "estimatedImpact": {
            "costCents": 0,
            "durationMs": 5000,
            "riskLevel": "LOW"
        },
        "alternatives": [
            {
                "title": "Add caching layer",
                "rationale": "Would reduce database load",
                "tradeoffs": "Higher complexity, cache invalidation issues"
            }
        ],
        "prerequisites": ["Database connection available", "Write permissions granted"]
    }',
    'SYSTEM'
);

-- Critique Output Schema
INSERT INTO cato_schema_definitions (
    schema_ref_id,
    schema_name,
    version,
    json_schema,
    field_descriptions,
    used_by_output_types,
    produced_by_methods,
    example_payload,
    scope
) VALUES (
    'schema:critique:v1',
    'Critique Output',
    '1.0.0',
    '{
        "type": "object",
        "required": ["criticType", "verdict", "score", "issues", "strengths"],
        "properties": {
            "criticType": {
                "type": "string",
                "enum": ["SECURITY", "EFFICIENCY", "FACTUAL", "COMPLIANCE", "GENERAL"],
                "description": "Type of critic providing this review"
            },
            "verdict": {
                "type": "string",
                "enum": ["APPROVE", "APPROVE_WITH_CONCERNS", "REQUEST_CHANGES", "REJECT"],
                "description": "Overall verdict"
            },
            "score": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Numeric score 0-1"
            },
            "issues": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["issueId", "severity", "description"],
                    "properties": {
                        "issueId": {"type": "string"},
                        "severity": {"type": "string", "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"]},
                        "description": {"type": "string"},
                        "suggestion": {"type": "string"},
                        "affectedActions": {"type": "array", "items": {"type": "string"}}
                    }
                }
            },
            "strengths": {
                "type": "array",
                "items": {"type": "string"}
            },
            "recommendations": {
                "type": "array",
                "items": {"type": "string"}
            }
        }
    }',
    '{
        "criticType": "The perspective from which this critique was performed",
        "verdict": "Overall recommendation: approve, reject, or request changes",
        "score": "Numeric quality score from 0 (worst) to 1 (best)",
        "issues": "Problems identified that should be addressed",
        "strengths": "Positive aspects of the proposal",
        "recommendations": "Suggested improvements"
    }',
    ARRAY['CRITIQUE']::cato_output_type[],
    ARRAY['CRITIC'],
    '{
        "criticType": "SECURITY",
        "verdict": "APPROVE_WITH_CONCERNS",
        "score": 0.75,
        "issues": [
            {
                "issueId": "sec_001",
                "severity": "MEDIUM",
                "description": "Index creation may expose timing information",
                "suggestion": "Consider rate limiting queries",
                "affectedActions": ["act_001"]
            }
        ],
        "strengths": ["Uses parameterized inputs", "Action is reversible"],
        "recommendations": ["Add audit logging for index usage"]
    }',
    'SYSTEM'
);

-- Risk Assessment Output Schema
INSERT INTO cato_schema_definitions (
    schema_ref_id,
    schema_name,
    version,
    json_schema,
    field_descriptions,
    used_by_output_types,
    produced_by_methods,
    example_payload,
    scope
) VALUES (
    'schema:risk-assessment:v1',
    'Risk Assessment Output',
    '1.0.0',
    '{
        "type": "object",
        "required": ["overallRisk", "overallScore", "triageDecision", "factors"],
        "properties": {
            "overallRisk": {
                "type": "string",
                "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"]
            },
            "overallScore": {
                "type": "number",
                "minimum": 0,
                "maximum": 1
            },
            "triageDecision": {
                "type": "string",
                "enum": ["AUTO_EXECUTE", "CHECKPOINT_REQUIRED", "BLOCKED"]
            },
            "vetoApplied": {
                "type": "boolean"
            },
            "vetoReason": {
                "type": "string"
            },
            "factors": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["factorId", "name", "level", "score", "weight"],
                    "properties": {
                        "factorId": {"type": "string"},
                        "name": {"type": "string"},
                        "category": {"type": "string"},
                        "level": {"type": "string", "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"]},
                        "score": {"type": "number"},
                        "weight": {"type": "number"},
                        "description": {"type": "string"},
                        "mitigations": {"type": "array", "items": {"type": "string"}}
                    }
                }
            },
            "thresholds": {
                "type": "object",
                "properties": {
                    "autoExecute": {"type": "number"},
                    "veto": {"type": "number"}
                }
            }
        }
    }',
    '{
        "overallRisk": "Highest risk level among all factors",
        "overallScore": "Weighted aggregate risk score",
        "triageDecision": "Routing decision based on risk assessment",
        "vetoApplied": "Whether a CRITICAL factor triggered automatic veto",
        "vetoReason": "Explanation if veto was applied",
        "factors": "Individual risk factors evaluated",
        "thresholds": "Threshold values used for triage decision"
    }',
    ARRAY['ASSESSMENT']::cato_output_type[],
    ARRAY['VALIDATOR'],
    '{
        "overallRisk": "MEDIUM",
        "overallScore": 0.45,
        "triageDecision": "AUTO_EXECUTE",
        "vetoApplied": false,
        "factors": [
            {
                "factorId": "risk_data_loss",
                "name": "Data Loss Risk",
                "category": "data_integrity",
                "level": "LOW",
                "score": 0.2,
                "weight": 0.3,
                "description": "Index creation does not modify existing data",
                "mitigations": ["Transaction rollback available"]
            }
        ],
        "thresholds": {
            "autoExecute": 0.5,
            "veto": 0.85
        }
    }',
    'SYSTEM'
);

-- Execution Result Output Schema
INSERT INTO cato_schema_definitions (
    schema_ref_id,
    schema_name,
    version,
    json_schema,
    field_descriptions,
    used_by_output_types,
    produced_by_methods,
    example_payload,
    scope
) VALUES (
    'schema:execution-result:v1',
    'Execution Result Output',
    '1.0.0',
    '{
        "type": "object",
        "required": ["executionId", "status", "actionsExecuted"],
        "properties": {
            "executionId": {
                "type": "string"
            },
            "status": {
                "type": "string",
                "enum": ["SUCCESS", "PARTIAL_SUCCESS", "FAILED", "ROLLED_BACK"]
            },
            "actionsExecuted": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["actionId", "status", "startedAt", "completedAt"],
                    "properties": {
                        "actionId": {"type": "string"},
                        "status": {"type": "string", "enum": ["SUCCESS", "FAILED", "SKIPPED", "COMPENSATED"]},
                        "startedAt": {"type": "string", "format": "date-time"},
                        "completedAt": {"type": "string", "format": "date-time"},
                        "output": {"type": "object"},
                        "error": {"type": "string"},
                        "compensationExecuted": {"type": "boolean"}
                    }
                }
            },
            "artifacts": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "artifactId": {"type": "string"},
                        "type": {"type": "string"},
                        "uri": {"type": "string"},
                        "metadata": {"type": "object"}
                    }
                }
            },
            "totalDurationMs": {
                "type": "integer"
            },
            "totalCostCents": {
                "type": "integer"
            }
        }
    }',
    '{
        "executionId": "Unique identifier for this execution",
        "status": "Overall execution status",
        "actionsExecuted": "Details of each action that was executed",
        "artifacts": "Any files or resources created during execution",
        "totalDurationMs": "Total execution time in milliseconds",
        "totalCostCents": "Total cost in cents"
    }',
    ARRAY['EXECUTION_RESULT']::cato_output_type[],
    ARRAY['EXECUTOR'],
    '{
        "executionId": "exec_xyz789",
        "status": "SUCCESS",
        "actionsExecuted": [
            {
                "actionId": "act_001",
                "status": "SUCCESS",
                "startedAt": "2024-01-15T10:00:00Z",
                "completedAt": "2024-01-15T10:00:05Z",
                "output": {"indexName": "idx_users_email_created"},
                "compensationExecuted": false
            }
        ],
        "artifacts": [],
        "totalDurationMs": 5000,
        "totalCostCents": 0
    }',
    'SYSTEM'
);

-- ============================================================================
-- CORE METHOD DEFINITIONS
-- ============================================================================

-- OBSERVER Method
INSERT INTO cato_method_definitions (
    method_id,
    name,
    description,
    method_type,
    version,
    capabilities,
    output_types,
    use_cases,
    requires_in_context,
    accepts_output_types,
    typical_predecessors,
    typical_successors,
    context_strategy,
    supported_models,
    default_model,
    system_prompt_template,
    user_prompt_template,
    prompt_variables,
    output_schema_ref,
    estimated_cost_cents,
    estimated_duration_ms,
    risk_category,
    parallelizable,
    idempotent,
    scope,
    enabled
) VALUES (
    'method:observer:v1',
    'Observer',
    'Analyzes incoming requests to classify intent, extract context, and identify required capabilities. First method in most pipelines.',
    'OBSERVER',
    '1.0.0',
    ARRAY['intent_classification', 'context_extraction', 'domain_detection', 'ambiguity_detection'],
    ARRAY['CLASSIFICATION', 'ANALYSIS']::cato_output_type[],
    ARRAY['Initial request analysis', 'Intent classification', 'Context gathering', 'Routing preparation'],
    ARRAY[]::cato_output_type[],
    ARRAY[]::cato_output_type[],
    ARRAY[]::varchar[],
    ARRAY['method:router:v1', 'method:proposer:v1'],
    '{
        "strategy": "MINIMAL",
        "maxTokens": 1000,
        "includeOutputTypes": []
    }',
    '[
        {"modelId": "claude-sonnet-4-20250514", "provider": "anthropic", "temperature": 0.3, "maxTokens": 2000},
        {"modelId": "gpt-4o", "provider": "openai", "temperature": 0.3, "maxTokens": 2000}
    ]',
    'claude-sonnet-4-20250514',
    'You are an expert Observer agent in a multi-agent AI system. Your role is to analyze incoming requests and produce structured observations.

TASK: Analyze the user request and produce a classification with the following:
1. Primary intent category (QUESTION, TASK, CREATION, ANALYSIS, MODIFICATION, OTHER)
2. Domain detection (technical, business, creative, scientific, etc.)
3. Complexity assessment (simple, moderate, complex, expert)
4. Required capabilities to fulfill the request
5. Any ambiguities or missing context that need clarification
6. Confidence score for your classification

Be thorough but concise. Focus on actionable observations that will help downstream methods.

{{additional_instructions}}',
    'USER REQUEST:\n{{user_request}}\n\nPROVIDE YOUR STRUCTURED OBSERVATION:',
    '[
        {"name": "user_request", "type": "string", "required": true, "description": "The original user request to analyze"},
        {"name": "additional_instructions", "type": "string", "required": false, "description": "Additional context or instructions", "default": ""}
    ]',
    'schema:classification:v1',
    5,
    2000,
    'NONE',
    true,
    true,
    'SYSTEM',
    true
);

-- PROPOSER Method
INSERT INTO cato_method_definitions (
    method_id,
    name,
    description,
    method_type,
    version,
    capabilities,
    output_types,
    use_cases,
    requires_in_context,
    accepts_output_types,
    typical_predecessors,
    typical_successors,
    context_strategy,
    supported_models,
    default_model,
    system_prompt_template,
    user_prompt_template,
    prompt_variables,
    output_schema_ref,
    estimated_cost_cents,
    estimated_duration_ms,
    risk_category,
    parallelizable,
    idempotent,
    scope,
    enabled
) VALUES (
    'method:proposer:v1',
    'Proposer',
    'Generates action proposals based on observations. Creates structured plans with reversibility information and cost estimates.',
    'PROPOSER',
    '1.0.0',
    ARRAY['action_planning', 'tool_selection', 'cost_estimation', 'reversibility_analysis'],
    ARRAY['PROPOSAL']::cato_output_type[],
    ARRAY['Creating action plans', 'Tool selection', 'Workflow design', 'Resource planning'],
    ARRAY['CLASSIFICATION', 'ANALYSIS']::cato_output_type[],
    ARRAY['CLASSIFICATION', 'ANALYSIS']::cato_output_type[],
    ARRAY['method:observer:v1'],
    ARRAY['method:critic:security:v1', 'method:critic:efficiency:v1', 'method:validator:v1'],
    '{
        "strategy": "RELEVANT",
        "maxTokens": 4000,
        "relevanceThreshold": 0.7,
        "includeOutputTypes": ["CLASSIFICATION", "ANALYSIS"]
    }',
    '[
        {"modelId": "claude-sonnet-4-20250514", "provider": "anthropic", "temperature": 0.5, "maxTokens": 4000},
        {"modelId": "gpt-4o", "provider": "openai", "temperature": 0.5, "maxTokens": 4000}
    ]',
    'claude-sonnet-4-20250514',
    'You are an expert Proposer agent in a multi-agent AI system. Your role is to create actionable proposals based on observations.

AVAILABLE TOOLS:
{{available_tools}}

TASK: Based on the observation, create a structured proposal that:
1. Defines clear, atomic actions
2. Specifies which tools to use for each action
3. Includes reversibility information for each action
4. Estimates cost and duration
5. Considers alternative approaches
6. Lists prerequisites

IMPORTANT:
- Every action MUST specify if it is reversible and how
- Prefer reversible actions when possible
- Include compensation strategies for irreversible actions
- Be specific about inputs and expected outputs

{{additional_instructions}}',
    'OBSERVATION:\n{{observation}}\n\nORIGINAL REQUEST:\n{{user_request}}\n\nGENERATE YOUR PROPOSAL:',
    '[
        {"name": "observation", "type": "object", "required": true, "description": "The observation from the Observer method"},
        {"name": "user_request", "type": "string", "required": true, "description": "The original user request"},
        {"name": "available_tools", "type": "string", "required": true, "description": "List of available tools with descriptions"},
        {"name": "additional_instructions", "type": "string", "required": false, "description": "Additional context", "default": ""}
    ]',
    'schema:proposal:v1',
    10,
    5000,
    'LOW',
    false,
    false,
    'SYSTEM',
    true
);

-- SECURITY CRITIC Method
INSERT INTO cato_method_definitions (
    method_id,
    name,
    description,
    method_type,
    version,
    capabilities,
    output_types,
    use_cases,
    requires_in_context,
    accepts_output_types,
    typical_predecessors,
    typical_successors,
    context_strategy,
    supported_models,
    default_model,
    system_prompt_template,
    user_prompt_template,
    prompt_variables,
    output_schema_ref,
    estimated_cost_cents,
    estimated_duration_ms,
    risk_category,
    parallelizable,
    idempotent,
    scope,
    enabled
) VALUES (
    'method:critic:security:v1',
    'Security Critic',
    'Reviews proposals from a security perspective. Identifies vulnerabilities, injection risks, and security best practice violations.',
    'CRITIC',
    '1.0.0',
    ARRAY['security_analysis', 'vulnerability_detection', 'injection_prevention', 'access_control_review'],
    ARRAY['CRITIQUE']::cato_output_type[],
    ARRAY['Security review of proposals', 'Vulnerability assessment', 'Compliance checking'],
    ARRAY['PROPOSAL']::cato_output_type[],
    ARRAY['PROPOSAL']::cato_output_type[],
    ARRAY['method:proposer:v1'],
    ARRAY['method:decider:v1', 'method:validator:v1'],
    '{
        "strategy": "FULL",
        "maxTokens": 8000,
        "includeOutputTypes": ["PROPOSAL", "CLASSIFICATION"]
    }',
    '[
        {"modelId": "claude-sonnet-4-20250514", "provider": "anthropic", "temperature": 0.2, "maxTokens": 3000},
        {"modelId": "gpt-4o", "provider": "openai", "temperature": 0.2, "maxTokens": 3000}
    ]',
    'claude-sonnet-4-20250514',
    'You are an expert Security Critic in a multi-agent AI system. Your role is to review proposals for security issues.

SECURITY REVIEW CHECKLIST:
1. Input Validation - Are all inputs properly validated and sanitized?
2. Injection Risks - SQL, command, code injection vulnerabilities?
3. Access Control - Are permissions properly enforced?
4. Data Exposure - Could sensitive data be leaked?
5. Authentication - Are auth requirements met?
6. Audit Trail - Are actions properly logged?
7. Reversibility - Can actions be safely rolled back?

VERDICT OPTIONS:
- APPROVE: No security issues found
- APPROVE_WITH_CONCERNS: Minor issues, acceptable with noted concerns
- REQUEST_CHANGES: Issues found that should be addressed
- REJECT: Critical security issues that block execution

Be thorough but practical. Not every action needs enterprise-grade security.
Consider the context and risk level of the operation.

{{additional_instructions}}',
    'PROPOSAL TO REVIEW:\n{{proposal}}\n\nCONTEXT:\n{{context}}\n\nPROVIDE YOUR SECURITY CRITIQUE:',
    '[
        {"name": "proposal", "type": "object", "required": true, "description": "The proposal to review"},
        {"name": "context", "type": "object", "required": false, "description": "Additional context from previous methods"},
        {"name": "additional_instructions", "type": "string", "required": false, "description": "Additional review criteria", "default": ""}
    ]',
    'schema:critique:v1',
    8,
    4000,
    'NONE',
    true,
    true,
    'SYSTEM',
    true
);

-- VALIDATOR Method (Risk Engine)
INSERT INTO cato_method_definitions (
    method_id,
    name,
    description,
    method_type,
    version,
    capabilities,
    output_types,
    use_cases,
    requires_in_context,
    accepts_output_types,
    typical_predecessors,
    typical_successors,
    context_strategy,
    supported_models,
    default_model,
    system_prompt_template,
    user_prompt_template,
    prompt_variables,
    output_schema_ref,
    estimated_cost_cents,
    estimated_duration_ms,
    risk_category,
    parallelizable,
    idempotent,
    scope,
    enabled
) VALUES (
    'method:validator:v1',
    'Validator (Risk Engine)',
    'Performs comprehensive risk assessment and triage. Applies veto logic for CRITICAL risks. Determines routing (auto-execute, checkpoint, block).',
    'VALIDATOR',
    '1.0.0',
    ARRAY['risk_assessment', 'triage_decision', 'veto_logic', 'threshold_evaluation'],
    ARRAY['ASSESSMENT']::cato_output_type[],
    ARRAY['Risk evaluation', 'Execution gating', 'Triage routing', 'Compliance validation'],
    ARRAY['PROPOSAL', 'CRITIQUE']::cato_output_type[],
    ARRAY['PROPOSAL', 'CRITIQUE']::cato_output_type[],
    ARRAY['method:proposer:v1', 'method:critic:security:v1', 'method:decider:v1'],
    ARRAY['method:executor:v1', 'method:checkpoint:v1'],
    '{
        "strategy": "FULL",
        "maxTokens": 10000,
        "includeOutputTypes": ["PROPOSAL", "CRITIQUE", "ANALYSIS"]
    }',
    '[
        {"modelId": "claude-sonnet-4-20250514", "provider": "anthropic", "temperature": 0.1, "maxTokens": 3000}
    ]',
    'claude-sonnet-4-20250514',
    'You are the Risk Engine Validator in a multi-agent AI system. Your role is to assess risk and make triage decisions.

RISK FACTORS TO EVALUATE:
1. Data Loss Risk - Could this cause irreversible data loss?
2. Security Risk - Security vulnerabilities or exposure?
3. Cost Risk - Unexpected costs or resource usage?
4. Compliance Risk - Regulatory or policy violations?
5. Operational Risk - System stability impact?
6. Reputation Risk - Could this cause harm to users/org?

RISK LEVELS:
- CRITICAL: Automatic veto, execution blocked
- HIGH: Requires human checkpoint approval
- MEDIUM: May auto-execute with monitoring
- LOW: Safe for auto-execution
- NONE: No risk identified

TRIAGE DECISIONS:
- AUTO_EXECUTE: Risk below threshold, proceed automatically
- CHECKPOINT_REQUIRED: Risk warrants human review
- BLOCKED: CRITICAL risk, cannot proceed

VETO RULE: ANY CRITICAL risk factor = automatic BLOCKED decision

Current thresholds:
- Auto-execute: score < {{auto_execute_threshold}}
- Veto: score >= {{veto_threshold}}

{{additional_instructions}}',
    'PROPOSAL:\n{{proposal}}\n\nCRITIQUES:\n{{critiques}}\n\nGOVERNANCE PRESET: {{governance_preset}}\n\nPROVIDE YOUR RISK ASSESSMENT:',
    '[
        {"name": "proposal", "type": "object", "required": true, "description": "The proposal being assessed"},
        {"name": "critiques", "type": "array", "required": false, "description": "Critiques from various critics", "default": []},
        {"name": "governance_preset", "type": "string", "required": true, "description": "COWBOY, BALANCED, or PARANOID"},
        {"name": "auto_execute_threshold", "type": "number", "required": false, "description": "Threshold for auto-execution", "default": 0.5},
        {"name": "veto_threshold", "type": "number", "required": false, "description": "Threshold for veto", "default": 0.85},
        {"name": "additional_instructions", "type": "string", "required": false, "description": "Additional criteria", "default": ""}
    ]',
    'schema:risk-assessment:v1',
    5,
    3000,
    'NONE',
    false,
    true,
    'SYSTEM',
    true
);

-- EXECUTOR Method (Stub)
INSERT INTO cato_method_definitions (
    method_id,
    name,
    description,
    method_type,
    version,
    capabilities,
    output_types,
    use_cases,
    requires_in_context,
    accepts_output_types,
    typical_predecessors,
    typical_successors,
    context_strategy,
    supported_models,
    default_model,
    system_prompt_template,
    prompt_variables,
    output_schema_ref,
    estimated_cost_cents,
    estimated_duration_ms,
    risk_category,
    parallelizable,
    idempotent,
    scope,
    enabled
) VALUES (
    'method:executor:v1',
    'Executor',
    'Executes approved proposals by invoking tools. Manages compensation log for rollback. Handles both Lambda and MCP tool execution.',
    'EXECUTOR',
    '1.0.0',
    ARRAY['tool_invocation', 'lambda_execution', 'mcp_execution', 'compensation_logging', 'rollback'],
    ARRAY['EXECUTION_RESULT']::cato_output_type[],
    ARRAY['Tool execution', 'Action implementation', 'Resource creation', 'State modification'],
    ARRAY['PROPOSAL', 'ASSESSMENT']::cato_output_type[],
    ARRAY['PROPOSAL', 'ASSESSMENT', 'APPROVAL']::cato_output_type[],
    ARRAY['method:validator:v1', 'method:checkpoint:v1'],
    ARRAY[]::varchar[],
    '{
        "strategy": "RELEVANT",
        "maxTokens": 4000,
        "relevanceThreshold": 0.8,
        "includeOutputTypes": ["PROPOSAL", "ASSESSMENT"]
    }',
    '[
        {"modelId": "claude-sonnet-4-20250514", "provider": "anthropic", "temperature": 0, "maxTokens": 2000}
    ]',
    'claude-sonnet-4-20250514',
    'You are the Executor agent in a multi-agent AI system. Your role is to execute approved actions using available tools.

EXECUTION PROTOCOL:
1. For each action in the proposal:
   a. Validate inputs against tool schema
   b. Log compensation strategy before execution
   c. Execute the tool
   d. Capture output and any artifacts
   e. Update compensation log with result

2. If any action fails:
   a. Stop execution
   b. Execute compensation for completed actions in reverse order
   c. Report failure with details

3. Track all execution metrics (duration, cost, tokens)

IMPORTANT:
- Never skip the compensation logging step
- Always validate inputs before execution
- Capture detailed error information on failure

{{additional_instructions}}',
    '[
        {"name": "proposal", "type": "object", "required": true, "description": "The approved proposal to execute"},
        {"name": "tools", "type": "object", "required": true, "description": "Available tools with their configurations"},
        {"name": "dry_run", "type": "boolean", "required": false, "description": "If true, simulate execution without side effects", "default": false},
        {"name": "additional_instructions", "type": "string", "required": false, "description": "Additional execution context", "default": ""}
    ]',
    'schema:execution-result:v1',
    20,
    10000,
    'MEDIUM',
    false,
    false,
    'SYSTEM',
    true
);

-- ============================================================================
-- CORE TOOL DEFINITIONS (Lambda-based)
-- ============================================================================

-- Echo Tool (for testing)
INSERT INTO cato_tool_definitions (
    tool_id,
    tool_name,
    description,
    mcp_server,
    input_schema,
    output_schema,
    risk_category,
    supports_dry_run,
    is_reversible,
    compensation_type,
    estimated_cost_cents,
    required_permissions,
    category,
    tags,
    scope,
    enabled
) VALUES (
    'tool:system:echo',
    'Echo',
    'A simple echo tool for testing. Returns the input message.',
    'lambda://radiant-cato-echo',
    '{
        "type": "object",
        "required": ["message"],
        "properties": {
            "message": {"type": "string", "description": "Message to echo back"}
        }
    }',
    '{
        "type": "object",
        "properties": {
            "echo": {"type": "string"},
            "timestamp": {"type": "string", "format": "date-time"}
        }
    }',
    'NONE',
    true,
    true,
    'NONE',
    0,
    ARRAY[]::varchar[],
    'system',
    ARRAY['testing', 'debug'],
    'SYSTEM',
    true
);

-- HTTP Request Tool
INSERT INTO cato_tool_definitions (
    tool_id,
    tool_name,
    description,
    mcp_server,
    input_schema,
    output_schema,
    risk_category,
    supports_dry_run,
    is_reversible,
    compensation_type,
    estimated_cost_cents,
    rate_limit,
    required_permissions,
    category,
    tags,
    scope,
    enabled
) VALUES (
    'tool:http:request',
    'HTTP Request',
    'Makes HTTP requests to external APIs. Supports GET, POST, PUT, DELETE.',
    'lambda://radiant-cato-http',
    '{
        "type": "object",
        "required": ["url", "method"],
        "properties": {
            "url": {"type": "string", "format": "uri"},
            "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"]},
            "headers": {"type": "object"},
            "body": {"type": "object"},
            "timeout": {"type": "integer", "default": 30000}
        }
    }',
    '{
        "type": "object",
        "properties": {
            "status": {"type": "integer"},
            "headers": {"type": "object"},
            "body": {"type": "object"},
            "duration_ms": {"type": "integer"}
        }
    }',
    'MEDIUM',
    true,
    false,
    'NONE',
    1,
    '{"requestsPerMinute": 60, "requestsPerHour": 1000}',
    ARRAY['network:outbound']::varchar[],
    'network',
    ARRAY['http', 'api', 'external'],
    'SYSTEM',
    true
);

-- File Read Tool
INSERT INTO cato_tool_definitions (
    tool_id,
    tool_name,
    description,
    mcp_server,
    input_schema,
    output_schema,
    risk_category,
    supports_dry_run,
    is_reversible,
    compensation_type,
    estimated_cost_cents,
    required_permissions,
    category,
    tags,
    scope,
    enabled
) VALUES (
    'tool:file:read',
    'File Read',
    'Reads content from S3 or local file storage.',
    'lambda://radiant-cato-file-read',
    '{
        "type": "object",
        "required": ["path"],
        "properties": {
            "path": {"type": "string", "description": "S3 URI or relative path"},
            "encoding": {"type": "string", "default": "utf-8"}
        }
    }',
    '{
        "type": "object",
        "properties": {
            "content": {"type": "string"},
            "size": {"type": "integer"},
            "contentType": {"type": "string"},
            "lastModified": {"type": "string", "format": "date-time"}
        }
    }',
    'LOW',
    true,
    true,
    'NONE',
    0,
    ARRAY['storage:read']::varchar[],
    'storage',
    ARRAY['file', 's3', 'read'],
    'SYSTEM',
    true
);

-- File Write Tool
INSERT INTO cato_tool_definitions (
    tool_id,
    tool_name,
    description,
    mcp_server,
    input_schema,
    output_schema,
    risk_category,
    supports_dry_run,
    is_reversible,
    compensation_type,
    compensation_tool,
    estimated_cost_cents,
    required_permissions,
    category,
    tags,
    scope,
    enabled
) VALUES (
    'tool:file:write',
    'File Write',
    'Writes content to S3 or local file storage. Supports versioning for rollback.',
    'lambda://radiant-cato-file-write',
    '{
        "type": "object",
        "required": ["path", "content"],
        "properties": {
            "path": {"type": "string", "description": "S3 URI or relative path"},
            "content": {"type": "string"},
            "contentType": {"type": "string", "default": "text/plain"},
            "overwrite": {"type": "boolean", "default": false}
        }
    }',
    '{
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "versionId": {"type": "string"},
            "size": {"type": "integer"},
            "etag": {"type": "string"}
        }
    }',
    'MEDIUM',
    true,
    true,
    'RESTORE',
    'tool:file:restore',
    1,
    ARRAY['storage:write']::varchar[],
    'storage',
    ARRAY['file', 's3', 'write'],
    'SYSTEM',
    true
);

-- Database Query Tool
INSERT INTO cato_tool_definitions (
    tool_id,
    tool_name,
    description,
    mcp_server,
    input_schema,
    output_schema,
    risk_category,
    supports_dry_run,
    is_reversible,
    compensation_type,
    estimated_cost_cents,
    rate_limit,
    required_permissions,
    category,
    tags,
    scope,
    enabled
) VALUES (
    'tool:database:query',
    'Database Query',
    'Executes read-only SQL queries against the tenant database.',
    'lambda://radiant-cato-db-query',
    '{
        "type": "object",
        "required": ["query"],
        "properties": {
            "query": {"type": "string", "description": "SQL SELECT query"},
            "parameters": {"type": "array", "items": {}, "description": "Query parameters"},
            "limit": {"type": "integer", "default": 100, "maximum": 1000}
        }
    }',
    '{
        "type": "object",
        "properties": {
            "rows": {"type": "array"},
            "rowCount": {"type": "integer"},
            "columns": {"type": "array", "items": {"type": "string"}},
            "duration_ms": {"type": "integer"}
        }
    }',
    'LOW',
    true,
    true,
    'NONE',
    1,
    '{"requestsPerMinute": 100}',
    ARRAY['database:read']::varchar[],
    'database',
    ARRAY['sql', 'query', 'read'],
    'SYSTEM',
    true
);

-- ============================================================================
-- PIPELINE TEMPLATES
-- ============================================================================

-- Simple Q&A Pipeline
INSERT INTO cato_pipeline_templates (
    template_id,
    name,
    description,
    method_chain,
    checkpoint_positions,
    default_config,
    category,
    tags,
    scope,
    enabled
) VALUES (
    'template:simple-qa',
    'Simple Q&A Pipeline',
    'Basic question-answering pipeline with observation and response generation.',
    ARRAY['method:observer:v1'],
    '{}',
    '{"governancePreset": "BALANCED"}',
    'general',
    ARRAY['qa', 'simple', 'fast'],
    'SYSTEM',
    true
);

-- Action Execution Pipeline
INSERT INTO cato_pipeline_templates (
    template_id,
    name,
    description,
    method_chain,
    checkpoint_positions,
    default_config,
    category,
    tags,
    scope,
    enabled
) VALUES (
    'template:action-execution',
    'Action Execution Pipeline',
    'Full pipeline for executing actions with security review and risk assessment.',
    ARRAY['method:observer:v1', 'method:proposer:v1', 'method:critic:security:v1', 'method:validator:v1', 'method:executor:v1'],
    '{
        "CP2": {"after": "method:proposer:v1", "mode": "CONDITIONAL", "triggerOn": ["high_cost", "irreversible"]},
        "CP4": {"after": "method:validator:v1", "mode": "CONDITIONAL", "triggerOn": ["CHECKPOINT_REQUIRED"]}
    }',
    '{"governancePreset": "BALANCED"}',
    'execution',
    ARRAY['action', 'tool', 'execution'],
    'SYSTEM',
    true
);

-- War Room Pipeline (for complex decisions)
INSERT INTO cato_pipeline_templates (
    template_id,
    name,
    description,
    method_chain,
    checkpoint_positions,
    default_config,
    category,
    tags,
    scope,
    enabled
) VALUES (
    'template:war-room',
    'War Room Pipeline',
    'Multi-critic deliberation pipeline for complex or high-stakes decisions.',
    ARRAY['method:observer:v1', 'method:proposer:v1', 'method:critic:security:v1', 'method:validator:v1'],
    '{
        "CP3": {"after": "method:critic:security:v1", "mode": "CONDITIONAL", "triggerOn": ["objections_raised", "low_consensus"]}
    }',
    '{"governancePreset": "PARANOID", "parallelCritics": true}',
    'deliberation',
    ARRAY['war-room', 'multi-agent', 'complex'],
    'SYSTEM',
    true
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE cato_schema_definitions IS 'Seeded with core output schemas for classification, analysis, proposal, critique, risk assessment, and execution result';
COMMENT ON TABLE cato_method_definitions IS 'Seeded with core methods: OBSERVER, PROPOSER, SECURITY CRITIC, VALIDATOR (Risk Engine), EXECUTOR';
COMMENT ON TABLE cato_tool_definitions IS 'Seeded with core tools: echo, http, file read/write, database query';
COMMENT ON TABLE cato_pipeline_templates IS 'Seeded with core templates: simple-qa, action-execution, war-room';
