/**
 * Stripe payment integration
 * Note: Stripe is an optional dependency - ensure it's installed before using this module
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Logger } from '../logger.js';

// Stripe types for when module is available
interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  metadata: Record<string, string>;
}

interface StripeInvoice {
  id: string;
  status: string;
  amount_due: number;
  hosted_invoice_url: string | null;
}

interface StripeInvoiceFull extends StripeInvoice {
  paid: boolean;
  amount_paid: number;
}

interface StripeClient {
  customers: {
    search: (params: { query: string; limit: number }) => Promise<{ data: StripeCustomer[] }>;
    create: (params: { email: string; name: string; metadata: Record<string, string> }) => Promise<StripeCustomer>;
  };
  invoiceItems: {
    create: (params: {
      customer: string;
      amount: number;
      currency: string;
      description: string;
      quantity: number;
      metadata?: Record<string, string>;
    }) => Promise<unknown>;
  };
  invoices: {
    create: (params: {
      customer: string;
      auto_advance: boolean;
      collection_method: string;
      metadata: Record<string, string>;
    }) => Promise<StripeInvoice>;
    retrieve: (id: string) => Promise<StripeInvoiceFull>;
    finalizeInvoice: (id: string) => Promise<StripeInvoice>;
  };
}

const secretsClient = new SecretsManagerClient({});
let stripeClient: StripeClient | null = null;

async function getStripeClient(): Promise<StripeClient> {
  if (stripeClient) return stripeClient;
  
  const secretArn = process.env.STRIPE_SECRET_ARN;
  if (!secretArn) throw new Error('STRIPE_SECRET_ARN not configured');
  
  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const response = await secretsClient.send(command);
  if (!response.SecretString) throw new Error('Stripe secret not found');
  
  const secrets = JSON.parse(response.SecretString) as { apiKey: string };
  
  // Dynamic import of Stripe - will fail if not installed
  const { default: Stripe } = await import('stripe') as { default: new (key: string, config: { apiVersion: string }) => StripeClient };
  stripeClient = new Stripe(secrets.apiKey, { apiVersion: '2023-10-16' });
  return stripeClient;
}

export async function getOrCreateCustomer(
  tenantId: string,
  email: string,
  name: string,
  metadata: Record<string, string>,
  logger: Logger
): Promise<string> {
  const stripe = await getStripeClient();
  
  const existing = await stripe.customers.search({
    query: `metadata['tenantId']:'${tenantId}'`,
    limit: 1,
  });
  
  if (existing.data.length > 0) {
    logger.info('Found existing Stripe customer', { tenantId, customerId: existing.data[0].id });
    return existing.data[0].id;
  }
  
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { tenantId, ...metadata },
  });
  
  logger.info('Created Stripe customer', { tenantId, customerId: customer.id });
  return customer.id;
}

export async function createInvoice(params: {
  customerId: string;
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  lineItems: Array<{
    description: string;
    amount: number;
    quantity: number;
    metadata?: Record<string, string>;
  }>;
  metadata?: Record<string, string>;
}, logger: Logger): Promise<StripeInvoice> {
  const stripe = await getStripeClient();
  
  for (const item of params.lineItems) {
    await stripe.invoiceItems.create({
      customer: params.customerId,
      amount: item.amount,
      currency: 'usd',
      description: item.description,
      quantity: item.quantity,
      metadata: item.metadata,
    });
  }
  
  const invoice = await stripe.invoices.create({
    customer: params.customerId,
    auto_advance: true,
    collection_method: 'charge_automatically',
    metadata: {
      tenantId: params.tenantId,
      periodStart: params.periodStart.toISOString(),
      periodEnd: params.periodEnd.toISOString(),
      ...params.metadata,
    },
  });
  
  logger.info('Created Stripe invoice', { tenantId: params.tenantId, invoiceId: invoice.id });
  return invoice;
}

export async function getInvoiceStatus(invoiceId: string, logger: Logger): Promise<{
  status: string;
  paid: boolean;
  amountDue: number;
  amountPaid: number;
}> {
  const stripe = await getStripeClient();
  const invoice = await stripe.invoices.retrieve(invoiceId);
  return {
    status: invoice.status || 'unknown',
    paid: invoice.paid,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
  };
}
