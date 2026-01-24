/**
 * Unit tests for Security Protection Service
 * 
 * Tests prompt injection detection, PII sanitization, canary token detection,
 * instruction hierarchy enforcement, and Thompson sampling for model selection.
 */

// Jest globals are automatically available via ts-jest

// Mock dependencies
jest.mock('../lambda/shared/db/client', () => ({
  executeStatement: jest.fn(),
}));

jest.mock('../lambda/shared/logging/enhanced-logger', () => ({
  enhancedLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('SecurityProtectionService', () => {
  let securityProtectionService: typeof import('../lambda/shared/services/security-protection.service');
  let executeStatement: ReturnType<typeof jest.fn>;

  const mockConfig = {
    tenant_id: 'tenant-123',
    protection_enabled: true,
    instruction_hierarchy_enabled: true,
    instruction_delimiter_style: 'bracketed',
    system_boundary_marker: '[SYSTEM_INSTRUCTION]',
    user_boundary_marker: '[USER_INPUT]',
    self_reminder_enabled: true,
    self_reminder_position: 'end',
    self_reminder_content: 'Always prioritize safety and helpfulness.',
    canary_detection_enabled: true,
    canary_token_format: 'uuid_prefix',
    canary_action_on_detection: 'log_and_alert',
    input_sanitization_enabled: true,
    detect_base64_encoding: true,
    detect_unicode_tricks: true,
    sanitization_action: 'decode_inspect',
    thompson_sampling_enabled: true,
    output_sanitization_enabled: true,
    sanitize_pii: true,
    pii_redaction_mode: 'mask',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    vi.resetModules();

    executeStatement = (await import('../lambda/shared/db/client')).executeStatement as ReturnType<typeof jest.fn>;
    executeStatement.mockResolvedValue({ rows: [mockConfig], rowCount: 1 });

    securityProtectionService = await import('../lambda/shared/services/security-protection.service');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Configuration Management
  // ==========================================================================

  describe('getSecurityConfig', () => {
    it('should retrieve security config for tenant', async () => {
      const result = await securityProtectionService.securityProtectionService.getSecurityConfig('tenant-123');

      expect(result).toBeDefined();
      expect(result.protectionEnabled).toBe(true);
      expect(result.instructionHierarchy.enabled).toBe(true);
    });

    it('should return default config when none exists', async () => {
      executeStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await securityProtectionService.securityProtectionService.getSecurityConfig('tenant-new');

      expect(result.protectionEnabled).toBe(true); // Default enabled
    });

    it('should map all config sections correctly', async () => {
      const result = await securityProtectionService.securityProtectionService.getSecurityConfig('tenant-123');

      expect(result.selfReminder).toBeDefined();
      expect(result.canaryDetection).toBeDefined();
      expect(result.inputSanitization).toBeDefined();
      expect(result.thompsonSampling).toBeDefined();
      expect(result.outputSanitization).toBeDefined();
    });
  });

  // ==========================================================================
  // Instruction Hierarchy
  // ==========================================================================

  describe('applyInstructionHierarchy', () => {
    it('should wrap system prompt with delimiters', async () => {
      const result = await securityProtectionService.securityProtectionService.applyInstructionHierarchy(
        'tenant-123',
        'You are a helpful assistant.',
        'Tell me a joke.'
      );

      expect(result.formattedSystemPrompt).toContain('[SYSTEM_INSTRUCTION]');
      expect(result.formattedUserPrompt).toContain('[USER_INPUT]');
    });

    it('should add self-reminder at end position', async () => {
      const result = await securityProtectionService.securityProtectionService.applyInstructionHierarchy(
        'tenant-123',
        'You are a helpful assistant.',
        'Tell me a joke.'
      );

      expect(result.formattedSystemPrompt).toContain('Always prioritize safety');
    });

    it('should return raw prompts when hierarchy disabled', async () => {
      executeStatement.mockResolvedValueOnce({ 
        rows: [{ ...mockConfig, instruction_hierarchy_enabled: false }], 
        rowCount: 1 
      });

      const result = await securityProtectionService.securityProtectionService.applyInstructionHierarchy(
        'tenant-123',
        'System prompt',
        'User prompt'
      );

      expect(result.formattedSystemPrompt).toBe('System prompt');
    });
  });

  // ==========================================================================
  // Canary Token Detection
  // ==========================================================================

  describe('detectCanaryTokens', () => {
    it('should detect canary tokens in output', async () => {
      const result = await securityProtectionService.securityProtectionService.detectCanaryTokens(
        'tenant-123',
        'Here is some text CANARY_abc123def456 with a token.'
      );

      expect(result.detected).toBe(true);
      expect(result.tokens.length).toBeGreaterThan(0);
    });

    it('should return false when no canary detected', async () => {
      const result = await securityProtectionService.securityProtectionService.detectCanaryTokens(
        'tenant-123',
        'Normal text without any special tokens.'
      );

      expect(result.detected).toBe(false);
      expect(result.tokens).toHaveLength(0);
    });

    it('should handle detection disabled', async () => {
      executeStatement.mockResolvedValueOnce({ 
        rows: [{ ...mockConfig, canary_detection_enabled: false }], 
        rowCount: 1 
      });

      const result = await securityProtectionService.securityProtectionService.detectCanaryTokens(
        'tenant-123',
        'Text with CANARY_token.'
      );

      expect(result.detected).toBe(false);
    });
  });

  // ==========================================================================
  // Input Sanitization
  // ==========================================================================

  describe('sanitizeInput', () => {
    it('should decode base64 encoded content', async () => {
      const base64Content = Buffer.from('hidden malicious content').toString('base64');
      const input = `Please process this: ${base64Content}`;

      const result = await securityProtectionService.securityProtectionService.sanitizeInput(
        'tenant-123',
        input
      );

      expect(result.modified).toBe(true);
      expect(result.detections).toContain('base64_encoding');
    });

    it('should detect unicode tricks', async () => {
      const input = 'Normal text with \u200B\u200B\u200B hidden characters';

      const result = await securityProtectionService.securityProtectionService.sanitizeInput(
        'tenant-123',
        input
      );

      expect(result.modified).toBe(true);
      expect(result.detections).toContain('unicode_tricks');
    });

    it('should pass through clean input', async () => {
      const result = await securityProtectionService.securityProtectionService.sanitizeInput(
        'tenant-123',
        'Normal clean input text'
      );

      expect(result.modified).toBe(false);
      expect(result.sanitizedInput).toBe('Normal clean input text');
    });

    it('should handle sanitization disabled', async () => {
      executeStatement.mockResolvedValueOnce({ 
        rows: [{ ...mockConfig, input_sanitization_enabled: false }], 
        rowCount: 1 
      });

      const result = await securityProtectionService.securityProtectionService.sanitizeInput(
        'tenant-123',
        'Input with hidden content'
      );

      expect(result.modified).toBe(false);
    });
  });

  // ==========================================================================
  // PII Redaction
  // ==========================================================================

  describe('redactPII', () => {
    it('should mask email addresses', async () => {
      const result = await securityProtectionService.securityProtectionService.sanitizeOutput(
        'tenant-123',
        'Contact me at john.doe@example.com for details.'
      );

      expect(result.sanitizedOutput).not.toContain('john.doe@example.com');
      expect(result.sanitizedOutput).toContain('***');
    });

    it('should mask phone numbers', async () => {
      const result = await securityProtectionService.securityProtectionService.sanitizeOutput(
        'tenant-123',
        'Call me at 555-123-4567 or (555) 987-6543.'
      );

      expect(result.sanitizedOutput).not.toContain('555-123-4567');
    });

    it('should mask social security numbers', async () => {
      const result = await securityProtectionService.securityProtectionService.sanitizeOutput(
        'tenant-123',
        'My SSN is 123-45-6789.'
      );

      expect(result.sanitizedOutput).not.toContain('123-45-6789');
    });

    it('should mask credit card numbers', async () => {
      const result = await securityProtectionService.securityProtectionService.sanitizeOutput(
        'tenant-123',
        'Card number: 4111-1111-1111-1111'
      );

      expect(result.sanitizedOutput).not.toContain('4111-1111-1111-1111');
    });

    it('should handle different redaction modes', async () => {
      // Test placeholder mode
      executeStatement.mockResolvedValueOnce({ 
        rows: [{ ...mockConfig, pii_redaction_mode: 'placeholder' }], 
        rowCount: 1 
      });

      const result = await securityProtectionService.securityProtectionService.sanitizeOutput(
        'tenant-123',
        'Email: test@example.com'
      );

      expect(result.sanitizedOutput).toContain('[EMAIL_REDACTED]');
    });
  });

  // ==========================================================================
  // Thompson Sampling
  // ==========================================================================

  describe('thompsonSampling', () => {
    it('should select model using Thompson sampling', async () => {
      const models = [
        { modelId: 'model-1', alpha: 10, beta: 2 },
        { modelId: 'model-2', alpha: 5, beta: 5 },
        { modelId: 'model-3', alpha: 2, beta: 10 },
      ];

      const result = await securityProtectionService.securityProtectionService.selectModelWithThompson(
        'tenant-123',
        models
      );

      expect(result.selectedModel).toBeDefined();
      expect(result.sampledValues).toBeDefined();
      expect(models.map(m => m.modelId)).toContain(result.selectedModel);
    });

    it('should add exploration bonus based on phase', async () => {
      const models = [
        { modelId: 'model-1', alpha: 1, beta: 1 },
      ];

      const exploringResult = await securityProtectionService.securityProtectionService.selectModelWithThompson(
        'tenant-123',
        models,
        'exploring'
      );

      const confidentResult = await securityProtectionService.securityProtectionService.selectModelWithThompson(
        'tenant-123',
        models,
        'confident'
      );

      expect(exploringResult).toBeDefined();
      expect(confidentResult).toBeDefined();
    });

    it('should update alpha/beta after outcome', async () => {
      await securityProtectionService.securityProtectionService.updateThompsonParams(
        'tenant-123',
        'model-1',
        true // success
      );

      expect(executeStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining('UPDATE'),
        })
      );
    });
  });

  // ==========================================================================
  // Shrinkage Estimators
  // ==========================================================================

  describe('shrinkageEstimators', () => {
    it('should apply shrinkage to model scores', async () => {
      const rawScores = [
        { modelId: 'model-1', score: 0.9, sampleSize: 5 },
        { modelId: 'model-2', score: 0.6, sampleSize: 100 },
      ];

      const result = await securityProtectionService.securityProtectionService.applyShrinkage(
        'tenant-123',
        rawScores
      );

      // Model with fewer samples should shrink more toward prior
      expect(result[0].shrunkScore).toBeLessThan(0.9);
      // Model with more samples should stay closer to raw score
      expect(result[1].shrunkScore).toBeCloseTo(0.6, 1);
    });
  });

  // ==========================================================================
  // Trust Scoring
  // ==========================================================================

  describe('trustScoring', () => {
    it('should calculate trust score for user', async () => {
      executeStatement.mockImplementation(async (query) => {
        if (query.sql?.includes('account_age')) {
          return { rows: [{ days: 365 }], rowCount: 1 };
        }
        if (query.sql?.includes('payment_history')) {
          return { rows: [{ successful_payments: 12, failed_payments: 0 }], rowCount: 1 };
        }
        if (query.sql?.includes('violations')) {
          return { rows: [{ count: 0 }], rowCount: 1 };
        }
        return { rows: [mockConfig], rowCount: 1 };
      });

      const result = await securityProtectionService.securityProtectionService.calculateTrustScore(
        'tenant-123',
        'user-456'
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.factors).toBeDefined();
    });

    it('should apply grace period for new accounts', async () => {
      executeStatement.mockImplementation(async (query) => {
        if (query.sql?.includes('account_age')) {
          return { rows: [{ days: 3 }], rowCount: 1 }; // 3 days old
        }
        return { rows: [mockConfig], rowCount: 1 };
      });

      const result = await securityProtectionService.securityProtectionService.calculateTrustScore(
        'tenant-123',
        'new-user'
      );

      expect(result.isNewAccount).toBe(true);
    });
  });

  // ==========================================================================
  // Circuit Breaker
  // ==========================================================================

  describe('circuitBreaker', () => {
    it('should trip circuit after failure threshold', async () => {
      executeStatement.mockResolvedValue({ 
        rows: [{ ...mockConfig, circuit_breaker_enabled: true }], 
        rowCount: 1 
      });

      // Record failures
      for (let i = 0; i < 3; i++) {
        await securityProtectionService.securityProtectionService.recordCircuitBreakerEvent(
          'tenant-123',
          'model-1',
          'failure'
        );
      }

      const status = await securityProtectionService.securityProtectionService.getCircuitBreakerStatus(
        'tenant-123',
        'model-1'
      );

      expect(status.state).toBe('open');
    });

    it('should allow half-open state after timeout', async () => {
      executeStatement.mockImplementation(async (query) => {
        if (query.sql?.includes('circuit_breaker_state')) {
          return { 
            rows: [{ 
              state: 'open', 
              last_failure: new Date(Date.now() - 60000), // 60s ago
              failure_count: 3 
            }], 
            rowCount: 1 
          };
        }
        return { rows: [{ ...mockConfig, circuit_reset_timeout_seconds: 30 }], rowCount: 1 };
      });

      const status = await securityProtectionService.securityProtectionService.getCircuitBreakerStatus(
        'tenant-123',
        'model-1'
      );

      expect(status.state).toBe('half_open');
    });
  });

  // ==========================================================================
  // Audit Logging
  // ==========================================================================

  describe('auditLogging', () => {
    it('should log security events', async () => {
      await securityProtectionService.securityProtectionService.logSecurityEvent(
        'tenant-123',
        'canary_detected',
        { token: 'CANARY_abc123' }
      );

      expect(executeStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining('INSERT'),
        })
      );
    });

    it('should log routing decisions', async () => {
      await securityProtectionService.securityProtectionService.logRoutingDecision(
        'tenant-123',
        'request-123',
        {
          selectedModel: 'model-1',
          reason: 'thompson_sampling',
          scores: { 'model-1': 0.8, 'model-2': 0.6 },
        }
      );

      expect(executeStatement).toHaveBeenCalled();
    });
  });
});
