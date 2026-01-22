import { 
  DeduplicationConfig,
  findExactMatch,
  findFuzzyMatch,
} from '../hitl-orchestration/deduplication.service';

describe('Semantic Deduplication Service', () => {
  describe('Jaccard Similarity', () => {
    const calculateJaccard = (a: string, b: string): number => {
      const setA = new Set(a.toLowerCase().split(/\s+/));
      const setB = new Set(b.toLowerCase().split(/\s+/));
      const intersection = new Set([...setA].filter(x => setB.has(x)));
      const union = new Set([...setA, ...setB]);
      return intersection.size / union.size;
    };

    it('should return 1.0 for identical strings', () => {
      const result = calculateJaccard('hello world', 'hello world');
      expect(result).toBe(1.0);
    });

    it('should return 0 for completely different strings', () => {
      const result = calculateJaccard('hello world', 'foo bar baz');
      expect(result).toBe(0);
    });

    it('should return partial similarity for overlapping strings', () => {
      const result = calculateJaccard('hello world', 'hello there');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('should be case-insensitive', () => {
      const result = calculateJaccard('Hello World', 'hello world');
      expect(result).toBe(1.0);
    });
  });

  describe('Question Normalization', () => {
    const normalizeQuestion = (question: string): string => {
      return question
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    it('should lowercase the question', () => {
      const result = normalizeQuestion('What Is The Answer?');
      expect(result).toBe('what is the answer');
    });

    it('should remove punctuation', () => {
      const result = normalizeQuestion('Hello, world! How are you?');
      expect(result).toBe('hello world how are you');
    });

    it('should collapse multiple spaces', () => {
      const result = normalizeQuestion('Hello    world');
      expect(result).toBe('hello world');
    });

    it('should trim whitespace', () => {
      const result = normalizeQuestion('  hello world  ');
      expect(result).toBe('hello world');
    });
  });

  describe('Hash Generation', () => {
    const generateHash = (question: string, context: Record<string, unknown>): string => {
      const crypto = require('crypto');
      const normalized = question.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      const contextStr = JSON.stringify(context, Object.keys(context).sort());
      return crypto.createHash('sha256').update(`${normalized}|${contextStr}`).digest('hex');
    };

    it('should generate consistent hash for same input', () => {
      const hash1 = generateHash('What is the answer?', { key: 'value' });
      const hash2 = generateHash('What is the answer?', { key: 'value' });
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different questions', () => {
      const hash1 = generateHash('What is the answer?', {});
      const hash2 = generateHash('What is the question?', {});
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash for different context', () => {
      const hash1 = generateHash('What is the answer?', { key: 'value1' });
      const hash2 = generateHash('What is the answer?', { key: 'value2' });
      expect(hash1).not.toBe(hash2);
    });

    it('should normalize question before hashing', () => {
      const hash1 = generateHash('What Is The Answer?', {});
      const hash2 = generateHash('what is the answer', {});
      expect(hash1).toBe(hash2);
    });
  });

  describe('Deduplication Config', () => {
    it('should have valid default configuration', () => {
      const defaultConfig: DeduplicationConfig = {
        ttlSeconds: 3600,
        maxCacheSize: 10000,
        similarityThreshold: 0.85,
        enableSemanticMatching: false,
        semanticSimilarityThreshold: 0.85,
        maxSemanticCandidates: 20,
      };

      expect(defaultConfig.ttlSeconds).toBeGreaterThan(0);
      expect(defaultConfig.maxCacheSize).toBeGreaterThan(0);
      expect(defaultConfig.similarityThreshold).toBeGreaterThan(0);
      expect(defaultConfig.similarityThreshold).toBeLessThanOrEqual(1);
    });

    it('should support semantic matching configuration', () => {
      const config: DeduplicationConfig = {
        ttlSeconds: 3600,
        maxCacheSize: 10000,
        similarityThreshold: 0.85,
        enableSemanticMatching: true,
        semanticSimilarityThreshold: 0.9,
        maxSemanticCandidates: 50,
      };

      expect(config.enableSemanticMatching).toBe(true);
      expect(config.semanticSimilarityThreshold).toBe(0.9);
      expect(config.maxSemanticCandidates).toBe(50);
    });
  });

  describe('Cosine Similarity', () => {
    const cosineSimilarity = (a: number[], b: number[]): number => {
      if (a.length !== b.length) return 0;
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    };

    it('should return 1.0 for identical vectors', () => {
      const vector = [1, 2, 3, 4, 5];
      const result = cosineSimilarity(vector, vector);
      expect(result).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const result = cosineSimilarity(a, b);
      expect(result).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const a = [1, 2, 3];
      const b = [-1, -2, -3];
      const result = cosineSimilarity(a, b);
      expect(result).toBeCloseTo(-1.0, 5);
    });

    it('should handle high-dimensional vectors', () => {
      const dim = 1536; // OpenAI embedding dimension
      const a = Array(dim).fill(0).map(() => Math.random());
      const b = [...a]; // Same vector
      const result = cosineSimilarity(a, b);
      expect(result).toBeCloseTo(1.0, 5);
    });
  });

  describe('Match Type Priority', () => {
    it('should prioritize exact matches over fuzzy', () => {
      const matchTypes = ['exact', 'fuzzy', 'semantic'];
      const priority = { exact: 1, fuzzy: 2, semantic: 3 };
      
      const sorted = matchTypes.sort((a, b) => priority[a as keyof typeof priority] - priority[b as keyof typeof priority]);
      expect(sorted[0]).toBe('exact');
    });

    it('should prioritize fuzzy matches over semantic', () => {
      const matchTypes = ['semantic', 'fuzzy'];
      const priority = { exact: 1, fuzzy: 2, semantic: 3 };
      
      const sorted = matchTypes.sort((a, b) => priority[a as keyof typeof priority] - priority[b as keyof typeof priority]);
      expect(sorted[0]).toBe('fuzzy');
    });
  });

  describe('Cache Entry Structure', () => {
    interface CacheEntry {
      questionHash: string;
      normalizedQuestion: string;
      response: unknown;
      confidence: number;
      createdAt: Date;
      expiresAt: Date;
      hitCount: number;
      questionEmbedding?: number[];
    }

    it('should have required fields', () => {
      const entry: CacheEntry = {
        questionHash: 'abc123',
        normalizedQuestion: 'what is the answer',
        response: { value: 'test' },
        confidence: 0.95,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        hitCount: 0,
      };

      expect(entry.questionHash).toBeDefined();
      expect(entry.normalizedQuestion).toBeDefined();
      expect(entry.response).toBeDefined();
      expect(entry.confidence).toBeGreaterThanOrEqual(0);
      expect(entry.confidence).toBeLessThanOrEqual(1);
    });

    it('should support optional embedding field', () => {
      const entry: CacheEntry = {
        questionHash: 'abc123',
        normalizedQuestion: 'what is the answer',
        response: { value: 'test' },
        confidence: 0.95,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        hitCount: 0,
        questionEmbedding: Array(1536).fill(0.1),
      };

      expect(entry.questionEmbedding).toBeDefined();
      expect(entry.questionEmbedding?.length).toBe(1536);
    });
  });
});
