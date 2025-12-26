import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

interface WebhooksStackProps extends cdk.StackProps {
  appId: string;
  environment: string;
}

/**
 * Webhooks Stack
 * 
 * Provides event-driven webhook notifications for:
 * - Billing events (low balance, payment received)
 * - Usage events (quota reached, rate limited)
 * - Model events (new model available, model deprecated)
 * - Admin events (config changes, user actions)
 */
export class WebhooksStack extends cdk.Stack {
  public readonly webhooksTable: dynamodb.Table;
  public readonly eventsQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: WebhooksStackProps) {
    super(scope, id, props);

    const { appId, environment } = props;

    // Dead letter queue for failed deliveries
    this.deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: `${appId}-${environment}-webhooks-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Main events queue
    this.eventsQueue = new sqs.Queue(this, 'EventsQueue', {
      queueName: `${appId}-${environment}-webhooks-events`,
      visibilityTimeout: cdk.Duration.seconds(30),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Webhooks configuration table
    this.webhooksTable = new dynamodb.Table(this, 'WebhooksTable', {
      tableName: `${appId}-${environment}-webhooks`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for querying by event type
    this.webhooksTable.addGlobalSecondaryIndex({
      indexName: 'by-event-type',
      partitionKey: { name: 'event_type', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
    });

    // Webhook dispatcher Lambda
    const dispatcherLambda = new lambda.Function(this, 'DispatcherLambda', {
      functionName: `${appId}-${environment}-webhook-dispatcher`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const https = require('https');
        const crypto = require('crypto');
        
        exports.handler = async (event) => {
          for (const record of event.Records) {
            const body = JSON.parse(record.body);
            await deliverWebhook(body);
          }
        };
        
        async function deliverWebhook(event) {
          const { url, secret, payload } = event;
          
          const signature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
          
          const options = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Radiant-Signature': signature,
              'X-Radiant-Event': payload.type,
              'X-Radiant-Delivery': payload.id,
            },
          };
          
          return new Promise((resolve, reject) => {
            const req = https.request(url, options, (res) => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ success: true, statusCode: res.statusCode });
              } else {
                reject(new Error('Webhook delivery failed: ' + res.statusCode));
              }
            });
            req.on('error', reject);
            req.write(JSON.stringify(payload));
            req.end();
          });
        }
      `),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        WEBHOOKS_TABLE: this.webhooksTable.tableName,
      },
    });

    // Grant permissions
    this.webhooksTable.grantReadData(dispatcherLambda);
    this.eventsQueue.grantConsumeMessages(dispatcherLambda);

    // SQS event source
    dispatcherLambda.addEventSourceMapping('SQSEventSource', {
      eventSourceArn: this.eventsQueue.queueArn,
      batchSize: 10,
    });

    // Event publisher Lambda
    const publisherLambda = new lambda.Function(this, 'PublisherLambda', {
      functionName: `${appId}-${environment}-webhook-publisher`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
        const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
        
        const dynamodb = new DynamoDBClient({});
        const sqs = new SQSClient({});
        
        exports.handler = async (event) => {
          const { eventType, tenantId, data } = event;
          
          // Find all webhooks subscribed to this event type
          const webhooks = await dynamodb.send(new QueryCommand({
            TableName: process.env.WEBHOOKS_TABLE,
            IndexName: 'by-event-type',
            KeyConditionExpression: 'event_type = :et AND tenant_id = :tid',
            ExpressionAttributeValues: {
              ':et': { S: eventType },
              ':tid': { S: tenantId },
            },
          }));
          
          // Queue delivery for each webhook
          for (const webhook of webhooks.Items || []) {
            await sqs.send(new SendMessageCommand({
              QueueUrl: process.env.EVENTS_QUEUE_URL,
              MessageBody: JSON.stringify({
                url: webhook.url.S,
                secret: webhook.secret.S,
                payload: {
                  id: crypto.randomUUID(),
                  type: eventType,
                  created_at: new Date().toISOString(),
                  data,
                },
              }),
            }));
          }
          
          return { delivered: webhooks.Items?.length || 0 };
        };
      `),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        WEBHOOKS_TABLE: this.webhooksTable.tableName,
        EVENTS_QUEUE_URL: this.eventsQueue.queueUrl,
      },
    });

    this.webhooksTable.grantReadData(publisherLambda);
    this.eventsQueue.grantSendMessages(publisherLambda);

    // EventBridge rule for billing events
    new events.Rule(this, 'BillingEventsRule', {
      ruleName: `${appId}-${environment}-billing-events`,
      eventPattern: {
        source: ['radiant.billing'],
        detailType: ['LowBalance', 'PaymentReceived', 'SubscriptionChanged'],
      },
      targets: [new targets.LambdaFunction(publisherLambda)],
    });

    // EventBridge rule for usage events
    new events.Rule(this, 'UsageEventsRule', {
      ruleName: `${appId}-${environment}-usage-events`,
      eventPattern: {
        source: ['radiant.usage'],
        detailType: ['QuotaReached', 'RateLimited', 'UsageThreshold'],
      },
      targets: [new targets.LambdaFunction(publisherLambda)],
    });

    // EventBridge rule for model events
    new events.Rule(this, 'ModelEventsRule', {
      ruleName: `${appId}-${environment}-model-events`,
      eventPattern: {
        source: ['radiant.models'],
        detailType: ['ModelAdded', 'ModelDeprecated', 'ModelUpdated'],
      },
      targets: [new targets.LambdaFunction(publisherLambda)],
    });

    // Outputs
    new cdk.CfnOutput(this, 'WebhooksTableName', {
      value: this.webhooksTable.tableName,
      description: 'Webhooks DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'EventsQueueUrl', {
      value: this.eventsQueue.queueUrl,
      description: 'Webhook events SQS queue URL',
    });
  }
}

/**
 * Webhook Event Types
 * 
 * billing.low_balance - Credit balance below threshold
 * billing.payment_received - Payment processed successfully
 * billing.subscription_changed - Subscription tier changed
 * 
 * usage.quota_reached - Daily/monthly quota exceeded
 * usage.rate_limited - Request rate limited
 * usage.threshold_reached - Custom usage threshold reached
 * 
 * models.added - New model available
 * models.deprecated - Model being deprecated
 * models.updated - Model configuration changed
 * 
 * admin.config_changed - Configuration updated
 * admin.user_added - New admin user added
 * admin.api_key_created - New API key created
 */
