/**
 * Monthly IAM Access Report Lambda
 *
 * Generates a comprehensive IAM credential and access report:
 * - Credential age and last-used analysis
 * - IAM Access Analyzer findings summary
 * - Overly permissive role detection
 * - Publishes report to SNS for admin review
 *
 * @version 1.0.0
 * @since RADIANT v4.18.0
 */

import {
  IAMClient,
  GenerateCredentialReportCommand,
  GetCredentialReportCommand,
  ListUsersCommand,
  ListAccessKeysCommand,
  GetAccessKeyLastUsedCommand,
} from '@aws-sdk/client-iam';
import {
  AccessAnalyzerClient,
  ListFindingsCommand,
  FindingStatusUpdate,
} from '@aws-sdk/client-accessanalyzer';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';

const iam = new IAMClient({});
const accessAnalyzer = new AccessAnalyzerClient({});
const sns = new SNSClient({});
const cloudwatch = new CloudWatchClient({});

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const ANALYZER_ARN = process.env.ANALYZER_ARN || '';
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN || '';

interface CredentialReport {
  totalUsers: number;
  usersWithAccessKeys: number;
  staleKeys: { userName: string; keyId: string; daysOld: number; lastUsedDays: number | null }[];
  rootKeyPresent: boolean;
  mfaEnabled: number;
  mfaDisabled: number;
}

interface AccessAnalyzerReport {
  totalFindings: number;
  activeFindings: number;
  findingsByResourceType: Record<string, number>;
  criticalFindings: { resource: string; type: string; condition: string }[];
}

interface MonthlyReport {
  environment: string;
  generatedAt: string;
  credentials: CredentialReport;
  accessAnalyzer: AccessAnalyzerReport;
  recommendations: string[];
}

