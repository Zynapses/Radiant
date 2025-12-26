/**
 * Email Service
 * 
 * Sends transactional emails via SES with template support
 */

import { SESClient, SendEmailCommand, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});
const FROM_EMAIL = process.env.FROM_EMAIL || '';
const FROM_NAME = process.env.FROM_NAME || 'RADIANT';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface TemplatedEmailOptions {
  to: string | string[];
  template: string;
  data: Record<string, unknown>;
  replyTo?: string;
}

/**
 * Send a raw email
 */
export async function sendEmail(options: EmailOptions): Promise<{ messageId: string }> {
  const { to, subject, html, text, replyTo, cc, bcc } = options;
  
  const toAddresses = Array.isArray(to) ? to : [to];

  const result = await ses.send(new SendEmailCommand({
    Source: `${FROM_NAME} <${FROM_EMAIL}>`,
    Destination: {
      ToAddresses: toAddresses,
      CcAddresses: cc,
      BccAddresses: bcc,
    },
    Message: {
      Subject: { Data: subject },
      Body: {
        Html: { Data: html },
        Text: { Data: text || stripHtml(html) },
      },
    },
    ReplyToAddresses: replyTo ? [replyTo] : undefined,
  }));

  return { messageId: result.MessageId! };
}

/**
 * Send a templated email
 */
export async function sendTemplatedEmail(options: TemplatedEmailOptions): Promise<{ messageId: string }> {
  const { to, template, data, replyTo } = options;
  
  const toAddresses = Array.isArray(to) ? to : [to];

  const result = await ses.send(new SendTemplatedEmailCommand({
    Source: `${FROM_NAME} <${FROM_EMAIL}>`,
    Destination: {
      ToAddresses: toAddresses,
    },
    Template: template,
    TemplateData: JSON.stringify(data),
    ReplyToAddresses: replyTo ? [replyTo] : undefined,
  }));

  return { messageId: result.MessageId! };
}

/**
 * Strip HTML tags for plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// ============================================================================
// Email Templates (inline HTML)
// ============================================================================

export const EmailTemplates = {
  /**
   * Welcome email for new users
   */
  welcome: (data: { name: string; loginUrl: string }) => ({
    subject: 'Welcome to RADIANT',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to RADIANT</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            <p>Welcome to RADIANT! We're excited to have you on board.</p>
            <p>RADIANT gives you access to 100+ AI models through a single API, with unified billing, usage tracking, and enterprise-grade security.</p>
            <p><a href="${data.loginUrl}" class="button">Get Started</a></p>
            <p>If you have any questions, our support team is here to help.</p>
            <p>Best regards,<br>The RADIANT Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} RADIANT. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  /**
   * Low credit balance warning
   */
  lowBalance: (data: { name: string; balance: number; threshold: number; topUpUrl: string }) => ({
    subject: 'Low Credit Balance Warning',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
          .alert { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Low Balance Warning</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            <div class="alert">
              <strong>Your credit balance is low.</strong><br>
              Current balance: <strong>$${data.balance.toFixed(2)}</strong><br>
              Warning threshold: $${data.threshold.toFixed(2)}
            </div>
            <p>To avoid service interruption, please top up your account.</p>
            <p><a href="${data.topUpUrl}" class="button">Add Credits</a></p>
            <p>Best regards,<br>The RADIANT Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} RADIANT. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  /**
   * API key created notification
   */
  apiKeyCreated: (data: { name: string; keyName: string; keyPrefix: string; createdAt: string }) => ({
    subject: 'New API Key Created',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
          .info { background: #f0fdf4; border: 1px solid #10b981; padding: 15px; border-radius: 6px; margin: 20px 0; }
          code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔑 New API Key Created</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            <p>A new API key has been created for your account.</p>
            <div class="info">
              <strong>Key Name:</strong> ${data.keyName}<br>
              <strong>Key Prefix:</strong> <code>${data.keyPrefix}...</code><br>
              <strong>Created:</strong> ${data.createdAt}
            </div>
            <p>If you didn't create this key, please contact support immediately.</p>
            <p>Best regards,<br>The RADIANT Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} RADIANT. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  /**
   * Password reset email
   */
  passwordReset: (data: { name: string; resetUrl: string; expiresIn: string }) => ({
    subject: 'Reset Your Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .warning { color: #666; font-size: 14px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            <p>We received a request to reset your password. Click the button below to create a new password.</p>
            <p><a href="${data.resetUrl}" class="button">Reset Password</a></p>
            <p class="warning">This link will expire in ${data.expiresIn}. If you didn't request a password reset, you can safely ignore this email.</p>
            <p>Best regards,<br>The RADIANT Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} RADIANT. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  /**
   * Invoice/receipt email
   */
  invoice: (data: { name: string; invoiceNumber: string; amount: number; date: string; items: Array<{ description: string; amount: number }>; downloadUrl: string }) => ({
    subject: `Invoice #${data.invoiceNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1f2937; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
          th { background: #f9fafb; }
          .total { font-weight: bold; font-size: 18px; }
          .button { display: inline-block; background: #1f2937; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice #${data.invoiceNumber}</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            <p>Thank you for your payment. Here's your invoice for ${data.date}.</p>
            <table>
              <tr><th>Description</th><th style="text-align: right;">Amount</th></tr>
              ${data.items.map(item => `<tr><td>${item.description}</td><td style="text-align: right;">$${item.amount.toFixed(2)}</td></tr>`).join('')}
              <tr class="total"><td>Total</td><td style="text-align: right;">$${data.amount.toFixed(2)}</td></tr>
            </table>
            <p><a href="${data.downloadUrl}" class="button">Download PDF</a></p>
            <p>Best regards,<br>The RADIANT Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} RADIANT. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
};

/**
 * Send a pre-defined template email
 */
export async function sendTemplateEmail<K extends keyof typeof EmailTemplates>(
  template: K,
  to: string | string[],
  data: Parameters<typeof EmailTemplates[K]>[0]
): Promise<{ messageId: string }> {
  const { subject, html } = (EmailTemplates[template] as (data: unknown) => { subject: string; html: string })(data);
  return sendEmail({ to, subject, html });
}
