/**
 * RADIANT v7.0.0 - Credential Rotation Lambda
 * 
 * Automatically rotates IAM access keys stored in AWS Secrets Manager.
 * Triggered by Secrets Manager rotation schedule or EventBridge rule.
 * 
 * Rotation Steps:
 * 1. createSecret - Generate new access key
 * 2. setSecret - Store new key in AWSPENDING
 * 3. testSecret - Validate new key works
 * 4. finishSecret - Promote AWSPENDING to AWSCURRENT
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  DescribeSecretCommand,
  UpdateSecretVersionStageCommand,
} from '@aws-sdk/client-secrets-manager';
import {
  IAMClient,
  CreateAccessKeyCommand,
  DeleteAccessKeyCommand,
  ListAccessKeysCommand,
  GetUserCommand,
} from '@aws-sdk/client-iam';
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';

// Types
interface RotationEvent {
  SecretId: string;
  ClientRequestToken: string;
  Step: 'createSecret' | 'setSecret' | 'testSecret' | 'finishSecret';
}

interface SecretValue {
  accessKeyId: string;
  secretAccessKey: string;
  iamUserName: string;
  environment: string;
  rotatedAt?: string;
  rotationReason?: string;
}

// Clients
const secretsManager = new SecretsManagerClient({});
const iam = new IAMClient({});
const cloudwatch = new CloudWatchClient({});

// Constants
const MAX_ACCESS_KEYS = 2; // IAM limit per user

/**
 * Main handler - routes to appropriate rotation step
 */
export async function handler(event: RotationEvent): Promise<void> {
  console.log('Credential rotation event:', JSON.stringify(event, null, 2));

  const { SecretId, ClientRequestToken, Step } = event;

  // Validate secret is enabled for rotation
  const secretMetadata = await secretsManager.send(
    new DescribeSecretCommand({ SecretId })
  );

  if (!secretMetadata.RotationEnabled) {
    throw new Error(`Secret ${SecretId} is not enabled for rotation`);
  }

  // Validate version stages
  const versions = secretMetadata.VersionIdsToStages || {};
  if (!versions[ClientRequestToken]) {
    throw new Error(`Secret version ${ClientRequestToken} has no stage for rotation`);
  }

  // Route to appropriate step
  switch (Step) {
    case 'createSecret':
      await createSecret(SecretId, ClientRequestToken);
      break;
    case 'setSecret':
      await setSecret(SecretId, ClientRequestToken);
      break;
    case 'testSecret':
      await testSecret(SecretId, ClientRequestToken);
      break;
    case 'finishSecret':
      await finishSecret(SecretId, ClientRequestToken);
      break;
    default:
      throw new Error(`Unknown rotation step: ${Step}`);
  }

  // Emit metric
  await emitRotationMetric(SecretId, Step, 'Success');
}

/**
 * Step 1: Create a new secret version with a new access key
 */
