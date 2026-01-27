// @radiant/deploy-core - Health Checker
// Verifies deployment health across all services

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import type { HealthCheckResult, AWSCredentials } from './types';

export class HealthChecker {
  private credentials: AWSCredentials;
  private endpoints: Record<string, string>;
  private lambdaClient: LambdaClient;
  private s3Client: S3Client;

  constructor(credentials: AWSCredentials, endpoints: Record<string, string> = {}) {
    this.credentials = credentials;
    this.endpoints = endpoints;
    
    const clientConfig = {
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
      },
    };
    
    this.lambdaClient = new LambdaClient(clientConfig);
    this.s3Client = new S3Client(clientConfig);
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<HealthCheckResult[]> {
    const checks = [
      this.checkDatabase(),
      this.checkAPI(),
      this.checkLambdas(),
      this.checkS3(),
    ];

    return Promise.all(checks);
  }

  /**
   * Check database connectivity via Lambda health function
   */
  async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const healthFunctionName = this.endpoints['dbHealthFunction'] || 'radiant-db-health';
      
      const command = new InvokeCommand({
        FunctionName: healthFunctionName,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({ action: 'health_check' }),
      });

      const response = await this.lambdaClient.send(command);
      
      if (response.StatusCode === 200 && response.Payload) {
        const payloadStr = new TextDecoder().decode(response.Payload);
        const result = JSON.parse(payloadStr);
        
        return {
          service: 'database',
          healthy: result.healthy === true,
          latencyMs: Date.now() - start,
          message: result.message,
          checkedAt: new Date(),
        };
      }

      return {
        service: 'database',
        healthy: false,
        latencyMs: Date.now() - start,
        message: 'Invalid response from health check function',
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'database',
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
        checkedAt: new Date(),
      };
    }
  }

  /**
   * Check API Gateway
   */
  async checkAPI(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const endpoint = this.endpoints['api'] || '';
      if (!endpoint) {
        return {
          service: 'api',
          healthy: false,
          latencyMs: 0,
          message: 'API endpoint not configured',
          checkedAt: new Date(),
        };
      }

      const response = await fetch(`${endpoint}/health`);
      return {
        service: 'api',
        healthy: response.ok,
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'api',
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
        checkedAt: new Date(),
      };
    }
  }

  /**
   * Check Lambda functions by invoking a health check function
   */
  async checkLambdas(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const healthFunctionName = this.endpoints['lambdaHealthFunction'] || 'radiant-lambda-health';
      
      const command = new InvokeCommand({
        FunctionName: healthFunctionName,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({ action: 'health_check' }),
      });

      const response = await this.lambdaClient.send(command);
      
      if (response.StatusCode === 200) {
        return {
          service: 'lambdas',
          healthy: true,
          latencyMs: Date.now() - start,
          checkedAt: new Date(),
        };
      }

      return {
        service: 'lambdas',
        healthy: false,
        latencyMs: Date.now() - start,
        message: `Lambda returned status ${response.StatusCode}`,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 'lambdas',
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
        checkedAt: new Date(),
      };
    }
  }

  /**
   * Check S3 buckets accessibility
   */
  async checkS3(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const bucketName = this.endpoints['s3Bucket'] || 'radiant-storage';
      
      const command = new HeadBucketCommand({
        Bucket: bucketName,
      });

      await this.s3Client.send(command);
      
      return {
        service: 's3',
        healthy: true,
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        service: 's3',
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
        checkedAt: new Date(),
      };
    }
  }

  /**
   * Check if all services are healthy
   */
  async isHealthy(): Promise<boolean> {
    const results = await this.runAllChecks();
    return results.every(r => r.healthy);
  }
}
