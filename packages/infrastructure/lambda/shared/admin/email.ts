/**
 * Email utilities using AWS SES
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Logger } from '../logger.js';

const sesClient = new SESClient({});

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(options: EmailOptions, logger: Logger): Promise<void> {
  const fromEmail = `noreply@${process.env.DOMAIN || 'radiant.cloud'}`;
  const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
  
  const command = new SendEmailCommand({
    Source: fromEmail,
    Destination: { ToAddresses: toAddresses },
    Message: {
      Subject: { Data: options.subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: options.html, Charset: 'UTF-8' },
        ...(options.text && { Text: { Data: options.text, Charset: 'UTF-8' } }),
      },
    },
    ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
  });

  try {
    await sesClient.send(command);
    logger.info('Email sent successfully', { to: toAddresses, subject: options.subject });
  } catch (error) {
    logger.error('Failed to send email', error as Error, { to: toAddresses });
    throw error;
  }
}

export function generateInvitationEmail(params: {
  inviteeName: string;
  inviterName: string;
  role: string;
  appName: string;
  environment: string;
  acceptUrl: string;
  expiresAt: string;
  message?: string;
}): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>You've Been Invited to ${params.appName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px;">
    <h1 style="color: #1a1a1a; margin-bottom: 20px;">You're Invited!</h1>
    <p><strong>${params.inviterName}</strong> has invited you to join <strong>${params.appName}</strong> as a <strong>${params.role}</strong> for the <strong>${params.environment}</strong> environment.</p>
    ${params.message ? `<blockquote style="background: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">"${params.message}"</blockquote>` : ''}
    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.acceptUrl}" style="display: inline-block; padding: 14px 32px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Accept Invitation</a>
    </div>
    <p style="color: #666; font-size: 14px;">This invitation expires on <strong>${new Date(params.expiresAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
  </div>
</body>
</html>`;

  const text = `You've been invited to ${params.appName} by ${params.inviterName} as a ${params.role}. Accept: ${params.acceptUrl}`;
  return { html, text };
}

export function generateApprovalEmail(params: {
  approverName: string;
  requesterName: string;
  appName: string;
  environment: string;
  action: string;
  resourceType: string;
  resourceId: string;
  approveUrl: string;
  rejectUrl: string;
  expiresAt: string;
}): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Approval Required - ${params.appName}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
    <div style="background: #ffc107; padding: 20px; text-align: center;">
      <h1 style="margin: 0; color: #1a1a1a;">⚠️ Approval Required</h1>
    </div>
    <div style="padding: 30px;">
      <p>Hi ${params.approverName},</p>
      <p><strong>${params.requesterName}</strong> has requested approval for:</p>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
        <p><strong>Environment:</strong> ${params.environment.toUpperCase()}</p>
        <p><strong>Action:</strong> ${params.action}</p>
        <p><strong>Resource:</strong> ${params.resourceType} (${params.resourceId})</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${params.approveUrl}" style="display: inline-block; padding: 14px 32px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 10px;">✓ Approve</a>
        <a href="${params.rejectUrl}" style="display: inline-block; padding: 14px 32px; background: #dc3545; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">✗ Reject</a>
      </div>
      <p style="color: #dc3545; font-size: 12px; text-align: center;">⚠️ Production deployments require two-person approval</p>
    </div>
  </div>
</body>
</html>`;

  const text = `APPROVAL REQUIRED: ${params.requesterName} requests approval for ${params.action} on ${params.resourceType}. Approve: ${params.approveUrl} Reject: ${params.rejectUrl}`;
  return { html, text };
}
