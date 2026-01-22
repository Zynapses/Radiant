import { ScoutHITLIntegration, createScoutHITLIntegration, Domain } from '../cato/scout-hitl-integration.service';

describe('ScoutHITLIntegration', () => {
  const mockPersonaService = {
    getEffectivePersona: jest.fn().mockResolvedValue({ name: 'scout' }),
  };

  const mockVoiService = {
    shouldAskQuestion: jest.fn().mockResolvedValue({
      shouldAsk: true,
      decision: 'ask',
      reasoning: 'High VOI',
      voi: 0.7,
    }),
  };

  const mockMcpElicitation = {
    createAskUserRequest: jest.fn().mockResolvedValue({
      requestId: 'req-123',
      status: 'pending',
    }),
  };

  const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  let service: ScoutHITLIntegration;

  beforeEach(() => {
    jest.clearAllMocks();
    service = createScoutHITLIntegration(
      mockPersonaService as any,
      mockVoiService as any,
      mockMcpElicitation as any,
      mockLogger as any
    );
  });

  describe('Domain Detection', () => {
    it('should detect medical domain from keywords', () => {
      const result = (service as any).detectDomain(
        'What is the dosage for this medication?',
        { category: 'health' }
      );
      expect(result).toBe('medical');
    });

    it('should detect financial domain from keywords', () => {
      const result = (service as any).detectDomain(
        'Calculate the ROI for this investment',
        {}
      );
      expect(result).toBe('financial');
    });

    it('should detect legal domain from keywords', () => {
      const result = (service as any).detectDomain(
        'Review this contract for compliance',
        {}
      );
      expect(result).toBe('legal');
    });

    it('should detect bioinformatics domain from keywords', () => {
      const result = (service as any).detectDomain(
        'Analyze this DNA sequence',
        {}
      );
      expect(result).toBe('bioinformatics');
    });

    it('should default to general domain', () => {
      const result = (service as any).detectDomain(
        'How do I use this feature?',
        {}
      );
      expect(result).toBe('general');
    });
  });

  describe('Aspect Impact Calculation', () => {
    it('should return high impact for safety in medical domain', () => {
      const result = (service as any).getAspectImpact('safety', 'medical');
      expect(result).toBeGreaterThan(0.9);
    });

    it('should return high impact for compliance in financial domain', () => {
      const result = (service as any).getAspectImpact('compliance', 'financial');
      expect(result).toBeGreaterThan(0.85);
    });

    it('should return base impact for unrelated domain', () => {
      const result = (service as any).getAspectImpact('cost', 'medical');
      // Cost is not boosted in medical domain
      expect(result).toBeLessThan(0.9);
    });

    it('should return default impact for unknown aspect', () => {
      const result = (service as any).getAspectImpact('unknown_aspect', 'general');
      expect(result).toBe(0.5);
    });
  });

  describe('Question Generation', () => {
    it('should generate clarification question for uncertain aspect', () => {
      const result = (service as any).generateClarificationQuestion(
        'safety',
        'medical',
        'Deploy new treatment protocol',
        0.8,
        'blocking'
      );

      expect(result.question).toContain('safety');
      expect(result.questionType).toBe('single_choice');
      expect(result.urgency).toBe('blocking');
      expect(result.domain).toBe('medical');
    });

    it('should include domain-specific options for medical safety', () => {
      const result = (service as any).generateClarificationQuestion(
        'safety',
        'medical',
        'Administer medication',
        0.9,
        'high'
      );

      expect(result.options).toBeDefined();
      expect(result.options.length).toBeGreaterThan(0);
    });
  });

  describe('Assumption Generation', () => {
    it('should generate HIPAA-compliant assumption for medical compliance', () => {
      const result = (service as any).generateAssumption('compliance', 'medical');
      expect(result).toContain('HIPAA');
    });

    it('should generate SOC2-compliant assumption for financial compliance', () => {
      const result = (service as any).generateAssumption('compliance', 'financial');
      expect(result).toContain('SOC2');
    });

    it('should generate default assumption for unknown aspect', () => {
      const result = (service as any).generateAssumption('unknown', 'general');
      expect(result).toContain('standard approach');
    });
  });

  describe('Recommendation Generation', () => {
    it('should recommend proceed when uncertainty is low', () => {
      const result = (service as any).generateRecommendation(0.1, 2, 1);
      expect(result).toBe('proceed');
    });

    it('should recommend wait when uncertainty is moderate', () => {
      const result = (service as any).generateRecommendation(0.4, 1, 0);
      expect(result).toBe('wait');
    });

    it('should recommend abort when uncertainty is high and max questions asked', () => {
      const result = (service as any).generateRecommendation(0.7, 3, 0);
      expect(result).toBe('abort');
    });
  });

  describe('VOI Request Building', () => {
    it('should build VOI request with correct structure', () => {
      const result = (service as any).buildVOIRequest(
        'tenant-123',
        'safety',
        'medical',
        'Deploy system',
        0.8,
        'high'
      );

      expect(result.tenantId).toBe('tenant-123');
      expect(result.question).toBeDefined();
      expect(result.domain).toBe('medical');
      expect(result.urgency).toBe('high');
      expect(result.voiComponents).toBeDefined();
      expect(result.voiComponents.impact).toBeGreaterThan(0);
    });
  });
});

describe('scoutHITLIntegration admin helpers', () => {
  // These tests would require mocking the database
  // For now, we test the export structure
  it('should export admin helper functions', async () => {
    const { scoutHITLIntegration } = await import('../cato/scout-hitl-integration.service');
    
    expect(scoutHITLIntegration).toBeDefined();
    expect(typeof scoutHITLIntegration.getConfig).toBe('function');
    expect(typeof scoutHITLIntegration.updateConfig).toBe('function');
    expect(typeof scoutHITLIntegration.getRecentSessions).toBe('function');
    expect(typeof scoutHITLIntegration.getStatistics).toBe('function');
    expect(typeof scoutHITLIntegration.getDomainBoosts).toBe('function');
    expect(typeof scoutHITLIntegration.updateDomainBoosts).toBe('function');
  });
});
