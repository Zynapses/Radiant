import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { billingService } from '../shared/services';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';
import { ValidationError } from '../shared/errors';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    const path = event.path;
    const method = event.httpMethod;

    // GET /billing/tiers - Get subscription tiers (public)
    if (method === 'GET' && path.endsWith('/tiers')) {
      const tiers = await billingService.getSubscriptionTiers();
      return success({ tiers });
    }

    // GET /billing/subscription - Get current subscription
    if (method === 'GET' && path.endsWith('/subscription')) {
      const subscription = await billingService.getSubscription(user.tenantId);
      return success({ subscription });
    }

    // POST /billing/subscription - Create subscription
    if (method === 'POST' && path.endsWith('/subscription')) {
      const body = JSON.parse(event.body || '{}');

      if (!body.tierId || !body.billingCycle) {
        throw new ValidationError('tierId and billingCycle are required');
      }

      const subscriptionId = await billingService.createSubscription(
        user.tenantId,
        body.tierId,
        body.billingCycle,
        body.seats || 1,
        body.stripeCustomerId,
        body.stripeSubscriptionId
      );

      return success({ subscriptionId });
    }

    // DELETE /billing/subscription/:id - Cancel subscription
    if (method === 'DELETE' && path.includes('/subscription/')) {
      const subscriptionId = path.split('/subscription/')[1];
      const cancelAtPeriodEnd = event.queryStringParameters?.cancelAtPeriodEnd !== 'false';

      await billingService.cancelSubscription(subscriptionId, cancelAtPeriodEnd);
      return success({ cancelled: true });
    }

    // GET /billing/credits - Get credit balance
    if (method === 'GET' && path.endsWith('/credits')) {
      const balance = await billingService.getCreditBalance(user.tenantId);
      return success(balance);
    }

    // POST /billing/credits/purchase - Purchase credits
    if (method === 'POST' && path.endsWith('/credits/purchase')) {
      const body = JSON.parse(event.body || '{}');

      if (!body.creditsAmount || !body.priceCents) {
        throw new ValidationError('creditsAmount and priceCents are required');
      }

      const purchaseId = await billingService.purchaseCredits(
        user.tenantId,
        body.creditsAmount,
        body.priceCents,
        body.stripePaymentIntentId
      );

      return success({ purchaseId });
    }

    // POST /billing/credits/use - Use credits
    if (method === 'POST' && path.endsWith('/credits/use')) {
      const body = JSON.parse(event.body || '{}');

      if (!body.amount) {
        throw new ValidationError('amount is required');
      }

      const result = await billingService.useCredits(
        user.tenantId,
        body.amount,
        body.description,
        body.referenceId
      );

      return success(result);
    }

    // GET /billing/transactions - Get transaction history
    if (method === 'GET' && path.endsWith('/transactions')) {
      const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
      const transactions = await billingService.getTransactionHistory(user.tenantId, limit);
      return success({ transactions });
    }

    throw new ValidationError(`Unknown route: ${method} ${path}`);
  } catch (error) {
    return handleError(error);
  }
}