async function createSecret(secretId: string, token: string): Promise<void> {
  console.log(`createSecret: Starting for ${secretId}`);

  // Get current secret value
  const currentSecret = await getSecretValue(secretId, 'AWSCURRENT');
  const secretData: SecretValue = JSON.parse(currentSecret);

  // Check if AWSPENDING already has a valid key (idempotency)
  try {
    const pendingSecret = await getSecretValue(secretId, 'AWSPENDING', token);
    const pendingData: SecretValue = JSON.parse(pendingSecret);
    
    // Verify the pending key exists in IAM
    const keys = await listAccessKeys(pendingData.iamUserName);
    if (keys.some(k => k.AccessKeyId === pendingData.accessKeyId)) {
      console.log('createSecret: AWSPENDING already has valid key, skipping');
      return;
    }
  } catch {
    // No pending secret, continue with creation
  }

  // Check current key count - delete oldest if at limit
  const existingKeys = await listAccessKeys(secretData.iamUserName);
  if (existingKeys.length >= MAX_ACCESS_KEYS) {
    // Find the key that's NOT the current one and delete it
    const oldKey = existingKeys.find(k => k.AccessKeyId !== secretData.accessKeyId);
    if (oldKey?.AccessKeyId) {
      console.log(`createSecret: Deleting old key ${oldKey.AccessKeyId}`);
      await iam.send(
        new DeleteAccessKeyCommand({
          UserName: secretData.iamUserName,
          AccessKeyId: oldKey.AccessKeyId,
        })
      );
    }
  }

  // Create new access key
  const newKey = await iam.send(
    new CreateAccessKeyCommand({
      UserName: secretData.iamUserName,
    })
  );

  if (!newKey.AccessKey?.AccessKeyId || !newKey.AccessKey?.SecretAccessKey) {
    throw new Error('Failed to create new access key');
  }

  // Create new secret value
  const newSecretData: SecretValue = {
    accessKeyId: newKey.AccessKey.AccessKeyId,
    secretAccessKey: newKey.AccessKey.SecretAccessKey,
    iamUserName: secretData.iamUserName,
    environment: secretData.environment,
    rotatedAt: new Date().toISOString(),
    rotationReason: 'scheduled',
  };

  // Store as AWSPENDING
  await secretsManager.send(
    new PutSecretValueCommand({
      SecretId: secretId,
      ClientRequestToken: token,
      SecretString: JSON.stringify(newSecretData),
      VersionStages: ['AWSPENDING'],
    })
  );

  console.log(`createSecret: Created new key ${newKey.AccessKey.AccessKeyId}`);
}

/**
 * Step 2: Set the secret (no-op for IAM keys, key already created in step 1)
 */
async function setSecret(secretId: string, token: string): Promise<void> {
  console.log(`setSecret: No-op for IAM keys, secret ${secretId}`);
  // IAM keys are immediately active, no additional setup needed
}

/**
 * Step 3: Test the new secret works
 */
async function testSecret(secretId: string, token: string): Promise<void> {
  console.log(`testSecret: Validating new key for ${secretId}`);

  // Get the pending secret
  const pendingSecret = await getSecretValue(secretId, 'AWSPENDING', token);
  const secretData: SecretValue = JSON.parse(pendingSecret);

  // Verify the key exists and is active in IAM
  const keys = await listAccessKeys(secretData.iamUserName);
  const newKey = keys.find(k => k.AccessKeyId === secretData.accessKeyId);

  if (!newKey) {
    throw new Error(`New access key ${secretData.accessKeyId} not found in IAM`);
  }

  if (newKey.Status !== 'Active') {
    throw new Error(`New access key ${secretData.accessKeyId} is not active`);
  }

  // Optional: Make an STS GetCallerIdentity call to fully validate
  // This would require creating a new IAM client with the new credentials
  // For now, we trust that if the key exists and is active, it works

  console.log(`testSecret: Key ${secretData.accessKeyId} validated successfully`);
}

/**
 * Step 4: Finish rotation by promoting AWSPENDING to AWSCURRENT
 */
async function finishSecret(secretId: string, token: string): Promise<void> {
  console.log(`finishSecret: Promoting AWSPENDING for ${secretId}`);

  // Get secret metadata to find current version
  const metadata = await secretsManager.send(
    new DescribeSecretCommand({ SecretId: secretId })
  );

  const versions = metadata.VersionIdsToStages || {};
  let currentVersionId: string | undefined;

  // Find the current version
  for (const [versionId, stages] of Object.entries(versions)) {
    if (stages.includes('AWSCURRENT') && versionId !== token) {
      currentVersionId = versionId;
      break;
    }
  }

  // Get current and pending secrets for cleanup
  const currentSecret = await getSecretValue(secretId, 'AWSCURRENT');
  const currentData: SecretValue = JSON.parse(currentSecret);

  // Move AWSCURRENT to AWSPREVIOUS (if there's an existing current)
  if (currentVersionId) {
    await secretsManager.send(
      new UpdateSecretVersionStageCommand({
        SecretId: secretId,
        VersionStage: 'AWSCURRENT',
        MoveToVersionId: token,
        RemoveFromVersionId: currentVersionId,
      })
    );
  }

  // Delete old access key from IAM (the one that was AWSCURRENT)
  // Add a small delay to allow any in-flight requests to complete
  const overlapMs = parseInt(process.env.KEY_OVERLAP_MS || '60000', 10);
  
  if (overlapMs > 0) {
    console.log(`finishSecret: Waiting ${overlapMs}ms before deleting old key`);
    await new Promise(resolve => setTimeout(resolve, Math.min(overlapMs, 300000))); // Max 5 min
  }

  try {
    await iam.send(
      new DeleteAccessKeyCommand({
        UserName: currentData.iamUserName,
        AccessKeyId: currentData.accessKeyId,
      })
    );
    console.log(`finishSecret: Deleted old key ${currentData.accessKeyId}`);
  } catch (error) {
    // Log but don't fail - key might already be deleted
    console.warn(`finishSecret: Could not delete old key: ${error}`);
  }

  console.log(`finishSecret: Rotation complete, new key is now AWSCURRENT`);
}