export async function handler(): Promise<MonthlyReport> {
  const report: MonthlyReport = {
    environment: ENVIRONMENT,
    generatedAt: new Date().toISOString(),
    credentials: {
      totalUsers: 0,
      usersWithAccessKeys: 0,
      staleKeys: [],
      rootKeyPresent: false,
      mfaEnabled: 0,
      mfaDisabled: 0,
    },
    accessAnalyzer: {
      totalFindings: 0,
      activeFindings: 0,
      findingsByResourceType: {},
      criticalFindings: [],
    },
    recommendations: [],
  };

  // 1. Generate and parse IAM Credential Report
  try {
    await iam.send(new GenerateCredentialReportCommand({}));
    // Wait for report generation
    await new Promise(resolve => setTimeout(resolve, 5000));

    const credReport = await iam.send(new GetCredentialReportCommand({}));
    if (credReport.Content) {
      const csv = Buffer.from(credReport.Content).toString('utf-8');
      const lines = csv.split('\n');
      const headers = lines[0].split(',');

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const fields = lines[i].split(',');
        const user: Record<string, string> = {};
        headers.forEach((h, idx) => { user[h.trim()] = fields[idx]?.trim() || ''; });

        report.credentials.totalUsers++;

        if (user['user'] === '<root_account>') {
          report.credentials.rootKeyPresent =
            user['access_key_1_active'] === 'true' || user['access_key_2_active'] === 'true';
        }

        if (user['mfa_active'] === 'true') {
          report.credentials.mfaEnabled++;
        } else if (user['user'] !== '<root_account>') {
          report.credentials.mfaDisabled++;
        }

        if (user['access_key_1_active'] === 'true' || user['access_key_2_active'] === 'true') {
          report.credentials.usersWithAccessKeys++;
        }
      }
    }
  } catch (err) {
    console.error('Failed to generate credential report:', err);
  }

  // 2. Check individual access keys for staleness
  try {
    const usersResult = await iam.send(new ListUsersCommand({ MaxItems: 100 }));
    const now = Date.now();

    for (const user of usersResult.Users || []) {
      const keysResult = await iam.send(new ListAccessKeysCommand({
        UserName: user.UserName,
      }));

      for (const key of keysResult.AccessKeyMetadata || []) {
        if (key.Status !== 'Active' || !key.AccessKeyId) continue;

        const lastUsed = await iam.send(new GetAccessKeyLastUsedCommand({
          AccessKeyId: key.AccessKeyId,
        }));

        const createdDays = key.CreateDate
          ? Math.floor((now - key.CreateDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        const lastUsedDays = lastUsed.AccessKeyLastUsed?.LastUsedDate
          ? Math.floor((now - lastUsed.AccessKeyLastUsed.LastUsedDate.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        if (createdDays > 90 || (lastUsedDays !== null && lastUsedDays > 30)) {
          report.credentials.staleKeys.push({
            userName: user.UserName || 'unknown',
            keyId: key.AccessKeyId,
            daysOld: createdDays,
            lastUsedDays,
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to check access keys:', err);
  }

  // 3. IAM Access Analyzer findings
  if (ANALYZER_ARN) {
    try {
      const findings = await accessAnalyzer.send(new ListFindingsCommand({
        analyzerArn: ANALYZER_ARN,
        filter: {
          status: { eq: ['ACTIVE'] },
        },
        maxResults: 100,
      }));

      report.accessAnalyzer.totalFindings = findings.findings?.length || 0;
      report.accessAnalyzer.activeFindings = findings.findings?.length || 0;

      for (const finding of findings.findings || []) {
        const resourceType = finding.resourceType || 'Unknown';
        report.accessAnalyzer.findingsByResourceType[resourceType] =
          (report.accessAnalyzer.findingsByResourceType[resourceType] || 0) + 1;

        if (finding.resourceType === 'AWS::IAM::Role' || finding.resourceType === 'AWS::S3::Bucket') {
          report.accessAnalyzer.criticalFindings.push({
            resource: finding.resource || 'unknown',
            type: finding.resourceType || 'unknown',
            condition: JSON.stringify(finding.condition || {}),
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch Access Analyzer findings:', err);
    }
  }

  // 4. Generate recommendations
  if (report.credentials.rootKeyPresent) {
    report.recommendations.push('CRITICAL: Root account has active access keys. Remove immediately.');
  }
  if (report.credentials.mfaDisabled > 0) {
    report.recommendations.push(`${report.credentials.mfaDisabled} IAM users do not have MFA enabled.`);
  }
  if (report.credentials.staleKeys.length > 0) {
    report.recommendations.push(`${report.credentials.staleKeys.length} stale access keys detected (>90 days old or >30 days unused).`);
  }
  if (report.accessAnalyzer.activeFindings > 0) {
    report.recommendations.push(`${report.accessAnalyzer.activeFindings} active IAM Access Analyzer findings require review.`);
  }
  if (report.recommendations.length === 0) {
    report.recommendations.push('All credential hygiene checks passed.');
  }

  // 5. Publish metrics
  await cloudwatch.send(new PutMetricDataCommand({
    Namespace: 'RADIANT/Security',
    MetricData: [
      { MetricName: 'StaleAccessKeys', Value: report.credentials.staleKeys.length, Unit: 'Count', Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }] },
      { MetricName: 'AccessAnalyzerFindings', Value: report.accessAnalyzer.activeFindings, Unit: 'Count', Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }] },
      { MetricName: 'MfaDisabledUsers', Value: report.credentials.mfaDisabled, Unit: 'Count', Dimensions: [{ Name: 'Environment', Value: ENVIRONMENT }] },
    ],
  }));

  // 6. Publish report to SNS
  if (ALERT_TOPIC_ARN) {
    await sns.send(new PublishCommand({
      TopicArn: ALERT_TOPIC_ARN,
      Subject: `[RADIANT Security] Monthly IAM Access Report - ${ENVIRONMENT}`,
      Message: JSON.stringify(report, null, 2),
    }));
  }

  return report;
}
