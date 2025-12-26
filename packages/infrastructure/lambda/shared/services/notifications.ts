/**
 * Notifications Service
 * 
 * Multi-channel notification delivery (email, in-app, push, SMS)
 */

import { DynamoDBClient, PutItemCommand, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { sendTemplateEmail, EmailTemplates } from './email';

const dynamodb = new DynamoDBClient({});
const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE || 'radiant-notifications';

export type NotificationChannel = 'email' | 'in_app' | 'push' | 'sms' | 'webhook';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export interface Notification {
  id: string;
  tenantId: string;
  userId?: string;
  type: string;
  title: string;
  message: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  status: NotificationStatus;
  data?: Record<string, unknown>;
  createdAt: string;
  sentAt?: string;
  readAt?: string;
}

export interface NotificationPreferences {
  tenantId: string;
  userId: string;
  channels: {
    email: boolean;
    in_app: boolean;
    push: boolean;
    sms: boolean;
    webhook: boolean;
  };
  types: {
    billing: boolean;
    usage: boolean;
    security: boolean;
    system: boolean;
    marketing: boolean;
  };
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm
    end: string;   // HH:mm
    timezone: string;
  };
}

/**
 * Send a notification
 */
export async function sendNotification(options: {
  tenantId: string;
  userId?: string;
  type: string;
  title: string;
  message: string;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  data?: Record<string, unknown>;
}): Promise<Notification> {
  const {
    tenantId,
    userId,
    type,
    title,
    message,
    channels = ['in_app'],
    priority = 'normal',
    data,
  } = options;

  const notification: Notification = {
    id: generateId(),
    tenantId,
    userId,
    type,
    title,
    message,
    channels,
    priority,
    status: 'pending',
    data,
    createdAt: new Date().toISOString(),
  };

  // Store notification
  await storeNotification(notification);

  // Deliver to each channel
  for (const channel of channels) {
    try {
      await deliverToChannel(notification, channel);
    } catch (error) {
      console.error(`Failed to deliver to ${channel}:`, error);
    }
  }

  // Update status
  notification.status = 'sent';
  notification.sentAt = new Date().toISOString();
  await updateNotificationStatus(notification.id, tenantId, 'sent');

  return notification;
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  tenantId: string,
  userId: string,
  options?: {
    status?: NotificationStatus;
    limit?: number;
    unreadOnly?: boolean;
  }
): Promise<Notification[]> {
  const { limit = 50, unreadOnly = false } = options || {};

  const result = await dynamodb.send(new QueryCommand({
    TableName: NOTIFICATIONS_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': { S: `TENANT#${tenantId}#USER#${userId}` },
    },
    Limit: limit,
    ScanIndexForward: false, // Most recent first
  }));

  let notifications = (result.Items || []).map(itemToNotification);

  if (unreadOnly) {
    notifications = notifications.filter(n => !n.readAt);
  }

  return notifications;
}

/**
 * Mark notification as read
 */
export async function markAsRead(
  notificationId: string,
  tenantId: string,
  userId: string
): Promise<void> {
  await dynamodb.send(new UpdateItemCommand({
    TableName: NOTIFICATIONS_TABLE,
    Key: {
      pk: { S: `TENANT#${tenantId}#USER#${userId}` },
      sk: { S: `NOTIFICATION#${notificationId}` },
    },
    UpdateExpression: 'SET read_at = :readAt, #status = :status',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':readAt': { S: new Date().toISOString() },
      ':status': { S: 'read' },
    },
  }));
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(tenantId: string, userId: string): Promise<number> {
  const notifications = await getNotifications(tenantId, userId, { unreadOnly: true });
  
  for (const notification of notifications) {
    await markAsRead(notification.id, tenantId, userId);
  }

  return notifications.length;
}

/**
 * Get unread count
 */
export async function getUnreadCount(tenantId: string, userId: string): Promise<number> {
  const notifications = await getNotifications(tenantId, userId, { unreadOnly: true });
  return notifications.length;
}

// ============================================================================
// Notification Types
// ============================================================================

