import { executeStatement } from '../db/client';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

const sns = new SNSClient({});
const ses = new SESClient({});
const BILLING_ALERT_TOPIC_ARN = process.env.BILLING_ALERT_TOPIC_ARN;
const ALERT_FROM_EMAIL = process.env.ALERT_FROM_EMAIL || process.env.FROM_EMAIL || '';

type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing' | 'paused';
type BillingCycle = 'monthly' | 'annual';
type TransactionType = 'purchase' | 'bonus' | 'refund' | 'usage' | 'transfer_in' | 'transfer_out' | 'subscription_allocation' | 'expiration' | 'adjustment';

interface SubscriptionTier {
  id: string;
  displayName: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  includedCreditsPerUser: number;
  features: Record<string, unknown>;
}

interface Subscription {
  id: string;
  tenantId: string;
  tierId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  seatsPurchased: number;
  seatsUsed: number;
  currentPeriodEnd: Date;
}

interface CreditBalance {
  balance: number;
  lifetimePurchased: number;
  lifetimeUsed: number;
  lifetimeBonus: number;
}

export class BillingService {
  async getSubscriptionTiers(): Promise<SubscriptionTier[]> {
    const result = await executeStatement(
      `SELECT * FROM subscription_tiers WHERE is_public = true ORDER BY sort_order`,
      []
    );

    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        displayName: String(r.display_name),
        priceMonthly: r.price_monthly ? Number(r.price_monthly) : null,
        priceAnnual: r.price_annual ? Number(r.price_annual) : null,
        includedCreditsPerUser: Number(r.included_credits_per_user),
        features: typeof r.features === 'string' ? JSON.parse(r.features) : (r.features as Record<string, unknown>) || {},
      };
    });
  }

  async getSubscription(tenantId: string): Promise<Subscription | null> {
    const result = await executeStatement(
      `SELECT * FROM subscriptions WHERE tenant_id = $1 AND status != 'cancelled' ORDER BY created_at DESC LIMIT 1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (result.rows.length === 0) return null;

    const r = result.rows[0] as Record<string, unknown>;
    return {
      id: String(r.id),
      tenantId: String(r.tenant_id),
      tierId: String(r.tier_id),
      status: r.status as SubscriptionStatus,
      billingCycle: r.billing_cycle as BillingCycle,
      seatsPurchased: parseInt(String(r.seats_purchased), 10),
      seatsUsed: parseInt(String(r.seats_used), 10),
      currentPeriodEnd: new Date(String(r.current_period_end)),
    };
  }

  async createSubscription(
    tenantId: string,
    tierId: string,
    billingCycle: BillingCycle,
    seats: number = 1,
    stripeCustomerId?: string,
    stripeSubscriptionId?: string
  ): Promise<string> {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'annual' ? 12 : 1));

    const result = await executeStatement(
      `INSERT INTO subscriptions 
       (tenant_id, tier_id, billing_cycle, seats_purchased, current_period_start, current_period_end, stripe_customer_id, stripe_subscription_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'tierId', value: { stringValue: tierId } },
        { name: 'billingCycle', value: { stringValue: billingCycle } },
        { name: 'seats', value: { longValue: seats } },
        { name: 'periodStart', value: { stringValue: now.toISOString() } },
        { name: 'periodEnd', value: { stringValue: periodEnd.toISOString() } },
        { name: 'stripeCustomerId', value: stripeCustomerId ? { stringValue: stripeCustomerId } : { isNull: true } },
        { name: 'stripeSubscriptionId', value: stripeSubscriptionId ? { stringValue: stripeSubscriptionId } : { isNull: true } },
      ]
    );

    const subscriptionId = String((result.rows[0] as Record<string, unknown>).id);

    // Initialize credit balance
    await this.initializeCreditBalance(tenantId);

    // Allocate monthly credits
    const tier = await this.getTier(tierId);
    if (tier && tier.includedCreditsPerUser > 0) {
      await this.addCredits(tenantId, tier.includedCreditsPerUser * seats, 'subscription_allocation', `Monthly allocation for ${tierId}`);
    }

    return subscriptionId;
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<void> {
    if (cancelAtPeriodEnd) {
      await executeStatement(
        `UPDATE subscriptions SET cancel_at_period_end = true, updated_at = NOW() WHERE id = $1`,
        [{ name: 'subscriptionId', value: { stringValue: subscriptionId } }]
      );
    } else {
      await executeStatement(
        `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [{ name: 'subscriptionId', value: { stringValue: subscriptionId } }]
      );
    }
  }

  async getCreditBalance(tenantId: string): Promise<CreditBalance> {
    const result = await executeStatement(
      `SELECT * FROM credit_balances WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (result.rows.length === 0) {
      await this.initializeCreditBalance(tenantId);
      return { balance: 0, lifetimePurchased: 0, lifetimeUsed: 0, lifetimeBonus: 0 };
    }

    const r = result.rows[0] as Record<string, unknown>;
    return {
      balance: Number(r.balance),
      lifetimePurchased: Number(r.lifetime_purchased),
      lifetimeUsed: Number(r.lifetime_used),
      lifetimeBonus: Number(r.lifetime_bonus),
    };
  }

  async addCredits(
    tenantId: string,
    amount: number,
    transactionType: TransactionType,
    description?: string,
    referenceId?: string
  ): Promise<number> {
    // Update balance
    const updateResult = await executeStatement(
      `UPDATE credit_balances 
       SET balance = balance + $2,
           lifetime_purchased = lifetime_purchased + CASE WHEN $3 = 'purchase' THEN $2 ELSE 0 END,
           lifetime_bonus = lifetime_bonus + CASE WHEN $3 = 'bonus' THEN $2 ELSE 0 END,
           updated_at = NOW()
       WHERE tenant_id = $1
       RETURNING balance`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'amount', value: { doubleValue: amount } },
        { name: 'transactionType', value: { stringValue: transactionType } },
      ]
    );

    const newBalance = Number((updateResult.rows[0] as Record<string, unknown>).balance);

    // Record transaction
    await executeStatement(
      `INSERT INTO credit_transactions 
       (tenant_id, transaction_type, amount, balance_after, description, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'transactionType', value: { stringValue: transactionType } },
        { name: 'amount', value: { doubleValue: amount } },
        { name: 'balanceAfter', value: { doubleValue: newBalance } },
        { name: 'description', value: description ? { stringValue: description } : { isNull: true } },
        { name: 'referenceId', value: referenceId ? { stringValue: referenceId } : { isNull: true } },
      ]
    );

    return newBalance;
  }

  async useCredits(tenantId: string, amount: number, description?: string, referenceId?: string): Promise<{ success: boolean; newBalance: number }> {
    const balance = await this.getCreditBalance(tenantId);
    
    if (balance.balance < amount) {
      return { success: false, newBalance: balance.balance };
    }

    const updateResult = await executeStatement(
      `UPDATE credit_balances 
       SET balance = balance - $2, lifetime_used = lifetime_used + $2, updated_at = NOW()
       WHERE tenant_id = $1
       RETURNING balance`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'amount', value: { doubleValue: amount } },
      ]
    );

    const newBalance = Number((updateResult.rows[0] as Record<string, unknown>).balance);

    await executeStatement(
      `INSERT INTO credit_transactions 
       (tenant_id, transaction_type, amount, balance_after, description, reference_id)
       VALUES ($1, 'usage', $2, $3, $4, $5)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'amount', value: { doubleValue: -amount } },
        { name: 'balanceAfter', value: { doubleValue: newBalance } },
        { name: 'description', value: description ? { stringValue: description } : { isNull: true } },
        { name: 'referenceId', value: referenceId ? { stringValue: referenceId } : { isNull: true } },
      ]
    );

    // Check low balance alert
    await this.checkLowBalanceAlert(tenantId, newBalance);

    return { success: true, newBalance };
  }

  async purchaseCredits(
    tenantId: string,
    creditsAmount: number,
    priceCents: number,
    stripePaymentIntentId?: string
  ): Promise<string> {
    // Calculate volume discount and bonus
    const { discountPercent, bonusCredits } = this.calculateVolumeDiscount(creditsAmount);
    const finalPriceCents = Math.round(priceCents * (1 - discountPercent / 100));

    const result = await executeStatement(
      `INSERT INTO credit_purchases 
       (tenant_id, credits_amount, bonus_credits, price_cents, discount_percent, stripe_payment_intent_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed')
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'creditsAmount', value: { doubleValue: creditsAmount } },
        { name: 'bonusCredits', value: { doubleValue: bonusCredits } },
        { name: 'priceCents', value: { longValue: finalPriceCents } },
        { name: 'discountPercent', value: { doubleValue: discountPercent } },
        { name: 'stripePaymentIntentId', value: stripePaymentIntentId ? { stringValue: stripePaymentIntentId } : { isNull: true } },
      ]
    );

    const purchaseId = String((result.rows[0] as Record<string, unknown>).id);

    // Add credits to balance
    await this.addCredits(tenantId, creditsAmount, 'purchase', `Purchased ${creditsAmount} credits`, purchaseId);
    
    if (bonusCredits > 0) {
      await this.addCredits(tenantId, bonusCredits, 'bonus', `Bonus credits for volume purchase`, purchaseId);
    }

    return purchaseId;
  }

  async getTransactionHistory(tenantId: string, limit: number = 50): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM credit_transactions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT ${limit}`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    return result.rows;
  }

  private async initializeCreditBalance(tenantId: string): Promise<void> {
    await executeStatement(
      `INSERT INTO credit_balances (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
  }

  private async getTier(tierId: string): Promise<SubscriptionTier | null> {
    const result = await executeStatement(
      `SELECT * FROM subscription_tiers WHERE id = $1`,
      [{ name: 'tierId', value: { stringValue: tierId } }]
    );

    if (result.rows.length === 0) return null;

    const r = result.rows[0] as Record<string, unknown>;
    return {
      id: String(r.id),
      displayName: String(r.display_name),
      priceMonthly: r.price_monthly ? Number(r.price_monthly) : null,
      priceAnnual: r.price_annual ? Number(r.price_annual) : null,
      includedCreditsPerUser: Number(r.included_credits_per_user),
      features: typeof r.features === 'string' ? JSON.parse(r.features) : (r.features as Record<string, unknown>) || {},
    };
  }

  private calculateVolumeDiscount(creditsAmount: number): { discountPercent: number; bonusCredits: number } {
    if (creditsAmount >= 100) return { discountPercent: 25, bonusCredits: creditsAmount * 0.1 };
    if (creditsAmount >= 50) return { discountPercent: 15, bonusCredits: creditsAmount * 0.05 };
    if (creditsAmount >= 20) return { discountPercent: 10, bonusCredits: 0 };
    if (creditsAmount >= 10) return { discountPercent: 5, bonusCredits: 0 };
    return { discountPercent: 0, bonusCredits: 0 };
  }

  private async checkLowBalanceAlert(tenantId: string, currentBalance: number): Promise<void> {
    const result = await executeStatement(
      `SELECT low_balance_alert_threshold, last_low_balance_alert, auto_purchase_enabled, auto_purchase_threshold, auto_purchase_amount
       FROM credit_balances WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (result.rows.length === 0) return;

    const r = result.rows[0] as Record<string, unknown>;
    const threshold = r.low_balance_alert_threshold ? Number(r.low_balance_alert_threshold) : null;
    
    if (threshold && currentBalance <= threshold) {
      const lastAlert = r.last_low_balance_alert ? new Date(String(r.last_low_balance_alert)) : null;
      const oneHourAgo = new Date(Date.now() - 3600000);
      
      if (!lastAlert || lastAlert < oneHourAgo) {
        await executeStatement(
          `UPDATE credit_balances SET last_low_balance_alert = NOW() WHERE tenant_id = $1`,
          [{ name: 'tenantId', value: { stringValue: tenantId } }]
        );
        
        await this.sendLowBalanceNotification(tenantId, currentBalance, threshold);
      }
    }
  }

  private async sendLowBalanceNotification(tenantId: string, currentBalance: number, threshold: number): Promise<void> {
    const alertMessage = {
      tenantId,
      alertType: 'low_balance',
      currentBalance,
      threshold,
      triggeredAt: new Date().toISOString(),
    };

    if (BILLING_ALERT_TOPIC_ARN) {
      try {
        await sns.send(new PublishCommand({
          TopicArn: BILLING_ALERT_TOPIC_ARN,
          Message: JSON.stringify(alertMessage),
          Subject: 'RADIANT: Low Credit Balance Alert',
          MessageAttributes: {
            tenantId: { DataType: 'String', StringValue: tenantId },
            alertType: { DataType: 'String', StringValue: 'low_balance' },
          },
        }));
      } catch (error) {
        logger.error('Failed to publish billing SNS notification', error);
      }
    }

    const emailResult = await executeStatement(
      `SELECT email FROM tenants WHERE id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const email = emailResult.rows[0] ? (emailResult.rows[0] as Record<string, unknown>).email as string : null;
    
    if (email) {
      try {
        await ses.send(new SendEmailCommand({
          Source: ALERT_FROM_EMAIL,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: 'RADIANT: Low Credit Balance Alert' },
            Body: {
              Html: {
                Data: `
                  <h2>Low Credit Balance Alert</h2>
                  <p>Your RADIANT credit balance is running low.</p>
                  <ul>
                    <li><strong>Current Balance:</strong> ${currentBalance.toFixed(2)} credits</li>
                    <li><strong>Alert Threshold:</strong> ${threshold.toFixed(2)} credits</li>
                  </ul>
                  <p>Please purchase additional credits to continue using RADIANT services without interruption.</p>
                `,
              },
              Text: {
                Data: `Low Credit Balance Alert: Your RADIANT credit balance (${currentBalance.toFixed(2)}) has fallen below your alert threshold (${threshold.toFixed(2)}). Please purchase additional credits.`,
              },
            },
          },
        }));
      } catch (error) {
        logger.error('Failed to send billing email notification', error);
      }
    }
  }
}

export const billingService = new BillingService();