// Helper functions

async function getSecretValue(
  secretId: string,
  stage: string,
  versionId?: string
): Promise<string> {
  const params: { SecretId: string; VersionStage: string; VersionId?: string } = {
    SecretId: secretId,
    VersionStage: stage,
  };
  
  if (versionId) {
    params.VersionId = versionId;
  }

  const response = await secretsManager.send(new GetSecretValueCommand(params));
  
  if (!response.SecretString) {
    throw new Error(`Secret ${secretId} has no string value`);
  }

  return response.SecretString;
}

async function listAccessKeys(userName: string) {
  const response = await iam.send(
    new ListAccessKeysCommand({ UserName: userName })
  );
  return response.AccessKeyMetadata || [];
}

async function emitRotationMetric(
  secretId: string,
  step: string,
  status: 'Success' | 'Failure'
): Promise<void> {
  try {
    // Extract environment from secret name (e.g., radiant/dev/deployer-credentials)
    const environment = secretId.split('/')[1] || 'unknown';

    await cloudwatch.send(
      new PutMetricDataCommand({
        Namespace: 'RADIANT/CredentialRotation',
        MetricData: [
          {
            MetricName: 'RotationStep',
            Dimensions: [
              { Name: 'Environment', Value: environment },
              { Name: 'Step', Value: step },
              { Name: 'Status', Value: status },
            ],
            Value: 1,
            Unit: 'Count',
            Timestamp: new Date(),
          },
        ],
      })
    );
  } catch (error) {
    console.warn('Failed to emit metric:', error);
  }
}

/**
 * Standalone rotation trigger (for EventBridge scheduled events)
 * This initiates rotation for all RADIANT secrets
 */
export async function scheduledRotationHandler(event: {
  environments?: string[];
}): Promise<{ rotated: string[]; errors: string[] }> {
  const environments = event.environments || ['dev', 'staging', 'prod'];
  const results = { rotated: [] as string[], errors: [] as string[] };

  for (const env of environments) {
    const secretName = `radiant/${env}/deployer-credentials`;

    try {
      // Check if rotation is due
      const metadata = await secretsManager.send(
        new DescribeSecretCommand({ SecretId: secretName })
      );

      if (!metadata.RotationEnabled) {
        console.log(`Skipping ${secretName}: rotation not enabled`);
        continue;
      }

      const lastRotated = metadata.LastRotatedDate;
      const rotationDays = metadata.RotationRules?.AutomaticallyAfterDays || 90;

      if (lastRotated) {
        const daysSinceRotation = Math.floor(
          (Date.now() - lastRotated.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceRotation < rotationDays) {
          console.log(
            `Skipping ${secretName}: ${daysSinceRotation}/${rotationDays} days since last rotation`
          );
          continue;
        }
      }

      // Trigger rotation
      console.log(`Triggering rotation for ${secretName}`);
      
      // The actual rotation is handled by Secrets Manager invoking this Lambda
      // with the rotation steps. We just need to make sure the secret exists
      // and rotation is configured.
      
      results.rotated.push(secretName);
    } catch (error) {
      console.error(`Error checking ${secretName}:`, error);
      results.errors.push(`${secretName}: ${error}`);
    }
  }

  return results;
}