export const NotificationTypes = {
  // Billing
  LOW_BALANCE: 'billing.low_balance',
  PAYMENT_RECEIVED: 'billing.payment_received',
  PAYMENT_FAILED: 'billing.payment_failed',
  INVOICE_READY: 'billing.invoice_ready',

  // Usage
  QUOTA_WARNING: 'usage.quota_warning',
  QUOTA_EXCEEDED: 'usage.quota_exceeded',
  USAGE_SPIKE: 'usage.spike',

  // Security
  NEW_LOGIN: 'security.new_login',
  API_KEY_CREATED: 'security.api_key_created',
  API_KEY_REVOKED: 'security.api_key_revoked',
  PASSWORD_CHANGED: 'security.password_changed',

  // System
  MAINTENANCE_SCHEDULED: 'system.maintenance_scheduled',
  MAINTENANCE_COMPLETE: 'system.maintenance_complete',
  NEW_FEATURE: 'system.new_feature',
  MODEL_DEPRECATED: 'system.model_deprecated',

  // Admin
  USER_INVITED: 'admin.user_invited',
  USER_JOINED: 'admin.user_joined',
  ROLE_CHANGED: 'admin.role_changed',
};

// ============================================================================
// Channel Delivery
// ============================================================================

async function deliverToChannel(notification: Notification, channel: NotificationChannel): Promise<void> {
  switch (channel) {
    case 'email':
      await deliverEmail(notification);
      break;
    case 'in_app':
      // Already stored in database
      break;
    case 'push':
      await deliverPush(notification);
      break;
    case 'sms':
      await deliverSms(notification);
      break;
    case 'webhook':
      await deliverWebhook(notification);
      break;
  }
}

async function deliverEmail(notification: Notification): Promise<void> {
  // Get user email from database
  const email = notification.data?.email as string;
  if (!email) return;

  // Map notification type to email template
  if (notification.type === NotificationTypes.LOW_BALANCE) {
    await sendTemplateEmail('lowBalance', email, {
      name: notification.data?.name as string || 'User',
      balance: notification.data?.balance as number || 0,
      threshold: notification.data?.threshold as number || 10,
      topUpUrl: notification.data?.topUpUrl as string || `${process.env.APP_URL || ''}/billing`,
    });
  } else if (notification.type === NotificationTypes.API_KEY_CREATED) {
    await sendTemplateEmail('apiKeyCreated', email, {
      name: notification.data?.name as string || 'User',
      keyName: notification.data?.keyName as string || 'API Key',
      keyPrefix: notification.data?.keyPrefix as string || 'rad_...',
      createdAt: notification.createdAt,
    });
  }
  // Add more template mappings as needed
}

async function deliverPush(notification: Notification): Promise<void> {
  // Send push notification via Firebase/APNs
  console.log('Push notification:', notification.title);
}

async function deliverSms(notification: Notification): Promise<void> {
  // Send SMS via SNS
  console.log('SMS notification:', notification.title);
}

async function deliverWebhook(notification: Notification): Promise<void> {
  // Deliver via webhook
  console.log('Webhook notification:', notification.title);
}

// ============================================================================
// Helper Functions
// ============================================================================

async function storeNotification(notification: Notification): Promise<void> {
  const pk = notification.userId 
    ? `TENANT#${notification.tenantId}#USER#${notification.userId}`
    : `TENANT#${notification.tenantId}`;

  await dynamodb.send(new PutItemCommand({
    TableName: NOTIFICATIONS_TABLE,
    Item: {
      pk: { S: pk },
      sk: { S: `NOTIFICATION#${notification.id}` },
      id: { S: notification.id },
      tenant_id: { S: notification.tenantId },
      user_id: notification.userId ? { S: notification.userId } : { NULL: true },
      type: { S: notification.type },
      title: { S: notification.title },
      message: { S: notification.message },
      channels: { SS: notification.channels },
      priority: { S: notification.priority },
      status: { S: notification.status },
      data: notification.data ? { S: JSON.stringify(notification.data) } : { NULL: true },
      created_at: { S: notification.createdAt },
      ttl: { N: String(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60) }, // 30 days
    },
  }));
}

async function updateNotificationStatus(id: string, tenantId: string, status: NotificationStatus): Promise<void> {
  // Update in database
}

function itemToNotification(item: Record<string, any>): Notification {
  return {
    id: item.id?.S || '',
    tenantId: item.tenant_id?.S || '',
    userId: item.user_id?.S,
    type: item.type?.S || '',
    title: item.title?.S || '',
    message: item.message?.S || '',
    channels: (item.channels?.SS || []) as NotificationChannel[],
    priority: (item.priority?.S || 'normal') as NotificationPriority,
    status: (item.status?.S || 'pending') as NotificationStatus,
    data: item.data?.S ? JSON.parse(item.data.S) : undefined,
    createdAt: item.created_at?.S || '',
    sentAt: item.sent_at?.S,
    readAt: item.read_at?.S,
  };
}

function generateId(): string {
  return 'notif_' + crypto.randomUUID().replace(/-/g, '');
}
