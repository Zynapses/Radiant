/**
 * Bobble Global Memory Service
 * 
 * Unified interface for all Bobble memory systems:
 * - Semantic Memory (DynamoDB Global Tables)
 * - Episodic Memory (OpenSearch Serverless)
 * - Knowledge Graph (Neptune)
 * - Working Memory (ElastiCache Redis)
 * 
 * @see /docs/bobble/adr/006-global-memory.md
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand
} from '@aws-sdk/lib-dynamodb';
import { logger } from '../../logger';

// ============================================================================
// Types
// ============================================================================

export interface SemanticFact {
  factId: string;
  subject: string;
  predicate: string;
  object: string;
  domain: string;
  confidence: number;
  sources: string[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface EpisodicMemory {
  interactionId: string;
  userId: string;
  query: string;
  response: string;
  embedding?: number[];
  domain: string;
  satisfaction: number;
  timestamp: Date;
}

export interface WorkingMemoryEntry {
  sessionId: string;
  context: unknown;
  goals: string[];
  attentionFocus: string;
  metaState: 'CONFUSED' | 'CONFIDENT' | 'BORED' | 'STAGNANT';
  createdAt: Date;
  expiresAt: Date;
}

export interface GlobalMemoryConfig {
  semanticTable: string;
  workingTable: string;
  configTable: string;
  region: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Global Memory Service for Bobble.
 * 
 * Provides unified access to all memory subsystems.
 * DynamoDB is used for semantic and working memory with global replication.
 */
export class GlobalMemoryService {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly config: GlobalMemoryConfig;

  constructor(config: Partial<GlobalMemoryConfig> = {}) {
    this.config = {
      semanticTable: config.semanticTable || process.env.BOBBLE_SEMANTIC_TABLE || 'bobble-semantic-memory',
      workingTable: config.workingTable || process.env.BOBBLE_WORKING_TABLE || 'bobble-working-memory',
      configTable: config.configTable || process.env.BOBBLE_CONFIG_TABLE || 'bobble-config',
      region: config.region || process.env.AWS_REGION || 'us-east-1'
    };

    const client = new DynamoDBClient({ region: this.config.region });
    this.docClient = DynamoDBDocumentClient.from(client);
  }

  // ============================================================================
  // Semantic Memory
  // ============================================================================

  /**
   * Store a semantic fact.
   */
  async storeFact(
    fact: Omit<SemanticFact, 'factId' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<string> {
    const factId = crypto.randomUUID();
    const now = new Date();

    try {
      await this.docClient.send(new PutCommand({
        TableName: this.config.semanticTable,
        Item: {
          pk: `FACT#${fact.domain}`,
          sk: `${fact.subject}#${fact.predicate}#${fact.object}`,
          factId,
          subject: fact.subject,
          predicate: fact.predicate,
          object: fact.object,
          domain: fact.domain,
          confidence: fact.confidence,
          sources: fact.sources,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          version: 1,
          gsi1pk: `SUBJECT#${fact.subject}`,
          gsi1sk: `${fact.predicate}#${fact.object}`,
          gsi2pk: `DOMAIN#${fact.domain}`,
          gsi2sk: `${fact.confidence}#${now.toISOString()}`
        },
        ConditionExpression: 'attribute_not_exists(pk)'
      }));

      logger.debug('Stored semantic fact', { factId, domain: fact.domain });
      return factId;

    } catch (error) {
      // Handle duplicate - update instead
      if ((error as Error).name === 'ConditionalCheckFailedException') {
        await this.updateFactConfidence(
          fact.domain,
          `${fact.subject}#${fact.predicate}#${fact.object}`,
          fact.confidence,
          fact.sources[0] || 'update'
        );
        return 'updated';
      }
      throw error;
    }
  }

  /**
   * Get facts by domain.
   */
  async getFactsByDomain(domain: string, limit: number = 100): Promise<SemanticFact[]> {
    const response = await this.docClient.send(new QueryCommand({
      TableName: this.config.semanticTable,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `FACT#${domain}`
      },
      Limit: limit
    }));

    return (response.Items || []).map(this.itemToFact);
  }

  /**
   * Get facts about a subject.
   */
  async getFactsAboutSubject(subject: string, limit: number = 50): Promise<SemanticFact[]> {
    const response = await this.docClient.send(new QueryCommand({
      TableName: this.config.semanticTable,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `SUBJECT#${subject}`
      },
      Limit: limit
    }));

