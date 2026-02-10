/**
 * JWT Signing Key Rotation Lambda
 *
 * Handles rotation of JWT signing keys stored in AWS Secrets Manager.
 * Implements dual-key validation during rotation window so existing
 * tokens remain valid until they naturally expire.
 *
 * Rotation Steps:
 * 1. createSigningKey - Generate new HMAC signing key
 * 2. setSigningKey - Store as AWSPENDING in Secrets Manager
 * 3. testSigningKey - Validate new key can sign/verify
 * 4. finishSigningKey - Promote to AWSCURRENT, old key becomes AWSPREVIOUS
 *
 * @version 1.0.0
 * @since RADIANT v4.18.0
 */

import { randomBytes, createHmac } from 'crypto';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  DescribeSecretCommand,
  UpdateSecretVersionStageCommand,
} from '@aws-sdk/client-secrets-manager';
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

interface RotationEvent {
  SecretId: string;
  ClientRequestToken: string;
  Step: 'createSecret' | 'setSecret' | 'testSecret' | 'finishSecret';
}

interface JwtSigningPayload {
  signingKey: string;
  algorithm: string;
  keyId: string;
  rotatedAt: string;
  rotationReason: string;
  environment: string;
}

const secretsManager = new SecretsManagerClient({});
const cloudwatch = new CloudWatchClient({});
const sns = new SNSClient({});

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN || '';

export async function handler(event: RotationEvent): Promise<void> {
  const { SecretId, ClientRequestToken, Step } = event;

  // Verify the secret is enabled for rotation
  const metadata = await secretsManager.send(new DescribeSecretCommand({
    SecretId,
  }));

  if (!metadata.RotationEnabled) {
    throw new Error(`Secret ${SecretId} is not enabled for rotation`);
  }

  // Verify the version is staged correctly
  const versions = metadata.VersionIdsToStages || {};
  if (!versions[ClientRequestToken]) {
    throw new Error(`Secret version ${ClientRequestToken} has no stage for rotation of secret ${SecretId}`);
  }

  if (versions[ClientRequestToken].includes('AWSCURRENT')) {
    console.log(`Secret version ${ClientRequestToken} already set as AWSCURRENT`);
    return;
  }

  if (!versions[ClientRequestToken].includes('AWSPENDING')) {
    throw new Error(`Secret version ${ClientRequestToken} not set as AWSPENDING`);
  }

  switch (Step) {
    case 'createSecret':
      await createSigningKey(SecretId, ClientRequestToken);
      break;
    case 'setSecret':
      // No external resources to update for JWT signing keys
      console.log('setSecret: No external resources to update');
      break;
    case 'testSecret':
      await testSigningKey(SecretId, ClientRequestToken);
      break;
    case 'finishSecret':
      await finishSigningKey(SecretId, ClientRequestToken);
      break;
    default:
      throw new Error(`Unknown rotation step: ${Step}`);
  }
}

async function createSigningKey(secretId: string, versionId: string): Promise<void> {
  // Check if AWSPENDING already has a value
  try {
    await secretsManager.send(new GetSecretValueCommand({
      SecretId: secretId,
      VersionId: versionId,
      VersionStage: 'AWSPENDING',
    }));
    console.log('createSigningKey: AWSPENDING already exists, skipping creation');
    return;
  } catch (err: unknown) {
    if (!(err instanceof Error) || !err.message.includes('ResourceNotFoundException')) {
      // If not a "not found" error, unexpected
      if (err instanceof Error && !err.name.includes('ResourceNotFoundException')) {
        throw err;
      }
    }
  }

  // Generate a new 512-bit HMAC signing key
  const signingKey = randomBytes(64).toString('base64');
  const keyId = `jwt-${Date.now()}-${randomBytes(4).toString('hex')}`;

  const payload: JwtSigningPayload = {
    signingKey,
    algorithm: 'HS512',
    keyId,
    rotatedAt: new Date().toISOString(),
    rotationReason: 'scheduled_rotation',
    environment: ENVIRONMENT,
  };

  await secretsManager.send(new PutSecretValueCommand({
    SecretId: secretId,
    ClientRequestToken: versionId,
    SecretString: JSON.stringify(payload),
    VersionStages: ['AWSPENDING'],
  }));

  console.log(`createSigningKey: New JWT signing key created with keyId=${keyId}`);
}

async function testSigningKey(secretId: string, versionId: string): Promise<void> {
  const pendingValue = await secretsManager.send(new GetSecretValueCommand({
    SecretId: secretId,
    VersionId: versionId,
    VersionStage: 'AWSPENDING',
  }));

  if (!pendingValue.SecretString) {
    throw new Error('testSigningKey: AWSPENDING has no secret string');
  }

  const payload: JwtSigningPayload = JSON.parse(pendingValue.SecretString);

  if (!payload.signingKey || !payload.algorithm || !payload.keyId) {
    throw new Error('testSigningKey: Invalid signing key payload');
  }

  // Test that we can sign and verify with the new key
  const testData = 'test-jwt-payload';
  const signature = createHmac('sha512', Buffer.from(payload.signingKey, 'base64'))
    .update(testData)
    .digest('base64url');

  if (!signature || signature.length < 20) {
    throw new Error('testSigningKey: Signing key produced invalid signature');
  }

  // Verify the signature
  const verifySignature = createHmac('sha512', Buffer.from(payload.signingKey, 'base64'))
    .update(testData)
    .digest('base64url');

  if (signature !== verifySignature) {
    throw new Error('testSigningKey: Signature verification failed');
  }

  console.log(`testSigningKey: JWT signing key ${payload.keyId} validated successfully`);
}

async function finishSigningKey(secretId: string, versionId: string): Promise<void> {
  const metadata = await secretsManager.send(new DescribeSecretCommand({
    SecretId: secretId,
  }));

  // Find the current version
  let currentVersionId: string | undefined;
  const versions = metadata.VersionIdsToStages || {};

  for (const [vid, stages] of Object.entries(versions)) {
    if (stages.includes('AWSCURRENT') && vid !== versionId) {
      currentVersionId = vid;
      break;
    }
  }

  // Move AWSCURRENT to the new version
  await secretsManager.send(new UpdateSecretVersionStageCommand({
    SecretId: secretId,
    VersionStage: 'AWSCURRENT',
    MoveToVersionId: versionId,
    RemoveFromVersionId: currentVersionId,
  }));

  // Emit metric
  await cloudwatch.send(new PutMetricDataCommand({
    Namespace: 'RADIANT/Security',
    MetricData: [{
      MetricName: 'JwtSigningKeyRotation',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'Environment', Value: ENVIRONMENT },
      ],
    }],
  }));

  // Alert
  if (ALERT_TOPIC_ARN) {
    await sns.send(new PublishCommand({
      TopicArn: ALERT_TOPIC_ARN,
      Subject: `[RADIANT Security] JWT Signing Key Rotated (${ENVIRONMENT})`,
      Message: JSON.stringify({
        type: 'JWT_SIGNING_KEY_ROTATED',
        environment: ENVIRONMENT,
        secretId: secretId,
        previousVersionId: currentVersionId,
        newVersionId: versionId,
        timestamp: new Date().toISOString(),
        note: 'Old key remains as AWSPREVIOUS for dual-key validation window',
      }, null, 2),
    }));
  }

  console.log(`finishSigningKey: JWT signing key rotation complete. Previous=${currentVersionId}, New=${versionId}`);
}