    return (response.Items || []).map(this.itemToFact);
  }

  /**
   * Update confidence in a fact.
   */
  async updateFactConfidence(
    domain: string,
    sk: string,
    newConfidence: number,
    source: string
  ): Promise<void> {
    await this.docClient.send(new UpdateCommand({
      TableName: this.config.semanticTable,
      Key: { pk: `FACT#${domain}`, sk },
      UpdateExpression: 'SET confidence = :conf, updatedAt = :now, version = version + :inc, sources = list_append(if_not_exists(sources, :empty), :src)',
      ExpressionAttributeValues: {
        ':conf': newConfidence,
        ':now': new Date().toISOString(),
        ':inc': 1,
        ':src': [source],
        ':empty': []
      }
    }));
  }

  /**
   * Search facts by text using OpenSearch if available, falling back to DynamoDB scan.
   */
  async searchFacts(query: string, limit: number = 20): Promise<SemanticFact[]> {
    // Try OpenSearch first for production full-text search
    const openSearchEndpoint = process.env.OPENSEARCH_ENDPOINT;
    if (openSearchEndpoint) {
      try {
        const results = await this.searchFactsWithOpenSearch(query, limit, openSearchEndpoint);
        if (results.length > 0) return results;
      } catch (error) {
        logger.warn('OpenSearch search failed, falling back to DynamoDB', { error: String(error) });
      }
    }
    
    // Fallback to DynamoDB scan with filter
    const response = await this.docClient.send(new QueryCommand({
      TableName: this.config.semanticTable,
      IndexName: 'gsi2',
      KeyConditionExpression: 'begins_with(gsi2pk, :prefix)',
      FilterExpression: 'contains(#subject, :query) OR contains(#object, :query)',
      ExpressionAttributeNames: {
        '#subject': 'subject',
        '#object': 'object'
      },
      ExpressionAttributeValues: {
        ':prefix': 'DOMAIN#',
        ':query': query.toLowerCase()
      },
      Limit: limit
    }));

    return (response.Items || []).map(this.itemToFact);
  }

  /**
   * Search facts using OpenSearch Serverless for full-text search.
   */
  private async searchFactsWithOpenSearch(
    query: string, 
    limit: number, 
    endpoint: string
  ): Promise<SemanticFact[]> {
    const indexName = process.env.OPENSEARCH_FACTS_INDEX || 'semantic-facts';
    const url = `${endpoint}/${indexName}/_search`;
    
    const searchBody = {
      size: limit,
      query: {
        multi_match: {
          query,
          fields: ['subject^2', 'object^2', 'predicate', 'domain'],
          fuzziness: 'AUTO',
        },
      },
      sort: [{ confidence: 'desc' }, '_score'],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
    });

    if (!response.ok) {
      throw new Error(`OpenSearch error: ${response.status}`);
    }

    const data = await response.json() as {
      hits?: { hits?: Array<{ _source: Record<string, unknown> }> };
    };
    
    return (data.hits?.hits || []).map(hit => ({
      factId: String(hit._source.factId || ''),
      subject: String(hit._source.subject || ''),
      predicate: String(hit._source.predicate || ''),
      object: String(hit._source.object || ''),
      domain: String(hit._source.domain || ''),
      confidence: Number(hit._source.confidence || 0),
      sources: Array.isArray(hit._source.sources) ? hit._source.sources.map(String) : [],
      createdAt: new Date(String(hit._source.createdAt || Date.now())),
      updatedAt: new Date(String(hit._source.updatedAt || Date.now())),
      version: Number(hit._source.version || 1),
    }));
  }

  // ============================================================================
  // Working Memory
  // ============================================================================

  /**
   * Get session context.
   */
  async getSessionContext(sessionId: string): Promise<unknown | null> {
    const response = await this.docClient.send(new QueryCommand({
      TableName: this.config.workingTable,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `SESSION#${sessionId}`
      },
      ScanIndexForward: false,
      Limit: 1
    }));

    return response.Items?.[0]?.context || null;
  }

  /**
   * Update session context.
   */
  async updateSessionContext(sessionId: string, context: unknown): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    await this.docClient.send(new PutCommand({
      TableName: this.config.workingTable,
      Item: {
        pk: `SESSION#${sessionId}`,
        sk: now.toISOString(),
        context,
        createdAt: now.toISOString(),
        expiresAt: Math.floor(expiresAt.getTime() / 1000) // TTL in seconds
      }
    }));
  }

  /**
   * Get current goals.
   */
  async getGoals(): Promise<string[]> {
    const response = await this.docClient.send(new GetCommand({
      TableName: this.config.workingTable,
      Key: { pk: 'GOALS', sk: 'CURRENT' }
    }));

    return (response.Item?.goals as string[]) || [];
  }

  /**
   * Update goals.
   */
  async updateGoals(goals: string[]): Promise<void> {
    await this.docClient.send(new PutCommand({
      TableName: this.config.workingTable,
      Item: {
        pk: 'GOALS',
        sk: 'CURRENT',
        goals,
        updatedAt: new Date().toISOString()
      }
    }));
  }

  /**
   * Get current attention focus.
   */
  async getAttentionFocus(): Promise<string | null> {
    const response = await this.docClient.send(new GetCommand({
      TableName: this.config.workingTable,
      Key: { pk: 'ATTENTION', sk: 'CURRENT' }
    }));

    return (response.Item?.focus as string) || null;
  }

  /**
   * Update attention focus.
   */
  async updateAttentionFocus(focus: string): Promise<void> {
    await this.docClient.send(new PutCommand({
      TableName: this.config.workingTable,
      Item: {
        pk: 'ATTENTION',
        sk: 'CURRENT',
        focus,
        updatedAt: new Date().toISOString()
      }
    }));
  }

  /**
   * Get current meta-cognitive state.
   */
  async getMetaState(): Promise<'CONFUSED' | 'CONFIDENT' | 'BORED' | 'STAGNANT'> {
    const response = await this.docClient.send(new GetCommand({
      TableName: this.config.workingTable,
      Key: { pk: 'META', sk: 'STATE' }
    }));

    return (response.Item?.state as 'CONFUSED' | 'CONFIDENT' | 'BORED' | 'STAGNANT') || 'CONFIDENT';
  }

  /**
   * Update meta-cognitive state.
   */
  async updateMetaState(state: 'CONFUSED' | 'CONFIDENT' | 'BORED' | 'STAGNANT'): Promise<void> {
    await this.docClient.send(new PutCommand({
      TableName: this.config.workingTable,
      Item: {
        pk: 'META',
        sk: 'STATE',
        state,
        updatedAt: new Date().toISOString()
      }
    }));
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get memory statistics.
   */
  async getStats(): Promise<{
    semanticFactCount: number;
    workingMemoryEntries: number;
    domainsCount: number;
  }> {
    // This is approximate - for exact counts, use DynamoDB Streams + Lambda
    const domains = new Set<string>();
    let semanticFactCount = 0;
    let workingMemoryEntries = 0;

    // Sample semantic facts
    const semanticResponse = await this.docClient.send(new QueryCommand({
      TableName: this.config.semanticTable,
      IndexName: 'gsi2',
      KeyConditionExpression: 'begins_with(gsi2pk, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': 'DOMAIN#'
      },
      Limit: 1000,
      Select: 'COUNT'
    }));

    semanticFactCount = semanticResponse.Count || 0;

    // Count unique domains
    const domainResponse = await this.docClient.send(new QueryCommand({
      TableName: this.config.semanticTable,
      IndexName: 'gsi2',
      KeyConditionExpression: 'begins_with(gsi2pk, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': 'DOMAIN#'
      },
      Limit: 1000,
      ProjectionExpression: 'domain'
    }));

    for (const item of domainResponse.Items || []) {
      if (item.domain) {
        domains.add(item.domain as string);
      }
    }

    return {
      semanticFactCount,
      workingMemoryEntries,
      domainsCount: domains.size
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private itemToFact(item: Record<string, unknown>): SemanticFact {
    return {
      factId: item.factId as string,
      subject: item.subject as string,
      predicate: item.predicate as string,
      object: item.object as string,
      domain: item.domain as string,
      confidence: item.confidence as number,
      sources: (item.sources as string[]) || [],
      createdAt: new Date(item.createdAt as string),
      updatedAt: new Date(item.updatedAt as string),
      version: (item.version as number) || 1
    };
  }
}

// Export singleton instance
export const globalMemoryService = new GlobalMemoryService();
